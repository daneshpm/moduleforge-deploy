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

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="p-8 rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-purple-950/80 border border-indigo-500/20 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>ModuleForge Workspace</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Welcome back, <span className="text-indigo-400">{user?.name || 'Developer'}</span>
          </h1>
          <p className="text-sm text-slate-300 max-w-xl">
            Import, compose and manage reusable software modules. Build projects visually and export ready-to-deploy packages.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-3 shrink-0 z-10">
          <button
            onClick={() => navigate('/modules/create')}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700/80 flex items-center gap-2 shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4 text-purple-400" />
            <span>Add Module</span>
          </button>
          <button
            onClick={onOpenCreateProject || (() => navigate('/projects'))}
            className="px-4.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Create Project</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'My Projects', count: projects.length, icon: FolderGit2, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
          { label: 'Published Modules', count: modules.filter((m) => m.author === user?.name || m.sourceType === 'upload').length, icon: Boxes, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
          { label: 'Available Modules', count: modules.length, icon: Layers, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Total Module Downloads', count: modules.reduce((acc, m) => acc + (m.downloads || 0), 0), icon: Download, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="glass-card rounded-xl p-5 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium block mb-1">{card.label}</span>
                <span className="text-2xl font-black text-white font-mono">{card.count}</span>
              </div>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${card.color}`}>
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
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-indigo-400" />
              <span>Recent Projects</span>
            </h2>
            <button
              onClick={() => navigate('/projects')}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <span>View All ({projects.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {recentProjects.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
                <FolderGit2 className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-400">No projects created yet.</p>
                <button
                  onClick={onOpenCreateProject || (() => navigate('/projects'))}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
                >
                  Create Your First Project
                </button>
              </div>
            ) : (
              recentProjects.map((project) => (
                <div
                  key={project.id}
                  className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-4 transition group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white group-hover:text-indigo-300 transition text-base">
                        {project.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {project.modules?.length || 0} modules
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1">
                      {project.description || 'Custom software composition'}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        Updated {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/builder/${project.id}`)}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Open Builder</span>
                    </button>
                    <button
                      onClick={() => exportProjectZip(project.id)}
                      title="Export ZIP package"
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
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
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Boxes className="w-5 h-5 text-purple-400" />
              <span>Available Modules</span>
            </h2>
            <button
              onClick={() => navigate('/modules')}
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1"
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
