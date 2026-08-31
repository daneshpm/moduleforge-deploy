import { MediaDeviceItem } from '../../types/meeting';

export interface DeviceAvailability {
  audioInputs: MediaDeviceItem[];
  audioOutputs: MediaDeviceItem[];
  videoInputs: MediaDeviceItem[];
}

export type SpeakingCallback = (isSpeaking: boolean, volume: number) => void;

class MediaDeviceManager {
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphoneSource: MediaStreamAudioSourceNode | null = null;
  private speakingInterval: any = null;
  private speakingListeners: Set<SpeakingCallback> = new Set();

  /**
   * Enumerate all connected audio/video input and output devices
   */
  public async getAvailableDevices(): Promise<DeviceAvailability> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return { audioInputs: [], audioOutputs: [], videoInputs: [] };
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs: MediaDeviceItem[] = [];
      const audioOutputs: MediaDeviceItem[] = [];
      const videoInputs: MediaDeviceItem[] = [];

      devices.forEach((device, index) => {
        const item: MediaDeviceItem = {
          deviceId: device.deviceId,
          label: device.label || `${device.kind === 'videoinput' ? 'Camera' : 'Microphone'} ${index + 1}`,
          kind: device.kind as any,
        };

        if (device.kind === 'audioinput') audioInputs.push(item);
        else if (device.kind === 'audiooutput') audioOutputs.push(item);
        else if (device.kind === 'videoinput') videoInputs.push(item);
      });

      return { audioInputs, audioOutputs, videoInputs };
    } catch (err) {
      console.warn('Failed to enumerate devices:', err);
      return { audioInputs: [], audioOutputs: [], videoInputs: [] };
    }
  }

  /**
   * Request local camera & microphone streams with device selection and fallbacks
   */
  public async getLocalMedia(options: {
    audio?: boolean;
    video?: boolean;
    audioDeviceId?: string;
    videoDeviceId?: string;
  } = { audio: true, video: true }): Promise<MediaStream | null> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Media devices API not supported in this browser or over insecure HTTP.');
    }

    // Stop existing stream tracks if re-requesting
    this.stopLocalStream();

    const audioConstraints: boolean | MediaTrackConstraints = options.audio === false ? false : {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...(options.audioDeviceId ? { deviceId: { exact: options.audioDeviceId } } : {}),
    };

    const videoConstraints: boolean | MediaTrackConstraints = options.video === false ? false : {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 30 },
      ...(options.videoDeviceId ? { deviceId: { exact: options.videoDeviceId } } : {}),
    };

    try {
      // Primary attempt: HD combined
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: videoConstraints,
      });

      this.localStream = stream;
      this.setupAudioAnalysis(stream);
      return stream;
    } catch (err: any) {
      console.warn('Primary getUserMedia constraints failed, trying loose constraints...', err);

      // Fallback attempt: Standard loose constraints
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: options.audio !== false,
          video: options.video !== false,
        });

        this.localStream = stream;
        this.setupAudioAnalysis(stream);
        return stream;
      } catch (fallbackErr: any) {
        console.warn('Combined getUserMedia failed, trying split audio/video...', fallbackErr);

        // Split fallback
        let audioTrack: MediaStreamTrack | null = null;
        let videoTrack: MediaStreamTrack | null = null;

        if (options.audio !== false) {
          try {
            const aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioTrack = aStream.getAudioTracks()[0] || null;
          } catch (_) {}
        }

        if (options.video !== false) {
          try {
            const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoTrack = vStream.getVideoTracks()[0] || null;
          } catch (_) {}
        }

        if (audioTrack || videoTrack) {
          const combined = new MediaStream();
          if (audioTrack) combined.addTrack(audioTrack);
          if (videoTrack) combined.addTrack(videoTrack);

          this.localStream = combined;
          this.setupAudioAnalysis(combined);
          return combined;
        }

        throw new Error('Unable to access camera or microphone. Please check system permissions.');
      }
    }
  }

  /**
   * Screen sharing capture via getDisplayMedia
   */
  public async getScreenMedia(onEnded?: () => void): Promise<MediaStream | null> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Screen sharing is not supported by your browser.');
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      });

      this.screenStream = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.stopScreenStream();
          onEnded?.();
        };
      }

      return stream;
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        // User cancelled picker dialog
        return null;
      }
      throw err;
    }
  }

  /**
   * Set up Web Audio API volume analysis for active speaker detection
   */
  private setupAudioAnalysis(stream: MediaStream) {
    this.cleanupAudioAnalysis();

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.5;

      this.microphoneSource = this.audioContext.createMediaStreamSource(stream);
      this.microphoneSource.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      this.speakingInterval = setInterval(() => {
        if (!this.analyser || !audioTrack.enabled) {
          this.notifySpeaking(false, 0);
          return;
        }

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const volume = Math.min(100, Math.round((average / 128) * 100));
        const isSpeaking = volume > 15;

        this.notifySpeaking(isSpeaking, volume);
      }, 150);
    } catch (e) {
      console.warn('Audio analyser setup failed:', e);
    }
  }

  public subscribeSpeaking(cb: SpeakingCallback): () => void {
    this.speakingListeners.add(cb);
    return () => this.speakingListeners.delete(cb);
  }

  private notifySpeaking(isSpeaking: boolean, volume: number) {
    for (const listener of this.speakingListeners) {
      listener(isSpeaking, volume);
    }
  }

  private cleanupAudioAnalysis() {
    if (this.speakingInterval) {
      clearInterval(this.speakingInterval);
      this.speakingInterval = null;
    }
    if (this.microphoneSource) {
      try { this.microphoneSource.disconnect(); } catch (_) {}
      this.microphoneSource = null;
    }
    if (this.analyser) {
      this.analyser = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch (_) {}
      this.audioContext = null;
    }
  }

  /**
   * Change audio output device (speaker)
   */
  public async setAudioOutputDevice(element: HTMLMediaElement, deviceId: string): Promise<boolean> {
    if (typeof (element as any).setSinkId === 'function') {
      try {
        await (element as any).setSinkId(deviceId);
        return true;
      } catch (err) {
        console.warn('Failed to set audio sink device:', err);
        return false;
      }
    }
    return false;
  }

  /**
   * Toggle local microphone track enabled
   */
  public setMicrophoneEnabled(enabled: boolean): boolean {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
      return enabled;
    }
    return false;
  }

  /**
   * Toggle local camera track enabled
   */
  public setCameraEnabled(enabled: boolean): boolean {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
      return enabled;
    }
    return false;
  }

  /**
   * Stop and cleanup local camera/mic stream
   */
  public stopLocalStream() {
    this.cleanupAudioAnalysis();
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => {
        try { t.stop(); } catch (_) {}
      });
      this.localStream = null;
    }
  }

  /**
   * Stop screen sharing stream
   */
  public stopScreenStream() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => {
        try { t.stop(); } catch (_) {}
      });
      this.screenStream = null;
    }
  }

  /**
   * Cleanup everything
   */
  public cleanup() {
    this.stopLocalStream();
    this.stopScreenStream();
    this.speakingListeners.clear();
  }

  public getStream(): MediaStream | null {
    return this.localStream;
  }

  public getScreen(): MediaStream | null {
    return this.screenStream;
  }
}

export const mediaDeviceManager = new MediaDeviceManager();
