import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { useTeamStore } from '../store/useTeamStore';
import { useAuthStore } from '../store/useAuthStore';
import { useProjectStore } from '../store/useProjectStore';
import { InviteMemberModal } from '../components/InviteMemberModal';

export const TeamDetailPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createProject } = useProjectStore();
  const {
    activeTeam,
    activeTeamPermissions,
    fetchTeamDetails,
    updateTeam,
    deleteTeam,
    removeMember,
    updateMemberRole,
    cancelInvitation,
    isLoading,
  } = useTeamStore();

  const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'projects' | 'settings'>('members');
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

  useEffect(() => {
    if (teamId) {
      fetchTeamDetails(teamId);
    }
  }, [teamId, fetchTeamDetails]);

  useEffect(() => {
    if (activeTeam) {
      setNameInput(activeTeam.name);
      setDescInput(activeTeam.description || '');
    }
  }, [activeTeam]);

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
          The team you are looking for does not exist or you do not have permission to view it.
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

  const isOwner = activeTeamPermissions?.isOwner ?? false;
  const isAdmin = activeTeamPermissions?.isAdmin ?? false;
  const canInvite = activeTeamPermissions?.canInvite ?? false;
  const pendingInvites = activeTeam.invitations || [];

  const handleRoleChange = async (memberUserId: string, newRole: string) => {
    setIsActionLoading(true);
    await updateMemberRole(activeTeam.id, memberUserId, newRole);
    setIsActionLoading(false);
  };

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
    if (!confirm(`Are you sure you want to PERMANENTLY delete team "${activeTeam.name}"? This action cannot be undone.`)) {
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

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'owner':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 text-[11px] font-mono font-bold flex items-center gap-1 border border-amber-500/20">
            <Crown className="w-3 h-3 text-amber-600" /> Owner
          </span>
        );
      case 'admin':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-[#1F5E4B]/10 text-[#1F5E4B] text-[11px] font-mono font-bold flex items-center gap-1 border border-[#1F5E4B]/20">
            <ShieldCheck className="w-3 h-3" /> Admin
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-[#F7F8F7] text-[#6B7471] text-[11px] font-mono font-bold flex items-center gap-1 border border-[#E2E6E4]">
            <User className="w-3 h-3" /> Member
          </span>
        );
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Back Button & Top Action */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/teams')}
          className="text-xs font-semibold text-[#6B7471] hover:text-[#202524] flex items-center gap-1.5 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Teams</span>
        </button>

        {!isOwner && (
          <button
            onClick={handleLeaveTeam}
            className="text-xs font-semibold text-[#6B7471] hover:text-[#C94A4A] flex items-center gap-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave Team</span>
          </button>
        )}
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
                {getRoleBadge(activeTeamPermissions?.userRole)}
              </div>
              <p className="text-xs text-[#6B7471] mt-1 max-w-xl">
                {activeTeam.description || 'Collaborative team workspace for ModuleForge compositions.'}
              </p>
            </div>
          </div>

          {canInvite && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 flex items-center gap-2 transition transform active:scale-95 shrink-0"
            >
              <UserPlus className="w-4 h-4 text-white" />
              <span>Invite Member</span>
            </button>
          )}
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#E2E6E4] text-xs font-mono">
          <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4]">
            <span className="text-[#6B7471] block text-[10px] uppercase">Team Owner</span>
            <span className="text-[#202524] font-bold truncate block">
              {activeTeam.owner?.name || 'Owner'} (@{activeTeam.owner?.username || 'user'})
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4]">
            <span className="text-[#6B7471] block text-[10px] uppercase">Active Members</span>
            <span className="text-[#1F5E4B] font-bold block">{activeTeam.members?.length || 1}</span>
          </div>

          <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4]">
            <span className="text-[#6B7471] block text-[10px] uppercase">Pending Invites</span>
            <span className="text-[#202524] font-bold block">{pendingInvites.length}</span>
          </div>

          <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4]">
            <span className="text-[#6B7471] block text-[10px] uppercase">Team Projects</span>
            <span className="text-[#2E7D5B] font-bold block">{activeTeam.projects?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E2E6E4] gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('members')}
          className={`pb-3 transition relative flex items-center gap-2 ${
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
          className={`pb-3 transition relative flex items-center gap-2 ${
            activeTab === 'invitations'
              ? 'text-[#1F5E4B] border-b-2 border-[#1F5E4B] font-bold'
              : 'text-[#6B7471] hover:text-[#202524]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending Invitations ({pendingInvites.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`pb-3 transition relative flex items-center gap-2 ${
            activeTab === 'projects'
              ? 'text-[#1F5E4B] border-b-2 border-[#1F5E4B] font-bold'
              : 'text-[#6B7471] hover:text-[#202524]'
          }`}
        >
          <FolderGit2 className="w-4 h-4" />
          <span>Team Projects ({activeTeam.projects?.length || 0})</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-3 transition relative flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'text-[#1F5E4B] border-b-2 border-[#1F5E4B] font-bold'
                : 'text-[#6B7471] hover:text-[#202524]'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        )}
      </div>

      {/* TAB 1: MEMBERS */}
      {activeTab === 'members' && (
        <div className="bg-white border border-[#E2E6E4] rounded-2xl overflow-hidden shadow-card">
          <div className="p-4 border-b border-[#E2E6E4] flex items-center justify-between bg-[#F7F8F7]">
            <span className="text-xs font-bold text-[#202524] uppercase tracking-wider font-mono">
              Team Roster
            </span>
            {canInvite && (
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="text-xs font-bold text-[#1F5E4B] hover:text-[#174739] flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Invite New Teammate</span>
              </button>
            )}
          </div>

          <div className="divide-y divide-[#E2E6E4]">
            {activeTeam.members?.map((member) => {
              const isMemberOwner = member.role === 'owner' || activeTeam.ownerId === member.userId;
              const isCurrentUser = user?.id === member.userId;

              return (
                <div key={member.id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={member.user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${member.user?.name}`}
                      alt={member.user?.name || 'Member'}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-[#E2E6E4] shrink-0"
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

                  {/* Actions & Role */}
                  <div className="flex items-center gap-3">
                    {/* Role selector for owner */}
                    {isOwner && !isMemberOwner ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                        disabled={isActionLoading}
                        className="bg-[#F7F8F7] border border-[#E2E6E4] rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-[#202524] focus:outline-none focus:border-[#1F5E4B]"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      getRoleBadge(member.role)
                    )}

                    {/* Remove Member button (visible to owner/admin, cannot remove owner or self here) */}
                    {isAdmin && !isMemberOwner && !isCurrentUser && (
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

      {/* TAB 2: PENDING INVITATIONS */}
      {activeTab === 'invitations' && (
        <div className="bg-white border border-[#E2E6E4] rounded-2xl overflow-hidden shadow-card">
          <div className="p-4 border-b border-[#E2E6E4] flex items-center justify-between bg-[#F7F8F7]">
            <span className="text-xs font-bold text-[#202524] uppercase tracking-wider font-mono">
              Pending Invitations ({pendingInvites.length})
            </span>
            {canInvite && (
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="text-xs font-bold text-[#1F5E4B] hover:text-[#174739] flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Invite</span>
              </button>
            )}
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
                          Invited by {invite.inviter?.name || 'Team Admin'} as{' '}
                          <span className="capitalize font-bold text-[#1F5E4B]">{invite.role}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-[#6B7471] font-mono hidden sm:inline">
                        Expires in 7 days
                      </span>

                      {isAdmin && (
                        <button
                          onClick={() => handleCancelInvite(invite.id)}
                          className="px-3 py-1 rounded-lg bg-[#F7F8F7] hover:bg-[#FDF3F3] text-[#6B7471] hover:text-[#C94A4A] border border-[#E2E6E4] text-xs font-semibold transition"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TEAM PROJECTS */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#202524] uppercase tracking-wider font-mono">
              Team Projects ({activeTeam.projects?.length || 0})
            </span>
            <button
              onClick={() => setIsProjectModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Team Project</span>
            </button>
          </div>

          {!activeTeam.projects || activeTeam.projects.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-[#E2E6E4] p-6 space-y-3">
              <FolderGit2 className="w-10 h-10 text-[#6B7471] mx-auto" />
              <h3 className="text-sm font-bold text-[#202524]">No Team Projects Created Yet</h3>
              <p className="text-xs text-[#6B7471] max-w-sm mx-auto">
                Create a modular composition shared with all members of {activeTeam.name}.
              </p>
              <button
                onClick={() => setIsProjectModalOpen(true)}
                className="px-4 py-2 bg-[#1F5E4B] hover:bg-[#174739] text-white font-bold rounded-xl text-xs"
              >
                Create Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeTeam.projects.map((proj: any) => (
                <div
                  key={proj.id}
                  onClick={() => navigate(`/builder/${proj.id}`)}
                  className="p-5 rounded-2xl bg-white border border-[#E2E6E4] hover:border-[#1F5E4B]/40 hover:shadow-card transition cursor-pointer space-y-4 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-[#EAF3EF] text-[#1F5E4B] flex items-center justify-center">
                      <FolderGit2 className="w-5 h-5" />
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#EAF3EF] text-[#1F5E4B] text-[10px] font-mono font-bold">
                      Team Project
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-[#202524] group-hover:text-[#1F5E4B] transition">
                      {proj.name}
                    </h4>
                    <p className="text-xs text-[#6B7471] line-clamp-2 mt-0.5">
                      {proj.description || 'Collaborative modular application composition.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#E2E6E4] flex items-center justify-between text-xs font-mono text-[#6B7471]">
                    <span>{proj._count?.modules || 0} modules</span>
                    <span className="text-[#1F5E4B] font-bold">Open Builder →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SETTINGS */}
      {activeTab === 'settings' && isAdmin && (
        <div className="bg-white border border-[#E2E6E4] rounded-2xl p-6 sm:p-8 space-y-6 shadow-card max-w-2xl">
          <h3 className="text-base font-bold text-[#202524]">Team Settings</h3>

          {settingsSuccess && (
            <div className="p-3 rounded-xl bg-[#EAF3EF] border border-[#2E7D5B]/20 text-[#2E7D5B] text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{settingsSuccess}</span>
            </div>
          )}

          {settingsError && (
            <div className="p-3 rounded-xl bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A] text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{settingsError}</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#202524]">Team Name</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#202524]">Description</label>
              <textarea
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B] h-20"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 transition"
              >
                Save Changes
              </button>
            </div>
          </form>

          {/* Danger Zone */}
          {isOwner && (
            <div className="pt-6 border-t border-[#E2E6E4] space-y-3">
              <span className="text-xs font-bold text-[#C94A4A] uppercase tracking-wider font-mono block">
                Danger Zone
              </span>
              <p className="text-xs text-[#6B7471]">
                Deleting this team will permanently remove all member associations and team configuration.
              </p>
              <button
                type="button"
                onClick={handleDeleteTeam}
                className="px-4 py-2 rounded-xl bg-[#FDF3F3] hover:bg-[#C94A4A] text-[#C94A4A] hover:text-white border border-[#C94A4A]/30 text-xs font-bold transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Team</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <InviteMemberModal
          team={activeTeam}
          isOpen={isInviteModalOpen}
          onClose={() => {
            setIsInviteModalOpen(false);
            fetchTeamDetails(activeTeam.id);
          }}
        />
      )}

      {/* Quick Create Team Project Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 bg-[#202524]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-[#E2E6E4] rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E2E6E4] pb-3">
              <h2 className="text-lg font-bold text-[#202524] flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-[#1F5E4B]" />
                <span>Create Team Project</span>
              </h2>
              <button
                onClick={() => setIsProjectModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7471] hover:text-[#202524]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTeamProject} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#202524]">Project Name</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Core App Suite"
                  className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#202524]">Description</label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Composition combining CRM, Books and Payments..."
                  className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] h-20"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#F7F8F7] text-[#6B7471] text-xs font-semibold border border-[#E2E6E4]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20"
                >
                  Create & Open Builder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
