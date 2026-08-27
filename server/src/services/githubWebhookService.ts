import axios from 'axios';
import { prisma } from '../prisma';

const GITHUB_API = 'https://api.github.com';

/**
 * Build the public webhook URL that GitHub will POST to.
 * Falls back to a localhost URL for local dev (requires a tunnel like ngrok).
 */
export function getWebhookUrl(): string {
  const base =
    process.env.WEBHOOK_PUBLIC_URL ||
    `http://localhost:${process.env.PORT || 5000}`;
  return `${base}/api/webhooks/github`;
}

/**
 * Returns Axios headers with the GitHub personal access token.
 * Accepts an optional override token (from client Settings page).
 */
function githubHeaders(tokenOverride?: string): Record<string, string> {
  const token = tokenOverride || process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      'GITHUB_TOKEN is not set. Add it in Settings → GitHub Integration or set it in Vercel environment variables.'
    );
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'ModuleForge-Platform',
  };
}

/**
 * List all webhooks currently registered on a GitHub repo.
 */
export async function listRepoWebhooks(
  owner: string,
  repo: string,
  tokenOverride?: string
): Promise<any[]> {
  try {
    const res = await axios.get(
      `${GITHUB_API}/repos/${owner}/${repo}/hooks`,
      { headers: githubHeaders(tokenOverride), timeout: 10000 }
    );
    return res.data || [];
  } catch (e: any) {
    // 404 = no hooks or repo not found; return empty list gracefully
    if (e.response?.status === 404) return [];
    throw e;
  }
}

/**
 * Register a webhook on the GitHub repository for the given module.
 * - Skips registration if a ModuleForge webhook is already active on GitHub.
 * - Updates `githubWebhookId` on the Module record in the DB after success.
 */
export async function registerWebhook(
  moduleId: string,
  overrides?: { githubToken?: string; webhookSecret?: string }
): Promise<{
  success: boolean;
  webhookId?: string;
  webhookUrl?: string;
  alreadyRegistered?: boolean;
  error?: string;
}> {
  const module = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!module) return { success: false, error: 'Module not found' };

  if (module.sourceType !== 'github' || !module.githubOwner || !module.githubRepo) {
    return { success: false, error: 'Module is not connected to a GitHub repository' };
  }

  const owner = module.githubOwner;
  const repo = module.githubRepo;
  const webhookUrl = getWebhookUrl();
  const tokenOverride = overrides?.githubToken;
  const secret = overrides?.webhookSecret || process.env.GITHUB_WEBHOOK_SECRET || 'moduleforge_webhook_secret';

  try {
    // Check for an existing ModuleForge webhook on this repo to avoid duplicates
    const existing = await listRepoWebhooks(owner, repo, tokenOverride);
    const alreadyExists = existing.find(
      (h: any) =>
        h.config?.url === webhookUrl && h.active === true
    );

    if (alreadyExists) {
      // Persist the remote webhook ID in our DB if it was missing
      if (module.githubWebhookId !== String(alreadyExists.id)) {
        await prisma.module.update({
          where: { id: module.id },
          data: { githubWebhookId: String(alreadyExists.id) },
        });
      }
      return {
        success: true,
        webhookId: String(alreadyExists.id),
        webhookUrl,
        alreadyRegistered: true,
      };
    }

    // Register a new webhook via the GitHub Hooks API
    const res = await axios.post(
      `${GITHUB_API}/repos/${owner}/${repo}/hooks`,
      {
        name: 'web',
        active: true,
        events: ['push'],
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret,
          insecure_ssl: '0',
        },
      },
      { headers: githubHeaders(tokenOverride), timeout: 10000 }
    );

    const webhookId = String(res.data.id);

    // Persist the webhook ID so we can delete it later
    await prisma.module.update({
      where: { id: module.id },
      data: { githubWebhookId: webhookId },
    });

    console.log(
      `✅ GitHub webhook registered for ${owner}/${repo} → ${webhookUrl} (id: ${webhookId})`
    );

    return { success: true, webhookId, webhookUrl, alreadyRegistered: false };
  } catch (e: any) {
    const msg =
      e.response?.data?.message ||
      e.response?.data?.errors?.map((x: any) => x.message).join(', ') ||
      e.message;
    console.error(`❌ Failed to register webhook for ${owner}/${repo}:`, msg);
    return { success: false, error: msg };
  }
}

/**
 * Delete the webhook registered on GitHub for the given module.
 * Clears `githubWebhookId` from the DB on success.
 */
export async function deleteWebhook(moduleId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const module = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!module) return { success: false, error: 'Module not found' };

  if (!module.githubOwner || !module.githubRepo) {
    return { success: false, error: 'Module has no GitHub repository linked' };
  }

  if (!module.githubWebhookId) {
    return { success: false, error: 'No registered webhook found for this module' };
  }

  const owner = module.githubOwner;
  const repo = module.githubRepo;
  const hookId = module.githubWebhookId;

  try {
    await axios.delete(
      `${GITHUB_API}/repos/${owner}/${repo}/hooks/${hookId}`,
      { headers: githubHeaders(), timeout: 10000 }
    );

    await prisma.module.update({
      where: { id: module.id },
      data: { githubWebhookId: null },
    });

    console.log(`🗑️  GitHub webhook ${hookId} deleted for ${owner}/${repo}`);
    return { success: true };
  } catch (e: any) {
    // 404 means GitHub already removed it — treat as success and clean DB
    if (e.response?.status === 404) {
      await prisma.module.update({
        where: { id: module.id },
        data: { githubWebhookId: null },
      });
      return { success: true };
    }

    const msg = e.response?.data?.message || e.message;
    console.error(`❌ Failed to delete webhook ${hookId} for ${owner}/${repo}:`, msg);
    return { success: false, error: msg };
  }
}

/**
 * Get the registration status of the webhook for a module.
 * Checks both the local DB and the live GitHub API.
 */
export async function getWebhookStatus(moduleId: string): Promise<{
  registered: boolean;
  webhookId?: string;
  webhookUrl?: string;
  active?: boolean;
  error?: string;
  tokenMissing?: boolean;
}> {
  const module = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!module) return { registered: false, error: 'Module not found' };

  if (!process.env.GITHUB_TOKEN) {
    return {
      registered: Boolean(module.githubWebhookId),
      webhookId: module.githubWebhookId || undefined,
      tokenMissing: true,
    };
  }

  if (!module.githubOwner || !module.githubRepo) {
    return { registered: false };
  }

  try {
    const hooks = await listRepoWebhooks(module.githubOwner, module.githubRepo);
    const webhookUrl = getWebhookUrl();
    const found = hooks.find((h: any) => h.config?.url === webhookUrl);

    if (found) {
      // Keep DB in sync if we found a hook GitHub knows about but DB doesn't
      if (module.githubWebhookId !== String(found.id)) {
        await prisma.module.update({
          where: { id: module.id },
          data: { githubWebhookId: String(found.id) },
        });
      }
      return {
        registered: true,
        webhookId: String(found.id),
        webhookUrl,
        active: found.active,
      };
    }

    // GitHub doesn't have a matching hook — clear stale DB entry
    if (module.githubWebhookId) {
      await prisma.module.update({
        where: { id: module.id },
        data: { githubWebhookId: null },
      });
    }

    return { registered: false, webhookUrl };
  } catch (e: any) {
    return {
      registered: Boolean(module.githubWebhookId),
      webhookId: module.githubWebhookId || undefined,
      error: e.message,
    };
  }
}
