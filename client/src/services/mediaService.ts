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
   * Request local camera and microphone permissions safely with rich error descriptions
   */
  public async getLocalMedia(options: { video?: boolean; audio?: boolean } = { video: true, audio: true }): Promise<MediaStream | null> {
    try {
      this.notify({ error: null });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: options.audio ? { echoCancellation: true, noiseSuppression: true } : false,
        video: options.video ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { max: 30 } } : false,
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
      console.warn('getUserMedia error:', err);
      let errorMsg = 'Could not access camera or microphone.';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Permission denied: Please allow camera and microphone access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No microphone or camera device was found on this computer.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Your camera or microphone is currently being used by another application.';
      } else if (err.name === 'OverconstrainedError') {
        errorMsg = 'Camera resolution or settings are not supported by your hardware.';
      }

      this.notify({ error: errorMsg });
      return null;
    }
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
      this.cleanup();

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
      });

      this.currentRoom = room;

      // Event handlers
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const ids = speakers.map((s) => s.identity);
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

      room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
        params.onTrackSubscribed?.(track, pub, participant);
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, pub, participant) => {
        params.onTrackUnsubscribed?.(track, pub, participant);
      });

      room.on(RoomEvent.ParticipantConnected, (participant) => {
        params.onParticipantConnected?.(participant);
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
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
          await room.localParticipant.publishTrack(this.localAudioAudioTrack(this.localAudioTrack));
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
      console.error('Failed to join LiveKit room:', err);
      this.notify({ error: `Connection failed: ${err.message || 'Could not connect to room'}` });
      return null;
    }
  }

  private localAudioAudioTrack(track: LocalAudioTrack) {
    return track;
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
