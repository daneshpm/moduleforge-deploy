import React from 'react';
import { Search, Plus, FolderPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useModuleStore } from '../store/useModuleStore';

interface NavbarProps {
  onOpenCreateProject?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCreateProject }) => {
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery } = useModuleStore();

  return (
    <header className="h-14 bg-[#05070e]/90 backdrop-blur-xl border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Search Input */}
      <div className="relative w-80">
        <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search modules..."
          className="w-full bg-slate-900/80 border border-slate-800 rounded-lg pl-9 pr-10 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition"
        />
        {searchQuery ? (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-sm leading-none"
          >
            ×
          </button>
        ) : (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-600 bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700/50">
            ⌘K
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => navigate('/modules/create')}
          className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/80 flex items-center gap-1.5 transition"
        >
          <Plus className="w-3.5 h-3.5 text-indigo-400" />
          <span>Upload Module</span>
        </button>

        <button
          onClick={onOpenCreateProject || (() => navigate('/projects'))}
          className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>Create Project</span>
        </button>
      </div>
    </header>
  );
};
