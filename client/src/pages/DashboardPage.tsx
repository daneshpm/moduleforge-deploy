import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderGit2,
  Boxes,
  PlusCircle,
  FolderPlus,
  ArrowRight,
  Clock,
  Download,
  Terminal,
  Layers,
  Crown,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useModuleStore } from '../store/useModuleStore';
import { useProjectStore } from '../store/useProjectStore';
import { ModuleCard } from '../components/ModuleCard';

interface DashboardPageProps {
  onOpenCreateProject?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onOpenCreateProject }) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { modules, fetchModules } = useModuleStore();
  const { projects, fetchProjects, exportProjectZip } = useProjectStore();

  useEffect(() => {
    fetchModules();
    fetchProjects();
  }, [fetchModules, fetchProjects]);

  const recentProjects = projects.slice(0, 4);
  const recentModules = modules.slice(0, 3);

  const myPublishedModules = modules.filter(
    (m) =>
      (m.authorId && user?.id && m.authorId === user.id) ||
      (m.author && user?.username && m.author.toLowerCase() === user.username.toLowerCase()) ||
      (m.author && user?.name && m.author.toLowerCase() === user.name.toLowerCase()) ||
      (m.author && user?.email && m.author.toLowerCase() === user.email.toLowerCase())
  );

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="p-8 rounded-3xl bg-[#EAF3EF] border border-[#1F5E4B]/20 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#1F5E4B]/20 text-[#1F5E4B] text-xs font-mono font-bold shadow-xs">
            <Crown className="w-3.5 h-3.5 text-[#1F5E4B] animate-pulse" />
            <span>ModuleForge Workspace • Pro</span>
          </div>
          <h1 className="text-3xl font-black text-[#202524] tracking-tight">
            Welcome back, <span className="primary-text-gradient">{user?.name || 'Developer'}</span>
          </h1>
          <p className="text-sm text-[#6B7471] max-w-xl">
            Import, compose, and manage reusable software modules. Build projects visually and export ready-to-deploy packages.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-3 shrink-0 z-10">
          <button
            onClick={() => navigate('/modules/create')}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#F7F8F7] text-[#202524] font-semibold text-xs border border-[#E2E6E4] hover:border-[#1F5E4B]/40 flex items-center gap-2 shadow-xs transition"
          >
            <PlusCircle className="w-4 h-4 text-[#1F5E4B]" />
            <span>Add Module</span>
          </button>
          <button
            onClick={onOpenCreateProject || (() => navigate('/projects'))}
            className="px-5 py-2.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white font-bold text-xs shadow-md shadow-[#1F5E4B]/20 flex items-center gap-2 transition transform active:scale-95"
          >
            <FolderPlus className="w-4 h-4 text-white stroke-[2.5]" />
            <span>Create Project</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'My Projects', count: projects.length, icon: FolderGit2 },
          { label: 'Published Modules', count: myPublishedModules.length, icon: Boxes },
          { label: 'Available Modules', count: modules.length, icon: Layers },
          { label: 'Total Downloads', count: myPublishedModules.reduce((acc, m) => acc + (m.downloads || 0), 0), icon: Download },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-white rounded-2xl p-5 border border-[#E2E6E4] flex items-center justify-between shadow-card">
              <div>
                <span className="text-xs text-[#6B7471] font-medium block mb-1">{card.label}</span>
                <span className="text-2xl font-black text-[#1F5E4B] font-mono">{card.count}</span>
              </div>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center border border-[#1F5E4B]/20 bg-[#EAF3EF] text-[#1F5E4B]">
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid: Recent Projects & Recently Added Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Recent Projects */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#202524] flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-[#1F5E4B]" />
              <span>Recent Projects</span>
            </h2>
            <button
              onClick={() => navigate('/projects')}
              className="text-xs font-semibold text-[#1F5E4B] hover:text-[#174739] flex items-center gap-1"
            >
              <span>View All ({projects.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {recentProjects.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white border border-[#E2E6E4] text-center space-y-3 shadow-card">
                <FolderGit2 className="w-8 h-8 text-[#6B7471] mx-auto" />
                <p className="text-sm text-[#6B7471]">No projects created yet.</p>
                <button
                  onClick={onOpenCreateProject || (() => navigate('/projects'))}
                  className="px-4 py-2 bg-[#1F5E4B] hover:bg-[#174739] text-white font-bold rounded-xl text-xs shadow-md shadow-[#1F5E4B]/20"
                >
                  Create Your First Project
                </button>
              </div>
            ) : (
              recentProjects.map((project) => (
                <div
                  key={project.id}
                  className="p-5 rounded-2xl bg-white border border-[#E2E6E4] hover:border-[#1F5E4B] flex items-center justify-between gap-4 transition group shadow-card hover:shadow-card-hover"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[#202524] group-hover:text-[#1F5E4B] transition text-base">
                        {project.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20">
                        {project.modules?.length || 0} modules
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7471] line-clamp-1">
                      {project.description || 'Custom software composition'}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-[#6B7471] font-mono pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#1F5E4B]" />
                        Updated {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/builder/${project.id}`)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#EAF3EF] hover:bg-[#1F5E4B] text-[#1F5E4B] hover:text-white border border-[#1F5E4B]/20 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Open Builder</span>
                    </button>
                    <button
                      onClick={() => exportProjectZip(project.id)}
                      title="Export ZIP package"
                      className="p-2 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#1F5E4B] border border-[#E2E6E4] transition"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Recently Added Marketplace Modules */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#202524] flex items-center gap-2">
              <Boxes className="w-5 h-5 text-[#1F5E4B]" />
              <span>Available Modules</span>
            </h2>
            <button
              onClick={() => navigate('/modules')}
              className="text-xs font-semibold text-[#1F5E4B] hover:text-[#174739] flex items-center gap-1"
            >
              <span>Marketplace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {recentModules.map((mod) => (
              <ModuleCard key={mod.id} module={mod} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
