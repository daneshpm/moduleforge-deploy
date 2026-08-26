import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Github, Plus, Layers, ShieldCheck, Tag, ArrowRight, Trash2 } from 'lucide-react';
import { Module, ModuleJson } from '../types';
import { useProjectStore } from '../store/useProjectStore';

interface ModuleCardProps {
  module: Module;
  onAddToProject?: (module: Module) => void;
  onDeleteModule?: (module: Module) => void;
}

export const ModuleCard: React.FC<ModuleCardProps> = ({ module, onAddToProject, onDeleteModule }) => {
  const navigate = useNavigate();
  const { currentProject, addModuleToCurrentProject } = useProjectStore();

  const technologies =
    Array.isArray(module.technologies) && module.technologies.length > 0
      ? module.technologies
      : ['React', 'Node.js'];

  const categoryColorMap: Record<string, string> = {
    CRM: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Accounting: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Inventory: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    Payments: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Authentication: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  const categoryBadgeClass =
    categoryColorMap[module.categoryName] || 'bg-slate-800 text-slate-300 border-slate-700';

  const isAlreadyAdded = currentProject?.modules.some(
    (pm) => (pm.module?.id || pm.moduleId) === module.id
  );

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddToProject) {
      onAddToProject(module);
    } else if (currentProject) {
      addModuleToCurrentProject(module);
    } else {
      // Prompt user or redirect to projects
      navigate('/projects');
    }
  };

  return (
    <div
      onClick={() => navigate(`/modules/${module.id}`)}
      className="glass-card rounded-xl p-5 border border-slate-800 hover:border-indigo-500/50 cursor-pointer flex flex-col justify-between group relative overflow-hidden transition-all duration-200"
    >
      {/* Top Banner Accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div>
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${categoryBadgeClass}`}>
            {module.categoryName}
          </span>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <span>v{module.version}</span>
            {module.sourceType === 'github' ? (
              <span
                title={
                  module.githubSyncStatus === 'update_available'
                    ? 'Update available on GitHub'
                    : 'Synced with GitHub'
                }
                className={`flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                  module.githubSyncStatus === 'update_available'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}
              >
                <Github className="w-3 h-3 inline" />
                <span>{module.githubSyncStatus === 'update_available' ? 'Update' : 'Synced'}</span>
              </span>
            ) : (
              <span title="Uploaded ZIP verified">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 inline" />
              </span>
            )}
          </div>
        </div>

        {/* Title & Author */}
        <div className="flex items-start gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 group-hover:text-indigo-300 transition-colors text-base leading-snug">
              {module.name}
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">by {module.author}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed mb-4">
          {module.description}
        </p>

        {/* Tech Stack Pills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {technologies.slice(0, 3).map((tech) => (
            <span
              key={tech}
              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-mono"
            >
              {tech}
            </span>
          ))}
          {technologies.length > 3 && (
            <span className="px-1.5 py-0.5 text-[10px] text-slate-500 font-mono">
              +{technologies.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* Footer Stats & Actions */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>{module.downloads} downloads</span>
        </div>

        <div className="flex items-center gap-2">
          {onDeleteModule && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteModule(module);
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
              title="Delete Module Folder"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleAdd}
            disabled={isAlreadyAdded}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
              isAlreadyAdded
                ? 'bg-slate-800 text-slate-500 cursor-default border border-slate-700'
                : 'bg-indigo-600/90 hover:bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
            }`}
          >
            {isAlreadyAdded ? (
              'Added ✓'
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Add to Project</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
