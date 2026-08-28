import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Video as VideoIcon,
  VideoOff,
  Mic,
  MicOff,
  Users,
  Shield,
  ArrowLeft,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useCommunicationStore } from '../store/useCommunicationStore';
import { useAuthStore } from '../store/useAuthStore';
import { mediaService } from '../services/mediaService';

export const MeetingJoinPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const { joinMeeting, meetingError } = useCommunicationStore();

  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [meetingDetails, setMeetingDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize preview media
  useEffect(() => {
    let localStream: MediaStream | null = null;

    async function initPreview() {
      try {
        const stream = await mediaService.getLocalMedia({ video: isVideoOn, audio: isMicOn });
        if (stream) {
          localStream = stream;
          if (previewVideoRef.current) {
            previewVideoRef.current.srcObject = stream;
          }
        }
      } catch (err: any) {
        setPermissionError('Could not access microphone/camera');
      }
    }

    initPreview();

    return () => {
      if (localStream) {
        for (const track of localStream.getTracks()) {
          track.stop();
        }
      }
    };
  }, [isVideoOn, isMicOn]);

  // Fetch meeting metadata
  useEffect(() => {
    async function fetchMeeting() {
      if (!roomId) return;
      try {
        const res = await fetch(`/api/meetings/${roomId}`);
        const data = await res.json();
        if (res.ok && data.meeting) {
          setMeetingDetails(data.meeting);
        }
      } catch (_) {
      } finally {
        setIsLoadingDetails(false);
      }
    }

    fetchMeeting();
  }, [roomId]);

  const handleJoin = async () => {
    if (!roomId) return;
    setIsJoining(true);
    const ok = await joinMeeting(roomId);
    setIsJoining(false);
    if (ok) {
      navigate('/messages');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F7] text-[#202524] flex flex-col justify-between select-none relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-[#1F5E4B]/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Top Header */}
      <header className="h-16 border-b border-[#E2E6E4] px-6 sm:px-12 flex items-center justify-between sticky top-0 bg-white/85 backdrop-blur-xl z-40 shadow-xs">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2.5 group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#1F5E4B] p-0.5 shadow-md shadow-[#1F5E4B]/20 group-hover:scale-105 transition flex items-center justify-center">
            <Layers className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-black text-lg tracking-tight primary-text-gradient">
            ModuleForge Meet
          </span>
        </button>

        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B7471] hover:text-[#202524] transition px-3 py-1.5 rounded-xl hover:bg-[#EAF3EF]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6 z-10">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Left Preview Video Card */}
          <div className="md:col-span-7 space-y-4">
            <div className="relative rounded-3xl bg-[#181C1B] border border-neutral-800 shadow-2xl overflow-hidden aspect-video flex items-center justify-center">
              {isVideoOn ? (
                <video
                  ref={previewVideoRef}
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
                    className="w-24 h-24 rounded-3xl object-cover border-4 border-[#1F5E4B]"
                  />
                  <span className="text-sm font-bold text-white">Camera is turned off</span>
                </div>
              )}

              {/* In-Preview Controls */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-md p-2 rounded-2xl border border-neutral-700/60">
                <button
                  type="button"
                  onClick={() => setIsMicOn(!isMicOn)}
                  className={`p-3 rounded-xl transition ${
                    !isMicOn
                      ? 'bg-red-500/80 text-white'
                      : 'bg-neutral-800 text-white hover:bg-neutral-700'
                  }`}
                  title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
                >
                  {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setIsVideoOn(!isVideoOn)}
                  className={`p-3 rounded-xl transition ${
                    !isVideoOn
                      ? 'bg-red-500/80 text-white'
                      : 'bg-neutral-800 text-white hover:bg-neutral-700'
                  }`}
                  title={isVideoOn ? 'Turn Off Camera' : 'Turn On Camera'}
                >
                  {isVideoOn ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {permissionError && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 text-xs flex items-center gap-2 font-mono">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>{permissionError}</span>
              </div>
            )}
          </div>

          {/* Right Join Action Card */}
          <div className="md:col-span-5 p-8 rounded-3xl bg-white border border-[#E2E6E4] shadow-card space-y-6">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF3EF] text-[#1F5E4B] text-xs font-mono font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ready to Join</span>
              </span>

              <h2 className="text-2xl font-black text-[#202524] tracking-tight">
                {meetingDetails?.title || 'Team Meeting Room'}
              </h2>
              <p className="text-xs text-[#6B7471] font-mono">
                Room ID: {roomId}
              </p>
            </div>

            {meetingError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{meetingError}</span>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleJoin}
                disabled={isJoining}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#1F5E4B] hover:bg-[#2E7D5B] text-white font-bold text-sm shadow-md shadow-[#1F5E4B]/30 flex items-center justify-center gap-2 transition transform active:scale-95 disabled:opacity-50"
              >
                {isJoining ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <VideoIcon className="w-5 h-5" />
                )}
                <span>{isJoining ? 'Connecting...' : 'Join Meeting Now'}</span>
              </button>

              <p className="text-[11px] text-center text-[#6B7471] leading-relaxed">
                Joining as <strong className="text-[#202524]">{currentUser?.name || currentUser?.username}</strong>.
                Your camera and mic settings will be applied automatically.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs font-mono text-[#6B7471]">
        <span>ModuleForge WebRTC & LiveKit SFU Cluster • Secure HD Audio/Video</span>
      </footer>
    </div>
  );
};
