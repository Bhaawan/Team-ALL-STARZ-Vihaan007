import cv2
import torch
from torchvision import transforms
import numpy as np
import argparse
import sys
import time

# Desired Image Dimensions.
IMG_WIDTH = 480
IMG_HEIGHT = 640


def blur(img):
    return cv2.GaussianBlur(img, (25, 25), 0)


def to_tensor(img):
    # Preprocess the image to meet the input requirement of the networks.
    preprocess = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    input_tensor = preprocess(img)
    input_batch = input_tensor.unsqueeze(0)  # create a mini-batch as expected by the model.
    return input_batch


def get_object_mask(img, model, method):
    if torch.cuda.is_available():
        img = img.to('cuda:0')
        model = model.to('cuda:0')
    with torch.no_grad():
        output = model(img)
        output = torch.nn.functional.interpolate(
            output.unsqueeze(1),
            size=[IMG_WIDTH, IMG_HEIGHT],
            mode="bicubic",
            align_corners=False,
        ).squeeze()

    mask = output.cpu().numpy()
    # Isolate the objects nearest to the camera.
    mask = ((mask / np.max(mask)) > 0.6) * 255
    return np.array(mask, dtype=np.uint8, copy=True)


def live_background_blur(model):
    # Setting up the Camera. Change the index below to get the image from external cameras.
    vc = cv2.VideoCapture(0)
    if not vc.isOpened():
        raise RuntimeError('Unable to open the camera.')

    # Open a window to visualize the segmentation
    cv2.namedWindow("Input Image")
    cv2.namedWindow("Background Blur")

    # To get the processing rate in Fps.
    start_time = time.time()
    frame_count = 0

    # Loop until the user presses the ESC key.
    while vc.grab():
        _, frame = vc.read()
        frame = cv2.flip(frame, 1)
        frame_count += 1
        frame = cv2.resize(frame, dsize=(IMG_HEIGHT, IMG_WIDTH), interpolation=cv2.INTER_CUBIC)

        # Blur the image. You can control the intensity of blur by repeatedly calling it.
        blur_image = blur(blur(blur(blur(blur(frame)))))

        # Get Mask to un-blur.
        t1 = time.time()
        img = to_tensor(frame)
        object_mask = get_object_mask(img, model, "midas")
        print("Processing time in seconds per frame: ", time.time() - t1)

        # Apply the object mask to the actual image.
        image_with_mask = cv2.bitwise_and(frame, frame, mask=object_mask)

        # Apply the inverse mask to the blurred image.
        blur_image = cv2.bitwise_and(blur_image, blur_image, mask=255 - object_mask)

        # Combine both images.
        final_image = image_with_mask + blur_image

        # Visualize the images.
        cv2.imshow("Input Image", frame)
        cv2.imshow("Background Blur", final_image)

        key = cv2.waitKey(1)
        if key == 27:  # exit on ESC
            break

    end_time = time.time()
    print("Average frame rate: ", frame_count / (end_time - start_time))

    # Close the window.
    cv2.destroyWindow("Input Image")
    cv2.destroyWindow("Background Blur")


def main() -> None:
    model = torch.hub.load("intel-isl/MiDaS", "MiDaS", pretrained=True)
    model.eval()
    live_background_blur(model)


if _name_ == '_main_':
    main()
