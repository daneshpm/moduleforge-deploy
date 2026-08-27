import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  PackageCheck,
  FolderGit2,
  Users,
  PlusCircle,
  Settings,
  Zap,
  LogOut,
  Sparkles,
  Layers,
  Crown,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const Sidebar: React.FC = () => {
  const { user, isDevMode, logout } = useAuthStore();

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Modules', path: '/modules', icon: Boxes },
    { label: 'My Modules', path: '/my-modules', icon: PackageCheck },
    { label: 'My Projects', path: '/projects', icon: FolderGit2 },
    { label: 'Teams', path: '/teams', icon: Users },
    { label: 'Create Module', path: '/modules/create', icon: PlusCircle },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white border-r border-[#E2E6E4] flex flex-col h-screen sticky top-0 select-none z-30 shadow-sm">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#E2E6E4] flex items-center justify-between bg-white">
        <NavLink to="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-[#1F5E4B] p-0.5 shadow-md shadow-[#1F5E4B]/20 group-hover:scale-105 transition-transform flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-lg tracking-tight text-[#202524] flex items-center gap-1.5">
              <span className="primary-text-gradient font-black">ModuleForge</span>
              <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#EAF3EF] text-[#1F5E4B] rounded border border-[#1F5E4B]/30">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-[#6B7471] font-mono">Software Module Platform</p>
          </div>
        </NavLink>
      </div>

      {/* Dev Mode Banner Indicator */}
      {isDevMode && (
        <div className="mx-3 mt-3 p-2.5 rounded-xl bg-[#EAF3EF] border border-[#1F5E4B]/20 flex items-center gap-2 text-[#1F5E4B] text-xs">
          <Zap className="w-4 h-4 text-[#1F5E4B] shrink-0 animate-pulse" />
          <div className="leading-tight">
            <span className="font-bold block text-[11px]">Development Mode</span>
            <span className="text-[10px] text-[#6B7471]">Local Auth Session Active</span>
          </div>
        </div>
      )}

      {/* Primary Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2 text-[10px] font-bold font-mono tracking-wider text-[#6B7471] uppercase flex items-center justify-between">
          <span>Navigation</span>
          <Crown className="w-3 h-3 text-[#1F5E4B]" />
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 font-bold shadow-xs'
                    : 'text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7] border border-transparent font-medium'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        {/* Antigravity AI Banner */}
        <div className="mt-6 p-4 rounded-2xl bg-[#EAF3EF]/70 border border-[#E2E6E4] text-xs text-[#202524] shadow-xs">
          <div className="flex items-center gap-2 text-[#1F5E4B] font-bold mb-1.5">
            <Sparkles className="w-4 h-4 text-[#1F5E4B] animate-pulse" />
            <span>AI Architecture Ready</span>
          </div>
          <p className="text-[11px] text-[#6B7471] leading-relaxed">
            Exported packages include PROJECT.json tailored for instant Antigravity coding agent orchestration.
          </p>
        </div>
      </nav>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-[#E2E6E4] bg-[#F7F8F7]">
        <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#E2E6E4] hover:border-[#1F5E4B]/40 transition shadow-xs">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img
              src={user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || 'Developer'}`}
              alt="User Avatar"
              className="w-8 h-8 rounded-full ring-2 ring-[#1F5E4B]/30 object-cover shadow-xs shrink-0"
            />
            <div className="truncate text-xs">
              <span className="font-bold text-[#202524] block truncate">{user?.name || 'Developer'}</span>
              <span className="text-[#1F5E4B] block truncate text-[11px] font-mono font-semibold">
                @{user?.username || 'user'}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="p-1.5 text-[#6B7471] hover:text-[#C94A4A] hover:bg-[#FDF3F3] rounded-lg transition shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
