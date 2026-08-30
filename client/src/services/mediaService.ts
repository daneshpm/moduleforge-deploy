import {
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  createLocalAudioTrack,
  createLocalVideoTrack,
  LocalTrackPublication,
  RemoteParticipant,
  RemoteTrackPublication,
  LocalAudioTrack,
  LocalVideoTrack,
  ConnectionState,
} from 'livekit-client';

export interface MediaDeviceStatus {
  hasAudio: boolean;
  hasVideo: boolean;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  activeSpeakerIds: string[];
  connectionQuality: 'good' | 'fair' | 'poor' | 'unknown';
  error: string | null;
}

export type MediaEventCallback = (status: Partial<MediaDeviceStatus>) => void;

class MediaService {
  private currentRoom: Room | null = null;
  private localAudioTrack: LocalAudioTrack | null = null;
  private localVideoTrack: LocalVideoTrack | null = null;
  private localScreenTrack: LocalVideoTrack | null = null;
  private localMediaStream: MediaStream | null = null;
  private eventListeners: Set<MediaEventCallback> = new Set();

  private status: MediaDeviceStatus = {
    hasAudio: true,
    hasVideo: true,
    isAudioMuted: false,
    isVideoMuted: false,
    isScreenSharing: false,
    activeSpeakerIds: [],
    connectionQuality: 'good',
    error: null,
  };

  public subscribe(cb: MediaEventCallback): () => void {
    this.eventListeners.add(cb);
    cb(this.status);
    return () => this.eventListeners.delete(cb);
  }

  private notify(update: Partial<MediaDeviceStatus>) {
    this.status = { ...this.status, ...update };
    for (const listener of this.eventListeners) {
      listener(this.status);
    }
  }

  /**
   * Request local camera and microphone permissions safely with multi-tiered fallback
   */
  public async getLocalMedia(options: { video?: boolean; audio?: boolean } = { video: true, audio: true }): Promise<MediaStream | null> {
    this.notify({ error: null });

    // Check if browser mediaDevices API is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.notify({ error: 'Media devices are not supported on this browser or insecure HTTP connection.' });
      return null;
    }

    // Tier 1: Try combined HD audio & video
    if (options.video !== false && options.audio !== false) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
        });
        this.localMediaStream = stream;
        this.notify({
          hasAudio: stream.getAudioTracks().length > 0,
          hasVideo: stream.getVideoTracks().length > 0,
          isAudioMuted: !stream.getAudioTracks().some((t) => t.enabled),
          isVideoMuted: !stream.getVideoTracks().some((t) => t.enabled),
        });
        return stream;
      } catch (err: any) {
        console.warn('Tier 1 HD getUserMedia failed, trying Tier 2 standard...', err);
      }
    }

    // Tier 2: Try standard combined audio & video with loose constraints
    if (options.video !== false && options.audio !== false) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        this.localMediaStream = stream;
        this.notify({
          hasAudio: stream.getAudioTracks().length > 0,
          hasVideo: stream.getVideoTracks().length > 0,
          isAudioMuted: !stream.getAudioTracks().some((t) => t.enabled),
          isVideoMuted: !stream.getVideoTracks().some((t) => t.enabled),
        });
        return stream;
      } catch (err: any) {
        console.warn('Tier 2 standard getUserMedia failed, attempting split audio/video fallback...', err);
      }
    }

    // Tier 3: Attempt split acquisition (audio-only or video-only)
    let audioTrack: MediaStreamTrack | null = null;
    let videoTrack: MediaStreamTrack | null = null;

    if (options.audio !== false) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioTrack = audioStream.getAudioTracks()[0] || null;
      } catch (e: any) {
        console.warn('Microphone stream acquisition unavailable:', e.message);
      }
    }

    if (options.video !== false) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoTrack = videoStream.getVideoTracks()[0] || null;
      } catch (e: any) {
        console.warn('Camera stream acquisition unavailable:', e.message);
      }
    }

    if (audioTrack || videoTrack) {
      const combined = new MediaStream();
      if (audioTrack) combined.addTrack(audioTrack);
      if (videoTrack) combined.addTrack(videoTrack);

      this.localMediaStream = combined;
      this.notify({
        hasAudio: Boolean(audioTrack),
        hasVideo: Boolean(videoTrack),
        isAudioMuted: audioTrack ? !audioTrack.enabled : true,
        isVideoMuted: videoTrack ? !videoTrack.enabled : true,
      });
      return combined;
    }

    this.notify({
      error: 'Could not access camera or microphone. Please ensure permissions are granted in your browser settings.',
    });
    return null;
  }

  /**
   * Connect to LiveKit SFU room with token
   */
  public async joinLiveKitRoom(params: {
    serverUrl: string;
    token: string;
    videoEnabled?: boolean;
    audioEnabled?: boolean;
    onTrackSubscribed?: (track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => void;
    onTrackUnsubscribed?: (track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => void;
    onParticipantConnected?: (participant: RemoteParticipant) => void;
    onParticipantDisconnected?: (participant: RemoteParticipant) => void;
  }): Promise<Room | null> {
    try {
      if (this.currentRoom) {
        try { this.currentRoom.disconnect(); } catch (_) {}
        this.currentRoom = null;
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
      });

      this.currentRoom = room;

      // Event handlers
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: any[]) => {
        const ids = (speakers || []).map((s: any) => s?.identity).filter(Boolean);
        this.notify({ activeSpeakerIds: ids });
      });

      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        if (state === ConnectionState.Connected) {
          this.notify({ connectionQuality: 'good', error: null });
        } else if (state === ConnectionState.Reconnecting) {
          this.notify({ connectionQuality: 'poor', error: 'Reconnecting to meeting...' });
        } else if (state === ConnectionState.Disconnected) {
          this.notify({ connectionQuality: 'unknown' });
        }
      });

      room.on(RoomEvent.TrackSubscribed, (track: any, pub: any, participant: any) => {
        params.onTrackSubscribed?.(track, pub, participant);
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: any, pub: any, participant: any) => {
        params.onTrackUnsubscribed?.(track, pub, participant);
      });

      room.on(RoomEvent.ParticipantConnected, (participant: any) => {
        params.onParticipantConnected?.(participant);
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant: any) => {
        params.onParticipantDisconnected?.(participant);
      });

      // Connect to SFU server
      await room.connect(params.serverUrl, params.token);

      // Publish initial tracks if enabled
      if (params.audioEnabled !== false) {
        try {
          this.localAudioTrack = await createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: true,
          });
          await room.localParticipant.publishTrack(this.localAudioTrack);
          this.notify({ isAudioMuted: false });
        } catch (e) {
          console.warn('Could not publish audio track:', e);
        }
      }

      if (params.videoEnabled) {
        try {
          this.localVideoTrack = await createLocalVideoTrack({
            resolution: VideoPresets.h720.resolution,
          });
          await room.localParticipant.publishTrack(this.localVideoTrack);
          this.notify({ isVideoMuted: false });
        } catch (e) {
          console.warn('Could not publish video track:', e);
        }
      }

      return room;
    } catch (err: any) {
      console.warn('SFU connection unavailable (operating in standalone WebRTC mode):', err.message);
      // Keep local media stream active for standalone preview/WebRTC
      return null;
    }
  }

  /**
   * Toggle local microphone
   */
  public async setMicrophoneEnabled(enabled: boolean): Promise<boolean> {
    if (this.currentRoom) {
      await this.currentRoom.localParticipant.setMicrophoneEnabled(enabled);
      this.notify({ isAudioMuted: !enabled });
      return enabled;
    }

    if (this.localMediaStream) {
      for (const track of this.localMediaStream.getAudioTracks()) {
        track.enabled = enabled;
      }
      this.notify({ isAudioMuted: !enabled });
      return enabled;
    }

    return enabled;
  }

  /**
   * Toggle local camera
   */
  public async setCameraEnabled(enabled: boolean): Promise<boolean> {
    if (this.currentRoom) {
      await this.currentRoom.localParticipant.setCameraEnabled(enabled);
      this.notify({ isVideoMuted: !enabled });
      return enabled;
    }

    if (this.localMediaStream) {
      for (const track of this.localMediaStream.getVideoTracks()) {
        track.enabled = enabled;
      }
      this.notify({ isVideoMuted: !enabled });
      return enabled;
    }

    return enabled;
  }

  /**
   * Start or stop screen sharing via getDisplayMedia
   */
  public async setScreenShareEnabled(enabled: boolean): Promise<boolean> {
    try {
      if (this.currentRoom) {
        if (enabled) {
          await this.currentRoom.localParticipant.setScreenShareEnabled(true, {
            audio: true,
            selfBrowserSurface: 'include',
            surfaceSwitching: 'include',
          });
          this.notify({ isScreenSharing: true });
          return true;
        } else {
          await this.currentRoom.localParticipant.setScreenShareEnabled(false);
          this.notify({ isScreenSharing: false });
          return false;
        }
      }

      // Standalone browser getDisplayMedia fallback
      if (enabled) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { max: 30 } },
          audio: false,
        });

        // Listen for when the user clicks browser "Stop Sharing" floating button
        const videoTrack = screenStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            this.notify({ isScreenSharing: false });
          };
        }

        this.notify({ isScreenSharing: true });
        return true;
      } else {
        this.notify({ isScreenSharing: false });
        return false;
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        // User cancelled screen picker — not an error
        this.notify({ isScreenSharing: false });
        return false;
      }
      console.warn('Screen share error:', err);
      this.notify({ error: 'Could not start screen sharing.', isScreenSharing: false });
      return false;
    }
  }

  /**
   * Clean up all local media streams, tracks, and room connections
   */
  public cleanup() {
    if (this.currentRoom) {
      try {
        this.currentRoom.disconnect();
      } catch (_) {}
      this.currentRoom = null;
    }

    if (this.localAudioTrack) {
      try { this.localAudioTrack.stop(); } catch (_) {}
      this.localAudioTrack = null;
    }

    if (this.localVideoTrack) {
      try { this.localVideoTrack.stop(); } catch (_) {}
      this.localVideoTrack = null;
    }

    if (this.localScreenTrack) {
      try { this.localScreenTrack.stop(); } catch (_) {}
      this.localScreenTrack = null;
    }

    if (this.localMediaStream) {
      for (const track of this.localMediaStream.getTracks()) {
        try { track.stop(); } catch (_) {}
      }
      this.localMediaStream = null;
    }

    this.notify({
      isAudioMuted: false,
      isVideoMuted: false,
      isScreenSharing: false,
      activeSpeakerIds: [],
      error: null,
    });
  }

  public getRoom(): Room | null {
    return this.currentRoom;
  }

  public getLocalStream(): MediaStream | null {
    return this.localMediaStream;
  }
}

export const mediaService = new MediaService();
