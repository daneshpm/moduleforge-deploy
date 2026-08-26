import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageCheck, Download, Trash2, Eye, Plus, Github, ShieldCheck, Layers, AlertTriangle } from 'lucide-react';
import { useModuleStore } from '../store/useModuleStore';
import { Module } from '../types';

export const MyModulesPage: React.FC = () => {
  const navigate = useNavigate();
  const { modules, fetchModules, deleteModule } = useModuleStore();

  const [deletingModule, setDeletingModule] = useState<Module | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const handleDeleteConfirm = async () => {
    if (!deletingModule) return;
    setIsDeleting(true);
    setDeleteError(null);
    const result = await deleteModule(deletingModule.id);
    setIsDeleting(false);
    if (result.success) {
      setDeletingModule(null);
    } else {
      setDeleteError(result.error || 'Failed to delete module folder');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <PackageCheck className="w-8 h-8 text-indigo-400" />
            <span>My Published Modules</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your uploaded software packages and imported GitHub repositories.
          </p>
        </div>

        <button
          onClick={() => navigate('/modules/create')}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Module</span>
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-mono border-b border-slate-800">
            <tr>
              <th className="p-4">Module Name</th>
              <th className="p-4">Category</th>
              <th className="p-4">Version</th>
              <th className="p-4">Source Type</th>
              <th className="p-4">Status</th>
              <th className="p-4">Downloads</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {modules.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 font-mono">
                  No modules published yet.
                </td>
              </tr>
            ) : (
              modules.map((mod) => (
                <tr key={mod.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-4 font-bold text-white flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <span className="block">{mod.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono font-normal">by {mod.author}</span>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-slate-400">{mod.categoryName}</td>
                  <td className="p-4 font-mono text-indigo-300">v{mod.version}</td>
                  <td className="p-4 font-mono">
                    {mod.sourceType === 'github' ? (
                      <span className="inline-flex items-center gap-1 text-purple-400">
                        <Github className="w-3.5 h-3.5" /> GitHub Repo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5" /> ZIP Archive
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      Published
                    </span>
                  </td>
                  <td className="p-4 font-mono text-slate-300">{mod.downloads} downloads</td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => navigate(`/modules/${mod.id}`)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="View Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => window.open(`/api/modules/${mod.id}/download`, '_blank')}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 transition"
                      title="Download ZIP"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingModule(mod)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                      title="Delete Module Folder"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingModule && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-white">Delete Module Folder?</h2>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete module folder <strong className="text-white">{deletingModule.name}</strong> (v{deletingModule.version})? This will permanently remove its database record and stored package ZIP files.
            </p>

            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeletingModule(null);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
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

