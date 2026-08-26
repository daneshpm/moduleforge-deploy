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
  Calendar,
  Tag,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Module, ModuleJson } from '../types';
import { useProjectStore } from '../store/useProjectStore';
import { useModuleStore } from '../store/useModuleStore';
import { GitHubSyncCard } from '../components/GitHubSyncCard';

export const ModuleDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentProject, addModuleToCurrentProject } = useProjectStore();
  const { deleteModule } = useModuleStore();

  const [module, setModule] = useState<Module | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'ai' | 'files'>('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    fetch(`/api/modules/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Module not found');
        return res.json();
      })
      .then((data) => {
        setModule(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-mono text-slate-400">Loading module specifications...</p>
      </div>
    );
  }

  if (error || !module) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4 pt-16">
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          {error || 'Module not found'}
        </div>
        <button
          onClick={() => navigate('/modules')}
          className="px-4 py-2 bg-slate-800 text-slate-200 rounded-lg text-xs font-semibold"
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
        className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Modules</span>
      </button>

      {/* Module Overview Header */}
      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Layers className="w-7 h-7 text-indigo-400" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-extrabold text-white">{module.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  v{module.version}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  {module.categoryName}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                by <span className="text-indigo-400 font-semibold">{module.author}</span> • Updated {new Date(module.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            {module.githubUrl && (
              <a
                href={module.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-2 transition"
              >
                <Github className="w-4 h-4" />
                <span>View Repository</span>
              </a>
            )}

            <button
              onClick={async () => {
                let targetProjectId = currentProject?.id;
                if (!targetProjectId) {
                  const newProj = await useProjectStore.getState().createProject(`${module.name} Workspace`);
                  targetProjectId = newProj?.id;
                }
                if (targetProjectId) {
                  let pm = currentProject?.modules.find((p) => p.moduleId === module.id);
                  if (!pm) {
                    addModuleToCurrentProject(module);
                    const freshProj = useProjectStore.getState().currentProject;
                    pm = freshProj?.modules.find((p) => p.moduleId === module.id);
                  }
                  if (pm) {
                    useProjectStore.getState().startLocalModule(targetProjectId, pm.id);
                  }
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition"
            >
              <ExternalLink className="w-4 h-4" />
              <span>View & Run Local</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-2 transition"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span>Download ZIP</span>
            </button>

            <button
              onClick={handleAdd}
              disabled={isAlreadyAdded}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                isAlreadyAdded
                  ? 'bg-slate-800 text-slate-500 cursor-default border border-slate-700'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
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
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-xs font-semibold border border-slate-700 hover:border-rose-500/30 flex items-center gap-2 transition"
              title="Delete Module Folder"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed border-t border-slate-800/80 pt-4">
          {module.description}
        </p>

        {/* Quick Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 font-mono text-xs text-slate-400">
          <div>
            <span className="text-slate-500 block text-[10px]">TOTAL DOWNLOADS</span>
            <span className="text-white font-bold">{module.downloads}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">SOURCE TYPE</span>
            <span className="text-indigo-400 font-bold uppercase">{module.sourceType}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">TECHNOLOGIES</span>
            <span className="text-white font-bold">{module.technologies?.slice(0, 2).join(', ') || 'React'}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">VERSION</span>
            <span className="text-white font-bold">v{module.version}</span>
          </div>
        </div>
      </div>

      {/* GitHub Sync Section */}
      <GitHubSyncCard module={module} onModuleUpdated={(updated) => setModule(updated)} />

      {/* Module Runtime Configuration Specifications */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <Terminal className="w-4 h-4 text-purple-400" />
            <span>Module Runtime Configuration</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">
            Original Launch Spec ✓
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Frontend Command</span>
            <span className="text-emerald-400 font-bold">{module.frontendCommand || 'npm run dev'}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Backend Command</span>
            <span className="text-indigo-400 font-bold">{module.backendCommand || 'None'}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Frontend Port / URL</span>
            <span className="text-slate-200 font-bold">{module.frontendUrl || `http://localhost:${module.frontendPort || 5173}`}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Working Dir</span>
            <span className="text-slate-200 font-bold">{module.workingDir || '.'}</span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-800 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 transition relative ${
            activeTab === 'overview'
              ? 'text-indigo-400 border-b-2 border-indigo-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Specifications & Schema
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`pb-3 transition relative flex items-center gap-1.5 ${
            activeTab === 'ai'
              ? 'text-indigo-400 border-b-2 border-indigo-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>AI Agent Instructions</span>
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`pb-3 transition relative ${
            activeTab === 'files'
              ? 'text-indigo-400 border-b-2 border-indigo-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          File Structure & Entry Points
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Routes */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span>Exposed Routes & Endpoints</span>
            </h3>
            {parsed?.routes && parsed.routes.length > 0 ? (
              <ul className="space-y-1.5 font-mono text-xs">
                {parsed.routes.map((route: string, i: number) => (
                  <li key={i} className="p-2 rounded bg-slate-950 border border-slate-800 text-indigo-300">
                    {route}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 italic">No routes specified.</p>
            )}
          </div>

          {/* Inputs & Outputs */}
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-purple-400" />
              <span>Inputs & Output Schemas</span>
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[11px] font-mono text-slate-500 block mb-1">OUTPUTS</span>
                {parsed?.outputs && parsed.outputs.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {parsed.outputs.map((out: any, i: number) => (
                      <span key={i} className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-emerald-400 font-mono">
                        {out.name}: <span className="text-slate-400">{out.type}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-500 italic">None</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="p-6 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-4">
          <div className="flex items-center gap-2 text-indigo-300 font-bold text-base">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span>AI Coding Agent Integration Guide (`description_for_ai`)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-950 p-4 rounded-xl border border-indigo-500/20">
            {parsed?.description_for_ai || 'No specific description_for_ai provided. Coding agents will analyze module entry points and schemas.'}
          </p>
          <div className="text-xs text-slate-400 space-y-1">
            <span className="font-semibold text-slate-300 block">Antigravity Execution Tip:</span>
            <p>
              When you prompt Antigravity with this exported project, reference this module by name. Antigravity will automatically parse `PROJECT.json` and read these exact instructions.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'files' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 font-mono text-xs">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-indigo-400" />
            <span>Declared Entry Points</span>
          </h3>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-500">Frontend Entry Point:</span>
              <span className="text-indigo-400 font-semibold">{parsed?.entryPoints?.frontend || 'frontend/'}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-500">Backend Entry Point:</span>
              <span className="text-purple-400 font-semibold">{parsed?.entryPoints?.backend || 'backend/'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white">Delete Module Folder?</h2>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete module folder <strong className="text-white">{module.name}</strong> (v{module.version})? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
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
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/30 flex items-center gap-2 transition"
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
