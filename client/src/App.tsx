import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { ModuleDetailsPage } from './pages/ModuleDetailsPage';
import { CreateModulePage } from './pages/CreateModulePage';
import { VisualBuilderPage } from './pages/VisualBuilderPage';
import { ModuleWorkspacePage } from './pages/ModuleWorkspacePage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { MyModulesPage } from './pages/MyModulesPage';
import { MyProjectsPage } from './pages/MyProjectsPage';
import { SettingsPage } from './pages/SettingsPage';
import { useAuthStore } from './store/useAuthStore';
import { useProjectStore } from './store/useProjectStore';
import { FolderGit2, Loader2 } from 'lucide-react';

// ── Auth guard: redirects to /login if not authenticated ─────────────────────
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// ── Main App ──────────────────────────────────────────────────────────────────
export const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { checkAuth } = useAuthStore();
  const { createProject } = useProjectStore();

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const isPublicRoute =
    location.pathname === '/' || location.pathname === '/login';
  const isBuilderRoute = location.pathname.startsWith('/builder/');
  const isWorkspaceRoute = location.pathname.includes('/workspace');
  const isInviteRoute =
    location.pathname === '/join-project' ||
    location.pathname.startsWith('/invites/');

  const handleQuickCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const project = await createProject(newProjectName, newProjectDesc);
    setIsProjectModalOpen(false);
    setNewProjectName('');
    setNewProjectDesc('');
    if (project) {
      navigate(`/builder/${project.id}`);
    }
  };

  // ── Invite acceptance — public, full screen ───────────────────────────────
  if (isInviteRoute) {
    return (
      <Routes>
        <Route path="/join-project" element={<AcceptInvitePage />} />
        <Route path="/invites/:token" element={<AcceptInvitePage />} />
      </Routes>
    );
  }

  // ── Git workspace — protected, full screen ────────────────────────────────
  if (isWorkspaceRoute) {
    return (
      <Routes>
        <Route
          path="/projects/:projectId/modules/:pmId/workspace"
          element={
            <RequireAuth>
              <ModuleWorkspacePage />
            </RequireAuth>
          }
        />
      </Routes>
    );
  }

  // ── Visual builder — protected, full screen ───────────────────────────────
  if (isBuilderRoute) {
    return (
      <Routes>
        <Route
          path="/builder/:projectId"
          element={
            <RequireAuth>
              <VisualBuilderPage />
            </RequireAuth>
          }
        />
      </Routes>
    );
  }

  // ── Public routes (landing + login) ──────────────────────────────────────
  if (isPublicRoute) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    );
  }

  // ── Protected dashboard layout ────────────────────────────────────────────
  return (
    <RequireAuth>
      <div className="flex min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar onOpenCreateProject={() => setIsProjectModalOpen(true)} />
          <main className="flex-1 overflow-y-auto pb-16">
            <Routes>
              <Route
                path="/dashboard"
                element={<DashboardPage onOpenCreateProject={() => setIsProjectModalOpen(true)} />}
              />
              <Route path="/modules" element={<MarketplacePage />} />
              <Route path="/modules/create" element={<CreateModulePage />} />
              <Route path="/modules/:id" element={<ModuleDetailsPage />} />
              <Route path="/my-modules" element={<MyModulesPage />} />
              <Route
                path="/projects"
                element={<MyProjectsPage onOpenCreateProject={() => setIsProjectModalOpen(true)} />}
              />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>

        {/* Quick Create Project Modal */}
        {isProjectModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-indigo-400" />
                <span>Create New Project</span>
              </h2>

              <form onSubmit={handleQuickCreateProject} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Project Name</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g. Sales & ERP Workspace"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Description</label>
                  <textarea
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder="Composition combining CRM, Books and Inventory..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 h-24"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsProjectModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30"
                  >
                    Create & Open Builder
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </RequireAuth>
  );
};
