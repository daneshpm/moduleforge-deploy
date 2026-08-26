import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  PackageCheck,
  FolderGit2,
  PlusCircle,
  Settings,
  Zap,
  LogOut,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export const Sidebar: React.FC = () => {
  const { user, isDevMode, logout } = useAuthStore();

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Modules', path: '/modules', icon: Boxes },
    { label: 'My Modules', path: '/my-modules', icon: PackageCheck },
    { label: 'My Projects', path: '/projects', icon: FolderGit2 },
    { label: 'Create Module', path: '/modules/create', icon: PlusCircle },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900/90 border-r border-slate-800/80 flex flex-col h-screen sticky top-0 select-none z-30">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
        <NavLink to="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Layers className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
              ModuleForge
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-indigo-500/20 text-indigo-300 rounded-md border border-indigo-500/30">
                MVP
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">Software Module Engine</p>
          </div>
        </NavLink>
      </div>

      {/* Dev Mode Banner Indicator */}
      {isDevMode && (
        <div className="mx-3 mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-amber-300 text-xs">
          <Zap className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          <div className="leading-tight">
            <span className="font-semibold block text-[11px]">Development Mode</span>
            <span className="text-[10px] text-amber-400/80">Local Dev Auth Active</span>
          </div>
        </div>
      )}

      {/* Primary Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2 text-[10px] font-semibold font-mono tracking-wider text-slate-500 uppercase">
          Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        {/* Antigravity AI Banner */}
        <div className="mt-6 p-3 rounded-xl bg-gradient-to-br from-indigo-950/60 to-purple-950/60 border border-indigo-500/20 text-xs text-slate-300">
          <div className="flex items-center gap-2 text-indigo-300 font-semibold mb-1">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Antigravity Ready</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Exported ZIP packages include PROJECT.json tailored for immediate coding agent integration.
          </p>
        </div>
      </nav>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/50">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/80">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img
              src={user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt="User Avatar"
              className="w-8 h-8 rounded-full ring-2 ring-indigo-500/30 object-cover"
            />
            <div className="truncate text-xs">
              <span className="font-semibold text-slate-200 block truncate">{user?.name || 'Developer'}</span>
              <span className="text-slate-400 block truncate text-[11px]">{user?.email || 'dev@moduleforge.io'}</span>
            </div>
          </div>
          <button
            onClick={logout}
            title="Logout"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-md transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
