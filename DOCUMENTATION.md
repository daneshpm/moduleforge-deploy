# ModuleForge — Complete Project Documentation

> **Platform for composing, managing, and deploying reusable software modules into full-stack projects.**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Data Models](#5-data-models)
6. [API Reference](#6-api-reference)
7. [Frontend Pages & Routes](#7-frontend-pages--routes)
8. [Frontend Components](#8-frontend-components)
9. [State Management (Stores)](#9-state-management-stores)
10. [Services](#10-services)
11. [Real-Time Events (SSE)](#11-real-time-events-sse)
12. [GitHub Webhook Integration](#12-github-webhook-integration)
13. [Authentication](#13-authentication)
14. [Environment Variables](#14-environment-variables)
15. [Local Development Setup](#15-local-development-setup)
16. [Vercel Deployment](#16-vercel-deployment)
17. [Database (Neon PostgreSQL)](#17-database-neon-postgresql)

---

## 1. Project Overview

ModuleForge is a full-stack web platform that lets development teams:

- **Publish modules** — upload ZIP packages or import directly from GitHub repositories
- **Compose projects** — drag-and-drop modules onto a visual canvas builder (powered by React Flow)
- **Collaborate in teams** — invite members, assign module ownership, view live activity feeds
- **Sync in real-time** — GitHub push webhooks trigger automatic module updates broadcast via SSE to all connected team members
- **Manage code** — full git workspace with commit, push, pull, branch, and file editor per module
- **Export projects** — generate a deployable ZIP archive of the entire composed project

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (React)                        │
│  Vite + React 18 + TypeScript + Tailwind + Zustand          │
│  React Router v6  │  React Flow (canvas)  │  Supabase Auth  │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP /api/*  +  SSE /events
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     Server (Express)                         │
│  Node.js + TypeScript + Express + Prisma ORM                │
│  Routes: modules, projects, categories, webhooks, git,       │
│          runner                                              │
│  Services: gitService, githubWebhookService,                 │
│            realtimeEvents, deploymentProvider,               │
│            localModuleRunner, emailService                   │
└────────────────────────────┬────────────────────────────────┘
                             │ Prisma ORM
                             ▼
┌─────────────────────────────────────────────────────────────┐
│               Database (Neon PostgreSQL)                     │
│  13 tables: Module, Project, ProjectModule, User, ...       │
└─────────────────────────────────────────────────────────────┘
                             ▲
                             │ POST push event
┌─────────────────────────────────────────────────────────────┐
│                       GitHub                                 │
│  Repository webhooks → POST /api/webhooks/github            │
└─────────────────────────────────────────────────────────────┘
```

**Vercel Deployment:**
- Frontend (React SPA) → served as static files from `client/dist/`
- Backend (Express) → runs as a Vercel Serverless Function via `api/index.ts`
- All `/api/*` requests are rewritten to the serverless function by `vercel.json`
- All other routes serve `index.html` (SPA client-side routing)

---

## 3. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| State management | Zustand |
| Canvas / Visual builder | @xyflow/react (React Flow) |
| Authentication | Supabase Auth (with localStorage fallback) |
| HTTP client (client) | Fetch API + Axios |
| Backend framework | Express 4 |
| ORM | Prisma 5 |
| Database | Neon PostgreSQL (production) / SQLite (local dev) |
| Real-time | Server-Sent Events (SSE) |
| File handling | Multer + JSZip |
| Git operations | Node.js child_process (execFile) |
| Email | Nodemailer (Gmail / Ethereal fallback) |
| Deployment | Vercel (frontend + serverless API) |

---

## 4. Project Structure

```
rooman-module-project/
├── api/
│   └── index.ts              # Vercel serverless entry — re-exports Express app
├── client/                   # React frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Route-level page components
│   │   ├── store/            # Zustand state stores
│   │   ├── types/            # TypeScript type definitions
│   │   ├── App.tsx           # Router + layout + auth guards
│   │   ├── main.tsx          # React entry point
│   │   └── index.css         # Global styles
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                   # Express backend
│   ├── prisma/
│   │   └── schema.prisma     # Database schema (13 models)
│   ├── src/
│   │   ├── routes/           # Express route handlers
│   │   │   ├── categories.ts
│   │   │   ├── git.ts
│   │   │   ├── modules.ts
│   │   │   ├── projects.ts
│   │   │   ├── runner.ts
│   │   │   └── webhooks.ts
│   │   ├── services/         # Business logic
│   │   │   ├── deploymentProvider.ts
│   │   │   ├── emailService.ts
│   │   │   ├── githubWebhookService.ts
│   │   │   ├── gitService.ts
│   │   │   ├── localModuleRunner.ts
│   │   │   └── realtimeEvents.ts
│   │   ├── index.ts          # Express app + server entry
│   │   ├── prisma.ts         # Prisma client singleton
│   │   ├── validator.ts      # ZIP validation
│   │   └── seed.ts           # DB seeding (dev only)
│   ├── uploads/              # Uploaded ZIPs + local git repos
│   ├── .env                  # Local secrets (git-ignored)
│   ├── .env.example          # Template for all env vars
│   └── package.json
├── .gitignore
├── package.json              # Root monorepo scripts
├── tsconfig.json             # Root TypeScript config for api/
├── vercel.json               # Vercel deployment config
└── DOCUMENTATION.md
```

---

## 5. Data Models

### Module
Core publishable unit. Can be a ZIP upload, a GitHub repo import, or a ModuleForge-hosted git repo.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| slug | String (unique) | URL-friendly identifier |
| name | String | Display name |
| description | String | Module description |
| author | String | Author name |
| categoryName | String | FK to Category |
| version | String | Semver version string |
| technologies | String | JSON array of tech tags |
| sourceType | String | `upload` \| `github` \| `moduleforge` |
| repositoryType | String | `upload` \| `github` \| `moduleforge` |
| githubOwner | String? | GitHub org/user |
| githubRepo | String? | GitHub repo name |
| githubBranch | String? | Tracked branch (default: `main`) |
| githubCurrentCommit | String? | Last synced commit SHA |
| githubLatestCommit | String? | Latest known commit SHA |
| githubSyncStatus | String? | `synced` \| `update_available` \| `sync_failed` \| `not_connected` |
| githubWebhookId | String? | GitHub webhook ID (set after registration) |
| frontendCommand | String? | e.g. `npm run dev` |
| backendCommand | String? | e.g. `node server.js` |
| frontendPort | Int? | Default 5173 |
| backendPort | Int? | Default 5000 |
| zipStoragePath | String? | Absolute path to stored ZIP |
| downloads | Int | Download count |
| isPublished | Boolean | Visible in marketplace |

### Project
A composition of modules built by a user/team.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| name | String | Project name |
| projectType | String | `individual` \| `team` |
| visibility | String | `private` \| `public` |
| canvasConfig | String? | JSON: React Flow canvas state |
| gitOwner | String? | Monorepo GitHub owner |
| gitRepo | String? | Monorepo GitHub repo |
| syncStatus | String? | `synced` \| `updating` \| `failed` |

### ProjectModule
A module instance inside a project (with position, git state, deployment status).

| Field | Type | Description |
|-------|------|-------------|
| xPosition / yPosition | Float | Canvas node position |
| ownerName / ownerEmail | String? | Assigned developer |
| currentCommitSha | String? | Deployed commit |
| deploymentStatus | String? | `synced` \| `updating` \| `failed` |
| githubRepository | String? | e.g. `company/crm` |

### Other Models
- **ModuleSync** — sync history log per module (commit SHA, message, author, timestamp)
- **ModuleVersion** — versioned ZIP snapshots per module
- **ModuleDeployment** — deployment history per ProjectModule (build logs, URL, status)
- **ModuleCommit** — commit records per ProjectModule
- **ProjectMember** — team member with role and invite token
- **ProjectActivity** — audit log of all project events
- **GeneratedExport** — record of exported project ZIPs
- **User** — platform user (linked to Supabase auth)
- **Category** — module category taxonomy

---

## 6. API Reference

Base URL: `/api`

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server health check |

### Categories
| Method | Path | Description |
|--------|------|-------------|
| GET | `/categories` | List all categories |

### Modules
| Method | Path | Description |
|--------|------|-------------|
| GET | `/modules` | Browse modules (filter: `category`, `search`, `sort`) |
| GET | `/modules/:idOrSlug` | Get module details |
| POST | `/modules` | Create & publish a module |
| DELETE | `/modules/:id` | Delete a module |
| POST | `/modules/upload` | Upload & validate a ZIP file |
| POST | `/modules/github` | Import & download a GitHub repo |
| GET | `/modules/:id/download` | Download module ZIP |
| POST | `/modules/:id/check-sync` | Check GitHub for new commits |
| POST | `/modules/:id/sync` | Manually sync from GitHub |
| GET | `/modules/:id/sync-history` | Get sync history logs |
| PUT | `/modules/:id/runtime-config` | Update runtime configuration |
| GET | `/modules/:id/webhook-status` | Check GitHub webhook registration |
| POST | `/modules/:id/register-webhook` | Register GitHub push webhook |
| DELETE | `/modules/:id/webhook` | Remove GitHub push webhook |

### Projects
| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects` | List all projects |
| POST | `/projects` | Create a project |
| GET | `/projects/:id` | Get project details |
| PUT | `/projects/:id` | Update project (name, desc, canvas) |
| DELETE | `/projects/:id` | Delete a project |
| GET | `/projects/:id/events` | SSE stream for real-time updates |
| POST | `/projects/:id/modules` | Add a module to project |
| PUT | `/projects/:id/modules/:pmId` | Update module in project |
| DELETE | `/projects/:id/modules/:pmId` | Remove module from project |
| POST | `/projects/:id/modules/:pmId/sync` | Sync a specific project module |
| POST | `/projects/:id/modules/:pmId/rollback` | Rollback to a previous deployment |
| POST | `/projects/:id/modules/:pmId/redeploy` | Re-deploy current version |
| GET | `/projects/:id/activity` | Get activity log |
| POST | `/projects/:id/invite` | Invite a team member by email |
| GET | `/projects/:id/members` | List team members |
| DELETE | `/projects/:id/members/:memberId` | Remove a team member |
| POST | `/projects/accept-invite` | Accept an invite via token |
| POST | `/projects/:id/connect-github` | Connect a monorepo GitHub repo |
| POST | `/projects/:id/export` | Generate & download project ZIP |
| POST | `/projects/:id/open-antigravity` | Open in Antigravity IDE |

### Git Workspace
| Method | Path | Description |
|--------|------|-------------|
| GET | `/git/projects/:projectId/modules/:pmId/status` | Git status + metadata |
| POST | `/git/projects/:projectId/modules/:pmId/commit` | Stage all & commit |
| POST | `/git/projects/:projectId/modules/:pmId/push` | Push to remote |
| POST | `/git/projects/:projectId/modules/:pmId/pull` | Pull from remote |
| GET | `/git/projects/:projectId/modules/:pmId/branches` | List branches |
| POST | `/git/projects/:projectId/modules/:pmId/branches` | Create a branch |
| POST | `/git/projects/:projectId/modules/:pmId/checkout` | Switch branch |
| GET | `/git/projects/:projectId/modules/:pmId/history` | Commit history |
| GET | `/git/projects/:projectId/modules/:pmId/files` | File tree |
| GET | `/git/projects/:projectId/modules/:pmId/file` | Read a file |
| POST | `/git/projects/:projectId/modules/:pmId/file` | Write a file |

### Webhooks
| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhooks/github` | Receive GitHub push event |
| POST | `/github/webhook` | Alias for above |

### Runner
| Method | Path | Description |
|--------|------|-------------|
| POST | `/runner/start` | Start a module locally |
| POST | `/runner/stop` | Stop a running module |
| GET | `/runner/status/:moduleId` | Get runner status |
| GET | `/runner/logs/:moduleId` | Stream process logs |

---

## 7. Frontend Pages & Routes

| Route | Page | Auth Required | Description |
|-------|------|:-------------:|-------------|
| `/` | LandingPage | No | Marketing landing page |
| `/login` | LoginPage | No | Sign in / Sign up |
| `/dashboard` | DashboardPage | Yes | Overview: recent projects, quick stats |
| `/modules` | MarketplacePage | Yes | Browse & search module marketplace |
| `/modules/create` | CreateModulePage | Yes | Publish a new module (ZIP or GitHub) |
| `/modules/:id` | ModuleDetailsPage | Yes | Module detail, GitHub sync card, download |
| `/my-modules` | MyModulesPage | Yes | User's published modules |
| `/projects` | MyProjectsPage | Yes | User's projects list |
| `/builder/:projectId` | VisualBuilderPage | Yes | Drag-and-drop canvas project builder |
| `/projects/:projectId/modules/:pmId/workspace` | ModuleWorkspacePage | Yes | Full git workspace for a module |
| `/settings` | SettingsPage | Yes | User profile & platform settings |
| `/invites/:token` | AcceptInvitePage | No | Accept a team project invite |
| `/join-project` | AcceptInvitePage | No | Alternate invite acceptance URL |

---

## 8. Frontend Components

| Component | Description |
|-----------|-------------|
| `Navbar` | Top navigation bar with user avatar, create project button |
| `Sidebar` | Left navigation with links to all main sections |
| `ModuleCard` | Card shown in marketplace grid — name, category, tech tags, downloads |
| `GitHubSyncCard` | GitHub integration panel — sync status, register/remove webhook, sync history |
| `ValidationReport` | Shows ZIP validation results during module creation |
| `ExportProjectModal` | Modal for downloading composed project as ZIP |
| `AntigravityExportModal` | Modal for opening project in Antigravity IDE |
| `TeamProjectDashboard` | Team project activity feed, member list, module status grid |

---

## 9. State Management (Stores)

### useAuthStore
Manages authentication state.

| Action | Description |
|--------|-------------|
| `checkAuth()` | Restore session on page load (Supabase session or localStorage) |
| `login(email, password)` | Sign in via Supabase or localStorage fallback |
| `register(name, email, password)` | Create account via Supabase or localStorage fallback |
| `logout()` | Sign out and clear session |

### useModuleStore
Manages the module marketplace.

| Action | Description |
|--------|-------------|
| `fetchModules()` | Load marketplace with current filters |
| `setCategory / setSearchQuery / setSortBy` | Update filters (triggers re-fetch) |
| `uploadModuleZip(file)` | Upload & validate a ZIP |
| `importGithubRepo(url)` | Import & validate a GitHub repo |
| `createModule(metadata)` | Publish a new module |
| `deleteModule(id)` | Delete a module |
| `checkModuleSync(id)` | Check for new GitHub commits |
| `syncModule(id)` | Pull latest code from GitHub |
| `fetchModuleSyncHistory(id)` | Get sync log |
| `fetchWebhookStatus(id)` | Check GitHub webhook registration |
| `registerWebhook(id)` | Register GitHub push webhook |
| `deleteWebhook(id)` | Remove GitHub push webhook |
| `updateRuntimeConfig(id, config)` | Update run commands/ports |

### useProjectStore
Manages projects and team collaboration.

| Action | Description |
|--------|-------------|
| `fetchProjects()` | Load all user projects |
| `createProject(name, desc)` | Create a new project |
| `updateProject(id, data)` | Update project metadata / canvas state |
| `deleteProject(id)` | Delete a project |
| `addModule(projectId, moduleId, version)` | Add module to project |
| `removeModule(projectId, pmId)` | Remove module from project |
| `syncProjectModule(projectId, pmId)` | Sync a specific module |
| `rollbackModule(projectId, pmId, deploymentId)` | Rollback to previous version |
| `inviteMember(projectId, email, role)` | Send team invite email |
| `subscribeToProjectEvents(projectId)` | Open SSE connection for live updates |
| `exportProject(projectId)` | Generate and download project ZIP |
| `connectGitHub(projectId, repoUrl)` | Link a monorepo |

### useGitStore
Manages the git workspace for a specific module.

| Action | Description |
|--------|-------------|
| `fetchWorkspaceStatus(projectId, pmId)` | Load git status + metadata |
| `commit(projectId, pmId, message)` | Stage all changes and commit |
| `push(projectId, pmId, branch)` | Push to remote |
| `pull(projectId, pmId, branch)` | Pull from remote |
| `fetchBranches / createBranch / switchBranch` | Branch management |
| `fetchHistory(projectId, pmId)` | Load commit history |
| `fetchFileTree(projectId, pmId)` | Load directory tree |
| `loadFile / saveFile` | Read and write individual files |

---

## 10. Services

### gitService
Wraps Node.js `execFile` to perform git operations on local repos stored in `server/uploads/repos/`.

Key methods: `ensureRepo`, `getStatus`, `commit`, `push`, `pull`, `createBranch`, `checkoutBranch`, `getHistory`, `getFileTree`, `readFile`, `writeFile`

### githubWebhookService
Calls the GitHub Hooks REST API to manage push webhooks.

Key methods: `registerWebhook`, `deleteWebhook`, `getWebhookStatus`, `listRepoWebhooks`, `getWebhookUrl`

Requires: `GITHUB_TOKEN`, `WEBHOOK_PUBLIC_URL`

### realtimeEvents (RealtimeEventManager)
Maintains a `Map<projectId, Set<Response>>` of active SSE connections.

Key methods: `registerClient(projectId, res)`, `broadcastToProject(projectId, event)`

Event types: `MODULE_UPDATED`, `ROLLBACK_COMPLETED`, `MEMBER_JOINED`, `ACTIVITY_CREATED`, `PROJECT_SYNCED`

### deploymentProvider (LocalDeploymentProvider)
Simulates build/deploy in local dev. Generates `localhost:{port}` URLs.
> In production: replace with a real cloud deployment provider (Railway, Fly.io, etc.)

### localModuleRunner
Spawns actual child processes for running modules locally. Tracks PIDs, streams logs, manages lifecycle.

### emailService
Sends invite emails via Nodemailer. Uses Gmail SMTP when `SMTP_USER`/`SMTP_PASS` are set, falls back to Ethereal (disposable test account) automatically.

---

## 11. Real-Time Events (SSE)

The platform uses **Server-Sent Events** for pushing live updates to connected team members without polling.

**Flow:**
1. Client opens: `GET /api/projects/:id/events`
2. Server registers the `Response` stream in `RealtimeEventManager`
3. On GitHub push → webhook handler → `realtimeEventManager.broadcastToProject(projectId, event)`
4. All connected clients receive the event and update their UI instantly

**Event payload shape:**
```json
{
  "type": "MODULE_UPDATED",
  "projectId": "uuid",
  "moduleId": "uuid",
  "moduleName": "CRM",
  "commitSha": "a82f91c",
  "author": "daneshpm",
  "message": "fix: update invoice logic",
  "status": "synced",
  "timestamp": "2026-08-25T11:30:00.000Z"
}
```

> **Note for Vercel production:** Serverless functions are stateless — SSE connections don't persist between invocations. For reliable real-time in production, replace with **Supabase Realtime**, **Pusher**, or **Ably**.

---

## 12. GitHub Webhook Integration

The full webhook lifecycle:

```
User clicks "Register Webhook" in GitHubSyncCard
    ↓
POST /api/modules/:id/register-webhook
    ↓
githubWebhookService.registerWebhook()
    ↓
POST https://api.github.com/repos/{owner}/{repo}/hooks
    → payload_url: WEBHOOK_PUBLIC_URL/api/webhooks/github
    → secret: GITHUB_WEBHOOK_SECRET
    → events: ["push"]
    ↓
GitHub stores webhook, sends "ping" event
    ↓
ModuleForge stores webhook ID in Module.githubWebhookId
    ↓
--- Later: developer pushes code ---
    ↓
GitHub POST /api/webhooks/github
    ↓
Signature verified (HMAC SHA-256)
    ↓
Find matching Module / ProjectModule records
    ↓
Download latest repo ZIP from GitHub
    ↓
Update DB: currentCommitSha, lastSyncedAt, deploymentStatus
    ↓
realtimeEventManager.broadcastToProject() → SSE to all team members
```

**Required env vars:** `GITHUB_TOKEN`, `WEBHOOK_PUBLIC_URL`, `GITHUB_WEBHOOK_SECRET`

---

## 13. Authentication

**Production (Supabase):**
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- `useAuthStore` calls `supabase.auth.signInWithPassword()` / `signUp()` / `getSession()`
- Sessions are managed by the Supabase JS client (stored in localStorage)

**Development fallback (no Supabase):**
- Leave `VITE_SUPABASE_URL` blank
- `useAuthStore` stores user in `localStorage` under key `moduleforge_user`
- Any email/password combination works — no server validation
- Useful for local dev and demos without a Supabase project

**Route protection:**
- `<RequireAuth>` component wraps all protected routes in `App.tsx`
- Shows a spinner while `checkAuth()` runs on page load
- Redirects to `/login` with `state.from` preserved for post-login redirect

---

## 14. Environment Variables

### Server (`server/.env`)

| Variable | Required | Description |
|----------|:--------:|-------------|
| `PORT` | No | Server port (default: 5000) |
| `NODE_ENV` | No | `development` or `production` |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string (or SQLite `file:./dev.db` for local) |
| `ALLOWED_ORIGINS` | Prod | Comma-separated allowed CORS origins |
| `GITHUB_TOKEN` | Webhooks | GitHub PAT with `repo` scope |
| `WEBHOOK_PUBLIC_URL` | Webhooks | Public HTTPS URL of the server |
| `GITHUB_WEBHOOK_SECRET` | Webhooks | HMAC secret for webhook signature verification |
| `SUPABASE_URL` | Auth | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Auth | Supabase service role key (server-side) |
| `SMTP_HOST` | Email | SMTP host (optional, Ethereal fallback) |
| `SMTP_USER` | Email | SMTP username |
| `SMTP_PASS` | Email | SMTP password |

### Client (`client/.env`)

| Variable | Required | Description |
|----------|:--------:|-------------|
| `VITE_SUPABASE_URL` | Prod Auth | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Prod Auth | Supabase anon/public key |
| `VITE_API_URL` | No | API base URL (leave blank for same-origin) |

---

## 15. Local Development Setup

### Prerequisites
- Node.js 18+
- Git

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/daneshpm/rooman-module-project.git
cd rooman-module-project
git checkout feature/github-webhooks-vercel-deploy

# 2. Install all dependencies (root installs both workspaces)
npm install

# 3. Set up environment
cp server/.env.example server/.env
# Edit server/.env — at minimum set DATABASE_URL

# 4. Push schema to database
npm run db:push

# 5. Start both server and client
npm run dev
#  → API server: http://localhost:5000
#  → React app:  http://localhost:5173
```

### GitHub Webhook (local dev)

```bash
# Install ngrok
# Run your server first: npm run dev

# In a separate terminal:
ngrok http 5000
# Copy the https URL (e.g. https://abc123.ngrok-free.app)

# Add to server/.env:
GITHUB_TOKEN=ghp_...
WEBHOOK_PUBLIC_URL=https://abc123.ngrok-free.app
GITHUB_WEBHOOK_SECRET=any_secret_string

# Restart the server
# Open a GitHub module in the app → GitHubSyncCard → Register Webhook
```

---

## 16. Vercel Deployment

### How it works

`vercel.json` configures:
- `buildCommand`: `npm run build:vercel` — builds only the React client
- `outputDirectory`: `client/dist` — static files served by Vercel CDN
- `/api/*` requests → rewritten to `api/index.ts` (Vercel Serverless Function)
- All other routes → `index.html` (React SPA client-side routing)

### Deploy steps

```bash
# 1. Push to GitHub
git push -u mine feature/github-webhooks-vercel-deploy

# 2. Go to https://vercel.com/new
#    Import: daneshpm/rooman-module-project
#    Framework: Other
#    Root Directory: /

# 3. Add environment variables in Vercel Dashboard:
#    DATABASE_URL, NODE_ENV=production, ALLOWED_ORIGINS,
#    GITHUB_TOKEN, WEBHOOK_PUBLIC_URL, GITHUB_WEBHOOK_SECRET,
#    VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

# 4. Deploy

# 5. After deploy — update:
#    ALLOWED_ORIGINS=https://your-app.vercel.app
#    WEBHOOK_PUBLIC_URL=https://your-app.vercel.app
#    Redeploy
```

### Vercel limitations to be aware of

| Feature | Status | Solution |
|---------|--------|---------|
| SQLite database | ❌ Not supported | Use Neon / PlanetScale / Supabase DB |
| File uploads persistence | ❌ Ephemeral filesystem | Use AWS S3 / Cloudflare R2 |
| SSE long connections | ⚠️ 30s timeout | Use Supabase Realtime / Pusher |
| Local git repos | ❌ Ephemeral filesystem | Use GitHub API directly |

---

## 17. Database (Neon PostgreSQL)

**Connection:** `ep-wandering-hill-aymk4oaj.c-5.us-east-2.aws.neon.tech`
**Database:** `neondb`

### Schema management

```bash
# Apply schema changes to the database
npm run db:push

# Regenerate Prisma client after schema changes
npm run db:generate
```

### Switching from SQLite to PostgreSQL

1. Update `server/prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Update `DATABASE_URL` in `server/.env`
3. Run `npm run db:push`

The schema is already set to PostgreSQL in this project.
