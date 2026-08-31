import React, { useState, useEffect } from 'react';
import {
  CircleDot,
  CheckCircle2,
  Plus,
  Search,
  Filter,
  MessageSquare,
  Clock,
  User,
  Tag,
  Flame,
  UserCheck,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { TeamIssue, IssuePriority } from '../../types/issues';
import { CreateIssueModal } from './CreateIssueModal';
import { IssueDetailModal } from './IssueDetailModal';

interface TeamIssuesTabProps {
  team: {
    id: string;
    name: string;
    members: Array<{ id: string; user: { id: string; name?: string; username?: string; avatarUrl?: string } }>;
  };
}

export const TeamIssuesTab: React.FC<TeamIssuesTabProps> = ({ team }) => {
  const [issues, setIssues] = useState<TeamIssue[]>([]);
  const [openCount, setOpenCount] = useState<number>(0);
  const [closedCount, setClosedCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [activeStatusFilter, setActiveStatusFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [labelFilter, setLabelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedIssue, setSelectedIssue] = useState<TeamIssue | null>(null);

  const fetchIssues = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (activeStatusFilter !== 'all') params.append('status', activeStatusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (labelFilter !== 'all') params.append('label', labelFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`/api/teams/${team.id}/issues?${params.toString()}`);
      const data = await res.json();

      if (res.ok && Array.isArray(data.issues)) {
        setIssues(data.issues);
        setOpenCount(data.openCount ?? 0);
        setClosedCount(data.closedCount ?? 0);
      }
    } catch (err) {
      console.error('Failed to fetch team issues:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [team.id, activeStatusFilter, priorityFilter, labelFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchIssues();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getPriorityBadge = (priority: IssuePriority) => {
    switch (priority) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/20">🔴 Urgent</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/20">🟠 High</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#F0F9F5] text-[#2E7D5B] border border-[#2E7D5B]/20">🟡 Medium</span>;
      case 'low':
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#F7F8F7] text-[#6B7471] border border-[#E2E6E4]">🟢 Low</span>;
    }
  };

  return (
    <div className="space-y-5 animate-fade-in select-none">
      {/* GitHub-style Filter Bar & Action Header */}
      <div className="bg-white border border-[#E2E6E4] rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Open / Closed State Pills */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveStatusFilter('open')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 transition ${
              activeStatusFilter === 'open'
                ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/30'
                : 'bg-[#F7F8F7] text-[#6B7471] hover:text-[#202524] border border-[#E2E6E4]'
            }`}
          >
            <CircleDot className="w-3.5 h-3.5 text-[#1F5E4B]" />
            <span>{openCount} Open</span>
          </button>

          <button
            onClick={() => setActiveStatusFilter('closed')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 transition ${
              activeStatusFilter === 'closed'
                ? 'bg-[#F3E8FF] text-[#9333EA] border border-[#9333EA]/30'
                : 'bg-[#F7F8F7] text-[#6B7471] hover:text-[#202524] border border-[#E2E6E4]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#9333EA]" />
            <span>{closedCount} Closed</span>
          </button>

          <button
            onClick={() => setActiveStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition ${
              activeStatusFilter === 'all'
                ? 'bg-[#1F5E4B] text-white'
                : 'text-[#6B7471] hover:text-[#202524]'
            }`}
          >
            All ({openCount + closedCount})
          </button>
        </div>

        {/* Search, Filter Dropdowns & New Issue Button */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7471]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search all issues..."
              className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] transition"
            />
          </div>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-2.5 py-1.5 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B] transition font-medium"
          >
            <option value="all">Priority: All</option>
            <option value="urgent">🔴 Urgent</option>
            <option value="high">🟠 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>

          {/* Label Filter */}
          <select
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
            className="bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-2.5 py-1.5 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B] transition font-medium"
          >
            <option value="all">Label: All</option>
            <option value="bug">bug</option>
            <option value="feature">feature</option>
            <option value="enhancement">enhancement</option>
            <option value="documentation">documentation</option>
            <option value="design">design</option>
            <option value="security">security</option>
          </select>

          {/* New Issue Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-1.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Issue</span>
          </button>
        </div>
      </div>

      {/* Issues List Stream */}
      <div className="bg-white border border-[#E2E6E4] rounded-3xl overflow-hidden shadow-xs divide-y divide-[#E2E6E4]">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-6 h-6 text-[#1F5E4B] animate-spin" />
            <p className="text-xs font-mono text-[#6B7471]">Loading team issues...</p>
          </div>
        ) : issues.length === 0 ? (
          <div className="py-16 text-center space-y-3 p-6">
            <div className="w-12 h-12 rounded-2xl bg-[#EAF3EF] border border-[#1F5E4B]/20 flex items-center justify-center mx-auto text-[#1F5E4B]">
              <CircleDot className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="font-bold text-sm text-[#202524]">No issues found</h3>
              <p className="text-xs text-[#6B7471] font-sans">
                {searchQuery || priorityFilter !== 'all' || labelFilter !== 'all'
                  ? 'No issues match your active filter criteria.'
                  : 'There are no issues filed in this team yet. Click "New Issue" to report a bug or request a feature.'}
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Issue</span>
            </button>
          </div>
        ) : (
          issues.map((issue) => {
            const isOpen = issue.status !== 'closed';

            return (
              <div
                key={issue.id}
                onClick={() => setSelectedIssue(issue)}
                className="p-4 sm:p-5 hover:bg-[#FAFBFA] transition cursor-pointer flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  {/* Status Icon */}
                  <div className="pt-0.5">
                    {isOpen ? (
                      <CircleDot className="w-4 h-4 text-[#1F5E4B] shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-[#9333EA] shrink-0" />
                    )}
                  </div>

                  {/* Title & Metadata */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-[#202524] hover:text-[#1F5E4B] transition">
                        {issue.title}
                      </span>

                      {/* Label Tags */}
                      {issue.labels.map((lbl) => (
                        <span
                          key={lbl}
                          className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20"
                        >
                          {lbl}
                        </span>
                      ))}

                      {/* Priority Tag */}
                      {getPriorityBadge(issue.priority)}
                    </div>

                    <p className="text-xs text-[#6B7471] font-sans flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[#202524] font-semibold">#{issue.issueNumber}</span>
                      <span>opened by @{issue.author.username}</span>
                      <span>•</span>
                      <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
                    </p>
                  </div>
                </div>

                {/* Right Side: Assignee & Comments Count */}
                <div className="flex items-center gap-4 shrink-0">
                  {issue.assignee && (
                    <div
                      className="flex items-center gap-1.5 text-xs text-[#6B7471]"
                      title={`Assigned to ${issue.assignee.name}`}
                    >
                      <img
                        src={
                          issue.assignee.avatarUrl ||
                          `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(issue.assignee.name)}`
                        }
                        alt={issue.assignee.name}
                        className="w-5 h-5 rounded-full ring-1 ring-[#E2E6E4]"
                      />
                      <span className="hidden sm:inline text-[11px] font-mono font-medium">
                        @{issue.assignee.username}
                      </span>
                    </div>
                  )}

                  {issue.comments.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-[#6B7471] font-mono font-semibold">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{issue.comments.length}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Issue Modal */}
      {isCreateModalOpen && (
        <CreateIssueModal
          teamId={team.id}
          teamMembers={team.members}
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={fetchIssues}
        />
      )}

      {/* Issue Detail / Discussion Modal */}
      {selectedIssue && (
        <IssueDetailModal
          teamId={team.id}
          issue={selectedIssue}
          teamMembers={team.members}
          onClose={() => setSelectedIssue(null)}
          onUpdated={() => {
            fetchIssues();
            // Also refresh active selected issue if still open
            fetch(`/api/teams/${team.id}/issues/${selectedIssue.id}`)
              .then((res) => res.json())
              .then((data) => {
                if (data.issue) setSelectedIssue(data.issue);
              })
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
};
