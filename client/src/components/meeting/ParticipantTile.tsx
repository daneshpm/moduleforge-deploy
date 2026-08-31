import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  VideoOff,
  Hand,
  Crown,
  Shield,
  Maximize2,
  Minimize2,
  MoreVertical,
  VolumeX,
  UserX,
  Pin,
} from 'lucide-react';
import { MeetingParticipant } from '../../types/meeting';

interface ParticipantTileProps {
  participant: MeetingParticipant;
  stream?: MediaStream | null;
  isLocal?: boolean;
  isActiveSpeaker?: boolean;
  isPinned?: boolean;
  canModerate?: boolean;
  onPin?: () => void;
  onMute?: () => void;
  onRemove?: () => void;
}

export const ParticipantTile: React.FC<ParticipantTileProps> = ({
  participant,
  stream,
  isLocal = false,
  isActiveSpeaker = false,
  isPinned = false,
  canModerate = false,
  onPin,
  onMute,
  onRemove,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Attach media stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, participant.isVideoOff]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const hasVideo = Boolean(stream && stream.getVideoTracks().length > 0 && !participant.isVideoOff);

  return (
    <div
      ref={containerRef}
      className={`relative rounded-3xl bg-neutral-900 border transition-all duration-200 overflow-hidden aspect-video flex items-center justify-center group select-none ${
        isActiveSpeaker
          ? 'border-[#2E7D5B] ring-2 ring-[#2E7D5B]/40 shadow-lg shadow-[#1F5E4B]/20'
          : 'border-neutral-800/90 hover:border-neutral-700'
      }`}
    >
      {/* Video Element */}
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover ${isLocal ? 'mirror-mode' : ''}`}
        />
      ) : (
        <div className="flex flex-col items-center gap-2.5 p-4 text-center">
          <img
            src={
              participant.avatarUrl ||
              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                participant.name || participant.username || 'User'
              )}`
            }
            alt={participant.name}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl object-cover border-2 border-neutral-700 shadow-lg"
          />
          <span className="text-xs font-bold text-neutral-300 truncate max-w-[150px]">
            {participant.name}
          </span>
        </div>
      )}

      {/* Top Badges (Hand Raise, Audio Status) */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
        {participant.isHandRaised && (
          <div className="p-1.5 rounded-xl bg-amber-500 text-white shadow-md animate-bounce" title="Hand Raised">
            <Hand className="w-3.5 h-3.5" />
          </div>
        )}

        <div
          className={`p-1.5 rounded-xl backdrop-blur-md transition ${
            participant.isMuted
              ? 'bg-red-600/90 text-white shadow-sm'
              : 'bg-black/50 text-[#2E7D5B]'
          }`}
          title={participant.isMuted ? 'Microphone is muted' : 'Microphone is active'}
        >
          {participant.isMuted ? (
            <MicOff className="w-3.5 h-3.5" />
          ) : (
            <Mic className="w-3.5 h-3.5" />
          )}
        </div>
      </div>

      {/* Bottom Name Badge */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/65 backdrop-blur-md text-[11px] font-mono text-white z-10 max-w-[80%]">
        {participant.role === 'host' ? (
          <Crown className="w-3 h-3 text-amber-400 shrink-0" />
        ) : participant.role === 'admin' ? (
          <Shield className="w-3 h-3 text-[#2E7D5B] shrink-0" />
        ) : null}

        <span className="truncate">
          {participant.name} {isLocal && '(You)'}
        </span>
      </div>

      {/* Hover Action Overlay Buttons (Pin, Fullscreen, Host Menu) */}
      <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition flex items-center gap-1.5 z-10">
        {onPin && (
          <button
            type="button"
            onClick={onPin}
            className={`p-1.5 rounded-xl backdrop-blur-md text-white transition ${
              isPinned ? 'bg-[#1F5E4B]' : 'bg-black/60 hover:bg-black/90'
            }`}
            title={isPinned ? 'Unpin tile' : 'Pin to spotlight'}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-1.5 rounded-xl bg-black/60 hover:bg-black/90 backdrop-blur-md text-white transition"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        {canModerate && !isLocal && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-xl bg-black/60 hover:bg-black/90 backdrop-blur-md text-white transition"
              title="Host Moderation Actions"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {showMenu && (
              <div className="absolute left-0 mt-1.5 w-36 bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl overflow-hidden z-20 animate-scale-in text-xs py-1">
                {onMute && !participant.isMuted && (
                  <button
                    onClick={() => {
                      onMute();
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-neutral-200 hover:bg-neutral-800 flex items-center gap-2"
                  >
                    <VolumeX className="w-3.5 h-3.5 text-red-400" />
                    <span>Mute</span>
                  </button>
                )}

                {onRemove && (
                  <button
                    onClick={() => {
                      onRemove();
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-red-400 hover:bg-neutral-800 flex items-center gap-2"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
