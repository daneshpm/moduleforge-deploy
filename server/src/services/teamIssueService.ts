import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

class TeamIssueService {
  private issues: Map<string, TeamIssue[]> = new Map();
  private storagePath: string;

  constructor() {
    const dataDir = path.join(__dirname, '..', '..', 'uploads', 'data');
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (_) {}
    this.storagePath = path.join(dataDir, 'team_issues.json');
    this.loadFromFile();
  }

  private loadFromFile() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf8');
        const data = JSON.parse(raw);
        if (typeof data === 'object' && data !== null) {
          for (const [teamId, issueList] of Object.entries(data)) {
            if (Array.isArray(issueList)) {
              this.issues.set(teamId, issueList);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Could not load team issues from disk, using in-memory store:', err);
    }
  }

  private saveToFile() {
    try {
      const obj: Record<string, TeamIssue[]> = {};
      for (const [teamId, list] of this.issues.entries()) {
        obj[teamId] = list;
      }
      fs.writeFileSync(this.storagePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch (err) {
      console.warn('Could not persist team issues to disk:', err);
    }
  }

  public getIssues(teamId: string, filters?: {
    status?: string;
    priority?: string;
    label?: string;
    search?: string;
    assigneeId?: string;
  }): { issues: TeamIssue[]; openCount: number; closedCount: number } {
    let list = this.issues.get(teamId) || [];

    const openCount = list.filter((i) => i.status !== 'closed').length;
    const closedCount = list.filter((i) => i.status === 'closed').length;

    if (filters?.status && filters.status !== 'all') {
      if (filters.status === 'open') {
        list = list.filter((i) => i.status !== 'closed');
      } else if (filters.status === 'closed') {
        list = list.filter((i) => i.status === 'closed');
      } else {
        list = list.filter((i) => i.status === filters.status);
      }
    }

    if (filters?.priority && filters.priority !== 'all') {
      list = list.filter((i) => i.priority === filters.priority);
    }

    if (filters?.label && filters.label !== 'all') {
      list = list.filter((i) => i.labels.includes(filters.label!));
    }

    if (filters?.assigneeId && filters.assigneeId !== 'all') {
      list = list.filter((i) => i.assignee?.id === filters.assigneeId);
    }

    if (filters?.search && filters.search.trim()) {
      const query = filters.search.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(query) ||
          i.description.toLowerCase().includes(query) ||
          i.labels.some((l) => l.toLowerCase().includes(query)) ||
          i.author.name.toLowerCase().includes(query) ||
          i.author.username.toLowerCase().includes(query)
      );
    }

    // Sort by latest updated
    const sorted = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { issues: sorted, openCount, closedCount };
  }

  public getIssueById(teamId: string, issueId: string): TeamIssue | null {
    const list = this.issues.get(teamId) || [];
    return list.find((i) => i.id === issueId) || null;
  }

  public createIssue(
    teamId: string,
    data: {
      title: string;
      description: string;
      priority?: IssuePriority;
      labels?: string[];
      author: IssueAuthor;
      assignee?: IssueAuthor | null;
    }
  ): TeamIssue {
    const list = this.issues.get(teamId) || [];
    const issueNumber = list.length + 1;
    const now = new Date().toISOString();

    const newIssue: TeamIssue = {
      id: `issue-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      teamId,
      issueNumber,
      title: data.title.trim(),
      description: data.description?.trim() || '',
      status: 'open',
      priority: data.priority || 'medium',
      labels: Array.isArray(data.labels) ? data.labels : ['bug'],
      author: data.author,
      assignee: data.assignee || null,
      comments: [],
      createdAt: now,
      updatedAt: now,
      closedAt: null,
    };

    list.unshift(newIssue);
    this.issues.set(teamId, list);
    this.saveToFile();

    return newIssue;
  }

  public updateIssue(
    teamId: string,
    issueId: string,
    updates: Partial<{
      title: string;
      description: string;
      status: IssueStatus;
      priority: IssuePriority;
      labels: string[];
      assignee: IssueAuthor | null;
    }>
  ): TeamIssue | null {
    const list = this.issues.get(teamId) || [];
    const index = list.findIndex((i) => i.id === issueId);
    if (index === -1) return null;

    const existing = list[index];
    const now = new Date().toISOString();

    let closedAt = existing.closedAt;
    if (updates.status === 'closed' && existing.status !== 'closed') {
      closedAt = now;
    } else if (updates.status && updates.status !== 'closed') {
      closedAt = null;
    }

    const updatedIssue: TeamIssue = {
      ...existing,
      ...updates,
      updatedAt: now,
      closedAt,
    };

    list[index] = updatedIssue;
    this.issues.set(teamId, list);
    this.saveToFile();

    return updatedIssue;
  }

  public addComment(
    teamId: string,
    issueId: string,
    author: IssueAuthor,
    content: string
  ): TeamIssueComment | null {
    const list = this.issues.get(teamId) || [];
    const issue = list.find((i) => i.id === issueId);
    if (!issue) return null;

    const now = new Date().toISOString();
    const comment: TeamIssueComment = {
      id: `comment-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      issueId,
      author,
      content: content.trim(),
      createdAt: now,
    };

    issue.comments.push(comment);
    issue.updatedAt = now;
    this.saveToFile();

    return comment;
  }

  public deleteIssue(teamId: string, issueId: string): boolean {
    const list = this.issues.get(teamId) || [];
    const filtered = list.filter((i) => i.id !== issueId);
    if (filtered.length === list.length) return false;

    this.issues.set(teamId, filtered);
    this.saveToFile();
    return true;
  }
}

export const teamIssueService = new TeamIssueService();
