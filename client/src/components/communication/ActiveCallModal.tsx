import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Monitor,
  PhoneOff,
  Maximize2,
  Minimize2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useCommunicationStore } from '../../store/useCommunicationStore';
import { mediaService } from '../../services/mediaService';

export const ActiveCallModal: React.FC = () => {
  const {
    activeCall,
    callDuration,
    isCallMuted,
    isCallVideoOff,
    isCallScreenSharing,
    callError,
    toggleCallMute,
    toggleCallVideo,
    toggleCallScreenShare,
    endCall,
  } = useCommunicationStore();

  const [isMinimized, setIsMinimized] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (activeCall && !isCallVideoOff && localVideoRef.current) {
      const stream = mediaService.getLocalStream();
      if (stream) {
        localVideoRef.current.srcObject = stream;
      }
    }
  }, [activeCall, isCallVideoOff]);

  if (!activeCall) return null;

  const otherPerson = activeCall.receiver || activeCall.caller;
  const otherName = otherPerson?.name || otherPerson?.username || 'Team Member';
  const isVideo = activeCall.type === 'video';

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Minimized Floating Widget
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#202524] text-white border border-[#1F5E4B]/40 shadow-2xl backdrop-blur-xl">
          <div className="relative">
            <img
              src={
                otherPerson?.avatarUrl ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(otherName)}`
              }
              alt={otherName}
              className="w-10 h-10 rounded-xl object-cover border border-[#1F5E4B]"
            />
            <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[#2E7D5B] border-2 border-[#202524]" />
          </div>

          <div className="min-w-0 pr-2">
            <h5 className="text-xs font-bold text-white truncate">{otherName}</h5>
            <span className="text-[10px] font-mono text-[#2E7D5B]">{formatTimer(callDuration)}</span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-neutral-700 pl-2">
            <button
              type="button"
              onClick={toggleCallMute}
              className={`p-2 rounded-lg transition ${
                isCallMuted ? 'bg-red-500/20 text-red-400' : 'bg-neutral-800 text-white hover:bg-neutral-700'
              }`}
            >
              {isCallMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition"
              title="Expand window"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={endCall}
              className="p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition"
              title="End call"
            >
              <PhoneOff className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full Call Dialog
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl rounded-3xl bg-[#181C1B] border border-neutral-800 text-white shadow-2xl overflow-hidden flex flex-col relative">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-[#202524]/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#2E7D5B] animate-pulse" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{otherName}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1F5E4B]/30 text-[#2E7D5B] border border-[#1F5E4B]/40">
                  {activeCall.status === 'CONNECTED' ? formatTimer(callDuration) : activeCall.status}
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400 font-mono">1:1 {isVideo ? 'Video Call' : 'Voice Call'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              title="Minimize call"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {callError && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{callError}</span>
          </div>
        )}

        {/* Main Stage View */}
        <div className="p-8 flex-1 flex flex-col items-center justify-center min-h-[320px] relative bg-radial-glow overflow-hidden">
          {isVideo && !isCallVideoOff ? (
            <div className="w-full h-full max-h-[380px] rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 relative flex items-center justify-center">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror-mode"
              />
              <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[11px] font-mono text-white">
                You {isCallMuted && '(Muted)'}
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="relative mx-auto w-28 h-28">
                <img
                  src={
                    otherPerson?.avatarUrl ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(otherName)}`
                  }
                  alt={otherName}
                  className="w-28 h-28 rounded-3xl object-cover border-4 border-[#1F5E4B] shadow-2xl"
                />
                {activeCall.status === 'CONNECTED' && (
                  <div className="absolute inset-0 rounded-3xl ring-4 ring-[#2E7D5B]/50 animate-ping pointer-events-none" />
                )}
              </div>

              <div>
                <h4 className="text-lg font-black text-white">{otherName}</h4>
                <p className="text-xs font-mono text-neutral-400 mt-0.5">
                  {activeCall.status === 'CALLING' && 'Calling...'}
                  {activeCall.status === 'RINGING' && 'Ringing...'}
                  {activeCall.status === 'CONNECTED' && 'Connected • SFU Audio Active'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Call Controls Toolbar */}
        <div className="p-5 border-t border-neutral-800 bg-[#202524]/80 backdrop-blur-md flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={toggleCallMute}
            className={`p-4 rounded-2xl transition shadow-sm ${
              isCallMuted
                ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
            }`}
            title={isCallMuted ? 'Unmute' : 'Mute'}
          >
            {isCallMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {isVideo && (
            <button
              type="button"
              onClick={toggleCallVideo}
              className={`p-4 rounded-2xl transition shadow-sm ${
                isCallVideoOff
                  ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
              }`}
              title={isCallVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isCallVideoOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
            </button>
          )}

          <button
            type="button"
            onClick={toggleCallScreenShare}
            className={`p-4 rounded-2xl transition shadow-sm ${
              isCallScreenSharing
                ? 'bg-[#1F5E4B] border border-[#2E7D5B] text-white'
                : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
            }`}
            title={isCallScreenSharing ? 'Stop sharing screen' : 'Share screen'}
          >
            <Monitor className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={endCall}
            className="px-6 py-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-red-600/30 transition hover:scale-105"
            title="End call"
          >
            <PhoneOff className="w-5 h-5" />
            <span>End Call</span>
          </button>
        </div>
      </div>
    </div>
  );
};
