export type MeetingStatus = 'scheduled' | 'active' | 'ended';

export type ParticipantRole = 'owner' | 'admin' | 'member' | 'host' | 'co-host';

export type ParticipantPresenceStatus = 'invited' | 'joined' | 'connected' | 'disconnected' | 'left';

export interface TeamMemberInfo {
  uid: string;
  email: string;
  displayName?: string;
  username?: string;
  photoURL?: string;
  role: 'owner' | 'admin' | 'member';
  status?: string;
}

export interface MeetingParticipant {
  uid: string;
  name: string;
  email: string;
  username?: string;
  avatarUrl?: string;
  role: ParticipantRole;
  status: ParticipantPresenceStatus;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  joinedAt?: string | number;
  leftAt?: string | number | null;
  lastActive?: string | number;
}

export interface Meeting {
  id: string;
  meetingId: string;
  teamId: string;
  teamName?: string;
  title: string;
  createdBy: string;
  creatorName?: string;
  creatorEmail?: string;
  creatorAvatar?: string;
  status: MeetingStatus;
  scheduledFor?: string | number | null;
  createdAt: string | number;
  startedAt?: string | number;
  endedAt?: string | number | null;
  participants: Record<string, MeetingParticipant>;
  activeSpeakerId?: string | null;
  screenShareUserId?: string | null;
  settings?: {
    allowScreenShare?: boolean;
    allowChat?: boolean;
    muteOnEntry?: boolean;
  };
}

export interface MeetingMessage {
  id: string;
  meetingId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  createdAt: string | number;
}

export interface WebRTCSignal {
  id?: string;
  senderId: string;
  receiverId: string;
  type: 'offer' | 'answer';
  sdp: string;
  timestamp: number;
}

export interface IceCandidatePayload {
  id?: string;
  senderId: string;
  receiverId: string;
  candidate: RTCIceCandidateInit;
  timestamp: number;
}

export interface MediaDeviceItem {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput' | 'videoinput';
}

export interface MediaDevicePreferences {
  audioInputId?: string;
  audioOutputId?: string;
  videoInputId?: string;
  isMicMuted: boolean;
  isVideoMuted: boolean;
}

export interface TeamMeetingInvitation {
  meetingId: string;
  teamId: string;
  teamName: string;
  title: string;
  hostName: string;
  meetingUrl: string;
  invitedEmails: string[];
}
