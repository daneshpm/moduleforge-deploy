import { create } from 'zustand';
import {
  Channel,
  ChannelMessage,
  ChannelType,
  DirectChat,
  DirectMessage,
  CallSession,
  CallType,
  Meeting,
  MeetingMessage,
  MeetingParticipant,
  UserPresence,
  PresenceStatus,
  CurrentActivity,
} from '../types/communication';
import { mediaService } from '../services/mediaService';
import { useAuthStore } from './useAuthStore';

const API_BASE = '/api';

interface CommunicationState {
  // Channels
  channels: Channel[];
  activeChannel: Channel | null;
  channelMessages: ChannelMessage[];
  isLoadingChannels: boolean;
  isLoadingMessages: boolean;

  // Direct Chats
  directChats: DirectChat[];
  activeDirectChat: DirectChat | null;
  directMessages: DirectMessage[];
  isLoadingChats: boolean;

  // 1:1 Calls
  activeCall: CallSession | null;
  callToken: string | null;
  incomingCall: CallSession | null;
  callDuration: number;
  isCallMuted: boolean;
  isCallVideoOff: boolean;
  isCallScreenSharing: boolean;
  callError: string | null;

  // Meetings
  activeMeetings: Meeting[];
  currentMeeting: Meeting | null;
  meetingToken: string | null;
  meetingMessages: MeetingMessage[];
  isMeetingMuted: boolean;
  isMeetingVideoOff: boolean;
  isMeetingScreenSharing: boolean;
  isHandRaised: boolean;
  meetingError: string | null;

  // Presence
  userPresences: Record<string, UserPresence>;
  myPresence: UserPresence | null;

  // Channel Actions
  loadChannels: (teamId?: string, projectId?: string) => Promise<void>;
  selectChannel: (channel: Channel) => Promise<void>;
  createChannel: (data: { name: string; description?: string; type?: ChannelType; teamId?: string; projectId?: string; isPrivate?: boolean }) => Promise<Channel | null>;
  sendChannelMessage: (text: string, attachments?: any[]) => Promise<boolean>;
  deleteChannelMessage: (messageId: string) => Promise<void>;

  // Direct Chat Actions
  loadDirectChats: () => Promise<void>;
  selectDirectChat: (chat: DirectChat) => Promise<void>;
  startDirectChat: (recipientId: string) => Promise<DirectChat | null>;
  sendDirectMessage: (text: string, attachments?: any[]) => Promise<boolean>;

  // Call Actions
  initiateCall: (recipientId: string, type: CallType, chatId?: string) => Promise<boolean>;
  acceptCall: (call: CallSession) => Promise<boolean>;
  declineCall: (callId: string) => Promise<void>;
  endCall: () => Promise<void>;
  toggleCallMute: () => Promise<void>;
  toggleCallVideo: () => Promise<void>;
  toggleCallScreenShare: () => Promise<void>;
  pollActiveCalls: () => Promise<void>;

  // Meeting Actions
  loadActiveMeetings: () => Promise<void>;
  startMeeting: (title: string, options?: { teamId?: string; projectId?: string; channelId?: string }) => Promise<Meeting | null>;
  joinMeeting: (meetingId: string) => Promise<boolean>;
  leaveMeeting: () => Promise<void>;
  toggleMeetingMute: () => Promise<void>;
  toggleMeetingVideo: () => Promise<void>;
  toggleMeetingScreenShare: () => Promise<void>;
  toggleMeetingHandRaise: () => Promise<void>;
  sendMeetingMessage: (text: string) => Promise<boolean>;

  // Presence Actions
  updatePresence: (status: PresenceStatus, customStatus?: string, activity?: CurrentActivity) => Promise<void>;
  loadPresences: (userIds?: string[]) => Promise<void>;
}

let callTimerInterval: any = null;

export const useCommunicationStore = create<CommunicationState>((set, get) => ({
  channels: [],
  activeChannel: null,
  channelMessages: [],
  isLoadingChannels: false,
  isLoadingMessages: false,

  directChats: [],
  activeDirectChat: null,
  directMessages: [],
  isLoadingChats: false,

  activeCall: null,
  callToken: null,
  incomingCall: null,
  callDuration: 0,
  isCallMuted: false,
  isCallVideoOff: false,
  isCallScreenSharing: false,
  callError: null,

  activeMeetings: [],
  currentMeeting: null,
  meetingToken: null,
  meetingMessages: [],
  isMeetingMuted: false,
  isMeetingVideoOff: false,
  isMeetingScreenSharing: false,
  isHandRaised: false,
  meetingError: null,

  userPresences: {},
  myPresence: null,

  // ── Channels ─────────────────────────────────────────────────────────────
  loadChannels: async (teamId, projectId) => {
    set({ isLoadingChannels: true });
    try {
      const query = new URLSearchParams();
      if (teamId) query.set('teamId', teamId);
      if (projectId) query.set('projectId', projectId);

      const res = await fetch(`${API_BASE}/channels?${query.toString()}`);
      const data = await res.json();
      if (res.ok && data.channels) {
        set({ channels: data.channels, isLoadingChannels: false });
        // Auto-select first channel if none active
        if (!get().activeChannel && data.channels.length > 0) {
          get().selectChannel(data.channels[0]);
        }
      } else {
        set({ isLoadingChannels: false });
      }
    } catch (err) {
      console.warn('Failed to load channels:', err);
      set({ isLoadingChannels: false });
    }
  },

  selectChannel: async (channel) => {
    set({ activeChannel: channel, activeDirectChat: null, isLoadingMessages: true });
    try {
      const res = await fetch(`${API_BASE}/channels/${channel.id}/messages`);
      const data = await res.json();
      if (res.ok && data.messages) {
        set({ channelMessages: data.messages, isLoadingMessages: false });
      } else {
        set({ channelMessages: [], isLoadingMessages: false });
      }
    } catch (err) {
      set({ channelMessages: [], isLoadingMessages: false });
    }
  },

  createChannel: async (data) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return null;

    try {
      const res = await fetch(`${API_BASE}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          createdById: currentUser.id,
        }),
      });
      const result = await res.json();
      if (res.ok && result.channel) {
        set((state) => ({
          channels: [...state.channels, result.channel],
          activeChannel: result.channel,
          channelMessages: [],
        }));
        return result.channel;
      }
    } catch (err) {
      console.error('Failed to create channel:', err);
    }
    return null;
  },

  sendChannelMessage: async (text, attachments = []) => {
    const { activeChannel } = get();
    const currentUser = useAuthStore.getState().user;
    if (!activeChannel || !currentUser || (!text.trim() && attachments.length === 0)) return false;

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChannelMessage = {
      id: tempId,
      channelId: activeChannel.id,
      senderId: currentUser.id,
      sender: {
        id: currentUser.id,
        name: currentUser.name,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl,
      },
      text,
      attachments,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      channelMessages: [...state.channelMessages, optimisticMsg],
    }));

    try {
      const res = await fetch(`${API_BASE}/channels/${activeChannel.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          text,
          attachments,
        }),
      });

      const data = await res.json();
      if (res.ok && data.message) {
        set((state) => ({
          channelMessages: state.channelMessages.map((m) => (m.id === tempId ? data.message : m)),
        }));
        return true;
      }
    } catch (err) {
      console.error('Failed to send channel message:', err);
    }
    return false;
  },

  deleteChannelMessage: async (messageId) => {
    const { activeChannel } = get();
    if (!activeChannel) return;

    set((state) => ({
      channelMessages: state.channelMessages.filter((m) => m.id !== messageId),
    }));

    try {
      await fetch(`${API_BASE}/channels/${activeChannel.id}/messages/${messageId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('Failed to delete channel message:', err);
    }
  },

  // ── Direct Chats ─────────────────────────────────────────────────────────
  loadDirectChats: async () => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    set({ isLoadingChats: true });
    try {
      const res = await fetch(`${API_BASE}/chats?userId=${currentUser.id}`);
      const data = await res.json();
      if (res.ok && data.chats) {
        set({ directChats: data.chats, isLoadingChats: false });
      } else {
        set({ isLoadingChats: false });
      }
    } catch (err) {
      set({ isLoadingChats: false });
    }
  },

  selectDirectChat: async (chat) => {
    set({ activeDirectChat: chat, activeChannel: null, isLoadingMessages: true });
    try {
      const res = await fetch(`${API_BASE}/chats/${chat.id}/messages`);
      const data = await res.json();
      if (res.ok && data.messages) {
        set({ directMessages: data.messages, isLoadingMessages: false });
      } else {
        set({ directMessages: [], isLoadingMessages: false });
      }
    } catch (err) {
      set({ directMessages: [], isLoadingMessages: false });
    }
  },

  startDirectChat: async (recipientId) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return null;

    try {
      const res = await fetch(`${API_BASE}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, recipientId }),
      });
      const data = await res.json();
      if (res.ok && data.chat) {
        const chat = data.chat;
        set((state) => {
          const exists = state.directChats.some((c) => c.id === chat.id);
          return {
            directChats: exists ? state.directChats : [chat, ...state.directChats],
            activeDirectChat: chat,
            activeChannel: null,
          };
        });
        get().selectDirectChat(chat);
        return chat;
      }
    } catch (err) {
      console.error('Failed to start direct chat:', err);
    }
    return null;
  },

  sendDirectMessage: async (text, attachments = []) => {
    const { activeDirectChat } = get();
    const currentUser = useAuthStore.getState().user;
    if (!activeDirectChat || !currentUser || (!text.trim() && attachments.length === 0)) return false;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: DirectMessage = {
      id: tempId,
      chatId: activeDirectChat.id,
      senderId: currentUser.id,
      sender: {
        id: currentUser.id,
        name: currentUser.name,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl,
      },
      text,
      attachments,
      read: false,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      directMessages: [...state.directMessages, optimisticMsg],
    }));

    try {
      const res = await fetch(`${API_BASE}/chats/${activeDirectChat.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          text,
          attachments,
        }),
      });

      const data = await res.json();
      if (res.ok && data.message) {
        set((state) => ({
          directMessages: state.directMessages.map((m) => (m.id === tempId ? data.message : m)),
        }));
        get().loadDirectChats();
        return true;
      }
    } catch (err) {
      console.error('Failed to send direct message:', err);
    }
    return false;
  },

  // ── 1:1 Calling ──────────────────────────────────────────────────────────
  initiateCall: async (recipientId, type, chatId) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return false;

    set({ callError: null, callDuration: 0 });

    try {
      // Request local media stream safely
      const stream = await mediaService.getLocalMedia({ video: type === 'video', audio: true });
      if (!stream) {
        set({ callError: 'Camera/Mic access required to initiate call.' });
        return false;
      }

      const res = await fetch(`${API_BASE}/calls/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerId: currentUser.id,
          receiverId: recipientId,
          type,
          chatId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.call) {
        set({
          activeCall: data.call,
          callToken: data.token,
          isCallMuted: false,
          isCallVideoOff: type !== 'video',
          isCallScreenSharing: false,
        });

        // Start call duration timer
        if (callTimerInterval) clearInterval(callTimerInterval);
        callTimerInterval = setInterval(() => {
          set((state) => ({ callDuration: state.callDuration + 1 }));
        }, 1000);

        // Update presence
        get().updatePresence('busy', undefined, type === 'video' ? 'video_call' : 'voice_call');

        // Connect to LiveKit SFU if serverUrl is present
        if (data.serverUrl && data.token) {
          try {
            await mediaService.joinLiveKitRoom({
              serverUrl: data.serverUrl,
              token: data.token,
              videoEnabled: type === 'video',
              audioEnabled: true,
            });
          } catch (lkErr) {
            console.warn('LiveKit SFU connection fallback to direct stream:', lkErr);
          }
        }

        return true;
      } else {
        mediaService.cleanup();
        set({ callError: data.error || 'Failed to initiate call' });
        return false;
      }
    } catch (err: any) {
      mediaService.cleanup();
      set({ callError: err.message || 'Call failed' });
      return false;
    }
  },

  acceptCall: async (call) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return false;

    set({ incomingCall: null, callError: null, callDuration: 0 });

    try {
      const stream = await mediaService.getLocalMedia({ video: call.type === 'video', audio: true });
      if (!stream) {
        set({ callError: 'Permission denied: Camera/Mic required' });
        return false;
      }

      // Update call status to CONNECTED
      await fetch(`${API_BASE}/calls/${call.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CONNECTED' }),
      });

      // Get receiver's token
      const tokenRes = await fetch(`${API_BASE}/calls/${call.id}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const tokenData = await tokenRes.json();

      set({
        activeCall: { ...call, status: 'CONNECTED' },
        callToken: tokenData.token,
        isCallMuted: false,
        isCallVideoOff: call.type !== 'video',
        isCallScreenSharing: false,
      });

      if (callTimerInterval) clearInterval(callTimerInterval);
      callTimerInterval = setInterval(() => {
        set((state) => ({ callDuration: state.callDuration + 1 }));
      }, 1000);

      get().updatePresence('busy', undefined, call.type === 'video' ? 'video_call' : 'voice_call');

      if (tokenData.serverUrl && tokenData.token) {
        try {
          await mediaService.joinLiveKitRoom({
            serverUrl: tokenData.serverUrl,
            token: tokenData.token,
            videoEnabled: call.type === 'video',
            audioEnabled: true,
          });
        } catch (lkErr) {
          console.warn('LiveKit SFU connection fallback to direct stream:', lkErr);
        }
      }

      return true;
    } catch (err: any) {
      mediaService.cleanup();
      set({ callError: err.message || 'Failed to accept call' });
      return false;
    }
  },

  declineCall: async (callId) => {
    set({ incomingCall: null });
    try {
      await fetch(`${API_BASE}/calls/${callId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DECLINED' }),
      });
    } catch (_) {}
  },

  endCall: async () => {
    const { activeCall, callDuration } = get();
    if (callTimerInterval) {
      clearInterval(callTimerInterval);
      callTimerInterval = null;
    }

    mediaService.cleanup();

    if (activeCall) {
      try {
        await fetch(`${API_BASE}/calls/${activeCall.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ENDED', duration: callDuration }),
        });
      } catch (_) {}
    }

    set({
      activeCall: null,
      callToken: null,
      callDuration: 0,
      isCallScreenSharing: false,
      callError: null,
    });

    get().updatePresence('online', undefined, 'idle');
  },

  toggleCallMute: async () => {
    const next = !get().isCallMuted;
    await mediaService.setMicrophoneEnabled(!next);
    set({ isCallMuted: next });
  },

  toggleCallVideo: async () => {
    const next = !get().isCallVideoOff;
    await mediaService.setCameraEnabled(!next);
    set({ isCallVideoOff: next });
  },

  toggleCallScreenShare: async () => {
    const current = get().isCallScreenSharing;
    const success = await mediaService.setScreenShareEnabled(!current);
    set({ isCallScreenSharing: success });
  },

  pollActiveCalls: async () => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    try {
      const res = await fetch(`${API_BASE}/calls/active?userId=${currentUser.id}`);
      const data = await res.json();
      if (res.ok && data.activeCall) {
        const call: CallSession = data.activeCall;
        if (call.receiverId === currentUser.id && ['CALLING', 'RINGING'].includes(call.status)) {
          if (!get().activeCall && get().incomingCall?.id !== call.id) {
            set({ incomingCall: call });
          }
        } else if (call.status === 'ENDED' || call.status === 'DECLINED' || call.status === 'MISSED') {
          if (get().activeCall?.id === call.id) {
            get().endCall();
          }
          if (get().incomingCall?.id === call.id) {
            set({ incomingCall: null });
          }
        }
      }
    } catch (_) {}
  },

  // ── Group Meetings ───────────────────────────────────────────────────────
  loadActiveMeetings: async () => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    try {
      const res = await fetch(`${API_BASE}/meetings/active?userId=${currentUser.id}`);
      const data = await res.json();
      if (res.ok && data.meetings) {
        set({ activeMeetings: data.meetings });
      }
    } catch (_) {}
  },

  startMeeting: async (title, options = {}) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return null;

    set({ meetingError: null });

    try {
      await mediaService.getLocalMedia({ video: true, audio: true }).catch(() => {});

      const res = await fetch(`${API_BASE}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          createdById: currentUser.id,
          teamId: options.teamId,
          projectId: options.projectId,
          channelId: options.channelId,
          appUrl: window.location.origin,
        }),
      });

      const data = await res.json();
      if (res.ok && data.meeting) {
        set({
          currentMeeting: data.meeting,
          meetingToken: data.token,
          meetingMessages: [],
          isMeetingMuted: false,
          isMeetingVideoOff: false,
          isMeetingScreenSharing: false,
          isHandRaised: false,
        });

        get().updatePresence('busy', undefined, 'meeting');

        if (data.serverUrl && data.token) {
          try {
            await mediaService.joinLiveKitRoom({
              serverUrl: data.serverUrl,
              token: data.token,
              videoEnabled: true,
              audioEnabled: true,
            });
          } catch (lkErr) {
            console.warn('LiveKit SFU connection fallback:', lkErr);
          }
        }

        get().loadActiveMeetings();
        return data.meeting;
      } else {
        mediaService.cleanup();
        set({ meetingError: data.error || 'Failed to start meeting' });
        return null;
      }
    } catch (err: any) {
      mediaService.cleanup();
      set({ meetingError: err.message || 'Failed to start meeting' });
      return null;
    }
  },

  joinMeeting: async (meetingId) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return false;

    set({ meetingError: null });

    try {
      await mediaService.getLocalMedia({ video: true, audio: true }).catch(() => {});

      const res = await fetch(`${API_BASE}/meetings/${meetingId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });

      const data = await res.json();
      if (res.ok && data.meeting) {
        set({
          currentMeeting: data.meeting,
          meetingToken: data.token,
          meetingMessages: [],
          isMeetingMuted: false,
          isMeetingVideoOff: false,
          isMeetingScreenSharing: false,
          isHandRaised: false,
        });

        get().updatePresence('busy', undefined, 'meeting');

        if (data.serverUrl && data.token) {
          try {
            await mediaService.joinLiveKitRoom({
              serverUrl: data.serverUrl,
              token: data.token,
              videoEnabled: true,
              audioEnabled: true,
            });
          } catch (lkErr) {
            console.warn('LiveKit SFU connection fallback:', lkErr);
          }
        }

        return true;
      } else {
        mediaService.cleanup();
        set({ meetingError: data.error || 'Failed to join meeting' });
        return false;
      }
    } catch (err: any) {
      mediaService.cleanup();
      set({ meetingError: err.message || 'Failed to join meeting' });
      return false;
    }
  },

  leaveMeeting: async () => {
    const { currentMeeting } = get();
    const currentUser = useAuthStore.getState().user;

    mediaService.cleanup();

    if (currentMeeting && currentUser) {
      try {
        await fetch(`${API_BASE}/meetings/${currentMeeting.id}/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id }),
        });
      } catch (_) {}
    }

    set({
      currentMeeting: null,
      meetingToken: null,
      meetingMessages: [],
      isMeetingScreenSharing: false,
      meetingError: null,
    });

    get().updatePresence('online', undefined, 'idle');
    get().loadActiveMeetings();
  },

  toggleMeetingMute: async () => {
    const next = !get().isMeetingMuted;
    await mediaService.setMicrophoneEnabled(!next);
    set({ isMeetingMuted: next });
  },

  toggleMeetingVideo: async () => {
    const next = !get().isMeetingVideoOff;
    await mediaService.setCameraEnabled(!next);
    set({ isMeetingVideoOff: next });
  },

  toggleMeetingScreenShare: async () => {
    const current = get().isMeetingScreenSharing;
    const success = await mediaService.setScreenShareEnabled(!current);
    set({ isMeetingScreenSharing: success });
  },

  toggleMeetingHandRaise: async () => {
    set((state) => ({ isHandRaised: !state.isHandRaised }));
  },

  sendMeetingMessage: async (text) => {
    const { currentMeeting } = get();
    const currentUser = useAuthStore.getState().user;
    if (!currentMeeting || !currentUser || !text.trim()) return false;

    try {
      const res = await fetch(`${API_BASE}/meetings/${currentMeeting.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          text,
        }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        set((state) => ({
          meetingMessages: [...state.meetingMessages, data.message],
        }));
        return true;
      }
    } catch (_) {}
    return false;
  },

  // ── Presence ─────────────────────────────────────────────────────────────
  updatePresence: async (status, customStatus, activity) => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return;

    try {
      const res = await fetch(`${API_BASE}/presence/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          status,
          customStatus,
          currentActivity: activity,
        }),
      });
      const data = await res.json();
      if (res.ok && data.presence) {
        set({ myPresence: data.presence });
      }
    } catch (_) {}
  },

  loadPresences: async (userIds) => {
    try {
      const query = userIds && userIds.length > 0 ? `?userIds=${userIds.join(',')}` : '';
      const res = await fetch(`${API_BASE}/presence${query}`);
      const data = await res.json();
      if (res.ok && data.presence) {
        const presencesMap: Record<string, UserPresence> = {};
        for (const p of data.presence) {
          presencesMap[p.userId] = p;
        }
        set({ userPresences: presencesMap });
      }
    } catch (_) {}
  },
}));
