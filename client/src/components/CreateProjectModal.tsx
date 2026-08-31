import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderGit2,
  Github,
  Plus,
  Lock,
  Globe,
  Link,
  Shield,
  Layers,
  Users,
  User,
  CheckCircle2,
  Loader2,
  X,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';
import { useProjectStore } from '../store/useProjectStore';
import { useAuthStore } from '../store/useAuthStore';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTeamId?: string;
  defaultProjectType?: 'individual' | 'team';
}

type RepositoryOption = 'create_new' | 'connect_existing' | 'none';

interface StepProgress {
  step: number;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  initialTeamId,
  defaultProjectType = 'individual',
}) => {
  const navigate = useNavigate();
  const { createProject } = useProjectStore();
  const { user } = useAuthStore();

  // General project info
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectType, setProjectType] = useState<'individual' | 'team'>(defaultProjectType);
  const [teamId, setTeamId] = useState<string | undefined>(initialTeamId);

  // Repository choice
  const [repoOption, setRepoOption] = useState<RepositoryOption>('create_new');

  // Option 1 fields (Create New Repository)
  const [repoName, setRepoName] = useState('');
  const [repoDescription, setRepoDescription] = useState('');
  const [repoVisibility, setRepoVisibility] = useState<'private' | 'public'>('private');

  // Option 2 fields (Connect Existing Repository)
  const [githubUrl, setGithubUrl] = useState('');
  const [repoOwner, setRepoOwner] = useState('');
  const [existingRepoName, setExistingRepoName] = useState('');

  // Personal GitHub Token Management (Private to current user)
  const [githubToken, setGithubToken] = useState<string>('');
  const [showTokenSecret, setShowTokenSecret] = useState(false);
  const [isEditingToken, setIsEditingToken] = useState(false);
  const [saveTokenToStorage, setSaveTokenToStorage] = useState(true);

  // Creation & Progress State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepProgress[]>([]);

  useEffect(() => {
    if (isOpen) {
      const savedToken = localStorage.getItem('moduleforge_github_token') || '';
      setGithubToken(savedToken);
      setIsEditingToken(!savedToken);
      setCreationError(null);
      setIsSubmitting(false);
      setSteps([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Auto-sync repository name with project name when typing
  const handleProjectNameChange = (val: string) => {
    setProjectName(val);
    if (!repoName || repoName === projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')) {
      setRepoName(val.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
    }
  };

  // Auto-parse GitHub URL when pasted
  const handleGithubUrlChange = (url: string) => {
    setGithubUrl(url);
    const match = url.replace(/\.git$/, '').match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) {
      setRepoOwner(match[1]);
      setExistingRepoName(match[2]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    // Validate personal GitHub token if user chose a GitHub repository option
    const finalToken = githubToken.trim();
    if (repoOption !== 'none' && !finalToken) {
      setCreationError(
        'Personal GitHub access token is required to create or connect a repository on your GitHub account. Please enter your personal GitHub token below, or select "No Repository" for local development.'
      );
      setIsEditingToken(true);
      return;
    }

    // Save token to localStorage for this user if selected
    if (finalToken && saveTokenToStorage) {
      localStorage.setItem('moduleforge_github_token', finalToken);
    }

    setIsSubmitting(true);
    setCreationError(null);

    // Initialize progress steps
    const initialSteps: StepProgress[] = [
      { step: 1, label: 'Creating project...', status: 'running' },
      {
        step: 2,
        label: repoOption === 'create_new' ? 'Creating GitHub repository...' : 'Connecting repository...',
        status: 'pending',
      },
      { step: 3, label: 'Initializing repository...', status: 'pending' },
      { step: 4, label: 'Creating project files (manifest, README, .gitignore)...', status: 'pending' },
      { step: 5, label: 'Creating initial commit...', status: 'pending' },
      { step: 6, label: 'Opening workspace...', status: 'pending' },
    ];

    setSteps(initialSteps);

    const updateStepStatus = (index: number, status: 'running' | 'completed' | 'error', newLabel?: string) => {
      setSteps((prev) =>
        prev.map((s, i) => {
          if (i === index) {
            return {
              ...s,
              status,
              label: newLabel || s.label,
            };
          }
          if (i === index + 1 && status === 'completed' && s.status === 'pending') {
            return { ...s, status: 'running' };
          }
          return s;
        })
      );
    };

    try {
      const payload: any = {
        name: projectName.trim(),
        description: projectDesc.trim(),
        projectType,
        visibility: repoVisibility,
        teamId,
        repositoryOption: repoOption,
        githubToken: finalToken || undefined,
      };

      if (repoOption === 'create_new') {
        payload.repoName = repoName.trim() || projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        payload.repoDescription = repoDescription.trim() || projectDesc.trim();
        payload.repoVisibility = repoVisibility;
      } else if (repoOption === 'connect_existing') {
        payload.gitRepositoryUrl = githubUrl.trim();
        payload.gitOwner = repoOwner.trim();
        payload.gitRepo = existingRepoName.trim();
      }

      updateStepStatus(0, 'completed', '✓ Project created');
      updateStepStatus(1, 'running');

      const project = await createProject(projectName.trim(), payload);

      if (!project) {
        throw new Error('Failed to create project.');
      }

      updateStepStatus(
        1,
        'completed',
        repoOption === 'create_new' ? '✓ GitHub repository created on your account' : '✓ GitHub repository linked'
      );
      updateStepStatus(2, 'completed', '✓ Repository initialized');
      updateStepStatus(3, 'completed', '✓ Project files created');
      updateStepStatus(4, 'completed', '✓ Initial commit created');
      updateStepStatus(5, 'completed', 'Opening workspace...');

      setTimeout(() => {
        onClose();
        navigate(`/builder/${project.id}`);
      }, 400);
    } catch (err: any) {
      setIsSubmitting(false);
      setCreationError(err.message || 'Failed to create project');
      setSteps((prev) =>
        prev.map((s) => (s.status === 'running' || s.status === 'pending' ? { ...s, status: 'error' } : s))
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl border border-[#E2E6E4] shadow-2xl w-full max-w-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E2E6E4] flex items-center justify-between bg-[#F7F8F7]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#1F5E4B] flex items-center justify-center text-white shadow-sm">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#202524]">Create New Project</h2>
              <p className="text-[11px] text-[#6B7471] font-mono">
                Initialize architecture composition & configure Git repository
              </p>
            </div>
          </div>
          {!isSubmitting && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-[#EAF3EF] text-[#6B7471] hover:text-[#202524] transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {isSubmitting ? (
            /* Creation Progress Stepper View */
            <div className="py-8 space-y-6">
              <div className="text-center space-y-1.5">
                <Loader2 className="w-8 h-8 text-[#1F5E4B] animate-spin mx-auto" />
                <h3 className="text-base font-bold text-[#202524]">Setting Up Your Project</h3>
                <p className="text-xs text-[#6B7471]">
                  Provisioning overall Git repository on your GitHub account...
                </p>
              </div>

              {/* Progress Steps List */}
              <div className="space-y-2.5 max-w-md mx-auto bg-[#F7F8F7] p-4 rounded-2xl border border-[#E2E6E4]">
                {steps.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-xs font-mono">
                    {s.status === 'completed' && (
                      <CheckCircle2 className="w-4 h-4 text-[#2E7D5B] shrink-0" />
                    )}
                    {s.status === 'running' && (
                      <Loader2 className="w-4 h-4 text-[#1F5E4B] animate-spin shrink-0" />
                    )}
                    {s.status === 'pending' && (
                      <span className="w-4 h-4 rounded-full border border-[#6B7471]/30 flex items-center justify-center text-[9px] text-[#6B7471] shrink-0">
                        {idx + 1}
                      </span>
                    )}
                    {s.status === 'error' && (
                      <AlertCircle className="w-4 h-4 text-[#C94A4A] shrink-0" />
                    )}

                    <span
                      className={`${
                        s.status === 'completed'
                          ? 'text-[#202524] font-semibold'
                          : s.status === 'running'
                          ? 'text-[#1F5E4B] font-bold'
                          : s.status === 'error'
                          ? 'text-[#C94A4A] font-bold'
                          : 'text-[#6B7471]/60'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>

              {creationError && (
                <div className="p-3.5 rounded-xl bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A] text-xs font-mono max-w-md mx-auto flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{creationError}</span>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-6">
              {/* General Project Info */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#202524]">Project Name *</label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => handleProjectNameChange(e.target.value)}
                      placeholder="e.g. FoodDelivery, Enterprise ERP"
                      className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#202524]">Project Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setProjectType('individual')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                          projectType === 'individual'
                            ? 'bg-[#EAF3EF] border-[#1F5E4B] text-[#1F5E4B]'
                            : 'bg-[#F7F8F7] border-[#E2E6E4] text-[#6B7471]'
                        }`}
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>Individual</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProjectType('team')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                          projectType === 'team'
                            ? 'bg-[#EAF3EF] border-[#1F5E4B] text-[#1F5E4B]'
                            : 'bg-[#F7F8F7] border-[#E2E6E4] text-[#6B7471]'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Team</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#202524]">Description (Optional)</label>
                  <textarea
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    placeholder="Describe the application, microservices, or modules in this composition..."
                    className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15 h-16"
                  />
                </div>
              </div>

              {/* Project Repository Section */}
              <div className="space-y-3 pt-2 border-t border-[#E2E6E4]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#202524] flex items-center gap-2">
                    <Github className="w-4 h-4 text-[#1F5E4B]" />
                    <span>Project Repository</span>
                  </label>
                  <span className="text-[11px] font-mono text-[#6B7471]">
                    One overall Git repository for complete project
                  </span>
                </div>

                {/* 3 Choices */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Option 1: Create New Repository */}
                  <button
                    type="button"
                    onClick={() => setRepoOption('create_new')}
                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between space-y-2 ${
                      repoOption === 'create_new'
                        ? 'bg-[#EAF3EF] border-[#1F5E4B] shadow-xs'
                        : 'bg-[#F7F8F7] border-[#E2E6E4] hover:border-[#1F5E4B]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-lg bg-white border border-[#1F5E4B]/20 flex items-center justify-center text-[#1F5E4B]">
                        <Plus className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#1F5E4B] text-white">
                        Recommended
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#202524]">Create New Repository</div>
                      <p className="text-[10px] text-[#6B7471] mt-0.5 leading-snug">
                        Create on your GitHub account with manifest & files.
                      </p>
                    </div>
                  </button>

                  {/* Option 2: Connect Existing Repository */}
                  <button
                    type="button"
                    onClick={() => setRepoOption('connect_existing')}
                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between space-y-2 ${
                      repoOption === 'connect_existing'
                        ? 'bg-[#EAF3EF] border-[#1F5E4B] shadow-xs'
                        : 'bg-[#F7F8F7] border-[#E2E6E4] hover:border-[#1F5E4B]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-lg bg-white border border-[#1F5E4B]/20 flex items-center justify-center text-[#1F5E4B]">
                        <Link className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#202524]">Connect Existing</div>
                      <p className="text-[10px] text-[#6B7471] mt-0.5 leading-snug">
                        Connect an existing GitHub repo URL to this project.
                      </p>
                    </div>
                  </button>

                  {/* Option 3: No Repository */}
                  <button
                    type="button"
                    onClick={() => setRepoOption('none')}
                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between space-y-2 ${
                      repoOption === 'none'
                        ? 'bg-[#EAF3EF] border-[#1F5E4B] shadow-xs'
                        : 'bg-[#F7F8F7] border-[#E2E6E4] hover:border-[#1F5E4B]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-lg bg-white border border-[#1F5E4B]/20 flex items-center justify-center text-[#6B7471]">
                        <Layers className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#202524]">No Repository</div>
                      <p className="text-[10px] text-[#6B7471] mt-0.5 leading-snug">
                        Local workspace only without connecting to GitHub.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Conditional Fields based on Choice */}
                {repoOption === 'create_new' && (
                  <div className="p-4 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] space-y-3.5 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-[#202524]">Repository Name</label>
                        <input
                          type="text"
                          value={repoName}
                          onChange={(e) => setRepoName(e.target.value)}
                          placeholder="e.g. food-delivery-app"
                          className="w-full bg-white border border-[#E2E6E4] rounded-xl px-3 py-2 text-xs text-[#202524] font-mono focus:outline-none focus:border-[#1F5E4B]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-[#202524]">Visibility</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setRepoVisibility('private')}
                            className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                              repoVisibility === 'private'
                                ? 'bg-white border-[#1F5E4B] text-[#1F5E4B] shadow-xs'
                                : 'bg-white/60 border-[#E2E6E4] text-[#6B7471]'
                            }`}
                          >
                            <Lock className="w-3 h-3" />
                            <span>Private</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRepoVisibility('public')}
                            className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                              repoVisibility === 'public'
                                ? 'bg-white border-[#1F5E4B] text-[#1F5E4B] shadow-xs'
                                : 'bg-white/60 border-[#E2E6E4] text-[#6B7471]'
                            }`}
                          >
                            <Globe className="w-3 h-3" />
                            <span>Public</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#202524]">Repository Description (Optional)</label>
                      <input
                        type="text"
                        value={repoDescription}
                        onChange={(e) => setRepoDescription(e.target.value)}
                        placeholder="e.g. Production microservice mesh for FoodDelivery composition"
                        className="w-full bg-white border border-[#E2E6E4] rounded-xl px-3 py-2 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B]"
                      />
                    </div>
                  </div>
                )}

                {repoOption === 'connect_existing' && (
                  <div className="p-4 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] space-y-3 animate-fade-in">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#202524]">GitHub Repository URL</label>
                      <input
                        type="url"
                        value={githubUrl}
                        onChange={(e) => handleGithubUrlChange(e.target.value)}
                        placeholder="https://github.com/my-username/my-project-repo"
                        className="w-full bg-white border border-[#E2E6E4] rounded-xl px-3 py-2 text-xs text-[#202524] font-mono focus:outline-none focus:border-[#1F5E4B]"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-[#202524]">Owner / Username</label>
                        <input
                          type="text"
                          value={repoOwner}
                          onChange={(e) => setRepoOwner(e.target.value)}
                          placeholder="e.g. your-github-username"
                          className="w-full bg-white border border-[#E2E6E4] rounded-xl px-3 py-2 text-xs text-[#202524] font-mono focus:outline-none focus:border-[#1F5E4B]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-[#202524]">Repository Name</label>
                        <input
                          type="text"
                          value={existingRepoName}
                          onChange={(e) => setExistingRepoName(e.target.value)}
                          placeholder="e.g. food-delivery"
                          className="w-full bg-white border border-[#E2E6E4] rounded-xl px-3 py-2 text-xs text-[#202524] font-mono focus:outline-none focus:border-[#1F5E4B]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Personal GitHub Token Section (Required for GitHub repo options) */}
                {repoOption !== 'none' && (
                  <div className="p-4 rounded-2xl bg-white border border-[#E2E6E4] space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-[#1F5E4B]" />
                        <span className="text-xs font-bold text-[#202524]">Your Personal GitHub Token</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#EAF3EF] text-[#1F5E4B] text-[9px] font-mono font-bold">
                          Private To You
                        </span>
                      </div>

                      {githubToken && !isEditingToken && (
                        <button
                          type="button"
                          onClick={() => setIsEditingToken(true)}
                          className="text-[11px] font-bold text-[#1F5E4B] hover:underline"
                        >
                          Change Token
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-[#6B7471] leading-relaxed">
                      Your GitHub token is kept private and secure to your browser. Repositories will only ever be created and synced on your personal GitHub account.
                    </p>

                    {githubToken && !isEditingToken ? (
                      <div className="p-2.5 rounded-xl bg-[#F0F9F5] border border-[#2E7D5B]/20 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-mono text-[#2E7D5B] font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Connected (ends with ...{githubToken.slice(-4)})</span>
                        </div>
                        <span className="text-[10px] text-[#2E7D5B] font-mono">Active</span>
                      </div>
                    ) : (
                      <div className="space-y-2.5 pt-1">
                        <div className="relative">
                          <input
                            type={showTokenSecret ? 'text' : 'password'}
                            value={githubToken}
                            onChange={(e) => setGithubToken(e.target.value)}
                            placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl pl-3.5 pr-10 py-2 text-xs text-[#202524] font-mono focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15"
                          />
                          <button
                            type="button"
                            onClick={() => setShowTokenSecret(!showTokenSecret)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7471] hover:text-[#202524]"
                          >
                            {showTokenSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[#6B7471]">
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={saveTokenToStorage}
                              onChange={(e) => setSaveTokenToStorage(e.target.checked)}
                              className="rounded border-[#E2E6E4] text-[#1F5E4B] focus:ring-[#1F5E4B]"
                            />
                            <span>Save token for future projects</span>
                          </label>

                          <a
                            href="https://github.com/settings/tokens/new?scopes=repo,read:user,user:email&description=ModuleForge%20Personal%20Access%20Token"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#1F5E4B] font-bold hover:underline flex items-center gap-1"
                          >
                            <span>Generate Token</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {repoOption === 'none' && (
                  <div className="p-3.5 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] text-xs text-[#6B7471] flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-[#6B7471] shrink-0" />
                    <span>
                      Project will be created in your local workspace. You can connect a Git repository at any time later.
                    </span>
                  </div>
                )}
              </div>

              {creationError && (
                <div className="p-3.5 rounded-xl bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A] text-xs font-mono flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{creationError}</span>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-[#E2E6E4]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#6B7471] hover:text-[#202524] border border-[#E2E6E4] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 flex items-center gap-2 transition transform active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create & Open Project</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
