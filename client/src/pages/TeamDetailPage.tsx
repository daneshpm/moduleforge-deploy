import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Crown,
  ShieldCheck,
  Shield,
  User,
  Trash2,
  Settings,
  FolderGit2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Mail,
  Loader2,
  ArrowLeft,
  Plus,
  Sparkles,
  ExternalLink,
  ChevronDown,
  X,
  LogOut,
  Video,
  MessageSquare,
  Phone,
  Hash,
  Volume2,
  Send,
  Paperclip,
  FileText,
  Download,
} from 'lucide-react';
import { useTeamStore } from '../store/useTeamStore';
import { useAuthStore } from '../store/useAuthStore';
import { useProjectStore } from '../store/useProjectStore';
import { useCommunicationStore } from '../store/useCommunicationStore';
import { InviteMemberModal } from '../components/InviteMemberModal';
import { Channel, ChannelType } from '../types/communication';

export const TeamDetailPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createProject } = useProjectStore();
  const {
    activeTeam,
    fetchTeamDetails,
    updateTeam,
    deleteTeam,
    removeMember,
    cancelInvitation,
    isLoading,
  } = useTeamStore();

  const {
    initiateCall,
    startMeeting,
    startDirectChat,
  } = useCommunicationStore();

  const [activeTab, setActiveTab] = useState<'chat' | 'members' | 'invitations' | 'projects' | 'settings'>('chat');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Settings tab form state
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Quick Create Team Project Modal
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  // ── Team Embedded Chat State ──────────────────────────────────────────────
  const [teamChannels, setTeamChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [teamMessages, setTeamMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isNewChannelModalOpen, setIsNewChannelModalOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<ChannelType>('text');
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior,
      });
    }
  };

  useEffect(() => {
    if (teamId) {
      fetchTeamDetails(teamId);
      loadTeamChannels();
    }
  }, [teamId]);

  useEffect(() => {
    if (activeTeam) {
      setNameInput(activeTeam.name);
      setDescInput(activeTeam.description || '');
    }
  }, [activeTeam]);

  useEffect(() => {
    if (selectedChannel) {
      loadChannelMessages(selectedChannel.id);
      const interval = setInterval(() => {
        loadChannelMessages(selectedChannel.id, true);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedChannel]);

  useEffect(() => {
    if (teamMessages.length > prevMsgCountRef.current) {
      scrollToBottom('smooth');
    }
    prevMsgCountRef.current = teamMessages.length;
  }, [teamMessages.length]);

  const loadTeamChannels = async () => {
    if (!teamId) return;
    try {
      const res = await fetch(`/api/channels?teamId=${teamId}`);
      const data = await res.json();
      if (res.ok && data.channels) {
        setTeamChannels(data.channels);
        if (data.channels.length > 0 && !selectedChannel) {
          setSelectedChannel(data.channels[0]);
        }
      }
    } catch (e) {
      console.error('Error loading team channels:', e);
    }
  };

  const loadChannelMessages = async (channelId: string, silent = false) => {
    if (!silent) setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/channels/${channelId}/messages`);
      const data = await res.json();
      if (res.ok && data.messages) {
        setTeamMessages(data.messages);
      }
    } catch (e) {
      console.error('Error loading channel messages:', e);
    } finally {
      if (!silent) setIsLoadingMessages(false);
    }
  };

  const handleSendTeamMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel || !user) return;
    if (!messageInput.trim() && attachments.length === 0) return;

    try {
      const res = await fetch(`/api/channels/${selectedChannel.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user.id,
          text: messageInput.trim(),
          attachments,
        }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setTeamMessages((prev) => [...prev, data.message]);
        setMessageInput('');
        setAttachments([]);
      }
    } catch (e) {
      console.error('Error sending message:', e);
    }
  };

  const handleCreateTeamChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId || !user || !newChannelName.trim()) return;

    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
          type: newChannelType,
          createdById: user.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.channel) {
        setTeamChannels((prev) => [...prev, data.channel]);
        setSelectedChannel(data.channel);
        setIsNewChannelModalOpen(false);
        setNewChannelName('');
      }
    } catch (e) {
      console.error('Error creating channel:', e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChannel) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      const res = await fetch(`/api/channels/${selectedChannel.id}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.attachment) {
        setAttachments((prev) => [...prev, data.attachment]);
      }
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isLoading && !activeTeam) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="w-8 h-8 text-[#1F5E4B] animate-spin mx-auto" />
        <p className="text-xs text-[#6B7471] mt-2">Loading team details...</p>
      </div>
    );
  }

  if (!activeTeam) {
    return (
      <div className="p-12 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-[#C94A4A] mx-auto" />
        <h2 className="text-lg font-bold text-[#202524]">Team Not Found</h2>
        <p className="text-xs text-[#6B7471]">
          The team you are looking for does not exist.
        </p>
        <button
          onClick={() => navigate('/teams')}
          className="px-4 py-2 bg-[#1F5E4B] text-white font-bold rounded-xl text-xs"
        >
          Back to Teams
        </button>
      </div>
    );
  }

  const pendingInvites = activeTeam.invitations || [];

  const handleRemoveMember = async (memberUserId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this team?`)) return;
    setIsActionLoading(true);
    await removeMember(activeTeam.id, memberUserId);
    setIsActionLoading(false);
  };

  const handleLeaveTeam = async () => {
    if (!user) return;
    if (!confirm('Are you sure you want to leave this team?')) return;
    setIsActionLoading(true);
    await removeMember(activeTeam.id, user.id);
    setIsActionLoading(false);
    navigate('/teams');
  };

  const handleCancelInvite = async (invitationId: string) => {
    await cancelInvitation(activeTeam.id, invitationId);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSuccess(null);
    setSettingsError(null);

    const res = await updateTeam(activeTeam.id, nameInput.trim(), descInput.trim());
    if (res.success) {
      setSettingsSuccess('Team settings updated successfully!');
    } else {
      setSettingsError(res.error || 'Failed to update team settings');
    }
  };

  const handleDeleteTeam = async () => {
    if (!confirm(`Are you sure you want to delete team "${activeTeam.name}"?`)) {
      return;
    }
    const res = await deleteTeam(activeTeam.id);
    if (res.success) {
      navigate('/teams');
    } else {
      alert(res.error || 'Failed to delete team');
    }
  };

  const handleCreateTeamProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const project = await createProject(newProjectName.trim(), {
      description: newProjectDesc.trim(),
      projectType: 'team',
      visibility: 'private',
      teamId: activeTeam.id,
    });

    setIsProjectModalOpen(false);
    setNewProjectName('');
    setNewProjectDesc('');
    if (project) {
      navigate(`/builder/${project.id}`);
    }
  };

  const parseAttachments = (att?: any): any[] => {
    if (!att) return [];
    if (Array.isArray(att)) return att;
    try {
      return JSON.parse(att);
    } catch {
      return [];
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Hidden File Upload Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Back Button & Top Action */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/teams')}
          className="text-xs font-semibold text-[#6B7471] hover:text-[#202524] flex items-center gap-1.5 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Teams</span>
        </button>

        <button
          onClick={handleLeaveTeam}
          className="text-xs font-semibold text-[#6B7471] hover:text-[#C94A4A] flex items-center gap-1.5 transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Leave Team</span>
        </button>
      </div>

      {/* Team Header Hero Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#E2E6E4] shadow-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={activeTeam.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${activeTeam.name}`}
              alt={activeTeam.name}
              className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#1F5E4B]/20 shadow-xs"
            />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-[#202524] tracking-tight">{activeTeam.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 text-[10px] font-mono font-bold">
                  Active Team Space
                </span>
              </div>
              <p className="text-xs text-[#6B7471] mt-1 max-w-xl">
                {activeTeam.description || 'Collaborative team workspace for ModuleForge compositions.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => {
                startMeeting(`Team Meeting: ${activeTeam.name}`, { teamId: activeTeam.id });
              }}
              className="px-4 py-2.5 rounded-xl bg-white border border-[#E2E6E4] hover:bg-[#EAF3EF] hover:border-[#1F5E4B]/40 text-[#202524] text-xs font-bold shadow-xs flex items-center gap-2 transition"
            >
              <Video className="w-4 h-4 text-[#1F5E4B]" />
              <span>Team Meet</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2.5 rounded-xl border text-xs font-bold shadow-xs flex items-center gap-2 transition ${
                activeTab === 'chat'
                  ? 'bg-[#1F5E4B] text-white border-[#1F5E4B]'
                  : 'bg-white border-[#E2E6E4] hover:bg-[#EAF3EF] hover:border-[#1F5E4B]/40 text-[#202524]'
              }`}
            >
              <MessageSquare className={`w-4 h-4 ${activeTab === 'chat' ? 'text-white' : 'text-[#1F5E4B]'}`} />
              <span>Team Chat</span>
            </button>

            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 flex items-center gap-2 transition transform active:scale-95"
            >
              <UserPlus className="w-4 h-4 text-white" />
              <span>Invite Member</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#E2E6E4] text-xs font-mono">
          <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4]">
            <span className="text-[#6B7471] block text-[10px] uppercase">Created By</span>
            <span className="text-[#202524] font-bold truncate block">
              {activeTeam.owner?.name || activeTeam.owner?.username || 'Team Lead'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4]">
            <span className="text-[#6B7471] block text-[10px] uppercase">Team Members</span>
            <span className="text-[#1F5E4B] font-bold block">{activeTeam.members?.length || 1}</span>
          </div>

          <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4]">
            <span className="text-[#6B7471] block text-[10px] uppercase">Team Channels</span>
            <span className="text-[#202524] font-bold block">{teamChannels.length || 1}</span>
          </div>

          <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4]">
            <span className="text-[#6B7471] block text-[10px] uppercase">Team Projects</span>
            <span className="text-[#2E7D5B] font-bold block">{activeTeam.projects?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#E2E6E4] gap-6 text-sm font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('chat')}
          className={`pb-3 transition relative flex items-center gap-2 shrink-0 ${
            activeTab === 'chat'
              ? 'text-[#1F5E4B] border-b-2 border-[#1F5E4B] font-bold'
              : 'text-[#6B7471] hover:text-[#202524]'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Team Channels & Chat</span>
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`pb-3 transition relative flex items-center gap-2 shrink-0 ${
            activeTab === 'members'
              ? 'text-[#1F5E4B] border-b-2 border-[#1F5E4B] font-bold'
              : 'text-[#6B7471] hover:text-[#202524]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Members ({activeTeam.members?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('invitations')}
          className={`pb-3 transition relative flex items-center gap-2 shrink-0 ${
            activeTab === 'invitations'
              ? 'text-[#1F5E4B] border-b-2 border-[#1F5E4B] font-bold'
              : 'text-[#6B7471] hover:text-[#202524]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Invitations ({pendingInvites.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`pb-3 transition relative flex items-center gap-2 shrink-0 ${
            activeTab === 'projects'
              ? 'text-[#1F5E4B] border-b-2 border-[#1F5E4B] font-bold'
              : 'text-[#6B7471] hover:text-[#202524]'
          }`}
        >
          <FolderGit2 className="w-4 h-4" />
          <span>Team Projects ({activeTeam.projects?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 transition relative flex items-center gap-2 shrink-0 ${
            activeTab === 'settings'
              ? 'text-[#1F5E4B] border-b-2 border-[#1F5E4B] font-bold'
              : 'text-[#6B7471] hover:text-[#202524]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>

      {/* TAB 1: EMBEDDED TEAM CHANNELS & CHAT (Default) */}
      {activeTab === 'chat' && (
        <div className="bg-white border border-[#E2E6E4] rounded-3xl overflow-hidden shadow-card flex flex-col md:flex-row h-[600px]">
          {/* Left: Channels Sidebar */}
          <aside className="w-full md:w-64 border-r border-[#E2E6E4] bg-[#F7F8F7] flex flex-col shrink-0">
            <div className="p-4 border-b border-[#E2E6E4] flex items-center justify-between">
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-[#6B7471]">
                Team Channels
              </span>
              <button
                type="button"
                onClick={() => setIsNewChannelModalOpen(true)}
                className="p-1 rounded-lg text-[#1F5E4B] hover:bg-white transition"
                title="Create Channel"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {teamChannels.map((chan) => {
                const isSelected = selectedChannel?.id === chan.id;
                return (
                  <button
                    key={chan.id}
                    type="button"
                    onClick={() => setSelectedChannel(chan)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-left transition ${
                      isSelected
                        ? 'bg-white text-[#1F5E4B] font-bold shadow-xs border border-[#E2E6E4]'
                        : 'text-[#6B7471] hover:text-[#202524] hover:bg-white/60'
                    }`}
                  >
                    {chan.type === 'voice' ? (
                      <Volume2 className="w-3.5 h-3.5 text-[#1F5E4B]" />
                    ) : chan.type === 'video' ? (
                      <Video className="w-3.5 h-3.5 text-[#1F5E4B]" />
                    ) : (
                      <Hash className="w-3.5 h-3.5 text-[#6B7471]" />
                    )}
                    <span className="truncate">#{chan.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Start Meeting Shortcut */}
            <div className="p-3 border-t border-[#E2E6E4] bg-white">
              <button
                type="button"
                onClick={() =>
                  startMeeting(`Meeting: ${activeTeam.name}`, { teamId: activeTeam.id })
                }
                className="w-full py-2 px-3 rounded-xl bg-[#1F5E4B] hover:bg-[#2E7D5B] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Start Team Meet</span>
              </button>
            </div>
          </aside>

          {/* Right: Message Stream */}
          <main className="flex-1 flex flex-col bg-white min-w-0">
            {selectedChannel ? (
              <>
                {/* Channel Header */}
                <div className="h-14 px-5 border-b border-[#E2E6E4] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-[#1F5E4B]" />
                    <span className="text-xs font-bold text-[#202524]">
                      #{selectedChannel.name}
                    </span>
                    <span className="text-[10px] text-[#6B7471] hidden sm:inline">
                      • {selectedChannel.description || 'Channel conversation'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      startMeeting(`Meeting: #${selectedChannel.name}`, {
                        teamId: activeTeam.id,
                        channelId: selectedChannel.id,
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-[#EAF3EF] hover:bg-[#1F5E4B] hover:text-white text-[#1F5E4B] text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Meet in #{selectedChannel.name}</span>
                  </button>
                </div>

                {/* Messages List */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F7F8F7]/50">
                  {isLoadingMessages ? (
                    <div className="p-8 text-center text-xs text-[#6B7471]">
                      <Loader2 className="w-4 h-4 animate-spin text-[#1F5E4B] mx-auto mb-1" />
                      <span>Loading messages...</span>
                    </div>
                  ) : teamMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#6B7471] space-y-2">
                      <Sparkles className="w-8 h-8 text-[#1F5E4B]" />
                      <h4 className="text-xs font-bold text-[#202524]">Start of #{selectedChannel.name}</h4>
                      <p className="text-[11px] max-w-xs">
                        Welcome to #{selectedChannel.name}! Say hi to your team and collaborate.
                      </p>
                    </div>
                  ) : (
                    teamMessages.map((msg) => {
                      const isMe = msg.senderId === user?.id;
                      const senderName = msg.sender?.name || msg.sender?.username || 'Member';
                      const msgAttachments = parseAttachments(msg.attachments);

                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-3 max-w-lg ${isMe ? 'ml-auto flex-row-reverse' : ''}`}
                        >
                          <img
                            src={
                              msg.sender?.avatarUrl ||
                              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                senderName
                              )}`
                            }
                            alt={senderName}
                            className="w-8 h-8 rounded-xl object-cover shrink-0 border border-[#E2E6E4]"
                          />

                          <div className={`space-y-1 ${isMe ? 'items-end' : ''}`}>
                            <div className={`flex items-center gap-2 text-[10px] ${isMe ? 'justify-end' : ''}`}>
                              <span className="font-bold text-[#202524]">{senderName}</span>
                              <span className="text-[#6B7471] font-mono">
                                {new Date(msg.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>

                            <div
                              className={`p-3 rounded-2xl text-xs leading-relaxed shadow-xs ${
                                isMe
                                  ? 'bg-[#1F5E4B] text-white rounded-tr-none'
                                  : 'bg-white text-[#202524] border border-[#E2E6E4] rounded-tl-none'
                              }`}
                            >
                              {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}

                              {msgAttachments.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {msgAttachments.map((att: any, idx: number) => {
                                    if (att.type === 'image') {
                                      return (
                                        <div key={idx} className="rounded-xl overflow-hidden border border-white/20">
                                          <img src={att.url} alt={att.name} className="max-h-48 rounded-xl object-cover" />
                                        </div>
                                      );
                                    }
                                    return (
                                      <a
                                        key={idx}
                                        href={att.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={`flex items-center gap-2 p-2 rounded-xl text-[11px] ${
                                          isMe ? 'bg-black/20 text-white' : 'bg-[#F7F8F7] text-[#202524]'
                                        }`}
                                      >
                                        <FileText className="w-3.5 h-3.5" />
                                        <span className="truncate max-w-[160px]">{att.name}</span>
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

                {/* Attachments Preview */}
                {attachments.length > 0 && (
                  <div className="px-4 py-2 bg-[#F7F8F7] border-t border-[#E2E6E4] flex items-center gap-2">
                    {attachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#E2E6E4] rounded-xl text-xs">
                        <Paperclip className="w-3 h-3 text-[#1F5E4B]" />
                        <span className="truncate max-w-[120px]">{att.name}</span>
                        <button type="button" onClick={() => setAttachments([])} className="text-[#6B7471] hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input Bar */}
                <form
                  onSubmit={handleSendTeamMessage}
                  className="p-3 border-t border-[#E2E6E4] flex items-center gap-2 bg-white"
                >
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="p-2 rounded-xl text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7] transition"
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-[#1F5E4B]" /> : <Paperclip className="w-4 h-4" />}
                  </button>

                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={`Message #${selectedChannel.name}...`}
                    className="flex-1 bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B]"
                  />

                  <button
                    type="submit"
                    disabled={!messageInput.trim() && attachments.length === 0}
                    className="p-2 rounded-xl bg-[#1F5E4B] hover:bg-[#2E7D5B] text-white transition disabled:opacity-40"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#6B7471]">
                Select or create a channel to start chatting
              </div>
            )}
          </main>
        </div>
      )}

      {/* TAB 2: MEMBERS (with direct calling & messaging per user) */}
      {activeTab === 'members' && (
        <div className="bg-white border border-[#E2E6E4] rounded-2xl overflow-hidden shadow-card">
          <div className="p-4 border-b border-[#E2E6E4] flex items-center justify-between bg-[#F7F8F7]">
            <span className="text-xs font-bold text-[#202524] uppercase tracking-wider font-mono">
              Team Roster ({activeTeam.members?.length || 0})
            </span>
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="text-xs font-bold text-[#1F5E4B] hover:text-[#174739] flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Invite New Teammate</span>
            </button>
          </div>

          <div className="divide-y divide-[#E2E6E4]">
            {activeTeam.members?.map((member) => {
              const isCurrentUser = user?.id === member.userId;

              return (
                <div key={member.id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={member.user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${member.user?.name}`}
                      alt={member.user?.name || 'Member'}
                      className="w-11 h-11 rounded-2xl object-cover ring-2 ring-[#E2E6E4] shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#202524] truncate">
                          {member.user?.name || 'Developer'}
                        </span>
                        {isCurrentUser && (
                          <span className="px-1.5 py-0.5 rounded bg-[#EAF3EF] text-[#1F5E4B] text-[10px] font-mono font-bold">
                            You
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-[#1F5E4B] block font-semibold">
                        @{member.user?.username || 'user'}
                      </span>
                    </div>
                  </div>

                  {/* Actions: Direct Call & Chat */}
                  <div className="flex items-center gap-3">
                    {!isCurrentUser && member.userId && (
                      <div className="flex items-center gap-1.5 bg-[#F7F8F7] p-1 rounded-xl border border-[#E2E6E4]">
                        <button
                          type="button"
                          onClick={() => setActiveTab('chat')}
                          className="p-1.5 rounded-lg text-[#6B7471] hover:text-[#1F5E4B] hover:bg-white transition"
                          title="Open Team Chat"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => initiateCall(member.userId, 'voice')}
                          className="p-1.5 rounded-lg text-[#6B7471] hover:text-[#1F5E4B] hover:bg-white transition"
                          title="1:1 Voice Call"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => initiateCall(member.userId, 'video')}
                          className="p-1.5 rounded-lg text-[#6B7471] hover:text-[#1F5E4B] hover:bg-white transition"
                          title="1:1 Video Call"
                        >
                          <Video className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {!isCurrentUser && (
                      <button
                        onClick={() => handleRemoveMember(member.userId, member.user?.name || 'member')}
                        title="Remove member from team"
                        className="p-1.5 text-[#6B7471] hover:text-[#C94A4A] hover:bg-[#FDF3F3] rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: PENDING INVITATIONS */}
      {activeTab === 'invitations' && (
        <div className="bg-white border border-[#E2E6E4] rounded-2xl overflow-hidden shadow-card">
          <div className="p-4 border-b border-[#E2E6E4] flex items-center justify-between bg-[#F7F8F7]">
            <span className="text-xs font-bold text-[#202524] uppercase tracking-wider font-mono">
              Pending Invitations ({pendingInvites.length})
            </span>
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="text-xs font-bold text-[#1F5E4B] hover:text-[#174739] flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Invite</span>
            </button>
          </div>

          {pendingInvites.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-[#F7F8F7] border border-[#E2E6E4] flex items-center justify-center mx-auto text-[#6B7471]">
                <Clock className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-[#202524]">No pending invitations</p>
              <p className="text-[11px] text-[#6B7471]">
                Teammates you invite by @username or email will be listed here until they accept.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E6E4]">
              {pendingInvites.map((invite) => {
                const isUsernameInvite = Boolean(invite.inviteeUser);
                const recipientDisplay = isUsernameInvite
                  ? `@${invite.inviteeUser?.username || 'user'}`
                  : invite.inviteeEmail;

                return (
                  <div key={invite.id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[#EAF3EF] border border-[#1F5E4B]/20 text-[#1F5E4B] flex items-center justify-center shrink-0">
                        {isUsernameInvite ? <User className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#202524] truncate">
                            {recipientDisplay}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 text-[10px] font-mono font-bold">
                            Pending
                          </span>
                        </div>
                        <span className="text-[11px] text-[#6B7471] block font-mono">
                          Invited by {invite.inviter?.name || 'Team Member'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-[#6B7471] font-mono hidden sm:inline">
                        {new Date(invite.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => handleCancelInvite(invite.id)}
                        className="px-3 py-1 bg-[#FDF3F3] text-[#C94A4A] border border-[#C94A4A]/20 hover:bg-[#C94A4A] hover:text-white rounded-lg text-xs font-semibold transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PROJECTS */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#202524]">Team Compositions</h3>
            <button
              onClick={() => setIsProjectModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Project</span>
            </button>
          </div>

          {(!activeTeam.projects || activeTeam.projects.length === 0) ? (
            <div className="p-12 text-center bg-white border border-[#E2E6E4] rounded-2xl space-y-3">
              <FolderGit2 className="w-10 h-10 text-[#6B7471] mx-auto opacity-50" />
              <h4 className="text-sm font-bold text-[#202524]">No Team Projects Yet</h4>
              <p className="text-xs text-[#6B7471] max-w-sm mx-auto">
                Create projects shared across all team members to build and link microservices together.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeTeam.projects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => navigate(`/builder/${proj.id}`)}
                  className="p-5 bg-white border border-[#E2E6E4] hover:border-[#1F5E4B] rounded-2xl cursor-pointer transition shadow-xs hover:shadow-card group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-sm text-[#202524] group-hover:text-[#1F5E4B] transition">
                      {proj.name}
                    </h4>
                    <span className="text-[10px] font-mono bg-[#EAF3EF] text-[#1F5E4B] px-2 py-0.5 rounded font-bold">
                      Team
                    </span>
                  </div>
                  <p className="text-xs text-[#6B7471] line-clamp-2">
                    {proj.description || 'No description provided.'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: SETTINGS */}
      {activeTab === 'settings' && (
        <div className="p-6 bg-white border border-[#E2E6E4] rounded-2xl space-y-6">
          <form onSubmit={handleSaveSettings} className="space-y-4 max-w-md">
            <h3 className="text-sm font-bold text-[#202524]">Team Settings</h3>

            {settingsSuccess && (
              <div className="p-3 rounded-xl bg-[#EAF3EF] text-[#1F5E4B] text-xs font-semibold">
                {settingsSuccess}
              </div>
            )}
            {settingsError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-600 text-xs font-semibold">
                {settingsError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#202524]">Team Name</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#202524]">Description</label>
              <textarea
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B] h-20"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#1F5E4B] text-white text-xs font-bold shadow-xs hover:bg-[#2E7D5B] transition"
            >
              Save Changes
            </button>
          </form>

          <div className="pt-6 border-t border-[#E2E6E4] space-y-3">
            <h4 className="text-xs font-bold text-red-600 uppercase tracking-wider font-mono">
              Danger Zone
            </h4>
            <p className="text-xs text-[#6B7471]">
              Delete this team and its associated workspace channels.
            </p>
            <button
              type="button"
              onClick={handleDeleteTeam}
              className="px-4 py-2 bg-[#FDF3F3] text-[#C94A4A] border border-[#C94A4A]/20 hover:bg-[#C94A4A] hover:text-white rounded-xl text-xs font-bold transition"
            >
              Delete Team
            </button>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <InviteMemberModal
          teamId={activeTeam.id}
          teamName={activeTeam.name}
          onClose={() => {
            setIsInviteModalOpen(false);
            fetchTeamDetails(activeTeam.id);
          }}
        />
      )}

      {/* Quick Create Project Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <form
            onSubmit={handleCreateTeamProject}
            className="bg-white border border-[#E2E6E4] rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E2E6E4] pb-3">
              <h3 className="font-bold text-[#202524] text-base flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-[#1F5E4B]" />
                <span>New Team Project</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsProjectModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7471] hover:text-[#202524]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#202524]">Project Name</label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Microservices Gateway"
                className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2.5 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#202524]">Description</label>
              <textarea
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                placeholder="Description of the composition..."
                className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2.5 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B] h-20"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsProjectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6B7471]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#1F5E4B] text-white text-xs font-bold hover:bg-[#2E7D5B] shadow-xs transition"
              >
                Create & Open Builder
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Channel Modal for Team */}
      {isNewChannelModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <form
            onSubmit={handleCreateTeamChannel}
            className="bg-white border border-[#E2E6E4] rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#202524] text-base flex items-center gap-2">
                <Hash className="w-5 h-5 text-[#1F5E4B]" />
                <span>Create Channel in {activeTeam.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsNewChannelModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7471] hover:text-[#202524]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#202524]">Channel Name</label>
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="e.g. backend-discussions"
                required
                className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#202524]">Channel Type</label>
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

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewChannelModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6B7471]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#1F5E4B] text-white text-xs font-bold hover:bg-[#2E7D5B] shadow-xs transition"
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
