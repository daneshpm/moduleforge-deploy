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
import { TeamsPage } from './pages/TeamsPage';
import { TeamDetailPage } from './pages/TeamDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { CommunicationPage } from './pages/CommunicationPage';
import { MeetingJoinPage } from './pages/MeetingJoinPage';
import { IncomingCallModal } from './components/communication/IncomingCallModal';
import { ActiveCallModal } from './components/communication/ActiveCallModal';
import { MeetingRoomModal } from './components/communication/MeetingRoomModal';
import { UsernameSetupModal } from './components/UsernameSetupModal';
import { useAuthStore } from './store/useAuthStore';
import { useProjectStore } from './store/useProjectStore';
import { useCommunicationStore } from './store/useCommunicationStore';
import { FolderGit2, Loader2, X } from 'lucide-react';

// ── Auth guard: redirects to /login if not authenticated ─────────────────────
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F8F7] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#1F5E4B] animate-spin" />
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
  const { user, checkAuth } = useAuthStore();
  const { createProject } = useProjectStore();
  const { updatePresence, pollActiveCalls } = useCommunicationStore();

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Presence & Active Call Polling Lifecycle
  useEffect(() => {
    if (user?.id) {
      updatePresence('online', undefined, 'idle');

      const heartbeat = setInterval(() => {
        updatePresence('online', undefined, 'idle');
        pollActiveCalls();
      }, 30000);

      const handleBeforeUnload = () => {
        updatePresence('offline');
      };
      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        clearInterval(heartbeat);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [user?.id, updatePresence, pollActiveCalls]);

  const isPublicRoute =
    location.pathname === '/' || location.pathname === '/login';
  const isBuilderRoute = location.pathname.startsWith('/builder/');
  const isWorkspaceRoute = location.pathname.includes('/workspace');
  const isMeetRoute =
    location.pathname.startsWith('/meet/') ||
    location.pathname.startsWith('/meetings/');
  const isInviteRoute =
    location.pathname === '/join-project' ||
    location.pathname === '/join-team' ||
    location.pathname.startsWith('/invites/') ||
    location.pathname.startsWith('/invite/');

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

  // ── Dedicated meeting room join preview — protected, full screen ──────────
  if (isMeetRoute) {
    return (
      <RequireAuth>
        <Routes>
          <Route path="/meet/:roomId" element={<MeetingJoinPage />} />
          <Route path="/meetings/:roomId" element={<MeetingJoinPage />} />
        </Routes>
      </RequireAuth>
    );
  }

  // ── Invite acceptance — public, full screen ───────────────────────────────
  if (isInviteRoute) {
    return (
      <Routes>
        <Route path="/join-project" element={<AcceptInvitePage />} />
        <Route path="/join-team" element={<AcceptInvitePage />} />
        <Route path="/invites/:token" element={<AcceptInvitePage />} />
        <Route path="/invite/:token" element={<AcceptInvitePage />} />
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
      <div className="flex min-h-screen bg-[#F7F8F7] text-[#202524]">
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
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/teams/:teamId" element={<TeamDetailPage />} />
              <Route path="/messages" element={<CommunicationPage />} />
              <Route path="/communication" element={<CommunicationPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>

        {/* Global Real-time Calling and Meeting Modals */}
        <IncomingCallModal />
        <ActiveCallModal />
        <MeetingRoomModal />

        {/* Global Username Setup Modal for First-time Google Login */}
        <UsernameSetupModal />

        {/* Quick Create Project Modal */}
        {isProjectModalOpen && (
          <div className="fixed inset-0 bg-[#202524]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white border border-[#E2E6E4] rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#E2E6E4] pb-3">
                <h2 className="text-lg font-bold text-[#202524] flex items-center gap-2">
                  <FolderGit2 className="w-5 h-5 text-[#1F5E4B]" />
                  <span>Create New Project</span>
                </h2>
                <button
                  onClick={() => setIsProjectModalOpen(false)}
                  className="p-1 rounded-lg text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleQuickCreateProject} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#202524]">Project Name</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g. Sales & ERP Workspace"
                    className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#202524]">Description</label>
                  <textarea
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder="Composition combining CRM, Books and Inventory..."
                    className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl px-3.5 py-2.5 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B] focus:ring-2 focus:ring-[#1F5E4B]/15 h-24"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsProjectModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#6B7471] hover:text-[#202524] border border-[#E2E6E4] text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 transition"
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
