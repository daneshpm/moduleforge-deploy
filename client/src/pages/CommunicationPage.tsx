import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Hash,
  Volume2,
  Video,
  Plus,
  Search,
  Phone,
  Video as VideoIcon,
  Users,
  Send,
  Paperclip,
  Smile,
  Shield,
  Clock,
  Sparkles,
  Layers,
  ChevronRight,
  UserPlus,
  Loader2,
  X,
  MoreVertical,
  CheckCheck,
  FileText,
  Image as ImageIcon,
  Download,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
} from 'lucide-react';
import { useCommunicationStore } from '../store/useCommunicationStore';
import { useAuthStore } from '../store/useAuthStore';
import { Channel, ChannelType, DirectChat, CallSession } from '../types/communication';

export const CommunicationPage: React.FC = () => {
  const {
    channels,
    activeChannel,
    channelMessages,
    isLoadingChannels,
    isLoadingMessages,
    directChats,
    activeDirectChat,
    directMessages,
    isLoadingChats,
    loadChannels,
    selectChannel,
    createChannel,
    sendChannelMessage,
    loadDirectChats,
    selectDirectChat,
    startDirectChat,
    sendDirectMessage,
    initiateCall,
    startMeeting,
    userPresences,
    loadPresences,
  } = useCommunicationStore();

  const currentUser = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<'direct' | 'channels' | 'calls'>('direct');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [callHistory, setCallHistory] = useState<CallSession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [isNewChannelModalOpen, setIsNewChannelModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<ChannelType>('text');
  const [newChannelDesc, setNewChannelDesc] = useState('');

  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeMessages = activeDirectChat ? directMessages : channelMessages;

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior,
        block: 'end',
      });
    }
  };

  useEffect(() => {
    loadDirectChats();
    loadChannels();
    loadCallHistory();
  }, []);

  useEffect(() => {
    // Poll for active calls & presences
    const interval = setInterval(() => {
      useCommunicationStore.getState().pollActiveCalls();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeMessages.length > prevMsgCountRef.current) {
      scrollToBottom('smooth');
    }
    prevMsgCountRef.current = activeMessages.length;
  }, [activeMessages.length]);

  const loadCallHistory = async () => {
    if (!currentUser) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/calls/history?userId=${currentUser.id}`);
      const data = await res.json();
      if (res.ok && data.history) {
        setCallHistory(data.history);
      }
    } catch (_) {
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() && selectedAttachments.length === 0) return;

    if (activeDirectChat) {
      const ok = await sendDirectMessage(messageInput, selectedAttachments);
      if (ok) {
        setMessageInput('');
        setSelectedAttachments([]);
      }
    } else if (activeChannel) {
      const ok = await sendChannelMessage(messageInput, selectedAttachments);
      if (ok) {
        setMessageInput('');
        setSelectedAttachments([]);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetId = activeDirectChat?.id || activeChannel?.id;
    if (!targetId) return;

    const endpoint = activeDirectChat
      ? `/api/chats/${activeDirectChat.id}/upload`
      : `/api/channels/${activeChannel?.id}/upload`;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploadingAttachment(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.attachment) {
        setSelectedAttachments((prev) => [...prev, data.attachment]);
      }
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setIsUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    const channel = await createChannel({
      name: newChannelName,
      description: newChannelDesc,
      type: newChannelType,
      teamId: channels[0]?.teamId || undefined,
    });

    if (channel) {
      setIsNewChannelModalOpen(false);
      setNewChannelName('');
      setNewChannelDesc('');
      selectChannel(channel);
    }
  };

  const handleSearchUsers = async (query: string) => {
    setUserSearchQuery(query);
    if (!query.trim()) {
      setUserSearchResults([]);
      return;
    }

    setIsSearchingUsers(true);
    try {
      const res = await fetch(`/api/users?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok && data.users) {
        setUserSearchResults(data.users.filter((u: any) => u.id !== currentUser?.id));
      }
    } catch (_) {
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const handleStartDirectChatWithUser = async (user: any) => {
    setIsNewChatModalOpen(false);
    setUserSearchQuery('');
    setUserSearchResults([]);
    const chat = await startDirectChat(user.id);
    if (chat) {
      setActiveTab('direct');
    }
  };

  const parseAttachments = (attachments?: any): any[] => {
    if (!attachments) return [];
    if (Array.isArray(attachments)) return attachments;
    try {
      return JSON.parse(attachments);
    } catch {
      return [];
    }
  };

  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredChats = directChats.filter((c) => {
    const name = c.otherParticipant?.name || c.otherParticipant?.username || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-[#F7F8F7] text-[#202524] overflow-hidden">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* ── Left Conversation Column ───────────────────────────────────────── */}
      <aside className="w-80 md:w-96 border-r border-[#E2E6E4] bg-white flex flex-col shrink-0">
        {/* Header with Switcher Tabs */}
        <div className="p-4 border-b border-[#E2E6E4] space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-lg tracking-tight text-[#202524] flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#1F5E4B]" />
              <span>Communications</span>
            </h2>

            <button
              type="button"
              onClick={() =>
                startMeeting(`Ad-hoc Meeting by ${currentUser?.name || 'User'}`)
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1F5E4B] hover:bg-[#2E7D5B] text-white text-xs font-bold shadow-xs transition"
            >
              <VideoIcon className="w-3.5 h-3.5" />
              <span>Instant Meet</span>
            </button>
          </div>

          {/* Segmented Control with 3 Tabs */}
          <div className="grid grid-cols-3 p-1 bg-[#F7F8F7] rounded-2xl border border-[#E2E6E4] text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('direct')}
              className={`py-1.5 rounded-xl transition ${
                activeTab === 'direct'
                  ? 'bg-white text-[#1F5E4B] shadow-xs'
                  : 'text-[#6B7471] hover:text-[#202524]'
              }`}
            >
              Direct
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('channels')}
              className={`py-1.5 rounded-xl transition ${
                activeTab === 'channels'
                  ? 'bg-white text-[#1F5E4B] shadow-xs'
                  : 'text-[#6B7471] hover:text-[#202524]'
              }`}
            >
              Channels
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('calls');
                loadCallHistory();
              }}
              className={`py-1.5 rounded-xl transition ${
                activeTab === 'calls'
                  ? 'bg-white text-[#1F5E4B] shadow-xs'
                  : 'text-[#6B7471] hover:text-[#202524]'
              }`}
            >
              Call Logs
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#6B7471] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'direct'
                  ? 'Search direct messages...'
                  : activeTab === 'channels'
                  ? 'Search channels (#general)...'
                  : 'Filter call history...'
              }
              className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl pl-9 pr-3 py-2 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B]"
            />
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {activeTab === 'direct' ? (
            <>
              <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#6B7471] font-bold">
                <span>Recent Chats</span>
                <button
                  type="button"
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="flex items-center gap-1 text-[#1F5E4B] hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Chat</span>
                </button>
              </div>

              {filteredChats.length === 0 ? (
                <div className="p-8 text-center text-[#6B7471] space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#EAF3EF] text-[#1F5E4B] flex items-center justify-center mx-auto">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <p className="text-xs">No direct chats yet.</p>
                  <button
                    type="button"
                    onClick={() => setIsNewChatModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-[#1F5E4B] text-white text-xs font-bold hover:bg-[#2E7D5B] transition shadow-xs"
                  >
                    Start a conversation
                  </button>
                </div>
              ) : (
                filteredChats.map((chat) => {
                  const otherUser = chat.otherParticipant;
                  const isSelected = activeDirectChat?.id === chat.id;
                  const name = otherUser?.name || otherUser?.username || 'Team Member';
                  const isOnline = otherUser?.presence?.status === 'online';

                  return (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => selectDirectChat(chat)}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition text-left border ${
                        isSelected
                          ? 'bg-[#EAF3EF] border-[#1F5E4B]/30 shadow-xs'
                          : 'border-transparent hover:bg-[#F7F8F7]'
                      }`}
                    >
                      <div className="relative">
                        <img
                          src={
                            otherUser?.avatarUrl ||
                            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                              name
                            )}`
                          }
                          alt={name}
                          className="w-11 h-11 rounded-2xl object-cover border border-[#E2E6E4]"
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                            isOnline ? 'bg-[#2E7D5B]' : 'bg-neutral-300'
                          }`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-[#202524] truncate">
                            {name}
                          </h4>
                          {chat.lastMessage && (
                            <span className="text-[10px] text-[#6B7471] font-mono">
                              {new Date(chat.lastMessage.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#6B7471] truncate mt-0.5">
                          {chat.lastMessage?.text || 'No messages yet'}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </>
          ) : activeTab === 'channels' ? (
            <>
              <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#6B7471] font-bold">
                <span>Channels</span>
                <button
                  type="button"
                  onClick={() => setIsNewChannelModalOpen(true)}
                  className="flex items-center gap-1 text-[#1F5E4B] hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Channel</span>
                </button>
              </div>

              {filteredChannels.map((channel) => {
                const isSelected = activeChannel?.id === channel.id;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => selectChannel(channel)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl transition text-left border ${
                      isSelected
                        ? 'bg-[#EAF3EF] border-[#1F5E4B]/30 text-[#1F5E4B] font-bold shadow-xs'
                        : 'border-transparent text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {channel.type === 'voice' ? (
                        <Volume2 className="w-4 h-4 text-[#1F5E4B] shrink-0" />
                      ) : channel.type === 'video' ? (
                        <Video className="w-4 h-4 text-[#1F5E4B] shrink-0" />
                      ) : (
                        <Hash className="w-4 h-4 text-[#6B7471] shrink-0" />
                      )}
                      <span className="text-xs truncate">#{channel.name}</span>
                    </div>

                    {channel.type !== 'text' && (
                      <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase rounded bg-[#1F5E4B]/10 text-[#1F5E4B] font-bold">
                        {channel.type}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          ) : (
            /* ── Call History Logs Tab ──────────────────────────────────── */
            <div className="space-y-2">
              <div className="px-3 py-1 text-[10px] font-mono uppercase text-[#6B7471] font-bold">
                Call History
              </div>

              {isLoadingHistory ? (
                <div className="p-8 text-center text-xs text-[#6B7471]">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-[#1F5E4B]" />
                  <span>Loading history...</span>
                </div>
              ) : callHistory.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#6B7471]">
                  No call logs found.
                </div>
              ) : (
                callHistory.map((call) => {
                  const isOutgoing = call.callerId === currentUser?.id;
                  const otherUser = isOutgoing ? call.receiver : call.caller;
                  const name = otherUser?.name || otherUser?.username || 'Team Member';
                  const isMissed = call.status === 'MISSED' || call.status === 'DECLINED';

                  return (
                    <div
                      key={call.id}
                      className="p-3 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            isMissed
                              ? 'bg-red-100 text-red-600'
                              : 'bg-[#EAF3EF] text-[#1F5E4B]'
                          }`}
                        >
                          {isMissed ? (
                            <PhoneMissed className="w-4 h-4" />
                          ) : isOutgoing ? (
                            <PhoneOutgoing className="w-4 h-4" />
                          ) : (
                            <PhoneIncoming className="w-4 h-4" />
                          )}
                        </div>

                        <div>
                          <h5 className="text-xs font-bold text-[#202524]">{name}</h5>
                          <span className="text-[10px] text-[#6B7471] font-mono">
                            {new Date(call.createdAt).toLocaleDateString()} •{' '}
                            {call.status === 'CONNECTED'
                              ? `${call.duration || 0}s duration`
                              : call.status}
                          </span>
                        </div>
                      </div>

                      {otherUser?.id && (
                        <button
                          type="button"
                          onClick={() => initiateCall(otherUser.id, call.type)}
                          className="p-2 rounded-xl bg-white border border-[#E2E6E4] hover:bg-[#EAF3EF] text-[#1F5E4B] transition shadow-2xs"
                          title="Call back"
                        >
                          {call.type === 'video' ? (
                            <VideoIcon className="w-3.5 h-3.5" />
                          ) : (
                            <Phone className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── Center & Right Conversation Stream ─────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F7F8F7] relative">
        {activeDirectChat || activeChannel ? (
          <>
            {/* Conversation Header */}
            <header className="h-16 px-6 border-b border-[#E2E6E4] bg-white flex items-center justify-between shrink-0 shadow-xs z-10">
              <div className="flex items-center gap-3 min-w-0">
                {activeDirectChat ? (
                  <>
                    <div className="relative">
                      <img
                        src={
                          activeDirectChat.otherParticipant?.avatarUrl ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                            activeDirectChat.otherParticipant?.name || 'User'
                          )}`
                        }
                        alt="Avatar"
                        className="w-10 h-10 rounded-xl object-cover border border-[#E2E6E4]"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#2E7D5B] border-2 border-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#202524] truncate">
                        {activeDirectChat.otherParticipant?.name ||
                          activeDirectChat.otherParticipant?.username}
                      </h3>
                      <p className="text-[10px] text-[#6B7471] font-mono">
                        Direct Message • Encrypted Transport
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-[#EAF3EF] text-[#1F5E4B] flex items-center justify-center font-bold">
                      <Hash className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#202524] truncate">
                        #{activeChannel?.name}
                      </h3>
                      <p className="text-[10px] text-[#6B7471]">
                        {activeChannel?.description || 'Team Channel'}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Header Action Calling Buttons */}
              <div className="flex items-center gap-2">
                {activeDirectChat ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        activeDirectChat.otherParticipant?.id &&
                        initiateCall(activeDirectChat.otherParticipant.id, 'voice', activeDirectChat.id)
                      }
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#E2E6E4] hover:bg-[#EAF3EF] hover:border-[#1F5E4B]/40 text-xs font-bold text-[#202524] transition shadow-xs"
                      title="Start 1:1 Voice Call"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#1F5E4B]" />
                      <span className="hidden sm:inline">Voice Call</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        activeDirectChat.otherParticipant?.id &&
                        initiateCall(activeDirectChat.otherParticipant.id, 'video', activeDirectChat.id)
                      }
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#2E7D5B] text-xs font-bold text-white transition shadow-sm"
                      title="Start 1:1 Video Call"
                    >
                      <VideoIcon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Video Call</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      startMeeting(`Meeting: #${activeChannel?.name}`, {
                        channelId: activeChannel?.id,
                        teamId: activeChannel?.teamId || undefined,
                      })
                    }
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#2E7D5B] text-xs font-bold text-white transition shadow-sm"
                  >
                    <VideoIcon className="w-3.5 h-3.5" />
                    <span>Start Channel Meeting</span>
                  </button>
                )}
              </div>
            </header>

            {/* Messages Feed */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4">
              {activeMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#6B7471] space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-[#E2E6E4] flex items-center justify-center text-[#1F5E4B] shadow-sm">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-[#202524]">
                    Start of this conversation
                  </h4>
                  <p className="text-xs max-w-sm">
                    Send messages, attachments, code snippets, and initiate real-time HD audio/video calls anytime.
                  </p>
                </div>
              ) : (
                activeMessages.map((msg) => {
                  const isMe = msg.senderId === currentUser?.id;
                  const senderName = msg.sender?.name || msg.sender?.username || 'Member';
                  const attachments = parseAttachments(msg.attachments);

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 max-w-xl ${isMe ? 'ml-auto flex-row-reverse' : ''}`}
                    >
                      <img
                        src={
                          msg.sender?.avatarUrl ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                            senderName
                          )}`
                        }
                        alt={senderName}
                        className="w-9 h-9 rounded-xl object-cover shrink-0 border border-[#E2E6E4] mt-0.5"
                      />

                      <div className={`space-y-1 ${isMe ? 'items-end' : ''}`}>
                        <div
                          className={`flex items-center gap-2 text-[11px] ${
                            isMe ? 'justify-end' : ''
                          }`}
                        >
                          <span className="font-bold text-[#202524]">{senderName}</span>
                          <span className="text-[10px] text-[#6B7471] font-mono">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <div
                          className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                            isMe
                              ? 'bg-[#1F5E4B] text-white rounded-tr-none'
                              : 'bg-white text-[#202524] border border-[#E2E6E4] rounded-tl-none'
                          }`}
                        >
                          {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}

                          {/* Attachments rendering */}
                          {attachments.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {attachments.map((att: any, idx: number) => {
                                if (att.type === 'image') {
                                  return (
                                    <div key={idx} className="rounded-xl overflow-hidden border border-white/20">
                                      <img
                                        src={att.url}
                                        alt={att.name}
                                        className="max-h-60 rounded-xl object-cover"
                                      />
                                    </div>
                                  );
                                }
                                return (
                                  <a
                                    key={idx}
                                    href={att.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`flex items-center gap-2 p-2 rounded-xl text-xs transition ${
                                      isMe ? 'bg-black/20 text-white' : 'bg-[#F7F8F7] text-[#202524]'
                                    }`}
                                  >
                                    <FileText className="w-4 h-4" />
                                    <span className="truncate max-w-[200px]">{att.name}</span>
                                    <Download className="w-3.5 h-3.5 ml-auto opacity-70" />
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected Attachments Preview */}
            {selectedAttachments.length > 0 && (
              <div className="px-4 py-2 bg-[#F7F8F7] border-t border-[#E2E6E4] flex items-center gap-2 flex-wrap">
                {selectedAttachments.map((att, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#E2E6E4] rounded-xl text-xs"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-[#1F5E4B]" />
                    <span className="truncate max-w-[150px]">{att.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedAttachments((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="text-[#6B7471] hover:text-red-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input Bar */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 bg-white border-t border-[#E2E6E4] flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAttachment}
                className="p-2.5 rounded-xl text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7] transition"
                title="Attach file (Images, documents, code)"
              >
                {isUploadingAttachment ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#1F5E4B]" />
                ) : (
                  <Paperclip className="w-4 h-4" />
                )}
              </button>

              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={
                  activeDirectChat
                    ? `Message ${activeDirectChat.otherParticipant?.name || 'User'}...`
                    : `Message #${activeChannel?.name}...`
                }
                className="flex-1 bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-4 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:bg-white transition"
              />

              <button
                type="submit"
                disabled={!messageInput.trim() && selectedAttachments.length === 0}
                className="p-2.5 rounded-xl bg-[#1F5E4B] hover:bg-[#2E7D5B] text-white transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#6B7471] space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-[#EAF3EF] text-[#1F5E4B] flex items-center justify-center shadow-sm">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#202524]">Select a conversation</h3>
              <p className="text-xs max-w-sm mt-1">
                Choose a direct chat or a team channel on the left to start messaging and calling.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ── New Direct Chat Modal ───────────────────────────────────────────── */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white border border-[#E2E6E4] p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#202524] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#1F5E4B]" />
                <span>Start a Direct Chat</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewChatModalOpen(false)}
                className="p-1.5 rounded-lg text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#6B7471] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => handleSearchUsers(e.target.value)}
                placeholder="Search by username or name..."
                className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B]"
                autoFocus
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1">
              {isSearchingUsers ? (
                <div className="p-4 text-center text-xs text-[#6B7471]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#1F5E4B] mx-auto mb-1" />
                  <span>Searching users...</span>
                </div>
              ) : userSearchResults.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#6B7471]">
                  {userSearchQuery ? 'No users found matching query' : 'Type to search for team members'}
                </div>
              ) : (
                userSearchResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleStartDirectChatWithUser(u)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#EAF3EF] transition text-left border border-transparent hover:border-[#1F5E4B]/20"
                  >
                    <img
                      src={
                        u.avatarUrl ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                          u.name || u.username
                        )}`
                      }
                      alt={u.name}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-bold text-[#202524] truncate">{u.name || u.username}</h5>
                      <span className="text-[10px] text-[#6B7471] font-mono">@{u.username}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#1F5E4B]" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── New Channel Modal ──────────────────────────────────────────────── */}
      {isNewChannelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleCreateChannel}
            className="w-full max-w-md rounded-3xl bg-white border border-[#E2E6E4] p-6 shadow-2xl space-y-4 animate-scale-up"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#202524] flex items-center gap-2">
                <Hash className="w-5 h-5 text-[#1F5E4B]" />
                <span>Create New Channel</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewChannelModalOpen(false)}
                className="p-1.5 rounded-lg text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold font-mono uppercase text-[#6B7471]">
                Channel Name
              </label>
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="e.g. backend-sprint"
                required
                className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3 py-2.5 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold font-mono uppercase text-[#6B7471]">
                Channel Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['text', 'voice', 'video'] as ChannelType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewChannelType(type)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold capitalize transition flex flex-col items-center gap-1 ${
                      newChannelType === type
                        ? 'bg-[#EAF3EF] border-[#1F5E4B] text-[#1F5E4B]'
                        : 'border-[#E2E6E4] text-[#6B7471] hover:bg-[#F7F8F7]'
                    }`}
                  >
                    {type === 'text' && <Hash className="w-4 h-4" />}
                    {type === 'voice' && <Volume2 className="w-4 h-4" />}
                    {type === 'video' && <Video className="w-4 h-4" />}
                    <span>{type}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold font-mono uppercase text-[#6B7471]">
                Description (Optional)
              </label>
              <input
                type="text"
                value={newChannelDesc}
                onChange={(e) => setNewChannelDesc(e.target.value)}
                placeholder="Topic or purpose of this channel"
                className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3 py-2.5 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewChannelModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6B7471] hover:bg-[#F7F8F7]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#2E7D5B] text-white text-xs font-bold transition shadow-xs"
              >
                Create Channel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
