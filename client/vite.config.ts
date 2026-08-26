import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
}));
