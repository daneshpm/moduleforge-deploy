import { FirestoreSignaling } from './signaling';
import { WebRTCSignal, IceCandidatePayload } from '../../types/meeting';

export interface PeerStreamMap {
  [peerId: string]: MediaStream;
}

export type RemoteStreamCallback = (peerId: string, stream: MediaStream) => void;
export type PeerDisconnectedCallback = (peerId: string) => void;
export type ConnectionStateCallback = (peerId: string, state: RTCPeerConnectionState) => void;

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

export class WebRTCMeshManager {
  private currentUserId: string;
  private signaling: FirestoreSignaling;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private makingOffer: Map<string, boolean> = new Map();
  private ignoreOffer: Map<string, boolean> = new Map();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private iceServers: RTCIceServer[] = DEFAULT_ICE_SERVERS;

  private onRemoteStreamCallbacks: Set<RemoteStreamCallback> = new Set();
  private onPeerDisconnectedCallbacks: Set<PeerDisconnectedCallback> = new Set();
  private onConnectionStateCallbacks: Set<ConnectionStateCallback> = new Set();

  constructor(currentUserId: string, signaling: FirestoreSignaling, customIceServers?: RTCIceServer[]) {
    this.currentUserId = currentUserId;
    this.signaling = signaling;
    if (customIceServers && customIceServers.length > 0) {
      this.iceServers = [...customIceServers, ...DEFAULT_ICE_SERVERS];
    }
  }

  /**
   * Set local camera and microphone stream to send to peers
   */
  public setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;

    // Update existing peer connections with new tracks
    this.peerConnections.forEach((pc) => {
      this.syncTracksWithPeer(pc);
    });
  }

  /**
   * Set local screen share stream
   */
  public setScreenStream(stream: MediaStream | null) {
    this.screenStream = stream;

    this.peerConnections.forEach((pc) => {
      this.syncTracksWithPeer(pc);
    });
  }

  /**
   * Synchronize audio/video/screen tracks to an RTCPeerConnection
   */
  private syncTracksWithPeer(pc: RTCPeerConnection) {
    const senders = pc.getSenders();

    // 1. Local camera/mic tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        const existingSender = senders.find((s) => s.track?.kind === track.kind);
        if (existingSender) {
          existingSender.replaceTrack(track).catch(() => {});
        } else {
          try {
            pc.addTrack(track, this.localStream!);
          } catch (_) {}
        }
      });
    }

    // 2. Screen track
    if (this.screenStream) {
      const screenTrack = this.screenStream.getVideoTracks()[0];
      if (screenTrack) {
        const existingScreenSender = senders.find(
          (s) => s.track && s.track.kind === 'video' && s.track.label.includes('screen')
        );
        if (existingScreenSender) {
          existingScreenSender.replaceTrack(screenTrack).catch(() => {});
        } else {
          try {
            pc.addTrack(screenTrack, this.screenStream!);
          } catch (_) {}
        }
      }
    }
  }

  /**
   * Connect to a remote peer (or initiate polite negotiation)
   */
  public async connectToPeer(remoteUserId: string, initiateOffer: boolean = false) {
    if (remoteUserId === this.currentUserId) return;
    if (this.peerConnections.has(remoteUserId)) return;

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
    });

    this.peerConnections.set(remoteUserId, pc);
    this.makingOffer.set(remoteUserId, false);
    this.ignoreOffer.set(remoteUserId, false);

    // Create container remote media stream
    const remoteStream = new MediaStream();
    this.remoteStreams.set(remoteUserId, remoteStream);

    // Attach local tracks or transceivers for bi-directional SDP negotiation
    if (this.localStream && this.localStream.getTracks().length > 0) {
      this.localStream.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, this.localStream!);
        } catch (_) {}
      });
    } else {
      try {
        pc.addTransceiver('audio', { direction: 'recvonly' });
        pc.addTransceiver('video', { direction: 'recvonly' });
      } catch (_) {}
    }

    if (this.screenStream) {
      const screenTrack = this.screenStream.getVideoTracks()[0];
      if (screenTrack) {
        try {
          pc.addTrack(screenTrack, this.screenStream!);
        } catch (_) {}
      }
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendIceCandidate(remoteUserId, event.candidate.toJSON());
      }
    };

    // Handle remote tracks
    pc.ontrack = (event) => {
      if (event.track) {
        remoteStream.addTrack(event.track);
        this.notifyRemoteStream(remoteUserId, remoteStream);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      this.notifyConnectionState(remoteUserId, pc.connectionState);

      if (
        pc.connectionState === 'disconnected' ||
        pc.connectionState === 'failed' ||
        pc.connectionState === 'closed'
      ) {
        this.notifyPeerDisconnected(remoteUserId);
      }
    };

    // Polite peer negotiation logic: The polite peer is the one with the higher user ID string
    const isPolite = this.currentUserId > remoteUserId;

    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer.set(remoteUserId, true);
        await pc.setLocalDescription();
        if (pc.localDescription) {
          await this.signaling.sendSignal(remoteUserId, 'offer', JSON.stringify(pc.localDescription));
        }
      } catch (err) {
        console.warn(`Negotiation error with ${remoteUserId}:`, err);
      } finally {
        this.makingOffer.set(remoteUserId, false);
      }
    };

    // If caller is initiating initial offer explicitly
    if (initiateOffer && !isPolite) {
      try {
        this.makingOffer.set(remoteUserId, true);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        await this.signaling.sendSignal(remoteUserId, 'offer', JSON.stringify(pc.localDescription));
      } catch (err) {
        console.warn(`Initial offer error for ${remoteUserId}:`, err);
      } finally {
        this.makingOffer.set(remoteUserId, false);
      }
    }
  }

  /**
   * Handle incoming SDP signal (offer or answer) from signaling layer
   */
  public async handleSignal(signal: WebRTCSignal) {
    const { senderId, type, sdp } = signal;
    if (senderId === this.currentUserId) return;

    let pc = this.peerConnections.get(senderId);
    if (!pc) {
      await this.connectToPeer(senderId, false);
      pc = this.peerConnections.get(senderId);
    }
    if (!pc) return;

    const description = JSON.parse(sdp) as RTCSessionDescriptionInit;
    const isPolite = this.currentUserId > senderId;
    const isMakingOffer = this.makingOffer.get(senderId) || false;

    // Detect offer collision (Glare)
    const offerCollision =
      type === 'offer' &&
      (isMakingOffer || pc.signalingState !== 'stable');

    this.ignoreOffer.set(senderId, !isPolite && offerCollision);
    if (this.ignoreOffer.get(senderId)) {
      return;
    }

    try {
      await pc.setRemoteDescription(description);

      if (type === 'offer') {
        await pc.setLocalDescription();
        if (pc.localDescription) {
          await this.signaling.sendSignal(senderId, 'answer', JSON.stringify(pc.localDescription));
        }
      }

      // Process any queued ICE candidates for this peer
      const queued = this.pendingCandidates.get(senderId) || [];
      for (const candidate of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (_) {}
      }
      this.pendingCandidates.delete(senderId);
    } catch (err) {
      console.warn(`Error setting remote description from ${senderId}:`, err);
    }
  }

  /**
   * Handle incoming ICE candidate from signaling layer
   */
  public async handleIceCandidate(payload: IceCandidatePayload) {
    const { senderId, candidate } = payload;
    if (senderId === this.currentUserId) return;

    const pc = this.peerConnections.get(senderId);
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn(`Failed to add ICE candidate from ${senderId}:`, err);
      }
    } else {
      // Queue candidate until remote description is ready
      const queued = this.pendingCandidates.get(senderId) || [];
      queued.push(candidate);
      this.pendingCandidates.set(senderId, queued);
    }
  }

  /**
   * Remove a disconnected peer connection
   */
  public removePeer(peerId: string) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      try { pc.close(); } catch (_) {}
      this.peerConnections.delete(peerId);
    }

    const stream = this.remoteStreams.get(peerId);
    if (stream) {
      stream.getTracks().forEach((t) => {
        try { t.stop(); } catch (_) {}
      });
      this.remoteStreams.delete(peerId);
    }

    this.pendingCandidates.delete(peerId);
    this.makingOffer.delete(peerId);
    this.ignoreOffer.delete(peerId);
    this.notifyPeerDisconnected(peerId);
  }

  /**
   * Event listener subscriptions
   */
  public onRemoteStream(cb: RemoteStreamCallback): () => void {
    this.onRemoteStreamCallbacks.add(cb);
    return () => this.onRemoteStreamCallbacks.delete(cb);
  }

  public onPeerDisconnected(cb: PeerDisconnectedCallback): () => void {
    this.onPeerDisconnectedCallbacks.add(cb);
    return () => this.onPeerDisconnectedCallbacks.delete(cb);
  }

  public onConnectionState(cb: ConnectionStateCallback): () => void {
    this.onConnectionStateCallbacks.add(cb);
    return () => this.onConnectionStateCallbacks.delete(cb);
  }

  private notifyRemoteStream(peerId: string, stream: MediaStream) {
    for (const cb of this.onRemoteStreamCallbacks) {
      cb(peerId, stream);
    }
  }

  private notifyPeerDisconnected(peerId: string) {
    for (const cb of this.onPeerDisconnectedCallbacks) {
      cb(peerId);
    }
  }

  private notifyConnectionState(peerId: string, state: RTCPeerConnectionState) {
    for (const cb of this.onConnectionStateCallbacks) {
      cb(peerId, state);
    }
  }

  /**
   * Close all peer connections and cleanup
   */
  public cleanup() {
    this.peerConnections.forEach((pc) => {
      try { pc.close(); } catch (_) {}
    });
    this.peerConnections.clear();

    this.remoteStreams.forEach((stream) => {
      stream.getTracks().forEach((t) => {
        try { t.stop(); } catch (_) {}
      });
    });
    this.remoteStreams.clear();

    this.pendingCandidates.clear();
    this.makingOffer.clear();
    this.ignoreOffer.clear();
    this.onRemoteStreamCallbacks.clear();
    this.onPeerDisconnectedCallbacks.clear();
    this.onConnectionStateCallbacks.clear();
  }

  public getRemoteStream(peerId: string): MediaStream | undefined {
    return this.remoteStreams.get(peerId);
  }

  public getAllRemoteStreams(): PeerStreamMap {
    const result: PeerStreamMap = {};
    this.remoteStreams.forEach((stream, peerId) => {
      result[peerId] = stream;
    });
    return result;
  }
}
