import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Settings,
  ArrowLeft,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { mediaDeviceManager } from '../../services/webrtc/mediaDevices';
import { meetingService } from '../../services/meeting/meetingService';
import { Meeting, MediaDeviceItem } from '../../types/meeting';

interface PreJoinScreenProps {
  meetingId: string;
  onJoin: (options: {
    stream: MediaStream | null;
    isMicMuted: boolean;
    isVideoMuted: boolean;
    audioDeviceId?: string;
    videoDeviceId?: string;
    audioOutputId?: string;
  }) => void;
}

export const PreJoinScreen: React.FC<PreJoinScreenProps> = ({
  meetingId,
  onJoin,
}) => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Device selections & states
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceItem[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceItem[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceItem[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('');
  const [audioVolume, setAudioVolume] = useState<number>(0);
  const [showSettings, setShowSettings] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // 1. Fetch meeting metadata & check access
  useEffect(() => {
    async function init() {
      if (!meetingId) return;
      setIsLoading(true);

      try {
        const details = await meetingService.getMeetingDetails(meetingId);
        if (!details) {
          setError('Meeting not found or has expired.');
          setIsLoading(false);
          return;
        }

        setMeeting(details);

        // Verify access: host and invited participants always have instant access
        if (currentUser?.id) {
          const isCreator = details.createdBy === currentUser.id;
          const isParticipant = Boolean(details.participants && details.participants[currentUser.id]);
          if (!isCreator && !isParticipant && details.teamId) {
            const hasAccess = await meetingService.verifyTeamAccess(details.teamId, currentUser.id);
            if (!hasAccess) {
              setAccessDenied(`You must be an invited member of "${details.teamName || 'this team'}" to access this meeting.`);
              setIsLoading(false);
              return;
            }
          }
        }
      } catch (err: any) {
        setError(err.message || 'Could not load meeting details.');
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, [meetingId, currentUser?.id]);

  // 2. Enumerate available media devices
  useEffect(() => {
    async function loadDevices() {
      const { audioInputs: aIn, audioOutputs: aOut, videoInputs: vIn } =
        await mediaDeviceManager.getAvailableDevices();

      setAudioInputs(aIn);
      setAudioOutputs(aOut);
      setVideoInputs(vIn);

      if (aIn[0]) setSelectedAudioInput(aIn[0].deviceId);
      if (vIn[0]) setSelectedVideoInput(vIn[0].deviceId);
      if (aOut[0]) setSelectedAudioOutput(aOut[0].deviceId);
    }

    loadDevices();
  }, []);

  // 3. Acquire preview stream
  useEffect(() => {
    let active = true;

    async function startPreview() {
      try {
        const stream = await mediaDeviceManager.getLocalMedia({
          audio: isMicOn,
          video: isVideoOn,
          audioDeviceId: selectedAudioInput || undefined,
          videoDeviceId: selectedVideoInput || undefined,
        });

        if (active && stream) {
          setLocalStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        }
      } catch (err) {
        console.warn('Could not start preview media:', err);
      }
    }

    startPreview();

    // Volume listener
    const unsubSpeaking = mediaDeviceManager.subscribeSpeaking((_isSpeaking, volume) => {
      if (active) setAudioVolume(volume);
    });

    return () => {
      active = false;
      unsubSpeaking();
    };
  }, [isMicOn, isVideoOn, selectedAudioInput, selectedVideoInput]);

  // Toggle mic
  const handleToggleMic = () => {
    const next = !isMicOn;
    setIsMicOn(next);
    mediaDeviceManager.setMicrophoneEnabled(next);
  };

  // Toggle camera
  const handleToggleVideo = () => {
    const next = !isVideoOn;
    setIsVideoOn(next);
    mediaDeviceManager.setCameraEnabled(next);
  };

  const handleJoinClick = () => {
    onJoin({
      stream: localStream,
      isMicMuted: !isMicOn,
      isVideoMuted: !isVideoOn,
      audioDeviceId: selectedAudioInput,
      videoDeviceId: selectedVideoInput,
      audioOutputId: selectedAudioOutput,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#111413] text-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#2E7D5B] animate-spin mx-auto" />
          <p className="text-xs text-neutral-400 font-mono">Preparing meeting room...</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#111413] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-3xl bg-[#181C1B] border border-neutral-800 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <Shield className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-white">Meeting Access Restricted</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">{accessDenied}</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white transition"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen bg-[#111413] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-3xl bg-[#181C1B] border border-neutral-800 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-white">Unable to Join Meeting</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">{error || 'This meeting room does not exist.'}</p>
          </div>
          <button
            onClick={() => navigate('/teams')}
            className="w-full py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white transition"
          >
            Back to Teams
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111413] text-white flex flex-col justify-between select-none relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-[#1F5E4B]/15 rounded-full blur-[180px] pointer-events-none" />

      {/* Top Header */}
      <header className="h-16 border-b border-neutral-800/80 px-6 sm:px-12 flex items-center justify-between sticky top-0 bg-[#181C1B]/80 backdrop-blur-xl z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#1F5E4B] flex items-center justify-center text-white shadow-md shadow-[#1F5E4B]/30">
            <Layers className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="font-black text-sm tracking-tight text-white block">
              ModuleForge Meet
            </span>
            <span className="text-[10px] font-mono text-neutral-400">
              WebRTC HD Video
            </span>
          </div>
        </div>

        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition px-3 py-1.5 rounded-xl hover:bg-neutral-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit</span>
        </button>
      </header>

      {/* Main Preview & Device Selection Area */}
      <main className="flex-1 flex items-center justify-center p-6 z-10">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Left: Camera Preview Tile */}
          <div className="md:col-span-7 space-y-4">
            <div className="relative rounded-3xl bg-[#181C1B] border border-neutral-800 shadow-2xl overflow-hidden aspect-video flex items-center justify-center group">
              {isVideoOn ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror-mode"
                />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={
                      currentUser?.avatarUrl ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                        currentUser?.name || currentUser?.username || 'You'
                      )}`
                    }
                    alt="You"
                    className="w-24 h-24 rounded-3xl object-cover border-4 border-[#1F5E4B] shadow-xl"
                  />
                  <span className="text-xs font-bold text-neutral-300">Camera is turned off</span>
                </div>
              )}

              {/* Mic Audio Level Indicator Bar */}
              {isMicOn && (
                <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-neutral-700/50">
                  <Volume2 className="w-3.5 h-3.5 text-[#2E7D5B]" />
                  <div className="w-16 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2E7D5B] transition-all duration-75 rounded-full"
                      style={{ width: `${audioVolume}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Floating Camera / Mic Control Buttons */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2.5 bg-black/70 backdrop-blur-md p-1.5 rounded-2xl border border-neutral-700/60">
                <button
                  type="button"
                  onClick={handleToggleMic}
                  className={`p-3 rounded-xl transition ${
                    !isMicOn
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-neutral-800 text-white hover:bg-neutral-700'
                  }`}
                  title={isMicOn ? 'Turn off microphone' : 'Turn on microphone'}
                >
                  {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={handleToggleVideo}
                  className={`p-3 rounded-xl transition ${
                    !isVideoOn
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-neutral-800 text-white hover:bg-neutral-700'
                  }`}
                  title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
                >
                  {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-3 rounded-xl transition ${
                    showSettings
                      ? 'bg-[#1F5E4B] text-white'
                      : 'bg-neutral-800 text-white hover:bg-neutral-700'
                  }`}
                  title="Device Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Device Settings Popover */}
            {showSettings && (
              <div className="p-4 rounded-2xl bg-[#181C1B] border border-neutral-800 space-y-3 animate-fade-in text-xs">
                <h4 className="font-bold text-white uppercase font-mono text-[10px] tracking-wider text-neutral-400">
                  Audio & Video Devices
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Microphone */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 block font-mono">Microphone</label>
                    <select
                      value={selectedAudioInput}
                      onChange={(e) => setSelectedAudioInput(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-[#1F5E4B] text-xs"
                    >
                      {audioInputs.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Camera */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 block font-mono">Camera</label>
                    <select
                      value={selectedVideoInput}
                      onChange={(e) => setSelectedVideoInput(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-[#1F5E4B] text-xs"
                    >
                      {videoInputs.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Speaker */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 block font-mono">Speaker</label>
                    <select
                      value={selectedAudioOutput}
                      onChange={(e) => setSelectedAudioOutput(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-[#1F5E4B] text-xs"
                    >
                      {audioOutputs.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Join Info & Action Card */}
          <div className="md:col-span-5 p-7 rounded-3xl bg-[#181C1B] border border-neutral-800 shadow-2xl space-y-6">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1F5E4B]/20 text-[#2E7D5B] border border-[#1F5E4B]/30 text-xs font-mono font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ready to Join</span>
              </span>

              <h2 className="text-xl font-black text-white tracking-tight">
                {meeting.title}
              </h2>
              {meeting.teamName && (
                <p className="text-xs text-neutral-400">
                  Team: <strong className="text-neutral-200">{meeting.teamName}</strong>
                </p>
              )}
            </div>

            <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-xs space-y-2">
              <div className="flex items-center justify-between text-neutral-400 font-mono text-[11px]">
                <span>Microphone:</span>
                <span className={isMicOn ? 'text-[#2E7D5B] font-bold' : 'text-red-400 font-bold'}>
                  {isMicOn ? 'ON' : 'MUTED'}
                </span>
              </div>
              <div className="flex items-center justify-between text-neutral-400 font-mono text-[11px]">
                <span>Camera:</span>
                <span className={isVideoOn ? 'text-[#2E7D5B] font-bold' : 'text-red-400 font-bold'}>
                  {isVideoOn ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleJoinClick}
                className="w-full py-4 px-6 rounded-2xl bg-[#1F5E4B] hover:bg-[#2E7D5B] text-white font-bold text-sm shadow-xl shadow-[#1F5E4B]/30 flex items-center justify-center gap-2 transition transform active:scale-95"
              >
                <Video className="w-5 h-5" />
                <span>Join Now</span>
              </button>

              <p className="text-[11px] text-center text-neutral-400 leading-relaxed">
                Joining as <strong className="text-white">{currentUser?.name || currentUser?.username}</strong>.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs font-mono text-neutral-500">
        <span>ModuleForge WebRTC • Secure Peer-to-Peer Encryption</span>
      </footer>
    </div>
  );
};
