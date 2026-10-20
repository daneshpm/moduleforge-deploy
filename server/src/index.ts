import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { modulesRouter } from './routes/modules';
import { projectsRouter } from './routes/projects';
import { categoriesRouter } from './routes/categories';
import { webhooksRouter } from './routes/webhooks';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { teamsRouter } from './routes/teams';
import { invitationsRouter } from './routes/invitations';
import { notificationsRouter } from './routes/notifications';
import { channelsRouter } from './routes/channels';
import { directChatsRouter } from './routes/directChats';
import { callsRouter } from './routes/calls';
import { meetingsRouter } from './routes/meetings';
import { presenceRouter } from './routes/presence';
import { authenticate, authenticateUnlessGet, logAuthStartupWarnings } from './middleware/auth';

dotenv.config();
logAuthStartupWarnings();

const app = express();
const PORT = process.env.PORT || 5000;
// Explicit opt-in only: an unset/unknown NODE_ENV must NOT enable dev routes or wildcard CORS.
const isDev = process.env.NODE_ENV === 'development';

// ── CORS ─────────────────────────────────────────────────────────────────────
// In production only the origins listed in ALLOWED_ORIGINS are allowed (no wildcard,
// no *.vercel.app). Requests with no Origin header (curl, same-origin, webhooks) pass.
// In development allow any origin so the Vite dev server can reach the API.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];
if (!isDev && allowedOrigins.length === 0) {
  console.warn('WARNING: ALLOWED_ORIGINS is not set (non-development); all cross-origin browser requests will be rejected.');
}

app.use(
  cors({
    origin: isDev
      ? true
      : (origin, callback) => {
          if (!origin) return callback(null, true);
          if (allowedOrigins.includes(origin)) return callback(null, true);
          callback(null, false);
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
// /api/auth/sync verifies the token itself (inside the route); google-dev is dev-only.
app.use('/api/auth', authRouter);
app.use('/api/users', authenticate, usersRouter);
app.use('/api/teams', authenticate, teamsRouter);
// GET /api/invitations/:token stays public (the token is the secret); accept/decline are protected in the router.
app.use('/api/invitations', invitationsRouter);
app.use('/api/notifications', authenticate, notificationsRouter);
// Marketplace reads (GET) are public; every write requires authentication.
app.use('/api/modules', authenticateUnlessGet, modulesRouter);
app.use('/api/projects', authenticate, projectsRouter);
app.use('/api/presence', authenticate, presenceRouter);
// Chat / DM / calls / meetings: each router applies authenticate itself (router.use) and enforces per-resource access.
// The client calls direct chats under /api/chats.
app.use('/api/channels', channelsRouter);
app.use('/api/chats', directChatsRouter);
app.use('/api/calls', callsRouter);
app.use('/api/meetings', meetingsRouter);
// GitHub webhook: no user auth; protected by mandatory HMAC signature (GITHUB_WEBHOOK_SECRET)
app.use('/api/webhooks', webhooksRouter);

// ── GitHub Helper Routes ──────────────────────────────────────────────────────
app.post('/api/github/connect', authenticate, async (req, res) => {
  try {
    const { token } = req.body;
    const testToken = token || process.env.GITHUB_TOKEN;
    if (!testToken) {
      return res.status(400).json({ success: false, error: 'GitHub token is required' });
    }
    const axios = require('axios');
    const userRes = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${testToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ModuleForge-Platform',
      },
      timeout: 8000,
    });
    res.json({
      success: true,
      user: {
        login: userRes.data.login,
        name: userRes.data.name,
        avatarUrl: userRes.data.avatar_url,
        publicRepos: userRes.data.public_repos,
      },
    });
  } catch (e: any) {
    res.status(401).json({
      success: false,
      error: e.response?.data?.message || e.message || 'GitHub connection failed',
    });
  }
});

app.get('/api/github/repositories', authenticate, async (req, res) => {
  try {
    const token = (req.headers['x-github-token'] || req.query.token) as string | undefined;
    const { projectRepoService } = require('./services/projectRepoService');
    const repos = await projectRepoService.listUserRepositories(token);
    res.json({ success: true, repositories: repos });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Local-only routes (not supported on Vercel serverless) ────────────────────
// These features require a persistent filesystem and long-running processes,
// neither of which are available in a serverless environment.
if (isDev) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runnerRouter } = require('./routes/runner');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const gitRouter = require('./routes/git').default;
  app.use('/api/runner', authenticate, runnerRouter);
  app.use('/api/git', authenticate, gitRouter);
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
