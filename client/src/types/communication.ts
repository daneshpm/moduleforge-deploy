export type ChannelType = 'text' | 'voice' | 'video';

export interface Channel {
  id: string;
  name: string;
  description?: string | null;
  type: ChannelType;
  isPrivate: boolean;
  teamId?: string | null;
  projectId?: string | null;
  createdById?: string | null;
  creator?: {
    id: string;
    name?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    messages: number;
  };
}

export interface Attachment {
  name: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'file';
  size?: number;
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  senderId: string;
  sender: {
    id: string;
    name?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  };
  text: string;
  attachments?: string | Attachment[];
  pinned?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface DirectChat {
  id: string;
  createdAt: string;
  updatedAt: string;
  otherParticipant: {
    id: string;
    name?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
    presence?: UserPresence | null;
  } | null;
  lastMessage?: {
    id: string;
    text: string;
    createdAt: string;
    sender: {
      id: string;
      name?: string | null;
      username?: string | null;
    };
  } | null;
}

export interface DirectMessage {
  id: string;
  chatId: string;
  senderId: string;
  sender: {
    id: string;
    name?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  };
  text: string;
  attachments?: string | Attachment[];
  read: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type CallStatus = 'CALLING' | 'RINGING' | 'CONNECTED' | 'ENDED' | 'DECLINED' | 'MISSED';
export type CallType = 'voice' | 'video';

export interface CallSession {
  id: string;
  type: CallType;
  callerId: string;
  caller: {
    id: string;
    name?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  };
  receiverId?: string | null;
  receiver?: {
    id: string;
    name?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  } | null;
  chatId?: string | null;
  roomId: string;
  status: CallStatus;
  startedAt?: string | null;
  endedAt?: string | null;
  duration?: number;
  createdAt: string;
  updatedAt?: string;
}

export type MeetingStatus = 'CREATED' | 'ACTIVE' | 'ENDED';

export interface Meeting {
  id: string;
  title: string;
  roomId: string;
  status: MeetingStatus;
  teamId?: string | null;
  team?: { id: string; name: string } | null;
  projectId?: string | null;
  project?: { id: string; name: string } | null;
  channelId?: string | null;
  channel?: { id: string; name: string } | null;
  createdById: string;
  createdBy: {
    id: string;
    name?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  };
  isScreenSharing?: boolean;
  screenShareUserId?: string | null;
  startedAt: string;
  endedAt?: string | null;
  createdAt: string;
  participants?: MeetingParticipant[];
  _count?: {
    participants: number;
  };
}

export interface MeetingParticipant {
  id: string;
  meetingId: string;
  userId: string;
  user: {
    id: string;
    name?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  };
  role: 'host' | 'co-host' | 'participant';
  isMuted: boolean;
  isVideoOff: boolean;
  isHandRaised: boolean;
  joinedAt: string;
  leftAt?: string | null;
}

export interface MeetingMessage {
  id: string;
  meetingId: string;
  senderId: string;
  sender: {
    id: string;
    name?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  };
  text: string;
  createdAt: string;
}

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';
export type CurrentActivity = 'voice_call' | 'video_call' | 'meeting' | 'sharing_screen' | 'idle';

export interface UserPresence {
  id?: string;
  userId: string;
  status: PresenceStatus;
  customStatus?: string | null;
  currentActivity?: CurrentActivity | null;
  lastSeen: string;
}
