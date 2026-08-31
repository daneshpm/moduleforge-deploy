import React, { useState } from 'react';
import { ParticipantTile } from './ParticipantTile';
import { MeetingParticipant } from '../../types/meeting';
import { PeerStreamMap } from '../../services/webrtc/peerConnection';
import { Monitor } from 'lucide-react';

interface VideoGridProps {
  participants: MeetingParticipant[];
  localParticipant: MeetingParticipant;
  localStream: MediaStream | null;
  remoteStreams: PeerStreamMap;
  activeSpeakerId?: string | null;
  screenShareStream?: MediaStream | null;
  screenShareUser?: MeetingParticipant | null;
  isHostOrAdmin?: boolean;
  onHostMute?: (userId: string) => void;
  onHostRemove?: (userId: string) => void;
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  participants,
  localParticipant,
  localStream,
  remoteStreams,
  activeSpeakerId,
  screenShareStream,
  screenShareUser,
  isHostOrAdmin = false,
  onHostMute,
  onHostRemove,
}) => {
  const [pinnedUid, setPinnedUid] = useState<string | null>(null);

  // Combine all active participants (local + remote)
  const allParticipants = [
    localParticipant,
    ...participants.filter((p) => p.uid !== localParticipant.uid && p.status !== 'left'),
  ];

  const totalCount = allParticipants.length;

  // If a screen is being shared, render the Stage + Filmstrip view
  if (screenShareStream) {
    return (
      <div className="w-full h-full flex flex-col gap-3 p-3 sm:p-4 overflow-hidden">
        {/* Large Stage View for Screen Share */}
        <div className="flex-1 min-h-0 relative rounded-3xl bg-black border border-neutral-800 overflow-hidden flex items-center justify-center shadow-2xl">
          <video
            autoPlay
            playsInline
            ref={(video) => {
              if (video && screenShareStream) {
                video.srcObject = screenShareStream;
                video.play().catch(() => {});
              }
            }}
            className="w-full h-full object-contain"
          />

          <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md text-xs font-mono text-white flex items-center gap-2 border border-neutral-700/60">
            <Monitor className="w-3.5 h-3.5 text-[#2E7D5B]" />
            <span>{screenShareUser?.name || 'Participant'}'s screen</span>
          </div>
        </div>

        {/* Filmstrip below screen share */}
        <div className="h-32 sm:h-36 flex items-center gap-3 overflow-x-auto py-1 shrink-0">
          {allParticipants.map((p) => {
            const isLocal = p.uid === localParticipant.uid;
            const stream = isLocal ? localStream : remoteStreams[p.uid];
            return (
              <div key={p.uid} className="h-full aspect-video shrink-0">
                <ParticipantTile
                  participant={p}
                  stream={stream}
                  isLocal={isLocal}
                  isActiveSpeaker={activeSpeakerId === p.uid}
                  canModerate={isHostOrAdmin}
                  onMute={onHostMute ? () => onHostMute(p.uid) : undefined}
                  onRemove={onHostRemove ? () => onHostRemove(p.uid) : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // If a participant is pinned to spotlight
  if (pinnedUid) {
    const pinnedParticipant = allParticipants.find((p) => p.uid === pinnedUid) || localParticipant;
    const isPinnedLocal = pinnedParticipant.uid === localParticipant.uid;
    const pinnedStream = isPinnedLocal ? localStream : remoteStreams[pinnedParticipant.uid];

    return (
      <div className="w-full h-full flex flex-col md:flex-row gap-3 p-3 sm:p-4 overflow-hidden">
        {/* Spotlight Stage */}
        <div className="flex-1 min-h-0">
          <ParticipantTile
            participant={pinnedParticipant}
            stream={pinnedStream}
            isLocal={isPinnedLocal}
            isActiveSpeaker={activeSpeakerId === pinnedParticipant.uid}
            isPinned={true}
            onPin={() => setPinnedUid(null)}
            canModerate={isHostOrAdmin}
            onMute={onHostMute ? () => onHostMute(pinnedParticipant.uid) : undefined}
            onRemove={onHostRemove ? () => onHostRemove(pinnedParticipant.uid) : undefined}
          />
        </div>

        {/* Side/Bottom list for others */}
        <div className="w-full md:w-64 max-h-48 md:max-h-full flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto shrink-0">
          {allParticipants
            .filter((p) => p.uid !== pinnedUid)
            .map((p) => {
              const isLocal = p.uid === localParticipant.uid;
              const stream = isLocal ? localStream : remoteStreams[p.uid];
              return (
                <div key={p.uid} className="h-32 md:h-auto aspect-video shrink-0">
                  <ParticipantTile
                    participant={p}
                    stream={stream}
                    isLocal={isLocal}
                    isActiveSpeaker={activeSpeakerId === p.uid}
                    onPin={() => setPinnedUid(p.uid)}
                    canModerate={isHostOrAdmin}
                    onMute={onHostMute ? () => onHostMute(p.uid) : undefined}
                    onRemove={onHostRemove ? () => onHostRemove(p.uid) : undefined}
                  />
                </div>
              );
            })}
        </div>
      </div>
    );
  }

  // Determine standard grid columns based on count (1-10 participants)
  const gridClasses =
    totalCount === 1
      ? 'grid-cols-1 max-w-3xl'
      : totalCount === 2
      ? 'grid-cols-1 md:grid-cols-2 max-w-5xl'
      : totalCount <= 4
      ? 'grid-cols-1 sm:grid-cols-2 max-w-5xl'
      : totalCount <= 6
      ? 'grid-cols-2 sm:grid-cols-3 max-w-6xl'
      : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 max-w-7xl';

  return (
    <div className="w-full h-full flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className={`w-full grid gap-3 sm:gap-4 items-center justify-center mx-auto ${gridClasses}`}>
        {allParticipants.map((p) => {
          const isLocal = p.uid === localParticipant.uid;
          const stream = isLocal ? localStream : remoteStreams[p.uid];

          return (
            <ParticipantTile
              key={p.uid}
              participant={p}
              stream={stream}
              isLocal={isLocal}
              isActiveSpeaker={activeSpeakerId === p.uid}
              onPin={() => setPinnedUid(p.uid)}
              canModerate={isHostOrAdmin}
              onMute={onHostMute ? () => onHostMute(p.uid) : undefined}
              onRemove={onHostRemove ? () => onHostRemove(p.uid) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
};
