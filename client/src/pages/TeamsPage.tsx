import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Plus,
  Crown,
  ShieldCheck,
  User,
  FolderGit2,
  Clock,
  ArrowRight,
  Sparkles,
  X,
  Loader2,
  AlertCircle,
  Building,
} from 'lucide-react';
import { useTeamStore } from '../store/useTeamStore';
import { useAuthStore } from '../store/useAuthStore';
import { Team } from '../types';

export const TeamsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { teams, fetchTeams, createTeam, isLoading } = useTeamStore();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await createTeam(teamName.trim(), teamDesc.trim());
    setIsSubmitting(false);

    if (res.success && res.team) {
      setIsCreateModalOpen(false);
      setTeamName('');
      setTeamDesc('');
      navigate(`/teams/${res.team.id}`);
    } else {
      setErrorMsg(res.error || 'Failed to create team');
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'owner':
        return (
          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 text-[10px] font-mono font-bold flex items-center gap-1 border border-amber-500/20">
            <Crown className="w-3 h-3 text-amber-600" /> Owner
          </span>
        );
      case 'admin':
        return (
          <span className="px-2 py-0.5 rounded-md bg-[#1F5E4B]/10 text-[#1F5E4B] text-[10px] font-mono font-bold flex items-center gap-1 border border-[#1F5E4B]/20">
            <ShieldCheck className="w-3 h-3" /> Admin
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md bg-[#F7F8F7] text-[#6B7471] text-[10px] font-mono font-bold flex items-center gap-1 border border-[#E2E6E4]">
            <User className="w-3 h-3" /> Member
          </span>
        );
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#202524] tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-[#1F5E4B]" />
            <span className="primary-text-gradient">Teams & Workspaces</span>
          </h1>
          <p className="text-sm text-[#6B7471] mt-1">
            Collaborate on modular projects, share repositories, and compose software together.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 flex items-center gap-2 transition transform active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4 text-white stroke-[2.5]" />
          <span>Create Team</span>
        </button>
      </div>

      {/* Teams Grid */}
      {isLoading && teams.length === 0 ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-[#1F5E4B] animate-spin mx-auto" />
          <p className="text-xs text-[#6B7471] mt-2">Loading teams...</p>
        </div>
      ) : teams.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-[#E2E6E4] p-8 space-y-4 max-w-md mx-auto shadow-card">
          <div className="w-14 h-14 rounded-2xl bg-[#EAF3EF] border border-[#1F5E4B]/20 text-[#1F5E4B] flex items-center justify-center mx-auto">
            <Building className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-[#202524]">No Teams Yet</h3>
          <p className="text-xs text-[#6B7471] leading-relaxed">
            Create a team to invite teammates by <span className="font-mono text-[#1F5E4B]">@username</span> or email, and collaborate on shared full-stack compositions.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-5 py-2.5 bg-[#1F5E4B] hover:bg-[#174739] text-white font-bold rounded-xl text-xs shadow-md shadow-[#1F5E4B]/20 flex items-center gap-2 mx-auto transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Team</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <div
              key={team.id}
              onClick={() => navigate(`/teams/${team.id}`)}
              className="bg-white border border-[#E2E6E4] rounded-2xl p-6 hover:border-[#1F5E4B]/40 hover:shadow-card transition cursor-pointer flex flex-col justify-between space-y-5 group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <img
                    src={team.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${team.name}`}
                    alt={team.name}
                    className="w-12 h-12 rounded-xl object-cover ring-2 ring-[#E2E6E4] group-hover:ring-[#1F5E4B]/30 transition"
                  />
                  {getRoleBadge(team.userRole)}
                </div>

                <div>
                  <h3 className="text-base font-bold text-[#202524] group-hover:text-[#1F5E4B] transition">
                    {team.name}
                  </h3>
                  <p className="text-xs text-[#6B7471] line-clamp-2 mt-1">
                    {team.description || 'No team description provided.'}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E2E6E4] flex items-center justify-between text-xs text-[#6B7471] font-mono">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-[#1F5E4B]" />
                    <span>{team.memberCount || team.members?.length || 1} members</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <FolderGit2 className="w-3.5 h-3.5 text-[#6B7471]" />
                    <span>{team.projectCount || team.projects?.length || 0} projects</span>
                  </span>
                </div>

                <span className="text-[#1F5E4B] font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>Manage</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Team Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-[#202524]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-[#E2E6E4] rounded-3xl p-6 sm:p-7 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E2E6E4] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EAF3EF] text-[#1F5E4B] flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-[#202524]">Create New Team</h2>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A] text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#202524]">Team Name</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Acme Engineering, Platform Core"
                  className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#202524]">Description (Optional)</label>
                <textarea
                  value={teamDesc}
                  onChange={(e) => setTeamDesc(e.target.value)}
                  placeholder="Collaborative team for frontend modules and backend services..."
                  className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15 h-20"
                />
              </div>

              <div className="p-3 rounded-xl bg-[#EAF3EF]/60 border border-[#1F5E4B]/20 text-xs text-[#1F5E4B] space-y-1">
                <span className="font-bold block">Team Creator Role</span>
                <p className="text-[11px] text-[#6B7471]">
                  You will automatically become the <span className="font-bold text-[#1F5E4B]">Team Owner</span> with full permissions to manage members, roles, and project assets.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#6B7471] hover:text-[#202524] border border-[#E2E6E4] text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!teamName.trim() || isSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 transition flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Create Team</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
