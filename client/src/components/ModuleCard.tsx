import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Github, Plus, Layers, ShieldCheck, Trash2, ExternalLink } from 'lucide-react';
import { Module } from '../types';
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
    CRM: 'bg-[#EAF3EF] text-[#1F5E4B] border-[#1F5E4B]/20',
    Accounting: 'bg-[#F0F9F5] text-[#2E7D5B] border-[#2E7D5B]/20',
    Inventory: 'bg-[#EAF3EF] text-[#1F5E4B] border-[#1F5E4B]/20',
    Payments: 'bg-[#F0F9F5] text-[#2E7D5B] border-[#2E7D5B]/20',
    Authentication: 'bg-[#EAF3EF] text-[#1F5E4B] border-[#1F5E4B]/20',
  };

  const categoryBadgeClass =
    categoryColorMap[module.categoryName] || 'bg-[#EAF3EF] text-[#1F5E4B] border-[#1F5E4B]/20';

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
      navigate('/projects');
    }
  };

  return (
    <div
      onClick={() => navigate(`/modules/${module.id}`)}
      className="bg-white rounded-2xl p-5 border border-[#E2E6E4] hover:border-[#1F5E4B] cursor-pointer flex flex-col justify-between group relative overflow-hidden transition-all duration-200 shadow-card hover:shadow-card-hover"
    >
      {/* Top Banner Accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#1F5E4B] opacity-0 group-hover:opacity-100 transition-opacity" />

      <div>
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${categoryBadgeClass}`}>
            {module.categoryName}
          </span>
          <div className="flex items-center gap-2 text-[11px] text-[#6B7471] font-mono">
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
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-[#EAF3EF] text-[#2E7D5B] border-[#2E7D5B]/30'
                }`}
              >
                <Github className="w-3 h-3 inline" />
                <span>{module.githubSyncStatus === 'update_available' ? 'Update' : 'Synced'}</span>
              </span>
            ) : (
              <span title="Uploaded ZIP verified">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2E7D5B] inline" />
              </span>
            )}
          </div>
        </div>

        {/* Title & Author */}
        <div className="flex items-start gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-[#EAF3EF] border border-[#1F5E4B]/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Layers className="w-4.5 h-4.5 text-[#1F5E4B]" />
          </div>
          <div>
            <h3 className="font-bold text-[#202524] group-hover:text-[#1F5E4B] transition-colors text-base leading-snug">
              {module.name}
            </h3>
            <p className="text-[11px] text-[#6B7471] font-mono">by {module.author}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-[#6B7471] line-clamp-2 leading-relaxed mb-3">
          {module.description}
        </p>

        {/* Deployed Status Indicator */}
        {module.deployedUrl && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#2E7D5B] font-bold mb-3">
            <span className="w-2 h-2 rounded-full bg-[#2E7D5B] animate-pulse" />
            <span>● Deployed</span>
          </div>
        )}

        {/* Tech Stack Pills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {technologies.slice(0, 3).map((tech) => (
            <span
              key={tech}
              className="px-2 py-0.5 rounded-lg bg-[#F7F8F7] border border-[#E2E6E4] text-[10px] text-[#6B7471] font-mono"
            >
              {tech}
            </span>
          ))}
          {technologies.length > 3 && (
            <span className="px-1.5 py-0.5 text-[10px] text-[#6B7471] font-mono">
              +{technologies.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* Footer Stats & Actions */}
      <div className="pt-3 border-t border-[#E2E6E4] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-[#6B7471] font-mono">
          <Download className="w-3.5 h-3.5 text-[#1F5E4B]" />
          <span>{module.downloads} downloads</span>
        </div>

        <div className="flex items-center gap-2">
          {/* View Live Website Button */}
          {module.deployedUrl && (
            <a
              href={module.deployedUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#EAF3EF] hover:bg-[#1F5E4B] text-[#1F5E4B] hover:text-white border border-[#1F5E4B]/20 transition flex items-center gap-1 shadow-xs"
              title={`Open live deployed website: ${module.deployedUrl}`}
            >
              <span>View Live Website</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {onDeleteModule && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteModule(module);
              }}
              className="p-1.5 rounded-xl bg-[#F7F8F7] hover:bg-[#FDF3F3] text-[#6B7471] hover:text-[#C94A4A] border border-[#E2E6E4] hover:border-[#C94A4A]/30 transition"
              title="Delete Module Folder"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleAdd}
            disabled={isAlreadyAdded}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition ${
              isAlreadyAdded
                ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 cursor-default'
                : 'bg-[#1F5E4B] hover:bg-[#174739] text-white shadow-sm shadow-[#1F5E4B]/20'
            }`}
          >
            {isAlreadyAdded ? (
              'Added ✓'
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                <span>Add to Project</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
