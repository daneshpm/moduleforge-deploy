import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { modulesRouter } from './routes/modules';
import { projectsRouter } from './routes/projects';
import { categoriesRouter } from './routes/categories';
import { webhooksRouter } from './routes/webhooks';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const isDev = process.env.NODE_ENV !== 'production';

// ── CORS ─────────────────────────────────────────────────────────────────────
// In production only allow the configured frontend origin.
// In development allow any origin so the Vite dev server can reach the API.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: isDev
      ? true // allow all in dev
      : (origin, callback) => {
          // allow requests with no origin (curl, Vercel internal, webhooks)
          if (!origin) return callback(null, true);
          if (allowedOrigins.includes(origin)) return callback(null, true);
          callback(new Error(`CORS: origin "${origin}" not allowed`));
        },
    credentials: true,
  })
);

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(
  express.json({
    limit: '50mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf; // needed for GitHub webhook HMAC verification
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Static uploads ────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsDir));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'ModuleForge API Server',
    version: '1.0.0',
    env: process.env.NODE_ENV || 'development',
  });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/modules', modulesRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/github/webhook', webhooksRouter);

// ── Local-only routes (not supported on Vercel serverless) ────────────────────
// These features require a persistent filesystem and long-running processes,
// neither of which are available in a serverless environment.
if (isDev) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runnerRouter } = require('./routes/runner');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const gitRouter = require('./routes/git').default;
  app.use('/api/runner', runnerRouter);
  app.use('/api/git', gitRouter);
} else {
  app.use('/api/runner', (_req: any, res: any) => {
    res.status(503).json({
      error: 'Not available in production',
      message: 'The module runner requires a local server. Run the app locally to use this feature.',
    });
  });
  app.use('/api/git', (_req: any, res: any) => {
    res.status(503).json({
      error: 'Not available in production',
      message: 'Local git operations require a persistent filesystem. Run the app locally to use this feature.',
    });
  });
}

// ── 404 fallback for unknown API routes ──────────────────────────────────────
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// ── Start server (not used when exported as a serverless function) ────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 ModuleForge server running on http://localhost:${PORT}`);
  });
}

export default app;
