export interface ModuleRuntimeSpec {
  name: string;
  slug: string;
  folderName: string;
  frontendPort: number;
  backendPort: number;
  frontendCommand: string;
  backendCommand: string;
  category: string;
  description: string;
}

/**
 * Generates the files for a Master Unified Frontend Shell (Vite + React + Tailwind)
 * that merges multiple disparate module frontends into a single cohesive portal.
 */
export function generateUnifiedFrontendFiles(
  project: { name: string; description?: string | null },
  runtimeSpecs: ModuleRuntimeSpec[]
): Record<string, string> {
  const files: Record<string, string> = {};

  // 1. package.json for Unified Frontend
  files['frontend/package.json'] = JSON.stringify(
    {
      name: `${project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-unified-shell`,
      private: true,
      version: '1.0.0',
      type: 'module',
      scripts: {
        dev: 'vite --host 0.0.0.0 --port 4000',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        clsx: '^2.1.0',
        'lucide-react': '^0.359.0',
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        'react-router-dom': '^6.22.3',
        'tailwind-merge': '^2.2.2',
      },
      devDependencies: {
        '@types/react': '^18.2.66',
        '@types/react-dom': '^18.2.22',
        '@vitejs/plugin-react': '^4.2.1',
        autoprefixer: '^10.4.19',
        postcss: '^8.4.38',
        tailwindcss: '^3.4.1',
        typescript: '^5.4.3',
        vite: '^5.1.6',
      },
    },
    null,
    2
  );

  // 2. vite.config.ts with automatic reverse proxy routing to all modules
  const proxyEntries = runtimeSpecs
    .map(
      (m) => `      '/api/${m.slug}': {
        target: 'http://localhost:${m.backendPort}',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\\/api\\/${m.slug}/, '')
      },`
    )
    .join('\n');

  files['frontend/vite.config.ts'] = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4000,
    host: '0.0.0.0',
    proxy: {
${proxyEntries}
    }
  }
});
`;

  // 3. index.html
  files['frontend/index.html'] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${project.name} - Unified Platform</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  </head>
  <body class="bg-[#F7F8F7] text-[#202524] antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

  // 4. tailwind.config.js
  files['frontend/tailwind.config.js'] = `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1F5E4B',
          hover: '#174739',
          50: '#EAF3EF',
          100: '#D1E6DC',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
`;

  // 5. postcss.config.js
  files['frontend/postcss.config.js'] = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

  // 6. src/index.css
  files['frontend/src/index.css'] = `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', sans-serif;
  background-color: #F7F8F7;
  color: #202524;
}
`;

  // 7. src/main.tsx
  files['frontend/src/main.tsx'] = `import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
`;

  // 8. src/App.tsx - The Core Unified Shell & Router
  const moduleRoutes = runtimeSpecs
    .map(
      (m) => `        <Route
          path="/modules/${m.slug}"
          element={
            <ModuleView
              name="${m.name}"
              slug="${m.slug}"
              port={${m.frontendPort}}
              category="${m.category}"
              description="${m.description.replace(/"/g, '\\"')}"
            />
          }
        />`
    )
    .join('\n');

  const sidebarLinks = runtimeSpecs
    .map(
      (m) => `          <NavLink
            key="${m.slug}"
            to="/modules/${m.slug}"
            className={({ isActive }) =>
              \`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition \${
                isActive
                  ? 'bg-[#1F5E4B] text-white shadow-sm'
                  : 'text-[#6B7471] hover:text-[#202524] hover:bg-[#EAF3EF]'
              }\`
            }
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span className="truncate">${m.name}</span>
            <span className="ml-auto text-[10px] font-mono opacity-70">:${m.frontendPort}</span>
          </NavLink>`
    )
    .join('\n');

  files['frontend/src/App.tsx'] = `import React from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  Layers,
  LayoutDashboard,
  ExternalLink,
  RotateCcw,
  Activity,
  Boxes
} from 'lucide-react';
import { DashboardPage } from './pages/DashboardPage';
import { ModuleView } from './components/ModuleView';

export default function App() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-[#F7F8F7] text-[#202524] overflow-hidden">
      {/* Unified Sidebar */}
      <aside className="w-64 bg-white border-r border-[#E2E6E4] flex flex-col justify-between shrink-0">
        <div>
          {/* Brand Header */}
          <div className="p-5 border-b border-[#E2E6E4] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1F5E4B] text-white flex items-center justify-center font-bold text-base shadow-sm">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-[#202524] leading-tight">${project.name}</h1>
              <span className="text-[10px] font-mono text-[#2E7D5B] font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D5B] animate-pulse" />
                Unified Shell
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <NavLink
              to="/"
              className={({ isActive }) =>
                \`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition \${
                  isActive
                    ? 'bg-[#1F5E4B] text-white shadow-sm'
                    : 'text-[#6B7471] hover:text-[#202524] hover:bg-[#EAF3EF]'
                }\`
              }
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Unified Overview</span>
            </NavLink>

            <div className="pt-4 pb-1 px-3.5 text-[10px] font-mono font-bold uppercase text-[#6B7471] tracking-wider">
              Integrated Modules (${runtimeSpecs.length})
            </div>

${sidebarLinks}
          </nav>
        </div>

        {/* Footer Info */}
        <div className="p-4 border-t border-[#E2E6E4] bg-[#FAFBFA] space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#6B7471]">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#2E7D5B]" />
              <span>All Services Active</span>
            </span>
            <span className="font-bold text-[#1F5E4B]">:${4000}</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
${moduleRoutes}
        </Routes>
      </main>
    </div>
  );
}
`;

  // 9. src/components/ModuleView.tsx - Micro-frontend Iframe/Proxy view
  files['frontend/src/components/ModuleView.tsx'] = `import React, { useState, useRef } from 'react';
import { RotateCcw, ExternalLink } from 'lucide-react';

interface ModuleViewProps {
  name: string;
  slug: string;
  port: number;
  category: string;
  description: string;
}

export const ModuleView: React.FC<ModuleViewProps> = ({
  name,
  slug,
  port,
  category,
  description
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const moduleUrl = \`http://localhost:\${port}\`;

  const handleReload = () => {
    setIsLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = moduleUrl;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F8F7] overflow-hidden">
      {/* Module Top Bar */}
      <div className="h-14 bg-white border-b border-[#E2E6E4] px-6 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-[#202524]">{name}</h2>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#EAF3EF] text-[#1F5E4B] font-bold border border-[#1F5E4B]/20">
            {category}
          </span>
          <span className="text-[11px] font-mono text-[#6B7471] hidden sm:inline">
            :{port}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReload}
            className="p-1.5 rounded-lg bg-[#F7F8F7] hover:bg-[#EAF3EF] text-[#6B7471] hover:text-[#1F5E4B] border border-[#E2E6E4] transition"
            title="Reload Module View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <a
            href={moduleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-[#1F5E4B] hover:bg-[#174739] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
          >
            <span>Open Tab</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Embedded Iframe Container */}
      <div className="flex-1 relative w-full h-full bg-white">
        {isLoading && (
          <div className="absolute inset-0 bg-[#F7F8F7] flex flex-col items-center justify-center space-y-2 z-10">
            <div className="w-6 h-6 border-2 border-[#1F5E4B] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-[#6B7471]">Mounting micro-frontend on port {port}...</span>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={moduleUrl}
          onLoad={() => setIsLoading(false)}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; camera; clipboard-read; clipboard-write; display-capture; encrypted-media; fullscreen; geolocation; gyroscope; magnetometer; microphone; midi; payment; picture-in-picture; screen-wake-lock; web-share"
          allowFullScreen
        />
      </div>
    </div>
  );
};
`;

  // 10. src/pages/DashboardPage.tsx
  const moduleCards = runtimeSpecs
    .map(
      (m) => `        <div
          key="${m.slug}"
          onClick={() => navigate('/modules/${m.slug}')}
          className="p-6 rounded-2xl bg-white border border-[#E2E6E4] hover:border-[#1F5E4B] transition cursor-pointer shadow-sm hover:shadow-md space-y-4 group"
        >
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EAF3EF] text-[#1F5E4B] border border-[#1F5E4B]/20">
              ${m.category}
            </span>
            <span className="font-mono text-xs text-[#2E7D5B] font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#2E7D5B] animate-pulse" />
              Active :${m.frontendPort}
            </span>
          </div>

          <div>
            <h3 className="text-base font-bold text-[#202524] group-hover:text-[#1F5E4B] transition">
              ${m.name}
            </h3>
            <p className="text-xs text-[#6B7471] line-clamp-2 mt-1 leading-relaxed">
              ${m.description.replace(/"/g, '\\"')}
            </p>
          </div>

          <div className="pt-3 border-t border-[#E2E6E4] flex items-center justify-between text-xs font-mono text-[#6B7471]">
            <span>Launch: \`${m.frontendCommand.replace(/`/g, '')}\`</span>
            <span className="text-[#1F5E4B] font-bold">Open View →</span>
          </div>
        </div>`
    )
    .join('\n');

  files['frontend/src/pages/DashboardPage.tsx'] = `import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8">
      {/* Hero Welcome Banner */}
      <div className="p-8 rounded-3xl bg-white border border-[#E2E6E4] shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#EAF3EF] text-[#1F5E4B] flex items-center justify-center border border-[#1F5E4B]/20">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#202524]">${project.name}</h1>
            <p className="text-xs text-[#6B7471]">
              Unified Application Shell combining ${runtimeSpecs.length} modular services under a single dashboard
            </p>
          </div>
        </div>
      </div>

      {/* Integrated Modules Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold font-mono text-[#6B7471] uppercase tracking-wider">
          Integrated Micro-Frontends (${runtimeSpecs.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
${moduleCards}
        </div>
      </div>
    </div>
  );
};
`;

  return files;
}
