export interface ModuleJson {
  name?: string;
  slug?: string;
  version?: string;
  description?: string;
  author?: string;
  category?: string;
  technologies?: string[];
  routes?: string[];
  inputs?: any[];
  outputs?: any[];
  description_for_ai?: string;
  entryPoints?: {
    frontend?: string;
    backend?: string;
  };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
}

export interface ModuleSyncLog {
  id: string;
  moduleId: string;
  commitSha: string;
  commitMessage?: string;
  author?: string;
  status: 'synced' | 'failed';
  syncedAt: string;
}

export interface Module {
  id: string;
  slug: string;
  name: string;
  description: string;
  author: string;
  categoryName: string;
  category?: Category;
  version: string;
  technologies?: string[];
  sourceType: 'upload' | 'github' | 'moduleforge';
  repositoryType?: 'moduleforge' | 'github' | 'upload';
  repositoryUrl?: string;
  repositoryPath?: string;
  defaultBranch?: string;
  githubUrl?: string;
  githubOwner?: string;
  githubRepo?: string;
  githubBranch?: string;
  githubCurrentCommit?: string;
  githubLatestCommit?: string;
  githubLastSyncedAt?: string;
  githubSyncStatus?: 'synced' | 'update_available' | 'sync_failed' | 'not_connected';
  githubWebhookId?: string;
  frontendCommand?: string;
  backendCommand?: string;
  frontendPort?: number;
  backendPort?: number;
  frontendUrl?: string;
  backendUrl?: string;
  workingDir?: string;
  envVars?: string | string[];
  zipStoragePath?: string;
  deployedUrl?: string | null;
  moduleJson?: string;
  downloads: number;
  isPublished: boolean;
  authorId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModuleMetadataInput {
  name: string;
  description: string;
  category: string;
  author: string;
  version: string;
  technologies: string[];
  sourceType: 'upload' | 'github' | 'moduleforge';
  storagePath?: string;
  githubUrl?: string;
  githubOwner?: string;
  githubRepo?: string;
  githubBranch?: string;
  deployedUrl?: string;
  frontendCommand?: string;
  backendCommand?: string;
  frontendPort?: number;
  backendPort?: number;
  frontendUrl?: string;
  backendUrl?: string;
  workingDir?: string;
  envVars?: string[];
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId?: string;
  user?: User;
  name?: string;
  email: string;
  role: 'owner' | 'developer' | 'viewer';
  status?: 'pending' | 'accepted' | 'rejected';
  inviteToken?: string;
  invitedAt?: string;
  acceptedAt?: string;
  createdAt: string;
}

export interface ModuleDeployment {
  id: string;
  projectModuleId: string;
  commitSha: string;
  commitMessage?: string;
  author?: string;
  deploymentUrl?: string;
  status: 'success' | 'failed' | 'building';
  buildLogs?: string;
  createdAt: string;
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  moduleName?: string;
  action: string;
  actorName?: string;
  description: string;
  commitSha?: string;
  status: 'synced' | 'updating' | 'failed';
  createdAt: string;
}

export interface ProjectModule {
  id: string;
  projectId: string;
  moduleId: string;
  module: Module;
  moduleVersion: string;
  xPosition: number;
  yPosition: number;
  configuration?: string;
  ownerName?: string;
  ownerEmail?: string;
  repositoryType?: 'moduleforge' | 'github' | 'upload';
  repositoryPath?: string;
  currentBranch?: string;
  gitStatus?: 'up_to_date' | 'changes_available' | 'local_changes' | 'conflict';
  githubRepository?: string;
  githubBranch?: string;
  currentCommitSha?: string;
  lastCommitMessage?: string;
  lastCommitAuthor?: string;
  lastSyncedAt?: string;
  deploymentUrl?: string;
  deploymentStatus?: 'synced' | 'updating' | 'failed';
  deployments?: ModuleDeployment[];
}

export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'conflict';
  code: string;
}

export interface GitStatusResult {
  branch: string;
  isClean: boolean;
  gitStatus: 'up_to_date' | 'changes_available' | 'local_changes' | 'conflict';
  changesCount: number;
  files: GitFileStatus[];
  hasConflicts: boolean;
  conflictFiles: string[];
  ahead: number;
  behind: number;
  latestCommit?: {
    sha: string;
    message: string;
    author: string;
    date: string;
  };
}

export interface GitCommitRecord {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
  branch: string;
  changedFiles?: string[];
}

export interface GitCommitItem {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
}

export interface FileTreeItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  children?: FileTreeItem[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  userId?: string;
  user?: User;
  teamId?: string;
  team?: Team;
  projectType: 'individual' | 'team';
  visibility: 'private' | 'public';
  joinCode?: string;
  canvasConfig?: string;
  gitRepositoryUrl?: string;
  gitOwner?: string;
  gitRepo?: string;
  gitBranch?: string;
  currentCommitSha?: string;
  lastSyncedAt?: string;
  syncStatus?: 'synced' | 'updating' | 'failed';
  createdAt: string;
  updatedAt: string;
  modules: ProjectModule[];
  members?: ProjectMember[];
  activities?: ProjectActivity[];
}

export interface User {
  id: string;
  email: string;
  name?: string;
  username?: string;
  avatarUrl?: string;
  googleId?: string;
  isDev?: boolean;
  lastLogin?: string;
  createdAt?: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  ownerId: string;
  owner?: {
    id: string;
    name?: string;
    username?: string;
    avatarUrl?: string;
  };
  members?: TeamMember[];
  projects?: Project[];
  invitations?: TeamInvitation[];
  userRole?: 'owner' | 'admin' | 'member';
  memberCount?: number;
  projectCount?: number;
  pendingInviteCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  user: {
    id: string;
    name?: string;
    username?: string;
    avatarUrl?: string;
  };
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  team?: Team;
  inviterId: string;
  inviter?: {
    id: string;
    name?: string;
    username?: string;
    avatarUrl?: string;
  };
  inviteeUserId?: string;
  inviteeUser?: {
    id: string;
    name?: string;
    username?: string;
    avatarUrl?: string;
  };
  inviteeEmail?: string;
  role: 'admin' | 'member';
  token: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'team_invitation' | 'invitation_accepted' | 'invitation_declined' | 'member_removed' | 'system';
  title: string;
  message: string;
  relatedTeamId?: string;
  relatedTeam?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  relatedInvitationId?: string;
  relatedInvitation?: {
    id: string;
    token: string;
    status: string;
    role: string;
    expiresAt: string;
  };
  read: boolean;
  createdAt: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  message?: string;
  storagePath?: string;
  fileInfo?: {
    filename: string;
    sizeBytes: number;
    fileCount: number;
  };
  repoInfo?: {
    name: string;
    owner: string;
    repo: string;
    defaultBranch: string;
    description: string;
    htmlUrl: string;
    stars?: number;
  };
  extractedMetadata?: {
    name?: string;
    slug?: string;
    description?: string;
    author?: string;
    category?: string;
    version?: string;
    technologies?: string[];
  };
}
