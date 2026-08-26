import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Download,
  Github,
  Plus,
  ArrowLeft,
  Layers,
  Sparkles,
  CheckCircle2,
  FileCode2,
  Code2,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  Globe,
  Edit3,
  X,
  Check,
} from 'lucide-react';
import { Module, ModuleJson } from '../types';
import { useProjectStore } from '../store/useProjectStore';
import { useModuleStore } from '../store/useModuleStore';
import { GitHubSyncCard } from '../components/GitHubSyncCard';

export const ModuleDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentProject, addModuleToCurrentProject } = useProjectStore();
  const { deleteModule, updateModule } = useModuleStore();

  const [module, setModule] = useState<Module | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'ai' | 'files'>('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit Module Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editVersion, setEditVersion] = useState('');
  const [editDeployedUrl, setEditDeployedUrl] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const fetchModuleData = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/modules/${id}`);
      if (!res.ok) throw new Error('Module not found');
      const data = await res.json();
      setModule(data);
      setEditName(data.name || '');
      setEditDescription(data.description || '');
      setEditCategory(data.categoryName || 'Other');
      setEditVersion(data.version || '1.0.0');
      setEditDeployedUrl(data.deployedUrl || '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModuleData();
  }, [id]);

  const handleOpenEdit = () => {
    if (!module) return;
    setEditName(module.name);
    setEditDescription(module.description);
    setEditCategory(module.categoryName);
    setEditVersion(module.version);
    setEditDeployedUrl(module.deployedUrl || '');
    setEditError(null);
    setEditSuccess(null);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!module) return;

    if (editDeployedUrl.trim()) {
      const trimmed = editDeployedUrl.trim();
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        setEditError('Deployed link must be a valid URL starting with http:// or https://');
        return;
      }
    }

    setIsSavingEdit(true);
    setEditError(null);

    const result = await updateModule(module.id, {
      name: editName.trim(),
      description: editDescription.trim(),
      category: editCategory.trim(),
      version: editVersion.trim(),
      deployedUrl: editDeployedUrl.trim() || undefined,
    });

    setIsSavingEdit(false);

    if (result.success && result.module) {
      setModule(result.module);
      setEditSuccess('Module updated successfully!');
      setTimeout(() => {
        setShowEditModal(false);
        setEditSuccess(null);
      }, 800);
    } else {
      setEditError(result.error || 'Failed to update module');
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-[#1F5E4B] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-mono text-[#6B7471]">Loading module specifications...</p>
      </div>
    );
  }

  if (error || !module) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4 pt-16">
        <div className="p-4 rounded-2xl bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A] text-sm">
          {error || 'Module not found'}
        </div>
        <button
          onClick={() => navigate('/modules')}
          className="px-4 py-2 bg-[#1F5E4B] text-white rounded-xl text-xs font-bold"
        >
          Back to Marketplace
        </button>
      </div>
    );
  }

  let parsed: ModuleJson | null = null;
  try {
    parsed = typeof module.moduleJson === 'string' ? JSON.parse(module.moduleJson) : module.moduleJson;
  } catch (e) {
    // ignore
  }

  const isAlreadyAdded = currentProject?.modules.some(
    (pm) => (pm.module?.id || pm.moduleId) === module.id
  );

  const handleDownload = () => {
    window.open(`/api/modules/${module.id}/download`, '_blank');
  };

  const handleAdd = () => {
    if (currentProject) {
      addModuleToCurrentProject(module);
      navigate(`/builder/${currentProject.id}`);
    } else {
      navigate('/projects');
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Back Link */}
      <button
        onClick={() => navigate('/modules')}
        className="inline-flex items-center gap-2 text-xs font-mono text-[#6B7471] hover:text-[#202524] transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Modules</span>
      </button>

      {/* Module Overview Header */}
      <div className="p-8 rounded-3xl bg-white border border-[#E2E6E4] space-y-6 relative overflow-hidden shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#EAF3EF] border border-[#1F5E4B]/20 flex items-center justify-center shrink-0">
              <Layers className="w-7 h-7 text-[#1F5E4B]" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-extrabold text-[#202524]">{module.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 font-bold">
                  v{module.version}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F7F8F7] text-[#6B7471] border border-[#E2E6E4]">
                  {module.categoryName}
                </span>
              </div>
              <p className="text-xs text-[#6B7471] font-mono">
                by <span className="text-[#1F5E4B] font-semibold">{module.author}</span> • Updated {new Date(module.updatedAt).toLocaleDateString()}
              </p>

              {/* Live Deployed Link Status in Header */}
              {module.deployedUrl && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="flex items-center gap-1 text-xs font-mono text-[#2E7D5B] font-bold">
                    <span className="w-2 h-2 rounded-full bg-[#2E7D5B] animate-pulse" />
                    <span>● Deployed:</span>
                  </span>
                  <a
                    href={module.deployedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-[#1F5E4B] hover:underline font-semibold flex items-center gap-1"
                  >
                    <span>{module.deployedUrl}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* View Live Website Button (Conditional Display) */}
            {module.deployedUrl && (
              <a
                href={module.deployedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-[#EAF3EF] hover:bg-[#1F5E4B] text-[#1F5E4B] hover:text-white font-bold text-xs border border-[#1F5E4B]/20 shadow-xs flex items-center gap-2 transition"
                title={`Open live deployed website: ${module.deployedUrl}`}
              >
                <Globe className="w-4 h-4" />
                <span>View Live Website</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            {module.githubUrl && (
              <a
                href={module.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#202524] text-xs font-semibold border border-[#E2E6E4] flex items-center gap-2 transition"
              >
                <Github className="w-4 h-4 text-[#202524]" />
                <span>View Repo</span>
              </a>
            )}

            <button
              onClick={handleOpenEdit}
              className="px-3.5 py-2 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#202524] text-xs font-semibold border border-[#E2E6E4] flex items-center gap-2 transition"
              title="Edit Module & Deployed Link"
            >
              <Edit3 className="w-4 h-4 text-[#1F5E4B]" />
              <span>Edit Module</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-3.5 py-2 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#1F5E4B] text-xs font-semibold border border-[#E2E6E4] flex items-center gap-2 transition"
            >
              <Download className="w-4 h-4 text-[#1F5E4B]" />
              <span>Download ZIP</span>
            </button>

            <button
              onClick={handleAdd}
              disabled={isAlreadyAdded}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                isAlreadyAdded
                  ? 'bg-[#EAF3EF] text-[#1F5E4B] cursor-default border border-[#1F5E4B]/20'
                  : 'bg-[#1F5E4B] hover:bg-[#174739] text-white shadow-md shadow-[#1F5E4B]/20'
              }`}
            >
              {isAlreadyAdded ? (
                'Added to Canvas ✓'
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add to Project</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-3.5 py-2 rounded-xl bg-[#F7F8F7] hover:bg-[#FDF3F3] text-[#6B7471] hover:text-[#C94A4A] text-xs font-semibold border border-[#E2E6E4] hover:border-[#C94A4A]/30 flex items-center gap-2 transition"
              title="Delete Module Folder"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        <p className="text-sm text-[#202524] leading-relaxed border-t border-[#E2E6E4] pt-4">
          {module.description}
        </p>

        {/* Quick Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 font-mono text-xs text-[#6B7471]">
          <div>
            <span className="text-[#6B7471] block text-[10px] uppercase">TOTAL DOWNLOADS</span>
            <span className="text-[#202524] font-bold">{module.downloads}</span>
          </div>
          <div>
            <span className="text-[#6B7471] block text-[10px] uppercase">SOURCE TYPE</span>
            <span className="text-[#1F5E4B] font-bold uppercase">{module.sourceType}</span>
          </div>
          <div>
            <span className="text-[#6B7471] block text-[10px] uppercase">TECHNOLOGIES</span>
            <span className="text-[#202524] font-bold">{module.technologies?.slice(0, 2).join(', ') || 'React'}</span>
          </div>
          <div>
            <span className="text-[#6B7471] block text-[10px] uppercase">VERSION</span>
            <span className="text-[#202524] font-bold">v{module.version}</span>
          </div>
        </div>
      </div>

      {/* GitHub Sync Section */}
      <GitHubSyncCard module={module} onModuleUpdated={(updated) => setModule(updated)} />

      {/* Module Runtime Configuration Specifications */}
      <div className="p-5 rounded-2xl bg-white border border-[#E2E6E4] space-y-4 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-[#202524] text-sm">
            <Terminal className="w-4 h-4 text-[#1F5E4B]" />
            <span>Module Runtime Configuration</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 font-bold">
            Original Launch Spec ✓
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4]">
            <span className="text-[#6B7471] block text-[10px] uppercase">Frontend Command</span>
            <span className="text-[#2E7D5B] font-bold">{module.frontendCommand || 'npm run dev'}</span>
          </div>
          <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4]">
            <span className="text-[#6B7471] block text-[10px] uppercase">Backend Command</span>
            <span className="text-[#1F5E4B] font-bold">{module.backendCommand || 'None'}</span>
          </div>
          <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4]">
            <span className="text-[#6B7471] block text-[10px] uppercase">Frontend Port / URL</span>
            <span className="text-[#202524] font-bold">{module.frontendUrl || `http://localhost:${module.frontendPort || 5173}`}</span>
          </div>
          <div className="p-3 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4]">
            <span className="text-[#6B7471] block text-[10px] uppercase">Deployed Live URL</span>
            <span className="text-[#2E7D5B] font-bold truncate block">{module.deployedUrl || 'Not configured'}</span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-[#E2E6E4] gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 transition relative ${
            activeTab === 'overview'
              ? 'text-[#1F5E4B] border-b-2 border-[#1F5E4B] font-bold'
              : 'text-[#6B7471] hover:text-[#202524]'
          }`}
        >
          Specifications & Schema
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`pb-3 transition relative ${
            activeTab === 'files'
              ? 'text-[#1F5E4B] border-b-2 border-[#1F5E4B] font-bold'
              : 'text-[#6B7471] hover:text-[#202524]'
          }`}
        >
          File Structure & Entry Points
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Routes */}
          <div className="p-5 rounded-2xl bg-white border border-[#E2E6E4] space-y-3 shadow-card">
            <h3 className="font-bold text-sm text-[#202524] flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#1F5E4B]" />
              <span>Exposed Routes & Endpoints</span>
            </h3>
            {parsed?.routes && parsed.routes.length > 0 ? (
              <ul className="space-y-1.5 font-mono text-xs">
                {parsed.routes.map((route: string, i: number) => (
                  <li key={i} className="p-2 rounded-lg bg-[#F7F8F7] border border-[#E2E6E4] text-[#1F5E4B]">
                    {route}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[#6B7471] italic">No routes specified.</p>
            )}
          </div>

          {/* Inputs & Outputs */}
          <div className="p-5 rounded-2xl bg-white border border-[#E2E6E4] space-y-3 shadow-card">
            <h3 className="font-bold text-sm text-[#202524] flex items-center gap-2">
              <Code2 className="w-4 h-4 text-[#1F5E4B]" />
              <span>Inputs & Output Schemas</span>
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[11px] font-mono text-[#6B7471] block mb-1">OUTPUTS</span>
                {parsed?.outputs && parsed.outputs.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {parsed.outputs.map((out: any, i: number) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-[#EAF3EF] border border-[#1F5E4B]/20 text-[#1F5E4B] font-mono">
                        {out.name}: <span className="text-[#6B7471]">{out.type}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[#6B7471] italic">None</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'files' && (
        <div className="p-6 rounded-3xl bg-white border border-[#E2E6E4] space-y-4 font-mono text-xs shadow-card">
          <h3 className="font-bold text-sm text-[#202524] flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-[#1F5E4B]" />
            <span>Declared Entry Points</span>
          </h3>
          <div className="bg-[#F7F8F7] p-4 rounded-2xl border border-[#E2E6E4] space-y-2">
            <div className="flex items-center justify-between text-[#202524]">
              <span className="text-[#6B7471]">Frontend Entry Point:</span>
              <span className="text-[#1F5E4B] font-semibold">{parsed?.entryPoints?.frontend || 'frontend/'}</span>
            </div>
            <div className="flex items-center justify-between text-[#202524]">
              <span className="text-[#6B7471]">Backend Entry Point:</span>
              <span className="text-[#2E7D5B] font-semibold">{parsed?.entryPoints?.backend || 'backend/'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Edit Module Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-[#202524]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-white border border-[#E2E6E4] rounded-3xl p-6 w-full max-w-lg space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#E2E6E4] pb-3">
              <h2 className="text-lg font-bold text-[#202524] flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#1F5E4B]" />
                <span>Edit Module & Deployed Link</span>
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#202524]">Module Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2.5 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#202524]">Description *</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B] h-20"
                  required
                />
              </div>

              {/* Deployed Link */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#202524] flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#1F5E4B]" />
                    <span>Deployed Link</span>
                  </label>
                  <span className="text-[10px] text-[#6B7471] font-mono">Optional</span>
                </div>
                <input
                  type="url"
                  value={editDeployedUrl}
                  onChange={(e) => setEditDeployedUrl(e.target.value)}
                  placeholder="https://............."
                  className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] font-mono"
                />
                <p className="text-[11px] text-[#6B7471]">
                  Add, change, or clear the live URL of your deployed module. Clear the field to remove the link.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#202524]">Version</label>
                  <input
                    type="text"
                    value={editVersion}
                    onChange={(e) => setEditVersion(e.target.value)}
                    className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2 text-xs text-[#202524] font-mono focus:outline-none focus:border-[#1F5E4B]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#202524]">Category</label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2 text-xs text-[#202524] focus:outline-none focus:border-[#1F5E4B]"
                  />
                </div>
              </div>

              {editError && (
                <div className="p-3 rounded-xl bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A] text-xs font-mono">
                  {editError}
                </div>
              )}

              {editSuccess && (
                <div className="p-3 rounded-xl bg-[#F0F9F5] border border-[#2E7D5B]/20 text-[#2E7D5B] text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>{editSuccess}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-[#E2E6E4]">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#6B7471] hover:text-[#202524] text-xs font-semibold border border-[#E2E6E4]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-[#202524]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-[#E2E6E4] rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-[#C94A4A]">
              <div className="p-2 rounded-2xl bg-[#FDF3F3] border border-[#C94A4A]/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-[#202524]">Delete Module Folder?</h2>
            </div>

            <p className="text-xs text-[#6B7471] leading-relaxed">
              Are you sure you want to delete module folder <strong className="text-[#202524]">{module.name}</strong> (v{module.version})? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3 pt-2 border-t border-[#E2E6E4]">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-[#F7F8F7] text-[#6B7471] hover:text-[#202524] text-xs font-semibold hover:bg-[#EAF3EF] transition border border-[#E2E6E4]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsDeleting(true);
                  const res = await deleteModule(module.id);
                  setIsDeleting(false);
                  if (res.success) {
                    navigate('/modules');
                  } else {
                    alert(res.error || 'Failed to delete module');
                  }
                }}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-[#C94A4A] hover:bg-[#A83B3B] text-white text-xs font-bold shadow-md shadow-[#C94A4A]/20 flex items-center gap-2 transition"
              >
                {isDeleting ? 'Deleting...' : 'Delete Module Folder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
