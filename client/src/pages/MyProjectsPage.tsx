import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderGit2,
  Download,
  Trash2,
  Plus,
  Terminal,
  Clock,
  Users,
  User,
  Crown,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProjectStore } from '../store/useProjectStore';
import { Project } from '../types';
import { ExportProjectModal } from '../components/ExportProjectModal';

interface MyProjectsPageProps {
  onOpenCreateProject?: () => void;
}

export const MyProjectsPage: React.FC<MyProjectsPageProps> = ({ onOpenCreateProject }) => {
  const navigate = useNavigate();
  const { projects, fetchProjects, deleteProject, createProject } = useProjectStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [projectType, setProjectType] = useState<'individual' | 'team'>('individual');
  const [selectedExportProject, setSelectedExportProject] = useState<Project | null>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const options = {
      description: newProjectDesc.trim(),
      projectType,
      visibility: 'private' as const,
    };

    const project = await createProject(newProjectName.trim(), options);
    setIsModalOpen(false);
    setNewProjectName('');
    setNewProjectDesc('');
    if (project) {
      navigate(`/builder/${project.id}`);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#202524] tracking-tight flex items-center gap-3">
            <FolderGit2 className="w-8 h-8 text-[#1F5E4B]" />
            <span className="primary-text-gradient">My Projects</span>
          </h1>
          <p className="text-sm text-[#6B7471] mt-1">
            Visual project compositions and modular software architecture.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 flex items-center gap-2 transition transform active:scale-95"
        >
          <Plus className="w-4 h-4 text-white stroke-[2.5]" />
          <span>New Project</span>
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-[#E2E6E4] p-8 space-y-4 max-w-md mx-auto shadow-card">
          <FolderGit2 className="w-12 h-12 text-[#6B7471] mx-auto" />
          <h3 className="text-lg font-bold text-[#202524]">No Projects Yet</h3>
          <p className="text-xs text-[#6B7471]">
            Create your first visual project composition and start adding modules.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-[#1F5E4B] hover:bg-[#174739] text-white font-bold rounded-xl text-xs shadow-md shadow-[#1F5E4B]/20"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const isTeam = project.projectType === 'team';

            return (
              <div
                key={project.id}
                className="bg-white rounded-2xl p-6 border border-[#E2E6E4] flex flex-col justify-between space-y-4 group hover:border-[#1F5E4B] shadow-card hover:shadow-card-hover transition"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-[#202524] group-hover:text-[#1F5E4B] transition">
                        {project.name}
                      </h3>
                      <div className="flex items-center gap-2 pt-1 font-mono text-[10px]">
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
                      </div>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20">
                      {project.modules?.length || 0} modules
                    </span>
                  </div>

                  <p className="text-xs text-[#6B7471] line-clamp-2 leading-relaxed">
                    {project.description || 'Custom software composition'}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#E2E6E4] space-y-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-[#6B7471] font-mono">
                    <Clock className="w-3.5 h-3.5 text-[#1F5E4B]" />
                    <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => navigate(`/builder/${project.id}`)}
                      className="flex-1 py-2 rounded-xl bg-[#EAF3EF] hover:bg-[#1F5E4B] text-[#1F5E4B] hover:text-white border border-[#1F5E4B]/20 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Open Canvas</span>
                    </button>

                    <button
                      onClick={() => setSelectedExportProject(project)}
                      className="px-3.5 py-2 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#1F5E4B] border border-[#E2E6E4] text-xs font-bold flex items-center gap-1.5 transition"
                      title="Export Project Package"
                    >
                      <Download className="w-3.5 h-3.5 text-[#1F5E4B]" />
                      <span>Export</span>
                    </button>

                    <button
                      onClick={() => deleteProject(project.id)}
                      className="p-2 rounded-xl bg-[#F7F8F7] hover:bg-[#FDF3F3] text-[#6B7471] hover:text-[#C94A4A] border border-[#E2E6E4] hover:border-[#C94A4A]/30 transition"
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

      {/* New Project Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#202524]/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] select-none"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 320 }}
              className="bg-white border border-[#E2E6E4] rounded-3xl p-6 w-full max-w-lg space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between border-b border-[#E2E6E4] pb-3">
                <h2 className="text-xl font-bold text-[#202524] flex items-center gap-2">
                  <Crown className="w-5 h-5 text-[#1F5E4B]" />
                  <span>Create New Project</span>
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-xl text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7] transition border border-transparent hover:border-[#E2E6E4]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-5">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#202524]">Project Name *</label>
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="e.g. Enterprise Business App"
                      className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#202524]">Description (Optional)</label>
                    <textarea
                      value={newProjectDesc}
                      onChange={(e) => setNewProjectDesc(e.target.value)}
                      placeholder="Describe your multi-module application composition..."
                      className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15 h-24 resize-none"
                    />
                  </div>
                </div>

                {/* Project Type Selectors */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#202524]">Project Mode</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setProjectType('individual')}
                      className={`p-3.5 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition ${
                        projectType === 'individual'
                          ? 'bg-[#EAF3EF] border-[#1F5E4B] text-[#1F5E4B] shadow-xs'
                          : 'bg-[#F7F8F7] border-[#E2E6E4] text-[#6B7471] hover:text-[#202524]'
                      }`}
                    >
                      <User className="w-5 h-5 text-[#1F5E4B]" />
                      <span className="font-bold">Individual Project</span>
                      <span className="text-[10px] font-normal text-[#6B7471] text-center">
                        Personal workspace for your individual modules
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProjectType('team')}
                      className={`p-3.5 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition ${
                        projectType === 'team'
                          ? 'bg-[#EAF3EF] border-[#1F5E4B] text-[#1F5E4B] shadow-xs'
                          : 'bg-[#F7F8F7] border-[#E2E6E4] text-[#6B7471] hover:text-[#202524]'
                      }`}
                    >
                      <Users className="w-5 h-5 text-[#1F5E4B]" />
                      <span className="font-bold">Team Project</span>
                      <span className="text-[10px] font-normal text-[#6B7471] text-center">
                        Shared composition for team collaboration
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-[#E2E6E4]">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#6B7471] hover:text-[#202524] border border-[#E2E6E4] text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 transition"
                  >
                    Create & Open Project
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
