import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  ArrowRight,
  Sparkles,
  Download,
  Terminal,
  Layers,
  Code2,
  CheckCircle2,
  Cpu,
  Workflow,
  Zap,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="h-20 border-b border-slate-800/80 px-8 flex items-center justify-between sticky top-0 bg-slate-950/80 backdrop-blur-xl z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Layers className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <span className="font-bold text-xl tracking-tight text-white">ModuleForge</span>
            <span className="ml-2 px-2 py-0.5 text-[10px] font-mono bg-indigo-500/10 text-indigo-300 rounded border border-indigo-500/20">
              Developer Engine
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/login')}
            className="text-xs font-semibold text-slate-300 hover:text-white transition px-3 py-2"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/modules')}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
          >
            <span>Launch Platform</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-6 text-center overflow-hidden max-w-6xl mx-auto">
        {/* Glowing Background Orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-purple-600/15 rounded-full blur-[100px] pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono mb-8 animate-pulse-subtle">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Next-Gen Visual Software Composer for AI Agents</span>
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold text-white tracking-tight max-w-4xl mx-auto leading-[1.15] mb-6">
          Build with modules.{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Not from scratch.
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed mb-10">
          Discover reusable software modules, combine them into a project visually, and download everything as one ready-to-build package.
        </p>

        {/* Hero CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <button
            onClick={() => navigate('/modules')}
            className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-xl shadow-indigo-600/30 flex items-center gap-2.5 transition transform hover:-translate-y-0.5"
          >
            <Boxes className="w-4 h-4" />
            <span>Explore Modules</span>
          </button>
          <button
            onClick={() => navigate('/modules/create')}
            className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-sm border border-slate-800 flex items-center gap-2.5 transition"
          >
            <Terminal className="w-4 h-4 text-purple-400" />
            <span>Create Module</span>
          </button>
        </div>

        {/* Visual Workflow Diagram */}
        <div className="relative rounded-2xl bg-slate-900/90 border border-slate-800 p-8 shadow-2xl max-w-4xl mx-auto">
          <div className="absolute -top-3 left-6 px-3 py-1 bg-slate-950 border border-slate-800 text-[11px] font-mono text-indigo-400 rounded-md">
            VISUAL WORKFLOW ARCHITECTURE
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-center pt-2">
            {/* Input Modules */}
            <div className="sm:col-span-2 grid grid-cols-2 gap-2.5">
              {[
                { name: 'CRM', category: 'Customer Care', color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' },
                { name: 'Books', category: 'Accounting', color: 'border-blue-500/40 text-blue-400 bg-blue-500/10' },
                { name: 'Inventory', category: 'Stock Control', color: 'border-purple-500/40 text-purple-400 bg-purple-500/10' },
                { name: 'Payments', category: 'Transactions', color: 'border-amber-500/40 text-amber-400 bg-amber-500/10' },
              ].map((mod) => (
                <div
                  key={mod.name}
                  className={`p-3 rounded-xl border ${mod.color} flex flex-col text-left transition transform hover:scale-105`}
                >
                  <span className="font-bold text-sm text-white">{mod.name}</span>
                  <span className="text-[10px] font-mono opacity-80">{mod.category}</span>
                </div>
              ))}
            </div>

            {/* Arrow 1 */}
            <div className="flex flex-col items-center justify-center text-slate-500 font-mono text-xs py-2">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400 mb-1">
                ↓
              </div>
              <span>Drag & Combine</span>
            </div>

            {/* Project Box */}
            <div className="p-4 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-center flex flex-col items-center justify-center">
              <Code2 className="w-6 h-6 text-indigo-400 mb-1" />
              <span className="font-bold text-sm text-white">Your Project</span>
              <span className="text-[10px] text-indigo-300 font-mono">PROJECT.json</span>
            </div>

            {/* Arrow 2 & Export */}
            <div className="flex flex-col items-center justify-center text-center">
              <div className="p-4 rounded-xl bg-purple-950/60 border border-purple-500/40 text-center flex flex-col items-center justify-center w-full">
                <Download className="w-5 h-5 text-purple-400 mb-1" />
                <span className="font-bold text-xs text-white">Export ZIP</span>
                <span className="text-[10px] text-purple-300 font-mono">my-erp.zip</span>
              </div>
            </div>
          </div>

          {/* Antigravity Destination */}
          <div className="mt-6 pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-2 text-slate-300">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>Target Environment:</span>
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                Antigravity / Cursor / Claude Code
              </span>
            </div>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 100% Agent Compatible
            </span>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-slate-900/50 border-t border-slate-800 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-white mb-3">How ModuleForge Works</h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              From modular software upload to instant AI agent orchestration in 5 straightforward steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Upload or Import',
                desc: 'Upload a ZIP or import any public GitHub repository containing a module.json file.',
                icon: Terminal,
              },
              {
                step: '02',
                title: 'Module Validation',
                desc: 'Our validation engine checks entry points, schemas, dependencies, and AI instructions.',
                icon: Workflow,
              },
              {
                step: '03',
                title: 'Visual Drag & Drop',
                desc: 'Browse the marketplace, drag CRM, Books, Inventory into your canvas, and structure your app.',
                icon: Layers,
              },
              {
                step: '04',
                title: 'Download Ready ZIP',
                desc: 'Generate a single downloadable package containing all source files, PROJECT.json, and README.md.',
                icon: Download,
              },
              {
                step: '05',
                title: 'Open in Antigravity',
                desc: 'Extract locally, open in Antigravity or your favorite coding agent, and prompt it to build the UI.',
                icon: Cpu,
              },
              {
                step: '06',
                title: 'Zero Code Modification',
                desc: 'Source code remains pristine. ModuleForge packages clean codebases without dark magic.',
                icon: Zap,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 relative group hover:border-indigo-500/40 transition">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black font-mono text-indigo-500/40">{item.step}</span>
                    <Icon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h3 className="font-bold text-slate-100 text-base">{item.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800 py-8 px-8 text-center text-xs text-slate-500 font-mono flex flex-col sm:flex-row justify-between items-center max-w-6xl mx-auto w-full gap-4">
        <div>ModuleForge — Reusable Software Module Platform</div>
        <div>Built for Antigravity & AI Coding Agents</div>
      </footer>
    </div>
  );
};
