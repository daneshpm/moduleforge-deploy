import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video,
  X,
  Users,
  Check,
  Loader2,
  Mail,
  Crown,
  Shield,
  Sparkles,
  User,
} from 'lucide-react';
import { Team, TeamMember } from '../../types';
import { useAuthStore } from '../../store/useAuthStore';
import { meetingService } from '../../services/meeting/meetingService';

interface MeetingInviteProps {
  isOpen: boolean;
  onClose: () => void;
  team: Team;
}

export const MeetingInvite: React.FC<MeetingInviteProps> = ({
  isOpen,
  onClose,
  team,
}) => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);

  const [title, setTitle] = useState(`${team.name} Meeting`);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    if (team.members) {
      team.members.forEach((m) => ids.add(m.userId));
    }
    if (team.ownerId) {
      ids.add(team.ownerId);
    }
    return ids;
  });
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Build complete list of members including owner
  const allMembers: Array<{
    uid: string;
    email: string;
    displayName: string;
    username?: string;
    avatarUrl?: string;
    role: string;
  }> = [];

  // 1. Owner
  if (team.owner) {
    allMembers.push({
      uid: team.owner.id,
      email: (team.owner as any).email || (team.ownerId === currentUser?.id ? currentUser.email : `${team.owner.username || 'owner'}@gmail.com`),
      displayName: team.owner.name || team.owner.username || 'Team Owner',
      username: team.owner.username,
      avatarUrl: team.owner.avatarUrl,
      role: 'owner',
    });
  }

  // 2. Members
  (team.members || []).forEach((m) => {
    if (!allMembers.some((item) => item.uid === m.userId)) {
      allMembers.push({
        uid: m.userId,
        email: (m.user as any).email || (m.userId === currentUser?.id ? currentUser.email : `${m.user?.username || 'member'}@gmail.com`),
        displayName: m.user?.name || m.user?.username || 'Team Member',
        username: m.user?.username,
        avatarUrl: m.user?.avatarUrl,
        role: m.role || 'member',
      });
    }
  });

  const toggleMember = (uid: string) => {
    if (uid === currentUser?.id) return; // Always include current user
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  };

  const handleStartMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!title.trim()) {
      setError('Please provide a meeting title');
      return;
    }

    setIsStarting(true);
    setError(null);

    const invitedMembers = allMembers.filter((m) => selectedMemberIds.has(m.uid));

    try {
      const res = await meetingService.createTeamMeeting({
        teamId: team.id,
        teamName: team.name,
        title: title.trim(),
        creator: {
          id: currentUser.id,
          name: currentUser.name || currentUser.username || 'Host',
          email: currentUser.email,
          username: currentUser.username,
          avatarUrl: currentUser.avatarUrl,
        },
        invitedMembers,
      });

      if (res.success && res.meeting) {
        onClose();
        navigate(`/meet/${res.meeting.id}`);
      } else {
        setError(res.error || 'Failed to start meeting');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start meeting');
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#202524]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white border border-[#E2E6E4] rounded-3xl p-6 sm:p-7 w-full max-w-lg shadow-2xl space-y-6 relative overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[#E2E6E4] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1F5E4B] flex items-center justify-center text-white shadow-md shadow-[#1F5E4B]/20">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#202524] tracking-tight">
                Start Team Meeting
              </h3>
              <p className="text-xs text-[#6B7471] font-medium">
                Team: <strong className="text-[#202524]">{team.name}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 text-xs flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleStartMeeting} className="space-y-5">
          {/* Meeting Title Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#202524] flex items-center gap-1.5">
              <span>Meeting Title</span>
              <Sparkles className="w-3 h-3 text-[#1F5E4B]" />
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sprint Planning Sync"
              className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-2xl px-4 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15 transition font-medium"
              required
            />
          </div>

          {/* Participants Selection Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#202524] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#1F5E4B]" />
                <span>Participants ({selectedMemberIds.size} selected)</span>
              </label>
              <span className="text-[11px] text-[#6B7471]">
                Only team members included
              </span>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-2 p-1 border border-[#E2E6E4] rounded-2xl bg-[#F7F8F7]/50">
              {allMembers.map((member) => {
                const isSelected = selectedMemberIds.has(member.uid);
                const isSelf = member.uid === currentUser?.id;

                return (
                  <div
                    key={member.uid}
                    onClick={() => toggleMember(member.uid)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? 'bg-white border-[#1F5E4B]/30 shadow-xs'
                        : 'bg-white/60 border-[#E2E6E4] hover:bg-white opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={
                          member.avatarUrl ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                            member.displayName
                          )}`
                        }
                        alt={member.displayName}
                        className="w-8 h-8 rounded-xl object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#202524] truncate">
                            {member.displayName} {isSelf && '(You)'}
                          </span>
                          {member.role === 'owner' ? (
                            <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                          ) : member.role === 'admin' ? (
                            <Shield className="w-3 h-3 text-[#1F5E4B] shrink-0" />
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[#6B7471] font-mono truncate">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{member.email}</span>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center transition shrink-0 ${
                        isSelected
                          ? 'bg-[#1F5E4B] text-white shadow-xs'
                          : 'border border-[#E2E6E4] bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E6E4]">
            <button
              type="button"
              onClick={onClose}
              disabled={isStarting}
              className="px-4 py-2.5 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#6B7471] hover:text-[#202524] border border-[#E2E6E4] text-xs font-bold transition disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isStarting}
              className="px-6 py-2.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 flex items-center gap-2 transition transform active:scale-95 disabled:opacity-50"
            >
              {isStarting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Video className="w-4 h-4" />
              )}
              <span>{isStarting ? 'Starting Meeting...' : 'Start Meeting'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
