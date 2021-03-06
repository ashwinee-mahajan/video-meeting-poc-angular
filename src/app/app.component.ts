import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import * as CryptoJS from 'crypto-js';

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
    roomMemberName: null,
  };

  @ViewChild('myVideo')
  myVideo: ElementRef<HTMLVideoElement>;

  @ViewChild('recordedVideo')
  recordedVideo: ElementRef<HTMLVideoElement>;

  @ViewChild('uploadVideo')
  uploadVideo: ElementRef<HTMLVideoElement>;

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
        urls: [
          'stun:stun.l.google.com:19302',
          'turn:13.250.13.83:3478?transport=udp',
        ],
        username: 'YzYNCouZM1mhqhmseWk6',
        credential: 'YzYNCouZM1mhqhmseWk6',
      },
    ],
  };

  /** @type {MediaStreamConstraints} */
  hostConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
    video: {
      width: { ideal: 1024 },
      height: { ideal: 720 },
    },
  };

  roomMemberConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
    video: {
      width: { ideal: 320 },
      height: { ideal: 240 },
    },
  };

  peerConnections = {};
  myName = '';
  myId = '';
  isHost = false;
  isJoined = false;
  roomName = '';
  mediaRecorder;
  recordedBlobs: any[];
  constructor(private socket: Socket) {}

  getReady = (isHost, id, roomMemberName) => {
    this.myName = roomMemberName;
    this.myId = id;
    this.isHost = isHost;
    if (isHost) {
      navigator.mediaDevices
        .getUserMedia(this.hostConstraints)
        .then((stream) => {
          handleRemoteStreamAdded(stream, id, isHost, roomMemberName);
          this.socket.emit('ready');
        })
        .catch(getUserMediaError);
    } else {
      navigator.mediaDevices
        .getUserMedia(this.roomMemberConstraints)
        .then((stream) => {
          handleRemoteStreamAdded(stream, id, isHost, roomMemberName);
          this.socket.emit('ready');
        })
        .catch(getUserMediaError);
    }

    function getUserMediaError(error) {
      console.error(error);
    }

    this.socket.on('ready', async (id, isHost, roomMemberName) => {
      const peerConnection = new RTCPeerConnection(this.config);
      this.peerConnections[id] = peerConnection;

      let stream = this.remotePeers.filter(
        (peer) => peer.peerId === this.myId
      )[0].stream;
      // const mediaStream = new MediaStream();
      // await (<MediaStream>stream).getTracks().forEach(track => mediaStream.addTrack(track));
      (<MediaStream>stream)
        .getTracks()
        .forEach((track) => peerConnection.addTrack(track, stream));

      peerConnection.ontrack = (event) => {
        if (!isHost) {
          event.streams[0].getAudioTracks()[0].enabled = false;
        }
        handleRemoteStreamAdded(event.streams[0], id, isHost, roomMemberName);
      };

      peerConnection
        .createOffer({ offerToReceiveVideo: true })
        .then((sdp) => peerConnection.setLocalDescription(sdp))
        .then(() => {
          this.socket.emit('offer', {
            id,
            message: peerConnection.localDescription,
          });
        });

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emit('candidate', { id, message: event.candidate });
        }
      };
    });

    const handleRemoteHangup = (id) => {
      const isLeftUserWasHost = this.remotePeers.find(
        (remotePeer) => id === remotePeer.peerId && remotePeer.isHost
      );
      this.remotePeers = this.remotePeers.filter(
        (remotePeer) => id !== remotePeer.peerId
      );
      this.peerConnections[id] && this.peerConnections[id].close();
      delete this.peerConnections[id];

      this.remotePeers = this.remotePeers.filter(
        (remotePeer) => id !== remotePeer.peerId
      );
      if (isLeftUserWasHost) {
        this.hostDetails = {
          peerId: null,
          stream: null,
          isHost: true,
          roomMemberName: null,
        };
      }
    };

    const handleRemoteStreamAdded = (stream, id, isHost, roomMemberName) => {
      if (isHost) {
        this.hostDetails = {
          peerId: id,
          stream,
          isHost,
          roomMemberName,
        };
      }
      const matchedIndex = this.remotePeers.findIndex(
        (peer) => peer.peerId === id
      );
      matchedIndex === -1 &&
        this.remotePeers.push({
          peerId: id,
          stream,
          isHost,
          roomMemberName,
        });
    };

    this.socket.on('offer', async (id, description, isHost, roomMemberName) => {
      const peerConnection = new RTCPeerConnection(this.config);
      this.peerConnections[id] = peerConnection;
      let stream = this.remotePeers.filter(
        (peer) => peer.peerId == this.myId
      )[0].stream;

      (<MediaStream>stream)
        .getTracks()
        .forEach((track) => peerConnection.addTrack(track, stream));

      peerConnection.ontrack = (event) => {
        if (!isHost) {
          event.streams[0].getAudioTracks()[0].enabled = false;
        }
        handleRemoteStreamAdded(event.streams[0], id, isHost, roomMemberName);
      };

      peerConnection
        .setRemoteDescription(description)
        .then(() => peerConnection.createAnswer({ offerToReceiveVideo: true }))
        .then((sdp) => peerConnection.setLocalDescription(sdp))
        .then(() => {
          this.socket.emit('answer', {
            id,
            message: peerConnection.localDescription,
          });
        });
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emit('candidate', { id, message: event.candidate });
        }
      };
    });

    this.socket.on('candidate', (id, candidate) => {
      this.peerConnections[id]
        .addIceCandidate(new RTCIceCandidate(candidate))
        .catch((e) => console.error(e));
    });

    this.socket.on('answer', (id, description) => {
      this.peerConnections[id].setRemoteDescription(description);
    });

    this.socket.on('full', (room) => {
      alert('Room ' + room + ' is full');
    });

    this.socket.on('bye', (id) => {
      handleRemoteHangup(id);
    });

    window.onunload = window.onbeforeunload = function () {
      this.socket.close();
    };
  };

  startSharing = async () => {
    try {
      const mediaDevices = navigator.mediaDevices as any;
      const screenCaptureStream = await mediaDevices.getDisplayMedia();

      this.hostDetails.stream = screenCaptureStream;
      Object.keys(this.peerConnections).map((peerconnection) => {
        this.peerConnections[peerconnection].getSenders().map((sender) => {
          if (sender.track.kind === 'video') {
            sender.replaceTrack(screenCaptureStream.getTracks()[0]);
          }
        });
      });
    } catch (err) {
      console.error('Error: ' + err);
    }
  };

  stopSharing = async () => {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia(
        this.roomMemberConstraints
      );
      this.hostDetails.stream = videoStream;
      Object.keys(this.peerConnections).map((peerconnection) => {
        this.peerConnections[peerconnection].getSenders().map((sender) => {
          if (sender.track.kind === 'video') {
            sender.replaceTrack(videoStream.getVideoTracks()[0]);
          }
        });
      });
    } catch (error) {
      console.error('Error: ' + error);
    }
  };

  createRoom = () => {
    const hostName = this.hostName.nativeElement.value;
    const roomName = `${hostName}-${Math.random().toString(36).substring(7)}`; // Convert this to random value
    this.roomName = roomName;
  };

  joinRoom = () => {
    const roomMemberName = this.roomMemberName.nativeElement.value;
    const roomId = this.roomId.nativeElement.value;
    const isHost = roomId.includes(roomMemberName);
    if (roomId && roomMemberName) {
      this.isJoined = true;
      this.socket.emit('join', { roomId, roomMemberName, isHost }, (id) => {
        this.getReady(isHost, id.id, roomMemberName);
      });
    }

    this.socket.on('full', (room) => {
      alert('Room ' + room + ' is full');
    });
  };

  toggleMic = (peerId) => {
    console.log(peerId);
    console.log(this.peerConnections);

    this.peerConnections[peerId]
      .getRemoteStreams()[0]
      .getTracks()
      .map((track) => {
        if (track.kind === 'audio') {
          track.enabled = !track.enabled;
        }
      });
  };

  startRecording = () => {
    this.recordedBlobs = [];
    let options = { mimeType: 'video/webm;codecs=vp9,opus' };
    // if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    //   console.error(`${options.mimeType} is not supported`);
    //   options = { mimeType: 'video/webm;codecs=vp8,opus' };
    //   if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    //     console.error(`${options.mimeType} is not supported`);
    //     options = { mimeType: 'video/webm' };
    //     if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    //       console.error(`${options.mimeType} is not supported`);
    //       options = { mimeType: '' };
    //     }
    //   }
    // }

    try {
      this.mediaRecorder = new MediaRecorder(this.hostDetails.stream, options);
    } catch (e) {
      console.error(`Exception while creating MediaRecorder:  ${JSON.stringify(e)}`);
      return;
    }

    console.log(
      'Created MediaRecorder',
      this.mediaRecorder,
      'with options',
      options
    );
    this.mediaRecorder.onstop = (event) => {
      console.log('Recorder stopped: ', event);
      console.log('Recorded Blobs: ', this.recordedBlobs);
      const superBuffer = new Blob(this.recordedBlobs, {type: 'video/webm'});
      this.recordedVideo.nativeElement.src = window.URL.createObjectURL(superBuffer);
      this.recordedVideo.nativeElement.play();
    };
    this.mediaRecorder.ondataavailable = this.handleDataAvailable;
    this.mediaRecorder.start();
    console.log('MediaRecorder started', this.mediaRecorder);
  };

  handleDataAvailable = (event) => {
    console.log('media record ondataavailable', event);
    if (event.data && event.data.size > 0) {
      this.recordedBlobs.push(event.data);
    }
  }

  stopRecording = () => {
    this.mediaRecorder.stop();
  };

  onVideoDownload = () => {    
    const file = new File(this.recordedBlobs, 'test.webm', {
      type: 'video/webm',
      lastModified: Date.now()
    });  

    var reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = function(e){
      var encrypted = CryptoJS.AES.encrypt(e.target.result as string, "123test");
      const a = document.createElement('a');
      a.href = 'data:application/octet-stream,' + encrypted;
      a.download = file.name + '.encrypted';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
      }, 100);
    };
  }

  onVideoUpload = (e) => {  

    const file = e.target.files[0];

    var reader = new FileReader();
    reader.readAsText(file);
    var decrypted;
    reader.onload = (e) => {
      decrypted = CryptoJS.AES.decrypt(e.target.result as string, "123test")
                  .toString(CryptoJS.enc.Latin1);

      if(!/^data:/.test(decrypted)){
        alert("Invalid pass phrase or file! Please try again.");
        return false;        
      }
      this.uploadVideo.nativeElement.src = decrypted;
    };
        
    
  }
}
