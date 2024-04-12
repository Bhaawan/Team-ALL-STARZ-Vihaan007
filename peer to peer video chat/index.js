
let app_id="5c5c8b3d2a36439fb21be5159584ff39";

let token=null;
let uid=String(Math.floor(Math.random()*100000000))

let client,channel;

let qs=window.location.search;
let urlParam=new URLSearchParams(qs);
let roomId=urlParam.get("room");

if(!roomId)
{
    window.location="lobby.html";
}

let localStream;
let remoteStream;

const servers={
    iceServers:[
        {
            urls:['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
}

let handleUserJoined=async(memberID)=>{
    console.log("New user joined: ", memberID);
    createOffer(memberID);
}

let handleMessageFromPeer=async(message,memberID)=>{
    message=JSON.parse(message.text);
    if(message.type==="offer")
    {
        createAnswer(memberID,message.offer);
    }

    if(message.type==="answer")
    {
        addAnswer(message.answer);
    }

    if(message.type==="candidate")
    {
        if(peerConnection)
        {
            peerConnection.addIceCandidate(message.candidate);
        }
    }
}

let addAnswer=async(answer)=>{
    if(!peerConnection.currentRemoteDescription)
    {
        peerConnection.setRemoteDescription(answer);
    }
}

let handleUserLeft=(memberID)=>{
    document.querySelector("#vp2").style.display="none";
}

let leaveChannel=async()=>{
    await channel.leave();
    await client.logout();
}

window.addEventListener("beforeunload", leaveChannel);

let initialize=async()=>{

    client=await AgoraRTM.createInstance(app_id);
    await client.login({uid,token});

    channel=client.createChannel(roomId);
    await channel.join();

    channel.on("MemberJoined", handleUserJoined);
    channel.on("MemberLeft", handleUserLeft);

    client.on("MessageFromPeer", handleMessageFromPeer);

    localStream=await navigator.mediaDevices.getUserMedia({video:true, audio:true});
    document.querySelector("#vp1").srcObject=localStream;
    
}

let createPeerConnection=async(memberID)=>{
    peerConnection=new RTCPeerConnection(servers);
    remoteStream=new MediaStream();

    document.querySelector("#vp2").srcObject=remoteStream;
    document.querySelector("#vp2").style.display="block";

    if(!localStream)
    {
        localStream=await navigator.mediaDevices.getUserMedia({video:true, audio:true});
        document.querySelector("#vp1").srcObject=localStream;
    }

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track,localStream);
    });

    peerConnection.ontrack=(e)=>{
        e.streams[0].getTracks().forEach((track)=>{
            remoteStream.addTrack(track);
        })
    }

    peerConnection.onicecandidate=async (event)=>{
        if(event.candidate)
        {
            client.sendMessageToPeer({text:JSON.stringify({"type":"candidate", "candidate":event.candidate})}, memberID);
        }
    }
}

let createOffer=async(memberID)=>{

    await createPeerConnection(memberID);
    
    let offer=await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    

    client.sendMessageToPeer({text:JSON.stringify({"type":"offer", "offer":offer})}, memberID);
}

let createAnswer=async(memberID, offer)=>{
    await createPeerConnection(memberID);

    await peerConnection.setRemoteDescription(offer)

    let answer=await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    client.sendMessageToPeer({text:JSON.stringify({"type":"answer", "answer":answer})}, memberID);
}

let toggleCamera=async()=>{
    let videoTrack=localStream.getTracks().find((track)=>track.kind=="video")

    if(videoTrack.enabled)
    {
        videoTrack.enabled=false;
        document.querySelector("#camera_btn").style.backgroundColor="red";
    }
    else
    {
        videoTrack.enabled=true;
        document.querySelector("#camera_btn").style.backgroundColor="aqua";
    }
}

let toggleMic=async()=>{
    let audioTrack=localStream.getTracks().find((track)=>track.kind=="audio")

    if(audioTrack.enabled)
    {
        audioTrack.enabled=false;
        document.querySelector("#mic_btn").style.backgroundColor="red";
    }
    else
    {
        audioTrack.enabled=true;
        document.querySelector("#mic_btn").style.backgroundColor="aqua";
    }
}

initialize();
document.querySelector("#camera_btn").addEventListener("click", toggleCamera);
document.querySelector("#mic_btn").addEventListener("click", toggleMic);