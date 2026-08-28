import React, { useEffect } from 'react';
import { Phone, PhoneOff, Video, Mic, Volume2 } from 'lucide-react';
import { useCommunicationStore } from '../../store/useCommunicationStore';

export const IncomingCallModal: React.FC = () => {
  const { incomingCall, acceptCall, declineCall } = useCommunicationStore();

  useEffect(() => {
    // Play subtle audio chime simulation or sound if supported
    if (incomingCall) {
      const audioCtx = (window.AudioContext || (window as any).webkitAudioContext)
        ? new (window.AudioContext || (window as any).webkitAudioContext)()
        : null;

      if (audioCtx) {
        try {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, audioCtx.currentTime);
          gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.3);
        } catch (_) {}
      }
    }
  }, [incomingCall]);

  if (!incomingCall) return null;

  const callerName = incomingCall.caller.name || incomingCall.caller.username || 'Team Member';
  const isVideo = incomingCall.type === 'video';

  return (
    <div className="fixed top-6 right-6 z-50 animate-bounce-short">
      <div className="w-96 rounded-3xl bg-[#202524] text-white p-5 border border-[#1F5E4B]/40 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Glow pulsing ring */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#1F5E4B]/30 rounded-full blur-2xl pointer-events-none animate-pulse" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="relative">
            <img
              src={
                incomingCall.caller.avatarUrl ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(callerName)}`
              }
              alt={callerName}
              className="w-14 h-14 rounded-2xl object-cover border-2 border-[#1F5E4B] shadow-md"
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#1F5E4B] flex items-center justify-center text-white shadow-xs">
              {isVideo ? <Video className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#2E7D5B] font-bold block flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2E7D5B] animate-ping" />
              Incoming {isVideo ? 'Video Call' : 'Voice Call'}
            </span>
            <h4 className="text-base font-bold text-white truncate">{callerName}</h4>
            <p className="text-xs text-neutral-400 font-mono">ModuleForge Workspace</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-5 relative z-10">
          <button
            type="button"
            onClick={() => declineCall(incomingCall.id)}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-semibold text-xs transition"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Decline</span>
          </button>

          <button
            type="button"
            onClick={() => acceptCall(incomingCall)}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#1F5E4B] hover:bg-[#2E7D5B] text-white font-bold text-xs shadow-md shadow-[#1F5E4B]/40 transition animate-pulse"
          >
            <Phone className="w-4 h-4" />
            <span>Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
};
