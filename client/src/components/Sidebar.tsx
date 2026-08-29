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
  Layers,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
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

  const sidebarContent = (
    <div className="flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-[#E2E6E4] flex items-center justify-between bg-white">
        <NavLink to="/dashboard" onClick={onClose} className="flex items-center gap-3 group">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#1F5E4B] p-0.5 shadow-md shadow-[#1F5E4B]/20 group-hover:scale-105 transition-transform flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-base sm:text-lg tracking-tight text-[#202524] flex items-center gap-1.5">
              <span className="primary-text-gradient font-black">ModuleForge</span>
              <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#EAF3EF] text-[#1F5E4B] rounded border border-[#1F5E4B]/30">
                PRO
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#6B7471] font-mono">Software Module Platform</p>
          </div>
        </NavLink>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-1.5 rounded-xl text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7] transition"
          >
            <LogOut className="w-5 h-5 rotate-180" />
          </button>
        )}
      </div>

      {/* Dev Mode Banner */}
      {isDevMode && (
        <div className="mx-3 mt-3 p-2.5 rounded-xl bg-[#EAF3EF] border border-[#1F5E4B]/20 flex items-center gap-2 text-[#1F5E4B] text-xs">
          <Zap className="w-4 h-4 text-[#1F5E4B] shrink-0 animate-pulse" />
          <div className="leading-tight">
            <span className="font-bold block text-[11px]">Development Mode</span>
            <span className="text-[10px] text-[#6B7471]">Local Auth Session Active</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-[#6B7471] flex items-center justify-between">
          <span>Navigation</span>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition ${
                  isActive
                    ? 'bg-[#EAF3EF] text-[#1F5E4B] font-bold border border-[#1F5E4B]/20 shadow-xs'
                    : 'text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7] border border-transparent font-medium'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
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
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-[#E2E6E4] flex-col h-screen sticky top-0 z-30 shadow-sm shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed top-0 bottom-0 left-0 w-72 max-w-[85vw] bg-white z-50 transform transition-transform duration-300 ease-in-out md:hidden flex flex-col shadow-2xl border-r border-[#E2E6E4] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
