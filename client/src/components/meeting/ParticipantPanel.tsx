import React, { useState } from 'react';
import {
  Users,
  X,
  Crown,
  Shield,
  Mic,
  MicOff,
  VideoOff,
  Hand,
  Share2,
  Check,
  VolumeX,
  UserX,
} from 'lucide-react';
import { MeetingParticipant } from '../../types/meeting';

interface ParticipantPanelProps {
  participants: MeetingParticipant[];
  currentUserId: string;
  isHostOrAdmin: boolean;
  meetingUrl: string;
  onMuteParticipant?: (userId: string) => void;
  onRemoveParticipant?: (userId: string) => void;
  onClose: () => void;
}

export const ParticipantPanel: React.FC<ParticipantPanelProps> = ({
  participants,
  currentUserId,
  isHostOrAdmin,
  meetingUrl,
  onMuteParticipant,
  onRemoveParticipant,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(meetingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeParticipants = participants.filter((p) => p.status !== 'left');

  return (
    <aside className="w-80 sm:w-96 border-l border-neutral-800 bg-[#181C1B] flex flex-col z-30 animate-slide-left select-none">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#2E7D5B]" />
          <h3 className="text-xs font-black uppercase tracking-wider text-white font-mono">
            Participants ({activeParticipants.length})
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Copy Invite Link Card */}
      <div className="p-3 border-b border-neutral-800/80 bg-neutral-900/50">
        <button
          type="button"
          onClick={handleCopyLink}
          className="w-full py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-200 flex items-center justify-center gap-2 transition"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-[#2E7D5B]" />
              <span className="text-[#2E7D5B]">Meeting Link Copied!</span>
            </>
          ) : (
            <>
              <Share2 className="w-4 h-4 text-[#2E7D5B]" />
              <span>Copy Meeting Invite Link</span>
            </>
          )}
        </button>
      </div>

      {/* Participant List */}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto min-h-0 text-xs">
        {activeParticipants.map((p) => {
          const isSelf = p.uid === currentUserId;

          return (
            <div
              key={p.uid}
              className="p-3 rounded-2xl bg-neutral-800/40 border border-neutral-700/50 hover:bg-neutral-800/70 transition flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={
                    p.avatarUrl ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                      p.name || p.username || 'User'
                    )}`
                  }
                  alt={p.name}
                  className="w-9 h-9 rounded-xl object-cover border border-neutral-700 shrink-0"
                />

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white truncate max-w-[130px]">
                      {p.name} {isSelf && '(You)'}
                    </span>
                    {p.role === 'host' ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 text-[9px] font-mono font-bold flex items-center gap-0.5 shrink-0">
                        <Crown className="w-2.5 h-2.5" />
                        <span>Host</span>
                      </span>
                    ) : p.role === 'admin' ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-[#1F5E4B]/30 text-[#2E7D5B] text-[9px] font-mono font-bold flex items-center gap-0.5 shrink-0">
                        <Shield className="w-2.5 h-2.5" />
                        <span>Admin</span>
                      </span>
                    ) : null}
                  </div>

                  <span className="text-[10px] text-neutral-400 font-mono block truncate">
                    {p.email}
                  </span>
                </div>
              </div>

              {/* Status Icons & Host Moderation Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {p.isHandRaised && (
                  <div className="p-1 rounded-lg bg-amber-500 text-white animate-bounce" title="Hand raised">
                    <Hand className="w-3 h-3" />
                  </div>
                )}

                <div
                  className={`p-1.5 rounded-lg ${
                    p.isMuted ? 'text-red-400 bg-red-500/10' : 'text-[#2E7D5B] bg-[#1F5E4B]/10'
                  }`}
                  title={p.isMuted ? 'Muted' : 'Microphone on'}
                >
                  {p.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </div>

                {isHostOrAdmin && !isSelf && (
                  <div className="flex items-center gap-1 pl-1 border-l border-neutral-700">
                    {onMuteParticipant && !p.isMuted && (
                      <button
                        type="button"
                        onClick={() => onMuteParticipant(p.uid)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition"
                        title="Mute participant"
                      >
                        <VolumeX className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {onRemoveParticipant && (
                      <button
                        type="button"
                        onClick={() => onRemoveParticipant(p.uid)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition"
                        title="Remove participant from meeting"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
