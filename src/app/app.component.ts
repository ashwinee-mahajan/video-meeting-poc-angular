import {
  Component,
  OnInit,
  ViewChild,
  ViewChildren,
  ElementRef,
  QueryList,
} from '@angular/core';
import { Socket } from 'ngx-socket-io';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  title = 'webrtcsampleapp';

  room = !location.pathname.substring(1)
    ? 'home'
    : location.pathname.substring(1);
  remotePeers: Array<any> = new Array();

  @ViewChild('myVideo')
  myVideo: ElementRef<HTMLVideoElement>;

  /** @type {RTCConfiguration} */
  config = {
    iceServers: [
      {
        urls: ['stun:stun.l.google.com:19302'],
      },
    ],
  };

  /** @type {MediaStreamConstraints} */
  constraints = {
    audio: true,
    video: { facingMode: 'user' },
  };

  peerConnections = {};

  constructor(private socket: Socket) {}

  ngOnInit() {
    if (this.room && !!this.room) {
      this.socket.emit('join', this.room);
    }

    navigator.mediaDevices
      .getUserMedia(this.constraints)
      .then((stream) => {
        this.myVideo.nativeElement.srcObject = stream;
        this.myVideo.nativeElement.play();
        this.socket.emit('ready');
      })
      .catch(getUserMediaError);

    function getUserMediaError(error) {
      console.error(error);
    }

    this.socket.on('ready', async (id) => {
      const peerConnection = new RTCPeerConnection(this.config);
      this.peerConnections[id] = peerConnection;

      await navigator.mediaDevices
        .getUserMedia(this.constraints)
        .then((stream) => {
          stream
            .getTracks()
            .forEach((track) => peerConnection.addTrack(track, stream));
        });
      //peerConnection.createDataChannel(this.myVideo.nativeElement.srcObject.toString());

      peerConnection
        .createOffer()
        .then((sdp) => peerConnection.setLocalDescription(sdp))
        .then(() => {
          this.socket.emit('offer', {
            id,
            message: peerConnection.localDescription,
          });
        });

      peerConnection.ontrack = (event) =>
        handleRemoteStreamAdded(event.streams[0], id);
        
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emit('candidate', { id, message: event.candidate });
        }
      };
    });

    const handleRemoteHangup = (id) => {
      this.peerConnections[id] && this.peerConnections[id].close();
      delete this.peerConnections[id];
      this.remotePeers = this.remotePeers.filter(
        (remotePeer) => this.peerConnections[id] != remotePeer.peerId
      );
    };

    const handleRemoteStreamAdded = (stream, id) => {
      this.remotePeers.push({ peerId: id, stream: stream });
    };

    this.socket.on('offer', async (id, description) => {
      const peerConnection = new RTCPeerConnection(this.config);
      this.peerConnections[id] = peerConnection;
      await navigator.mediaDevices
        .getUserMedia(this.constraints)
        .then((stream) => {
          stream
            .getTracks()
            .forEach((track) => peerConnection.addTrack(track, stream));
        });

      // peerConnection.createDataChannel(this.myVideo.nativeElement.srcObject.toString());
      peerConnection
        .setRemoteDescription(description)
        .then(() => peerConnection.createAnswer())
        .then((sdp) => peerConnection.setLocalDescription(sdp))
        .then(() => {
          this.socket.emit('answer', {
            id,
            message: peerConnection.localDescription,
          });
        });
      peerConnection.ontrack = (event) =>
        handleRemoteStreamAdded(event.streams[0], id);
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
  }
}
