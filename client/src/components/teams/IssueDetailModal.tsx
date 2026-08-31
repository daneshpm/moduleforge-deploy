import React, { useState } from 'react';
import {
  X,
  CircleDot,
  CheckCircle2,
  Clock,
  User,
  MessageSquare,
  Send,
  Trash2,
  Tag,
  Flame,
  UserCheck,
  RotateCcw,
  Check,
  Loader2,
  Calendar,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { TeamIssue, IssuePriority, IssueStatus, IssueAuthor } from '../../types/issues';
import { useAuthStore } from '../../store/useAuthStore';

interface IssueDetailModalProps {
  teamId: string;
  issue: TeamIssue;
  teamMembers: Array<{ id: string; user: { id: string; name?: string; username?: string; avatarUrl?: string } }>;
  onClose: () => void;
  onUpdated: () => void;
}

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  teamId,
  issue,
  teamMembers,
  onClose,
  onUpdated,
}) => {
  const { user } = useAuthStore();
  const [currentIssue, setCurrentIssue] = useState<TeamIssue>(issue);
  const [commentInput, setCommentInput] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || !user) return;

    setIsSubmittingComment(true);
    try {
      const author: IssueAuthor = {
        id: user.id,
        name: user.name || 'Developer',
        username: user.username || user.email?.split('@')[0] || 'developer',
        avatarUrl: user.avatarUrl,
      };

      const res = await fetch(`/api/teams/${teamId}/issues/${currentIssue.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author, content: commentInput.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.comment) {
        setCurrentIssue((prev) => ({
          ...prev,
          comments: [...prev.comments, data.comment],
        }));
        setCommentInput('');
        onUpdated();
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleToggleStatus = async () => {
    const newStatus: IssueStatus = currentIssue.status === 'closed' ? 'open' : 'closed';
    setIsUpdatingStatus(true);

    try {
      const res = await fetch(`/api/teams/${teamId}/issues/${currentIssue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (res.ok && data.issue) {
        setCurrentIssue(data.issue);
        onUpdated();
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleUpdatePriority = async (newPriority: IssuePriority) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/issues/${currentIssue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority }),
      });

      const data = await res.json();
      if (res.ok && data.issue) {
        setCurrentIssue(data.issue);
        onUpdated();
      }
    } catch (err) {
      console.error('Failed to update priority:', err);
    }
  };

  const handleUpdateAssignee = async (newAssigneeId: string) => {
    let assignee: IssueAuthor | null = null;
    if (newAssigneeId) {
      const member = teamMembers.find((m) => m.user.id === newAssigneeId);
      if (member) {
        assignee = {
          id: member.user.id,
          name: member.user.name || 'Member',
          username: member.user.username || 'member',
          avatarUrl: member.user.avatarUrl,
        };
      }
    }

    try {
      const res = await fetch(`/api/teams/${teamId}/issues/${currentIssue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee }),
      });

      const data = await res.json();
      if (res.ok && data.issue) {
        setCurrentIssue(data.issue);
        onUpdated();
      }
    } catch (err) {
      console.error('Failed to update assignee:', err);
    }
  };

  const handleDeleteIssue = async () => {
    if (!confirm('Are you sure you want to delete this issue?')) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/teams/${teamId}/issues/${currentIssue.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        onUpdated();
        onClose();
      }
    } catch (err) {
      console.error('Failed to delete issue:', err);
      setIsDeleting(false);
    }
  };

  const isOpen = currentIssue.status !== 'closed';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 320 }}
        className="bg-white border border-[#E2E6E4] rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <header className="p-6 border-b border-[#E2E6E4] bg-white flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold font-mono flex items-center gap-1.5 ${
                  isOpen
                    ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/30'
                    : 'bg-[#F3E8FF] text-[#9333EA] border border-[#9333EA]/30'
                }`}
              >
                {isOpen ? (
                  <>
                    <CircleDot className="w-3.5 h-3.5" />
                    <span>Open</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Closed</span>
                  </>
                )}
              </span>

              <h2 className="text-lg font-bold text-[#202524]">
                {currentIssue.title}
              </h2>
              <span className="text-base text-[#6B7471] font-mono font-bold">
                #{currentIssue.issueNumber}
              </span>
            </div>

            <p className="text-xs text-[#6B7471] font-sans flex items-center gap-2">
              <span>Opened by <strong>@{currentIssue.author.username}</strong></span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(currentIssue.createdAt).toLocaleDateString()}
              </span>
              <span>•</span>
              <span>{currentIssue.comments.length} comments</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7] transition border border-transparent hover:border-[#E2E6E4] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden flex-col md:flex-row bg-[#FAFBFA]">
          {/* Main Column: Description & Comments */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Original Issue Description Card */}
            <div className="p-5 rounded-3xl bg-white border border-[#E2E6E4] shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#E2E6E4] pb-3">
                <div className="flex items-center gap-2.5">
                  <img
                    src={
                      currentIssue.author.avatarUrl ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(currentIssue.author.name)}`
                    }
                    alt={currentIssue.author.name}
                    className="w-7 h-7 rounded-full ring-1 ring-[#E2E6E4]"
                  />
                  <span className="text-xs font-bold text-[#202524]">
                    {currentIssue.author.name}
                  </span>
                  <span className="text-[11px] font-mono text-[#6B7471]">
                    @{currentIssue.author.username}
                  </span>
                </div>
                <span className="text-[11px] text-[#6B7471]">Author</span>
              </div>

              <div className="text-xs text-[#202524] font-sans leading-relaxed whitespace-pre-wrap">
                {currentIssue.description || (
                  <span className="text-[#6B7471] italic">No description provided.</span>
                )}
              </div>
            </div>

            {/* Comment Thread Stream */}
            {currentIssue.comments.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[#6B7471] flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-[#1F5E4B]" />
                  <span>Discussion ({currentIssue.comments.length})</span>
                </h4>

                {currentIssue.comments.map((comment) => (
                  <motion.div
                    key={comment.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="p-4 rounded-2xl bg-white border border-[#E2E6E4] shadow-xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <img
                          src={
                            comment.author.avatarUrl ||
                            `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(comment.author.name)}`
                          }
                          alt={comment.author.name}
                          className="w-6 h-6 rounded-full ring-1 ring-[#E2E6E4]"
                        />
                        <span className="font-bold text-[#202524]">{comment.author.name}</span>
                        <span className="font-mono text-[11px] text-[#6B7471]">
                          @{comment.author.username}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#6B7471]">
                        {new Date(comment.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="text-xs text-[#202524] font-sans leading-relaxed pl-8">
                      {comment.content}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Post Comment Form */}
            <form onSubmit={handleAddComment} className="space-y-3 pt-2">
              <label className="text-xs font-bold text-[#202524] block">
                Add a Comment
              </label>
              <textarea
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Leave a comment or update..."
                rows={3}
                className="w-full bg-white border border-[#E2E6E4] rounded-2xl p-3.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15 transition font-sans resize-none shadow-xs"
              />

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  disabled={isUpdatingStatus}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
                    isOpen
                      ? 'bg-[#FDF3F3] hover:bg-[#FBE6E6] text-[#C94A4A] border-[#C94A4A]/20'
                      : 'bg-[#EAF3EF] hover:bg-[#D5EAE1] text-[#1F5E4B] border-[#1F5E4B]/30'
                  }`}
                >
                  {isUpdatingStatus ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isOpen ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Close Issue</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reopen Issue</span>
                    </>
                  )}
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingComment || !commentInput.trim()}
                  className="px-5 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                >
                  {isSubmittingComment ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Comment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Sidebar: Metadata & Controls */}
          <aside className="w-full md:w-72 border-t md:border-t-0 md:border-l border-[#E2E6E4] bg-white p-5 space-y-5 shrink-0">
            {/* Priority Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#6B7471] font-mono uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-[#1F5E4B]" />
                <span>Priority</span>
              </label>
              <select
                value={currentIssue.priority}
                onChange={(e) => handleUpdatePriority(e.target.value as IssuePriority)}
                className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3 py-2 text-xs text-[#202524] font-medium focus:outline-none focus:border-[#1F5E4B]"
              >
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🟠 High</option>
                <option value="urgent">🔴 Urgent</option>
              </select>
            </div>

            {/* Assignee Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#6B7471] font-mono uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-[#1F5E4B]" />
                <span>Assignee</span>
              </label>
              <select
                value={currentIssue.assignee?.id || ''}
                onChange={(e) => handleUpdateAssignee(e.target.value)}
                className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3 py-2 text-xs text-[#202524] font-medium focus:outline-none focus:border-[#1F5E4B]"
              >
                <option value="">No Assignee</option>
                {teamMembers.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name || `@${m.user.username || 'member'}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Labels Tags */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#6B7471] font-mono uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#1F5E4B]" />
                <span>Labels</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {currentIssue.labels.map((lbl) => (
                  <span
                    key={lbl}
                    className="px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20"
                  >
                    {lbl}
                  </span>
                ))}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="pt-4 border-t border-[#E2E6E4]">
              <button
                type="button"
                onClick={handleDeleteIssue}
                disabled={isDeleting}
                className="w-full py-2 rounded-xl text-xs font-bold text-[#C94A4A] bg-[#FDF3F3] hover:bg-[#FBE6E6] border border-[#C94A4A]/20 flex items-center justify-center gap-1.5 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Issue</span>
              </button>
            </div>
          </aside>
        </div>
      </motion.div>
    </motion.div>
  );
};
