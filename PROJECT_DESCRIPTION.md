# ModuleForge — Modular Software Platform & Collaborative Engineering Ecosystem

---

## 📌 Executive Summary

**ModuleForge** is a full-stack, modular software platform and collaborative developer ecosystem designed to streamline the way developers build, publish, assemble, and collaborate on reusable software modules. 

ModuleForge bridges the gap between software registries (like npm/Docker Hub), visual architecture builders, in-browser development environments (like VS Code/Monaco), and real-time team communication tools (like Slack/Google Meet) into a single cohesive workspace.

---

## 🚨 The Problems ModuleForge Solves

Modern software engineering and product development suffer from critical friction points:

### 1. The "Reinventing the Wheel" Problem & Code Duplication
* **Pain Point**: Engineering teams repeatedly write boilerplate code for authentication, CRM integrations, payment flows, notification engines, and UI dashboards for every new project.
* **ModuleForge Solution**: Provides a centralized, searchable **Module Marketplace** where developers can publish, discover, version, and import verified software modules with one click.

### 2. High Friction in Module Publishing & Extraction
* **Pain Point**: Distributing code traditionally requires complex packaging pipelines, npm publishing permissions, local git cloning bottlenecks, and CLI configuration overhead.
* **ModuleForge Solution**: Supports **In-Memory Streaming Ingestion** from both `.zip` archives and direct GitHub URLs (`https://github.com/owner/repo`). It automatically parses manifests (`module.json`/`package.json`), validates code integrity, and extracts file trees in memory without requiring server disk writes or CLI installations.

### 3. Tool Fragmentation & Context Switching
* **Pain Point**: Developers constantly jump between GitHub (code hosting), npm (packages), Figma/Miro (architecture diagrams), VS Code (editing), Slack/Discord (chat), and Zoom/Meet (video calls).
* **ModuleForge Solution**: Consolidates the entire lifecycle into one unified interface:
  - **Explore**: Browse verified modules in the Marketplace.
  - **Build**: Assemble modules visually with the drag-and-drop Architecture Builder.
  - **Code**: Inspect and edit code directly in the browser with Monaco Editor.
  - **Collaborate**: Chat in channels, send direct messages, and jump into HD video calls with instant join links.

### 4. Poor Team Onboarding & Workspace Isolation
* **Pain Point**: Inviting teammates to private project architectures often involves manual access grants, localhost port conflicts, and broken environment links.
* **ModuleForge Solution**: Offers automated **Gmail SMTP Email Invitations** and **1-Click Secure Join Links** (`/join-project?token=...`). Teammates accept invites, authenticate securely via Google OAuth, and immediately access their team's projects without localhost redirection issues.

### 5. Lack of Real-Time Context in Development Meetings
* **Pain Point**: When teams encounter a bug or need architecture reviews, setting up external video calls disconnects discussion from the active project context.
* **ModuleForge Solution**: Features embedded **WebRTC & LiveKit HD Video Meetings**. Starting a meeting inside a team channel automatically broadcasts a live interactive meeting card with a 1-click "Join Video Call" button right inside the chat stream.

---

## 🌟 Key Features & Capabilities

```
┌────────────────────────────────────────────────────────────────────────┐
│                              MODULEFORGE                               │
├───────────────────┬────────────────────┬───────────────────────────────┤
│    MARKETPLACE    │   VISUAL BUILDER   │      TEAM COLLABORATION       │
│ • Module Search   │ • Node Canvas      │ • Team Workspaces & Roles     │
│ • Version Control │ • Drag & Drop      │ • Channel & Direct Chat       │
│ • ZIP / Git Import│ • Port Connections │ • HD Video/Audio Calls & Meet │
│ • Review & Rating │ • Live Code Export │ • SMTP Invites & Join Tokens  │
└───────────────────┴────────────────────┴───────────────────────────────┘
```

### 1. 📦 Module Registry & Marketplace
- **Search & Filter**: Real-time fuzzy search by category (Auth, Payments, AI, UI, Database, CRM) and tags.
- **Dual Ingestion**: Upload custom `.zip` files or import directly from any public GitHub repository.
- **Detailed Module Inspection**: View README markdown, dependency graphs, installation scripts, and author metrics.

### 2. 🧩 Visual Architecture Builder
- **Node-Based Canvas**: Drag and drop modules onto an interactive canvas.
- **Port Wiring & Data Flows**: Connect inputs and outputs between frontend, backend, database, and third-party APIs.
- **Live Configuration**: Configure environment variables, route endpoints, and integration props per node.

### 3. 💻 In-Browser Monaco Code Workspace
- **VS Code Engine**: Full syntax highlighting, code folding, bracket matching, and multi-file navigation directly in the browser.
- **Real-Time Testing**: Isolated environment to test module integrations before exporting to production.

### 4. 👥 Team Multi-Tenancy & Project Isolation
- **Organization & Team Management**: Create teams, assign roles (`Owner`, `Admin`, `Member`), and manage scoped projects.
- **Private Data Isolation**: Projects and uploaded modules are strictly isolated by authenticated user and team IDs.

### 5. 📹 WebRTC & LiveKit HD Video Conferencing
- **Zero-Install Video Meetings**: Built on browser WebRTC with multi-tier `getUserMedia` stream fallbacks (HD $\rightarrow$ SD $\rightarrow$ Audio/Video only).
- **Interactive In-Chat Meeting Cards**: Starting a meeting posts an instant join card into team channels.
- **Screen Sharing & Controls**: Toggle microphone, camera, screen sharing, and participant grid layout.

### 6. ✉️ Automated Invitations & Production Routing
- **Branded SMTP Mailer**: Sends automated HTML invitation emails via Gmail SMTP (`shalyagaonkar@gmail.com`).
- **Instant Join Tokens**: 1-click token validation that links new users directly to their assigned team workspace or project on `https://moduleforge-deploy-pearl.vercel.app`.

### 7. 📱 100% Mobile Responsive Interface
- **Slide-out Navigation Drawer**: Touch-friendly mobile drawer with overlay for smartphones and tablets.
- **Adaptive Layout**: Responsive search bars, touch controls, and dynamic grid layouts.

---

## 🏗️ Technical Architecture & Data Flow

```mermaid
graph TD
    Client[React 18 + Vite SPA Frontend] -->|REST API / JSON| API[Express.js Serverless API on Vercel]
    Client -->|Google OAuth 2.0| Firebase[Firebase Authentication]
    Client -->|WebRTC / SFU| LiveKit[WebRTC Media & LiveKit Server]
    
    API -->|Prisma ORM| DB[(Neon Serverless PostgreSQL)]
    API -->|HTTP Streaming / In-Memory JSZip| GitHub[GitHub Codeload API]
    API -->|SMTP over TLS| Gmail[Gmail SMTP Gateway]
    
    subgraph "Core Server Services"
        API --> Validator[Zip & Manifest Validator]
        API --> EmailService[Email & Invite Service]
        API --> ProjectRouter[Project & Workspace Manager]
        API --> TeamRouter[Teams, Channels & Chat]
    end
```

---

## 🛠️ Complete Tech Stack

| Layer | Technologies Used | Purpose |
|---|---|---|
| **Frontend UI** | **React 18**, **TypeScript**, **Vite** | Lightning-fast rendering, strict type-safety, and optimized production builds |
| **Styling & Icons** | **TailwindCSS**, **Lucide React** | Modern design system, curated color tokens, responsive mobile layouts |
| **State Management** | **Zustand** | Lightweight, decoupled global stores (`auth`, `projects`, `teams`, `modules`, `communication`) |
| **Code Editor** | **Monaco Editor** (`@monaco-editor/react`) | In-browser VS Code editing experience |
| **Backend & API** | **Node.js**, **Express.js**, **Vercel Serverless** | Scalable REST API with modular route handlers and middleware |
| **ORM & Database** | **Prisma ORM**, **PostgreSQL (Neon DB)** | Schema modeling, relational queries, migrations, and serverless pooling |
| **Authentication** | **Firebase Authentication** | Secure Google OAuth 2.0 Sign-In and session tokens |
| **Archive Ingestion**| **JSZip**, **Multer**, **Axios** | In-memory ZIP decompresion and streaming GitHub archive extraction |
| **Real-Time Media** | **WebRTC Native APIs**, **LiveKit Client** | HD video/audio conferencing, screen sharing, active speaker detection |
| **Email Gateway** | **Nodemailer**, **Gmail SMTP** | Automated transactional emails and branded project invitation links |
| **Hosting & CI/CD** | **Vercel**, **GitHub Actions** | Automated edge deployments and production hosting |

---

## 🎯 Real-World Use Cases

1. **Enterprise Engineering Teams**: Standardize internal UI libraries, micro-services, and utility modules across multiple cross-functional teams.
2. **Startup & Hackathon Builders**: Rapidly assemble full-stack applications by combining pre-built authentication, payment, and database modules on a visual canvas.
3. **Open-Source Maintainers**: Publish and showcase modular components with interactive live demos and automated documentation.
4. **Remote Agile Teams**: Collaborate, chat, and host architecture review video meetings in the same window where code and architecture live.

---

## 🔒 Security & Performance Highlights

- **Zero Arbitrary Execution during Ingestion**: ZIP and GitHub archives are inspected purely in memory without running untrusted scripts.
- **Serverless Edge Performance**: Stateless API functions scale dynamically with zero cold-boot bottlenecks.
- **Graceful Device Degradation**: Multi-tiered fallback ensures camera and microphone streams activate smoothly across various hardware configurations.

---

## 📄 License & Maintainer
- **Project**: ModuleForge
- **Live Application**: [https://moduleforge-deploy-pearl.vercel.app](https://moduleforge-deploy-pearl.vercel.app)
- **Repository**: [https://github.com/daneshpm/moduleforge-deploy](https://github.com/daneshpm/moduleforge-deploy)
