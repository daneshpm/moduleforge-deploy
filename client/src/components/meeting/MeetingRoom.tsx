import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video as VideoIcon,
  Signal,
  Share2,
  Check,
  Crown,
  Layers,
  PhoneOff,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { VideoGrid } from './VideoGrid';
import { MeetingControls } from './MeetingControls';
import { MeetingChat } from './MeetingChat';
import { ParticipantPanel } from './ParticipantPanel';
import { useAuthStore } from '../../store/useAuthStore';
import { FirestoreSignaling } from '../../services/webrtc/signaling';
import { WebRTCMeshManager, PeerStreamMap } from '../../services/webrtc/peerConnection';
import { mediaDeviceManager } from '../../services/webrtc/mediaDevices';
import { participantService } from '../../services/meeting/participantService';
import { meetingService } from '../../services/meeting/meetingService';
import {
  Meeting,
  MeetingParticipant,
  MeetingMessage,
  MediaDeviceItem,
} from '../../types/meeting';

interface MeetingRoomProps {
  meetingId: string;
  initialMedia?: {
    stream: MediaStream | null;
    isMicMuted: boolean;
    isVideoMuted: boolean;
    audioDeviceId?: string;
    videoDeviceId?: string;
    audioOutputId?: string;
  };
  onLeave?: () => void;
}

export const MeetingRoom: React.FC<MeetingRoomProps> = ({
  meetingId,
  initialMedia,
  onLeave,
}) => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Record<string, MeetingParticipant>>({});
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [activeDrawer, setActiveDrawer] = useState<'chat' | 'participants' | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);

  // Local media states
  const [isMuted, setIsMuted] = useState(initialMedia?.isMicMuted ?? false);
  const [isVideoOff, setIsVideoOff] = useState(initialMedia?.isVideoMuted ?? false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);

  // Available devices
  const [audioInputs, setAudioInputs] = useState<MediaDeviceItem[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceItem[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceItem[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>(
    initialMedia?.audioDeviceId || ''
  );
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>(
    initialMedia?.videoDeviceId || ''
  );
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>(
    initialMedia?.audioOutputId || ''
  );

  // WebRTC Streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(
    initialMedia?.stream || mediaDeviceManager.getStream()
  );
  const [remoteStreams, setRemoteStreams] = useState<PeerStreamMap>({});
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);

  // References for signaling & peer manager
  const signalingRef = useRef<FirestoreSignaling | null>(null);
  const peerManagerRef = useRef<WebRTCMeshManager | null>(null);

  const meetingUrl = useMemo(() => `${window.location.origin}/meet/${meetingId}`, [meetingId]);

  // Determine user role and permissions
  const localParticipant: MeetingParticipant = useMemo(() => {
    const existing = participants[currentUser?.id || ''];
    return {
      uid: currentUser?.id || 'me',
      name: currentUser?.name || currentUser?.username || 'You',
      email: currentUser?.email || '',
      username: currentUser?.username,
      avatarUrl: currentUser?.avatarUrl,
      role: existing?.role || (meeting?.createdBy === currentUser?.id ? 'host' : 'member'),
      status: 'connected',
      isMuted,
      isVideoOff,
      isScreenSharing,
      isHandRaised,
      joinedAt: existing?.joinedAt || Date.now(),
    };
  }, [currentUser, participants, meeting, isMuted, isVideoOff, isScreenSharing, isHandRaised]);

  const isHostOrAdmin = localParticipant.role === 'host' || localParticipant.role === 'admin';

  // 1. Initialize Meeting Metadata, Devices, Signaling & Mesh Manager
  useEffect(() => {
    if (!currentUser?.id || !meetingId) return;

    const signaling = new FirestoreSignaling(meetingId, currentUser.id);
    const peerManager = new WebRTCMeshManager(currentUser.id, signaling);

    signalingRef.current = signaling;
    peerManagerRef.current = peerManager;

    // Load available media devices
    mediaDeviceManager.getAvailableDevices().then((devices) => {
      setAudioInputs(devices.audioInputs);
      setVideoInputs(devices.videoInputs);
      setAudioOutputs(devices.audioOutputs);
    });

    // Ensure local stream is active
    if (!localStream) {
      mediaDeviceManager
        .getLocalMedia({
          audio: !isMuted,
          video: !isVideoOff,
          audioDeviceId: selectedAudioInput || undefined,
          videoDeviceId: selectedVideoInput || undefined,
        })
        .then((stream) => {
          if (stream) {
            setLocalStream(stream);
            peerManager.setLocalStream(stream);
          }
        })
        .catch((err) => {
          console.warn('Meeting room media acquisition notice:', err);
        });
    } else {
      peerManager.setLocalStream(localStream);
    }

    // Register local participant presence in Firestore
    signaling.registerParticipant(localParticipant);

    // Subscribe to meeting metadata & status updates
    const unsubMeeting = signaling.subscribeMeetingState((updatedMeeting) => {
      setMeeting(updatedMeeting);

      // If host ended meeting for everyone
      if (updatedMeeting.status === 'ended') {
        alert('This meeting has ended.');
        handleLeave();
      }
    });

    // Subscribe to participants updates
    const unsubParticipants = signaling.subscribeParticipants((updatedParticipants) => {
      setParticipants(updatedParticipants);

      // Check if remote peer initiated a moderation action (e.g. host muted us)
      const myDoc = updatedParticipants[currentUser.id];
      if (myDoc) {
        if (myDoc.isMuted !== undefined && myDoc.isMuted !== isMuted) {
          setIsMuted(myDoc.isMuted);
          mediaDeviceManager.setMicrophoneEnabled(!myDoc.isMuted);
        }
        if (myDoc.status === 'left') {
          // Host removed us from the meeting
          alert('You have been removed from the meeting by the host.');
          handleLeave();
          return;
        }
      }

      // Connect to any new participants that joined
      Object.values(updatedParticipants).forEach((p) => {
        if (p.uid !== currentUser.id && p.status !== 'left') {
          peerManager.connectToPeer(p.uid, true);
        }
      });
    });

    // Subscribe to WebRTC SDP signals
    const unsubSignals = signaling.subscribeSignals((signal) => {
      peerManager.handleSignal(signal);
    });

    // Subscribe to ICE candidates
    const unsubCandidates = signaling.subscribeIceCandidates((candidatePayload) => {
      peerManager.handleIceCandidate(candidatePayload);
    });

    // Subscribe to in-call messages
    const unsubMessages = signaling.subscribeMessages((updatedMessages) => {
      setMessages(updatedMessages);
      if (activeDrawer !== 'chat' && updatedMessages.length > 0) {
        setUnreadChatCount((prev) => prev + 1);
      }
    });

    // Peer stream callback
    const unsubRemoteStreams = peerManager.onRemoteStream((peerId, stream) => {
      setRemoteStreams((prev) => ({
        ...prev,
        [peerId]: stream,
      }));
    });

    const unsubPeerDisconnected = peerManager.onPeerDisconnected((peerId) => {
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
    });

    // Voice speaking listener
    const unsubSpeaking = mediaDeviceManager.subscribeSpeaking((isSpeaking) => {
      if (isSpeaking && !isMuted) {
        setActiveSpeakerId(currentUser.id);
      } else if (activeSpeakerId === currentUser.id) {
        setActiveSpeakerId(null);
      }
    });

    // Duration timer ticker
    const timer = setInterval(() => {
      setDurationSeconds((sec) => sec + 1);
    }, 1000);

    // Browser close / beforeunload cleanup
    const handleBeforeUnload = () => {
      signaling.leaveMeeting();
      peerManager.cleanup();
      mediaDeviceManager.cleanup();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(timer);
      unsubMeeting();
      unsubParticipants();
      unsubSignals();
      unsubCandidates();
      unsubMessages();
      unsubRemoteStreams();
      unsubPeerDisconnected();
      unsubSpeaking();
      window.removeEventListener('beforeunload', handleBeforeUnload);

      signaling.leaveMeeting();
      peerManager.cleanup();
      mediaDeviceManager.cleanup();
    };
  }, [currentUser?.id, meetingId]);

  // Sync mute state with Firestore & local track
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    mediaDeviceManager.setMicrophoneEnabled(!next);
    signalingRef.current?.updateParticipant({ isMuted: next });
  };

  // Sync video state with Firestore & local track
  const handleToggleVideo = () => {
    const next = !isVideoOff;
    setIsVideoOff(next);
    mediaDeviceManager.setCameraEnabled(!next);
    signalingRef.current?.updateParticipant({ isVideoOff: next });
  };

  // Screen share handler
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      mediaDeviceManager.stopScreenStream();
      setIsScreenSharing(false);
      setScreenShareStream(null);
      peerManagerRef.current?.setScreenStream(null);
      signalingRef.current?.updateParticipant({ isScreenSharing: false });
      signalingRef.current?.setScreenShareUser(null);
    } else {
      try {
        const screenStream = await mediaDeviceManager.getScreenMedia(() => {
          // Triggered when user clicks browser native "Stop sharing" button
          setIsScreenSharing(false);
          setScreenShareStream(null);
          peerManagerRef.current?.setScreenStream(null);
          signalingRef.current?.updateParticipant({ isScreenSharing: false });
          signalingRef.current?.setScreenShareUser(null);
        });

        if (screenStream) {
          setIsScreenSharing(true);
          setScreenShareStream(screenStream);
          peerManagerRef.current?.setScreenStream(screenStream);
          signalingRef.current?.updateParticipant({ isScreenSharing: true });
          signalingRef.current?.setScreenShareUser(currentUser?.id || null);
        }
      } catch (err: any) {
        console.warn('Screen sharing error:', err);
      }
    }
  };

  // Hand raise toggle
  const handleToggleHandRaise = () => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    signalingRef.current?.updateParticipant({ isHandRaised: next });
  };

  // Switch Audio Input
  const handleSelectAudioInput = async (deviceId: string) => {
    setSelectedAudioInput(deviceId);
    const newStream = await mediaDeviceManager.getLocalMedia({
      audio: !isMuted,
      video: !isVideoOff,
      audioDeviceId: deviceId,
      videoDeviceId: selectedVideoInput || undefined,
    });
    if (newStream) {
      setLocalStream(newStream);
      peerManagerRef.current?.setLocalStream(newStream);
    }
  };

  // Switch Video Input
  const handleSelectVideoInput = async (deviceId: string) => {
    setSelectedVideoInput(deviceId);
    const newStream = await mediaDeviceManager.getLocalMedia({
      audio: !isMuted,
      video: !isVideoOff,
      audioDeviceId: selectedAudioInput || undefined,
      videoDeviceId: deviceId,
    });
    if (newStream) {
      setLocalStream(newStream);
      peerManagerRef.current?.setLocalStream(newStream);
    }
  };

  // Switch Audio Output (Speaker)
  const handleSelectAudioOutput = (deviceId: string) => {
    setSelectedAudioOutput(deviceId);
  };

  // Send in-meeting message
  const handleSendMessage = (text: string) => {
    if (!currentUser) return;
    signalingRef.current?.sendMessage(
      currentUser.name || currentUser.username || 'Participant',
      text,
      currentUser.avatarUrl
    );
  };

  // Drawer toggles
  const handleToggleDrawer = (drawer: 'chat' | 'participants') => {
    if (activeDrawer === drawer) {
      setActiveDrawer(null);
    } else {
      setActiveDrawer(drawer);
      if (drawer === 'chat') {
        setUnreadChatCount(0);
      }
    }
  };

  // Copy Meeting Link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(meetingUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Leave meeting
  const handleLeave = () => {
    signalingRef.current?.leaveMeeting();
    peerManagerRef.current?.cleanup();
    mediaDeviceManager.cleanup();

    if (onLeave) {
      onLeave();
    } else if (meeting?.teamId) {
      navigate(`/teams/${meeting.teamId}`);
    } else {
      navigate('/teams');
    }
  };

  // End meeting for everyone (Host action)
  const handleEndMeetingForAll = async () => {
    if (!confirm('Are you sure you want to end this meeting for all participants?')) return;
    if (meeting?.id) {
      await meetingService.endMeeting(meeting.id, currentUser?.id || '');
    }
    handleLeave();
  };

  // Host moderation actions
  const handleHostMute = async (targetUserId: string) => {
    if (!meeting?.id) return;
    await participantService.hostMuteParticipant(meeting.id, targetUserId);
  };

  const handleHostRemove = async (targetUserId: string) => {
    if (!meeting?.id) return;
    if (confirm('Remove this participant from the meeting?')) {
      await participantService.hostRemoveParticipant(meeting.id, targetUserId);
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainderSec = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainderSec.toString().padStart(2, '0')}`;
  };

  const activeParticipantsList = Object.values(participants).filter((p) => p.status !== 'left');
  const screenShareUser = Object.values(participants).find((p) => p.isScreenSharing);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#111413] text-white select-none overflow-hidden animate-fade-in">
      {/* Top Header Bar */}
      <header className="h-16 px-4 sm:px-6 border-b border-neutral-800/80 bg-[#181C1B]/90 backdrop-blur-xl flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#1F5E4B] flex items-center justify-center text-white shadow-md shadow-[#1F5E4B]/30 shrink-0">
            <VideoIcon className="w-4 h-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-white tracking-tight truncate max-w-[200px] sm:max-w-md">
                {meeting?.title || 'Team Video Meeting'}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#1F5E4B]/20 text-[#2E7D5B] border border-[#1F5E4B]/30 shrink-0">
                LIVE
              </span>
            </div>

            <p className="text-[11px] text-neutral-400 font-mono truncate">
              {meeting?.teamName ? `${meeting.teamName} • ` : ''}Room ID: {meetingId}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Duration Timer */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800/60 border border-neutral-700/50 text-[11px] font-mono text-neutral-300">
            <Clock className="w-3.5 h-3.5 text-[#2E7D5B]" />
            <span>{formatDuration(durationSeconds)}</span>
          </div>

          {/* Copy Meeting Invite Link */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 transition"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#2E7D5B]" />
                <span className="text-[#2E7D5B]">Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Invite</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area (Video Grid + Optional Sidebar Drawers) */}
      <div className="flex-1 flex min-h-0 relative">
        <main className="flex-1 flex items-center justify-center min-w-0 overflow-hidden relative">
          <VideoGrid
            participants={activeParticipantsList}
            localParticipant={localParticipant}
            localStream={localStream}
            remoteStreams={remoteStreams}
            activeSpeakerId={activeSpeakerId}
            screenShareStream={screenShareStream}
            screenShareUser={screenShareUser}
            isHostOrAdmin={isHostOrAdmin}
            onHostMute={handleHostMute}
            onHostRemove={handleHostRemove}
          />
        </main>

        {/* In-Call Chat Drawer */}
        {activeDrawer === 'chat' && (
          <MeetingChat
            messages={messages}
            currentUserId={currentUser?.id || ''}
            onSendMessage={handleSendMessage}
            onClose={() => setActiveDrawer(null)}
          />
        )}

        {/* Participants Drawer */}
        {activeDrawer === 'participants' && (
          <ParticipantPanel
            participants={activeParticipantsList}
            currentUserId={currentUser?.id || ''}
            isHostOrAdmin={isHostOrAdmin}
            meetingUrl={meetingUrl}
            onMuteParticipant={handleHostMute}
            onRemoveParticipant={handleHostRemove}
            onClose={() => setActiveDrawer(null)}
          />
        )}
      </div>

      {/* Bottom Meeting Controls Dock */}
      <MeetingControls
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        isHandRaised={isHandRaised}
        unreadCount={unreadChatCount}
        participantCount={activeParticipantsList.length}
        isHostOrAdmin={isHostOrAdmin}
        activeDrawer={activeDrawer}
        audioInputs={audioInputs}
        videoInputs={videoInputs}
        audioOutputs={audioOutputs}
        selectedAudioInput={selectedAudioInput}
        selectedVideoInput={selectedVideoInput}
        selectedAudioOutput={selectedAudioOutput}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleHandRaise={handleToggleHandRaise}
        onToggleDrawer={handleToggleDrawer}
        onSelectAudioInput={handleSelectAudioInput}
        onSelectVideoInput={handleSelectVideoInput}
        onSelectAudioOutput={handleSelectAudioOutput}
        onLeaveMeeting={handleLeave}
        onEndMeetingForAll={isHostOrAdmin ? handleEndMeetingForAll : undefined}
      />
    </div>
  );
};
