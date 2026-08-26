import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderGit2, Download, Trash2, Plus, Terminal, Clock, Users, User, Lock, Globe, Github } from 'lucide-react';
import { useProjectStore } from '../store/useProjectStore';
import { Project } from '../types';
import { ExportProjectModal } from '../components/ExportProjectModal';

interface MyProjectsPageProps {
  onOpenCreateProject?: () => void;
}

export const MyProjectsPage: React.FC<MyProjectsPageProps> = ({ onOpenCreateProject }) => {
  const navigate = useNavigate();
  const { projects, fetchProjects, deleteProject, exportProjectZip, createProject } = useProjectStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [projectType, setProjectType] = useState<'individual' | 'team'>('team');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [selectedExportProject, setSelectedExportProject] = useState<Project | null>(null);
  
  // Default 4 Team Member Repositories preset
  const [teamRepos, setTeamRepos] = useState([
    { name: 'CRM', category: 'CRM', githubRepository: 'company/crm' },
    { name: 'Books', category: 'Accounting', githubRepository: 'company/books' },
    { name: 'Inventory', category: 'Inventory', githubRepository: 'company/inventory' },
    { name: 'Payments', category: 'Payments', githubRepository: 'company/payments' },
  ]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleAddTeamRepoRow = () => {
    setTeamRepos([
      ...teamRepos,
      { name: `Module ${teamRepos.length + 1}`, category: 'CRM', githubRepository: '' },
    ]);
  };

  const handleUpdateTeamRepo = (index: number, field: string, value: string) => {
    const updated = [...teamRepos];
    (updated[index] as any)[field] = value;
    setTeamRepos(updated);
  };

  const handleRemoveTeamRepo = (index: number) => {
    setTeamRepos(teamRepos.filter((_, i) => i !== index));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const options = {
      description: newProjectDesc.trim(),
      projectType,
      visibility,
      teamRepos: projectType === 'team' ? teamRepos.filter((r) => r.name.trim() && r.githubRepository.trim()) : [],
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
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <FolderGit2 className="w-8 h-8 text-indigo-400" />
            <span>My Projects</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Visual project compositions with Team Live Webhook Sync and Privacy settings.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="py-20 text-center glass-panel rounded-2xl border border-slate-800 p-8 space-y-3 max-w-md mx-auto">
          <FolderGit2 className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Projects Yet</h3>
          <p className="text-xs text-slate-400">
            Create your first visual project composition and start adding modules.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const isTeam = project.projectType === 'team';
            const isPrivate = project.visibility !== 'public';

            return (
              <div
                key={project.id}
                className="glass-card rounded-2xl p-6 border border-slate-800 flex flex-col justify-between space-y-4 group hover:border-indigo-500/40"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-white group-hover:text-indigo-300 transition">
                        {project.name}
                      </h3>
                      <div className="flex items-center gap-2 pt-1 font-mono text-[10px]">
                        <span className={`px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                          isTeam
                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {isTeam ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
                          <span className="capitalize">{project.projectType || 'individual'}</span>
                        </span>

                        <span className={`px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                          isPrivate
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                        }`}>
                          {isPrivate ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                          <span className="capitalize">{project.visibility || 'private'}</span>
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {project.modules?.length || 0} modules
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {project.description || 'Custom software composition'}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-800/80 space-y-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => navigate(`/builder/${project.id}`)}
                      className="flex-1 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Open Project</span>
                    </button>

                    <button
                      onClick={() => setSelectedExportProject(project)}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                      title="Export Project & Run Prompt"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Export & Run</span>
                    </button>

                    <button
                      onClick={() => deleteProject(project.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
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

      {/* Export & Run Prompt Modal */}
      {selectedExportProject && (
        <ExportProjectModal
          project={selectedExportProject}
          onClose={() => setSelectedExportProject(null)}
        />
      )}

      {/* New Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-xl space-y-5 shadow-2xl my-8">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <FolderGit2 className="w-5 h-5 text-indigo-400" />
              <span>Create New Project</span>
            </h2>

            <form onSubmit={handleCreate} className="space-y-5">
              {/* Project Name & Description */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Project Name *</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g. My Business Application"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Description</label>
                  <textarea
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder="Integrated multi-module enterprise platform..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 h-20"
                  />
                </div>
              </div>

              {/* Project Type & Visibility Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Project Mode Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Project Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setProjectType('individual')}
                      className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                        projectType === 'individual'
                          ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <User className="w-4 h-4 text-indigo-400" />
                      <span>Individual</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProjectType('team')}
                      className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                        projectType === 'team'
                          ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Users className="w-4 h-4 text-purple-400" />
                      <span>Team Project</span>
                    </button>
                  </div>
                </div>

                {/* Privacy Visibility Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Visibility</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setVisibility('private')}
                      className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                        visibility === 'private'
                          ? 'bg-amber-500/20 border-amber-500 text-white shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Lock className="w-4 h-4 text-amber-400" />
                      <span>Private</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVisibility('public')}
                      className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                        visibility === 'public'
                          ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Globe className="w-4 h-4 text-emerald-400" />
                      <span>Public</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Team Repositories Configurator (When Team Mode is Selected) */}
              {projectType === 'team' && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-2">
                        <Github className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Team Member Repositories</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Aggregate team member repositories into this project for live GitHub webhooks.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddTeamRepoRow}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold flex items-center gap-1 hover:bg-indigo-600/30"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Repo</span>
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {teamRepos.map((repo, idx) => (
                      <div key={idx} className="flex items-center gap-2 font-mono text-xs">
                        <input
                          type="text"
                          value={repo.name}
                          onChange={(e) => handleUpdateTeamRepo(idx, 'name', e.target.value)}
                          placeholder="Module (e.g. CRM)"
                          className="w-1/3 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                        <input
                          type="text"
                          value={repo.githubRepository}
                          onChange={(e) => handleUpdateTeamRepo(idx, 'githubRepository', e.target.value)}
                          placeholder="company/crm"
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveTeamRepo(idx)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30"
                >
                  Create & Open Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
