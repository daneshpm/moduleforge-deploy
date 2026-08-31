import React, { useState } from 'react';
import {
  Boxes,
  FolderGit2,
  Plus,
  X,
  FileCode2,
  Check,
  AlertCircle,
  Folder,
  Layers,
  ArrowRight,
  GitCommit,
} from 'lucide-react';
import { Project } from '../types';
import { useProjectRepoStore } from '../store/useProjectRepoStore';

interface AddModuleToRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  moduleSource: {
    type: 'zip' | 'github' | 'marketplace';
    file?: File;
    githubUrl?: string;
    moduleId?: string;
    name: string;
    version?: string;
    description?: string;
  };
  onSuccess?: () => void;
}

export const AddModuleToRepoModal: React.FC<AddModuleToRepoModalProps> = ({
  isOpen,
  onClose,
  project,
  moduleSource,
  onSuccess,
}) => {
  const {
    ingestZipModule,
    ingestGithubModule,
    ingestMarketplaceModule,
    isIngesting,
    errorMessage,
    clearMessages,
  } = useProjectRepoStore();

  const initialSlug = moduleSource.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const [destinationPath, setDestinationPath] = useState(`modules/${initialSlug}`);
  const [customVersion, setCustomVersion] = useState(moduleSource.version || '1.0.0');
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    let res: { success: boolean; error?: string } = { success: false };

    if (moduleSource.type === 'zip' && moduleSource.file) {
      res = await ingestZipModule(
        project.id,
        moduleSource.file,
        moduleSource.name,
        destinationPath.trim(),
        customVersion
      );
    } else if (moduleSource.type === 'github' && moduleSource.githubUrl) {
      res = await ingestGithubModule(
        project.id,
        moduleSource.githubUrl,
        moduleSource.name,
        destinationPath.trim()
      );
    } else if (moduleSource.type === 'marketplace' && moduleSource.moduleId) {
      res = await ingestMarketplaceModule(
        project.id,
        moduleSource.moduleId,
        customVersion,
        destinationPath.trim()
      );
    }

    if (res.success) {
      onSuccess?.();
      onClose();
    } else {
      setSubmitError(res.error || 'Failed to add module to repository');
    }
  };

  return (
    <div className="fixed inset-0 bg-[#202524]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white border border-[#E2E6E4] rounded-3xl p-6 w-full max-w-lg space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E2E6E4] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EAF3EF] border border-[#1F5E4B]/20 flex items-center justify-center text-[#1F5E4B]">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#202524]">Add to Project Repository</h3>
              <p className="text-[11px] text-[#6B7471]">
                Target project: <strong className="text-[#202524]">{project.name}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#6B7471] hover:text-[#202524]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Module Summary Card */}
          <div className="p-3.5 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] space-y-1">
            <div className="text-xs font-bold text-[#202524] flex items-center justify-between">
              <span>{moduleSource.name}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 uppercase">
                {moduleSource.type}
              </span>
            </div>
            {moduleSource.description && (
              <p className="text-[11px] text-[#6B7471] line-clamp-2">{moduleSource.description}</p>
            )}
          </div>

          {/* Destination Path Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#202524] flex items-center justify-between">
              <span>Destination Path in Repository *</span>
              <span className="text-[10px] font-mono text-[#6B7471]">e.g. modules/auth/</span>
            </label>
            <div className="relative">
              <Folder className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1F5E4B]" />
              <input
                type="text"
                value={destinationPath}
                onChange={(e) => setDestinationPath(e.target.value)}
                placeholder="modules/my-module"
                className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#202524] font-mono focus:outline-none focus:border-[#1F5E4B]"
                required
              />
            </div>
            <p className="text-[11px] text-[#6B7471]">
              Files will be extracted into this directory and registered in <code className="text-[#1F5E4B] font-bold">moduleforge.json</code>.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#202524]">Version</label>
            <input
              type="text"
              value={customVersion}
              onChange={(e) => setCustomVersion(e.target.value)}
              className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2 text-xs text-[#202524] font-mono focus:outline-none focus:border-[#1F5E4B]"
            />
          </div>

          {submitError && (
            <div className="p-3 rounded-xl bg-[#FDF3F3] border border-[#C94A4A]/20 text-[#C94A4A] text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex justify-end gap-2.5 pt-2 border-t border-[#E2E6E4]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#F7F8F7] text-[#6B7471] hover:text-[#202524] text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isIngesting}
              className="px-5 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <GitCommit className="w-3.5 h-3.5" />
              <span>{isIngesting ? 'Ingesting & Committing...' : 'Add to Repository & Commit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
