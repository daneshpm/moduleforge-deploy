import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PackageCheck,
  Download,
  Trash2,
  Eye,
  Plus,
  Github,
  ShieldCheck,
  Layers,
  AlertTriangle,
  ExternalLink,
  Edit3,
  Globe,
  X,
  Check,
} from 'lucide-react';
import { useModuleStore } from '../store/useModuleStore';
import { Module } from '../types';

export const MyModulesPage: React.FC = () => {
  const navigate = useNavigate();
  const { modules, fetchModules, deleteModule, updateModule } = useModuleStore();

  const [deletingModule, setDeletingModule] = useState<Module | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Edit Module Modal State
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editVersion, setEditVersion] = useState('');
  const [editDeployedUrl, setEditDeployedUrl] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const handleOpenEdit = (mod: Module) => {
    setEditingModule(mod);
    setEditName(mod.name);
    setEditDescription(mod.description);
    setEditCategory(mod.categoryName);
    setEditVersion(mod.version);
    setEditDeployedUrl(mod.deployedUrl || '');
    setEditError(null);
    setEditSuccess(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModule) return;

    if (editDeployedUrl.trim()) {
      const trimmed = editDeployedUrl.trim();
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        setEditError('Deployed link must be a valid URL starting with http:// or https://');
        return;
      }
    }

    setIsSavingEdit(true);
    setEditError(null);

    const result = await updateModule(editingModule.id, {
      name: editName.trim(),
      description: editDescription.trim(),
      category: editCategory.trim(),
      version: editVersion.trim(),
      deployedUrl: editDeployedUrl.trim() || undefined,
    });

    setIsSavingEdit(false);

    if (result.success) {
      setEditSuccess('Module updated successfully!');
      fetchModules();
      setTimeout(() => {
        setEditingModule(null);
        setEditSuccess(null);
      }, 800);
    } else {
      setEditError(result.error || 'Failed to update module');
    }
  };

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
          <h1 className="text-3xl font-black text-[#202524] tracking-tight flex items-center gap-3">
            <PackageCheck className="w-8 h-8 text-[#1F5E4B]" />
            <span className="primary-text-gradient">My Published Modules</span>
          </h1>
          <p className="text-sm text-[#6B7471] mt-1">
            Manage your uploaded software packages, live deployed URLs, and imported GitHub repositories.
          </p>
        </div>

        <button
          onClick={() => navigate('/modules/create')}
          className="px-5 py-2.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4 text-white" />
          <span>Upload Module</span>
        </button>
      </div>

      <div className="bg-white border border-[#E2E6E4] rounded-2xl overflow-hidden shadow-card">
        <table className="w-full text-left text-xs text-[#202524]">
          <thead className="bg-[#F7F8F7] text-[#6B7471] font-mono border-b border-[#E2E6E4]">
            <tr>
              <th className="p-4">Module Name</th>
              <th className="p-4">Category</th>
              <th className="p-4">Version</th>
              <th className="p-4">Deployed Live</th>
              <th className="p-4">Source Type</th>
              <th className="p-4">Downloads</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E6E4]">
            {modules.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[#6B7471] font-mono">
                  No modules published yet.
                </td>
              </tr>
            ) : (
              modules.map((mod) => (
                <tr key={mod.id} className="hover:bg-[#EAF3EF]/30 transition">
                  <td className="p-4 font-bold text-[#202524] flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#EAF3EF] border border-[#1F5E4B]/20 flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4 text-[#1F5E4B]" />
                    </div>
                    <div>
                      <span className="block text-[#202524]">{mod.name}</span>
                      <span className="text-[10px] text-[#6B7471] font-mono font-normal">by {mod.author}</span>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-[#6B7471]">{mod.categoryName}</td>
                  <td className="p-4 font-mono text-[#1F5E4B] font-bold">v{mod.version}</td>
                  <td className="p-4 font-mono">
                    {mod.deployedUrl ? (
                      <a
                        href={mod.deployedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 hover:bg-[#1F5E4B] hover:text-white transition"
                        title={mod.deployedUrl}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D5B] animate-pulse" />
                        <span>Preview Module</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-[10px] text-[#6B7471] italic">—</span>
                    )}
                  </td>
                  <td className="p-4 font-mono">
                    {mod.sourceType === 'github' ? (
                      <span className="inline-flex items-center gap-1 text-[#1F5E4B] font-semibold">
                        <Github className="w-3.5 h-3.5" /> GitHub Repo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#2E7D5B] font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5" /> ZIP Archive
                      </span>
                    )}
                  </td>
                  <td className="p-4 font-mono text-[#6B7471]">{mod.downloads} downloads</td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => handleOpenEdit(mod)}
                      className="p-2 rounded-lg bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#1F5E4B] transition border border-[#E2E6E4]"
                      title="Edit Module & Deployed URL"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => navigate(`/modules/${mod.id}`)}
                      className="p-2 rounded-lg bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#202524] transition border border-[#E2E6E4]"
                      title="View Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => window.open(`/api/modules/${mod.id}/download`, '_blank')}
                      className="p-2 rounded-lg bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#1F5E4B] transition border border-[#E2E6E4]"
                      title="Download ZIP"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingModule(mod)}
                      className="p-2 rounded-lg bg-[#F7F8F7] hover:bg-[#FDF3F3] text-[#6B7471] hover:text-[#C94A4A] transition border border-[#E2E6E4]"
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

      {/* Edit Module Modal */}
      {editingModule && (
        <div className="fixed inset-0 bg-[#202524]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-white border border-[#E2E6E4] rounded-3xl p-6 w-full max-w-lg space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-[#E2E6E4] pb-3">
              <h2 className="text-lg font-bold text-[#202524] flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#1F5E4B]" />
                <span>Edit Module & Deployed Link</span>
              </h2>
              <button
                onClick={() => setEditingModule(null)}
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
                  onClick={() => setEditingModule(null)}
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
      {deletingModule && (
        <div className="fixed inset-0 bg-[#202524]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-[#E2E6E4] rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-[#C94A4A]">
              <div className="p-2 rounded-2xl bg-[#FDF3F3] border border-[#C94A4A]/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-[#202524]">Delete Module Folder?</h2>
            </div>

            <p className="text-xs text-[#6B7471] leading-relaxed">
              Are you sure you want to delete module folder <strong className="text-[#202524]">{deletingModule.name}</strong> (v{deletingModule.version})? This will permanently remove its database record and stored package ZIP files.
            </p>

            {deleteError && (
              <div className="p-3 rounded-lg bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A] text-xs font-mono">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-[#E2E6E4]">
              <button
                type="button"
                onClick={() => {
                  setDeletingModule(null);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-[#F7F8F7] text-[#6B7471] hover:text-[#202524] text-xs font-semibold hover:bg-[#EAF3EF] transition border border-[#E2E6E4]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
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
