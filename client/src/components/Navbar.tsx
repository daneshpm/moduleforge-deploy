import React from 'react';
import { Search, Plus, Terminal, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useModuleStore } from '../store/useModuleStore';
import { NotificationBell } from './NotificationBell';

interface NavbarProps {
  onOpenCreateProject?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCreateProject }) => {
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery } = useModuleStore();

  return (
    <header className="h-16 bg-white/95 backdrop-blur-xl border-b border-[#E2E6E4] px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      {/* Search Input */}
      <div className="relative w-96">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7471]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search modules (CRM, Auth, Payments...)"
          className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl pl-9 pr-12 py-2 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15 transition shadow-inner"
        />
        {searchQuery ? (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6B7471] hover:text-[#202524]"
          >
            ×
          </button>
        ) : (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#6B7471] bg-white px-1.5 py-0.5 rounded border border-[#E2E6E4]">
            ⌘K
          </span>
        )}
      </div>

      {/* Action Controls & Notification Bell */}
      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EAF3EF] border border-[#1F5E4B]/20 text-[#1F5E4B] font-mono text-[11px] font-semibold">
          <Crown className="w-3.5 h-3.5 text-[#1F5E4B] animate-pulse" />
          <span>AI Engine Ready</span>
        </div>

        <NotificationBell />

        <button
          onClick={() => navigate('/modules/create')}
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#F7F8F7] text-[#202524] text-xs font-semibold border border-[#E2E6E4] hover:border-[#1F5E4B]/40 flex items-center gap-1.5 transition shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 text-[#1F5E4B]" />
          <span>Upload Module</span>
        </button>

        <button
          onClick={onOpenCreateProject || (() => navigate('/projects'))}
          className="px-4 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/25 flex items-center gap-1.5 transition transform active:scale-95"
        >
          <Terminal className="w-3.5 h-3.5 text-white stroke-[2.5]" />
          <span>Create Project</span>
        </button>
      </div>
    </header>
  );
};
