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
import { CreateProjectModal } from './components/CreateProjectModal';
import { useAuthStore } from './store/useAuthStore';
import { useProjectStore } from './store/useProjectStore';
import { useCommunicationStore } from './store/useCommunicationStore';
import { FolderGit2, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('moduleforge_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('moduleforge_sidebar_collapsed', String(next));
      } catch (e) {
        console.warn('Could not save sidebar preference', e);
      }
      return next;
    });
  };

  // Keyboard shortcut Ctrl+B / Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        <Sidebar
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          isCollapsed={isSidebarCollapsed}
        />
        <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
          <Navbar
            onOpenCreateProject={() => setIsProjectModalOpen(true)}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={toggleSidebar}
          />
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

        {/* Create Project Modal with Repository Choices & Step Progress */}
        <CreateProjectModal
          isOpen={isProjectModalOpen}
          onClose={() => setIsProjectModalOpen(false)}
        />
      </div>
    </RequireAuth>
  );
};
