import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { Socket } from 'ngx-socket-io';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'webrtcsampleapp';

  room = !location.pathname.substring(1)
    ? 'home'
    : location.pathname.substring(1);
  remotePeers: Array<any> = new Array();
  hostDetails = {
    peerId: null, 
    stream: null, 
    isHost: true,
    roomMemberName: null
  }

  @ViewChild('myVideo')
  myVideo: ElementRef<HTMLVideoElement>;

  @ViewChild('hostName')
  hostName: ElementRef<HTMLInputElement>; 

  @ViewChild('roomId')
  roomId: ElementRef<HTMLInputElement>; 

  @ViewChild('roomMemberName')
  roomMemberName: ElementRef<HTMLInputElement>;

  /** @type {RTCConfiguration} */
  config = {
    iceServers: [
      {
        urls: ['stun:stun.l.google.com:19302'],
      },
    ],
  };

  /** @type {MediaStreamConstraints} */
  hostConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true
    },
    video: {
      width: { ideal: 1024 },
      height: { ideal: 720 }
    }
  };

  roomMemberConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true
    },
    video: {
      width: { ideal: 320},
      height: { ideal: 240}
    }
  }
 
  peerConnections = {};
  myName= "";
  myId="";
  isHost = false;
  isJoined = false;
  roomName="";
  constructor(private socket: Socket) {}

  getReady = (isHost, id, roomMemberName) => {
    this.myName = roomMemberName;
    this.myId= id;
    this.isHost = isHost;
    if(isHost) {
      navigator.mediaDevices
      .getUserMedia(this.hostConstraints)
      .then((stream) => {
        handleRemoteStreamAdded(stream, id, isHost, roomMemberName)
        this.socket.emit("ready");
      })
      .catch(getUserMediaError);
    } else {
      navigator.mediaDevices
      .getUserMedia(this.roomMemberConstraints)
      .then((stream) => {
        handleRemoteStreamAdded(stream, id, isHost, roomMemberName)
        this.socket.emit("ready");
      })
      .catch(getUserMediaError);
    }    

    function getUserMediaError(error) {
      console.error(error);
    }

    this.socket.on("ready", async (id, isHost, roomMemberName) => {
      const peerConnection = new RTCPeerConnection(this.config);
      this.peerConnections[id] = peerConnection;

      let stream = this.remotePeers.filter( peer => peer.peerId === this.myId )[0].stream;
      const mediaStream = new MediaStream();
      await (<MediaStream>stream).getTracks().forEach(track => mediaStream.addTrack(track));
      await (<MediaStream>stream).getTracks().forEach(track => peerConnection.addTrack(track, stream));
      handleRemoteStreamAdded(mediaStream, id, isHost, roomMemberName);

      peerConnection
        .createOffer()
        .then((sdp) => peerConnection.setLocalDescription(sdp))
        .then(() => {
          this.socket.emit("offer", {
            id,
            message: peerConnection.localDescription,
          });
        });

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emit("candidate", { id, message: event.candidate });
        }
      };
    });

    const handleRemoteHangup = (id) => {
      this.remotePeers = this.remotePeers.filter(
        (remotePeer) => id !== remotePeer.peerId
      );
      this.peerConnections[id] && this.peerConnections[id].close();
      delete this.peerConnections[id];
    };

    const handleRemoteStreamAdded = (stream, id, isHost, roomMemberName) => {  
        if(isHost) {
          this.hostDetails = {
            peerId: id, 
            stream, 
            isHost,
            roomMemberName
          }
        } 
        this.remotePeers.push({ 
          peerId: id, 
          stream, 
          isHost,
          roomMemberName 
        });
    };

    this.socket.on("offer", async (id, description, isHost, roomMemberName) => {
      const peerConnection = new RTCPeerConnection(this.config);
      this.peerConnections[id] = peerConnection;
      let stream = this.remotePeers.filter( peer => peer.peerId == this.myId )[0].stream;;
      const mediaStream = new MediaStream();
      
      await (<MediaStream>stream).getTracks().forEach(track => mediaStream.addTrack(track));
      await (<MediaStream>stream).getTracks().forEach(track => peerConnection.addTrack(track, stream));

      handleRemoteStreamAdded(mediaStream, id, isHost, roomMemberName);
      peerConnection
        .setRemoteDescription(description)
        .then(() => peerConnection.createAnswer())
        .then((sdp) => peerConnection.setLocalDescription(sdp))
        .then(() => {
          this.socket.emit("answer", {
            id,
            message: peerConnection.localDescription,
          });
        });
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emit("candidate", { id, message: event.candidate });
        }
      };
    });

    this.socket.on("candidate", (id, candidate) => {
      this.peerConnections[id]
        .addIceCandidate(new RTCIceCandidate(candidate))
        .catch((e) => console.error(e));
    });

    this.socket.on("answer", (id, description) => {
      this.peerConnections[id].setRemoteDescription(description);
    });

    this.socket.on("full", (room) => {
      alert("Room " + room + " is full");
    });

    this.socket.on("bye", (id) => {
      handleRemoteHangup(id);
    });

    // this.socket.on("screensharing", async(id, hostId) => {
    //   const peerConnection = new RTCPeerConnection(this.config);
    //   this.peerConnections[id] = peerConnection;

    //   let stream = this.remotePeers.filter( peer => peer.peerId == this.myId )[0].stream;
    //   const mediaStream = new MediaStream();
    //   await (<MediaStream>stream).getTracks().forEach(track => mediaStream.addTrack(track));

    //   handleRemoteStreamAdded(mediaStream, id, isHost, roomMemberName);

    //   peerConnection
    //     .createOffer()
    //     .then((sdp) => peerConnection.setLocalDescription(sdp))
    //     .then(() => {
    //       this.socket.emit("offerScreensharing", {
    //         id,
    //         message: peerConnection.localDescription,
    //       });
    //     });
    // });
    
    // this.socket.on("offerScreensharing", async (id, description, isHost, roomMemberName) => {
    //   const peerConnection = new RTCPeerConnection(this.config);
    //   this.peerConnections[id] = peerConnection;
    //   let stream = this.remotePeers.filter( peer => peer.peerId == this.myId )[0].stream;;
    //   const mediaStream = new MediaStream();
      
    //   await (<MediaStream>stream).getTracks().forEach(track => mediaStream.addTrack(track));

    //   this.remotePeers.map( peer =>{ 
    //     if(peer.peerId == this.myId) {
    //       peer.stream = mediaStream
    //     }
    //   });
    //   peerConnection
    //     .setRemoteDescription(description)
    //     .then(() => peerConnection.createAnswer())
    //     .then((sdp) => peerConnection.setLocalDescription(sdp))
    //     .then(() => {
    //       this.socket.emit("answer", {
    //         id,
    //         message: peerConnection.localDescription,
    //       });
    //     });
    //   peerConnection.onicecandidate = (event) => {
    //     if (event.candidate) {
    //       this.socket.emit("candidate", { id, message: event.candidate });
    //     }
    //   };
    // });

    window.onunload = window.onbeforeunload = function () {
      this.socket.close();
    };
  }


  // startSharing = async() => {
  //   let captureStream = null;

  //   try {
  //     const peerConnection = new RTCPeerConnection(this.config);
  //     this.peerConnections[this.myId] = peerConnection;

  //     const mediaDevices = navigator.mediaDevices as any;
  //     captureStream = await mediaDevices.getDisplayMedia({audio: true, video: true}); 
      
  //     const mediaStream = new MediaStream();
      
  //     await (<MediaStream>captureStream).getTracks().forEach(track => mediaStream.addTrack(track));

  //     this.remotePeers.map( peer =>{ 
  //       if(peer.peerId == this.myId) {
  //         peer.stream = mediaStream
  //       }
  //     });
  //     this.socket.emit("screensharing", {id: this.myId, stream: captureStream});
  //   } catch(err) {
  //     console.error("Error: " + err);
  //   }
    
  // }

  // stopSharing = async() => {

  // }

  createRoom = () => {
    const hostName = this.hostName.nativeElement.value;
    const roomName = `${hostName}-${Math.random().toString(36).substring(7)}`; // Convert this to random value
    this.roomName = roomName;
  }

  joinRoom = () => {    
    const roomMemberName = this.roomMemberName.nativeElement.value;
    const roomId = this.roomId.nativeElement.value;
    const isHost = roomId.includes(roomMemberName);
    if(roomId && roomMemberName) {
      this.isJoined = true;
      this.socket.emit("join", {roomId, roomMemberName, isHost}, (id)=> {      
        this.getReady(isHost, id.id, roomMemberName)});
      }
    }
}
