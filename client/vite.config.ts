import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
const FIREBASE_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

export default defineConfig(({ mode, command }) => {
  // Build-time warning: src/firebase.ts falls back to hardcoded config (project "modulefodge")
  // for any VITE_FIREBASE_* var that is not set. Vite only exposes VITE_-prefixed vars to the client.
  if (command === 'build') {
    const env = loadEnv(mode, __dirname, 'VITE_');
    const missing = FIREBASE_VARS.filter((k) => !env[k] && !process.env[k]);
    if (missing.length > 0) {
      console.warn(
        `\n[vite] WARNING: ${missing.join(', ')} not set; the client will use the hardcoded fallback Firebase config (project "modulefodge"). ` +
          'Set VITE_FIREBASE_* in Vercel (they must be VITE_-prefixed to reach the browser).\n'
      );
    }
  }
  return {
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Dev server: proxy /api to the local Express server
  server: {
    port: 5173,
    proxy:
      mode === 'development'
        ? {
            '/api': {
              target: 'http://localhost:5000',
              changeOrigin: true,
              secure: false,
            },
          }
        : undefined,
  },
  // Production build: /api calls go to the same origin (Vercel rewrites handle routing)
  // If deploying frontend and backend on different origins, set VITE_API_URL in .env.production
  define:
    mode === 'production'
      ? {
          // Makes import.meta.env.VITE_API_URL available at build time
          // Falls back to '' (same origin) when not set
          'import.meta.env.VITE_API_URL': JSON.stringify(
            process.env.VITE_API_URL ?? ''
          ),
        }
      : {},
  };
});
