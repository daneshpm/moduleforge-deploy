# ModuleForge — Master Prompt

Use this prompt to give any AI assistant (Kiro, ChatGPT, Claude, etc.) full context about the project before asking it to build, fix, or extend anything.

---

## PASTE THIS INTO ANY AI CHAT

```
You are working on ModuleForge — a full-stack platform for composing reusable software modules into team projects, with GitHub-driven live sync and a visual canvas builder.

---

## TECH STACK

- Frontend: React 18 + TypeScript, Vite, Tailwind CSS, React Router v6, Zustand, React Flow (@xyflow/react), Supabase JS
- Backend: Node.js + TypeScript, Express 4, Prisma 5 ORM
- Database: Neon PostgreSQL (production) / SQLite (local dev)
- Real-time: Server-Sent Events (SSE)
- Auth: Supabase Auth (localStorage fallback in dev)
- Deployment: Vercel (frontend = static SPA, backend = serverless function via api/index.ts)
- Git operations: Node.js child_process (execFile) wrapping git CLI

---

## PROJECT STRUCTURE

rooman-module-project/
├── api/index.ts              ← Vercel serverless entry (re-exports Express app)
├── client/src/
│   ├── pages/                ← Route-level pages
│   ├── components/           ← Reusable UI components  
│   ├── store/                ← Zustand stores (useAuthStore, useModuleStore, useProjectStore, useGitStore)
│   ├── types/index.ts        ← All TypeScript interfaces
│   └── App.tsx               ← React Router + RequireAuth guard
├── server/src/
│   ├── routes/               ← Express route handlers (modules, projects, git, webhooks, runner, categories)
│   ├── services/             ← Business logic (gitService, githubWebhookService, realtimeEvents, deploymentProvider, localModuleRunner, emailService)
│   ├── index.ts              ← Express app (exported as default for serverless)
│   └── prisma.ts             ← Prisma client singleton
├── server/prisma/schema.prisma ← 13 database models
├── vercel.json               ← Vercel routing config
└── server/.env               ← Local secrets (not committed)

---

## KEY CONCEPTS

### Module
A publishable unit of software. Can be:
- `upload`: A ZIP file uploaded directly
- `github`: Imported from a GitHub repo (auto-syncs via push webhooks)
- `moduleforge`: A local git repo hosted inside ModuleForge

Fields include: name, slug, version, author, category, technologies (JSON array),
sourceType, githubOwner, githubRepo, githubBranch, githubCurrentCommit,
githubSyncStatus, githubWebhookId, frontendCommand, backendCommand,
frontendPort, backendPort, zipStoragePath

### Project
A composition of modules built by a user or team. 
- Has a React Flow canvas with drag-and-drop modules (stored as JSON in canvasConfig)
- Can be individual or team
- Can be linked to a GitHub monorepo

### ProjectModule
A module instance inside a project. Tracks:
- Canvas position (xPosition, yPosition)
- Assigned developer (ownerName, ownerEmail)
- Git state (currentBranch, gitStatus, currentCommitSha)
- Deployment state (deploymentStatus, deploymentUrl)
- Deployment history (ModuleDeployment records)

### Real-Time Flow
1. GitHub push → POST /api/webhooks/github
2. HMAC signature verified
3. Module ZIP downloaded from GitHub
4. Database updated (commit SHA, sync status)
5. realtimeEventManager.broadcastToProject() sends SSE event
6. All team members' browsers update instantly via EventSource

### GitHub Webhook Service
- `registerWebhook(moduleId)` → calls GitHub API to create webhook
- `deleteWebhook(moduleId)` → removes webhook from GitHub
- `getWebhookStatus(moduleId)` → cross-checks DB + live GitHub API
- Requires: GITHUB_TOKEN (PAT with repo scope), WEBHOOK_PUBLIC_URL

### Auth Flow
- Production: Supabase Auth (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
- Dev fallback: localStorage (any email/password works)
- RequireAuth component in App.tsx guards all protected routes
- Unauthenticated users → redirected to /login

---

## ALL API ENDPOINTS

### Modules (/api/modules)
GET    /                         → browse marketplace (filter: category, search, sort)
GET    /:idOrSlug                → module details
POST   /                         → create module
DELETE /:id                      → delete module
POST   /upload                   → upload & validate ZIP
POST   /github                   → import GitHub repo
GET    /:id/download             → download ZIP
POST   /:id/check-sync           → check GitHub for new commits
POST   /:id/sync                 → manual sync from GitHub
GET    /:id/sync-history         → sync log
PUT    /:id/runtime-config       → update run commands/ports
GET    /:id/webhook-status       → GitHub webhook registration status
POST   /:id/register-webhook     → register GitHub push webhook
DELETE /:id/webhook              → remove GitHub push webhook

### Projects (/api/projects)
GET    /                         → list projects
POST   /                         → create project
GET    /:id                      → project details
PUT    /:id                      → update project
DELETE /:id                      → delete project
GET    /:id/events               → SSE stream (real-time updates)
POST   /:id/modules              → add module to project
PUT    /:id/modules/:pmId        → update project module
DELETE /:id/modules/:pmId        → remove module from project
POST   /:id/modules/:pmId/sync   → sync project module
POST   /:id/modules/:pmId/rollback → rollback deployment
POST   /:id/modules/:pmId/redeploy → redeploy
GET    /:id/activity             → activity log
POST   /:id/invite               → invite team member
GET    /:id/members              → list team members
DELETE /:id/members/:memberId    → remove member
POST   /accept-invite            → accept invite token
POST   /:id/connect-github       → link monorepo
POST   /:id/export               → export project ZIP

### Git Workspace (/api/git/projects/:projectId/modules/:pmId)
GET    /status                   → git status + repo metadata
POST   /commit                   → stage all + commit
POST   /push                     → push to remote
POST   /pull                     → pull from remote
GET    /branches                 → list branches
POST   /branches                 → create branch
POST   /checkout                 → switch branch
GET    /history                  → commit history
GET    /files                    → file tree
GET    /file                     → read file (?path=)
POST   /file                     → write file

### Webhooks
POST   /api/webhooks/github      → receive GitHub push event
POST   /api/github/webhook       → alias

### Runner (local dev)
POST   /api/runner/start         → start module process
POST   /api/runner/stop          → stop module process
GET    /api/runner/status/:id    → process status
GET    /api/runner/logs/:id      → stream process logs

---

## FRONTEND ROUTES

/                → LandingPage (public)
/login           → LoginPage (public)
/dashboard       → DashboardPage (protected)
/modules         → MarketplacePage (protected)
/modules/create  → CreateModulePage (protected)
/modules/:id     → ModuleDetailsPage (protected)
/my-modules      → MyModulesPage (protected)
/projects        → MyProjectsPage (protected)
/builder/:id     → VisualBuilderPage (protected, fullscreen)
/projects/:projectId/modules/:pmId/workspace → ModuleWorkspacePage (protected, fullscreen)
/settings        → SettingsPage (protected)
/invites/:token  → AcceptInvitePage (public)

---

## DATA MODELS (abbreviated)

Module: id, slug, name, description, author, categoryName, version, technologies,
  sourceType, githubOwner, githubRepo, githubBranch, githubCurrentCommit,
  githubSyncStatus, githubWebhookId, frontendCommand, backendCommand,
  frontendPort, backendPort, zipStoragePath, downloads, isPublished

Project: id, name, description, userId, projectType, visibility, canvasConfig,
  gitOwner, gitRepo, syncStatus

ProjectModule: id, projectId, moduleId, xPosition, yPosition, ownerName,
  ownerEmail, currentBranch, currentCommitSha, deploymentStatus, deploymentUrl

ModuleSync: id, moduleId, commitSha, commitMessage, author, status, syncedAt

ProjectActivity: id, projectId, moduleName, action, actorName, description, commitSha, status

ProjectMember: id, projectId, email, role (owner/developer/viewer), status, inviteToken

---

## ENVIRONMENT VARIABLES

Server (.env):
  DATABASE_URL              PostgreSQL connection string
  NODE_ENV                  development | production
  ALLOWED_ORIGINS           comma-separated frontend origins (prod)
  GITHUB_TOKEN              GitHub PAT (repo scope)
  WEBHOOK_PUBLIC_URL        public HTTPS URL of server
  GITHUB_WEBHOOK_SECRET     HMAC secret for webhook verification
  SMTP_HOST/USER/PASS       email sending (optional)

Client (.env):
  VITE_SUPABASE_URL         Supabase project URL
  VITE_SUPABASE_ANON_KEY    Supabase anon key
  VITE_API_URL              API base URL (leave blank = same origin)

---

## CODING CONVENTIONS

- All server files are TypeScript with `strict: true`
- Prisma client is a singleton from `server/src/prisma.ts`
- API routes use async/await with try/catch returning `res.status(N).json({error})`
- All module objects go through `formatModuleOutput()` before being returned (parses technologies JSON)
- Client stores use Zustand with no devtools in production
- All API calls use `fetch` (stores) or `axios` (git store)
- API base is `/api` (same-origin, Vercel rewrites handle routing)
- Tailwind classes only — no CSS modules or styled-components
- Color system: `slate-950` background, `indigo-600` primary, `emerald` success, `rose` error, `amber` warning

---

## DEPLOYMENT

- Platform: Vercel
- vercel.json routes /api/* → api/index.ts (serverless), /* → client/dist/index.html
- Build command: `npm run build:vercel` (builds client only)
- Database: Neon PostgreSQL at ep-wandering-hill-aymk4oaj.c-5.us-east-2.aws.neon.tech
- Active branch: feature/github-webhooks-vercel-deploy on daneshpm/rooman-module-project

---

Now help me with the following:
[DESCRIBE YOUR TASK HERE]
```

---

## Quick Reference Cards

### Add a new API endpoint
1. Add the route handler in the appropriate file under `server/src/routes/`
2. Use the pattern:
```typescript
router.get('/path', async (req, res) => {
  try {
    const result = await prisma.model.findMany({ ... });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```
3. Add the corresponding store action in `client/src/store/use*Store.ts`
4. Update `DOCUMENTATION.md` API Reference section

### Add a new page
1. Create `client/src/pages/NewPage.tsx`
2. Add the route in `client/src/App.tsx` inside the appropriate layout block
3. If protected, wrap in `<RequireAuth>` or place inside the protected dashboard layout
4. Add a sidebar link in `client/src/components/Sidebar.tsx`

### Add a new data model
1. Add the model to `server/prisma/schema.prisma`
2. Run `npm run db:push`
3. Run `npm run db:generate`
4. Add the TypeScript interface to `client/src/types/index.ts`

### Broadcast a real-time event
```typescript
import { realtimeEventManager } from '../services/realtimeEvents';

realtimeEventManager.broadcastToProject(projectId, {
  type: 'MODULE_UPDATED',
  moduleId: '...',
  moduleName: '...',
  message: '...',
  status: 'synced',
});
```

### Register a GitHub webhook (programmatic)
```typescript
import { registerWebhook } from '../services/githubWebhookService';
const result = await registerWebhook(moduleId);
// result: { success, webhookId, webhookUrl, alreadyRegistered }
```
