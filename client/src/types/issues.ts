export type IssueStatus = 'open' | 'in_progress' | 'closed';
export type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';

export interface IssueAuthor {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
}

export interface TeamIssueComment {
  id: string;
  issueId: string;
  author: IssueAuthor;
  content: string;
  createdAt: string;
}

export interface TeamIssue {
  id: string;
  teamId: string;
  issueNumber: number;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  labels: string[];
  author: IssueAuthor;
  assignee: IssueAuthor | null;
  comments: TeamIssueComment[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface IssueFilterOptions {
  status: 'all' | 'open' | 'closed' | 'in_progress';
  priority: 'all' | 'low' | 'medium' | 'high' | 'urgent';
  label: string;
  assigneeId: string;
  search: string;
}
