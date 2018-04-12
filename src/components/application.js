import "./app-header.js";
import "./landing-page.js";
import "./loading-page.js";
import "./file-upload-page.js";

const template = `

<div>

<app-header v-bind:title=title></app-header>

<landing-page v-if="!room_id && !peerIsReady" v-bind:title=title v-on:invite="invite"></landing-page>

<loading-page v-if="room_id && !peerIsReady"></loading-page>

<file-upload-page v-show="peerIsReady" v-bind:sentFiles="sentFiles" v-bind:receivedFiles="receivedFiles" v-on:onFileChange="onFileChange"></file-upload-page>

</div>
`;

Vue.component("application", {
  template: template,
  data: function() {
    return {
      peer: null,
      peerIsReady: null,
      webrtc: null,
      title: "File Friend",
      room_id: window.location.pathname.startsWith("/rooms/")
        ? window.location.pathname.replace("/rooms/", "")
        : null,
      sentFiles: [],
      receivedFiles: []
    };
  },

  created: function() {
    if (this.room_id) this.initWebRtc(false);
  },

  methods: {
    invite: function(inviteData) {
      this.room_id = inviteData.room_id;
      this.initWebRtc(true);
    },
    initWebRtc: function(createRoom) {
      fetch("***REMOVED***")
        .then(response => {
          return response.json();
        })
        .then(json => {
          this._initWebRtc(createRoom, json.iceServers || []);
        })
        .catch(e => {
          this._initWebRtc(createRoom, []);
        });
    },
    _initWebRtc: function(createRoom, iceServers) {
      console.log("created");
      this.webrtc = new SimpleWebRTC({
        // we don't do video
        localVideoEl: "localVideo",
        remoteVideosEl: "remoteVideos",
        // dont ask for camera access
        autoRequestMedia: true,
        // dont negotiate media
        receiveMedia: {
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        },
        peerConnectionConfig: {
          iceServers: iceServers
        }
      });
      console.log("ice servers", iceServers);
      if (iceServers.length)
        this.webrtc.on("stunservers", args => {
          // resets/overrides the config
          this.webrtc.config.peerConnectionConfig.iceServers = iceServers;
          console.log(this.webrtc.config.peerConnectionConfig.iceServers);
        });
      if (iceServers.length)
        this.webrtc.on("turnservers", args => {
          // appends to the config
          this.webrtc.config.peerConnectionConfig.iceServers = iceServers;
          console.log(this.webrtc.config.peerConnectionConfig.iceServers);
        });
      console.log(this.webrtc); // called when a peer is created
      this.webrtc.on("createdPeer", peer => {
        //arrow functions
        console.log("Created peer was called", peer);
        this.peer = this.initPeer(peer);
      });
      this.webrtc.on("readyToCall", () => {
        if (createRoom)
          this.webrtc.createRoom(this.room_id, (err, name) => {
            console.log("create room", err, name);
          }); //callback methods
        else
          this.webrtc.joinRoom(this.room_id, (err, name) => {
            console.log("join room", err, name);
          }); //callback methods
      });
      this.webrtc.on("videoAdded", (video, peer) => {
        video.controls = true;
      });
    },
    initPeer: function(peer) {
      peer.pc.on("iceConnectionStateChange", event => {
        const state = peer.pc.iceConnectionState;
        this.peerIsReady = state == "connected" || state == "completed";
        console.log("iceConnectionStateChange", state);
      });
      peer.on("fileTransfer", (metadata, receiver) => {
        console.log("fileTransfer", metadata, receiver);
        receiver.on("progress", bytesReceived => {
          console.log("progress", bytesReceived);
        });
        receiver.on("receivedFile", (file, metadata) => {
          console.log("receivedFile", file, metadata);
          this.receivedFiles.unshift({
            //Unshift puts latest file on top
            name: metadata.name,
            bytesReceived: metadata.size,
            file: URL.createObjectURL(file)
          });
          receiver.channel.close();
        });
      });
      return peer;
    },
    onFileChange: function(fileData) {
      const sender = this.peer.sendFile(fileData.file);
      this.sentFiles.unshift({
        name: fileData.file.name,
        bytesSent: 0,
        size: fileData.file.size,
        complete: false
      });
      sender.on("progress", bytesSent => {
        this.sentFiles[0].bytesSent = bytesSent;
        console.log(bytesSent);
      });
      sender.on("complete", () => {
        this.sentFiles[0].complete = true;
        console.log("complete");
      });
    }
  }
});
