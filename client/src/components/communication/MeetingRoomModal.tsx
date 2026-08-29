import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Monitor,
  Hand,
  MessageSquare,
  Users,
  PhoneOff,
  Send,
  X,
  Sparkles,
  Shield,
  Signal,
  Crown,
  Share2,
} from 'lucide-react';
import { useCommunicationStore } from '../../store/useCommunicationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { mediaService } from '../../services/mediaService';

export const MeetingRoomModal: React.FC = () => {
  const {
    currentMeeting,
    meetingMessages,
    isMeetingMuted,
    isMeetingVideoOff,
    isMeetingScreenSharing,
    isHandRaised,
    meetingError,
    leaveMeeting,
    toggleMeetingMute,
    toggleMeetingVideo,
    toggleMeetingScreenShare,
    toggleMeetingHandRaise,
    sendMeetingMessage,
  } = useCommunicationStore();

  const currentUser = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<'chat' | 'participants' | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(mediaService.getLocalStream());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Subscribe to media device changes & auto-acquire camera if needed
  useEffect(() => {
    const unsub = mediaService.subscribe(() => {
      setLocalStream(mediaService.getLocalStream());
    });

    if (currentMeeting && !mediaService.getLocalStream()) {
      mediaService.getLocalMedia({ video: !isMeetingVideoOff, audio: !isMeetingMuted }).then((stream) => {
        setLocalStream(stream);
      });
    }

    return () => unsub();
  }, [currentMeeting, isMeetingVideoOff, isMeetingMuted]);

  useEffect(() => {
    if (localVideoRef.current && localStream && !isMeetingVideoOff) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, isMeetingVideoOff]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [meetingMessages]);

  if (!currentMeeting) return null;

  const participants = currentMeeting.participants || [
    {
      id: 'local',
      userId: currentUser?.id || 'me',
      user: {
        id: currentUser?.id || 'me',
        name: currentUser?.name || currentUser?.username || 'You',
        username: currentUser?.username || 'you',
        avatarUrl: currentUser?.avatarUrl,
      },
      role: 'host' as const,
      isMuted: isMeetingMuted,
      isVideoOff: isMeetingVideoOff,
      isHandRaised,
      joinedAt: new Date().toISOString(),
    },
  ];

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const ok = await sendMeetingMessage(chatInput);
    if (ok) setChatInput('');
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Determine grid columns based on number of participants (up to 10)
  const participantCount = Math.max(1, participants.length);
  const gridColsClass =
    participantCount === 1
      ? 'grid-cols-1 max-w-2xl'
      : participantCount === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : participantCount <= 4
      ? 'grid-cols-2'
      : participantCount <= 6
      ? 'grid-cols-2 md:grid-cols-3'
      : 'grid-cols-2 md:grid-cols-4';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#111413] text-white select-none animate-fade-in overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-16 px-6 border-b border-neutral-800/80 bg-[#181C1B]/90 backdrop-blur-xl flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#1F5E4B] flex items-center justify-center text-white shadow-md shadow-[#1F5E4B]/30">
            <VideoIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
              <span>{currentMeeting.title}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#1F5E4B]/20 text-[#2E7D5B] border border-[#1F5E4B]/30">
                LIVE SFU
              </span>
            </h2>
            <p className="text-[11px] text-neutral-400 font-mono">
              Room ID: {currentMeeting.roomId}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neutral-800/60 border border-neutral-700/50 text-[11px] text-neutral-300 font-mono">
            <Signal className="w-3.5 h-3.5 text-[#2E7D5B]" />
            <span>HD WebRTC</span>
          </div>

          <button
            type="button"
            onClick={handleCopyInvite}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold transition text-neutral-200"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copiedLink ? 'Copied Link!' : 'Invite'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Participants Video Grid Stage */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto flex items-center justify-center">
          <div className={`w-full grid gap-4 items-center justify-center mx-auto ${gridColsClass}`}>
            {/* Local Video Card */}
            <div
              className={`relative rounded-3xl bg-neutral-900 border ${
                !isMeetingMuted ? 'border-[#2E7D5B] shadow-lg shadow-[#1F5E4B]/10' : 'border-neutral-800'
              } overflow-hidden aspect-video flex items-center justify-center group`}
            >
              {!isMeetingVideoOff ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror-mode"
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <img
                    src={
                      currentUser?.avatarUrl ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                        currentUser?.name || currentUser?.username || 'You'
                      )}`
                    }
                    alt="You"
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-neutral-700"
                  />
                  <span className="text-xs font-bold text-neutral-300">{currentUser?.name || 'You'}</span>
                </div>
              )}

              {/* Badges */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                {isHandRaised && (
                  <div className="p-1.5 rounded-lg bg-amber-500 text-white shadow-sm animate-bounce">
                    <Hand className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`p-1.5 rounded-lg backdrop-blur-md ${
                    isMeetingMuted ? 'bg-red-500/80 text-white' : 'bg-black/60 text-[#2E7D5B]'
                  }`}
                >
                  {isMeetingMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </div>
              </div>

              <div className="absolute bottom-3 left-3 px-3 py-1 rounded-xl bg-black/60 backdrop-blur-md text-[11px] font-mono text-white flex items-center gap-1.5">
                <Crown className="w-3 h-3 text-amber-400" />
                <span>You (Host)</span>
              </div>
            </div>

            {/* Remote Participants Cards (Simulated/Connected) */}
            {participants
              .filter((p) => p.userId !== currentUser?.id)
              .map((participant) => {
                const pName = participant.user?.name || participant.user?.username || 'Team Member';
                return (
                  <div
                    key={participant.id}
                    className="relative rounded-3xl bg-neutral-900 border border-neutral-800 overflow-hidden aspect-video flex items-center justify-center group"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <img
                        src={
                          participant.user?.avatarUrl ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(pName)}`
                        }
                        alt={pName}
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-neutral-700"
                      />
                      <span className="text-xs font-bold text-neutral-300">{pName}</span>
                    </div>

                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      {participant.isHandRaised && (
                        <div className="p-1.5 rounded-lg bg-amber-500 text-white shadow-sm animate-bounce">
                          <Hand className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div
                        className={`p-1.5 rounded-lg backdrop-blur-md ${
                          participant.isMuted ? 'bg-red-500/80 text-white' : 'bg-black/60 text-[#2E7D5B]'
                        }`}
                      >
                        {participant.isMuted ? (
                          <MicOff className="w-3.5 h-3.5" />
                        ) : (
                          <Mic className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </div>

                    <div className="absolute bottom-3 left-3 px-3 py-1 rounded-xl bg-black/60 backdrop-blur-md text-[11px] font-mono text-white">
                      {pName}
                    </div>
                  </div>
                );
              })}
          </div>
        </main>

        {/* In-Meeting Sidebar Drawer (Chat / Participants) */}
        {activeTab && (
          <aside className="w-80 border-l border-neutral-800 bg-[#181C1B] flex flex-col z-20 animate-slide-left">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-neutral-300">
                {activeTab === 'chat' ? 'In-Call Chat' : 'Participants'}
              </h4>
              <button
                type="button"
                onClick={() => setActiveTab(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                  {meetingMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 text-neutral-500">
                      <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-xs">No messages yet. Send a message to participants.</p>
                    </div>
                  ) : (
                    meetingMessages.map((msg) => (
                      <div key={msg.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-[#2E7D5B]">
                            {msg.sender?.name || msg.sender?.username}
                          </span>
                          <span className="text-[9px] text-neutral-500 font-mono">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-200 bg-neutral-800/60 p-2 rounded-xl">
                          {msg.text}
                        </p>
                      </div>
                    ))
                  )}
                  <div ref={chatBottomRef} />
                </div>

                <form onSubmit={handleSendMessage} className="p-3 border-t border-neutral-800 flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Send message to everyone..."
                    className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#1F5E4B]"
                  />
                  <button
                    type="submit"
                    className="p-2 rounded-xl bg-[#1F5E4B] hover:bg-[#2E7D5B] text-white transition"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'participants' && (
              <div className="flex-1 p-4 space-y-2 overflow-y-auto">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-800/40 border border-neutral-700/50">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={
                        currentUser?.avatarUrl ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                          currentUser?.name || 'You'
                        )}`
                      }
                      alt="You"
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">{currentUser?.name || 'You'} (Host)</span>
                      <span className="text-[10px] text-neutral-400 font-mono">Host</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isHandRaised && <Hand className="w-3.5 h-3.5 text-amber-400 animate-bounce" />}
                    {isMeetingMuted ? (
                      <MicOff className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <Mic className="w-3.5 h-3.5 text-[#2E7D5B]" />
                    )}
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Bottom Meeting Controls Dock */}
      <footer className="h-20 border-t border-neutral-800/80 bg-[#181C1B]/95 backdrop-blur-xl px-6 flex items-center justify-center gap-3 z-20">
        <button
          type="button"
          onClick={toggleMeetingMute}
          className={`p-3.5 rounded-2xl transition shadow-sm ${
            isMeetingMuted
              ? 'bg-red-500/20 border border-red-500/40 text-red-400'
              : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
          }`}
          title={isMeetingMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMeetingMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          type="button"
          onClick={toggleMeetingVideo}
          className={`p-3.5 rounded-2xl transition shadow-sm ${
            isMeetingVideoOff
              ? 'bg-red-500/20 border border-red-500/40 text-red-400'
              : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
          }`}
          title={isMeetingVideoOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isMeetingVideoOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
        </button>

        <button
          type="button"
          onClick={toggleMeetingScreenShare}
          className={`p-3.5 rounded-2xl transition shadow-sm ${
            isMeetingScreenSharing
              ? 'bg-[#1F5E4B] border border-[#2E7D5B] text-white'
              : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
          }`}
          title={isMeetingScreenSharing ? 'Stop sharing screen' : 'Share your screen'}
        >
          <Monitor className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={toggleMeetingHandRaise}
          className={`p-3.5 rounded-2xl transition shadow-sm ${
            isHandRaised
              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
              : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
          }`}
          title={isHandRaised ? 'Lower hand' : 'Raise hand'}
        >
          <Hand className="w-5 h-5" />
        </button>

        <div className="h-6 w-px bg-neutral-800 mx-2" />

        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'chat' ? null : 'chat')}
          className={`p-3.5 rounded-2xl transition shadow-sm ${
            activeTab === 'chat'
              ? 'bg-[#1F5E4B] text-white'
              : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
          }`}
          title="Toggle chat"
        >
          <MessageSquare className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'participants' ? null : 'participants')}
          className={`p-3.5 rounded-2xl transition shadow-sm ${
            activeTab === 'participants'
              ? 'bg-[#1F5E4B] text-white'
              : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
          }`}
          title="Toggle participants"
        >
          <Users className="w-5 h-5" />
        </button>

        <div className="h-6 w-px bg-neutral-800 mx-2" />

        <button
          type="button"
          onClick={leaveMeeting}
          className="px-6 py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 transition hover:scale-105"
          title="Leave meeting"
        >
          <PhoneOff className="w-4 h-4" />
          <span>Leave Room</span>
        </button>
      </footer>
    </div>
  );
};
