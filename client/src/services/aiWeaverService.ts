import { Module, ProjectModule } from '../types';

export interface ArchitectureConnection {
  id: string;
  sourceModuleId: string;
  sourceModuleName: string;
  sourceHandle: 'output' | 'right' | 'bottom';
  targetModuleId: string;
  targetModuleName: string;
  targetHandle: 'input' | 'left' | 'top';
  protocol: 'REST' | 'gRPC' | 'GraphQL' | 'EventStream' | 'Database';
  dataPayload: string;
}

export interface SynthesizedArchitecture {
  title: string;
  description: string;
  matchedModules: Array<{
    module: Module;
    xPosition: number;
    yPosition: number;
    tier: 'frontend' | 'gateway' | 'service' | 'database';
  }>;
  connections: ArchitectureConnection[];
  glueCode: string;
  envVariables: Record<string, string>;
  dockerComposeYaml: string;
}

export interface ArchitectureTemplate {
  id: string;
  title: string;
  tagline: string;
  icon: string;
  keywords: string[];
  description: string;
  defaultPrompt: string;
}

export const CURATED_TEMPLATES: ArchitectureTemplate[] = [
  {
    id: 'saas-fullstack',
    title: 'Full-Stack SaaS Platform',
    tagline: 'Google OAuth + Stripe Billing + Postgres + Dashboard',
    icon: '🚀',
    keywords: ['saas', 'stripe', 'auth', 'postgres', 'billing', 'subscription', 'dashboard'],
    description: 'Complete production-grade SaaS starter with user authentication, recurring Stripe payments, multi-tenant Postgres, and interactive analytics dashboard.',
    defaultPrompt: 'Build a production multi-tenant SaaS architecture with Google authentication, recurring Stripe subscriptions, PostgreSQL database, and an analytics dashboard.',
  },
  {
    id: 'genai-copilot',
    title: 'GenAI Agentic Assistant',
    tagline: 'Gemini 2.0 API + Live Streaming + Vector DB + Chat UI',
    icon: '🤖',
    keywords: ['ai', 'gemini', 'chat', 'llm', 'vector', 'copilot', 'agent', 'stream'],
    description: 'High-throughput generative AI copilot stack with real-time token streaming, multi-modal context memory, and conversation persistence.',
    defaultPrompt: 'Design a GenAI copilot application with Gemini API streaming responses, vector memory retrieval, user auth, and real-time chat interface.',
  },
  {
    id: 'ecommerce-storefront',
    title: 'Modern E-Commerce Engine',
    tagline: 'Product Catalog + Shopping Cart + Stripe Checkout + CRM',
    icon: '🛒',
    keywords: ['ecommerce', 'shop', 'cart', 'checkout', 'payment', 'inventory', 'crm'],
    description: 'High-conversion modular e-commerce stack with dynamic product catalog, persistent shopping cart, Stripe payment gateway, and customer order management.',
    defaultPrompt: 'Assemble an e-commerce platform with product catalog browsing, persistent cart state, Stripe checkout, and customer order tracking.',
  },
  {
    id: 'enterprise-crm',
    title: 'Enterprise CRM & Notification Suite',
    tagline: 'Customer Pipelines + Gmail SMTP + Webhooks + Analytics',
    icon: '🏢',
    keywords: ['crm', 'sales', 'email', 'smtp', 'notification', 'pipeline', 'enterprise'],
    description: 'Enterprise workflow engine with deal pipeline tracking, automated transactional Gmail SMTP emails, webhook triggers, and team role permissions.',
    defaultPrompt: 'Create an enterprise CRM and communication suite with sales pipelines, automated email dispatch, webhook listeners, and team role management.',
  },
];

class AiWeaverService {
  /**
   * Synthesize a full architecture from natural language prompt against available marketplace modules
   */
  public synthesizeArchitecture(prompt: string, availableModules: Module[]): SynthesizedArchitecture {
    const cleanPrompt = prompt.toLowerCase();

    // 1. Identify required architectural layers from prompt
    const needsAuth = /auth|user|login|signup|oauth|session|jwt|security/.test(cleanPrompt);
    const needsPayments = /payment|stripe|billing|checkout|subscription|invoice|money|pricing/.test(cleanPrompt);
    const needsAi = /ai|gemini|llm|gpt|chat|copilot|bot|intelligence|prompt|agent/.test(cleanPrompt);
    const needsDb = /db|database|postgres|neon|sql|store|storage|data|prisma/.test(cleanPrompt);
    const needsCrm = /crm|sales|pipeline|customer|lead|contact|deal/.test(cleanPrompt);
    const needsComm = /comm|chat|message|video|meet|call|channel|team|webrtc/.test(cleanPrompt);
    const needsUi = /ui|frontend|dashboard|react|view|portal|catalog|storefront/.test(cleanPrompt);

    // 2. Score and select top relevant modules from registry
    const selectedModules: Array<{ module: Module; tier: 'frontend' | 'gateway' | 'service' | 'database' }> = [];
    const usedIds = new Set<string>();

    const pickBestModule = (
      predicate: (m: Module) => boolean,
      fallbackNameSearch: string,
      tier: 'frontend' | 'gateway' | 'service' | 'database'
    ) => {
      let found = availableModules.find((m) => !usedIds.has(m.id) && predicate(m));
      if (!found) {
        found = availableModules.find(
          (m) =>
            !usedIds.has(m.id) &&
            (m.name.toLowerCase().includes(fallbackNameSearch) ||
              m.description.toLowerCase().includes(fallbackNameSearch) ||
              m.categoryName?.toLowerCase().includes(fallbackNameSearch))
        );
      }
      if (found && !usedIds.has(found.id)) {
        usedIds.add(found.id);
        selectedModules.push({ module: found, tier });
      }
    };

    // Pick modules by intent
    if (needsUi || (!needsAuth && !needsPayments && !needsAi && !needsCrm)) {
      pickBestModule((m) => /ui|dashboard|frontend|portal/i.test(m.categoryName || m.name), 'dashboard', 'frontend');
    }

    if (needsAuth || selectedModules.length === 0) {
      pickBestModule((m) => /auth|security|identity/i.test(m.categoryName || m.name), 'auth', 'gateway');
    }

    if (needsPayments) {
      pickBestModule((m) => /payment|billing|stripe|finance/i.test(m.categoryName || m.name), 'payment', 'service');
    }

    if (needsAi) {
      pickBestModule((m) => /ai|intelligence|gemini|llm|ml/i.test(m.categoryName || m.name), 'ai', 'service');
    }

    if (needsCrm) {
      pickBestModule((m) => /crm|sales|customer/i.test(m.categoryName || m.name), 'crm', 'service');
    }

    if (needsComm) {
      pickBestModule((m) => /comm|chat|video|call|team/i.test(m.categoryName || m.name), 'team', 'service');
    }

    if (needsDb || selectedModules.length < 3) {
      pickBestModule((m) => /db|database|storage|data/i.test(m.categoryName || m.name), 'db', 'database');
    }

    // Ensure we have at least 3-4 cohesive modules for a rich architecture
    if (selectedModules.length < 3 && availableModules.length > 0) {
      for (const m of availableModules) {
        if (!usedIds.has(m.id) && selectedModules.length < 4) {
          usedIds.add(m.id);
          selectedModules.push({ module: m, tier: 'service' });
        }
      }
    }

    // 3. Compute clean multi-tiered layout coordinates
    const tierOrder: Record<'frontend' | 'gateway' | 'service' | 'database', number> = {
      frontend: 0,
      gateway: 1,
      service: 2,
      database: 3,
    };

    selectedModules.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);

    const startX = 80;
    const startY = 100;
    const colSpacing = 380;
    const rowSpacing = 300;

    const matchedModules = selectedModules.map((item, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      return {
        module: item.module,
        tier: item.tier,
        xPosition: startX + col * colSpacing,
        yPosition: startY + row * rowSpacing,
      };
    });

    // 4. Generate Neural Socket Connections between pipeline stages
    const connections: ArchitectureConnection[] = [];
    for (let i = 0; i < matchedModules.length - 1; i++) {
      const src = matchedModules[i];
      const tgt = matchedModules[i + 1];

      let protocol: ArchitectureConnection['protocol'] = 'REST';
      let payload = 'JSON Web Tokens & Session State';

      if (src.tier === 'frontend' && tgt.tier === 'gateway') {
        protocol = 'GraphQL';
        payload = 'Client Requests & Auth Handshake';
      } else if (tgt.tier === 'database') {
        protocol = 'Database';
        payload = 'Parameterized SQL Queries & Connection Pool';
      } else if (tgt.module.name.toLowerCase().includes('ai')) {
        protocol = 'EventStream';
        payload = 'Real-time Server-Sent Token Stream';
      } else if (tgt.module.name.toLowerCase().includes('payment')) {
        protocol = 'REST';
        payload = 'Webhook Dispatch & Checkout Session';
      }

      connections.push({
        id: `conn-${src.module.id}-${tgt.module.id}`,
        sourceModuleId: src.module.id,
        sourceModuleName: src.module.name,
        sourceHandle: 'right',
        targetModuleId: tgt.module.id,
        targetModuleName: tgt.module.name,
        targetHandle: 'left',
        protocol,
        dataPayload: payload,
      });
    }

    // 5. Synthesize type-safe TypeScript glue orchestrator code
    const glueCode = this.generateTypeScriptGlue(matchedModules, connections);

    // 6. Synthesize unified .env configuration requirements
    const envVariables: Record<string, string> = {
      NODE_ENV: 'production',
      PORT: '5000',
      APP_URL: 'https://moduleforge-deploy-pearl.vercel.app',
      DATABASE_URL: 'postgresql://user:pass@ep-neon-db.tech/neondb?sslmode=require',
    };

    if (matchedModules.some((m) => /auth|google/i.test(m.module.name))) {
      envVariables['GOOGLE_CLIENT_ID'] = 'your-google-oauth-client-id.apps.googleusercontent.com';
      envVariables['JWT_SECRET'] = 'moduleforge-super-secret-production-key';
    }

    if (matchedModules.some((m) => /stripe|payment/i.test(m.module.name))) {
      envVariables['STRIPE_SECRET_KEY'] = 'sk_live_51Pxxxxxxxxxxxxxxxxxxxx';
      envVariables['STRIPE_WEBHOOK_SECRET'] = 'whsec_xxxxxxxxxxxxxxxxxxxx';
    }

    if (matchedModules.some((m) => /ai|gemini/i.test(m.module.name))) {
      envVariables['GEMINI_API_KEY'] = 'AIzaSyxxxxxxxxxxxxxxxxxxxxxx';
    }

    if (matchedModules.some((m) => /crm|smtp|mail/i.test(m.module.name))) {
      envVariables['GMAIL_USER'] = 'shalyagaonkar@gmail.com';
      envVariables['GMAIL_APP_PASSWORD'] = 'qqqzitiyzyhgvagy';
    }

    // 7. Synthesize Docker Compose
    const dockerComposeYaml = this.generateDockerCompose(matchedModules);

    return {
      title: this.deriveTitle(cleanPrompt, matchedModules),
      description: `Synthesized architecture with ${matchedModules.length} interconnected modules across ${connections.length} live data mesh pipelines.`,
      matchedModules,
      connections,
      glueCode,
      envVariables,
      dockerComposeYaml,
    };
  }

  private deriveTitle(prompt: string, modules: Array<{ module: Module }>): string {
    if (prompt.includes('saas') || prompt.includes('fullstack')) return 'Full-Stack SaaS Cloud Architecture';
    if (prompt.includes('ai') || prompt.includes('copilot') || prompt.includes('gemini')) return 'Autonomous GenAI Copilot Mesh';
    if (prompt.includes('ecommerce') || prompt.includes('shop') || prompt.includes('cart')) return 'High-Scale E-Commerce Microservices';
    if (prompt.includes('crm') || prompt.includes('sales')) return 'Enterprise CRM & Real-Time Data Pipeline';
    return `${modules.map((m) => m.module.name).slice(0, 3).join(' + ')} Stack`;
  }

  private generateTypeScriptGlue(
    modules: Array<{ module: Module; tier: string }>,
    connections: ArchitectureConnection[]
  ): string {
    const imports = modules
      .map(
        (m, idx) =>
          `import { ${this.sanitizeIdentifier(m.module.name)}Service } from './modules/${m.module.slug || `module-${idx}`}/index';`
      )
      .join('\n');

    const inits = modules
      .map(
        (m) =>
          `  const ${this.toCamelCase(m.module.name)} = new ${this.sanitizeIdentifier(m.module.name)}Service({
    environment: process.env.NODE_ENV || 'production',
    debug: false,
  });`
      )
      .join('\n\n');

    const routing = connections
      .map(
        (c) =>
          `  // Pipe: ${c.sourceModuleName} ➔ ${c.targetModuleName} (${c.protocol})
  ${this.toCamelCase(c.sourceModuleName)}.onEvent(async (event) => {
    console.log('[Mesh Event]', event.type, 'Payload:', event.data);
    await ${this.toCamelCase(c.targetModuleName)}.handleInbound({
      protocol: '${c.protocol}',
      source: '${c.sourceModuleName}',
      payload: event.data,
    });
  });`
      )
      .join('\n\n');

    return `/**
 * ============================================================================
 * ModuleForge Synthesized Architecture Orchestrator
 * Auto-generated by AI Agentic Architecture Weaver
 * ============================================================================
 */

import express from 'express';
${imports}

export async function bootstrapModularMesh() {
  console.log('⚡ Initializing ModuleForge Neural Mesh Layer...');

  // 1. Instantiate Module Services
${inits}

  // 2. Wire Dynamic Pipeline Connections
${routing}

  console.log('✅ All ${modules.length} microservices successfully bound and listening.');
  return {
    ${modules.map((m) => `${this.toCamelCase(m.module.name)},`).join('\n    ')}
  };
}
`;
  }

  private generateDockerCompose(modules: Array<{ module: Module }>): string {
    const services = modules
      .map(
        (m, idx) => `  ${m.module.slug || `service-${idx}`}:
    image: node:20-alpine
    restart: always
    environment:
      - NODE_ENV=production
      - PORT=${4567 + idx}
    ports:
      - "${4567 + idx}:${4567 + idx}"
    volumes:
      - ./modules/${m.module.slug || `module-${idx}`}:/app
    working_dir: /app
    command: ["npm", "run", "start"]`
      )
      .join('\n\n');

    return `version: '3.8'

services:
${services}

networks:
  default:
    name: moduleforge-mesh-network
`;
  }

  private sanitizeIdentifier(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '');
  }

  private toCamelCase(name: string): string {
    const clean = name.replace(/[^a-zA-Z0-9]/g, ' ').trim();
    return clean
      .split(' ')
      .map((word, i) => (i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
      .join('');
  }
}

export const aiWeaverService = new AiWeaverService();
