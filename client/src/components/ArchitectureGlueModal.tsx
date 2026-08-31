import React, { useState } from 'react';
import {
  X,
  FileCode2,
  Copy,
  Check,
  Download,
  Sparkles,
  Layers,
  KeyRound,
  Container,
  Cpu,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { SynthesizedArchitecture } from '../services/aiWeaverService';

interface ArchitectureGlueModalProps {
  architecture: SynthesizedArchitecture;
  onClose: () => void;
}

export const ArchitectureGlueModal: React.FC<ArchitectureGlueModalProps> = ({
  architecture,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'glue' | 'env' | 'docker' | 'mesh'>('glue');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadZip = () => {
    const element = document.createElement('a');
    const file = new Blob([architecture.glueCode], { type: 'text/typescript' });
    element.href = URL.createObjectURL(file);
    element.download = 'architecture-orchestrator.ts';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const envString = Object.entries(architecture.envVariables)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 320 }}
        className="bg-white border border-[#E2E6E4] rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <header className="p-5 border-b border-[#E2E6E4] bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1F5E4B] flex items-center justify-center text-white shadow-md shadow-[#1F5E4B]/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#202524]">{architecture.title}</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20 font-bold">
                  AI Synthesized
                </span>
              </div>
              <p className="text-xs text-[#6B7471] font-sans">
                {architecture.matchedModules.length} microservices bound across{' '}
                {architecture.connections.length} socket pipelines
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadZip}
              className="px-3.5 py-2 rounded-xl bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Orchestrator</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#6B7471] hover:text-[#202524] hover:bg-[#F7F8F7] transition border border-transparent hover:border-[#E2E6E4]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-[#E2E6E4] bg-[#F7F8F7] text-xs font-semibold">
          <button
            onClick={() => setActiveTab('glue')}
            className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition ${
              activeTab === 'glue'
                ? 'border-[#1F5E4B] text-[#1F5E4B] font-bold'
                : 'border-transparent text-[#6B7471] hover:text-[#202524]'
            }`}
          >
            <FileCode2 className="w-4 h-4" />
            <span>TypeScript Orchestrator</span>
          </button>

          <button
            onClick={() => setActiveTab('mesh')}
            className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition ${
              activeTab === 'mesh'
                ? 'border-[#1F5E4B] text-[#1F5E4B] font-bold'
                : 'border-transparent text-[#6B7471] hover:text-[#202524]'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Neural Socket Mesh ({architecture.connections.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('env')}
            className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition ${
              activeTab === 'env'
                ? 'border-[#1F5E4B] text-[#1F5E4B] font-bold'
                : 'border-transparent text-[#6B7471] hover:text-[#202524]'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Environment Config (.env)</span>
          </button>

          <button
            onClick={() => setActiveTab('docker')}
            className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition ${
              activeTab === 'docker'
                ? 'border-[#1F5E4B] text-[#1F5E4B] font-bold'
                : 'border-transparent text-[#6B7471] hover:text-[#202524]'
            }`}
          >
            <Container className="w-4 h-4" />
            <span>Docker Compose</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 bg-[#FAFBFA]">
          {/* TAB 1: TYPESCRIPT GLUE */}
          {activeTab === 'glue' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#6B7471]">src/architecture-orchestrator.ts</span>
                <button
                  onClick={() => handleCopy(architecture.glueCode, 'glue')}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F7F8F7] text-[#202524] text-xs font-mono font-bold border border-[#E2E6E4] flex items-center gap-1.5 transition shadow-xs"
                >
                  {copiedKey === 'glue' ? <Check className="w-3.5 h-3.5 text-[#2E7D5B]" /> : <Copy className="w-3.5 h-3.5 text-[#6B7471]" />}
                  <span>{copiedKey === 'glue' ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-2xl bg-[#111413] text-[#E2E6E4] font-mono text-xs overflow-x-auto leading-relaxed border border-neutral-800 shadow-inner">
                <code>{architecture.glueCode}</code>
              </pre>
            </div>
          )}

          {/* TAB 2: NEURAL SOCKET MESH */}
          {activeTab === 'mesh' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[#EAF3EF] border border-[#1F5E4B]/20 text-xs text-[#1F5E4B] flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <span>
                  The AI Agent has established dynamic bidirectional communication sockets between your microservice nodes.
                </span>
              </div>

              <div className="space-y-2.5">
                {architecture.connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="p-4 rounded-2xl bg-white border border-[#E2E6E4] flex items-center justify-between shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 rounded-xl bg-[#F7F8F7] text-[#202524] font-bold text-xs border border-[#E2E6E4]">
                        {conn.sourceModuleName}
                      </span>
                      <div className="flex items-center gap-1 text-[#1F5E4B] font-mono text-xs font-bold">
                        <span>───[ {conn.protocol} ]───►</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-xl bg-[#F7F8F7] text-[#202524] font-bold text-xs border border-[#E2E6E4]">
                        {conn.targetModuleName}
                      </span>
                    </div>

                    <span className="text-[11px] font-mono text-[#6B7471] bg-[#F7F8F7] px-3 py-1 rounded-lg">
                      {conn.dataPayload}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ENVIRONMENT VARIABLES */}
          {activeTab === 'env' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#6B7471]">.env.example</span>
                <button
                  onClick={() => handleCopy(envString, 'env')}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F7F8F7] text-[#202524] text-xs font-mono font-bold border border-[#E2E6E4] flex items-center gap-1.5 transition shadow-xs"
                >
                  {copiedKey === 'env' ? <Check className="w-3.5 h-3.5 text-[#2E7D5B]" /> : <Copy className="w-3.5 h-3.5 text-[#6B7471]" />}
                  <span>{copiedKey === 'env' ? 'Copied!' : 'Copy .env'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-2xl bg-[#111413] text-[#2E7D5B] font-mono text-xs overflow-x-auto leading-relaxed border border-neutral-800 shadow-inner">
                <code>{envString}</code>
              </pre>
            </div>
          )}

          {/* TAB 4: DOCKER COMPOSE */}
          {activeTab === 'docker' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#6B7471]">docker-compose.yml</span>
                <button
                  onClick={() => handleCopy(architecture.dockerComposeYaml, 'docker')}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F7F8F7] text-[#202524] text-xs font-mono font-bold border border-[#E2E6E4] flex items-center gap-1.5 transition shadow-xs"
                >
                  {copiedKey === 'docker' ? <Check className="w-3.5 h-3.5 text-[#2E7D5B]" /> : <Copy className="w-3.5 h-3.5 text-[#6B7471]" />}
                  <span>{copiedKey === 'docker' ? 'Copied!' : 'Copy YAML'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-2xl bg-[#111413] text-[#E2E6E4] font-mono text-xs overflow-x-auto leading-relaxed border border-neutral-800 shadow-inner">
                <code>{architecture.dockerComposeYaml}</code>
              </pre>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
