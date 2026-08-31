import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save,
  Download,
  Plus,
  Trash2,
  Search,
  ArrowLeft,
  Layers,
  Sparkles,
  CheckCircle2,
  Sliders,
  Grip,
  FolderGit2,
  Info,
  X,
  FileCode2,
  ExternalLink,
  GitBranch,
  Github,
  RefreshCw,
  GitCommit,
  History,
  Bot,
  Send,
  Globe,
  Video,
  Cpu,
  Zap,
  Wand2,
  Check,
  Radio,
  LayoutDashboard,
  Code2,
  Boxes,
  Users,
  ChevronRight,
} from 'lucide-react';
import { useProjectStore } from '../store/useProjectStore';
import { useModuleStore } from '../store/useModuleStore';
import { useCommunicationStore } from '../store/useCommunicationStore';
import { ExportProjectModal } from '../components/ExportProjectModal';
import { ArchitectureGlueModal } from '../components/ArchitectureGlueModal';
import {
  aiWeaverService,
  CURATED_TEMPLATES,
  SynthesizedArchitecture,
  ArchitectureTemplate,
} from '../services/aiWeaverService';
import { ProjectModule, ModuleDeployment } from '../types';
import { ProjectRepoView } from '../components/project/ProjectRepoView';
import { ProjectCodeEditor } from '../components/project/ProjectCodeEditor';
import { TeamProjectDashboard } from '../components/TeamProjectDashboard';

type WorkspaceTab = 'overview' | 'architecture' | 'modules' | 'code' | 'repository' | 'team';

export const VisualBuilderPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const {
    currentProject,
    isLoading,
    isSaving,
    saveMessage,
    loadProject,
    saveCurrentProject,
    addModuleToCurrentProject,
    applySynthesizedArchitecture,
    removeModuleFromCurrentProject,
    updateModulePosition,
    startLocalModule,
    fetchModuleLogs,
    syncModuleNow,
  } = useProjectStore();

  const { modules, fetchModules } = useModuleStore();

  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('architecture');
  const [moduleSearch, setModuleSearch] = useState('');
  const [selectedProjectModule, setSelectedProjectModule] = useState<ProjectModule | null>(null);
  const [draggingModuleId, setDraggingModuleId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showExportModal, setShowExportModal] = useState(false);
  const [showGlueModal, setShowGlueModal] = useState(false);

  const [moduleCommits, setModuleCommits] = useState<ModuleDeployment[]>([]);
  const [isLoadingCommits, setIsLoadingCommits] = useState(false);
  const [isSyncingModule, setIsSyncingModule] = useState(false);

  // AI Agentic Weaver State
  const [aiPromptInput, setAiPromptInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiThinkingMessage, setAiThinkingMessage] = useState<string | null>(null);
  const [agentStep, setAgentStep] = useState<number>(0);
  const [currentArchitecture, setCurrentArchitecture] = useState<SynthesizedArchitecture | null>(null);

  useEffect(() => {
    fetchModules();
    if (projectId) {
      loadProject(projectId);
    }
  }, [projectId, fetchModules, loadProject]);

  useEffect(() => {
    if (selectedProjectModule && currentProject) {
      setIsLoadingCommits(true);
      fetchModuleLogs(currentProject.id, selectedProjectModule.id).then((logs) => {
        setModuleCommits(logs);
        setIsLoadingCommits(false);
      });
    } else {
      setModuleCommits([]);
    }
  }, [selectedProjectModule?.id, currentProject?.id, fetchModuleLogs]);

  // Update current architecture state when project modules change
  useEffect(() => {
    if (currentProject && modules.length > 0 && currentProject.modules.length > 0) {
      const activeMods = currentProject.modules
        .map((pm) => pm.module || modules.find((m) => m.id === pm.moduleId))
        .filter(Boolean) as any[];

      if (activeMods.length > 0) {
        const synthesized = aiWeaverService.synthesizeArchitecture(
          currentProject.name || 'Application Architecture',
          activeMods
        );
        setCurrentArchitecture(synthesized);
      }
    }
  }, [currentProject?.modules.length, modules]);

  // Autonomous Agentic Architecture Synthesis Flow
  const handleWeaveArchitecture = (promptText?: string) => {
    const prompt = (promptText || aiPromptInput).trim();
    if (!prompt || !currentProject) return;

    setIsAiThinking(true);
    setAgentStep(1);
    setAiThinkingMessage('🧠 Step 1/4: Analyzing architectural requirements & domain semantics...');

    setTimeout(() => {
      setAgentStep(2);
      setAiThinkingMessage('📦 Step 2/4: Querying Module Registry & verifying dependency contracts...');

      setTimeout(() => {
        setAgentStep(3);
        setAiThinkingMessage('🕸️ Step 3/4: Calculating neural socket mesh & multi-tier topology...');

        setTimeout(() => {
          setAgentStep(4);
          setAiThinkingMessage('⚡ Step 4/4: Synthesizing TypeScript glue orchestrator & .env config...');

          const synthesized = aiWeaverService.synthesizeArchitecture(prompt, modules);
          setCurrentArchitecture(synthesized);

          // Apply auto-positioned modules to current project canvas
          if (synthesized.matchedModules.length > 0) {
            applySynthesizedArchitecture(synthesized.matchedModules);
          }

          setTimeout(() => {
            setIsAiThinking(false);
            setAiThinkingMessage(`✨ Architecture materialized: ${synthesized.matchedModules.length} microservices bound!`);
            setAiPromptInput('');
            setAgentStep(0);

            setTimeout(() => setAiThinkingMessage(null), 4000);
          }, 600);
        }, 600);
      }, 600);
    }, 600);
  };

  if (isLoading || !currentProject) {
    return (
      <div className="h-screen bg-[#F7F8F7] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-2 border-[#1F5E4B] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono text-[#6B7471]">Loading Visual Project Workspace...</p>
      </div>
    );
  }

  const filteredMarketplaceModules = modules.filter(
    (m) =>
      m.name.toLowerCase().includes(moduleSearch.toLowerCase()) ||
      m.categoryName.toLowerCase().includes(moduleSearch.toLowerCase())
  );

  // Handle Dragging Canvas Nodes
  const handleNodeMouseDown = (e: React.MouseEvent, pm: ProjectModule) => {
    e.stopPropagation();
    setSelectedProjectModule(pm);
    setDraggingModuleId(pm.moduleId);
    const canvasRect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (canvasRect) {
      setDragOffset({
        x: e.clientX - (canvasRect.left + pm.xPosition),
        y: e.clientY - (canvasRect.top + pm.yPosition),
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggingModuleId) return;
    const canvasRect = e.currentTarget.getBoundingClientRect();
    const newX = Math.max(20, Math.min(2200, e.clientX - canvasRect.left - dragOffset.x));
    const newY = Math.max(20, Math.min(2200, e.clientY - canvasRect.top - dragOffset.y));
    updateModulePosition(draggingModuleId, newX, newY);
  };

  const handleCanvasMouseUp = () => {
    setDraggingModuleId(null);
  };

  // Compute live SVG Bezier Curves between sequentially connected canvas nodes
  const projectModules = currentProject.modules;
  const computedCurves: Array<{
    id: string;
    d: string;
    midX: number;
    midY: number;
    protocol: string;
    sourceName: string;
    targetName: string;
  }> = [];

  for (let i = 0; i < projectModules.length - 1; i++) {
    const src = projectModules[i];
    const tgt = projectModules[i + 1];

    const x1 = src.xPosition + 320; // right edge of source card
    const y1 = src.yPosition + 110; // vertical center
    const x2 = tgt.xPosition; // left edge of target card
    const y2 = tgt.yPosition + 110; // vertical center

    const dx = Math.max(60, Math.abs(x2 - x1) / 2);
    const cx1 = x1 + dx;
    const cy1 = y1;
    const cx2 = x2 - dx;
    const cy2 = y2;

    const d = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    const connDef = currentArchitecture?.connections[i];
    const protocol = connDef?.protocol || (i === 0 ? 'GraphQL' : i === projectModules.length - 2 ? 'Database' : 'REST');

    computedCurves.push({
      id: `curve-${src.id}-${tgt.id}`,
      d,
      midX,
      midY,
      protocol,
      sourceName: src.module?.name || 'Service A',
      targetName: tgt.module?.name || 'Service B',
    });
  }

  return (
    <div className="h-screen flex flex-col bg-[#F7F8F7] overflow-hidden select-none">
      {/* Visual Builder Top Header Bar */}
      <header className="h-16 bg-white border-b border-[#E2E6E4] px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 shadow-xs">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => navigate('/projects')}
            className="p-2 rounded-xl bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#6B7471] hover:text-[#202524] transition border border-[#E2E6E4]"
            title="Back to projects"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-[#202524] text-sm sm:text-base tracking-tight truncate max-w-[140px] sm:max-w-xs">
                {currentProject.name}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 font-bold shrink-0">
                {currentProject.modules.length} nodes
              </span>
              {currentProject.repository ? (
                <span className="hidden sm:flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F7F8F7] text-[#1F5E4B] border border-[#E2E6E4] text-[10px] font-mono font-bold">
                  <Github className="w-3 h-3" />
                  <span>{currentProject.repository.name}</span>
                </span>
              ) : (
                <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EAF3EF] border border-[#1F5E4B]/20 text-[#1F5E4B] font-mono text-[10px] font-semibold">
                  <Bot className="w-3 h-3 text-[#1F5E4B] animate-pulse" />
                  <span>AI Weaver Active</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global Project Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {saveMessage && (
            <div className="hidden sm:flex px-3 py-1 rounded-xl bg-[#F0F9F5] text-[#2E7D5B] border border-[#2E7D5B]/20 text-xs font-mono items-center gap-1.5 animate-fade-in font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{saveMessage}</span>
            </div>
          )}

          {/* Architecture Glue Inspector Button */}
          {currentArchitecture && (
            <button
              onClick={() => setShowGlueModal(true)}
              className="px-3 py-2 rounded-xl bg-[#EAF3EF] hover:bg-[#1F5E4B] text-[#1F5E4B] hover:text-white font-bold text-xs border border-[#1F5E4B]/30 flex items-center gap-1.5 transition shadow-xs"
              title="Inspect Auto-Generated TypeScript Glue & .env"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Inspect Glue Code</span>
            </button>
          )}

          <button
            onClick={() => {
              if (currentProject) {
                useCommunicationStore.getState().startMeeting(`Live Canvas: ${currentProject.name}`, {
                  projectId: currentProject.id,
                  teamId: currentProject.teamId || undefined,
                });
              }
            }}
            className="px-3 py-2 rounded-xl bg-white hover:bg-[#EAF3EF] text-[#202524] font-bold text-xs border border-[#E2E6E4] hover:border-[#1F5E4B]/40 flex items-center gap-1.5 transition shadow-xs"
            title="Start Live Video/Audio Huddle with Screen Sharing"
          >
            <Video className="w-3.5 h-3.5 text-[#1F5E4B]" />
            <span className="hidden md:inline">Live Huddle</span>
          </button>

          {activeWorkspaceTab === 'architecture' && (
            <button
              onClick={saveCurrentProject}
              disabled={isSaving}
              className="px-3.5 sm:px-4 py-2 rounded-xl bg-white hover:bg-[#F7F8F7] text-[#202524] font-semibold text-xs border border-[#E2E6E4] hover:border-[#1F5E4B]/40 flex items-center gap-1.5 transition shadow-xs"
            >
              <Save className="w-4 h-4 text-[#1F5E4B]" />
              <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save Canvas'}</span>
            </button>
          )}

          <button
            onClick={() => setShowExportModal(true)}
            className="px-3.5 sm:px-4 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white font-bold text-xs shadow-md shadow-[#1F5E4B]/20 flex items-center gap-1.5 transition"
          >
            <Download className="w-4 h-4 text-white" />
            <span>Export</span>
          </button>
        </div>
      </header>

      {/* Primary Project Navigation Ribbon (Overview | Architecture | Modules | Code | Repository | Team) */}
      <div className="h-12 bg-white border-b border-[#E2E6E4] px-6 flex items-center justify-between shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-1 font-bold text-xs">
          <button
            onClick={() => setActiveWorkspaceTab('overview')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 ${
              activeWorkspaceTab === 'overview'
                ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20'
                : 'text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('architecture')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 ${
              activeWorkspaceTab === 'architecture'
                ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20'
                : 'text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Architecture</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('modules')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 ${
              activeWorkspaceTab === 'modules'
                ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20'
                : 'text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Modules ({currentProject.modules.length})</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('code')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 ${
              activeWorkspaceTab === 'code'
                ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20'
                : 'text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Code</span>
          </button>

          <button
            onClick={() => setActiveWorkspaceTab('repository')}
            className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 ${
              activeWorkspaceTab === 'repository'
                ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20'
                : 'text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]'
            }`}
          >
            <Github className="w-4 h-4" />
            <span>Repository</span>
          </button>

          {currentProject.projectType === 'team' && (
            <button
              onClick={() => setActiveWorkspaceTab('team')}
              className={`px-3.5 py-2 rounded-xl transition flex items-center gap-2 ${
                activeWorkspaceTab === 'team'
                  ? 'bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20'
                  : 'text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Team</span>
            </button>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-[#6B7471]">
          <span>Join Code:</span>
          <span className="font-bold text-[#1F5E4B] bg-[#EAF3EF] px-2 py-0.5 rounded border border-[#1F5E4B]/20">
            {currentProject.joinCode || 'MF-DEFAULT'}
          </span>
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeWorkspaceTab === 'overview' && (
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 w-full space-y-6 animate-fade-in">
          <div className="bg-white rounded-3xl p-8 border border-[#E2E6E4] shadow-card space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-[#202524]">{currentProject.name}</h2>
                <p className="text-xs text-[#6B7471] mt-1">{currentProject.description || 'Custom multi-module composition'}</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 uppercase">
                {currentProject.projectType}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-4 border-t border-[#E2E6E4]">
              <div
                onClick={() => setActiveWorkspaceTab('architecture')}
                className="p-5 rounded-2xl bg-[#F7F8F7] hover:bg-[#EAF3EF] border border-[#E2E6E4] hover:border-[#1F5E4B]/40 cursor-pointer transition space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <Layers className="w-5 h-5 text-[#1F5E4B]" />
                  <ChevronRight className="w-4 h-4 text-[#6B7471] group-hover:translate-x-1 transition" />
                </div>
                <div className="font-bold text-sm text-[#202524]">Visual Architecture</div>
                <p className="text-[11px] text-[#6B7471]">Configure microservices & modules on visual node canvas.</p>
              </div>

              <div
                onClick={() => setActiveWorkspaceTab('code')}
                className="p-5 rounded-2xl bg-[#F7F8F7] hover:bg-[#EAF3EF] border border-[#E2E6E4] hover:border-[#1F5E4B]/40 cursor-pointer transition space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <Code2 className="w-5 h-5 text-[#1F5E4B]" />
                  <ChevronRight className="w-4 h-4 text-[#6B7471] group-hover:translate-x-1 transition" />
                </div>
                <div className="font-bold text-sm text-[#202524]">Project Code Editor</div>
                <p className="text-[11px] text-[#6B7471]">Inspect source code, edit manifests, and commit changes.</p>
              </div>

              <div
                onClick={() => setActiveWorkspaceTab('repository')}
                className="p-5 rounded-2xl bg-[#F7F8F7] hover:bg-[#EAF3EF] border border-[#E2E6E4] hover:border-[#1F5E4B]/40 cursor-pointer transition space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <Github className="w-5 h-5 text-[#1F5E4B]" />
                  <ChevronRight className="w-4 h-4 text-[#6B7471] group-hover:translate-x-1 transition" />
                </div>
                <div className="font-bold text-sm text-[#202524]">Overall Repository</div>
                <p className="text-[11px] text-[#6B7471]">GitHub status, branches, commit logs & Git sync.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ARCHITECTURE (VISUAL NEURAL CANVAS) */}
      {activeWorkspaceTab === 'architecture' && (
        <div className="flex-1 flex overflow-hidden relative">
          {/* COLUMN 1: LEFT MODULES DRAWER */}
          <aside className="w-72 sm:w-80 bg-white border-r border-[#E2E6E4] flex flex-col shrink-0 z-20 shadow-xs">
            <div className="p-4 border-b border-[#E2E6E4] space-y-3">
              <h2 className="font-bold text-xs uppercase font-mono tracking-wider text-[#6B7471] flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#1F5E4B]" />
                  <span>Component Registry</span>
                </span>
                <span className="text-[10px] text-[#1F5E4B] bg-[#EAF3EF] px-2 py-0.5 rounded font-mono font-bold">
                  AI Ready
                </span>
              </h2>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7471]" />
                <input
                  type="text"
                  value={moduleSearch}
                  onChange={(e) => setModuleSearch(e.target.value)}
                  placeholder="Search components (Auth, CRM...)"
                  className="w-full bg-[#F7F8F7] border border-[#E2E6E4] rounded-xl pl-8 pr-3 py-2 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none focus:border-[#1F5E4B]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {filteredMarketplaceModules.map((mod) => {
                const isAdded = currentProject.modules.some(
                  (pm) => (pm.module?.id || pm.moduleId) === mod.id
                );

                return (
                  <div
                    key={mod.id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                      isAdded
                        ? 'bg-[#F7F8F7]/60 border-[#E2E6E4] opacity-70'
                        : 'bg-white border-[#E2E6E4] hover:border-[#1F5E4B] hover:shadow-card'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-xs text-[#202524] block">{mod.name}</span>
                        <span className="text-[10px] text-[#1F5E4B] font-mono font-semibold">
                          {mod.categoryName} • v{mod.version}
                        </span>
                      </div>
                      <button
                        onClick={() => addModuleToCurrentProject(mod)}
                        disabled={isAdded}
                        className={`px-3 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition ${
                          isAdded
                            ? 'bg-[#F7F8F7] text-[#6B7471] cursor-default border border-[#E2E6E4]'
                            : 'bg-[#1F5E4B] hover:bg-[#174739] text-white shadow-xs'
                        }`}
                      >
                        {isAdded ? (
                          'Added'
                        ) : (
                          <>
                            <Plus className="w-3 h-3" /> Add
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-[#6B7471] line-clamp-2 mt-2 leading-snug font-sans">
                      {mod.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* COLUMN 2: CENTER INTERACTIVE PROJECT CANVAS */}
          <main
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className="flex-1 bg-[#F7F8F7] bg-ai-grid bg-ai-mesh relative overflow-auto cursor-crosshair p-8 select-none"
          >
            {/* Ambient Header Bar */}
            <div className="absolute top-4 left-4 z-10 px-3.5 py-2 rounded-xl bg-white/90 border border-[#E2E6E4] text-xs font-mono text-[#202524] flex items-center gap-2 backdrop-blur-md shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#1F5E4B] animate-pulse" />
              <span>Neural Canvas • AI Agentic Weaver Active</span>
            </div>

            {/* AI Thinking Feedback Banner / Telemetry HUD */}
            {aiThinkingMessage && (
              <div className="absolute top-4 right-4 z-30 px-4 py-2.5 rounded-2xl bg-[#111413] border border-[#1F5E4B]/50 text-xs font-mono text-white flex items-center gap-3 backdrop-blur-xl shadow-2xl animate-fade-in font-medium">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span>{aiThinkingMessage}</span>
              </div>
            )}

            {/* Canvas Node Playground Area */}
            <div className="relative w-[2400px] h-[2400px]">
              {/* SVG NEURAL MESH DYNAMIC CONNECTION OVERLAY */}
              <svg className="absolute inset-0 pointer-events-none w-full h-full z-0">
                <defs>
                  <linearGradient id="meshGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#1F5E4B" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#2E7D5B" stopOpacity="1" />
                    <stop offset="100%" stopColor="#1F5E4B" stopOpacity="0.8" />
                  </linearGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="glow" />
                    <feComposite in="SourceGraphic" in2="glow" operator="over" />
                  </filter>
                </defs>

                {computedCurves.map((curve) => (
                  <g key={curve.id}>
                    {/* Outer Glow Path */}
                    <path
                      d={curve.d}
                      fill="none"
                      stroke="#1F5E4B"
                      strokeWidth="5"
                      strokeOpacity="0.2"
                    />
                    {/* Dynamic Dashed Animated Flow Curve */}
                    <path
                      d={curve.d}
                      fill="none"
                      stroke="url(#meshGradient)"
                      strokeWidth="3"
                      strokeDasharray="8 6"
                      className="animate-pulse"
                    />
                    {/* Protocol Badge Indicator at Curve Midpoint */}
                    <foreignObject
                      x={curve.midX - 45}
                      y={curve.midY - 12}
                      width="90"
                      height="24"
                      className="overflow-visible pointer-events-auto"
                    >
                      <div className="flex items-center justify-center">
                        <span className="px-2 py-0.5 rounded-md bg-[#181C1B] text-[#2E7D5B] border border-[#1F5E4B]/40 font-mono text-[9px] font-bold shadow-md">
                          {curve.protocol}
                        </span>
                      </div>
                    </foreignObject>
                  </g>
                ))}
              </svg>

              {/* Empty Canvas State */}
              {currentProject.modules.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 space-y-4 pointer-events-none">
                  <div className="w-16 h-16 rounded-3xl bg-[#EAF3EF] border border-[#1F5E4B]/30 flex items-center justify-center text-[#1F5E4B] shadow-md shadow-[#1F5E4B]/10 animate-ai-glow">
                    <Wand2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-[#202524]">AI Neural Canvas Ready</h3>
                    <p className="text-xs text-[#6B7471] max-w-md">
                      Select a curated template below or prompt the AI Agentic Weaver to auto-assemble your full-stack architecture.
                    </p>
                  </div>
                </div>
              )}

              {/* Placed Canvas Module Nodes */}
              {currentProject.modules.map((pm, idx) => {
                const mod = pm.module || modules.find((m) => m.id === pm.moduleId);
                const isSelected = selectedProjectModule?.moduleId === pm.moduleId;

                return (
                  <div
                    key={pm.id}
                    onMouseDown={(e) => handleNodeMouseDown(e, pm)}
                    onClick={() => setSelectedProjectModule(pm)}
                    style={{
                      transform: `translate3d(${pm.xPosition}px, ${pm.yPosition}px, 0)`,
                    }}
                    className={`absolute w-80 rounded-3xl bg-white border shadow-card transition-all cursor-grab active:cursor-grabbing p-5 z-10 ${
                      isSelected
                        ? 'border-[#1F5E4B] ring-4 ring-[#1F5E4B]/15 shadow-card-hover'
                        : 'border-[#E2E6E4] hover:border-[#1F5E4B]/40'
                    }`}
                  >
                    {/* Neural Port Sockets */}
                    <div
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#1F5E4B] ring-4 ring-[#1F5E4B]/15"
                      title="API Inbound Socket"
                    />
                    <div
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#2E7D5B] ring-4 ring-[#2E7D5B]/15"
                      title="API Outbound Socket"
                    />
                    <div
                      className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#174739] ring-4 ring-[#174739]/15"
                      title="Mesh Inbound Pipe"
                    />
                    <div
                      className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#28755E] ring-4 ring-[#28755E]/15"
                      title="Mesh Outbound Pipe"
                    />

                    {/* Module Node Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1 text-[#6B7471] hover:text-[#202524] cursor-move">
                          <Grip className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-[#202524] flex items-center gap-1.5">
                            <span>{mod?.name || 'Module'}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D5B] animate-ping" />
                          </h4>
                          <span className="text-[10px] font-mono text-[#1F5E4B] font-bold uppercase tracking-wider">
                            {mod?.categoryName} • v{pm.moduleVersion}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeModuleFromCurrentProject(pm.moduleId);
                          if (selectedProjectModule?.moduleId === pm.moduleId) {
                            setSelectedProjectModule(null);
                          }
                        }}
                        className="p-1.5 text-[#6B7471] hover:text-[#C94A4A] hover:bg-[#FDF3F3] rounded-lg transition"
                        title="Remove from project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-[#6B7471] line-clamp-2 leading-snug mb-3 font-sans">
                      {mod?.description}
                    </p>

                    {/* Deployed Status & Port Indicator */}
                    <div className="pt-3 border-t border-[#E2E6E4] flex items-center justify-between gap-2 text-[10px] font-mono">
                      <span className="px-2 py-0.5 rounded bg-[#F7F8F7] text-[#6B7471] border border-[#E2E6E4]">
                        Port: {4567 + idx}
                      </span>
                      {mod?.deployedUrl && (
                        <a
                          href={mod.deployedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-2.5 py-1 rounded-xl bg-[#EAF3EF] hover:bg-[#1F5E4B] text-[#1F5E4B] hover:text-white font-bold text-[11px] flex items-center gap-1 transition border border-[#1F5E4B]/20 shadow-xs"
                        >
                          <Globe className="w-3 h-3" />
                          <span>Preview</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* FLOATING BOTTOM AI WEAVER COMMAND BAR */}
            <div className="sticky bottom-4 left-4 right-4 z-40 max-w-4xl mx-auto space-y-2.5">
              {/* Curated Architecture Presets Carousel */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {CURATED_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => handleWeaveArchitecture(tmpl.defaultPrompt)}
                    disabled={isAiThinking}
                    className="px-3 py-1.5 rounded-xl bg-white/95 hover:bg-white text-[#202524] text-xs font-semibold border border-[#E2E6E4] hover:border-[#1F5E4B]/50 flex items-center gap-2 shrink-0 transition shadow-sm hover:shadow-md backdrop-blur-md"
                  >
                    <span>{tmpl.icon}</span>
                    <span className="font-bold">{tmpl.title}</span>
                    <span className="text-[10px] text-[#6B7471] font-mono hidden md:inline">
                      • {tmpl.tagline.split('+')[0]}
                    </span>
                  </button>
                ))}
              </div>

              {/* Natural Language Prompt Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleWeaveArchitecture();
                }}
                className="p-2 rounded-2xl bg-white/95 backdrop-blur-xl border border-[#E2E6E4] shadow-xl flex items-center gap-2"
              >
                <div className="w-8 h-8 rounded-xl bg-[#1F5E4B] flex items-center justify-center text-white shrink-0 shadow-sm shadow-[#1F5E4B]/20">
                  <Wand2 className="w-4 h-4" />
                </div>

                <input
                  type="text"
                  value={aiPromptInput}
                  onChange={(e) => setAiPromptInput(e.target.value)}
                  placeholder="Describe your desired architecture (e.g., 'Build an AI SaaS with Google Auth, Stripe billing, and Postgres')..."
                  className="flex-1 bg-transparent px-2 text-xs text-[#202524] placeholder-[#6B7471] focus:outline-none"
                  disabled={isAiThinking}
                />

                <button
                  type="submit"
                  disabled={!aiPromptInput.trim() || isAiThinking}
                  className="px-4 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-[#1F5E4B]/20 disabled:opacity-40 shrink-0"
                >
                  {isAiThinking ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Weaving...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Weave Architecture</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </main>

          {/* COLUMN 3: RIGHT CONFIGURATION INSPECTOR */}
          <aside className="w-80 bg-white border-l border-[#E2E6E4] flex flex-col shrink-0 z-20 shadow-xs">
            <div className="p-4 border-b border-[#E2E6E4] flex items-center justify-between">
              <h2 className="font-bold text-xs uppercase font-mono tracking-wider text-[#6B7471] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#1F5E4B]" />
                <span>Module Inspector</span>
              </h2>
              {selectedProjectModule && (
                <button
                  onClick={() => setSelectedProjectModule(null)}
                  className="text-xs text-[#6B7471] hover:text-[#202524]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {selectedProjectModule ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-sm text-[#202524]">
                      {selectedProjectModule.module?.name}
                    </h3>
                    <span className="text-xs text-[#1F5E4B] font-mono font-semibold">
                      {selectedProjectModule.module?.categoryName} • v{selectedProjectModule.moduleVersion}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#6B7471]">Canvas Coords:</span>
                      <span className="font-mono text-[#202524]">
                        X: {selectedProjectModule.xPosition}, Y: {selectedProjectModule.yPosition}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7471]">Module ID:</span>
                      <span className="font-mono text-[#202524] truncate max-w-[120px]">
                        {selectedProjectModule.moduleId}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <span className="text-[#6B7471] font-semibold block">Description</span>
                    <p className="text-[#202524] leading-relaxed bg-[#F7F8F7] p-3 rounded-xl border border-[#E2E6E4]">
                      {selectedProjectModule.module?.description}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-1">
                    <button
                      onClick={() => startLocalModule(currentProject.id, selectedProjectModule.id)}
                      className="w-full py-2.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 flex items-center justify-center gap-2 transition"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>View & Run Local Module</span>
                    </button>

                    <button
                      onClick={() => removeModuleFromCurrentProject(selectedProjectModule.moduleId)}
                      className="w-full py-2 rounded-xl bg-[#FDF3F3] hover:bg-[#FBE6E6] text-[#C94A4A] border border-[#C94A4A]/20 text-xs font-semibold flex items-center justify-center gap-2 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Module from Canvas</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-[#6B7471] space-y-2">
                  <Info className="w-6 h-6 mx-auto text-[#6B7471]" />
                  <p className="text-xs">
                    Click any module on the canvas to inspect its configuration and specifications.
                  </p>
                </div>
              )}

              {/* Included Modules Checklist */}
              <div className="pt-6 border-t border-[#E2E6E4] space-y-3">
                <h4 className="font-bold text-xs text-[#202524] uppercase font-mono tracking-wider">
                  Project Module List ({currentProject.modules.length})
                </h4>
                <div className="space-y-2">
                  {currentProject.modules.map((pm) => (
                    <div
                      key={pm.id}
                      onClick={() => setSelectedProjectModule(pm)}
                      className="p-2.5 rounded-xl bg-[#F7F8F7] border border-[#E2E6E4] flex items-center justify-between text-xs cursor-pointer hover:border-[#1F5E4B]/40 hover:bg-white transition"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D5B] shrink-0" />
                        <span className="font-bold text-[#202524]">{pm.module?.name}</span>
                      </div>
                      <span className="font-mono text-[10px] text-[#6B7471]">v{pm.moduleVersion}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* TAB 3: MODULES LIST */}
      {activeWorkspaceTab === 'modules' && (
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 w-full space-y-6 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 border border-[#E2E6E4] shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#202524]">Project Modules Registry</h3>
                <p className="text-xs text-[#6B7471]">
                  Modules linked inside this project repository.
                </p>
              </div>
              <button
                onClick={() => setActiveWorkspaceTab('architecture')}
                className="px-4 py-2 rounded-xl bg-[#1F5E4B] text-white text-xs font-bold shadow-md shadow-[#1F5E4B]/20 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add More Modules</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {currentProject.modules.map((pm) => (
                <div
                  key={pm.id}
                  className="p-5 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-[#202524]">{pm.module?.name}</h4>
                      <span className="text-xs font-mono text-[#1F5E4B]">{pm.module?.categoryName}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20">
                      v{pm.moduleVersion}
                    </span>
                  </div>

                  <p className="text-xs text-[#6B7471] line-clamp-2">{pm.module?.description}</p>

                  <div className="pt-2 border-t border-[#E2E6E4] flex items-center justify-between font-mono text-[11px] text-[#6B7471]">
                    <span>Path: <strong className="text-[#202524]">modules/{pm.module?.slug || pm.module?.name.toLowerCase()}</strong></span>
                    <button
                      onClick={() => removeModuleFromCurrentProject(pm.moduleId)}
                      className="text-[#C94A4A] hover:underline font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CODE (PROJECT CODE EDITOR) */}
      {activeWorkspaceTab === 'code' && (
        <div className="flex-1 flex overflow-hidden">
          <ProjectCodeEditor project={currentProject} />
        </div>
      )}

      {/* TAB 5: REPOSITORY (OVERALL REPOSITORY VIEW) */}
      {activeWorkspaceTab === 'repository' && (
        <div className="flex-1 flex overflow-hidden">
          <ProjectRepoView
            project={currentProject}
            onOpenCodeEditor={() => setActiveWorkspaceTab('code')}
            onOpenArchitecture={() => setActiveWorkspaceTab('architecture')}
          />
        </div>
      )}

      {/* TAB 6: TEAM (TEAM DASHBOARD) */}
      {activeWorkspaceTab === 'team' && (
        <div className="flex-1 flex overflow-hidden">
          <TeamProjectDashboard project={currentProject} />
        </div>
      )}

      {/* Export Package Modal */}
      {showExportModal && (
        <ExportProjectModal
          project={currentProject}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* Architecture Glue Code & Mesh Modal */}
      {showGlueModal && currentArchitecture && (
        <ArchitectureGlueModal
          architecture={currentArchitecture}
          onClose={() => setShowGlueModal(false)}
        />
      )}
    </div>
  );
};
