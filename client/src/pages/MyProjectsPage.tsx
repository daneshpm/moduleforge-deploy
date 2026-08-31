import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderGit2,
  Download,
  Trash2,
  Plus,
  Clock,
  Users,
  User,
  Github,
  Code2,
  Layers,
  ChevronRight,
  Boxes,
  Search,
  SlidersHorizontal,
  GitBranch,
  ExternalLink,
  Sparkles,
  Shield,
  FileCode2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProjectStore } from '../store/useProjectStore';
import { Project } from '../types';
import { ExportProjectModal } from '../components/ExportProjectModal';
import { CreateProjectModal } from '../components/CreateProjectModal';

interface MyProjectsPageProps {
  onOpenCreateProject?: () => void;
}

export const MyProjectsPage: React.FC<MyProjectsPageProps> = ({ onOpenCreateProject }) => {
  const navigate = useNavigate();
  const { projects, fetchProjects, deleteProject } = useProjectStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedExportProject, setSelectedExportProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'individual' | 'team' | 'git'>('all');

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Computed metrics
  const totalModulesCount = useMemo(() => {
    return projects.reduce((acc, p) => acc + (p.modules?.length || 0), 0);
  }, [projects]);

  const gitLinkedCount = useMemo(() => {
    return projects.filter((p) => Boolean(p.repository || p.gitRepositoryUrl)).length;
  }, [projects]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterType === 'individual') return p.projectType !== 'team';
      if (filterType === 'team') return p.projectType === 'team';
      if (filterType === 'git') return Boolean(p.repository || p.gitRepositoryUrl);

      return true;
    });
  }, [projects, searchQuery, filterType]);

  return (
    <div className="w-full px-6 lg:px-10 py-8 space-y-8 animate-fade-in">
      {/* Top Header & Metrics Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1F5E4B] flex items-center justify-center text-white shadow-md shadow-[#1F5E4B]/20 shrink-0">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-black text-[#202524] tracking-tight">
                My Projects
              </h1>
              <p className="text-xs text-[#6B7471] font-mono mt-0.5">
                Multi-module software architectures, visual compositions, and Git repositories.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & New Project Trigger */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 rounded-2xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-lg shadow-[#1F5E4B]/25 flex items-center gap-2 transition transform active:scale-95"
          >
            <Plus className="w-4 h-4 text-white stroke-[2.5]" />
            <span>Create New Project</span>
          </button>
        </div>
      </div>

      {/* 4 Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-[#E2E6E4] shadow-card space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7471] flex items-center gap-1.5 font-mono">
            <FolderGit2 className="w-3.5 h-3.5 text-[#1F5E4B]" />
            <span>Total Projects</span>
          </span>
          <p className="text-2xl font-black text-[#202524]">{projects.length}</p>
          <span className="text-[10px] text-[#6B7471] font-mono block">Compositions managed</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-[#E2E6E4] shadow-card space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7471] flex items-center gap-1.5 font-mono">
            <Boxes className="w-3.5 h-3.5 text-[#1F5E4B]" />
            <span>Integrated Modules</span>
          </span>
          <p className="text-2xl font-black text-[#202524]">{totalModulesCount}</p>
          <span className="text-[10px] text-[#6B7471] font-mono block">Connected across canvas</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-[#E2E6E4] shadow-card space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7471] flex items-center gap-1.5 font-mono">
            <Github className="w-3.5 h-3.5 text-[#1F5E4B]" />
            <span>Git Repositories</span>
          </span>
          <p className="text-2xl font-black text-[#202524]">{gitLinkedCount}</p>
          <span className="text-[10px] text-[#2E7D5B] font-mono font-bold block">● Active Source Control</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-[#E2E6E4] shadow-card space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7471] flex items-center gap-1.5 font-mono">
            <Users className="w-3.5 h-3.5 text-[#1F5E4B]" />
            <span>Team Workspaces</span>
          </span>
          <p className="text-2xl font-black text-[#202524]">
            {projects.filter((p) => p.projectType === 'team').length}
          </p>
          <span className="text-[10px] text-[#6B7471] font-mono block">Multiplayer collaboration</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-4 border border-[#E2E6E4] shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7471]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects by name or description..."
            className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-2xl pl-10 pr-4 py-2 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3.5 py-1.5 rounded-xl transition ${
              filterType === 'all'
                ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 font-bold'
                : 'text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]'
            }`}
          >
            All Projects ({projects.length})
          </button>

          <button
            onClick={() => setFilterType('individual')}
            className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
              filterType === 'individual'
                ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 font-bold'
                : 'text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Individual</span>
          </button>

          <button
            onClick={() => setFilterType('team')}
            className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
              filterType === 'team'
                ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 font-bold'
                : 'text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Team</span>
          </button>

          <button
            onClick={() => setFilterType('git')}
            className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
              filterType === 'git'
                ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 font-bold'
                : 'text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]'
            }`}
          >
            <Github className="w-3.5 h-3.5" />
            <span>Git Linked ({gitLinkedCount})</span>
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="py-24 text-center bg-white rounded-3xl border border-[#E2E6E4] p-8 space-y-5 max-w-md mx-auto shadow-card">
          <div className="w-16 h-16 rounded-3xl bg-[#EAF3EF] border border-[#1F5E4B]/20 flex items-center justify-center text-[#1F5E4B] mx-auto shadow-sm">
            <FolderGit2 className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-[#202524]">No Projects Yet</h3>
            <p className="text-xs text-[#6B7471] leading-relaxed">
              Create your first project composition with an overall Git repository and start connecting modules.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-2.5 bg-[#1F5E4B] hover:bg-[#174739] text-white font-bold rounded-xl text-xs shadow-md shadow-[#1F5E4B]/20 transition"
          >
            Create Project
          </button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-[#E2E6E4] p-8 space-y-3 shadow-card">
          <Search className="w-8 h-8 text-[#6B7471]/40 mx-auto" />
          <h3 className="text-base font-bold text-[#202524]">No matching projects found</h3>
          <p className="text-xs text-[#6B7471]">
            Try adjusting your search query or filter selection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProjects.map((project) => {
            const isTeam = project.projectType === 'team';
            const repo = project.repository;
            const hasRepo = Boolean(repo || project.gitRepositoryUrl);
            const repoDisplayName = repo?.name || project.gitRepo || project.name;

            return (
              <div
                key={project.id}
                className="bg-white rounded-3xl p-6 border border-[#E2E6E4] flex flex-col justify-between space-y-5 group hover:border-[#1F5E4B] shadow-card hover:shadow-card-hover transition-all"
              >
                {/* Top Section */}
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3
                        onClick={() => navigate(`/builder/${project.id}`)}
                        className="font-black text-lg text-[#202524] group-hover:text-[#1F5E4B] transition cursor-pointer truncate tracking-tight"
                        title={project.name}
                      >
                        {project.name}
                      </h3>

                      <div className="flex items-center gap-1.5 pt-1 font-mono text-[10px] flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full border flex items-center gap-1 font-semibold ${
                            isTeam
                              ? 'bg-[#EAF3EF] text-[#1F5E4B] border-[#1F5E4B]/20'
                              : 'bg-[#F7F8F7] text-[#6B7471] border-[#E2E6E4]'
                          }`}
                        >
                          {isTeam ? (
                            <Users className="w-3 h-3 text-[#1F5E4B]" />
                          ) : (
                            <User className="w-3 h-3 text-[#1F5E4B]" />
                          )}
                          <span className="capitalize">{project.projectType || 'individual'}</span>
                        </span>

                        {hasRepo && (
                          <span className="px-2 py-0.5 rounded-full bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 font-bold flex items-center gap-1">
                            <Github className="w-3 h-3" />
                            <span className="truncate max-w-[110px]">{repoDisplayName}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 shrink-0">
                      {project.modules?.length || 0} mod{project.modules?.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <p className="text-xs text-[#6B7471] line-clamp-2 leading-relaxed min-h-[36px]">
                    {project.description || 'Custom software architecture composition managed by ModuleForge.'}
                  </p>
                </div>

                {/* Footer Section */}
                <div className="pt-4 border-t border-[#E2E6E4] space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-[#6B7471] font-mono">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#1F5E4B]" />
                      <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                    </span>

                    <span className="px-2 py-0.5 rounded-md bg-[#F7F8F7] text-[#6B7471] border border-[#E2E6E4] text-[10px] capitalize">
                      {project.visibility}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/builder/${project.id}`)}
                      className="flex-1 py-2.5 rounded-2xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-[#1F5E4B]/20"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Open Workspace</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setSelectedExportProject(project)}
                      className="p-2.5 rounded-2xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#1F5E4B] border border-[#E2E6E4] transition"
                      title="Export Project Package"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete project "${project.name}"?`)) {
                          deleteProject(project.id);
                        }
                      }}
                      className="p-2.5 rounded-2xl bg-[#F7F8F7] hover:bg-[#FDF3F3] text-[#6B7471] hover:text-[#C94A4A] border border-[#E2E6E4] hover:border-[#C94A4A]/30 transition"
                      title="Delete Project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Export Project Modal */}
      {selectedExportProject && (
        <ExportProjectModal
          project={selectedExportProject}
          onClose={() => setSelectedExportProject(null)}
        />
      )}

      {/* Create Project Modal with Repository Options & Step Progress */}
      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};
