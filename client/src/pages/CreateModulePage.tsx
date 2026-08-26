import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Github,
  FileArchive,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ArrowRight,
  Layers,
  Plus,
  Tag,
  Check,
  Terminal,
  GitBranch,
  FolderGit2,
} from 'lucide-react';
import { useModuleStore } from '../store/useModuleStore';
import { ValidationResult } from '../types';
import { ValidationReport } from '../components/ValidationReport';

const CATEGORIES = [
  'CRM',
  'Accounting',
  'Inventory',
  'Payments',
  'HR',
  'Authentication',
  'Analytics',
  'E-commerce',
  'Marketing',
  'Communication',
  'Productivity',
  'Other',
];

const AVAILABLE_TECH = [
  'React',
  'Vue',
  'Angular',
  'Node.js',
  'Python',
  'Java',
  'PHP',
  'Laravel',
  'Django',
  'Next.js',
  'Other',
];

export const CreateModulePage: React.FC = () => {
  const navigate = useNavigate();
  const { validateModuleZip, validateGithubRepo, createModule } = useModuleStore();

  const [activeTab, setActiveTab] = useState<'upload' | 'github'>('upload');

  // Option A - Upload ZIP state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [uploadReport, setUploadReport] = useState<ValidationResult | null>(null);

  // Option B - GitHub Import state
  const [githubUrl, setGithubUrl] = useState('');
  const [isProcessingGithub, setIsProcessingGithub] = useState(false);
  const [githubReport, setGithubReport] = useState<ValidationResult | null>(null);

  // Module Information Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('CRM');
  const [author, setAuthor] = useState('Developer Mode User');
  const [version, setVersion] = useState('1.0.0');
  const [selectedTechnologies, setSelectedTechnologies] = useState<string[]>(['React']);
  const [customTech, setCustomTech] = useState('');

  // Module Runtime Configuration State
  const [frontendCommand, setFrontendCommand] = useState('npm run dev');
  const [backendCommand, setBackendCommand] = useState('');
  const [frontendPort, setFrontendPort] = useState<number>(5173);
  const [backendPort, setBackendPort] = useState<number>(5000);
  const [frontendUrl, setFrontendUrl] = useState('http://localhost:5173');
  const [backendUrl, setBackendUrl] = useState('http://localhost:5000');
  const [workingDir, setWorkingDir] = useState('.');
  const [envVarsText, setEnvVarsText] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Pre-fill form when validation completes
  const applyExtractedMetadata = (report: ValidationResult, fallbackName: string, fallbackAuthor?: string) => {
    const meta = report.extractedMetadata;
    const initialName = meta?.name || report.repoInfo?.name || fallbackName;
    setName(initialName);

    const initialDesc = meta?.description || report.repoInfo?.description || '';
    setDescription(initialDesc);

    const initialCategory = meta?.category && CATEGORIES.includes(meta.category) ? meta.category : 'CRM';
    setCategory(initialCategory);

    const initialAuthor = meta?.author || report.repoInfo?.owner || fallbackAuthor || 'Developer Mode User';
    setAuthor(initialAuthor);

    const initialVersion = meta?.version || '1.0.0';
    setVersion(initialVersion);

    if (meta?.technologies && Array.isArray(meta.technologies)) {
      setSelectedTechnologies(meta.technologies);
    } else {
      setSelectedTechnologies(['React', 'Node.js']);
    }
  };

  // Handle File Selection & Immediate Validation
  const handleFileChange = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      alert('Only .zip files are supported.');
      return;
    }
    setSelectedFile(file);
    setUploadReport(null);
    setSubmitError(null);

    setIsProcessingUpload(true);
    try {
      const result = await validateModuleZip(file);
      setUploadReport(result);
      if (result.valid) {
        const fallbackName = file.name.replace(/\.zip$/i, '').replace(/[-_]/g, ' ');
        applyExtractedMetadata(result, fallbackName);
      }
    } catch (e: any) {
      setUploadReport({ valid: false, error: e.message || 'Invalid or corrupted ZIP file.' });
    } finally {
      setIsProcessingUpload(false);
    }
  };

  // Inspect & Validate GitHub Repo
  const handleValidateGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim()) return;
    setIsProcessingGithub(true);
    setGithubReport(null);
    setSubmitError(null);

    try {
      const result = await validateGithubRepo(githubUrl);
      setGithubReport(result);
      if (result.valid) {
        applyExtractedMetadata(result, result.repoInfo?.name || 'GitHub Module', result.repoInfo?.owner);
      }
    } catch (e: any) {
      setGithubReport({ valid: false, error: e.message || 'Failed to connect to GitHub repository.' });
    } finally {
      setIsProcessingGithub(false);
    }
  };

  // Toggle Technology Pill
  const toggleTechnology = (tech: string) => {
    if (selectedTechnologies.includes(tech)) {
      setSelectedTechnologies(selectedTechnologies.filter((t) => t !== tech));
    } else {
      setSelectedTechnologies([...selectedTechnologies, tech]);
    }
  };

  // Add Custom Tech Tag
  const handleAddCustomTech = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && customTech.trim()) {
      e.preventDefault();
      const val = customTech.trim();
      if (!selectedTechnologies.includes(val)) {
        setSelectedTechnologies([...selectedTechnologies, val]);
      }
      setCustomTech('');
    }
  };

  // Final Form Submission
  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeReport = activeTab === 'upload' ? uploadReport : githubReport;
    if (!activeReport || !activeReport.valid) {
      setSubmitError('Please upload a valid ZIP file or import a valid GitHub repository first.');
      return;
    }

    if (!name.trim()) {
      setSubmitError('Module name is required.');
      return;
    }

    setIsSaving(true);
    setSubmitError(null);

    const envVarsArray = envVarsText.split(',').map((s) => s.trim()).filter(Boolean);

    const payload = {
      name: name.trim(),
      description: description.trim(),
      category,
      author: author.trim() || 'Developer Mode User',
      version: version.trim() || '1.0.0',
      technologies: selectedTechnologies,
      sourceType: activeTab,
      storagePath: activeReport?.storagePath,
      githubUrl: activeReport?.repoInfo?.htmlUrl || (activeTab === 'github' ? githubUrl : undefined),
      githubOwner: activeReport?.repoInfo?.owner,
      githubRepo: activeReport?.repoInfo?.repo || activeReport?.repoInfo?.name,
      githubBranch: activeReport?.repoInfo?.defaultBranch || 'main',
      frontendCommand: frontendCommand.trim() || 'npm run dev',
      backendCommand: backendCommand.trim(),
      frontendPort: Number(frontendPort) || 5173,
      backendPort: Number(backendPort) || 5000,
      frontendUrl: frontendUrl.trim() || 'http://localhost:5173',
      backendUrl: backendUrl.trim() || 'http://localhost:5000',
      workingDir: workingDir.trim() || '.',
      envVars: envVarsArray,
    };

    const result = await createModule(payload);
    setIsSaving(false);

    if (result.success) {
      navigate('/modules');
    } else {
      setSubmitError(result.error || 'Failed to add module');
    }
  };

  const activeReport = activeTab === 'upload' ? uploadReport : githubReport;
  const isFormVisible = activeReport && activeReport.valid;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <Layers className="w-8 h-8 text-indigo-400" />
          <span>Publish Software Module</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Add ANY software repository or ZIP package to ModuleForge. No <code className="text-indigo-300 font-mono">module.json</code> required.
        </p>
      </div>

      {/* Option Selector Tabs */}
      <div className="grid grid-cols-2 gap-4 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
        <button
          onClick={() => {
            setActiveTab('upload');
            setSubmitError(null);
          }}
          className={`py-3 px-4 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2 ${
            activeTab === 'upload'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Option A: Upload ZIP Package</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('github');
            setSubmitError(null);
          }}
          className={`py-3 px-4 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2 ${
            activeTab === 'github'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Github className="w-4 h-4" />
          <span>Option B: Import GitHub Repository</span>
        </button>
      </div>

      {/* Security Banner */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3 text-xs text-slate-400">
        <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          <strong className="text-slate-200 font-semibold">Sandbox Execution Safety:</strong> Repositories are stored as raw package archives. Code build scripts are never executed on the ModuleForge server.
        </span>
      </div>

      {/* OPTION A: UPLOAD ZIP FILE */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files?.[0]) {
                handleFileChange(e.dataTransfer.files[0]);
              }
            }}
            className={`p-10 rounded-2xl border-2 border-dashed text-center transition-all ${
              isDragOver
                ? 'border-indigo-500 bg-indigo-500/10'
                : uploadReport?.valid
                ? 'border-emerald-500/50 bg-slate-900'
                : uploadReport && !uploadReport.valid
                ? 'border-rose-500/50 bg-rose-500/5'
                : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4 text-indigo-400">
              <FileArchive className="w-6 h-6" />
            </div>

            {selectedFile ? (
              <div className="space-y-2">
                <span className="font-bold text-white text-base block">{selectedFile.name}</span>
                <span className="text-xs text-slate-400 font-mono block">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </span>
                {isProcessingUpload && (
                  <p className="text-xs font-mono text-indigo-400 animate-pulse">Reading ZIP archive...</p>
                )}
                <div className="pt-2 flex justify-center gap-3">
                  <label className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer border border-slate-700">
                    Choose Another File
                    <input
                      type="file"
                      accept=".zip"
                      onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="font-bold text-white text-base">Drop ZIP package here</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Accepts any software ZIP archive. No configuration files required.
                </p>
                <div className="pt-2">
                  <label className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-indigo-600/20">
                    <Upload className="w-4 h-4" />
                    <span>Choose File</span>
                    <input
                      type="file"
                      accept=".zip"
                      onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {uploadReport && <ValidationReport report={uploadReport} sourceType="upload" />}
        </div>
      )}

      {/* OPTION B: GITHUB REPOSITORY IMPORT */}
      {activeTab === 'github' && (
        <div className="space-y-6">
          <form onSubmit={handleValidateGithub} className="p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 font-mono flex items-center gap-2">
                <Github className="w-4 h-4 text-purple-400" />
                <span>Public GitHub Repository URL</span>
              </label>
              <input
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/user/crm"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                Downloads repository archive from public branch.
              </span>
              <button
                type="submit"
                disabled={isProcessingGithub || !githubUrl.trim()}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
              >
                {isProcessingGithub ? (
                  'Retrieving Repository...'
                ) : (
                  <>
                    <span>Import Repository</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {githubReport && <ValidationReport report={githubReport} sourceType="github" />}
        </div>
      )}

      {/* MODULE INFORMATION FORM */}
      {isFormVisible && (
        <form onSubmit={handleAddModule} className="p-8 rounded-2xl bg-slate-900 border border-indigo-500/30 space-y-6 shadow-2xl animate-fade-in">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <span>Module Information</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Enter marketplace specifications for this module.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Module Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Module Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. CRM"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Author */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Author</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Developer"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Version */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Version</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Description <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Customer relationship management system."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 h-24"
              required
            />
          </div>

          {/* Technologies Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-400" />
              <span>Technologies</span>
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              {AVAILABLE_TECH.map((tech) => {
                const isSelected = selectedTechnologies.includes(tech);
                return (
                  <button
                    key={tech}
                    type="button"
                    onClick={() => toggleTechnology(tech)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    <span>{tech}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <input
                type="text"
                value={customTech}
                onChange={(e) => setCustomTech(e.target.value)}
                onKeyDown={handleAddCustomTech}
                placeholder="Press Enter to add custom technology (e.g. Express, Tailwind)..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* MODULE RUNTIME CONFIGURATION SECTION */}
          <div className="border-t border-slate-800 pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className="text-base font-bold text-white">Module Runtime Configuration</h3>
                <p className="text-xs text-slate-400">
                  Specify how this module is launched so ModuleForge and the Application Shell can launch its original interface without altering its code.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Frontend Start Command */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Frontend Start Command</label>
                <input
                  type="text"
                  value={frontendCommand}
                  onChange={(e) => setFrontendCommand(e.target.value)}
                  placeholder="npm run dev"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Backend Start Command */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Backend Start Command (Optional)</label>
                <input
                  type="text"
                  value={backendCommand}
                  onChange={(e) => setBackendCommand(e.target.value)}
                  placeholder="npm run server"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Frontend Port */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Frontend Port</label>
                <input
                  type="number"
                  value={frontendPort}
                  onChange={(e) => setFrontendPort(Number(e.target.value))}
                  placeholder="5173"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Backend Port */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Backend Port (Optional)</label>
                <input
                  type="number"
                  value={backendPort}
                  onChange={(e) => setBackendPort(Number(e.target.value))}
                  placeholder="5000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Frontend URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Frontend URL</label>
                <input
                  type="text"
                  value={frontendUrl}
                  onChange={(e) => setFrontendUrl(e.target.value)}
                  placeholder="http://localhost:5173"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Working Directory */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Working Directory</label>
                <input
                  type="text"
                  value={workingDir}
                  onChange={(e) => setWorkingDir(e.target.value)}
                  placeholder="."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Environment Variables */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-300">Environment Variable Names (Comma-separated)</label>
                <input
                  type="text"
                  value={envVarsText}
                  onChange={(e) => setEnvVarsText(e.target.value)}
                  placeholder="e.g. DATABASE_URL, JWT_SECRET, PORT"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {submitError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition"
            >
              {isSaving ? (
                'Adding Module...'
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add Module</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
