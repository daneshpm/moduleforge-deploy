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
  RotateCcw,
  Bot,
  Wand2,
  Cpu,
  Zap,
  Send,
} from 'lucide-react';
import { useProjectStore } from '../store/useProjectStore';
import { useModuleStore } from '../store/useModuleStore';
import { Module, ProjectModule, ModuleDeployment } from '../types';
import { TeamProjectDashboard } from '../components/TeamProjectDashboard';
import { ExportProjectModal } from '../components/ExportProjectModal';

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
    removeModuleFromCurrentProject,
    updateModulePosition,
    exportProjectZip,
    startLocalModule,
    fetchModuleLogs,
    syncModuleNow,
  } = useProjectStore();

  const { modules, fetchModules } = useModuleStore();

  const [activeView, setActiveView] = useState<'builder' | 'team'>('builder');
  const [moduleSearch, setModuleSearch] = useState('');
  const [selectedProjectModule, setSelectedProjectModule] = useState<ProjectModule | null>(null);
  const [draggingModuleId, setDraggingModuleId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showExportModal, setShowExportModal] = useState(false);

  const [moduleCommits, setModuleCommits] = useState<ModuleDeployment[]>([]);
  const [isLoadingCommits, setIsLoadingCommits] = useState(false);
  const [isSyncingModule, setIsSyncingModule] = useState(false);

  // AI Architect Copilot State
  const [aiPromptInput, setAiPromptInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiThinkingMessage, setAiThinkingMessage] = useState<string | null>(null);

  const handleAiAction = (promptText?: string) => {
    const prompt = (promptText || aiPromptInput).trim().toLowerCase();
    if (!prompt || !currentProject) return;

    setIsAiThinking(true);
    setAiThinkingMessage(`AI Architect analyzing topology: "${prompt}"...`);

    setTimeout(() => {
      if (prompt.includes('organize') || prompt.includes('align') || prompt.includes('layout')) {
        currentProject.modules.forEach((pm, idx) => {
          const col = idx % 3;
          const row = Math.floor(idx / 3);
          updateModulePosition(pm.moduleId, 80 + col * 360, 80 + row * 280);
        });
        setAiThinkingMessage('✨ AI Architect organized topology into clean multi-tier service layout.');
      } else if (prompt.includes('auth') || prompt.includes('user') || prompt.includes('login')) {
        const authMod = modules.find((m) => m.name.toLowerCase().includes('auth') || m.categoryName.toLowerCase().includes('auth'));
        if (authMod) {
          addModuleToCurrentProject(authMod);
          setAiThinkingMessage(`✨ Added ${authMod.name} authentication module to canvas.`);
        } else {
          setAiThinkingMessage('✨ Verified authentication layer dependencies.');
        }
      } else if (prompt.includes('crm') || prompt.includes('payment') || prompt.includes('books') || prompt.includes('inventory')) {
        const keyword = prompt.split(' ').find((w) => ['crm', 'payment', 'books', 'inventory'].includes(w)) || 'crm';
        const target = modules.find((m) => m.name.toLowerCase().includes(keyword) || m.categoryName.toLowerCase().includes(keyword));
        if (target) {
          addModuleToCurrentProject(target);
          setAiThinkingMessage(`✨ Connected ${target.name} module to project canvas.`);
        } else {
          setAiThinkingMessage('✨ AI Architect verified module integration mesh.');
        }
      } else {
        setAiThinkingMessage(`✨ AI Architect synthesized microservice mesh specifications for "${prompt}".`);
      }

      setTimeout(() => {
        setIsAiThinking(false);
        setAiThinkingMessage(null);
        setAiPromptInput('');
      }, 3500);
    }, 850);
  };

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

  if (isLoading || !currentProject) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono text-slate-400">Loading Visual Project Canvas...</p>
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
    const newX = Math.max(20, Math.min(2000, e.clientX - canvasRect.left - dragOffset.x));
    const newY = Math.max(20, Math.min(2000, e.clientY - canvasRect.top - dragOffset.y));
    updateModulePosition(draggingModuleId, newX, newY);
  };

  const handleCanvasMouseUp = () => {
    setDraggingModuleId(null);
  };

  return (
    <div className="h-screen flex flex-col bg-[#05070e] overflow-hidden select-none">
      {/* Visual Builder Top Header Bar */}
      <header className="h-16 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/projects')}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition border border-slate-800"
            title="Back to projects"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-white text-base tracking-tight">{currentProject.name}</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                {currentProject.modules.length} modules
              </span>
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono text-[10px]">
                <Bot className="w-3 h-3 text-purple-400 animate-pulse" />
                <span>AI Architect Active</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">Neural Application Canvas</p>
          </div>

          {/* View Mode Switcher */}
          <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 ml-4 font-semibold text-xs backdrop-blur-md">
            <button
              onClick={() => setActiveView('builder')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeView === 'builder'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Canvas Builder</span>
            </button>
            <button
              onClick={() => setActiveView('team')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeView === 'team'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderGit2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Team & Webhooks</span>
            </button>
          </div>
        </div>

        {/* Save & Export Controls */}
        <div className="flex items-center gap-3">
          {saveMessage && (
            <div className="px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono flex items-center gap-1.5 animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{saveMessage}</span>
            </div>
          )}

          <button
            onClick={saveCurrentProject}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-xs border border-slate-800 flex items-center gap-2 transition"
          >
            <Save className="w-4 h-4 text-indigo-400" />
            <span>{isSaving ? 'Saving...' : 'Save Canvas'}</span>
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4 text-white" />
            <span>Export & Run Prompt</span>
          </button>
        </div>
      </header>

      {/* Export & Run Prompt Modal */}
      {showExportModal && (
        <ExportProjectModal
          project={currentProject}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* Main Content Workspace */}
      {activeView === 'team' ? (
        <div className="flex-1 overflow-y-auto p-6 max-w-7xl mx-auto w-full">
          <TeamProjectDashboard project={currentProject} />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* COLUMN 1: LEFT MODULES DRAWER */}
        <aside className="w-80 bg-slate-950/90 border-r border-slate-800/80 flex flex-col shrink-0 z-20 backdrop-blur-xl">
          <div className="p-4 border-b border-slate-800 space-y-3">
            <h2 className="font-bold text-xs uppercase font-mono tracking-wider text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Modular Components</span>
              </span>
              <span className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded font-mono">AI Ready</span>
            </h2>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={moduleSearch}
                onChange={(e) => setModuleSearch(e.target.value)}
                placeholder="Search modules (CRM, Auth...)"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
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
                      ? 'bg-slate-900/40 border-slate-800 opacity-60'
                      : 'bg-slate-900/80 border-slate-800/80 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-xs text-white block">{mod.name}</span>
                      <span className="text-[10px] text-indigo-400 font-mono">{mod.categoryName} • v{mod.version}</span>
                    </div>
                    <button
                      onClick={() => addModuleToCurrentProject(mod)}
                      disabled={isAdded}
                      className={`px-3 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition ${
                        isAdded
                          ? 'bg-slate-800 text-slate-500 cursor-default'
                          : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-sm'
                      }`}
                    >
                      {isAdded ? 'Added' : <><Plus className="w-3 h-3" /> Add</>}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-2 leading-snug font-sans">
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
          className="flex-1 bg-[#060813] bg-ai-grid bg-ai-mesh relative overflow-auto cursor-crosshair p-8 select-none"
        >
          {/* Ambient Header Bar */}
          <div className="absolute top-4 left-4 z-10 px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs font-mono text-slate-300 flex items-center gap-2 backdrop-blur-md shadow-xl">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>AI Neural Canvas • Drag modules to compose architecture</span>
          </div>

          {/* AI Thinking Feedback Banner */}
          {aiThinkingMessage && (
            <div className="absolute top-4 right-4 z-20 px-4 py-2 rounded-xl bg-purple-950/80 border border-purple-500/40 text-xs font-mono text-purple-200 flex items-center gap-2 backdrop-blur-md shadow-2xl animate-fade-in">
              <Bot className="w-4 h-4 text-purple-400 animate-bounce" />
              <span>{aiThinkingMessage}</span>
            </div>
          )}

          {/* Empty Canvas State */}
          {currentProject.modules.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 space-y-4 pointer-events-none">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-2xl shadow-indigo-500/20 animate-ai-glow">
                <Bot className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">AI Project Canvas Ready</h3>
                <p className="text-xs text-slate-400 max-w-md">
                  Add modules from the left drawer or ask the AI Architect below to compose your microservices stack.
                </p>
              </div>
            </div>
          ) : (
            <div className="relative w-[2400px] h-[2400px]">
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
                    className={`absolute w-80 rounded-2xl bg-slate-950/90 border backdrop-blur-xl shadow-2xl transition-all cursor-grab active:cursor-grabbing p-5 ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-500/40 shadow-indigo-500/20'
                        : 'border-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    {/* Node Holographic Connectors (Top, Bottom, Left, Right) */}
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-indigo-500/20" title="API Socket Input" />
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-purple-500 ring-4 ring-purple-500/20" title="API Socket Output" />
                    <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 rounded-full bg-pink-500 ring-4 ring-pink-500/20" title="Mesh Bus Connector" />
                    <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" title="State Stream" />

                    {/* Module Node Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1 text-slate-500 hover:text-slate-300 cursor-move">
                          <Grip className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                            <span>{mod?.name || 'Module'}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          </h4>
                          <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider">{mod?.categoryName} • v{pm.moduleVersion}</span>
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
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition"
                        title="Remove from project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2 leading-snug mb-3 font-sans">
                      {mod?.description}
                    </p>

                    {/* Microservice Port & View Button */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                        Port: {4567 + idx}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startLocalModule(currentProject.id, pm.id);
                        }}
                        className="px-3 py-1 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-[10px] flex items-center gap-1 transition shadow-sm shadow-indigo-600/30"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>View (Run)</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Floating AI Copilot Prompt Bar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20">
            <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-3 shadow-2xl backdrop-blur-2xl space-y-2.5 ai-glow-border">
              {/* Quick AI Suggestions Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-[11px] font-mono text-slate-400 scrollbar-none">
                <span className="text-indigo-400 font-bold shrink-0 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  <span>AI Suggestions:</span>
                </span>
                <button
                  onClick={() => handleAiAction('auto-align layout')}
                  className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 hover:text-white border border-slate-800 shrink-0 transition"
                >
                  ⚡ Auto-Align Topology
                </button>
                <button
                  onClick={() => handleAiAction('add authentication module')}
                  className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 hover:text-white border border-slate-800 shrink-0 transition"
                >
                  + Add Auth Layer
                </button>
                <button
                  onClick={() => handleAiAction('connect crm and payments')}
                  className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 hover:text-white border border-slate-800 shrink-0 transition"
                >
                  + Link CRM & Payments
                </button>
              </div>

              {/* Prompt Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAiAction();
                }}
                className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800/80"
              >
                <Bot className="w-4 h-4 text-purple-400 ml-2.5 shrink-0" />
                <input
                  type="text"
                  value={aiPromptInput}
                  onChange={(e) => setAiPromptInput(e.target.value)}
                  placeholder="Ask AI Architect to compose, align, or generate API mesh..."
                  className="bg-transparent text-xs text-white placeholder-slate-500 w-full focus:outline-none px-2 font-medium"
                />
                <button
                  type="submit"
                  disabled={isAiThinking || !aiPromptInput.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shrink-0 transition flex items-center gap-1 shadow-md shadow-indigo-600/30 disabled:opacity-50"
                >
                  {isAiThinking ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Generate</span>
                      <Send className="w-3 h-3" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </main>

        {/* COLUMN 3: RIGHT CONFIGURATION INSPECTOR */}
        <aside className="w-80 bg-slate-900/90 border-l border-slate-800 flex flex-col shrink-0 z-20">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-xs uppercase font-mono tracking-wider text-slate-400 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              <span>Module Inspector</span>
            </h2>
            {selectedProjectModule && (
              <button
                onClick={() => setSelectedProjectModule(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="p-5 flex-1 overflow-y-auto space-y-5">
            {selectedProjectModule ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">
                      {selectedProjectModule.module?.name}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {selectedProjectModule.module?.categoryName}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
                    <span>{selectedProjectModule.module?.author}</span>
                    <span className="text-slate-500">{selectedProjectModule.module?.sourceType}</span>
                  </div>
                </div>

                {/* Git Repository & Branch */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Github className="w-3.5 h-3.5 text-slate-300" />
                      <span>Repository:</span>
                    </span>
                    <span className="text-white font-bold truncate max-w-[150px]">
                      {selectedProjectModule.githubRepository || selectedProjectModule.module?.githubRepo || 'Local Module'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Branch:</span>
                    </span>
                    <span className="text-indigo-300 font-bold">
                      {selectedProjectModule.githubBranch || selectedProjectModule.module?.githubBranch || 'main'}
                    </span>
                  </div>
                </div>

                {/* Git Commits Section (Latest + History) */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <GitCommit className="w-4 h-4 text-indigo-400" />
                      <span>Git Commits</span>
                    </h4>
                    <button
                      onClick={async () => {
                        setIsSyncingModule(true);
                        await syncModuleNow(currentProject.id, selectedProjectModule.id);
                        const logs = await fetchModuleLogs(currentProject.id, selectedProjectModule.id);
                        setModuleCommits(logs);
                        setIsSyncingModule(false);
                      }}
                      disabled={isSyncingModule}
                      className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono flex items-center gap-1 transition"
                      title="Sync latest commit from GitHub"
                    >
                      <RefreshCw className={`w-3 h-3 text-indigo-400 ${isSyncingModule ? 'animate-spin' : ''}`} />
                      <span>{isSyncingModule ? 'Syncing...' : 'Sync'}</span>
                    </button>
                  </div>

                  {/* Latest Synced Commit */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5 font-mono text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider">Latest Commit</span>
                      <span className="text-emerald-400 font-bold text-[11px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        {selectedProjectModule.currentCommitSha?.slice(0, 7) || selectedProjectModule.module?.githubCurrentCommit?.slice(0, 7) || 'a83f21c'}
                      </span>
                    </div>

                    <p className="text-white text-xs font-sans font-medium line-clamp-2">
                      {selectedProjectModule.lastCommitMessage || selectedProjectModule.module?.description || 'Synchronized latest module codebase'}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                      <span>Author: <strong className="text-slate-300">{selectedProjectModule.lastCommitAuthor || selectedProjectModule.ownerName || 'Developer'}</strong></span>
                      <span>{selectedProjectModule.lastSyncedAt ? new Date(selectedProjectModule.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}</span>
                    </div>
                  </div>

                  {/* Other / Previous Commits History */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span className="flex items-center gap-1">
                        <History className="w-3 h-3 text-slate-400" />
                        <span>Commit History</span>
                      </span>
                      <span>({moduleCommits.length} recorded)</span>
                    </div>

                    {isLoadingCommits ? (
                      <div className="text-center py-3 text-slate-500 text-xs font-mono">
                        Loading commit logs...
                      </div>
                    ) : moduleCommits.length === 0 ? (
                      <div className="p-2.5 rounded-lg bg-slate-900/50 text-slate-500 text-[11px] font-mono text-center">
                        No previous commits recorded yet.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {moduleCommits.map((log) => (
                          <div
                            key={log.id}
                            className="p-2 rounded-lg bg-slate-900 border border-slate-800/80 font-mono text-[11px] space-y-0.5"
                          >
                            <div className="flex items-center justify-between text-slate-400">
                              <span className="font-bold text-amber-300">Commit {log.commitSha?.slice(0, 7)}</span>
                              <span className="text-[10px] text-slate-500">{new Date(log.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-slate-300 font-sans text-xs line-clamp-1">
                              {log.commitMessage || 'Automated commit'}
                            </p>
                            <div className="text-[10px] text-slate-400">
                              by {log.author || 'Developer'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <span className="text-slate-400 font-semibold block">Description</span>
                  <p className="text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
                    {selectedProjectModule.module?.description}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => startLocalModule(currentProject.id, selectedProjectModule.id)}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View & Run Local Module</span>
                  </button>

                  {(selectedProjectModule.githubRepository || selectedProjectModule.module?.githubRepo) && (
                    <a
                      href={`https://github.com/${selectedProjectModule.githubRepository || selectedProjectModule.module?.githubRepo}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 rounded-xl bg-slate-950 hover:bg-slate-900 text-slate-200 border border-slate-800 text-xs font-semibold flex items-center justify-center gap-2 transition"
                    >
                      <Github className="w-4 h-4" />
                      <span>Open on GitHub</span>
                    </a>
                  )}

                  <button
                    onClick={() => removeModuleFromCurrentProject(selectedProjectModule.moduleId)}
                    className="w-full py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center justify-center gap-2 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Module from Canvas</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 space-y-2">
                <Info className="w-6 h-6 mx-auto text-slate-600" />
                <p className="text-xs">Click any module on the canvas to inspect its configuration and specifications.</p>
              </div>
            )}

            {/* Included Modules Checklist */}
            <div className="pt-6 border-t border-slate-800 space-y-3">
              <h4 className="font-bold text-xs text-white uppercase font-mono tracking-wider">
                Project Module List ({currentProject.modules.length})
              </h4>
              <div className="space-y-2">
                {currentProject.modules.map((pm) => (
                  <div
                    key={pm.id}
                    onClick={() => setSelectedProjectModule(pm)}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs cursor-pointer hover:border-slate-700"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="font-bold text-white">{pm.module?.name}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">v{pm.moduleVersion}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
      )}
    </div>
  );
};
