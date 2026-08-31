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
  Crown,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F7F8F7] text-[#202524] flex flex-col selection:bg-[#1F5E4B] selection:text-white">
      {/* Top Header */}
      <header className="h-20 border-b border-[#E2E6E4] px-8 flex items-center justify-between sticky top-0 bg-white/85 backdrop-blur-xl z-50 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1F5E4B] p-0.5 shadow-md shadow-[#1F5E4B]/20 flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-black text-xl tracking-tight primary-text-gradient">ModuleForge</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="text-xs font-semibold text-[#6B7471] hover:text-[#202524] transition px-3 py-2 rounded-xl hover:bg-[#EAF3EF]"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/signup')}
            className="px-4 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white font-bold text-xs shadow-md shadow-[#1F5E4B]/20 transition flex items-center gap-2"
          >
            <span>Sign Up Free</span>
            <ArrowRight className="w-3.5 h-3.5 text-white stroke-[2.5]" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-6 text-center overflow-hidden max-w-6xl mx-auto">
        {/* Subtle Emerald Ambient Orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[380px] bg-[#EAF3EF] rounded-full blur-[100px] pointer-events-none -z-10" />
        <div className="absolute top-1/3 left-1/3 w-[320px] h-[320px] bg-[#D1E6DC]/60 rounded-full blur-[90px] pointer-events-none -z-10" />

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EAF3EF] border border-[#1F5E4B]/20 text-[#1F5E4B] text-xs font-mono mb-8 font-semibold animate-pulse-subtle">
          <Crown className="w-3.5 h-3.5 text-[#1F5E4B]" />
          <span>Next-Gen Visual Software Composer for AI Agents</span>
        </div>

        <h1 className="text-5xl sm:text-6xl font-black text-[#202524] tracking-tight max-w-4xl mx-auto leading-[1.15] mb-6">
          Build with modules.{' '}
          <span className="primary-text-gradient">
            Not from scratch.
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-[#6B7471] max-w-2xl mx-auto font-normal leading-relaxed mb-10">
          Discover reusable software modules, combine them into a project visually, and download everything as one ready-to-build package.
        </p>

        {/* Hero CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <button
            onClick={() => navigate('/modules')}
            className="px-6 py-3.5 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white font-extrabold text-sm shadow-xl shadow-[#1F5E4B]/25 flex items-center gap-2.5 transition transform hover:-translate-y-0.5"
          >
            <Boxes className="w-4 h-4 text-white stroke-[2.5]" />
            <span>Explore Modules</span>
          </button>
          <button
            onClick={() => navigate('/modules/create')}
            className="px-6 py-3.5 rounded-xl bg-white hover:bg-[#F7F8F7] text-[#202524] font-semibold text-sm border border-[#E2E6E4] hover:border-[#1F5E4B]/40 flex items-center gap-2.5 transition shadow-xs"
          >
            <Terminal className="w-4 h-4 text-[#1F5E4B]" />
            <span>Create Module</span>
          </button>
        </div>

        {/* Visual Workflow Diagram */}
        <div className="relative rounded-3xl bg-white border border-[#E2E6E4] p-8 shadow-card-hover max-w-4xl mx-auto">
          <div className="absolute -top-3 left-6 px-3 py-1 bg-[#1F5E4B] text-[11px] font-mono text-white rounded-md font-bold shadow-xs">
            VISUAL WORKFLOW ARCHITECTURE
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-center pt-2">
            {/* Input Modules */}
            <div className="sm:col-span-2 grid grid-cols-2 gap-2.5">
              {[
                { name: 'CRM', category: 'Customer Care', color: 'border-[#1F5E4B]/20 text-[#1F5E4B] bg-[#EAF3EF]' },
                { name: 'Books', category: 'Accounting', color: 'border-[#2E7D5B]/20 text-[#2E7D5B] bg-[#F0F9F5]' },
                { name: 'Inventory', category: 'Stock Control', color: 'border-[#1F5E4B]/20 text-[#1F5E4B] bg-[#EAF3EF]' },
                { name: 'Payments', category: 'Transactions', color: 'border-[#2E7D5B]/20 text-[#2E7D5B] bg-[#F0F9F5]' },
              ].map((mod) => (
                <div
                  key={mod.name}
                  className={`p-3 rounded-xl border ${mod.color} flex flex-col text-left transition transform hover:scale-105 shadow-xs`}
                >
                  <span className="font-bold text-sm text-[#202524]">{mod.name}</span>
                  <span className="text-[10px] font-mono opacity-80">{mod.category}</span>
                </div>
              ))}
            </div>

            {/* Arrow 1 */}
            <div className="flex flex-col items-center justify-center text-[#6B7471] font-mono text-xs py-2">
              <div className="w-8 h-8 rounded-full bg-[#EAF3EF] border border-[#1F5E4B]/20 flex items-center justify-center text-[#1F5E4B] font-bold mb-1">
                ↓
              </div>
              <span>Drag & Combine</span>
            </div>

            {/* Project Box */}
            <div className="p-4 rounded-2xl bg-[#EAF3EF] border border-[#1F5E4B]/30 text-center flex flex-col items-center justify-center">
              <Code2 className="w-6 h-6 text-[#1F5E4B] mb-1" />
              <span className="font-bold text-sm text-[#202524]">Your Project</span>
              <span className="text-[10px] text-[#1F5E4B] font-mono font-semibold">PROJECT.json</span>
            </div>

            {/* Arrow 2 & Export */}
            <div className="flex flex-col items-center justify-center text-center">
              <div className="p-4 rounded-2xl bg-white border border-[#E2E6E4] shadow-xs text-center flex flex-col items-center justify-center w-full">
                <Download className="w-5 h-5 text-[#1F5E4B] mb-1" />
                <span className="font-bold text-xs text-[#202524]">Export ZIP</span>
                <span className="text-[10px] text-[#2E7D5B] font-mono font-semibold">my-erp.zip</span>
              </div>
            </div>
          </div>

          {/* Antigravity Destination */}
          <div className="mt-6 pt-6 border-t border-[#E2E6E4] flex flex-col sm:flex-row items-center justify-between text-xs text-[#6B7471] font-mono gap-3">
            <div className="flex items-center gap-2 text-[#202524]">
              <Cpu className="w-4 h-4 text-[#1F5E4B]" />
              <span>Target Environment:</span>
              <span className="px-2 py-0.5 rounded bg-[#EAF3EF] text-[#1F5E4B] font-bold border border-[#1F5E4B]/20">
                Antigravity / Cursor / Claude Code
              </span>
            </div>
            <span className="text-[#2E7D5B] flex items-center gap-1 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" /> 100% Agent Compatible
            </span>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white border-t border-[#E2E6E4] px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black text-[#202524] mb-3">
              How <span className="primary-text-gradient">ModuleForge</span> Works
            </h2>
            <p className="text-[#6B7471] text-sm max-w-xl mx-auto">
              From modular software upload to instant AI agent orchestration in 6 straightforward steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Upload or Import',
                desc: 'Upload a ZIP or import any public GitHub repository containing your module code.',
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
                <div key={item.step} className="p-6 rounded-2xl bg-[#F7F8F7] border border-[#E2E6E4] space-y-3 relative group hover:border-[#1F5E4B]/40 hover:shadow-card transition">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black font-mono text-[#1F5E4B]/40">{item.step}</span>
                    <Icon className="w-5 h-5 text-[#1F5E4B]" />
                  </div>
                  <h3 className="font-bold text-[#202524] text-base">{item.title}</h3>
                  <p className="text-xs text-[#6B7471] leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#E2E6E4] py-8 px-8 text-center text-xs text-[#6B7471] font-mono flex flex-col sm:flex-row justify-between items-center max-w-6xl mx-auto w-full gap-4 bg-[#F7F8F7]">
        <div>ModuleForge — Reusable Software Module Platform</div>
        <div>Built for Antigravity & AI Coding Agents</div>
      </footer>
    </div>
  );
};
