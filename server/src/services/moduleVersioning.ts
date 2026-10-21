import fs from 'fs';
import semver from 'semver';
import { prisma } from '../prisma';
import { ContractValidationResult } from '../validator';
import { contentHashOfBuffer, highestVersion } from './moduleInstall';

/** Resolve a module by id first, then by slug in a separate query (no OR: ids always win over slugs). */
export async function findModuleByIdOrSlug(idOrSlug: string, extra: Record<string, any> = {}): Promise<any | null> {
  if (typeof idOrSlug !== 'string' || !idOrSlug) return null;
  const byId = await (prisma as any).module.findUnique({ where: { id: idOrSlug }, ...extra });
  if (byId) return byId;
  return (prisma as any).module.findUnique({ where: { slug: idOrSlug }, ...extra });
}

/** Thrown for publish rules (409 collisions, 400 bad input); routes turn it into an HTTP response. */
export class PublishError extends Error {
  constructor(public status: number, message: string, public details?: any) {
    super(message);
  }
}

/** Map a validated contract to the persisted contract columns (all null for legacy modules). */
export function contractColumns(contract: ContractValidationResult) {
  const m = contract.manifest;
  if (!contract.hasContract || !m) {
    return {
      contractVersion: null, dependsOn: null, requiredEnv: null, hostServices: null,
      eventsPublished: null, eventsConsumed: null, permissions: null,
    };
  }
  return {
    contractVersion: contract.contractVersion,
    dependsOn: JSON.stringify(m.dependsOn || []),
    requiredEnv: JSON.stringify(m.requires?.env || []),
    hostServices: JSON.stringify(m.requires?.hostServices || []),
    eventsPublished: JSON.stringify(m.events?.publishes || []),
    eventsConsumed: JSON.stringify(m.events?.consumes || []),
    permissions: JSON.stringify(m.permissions || []),
  };
}

/** The slug a newly published module gets: the manifest id when a valid v1 manifest exists, else the name-derived slug. */
export function slugForPublish(contract: ContractValidationResult, nameSlug: string): { slug: string; forced: boolean } {
  const id = contract.valid ? contract.manifest?.id : undefined;
  return id ? { slug: id, forced: true } : { slug: nameSlug, forced: false };
}

export const slugCollisionMessage = (slug: string) =>
  `A module with id "${slug}" is already published. Publish a new version of it with PUT /api/modules/${slug} (set a new "version" in module.json) or choose a different module id.`;

export interface PublishInput {
  contract: ContractValidationResult;
  /** the archive bytes, when one is being published */
  buffer?: Buffer;
  zipPath?: string | null;
  /** explicit version (request body); the manifest version wins when a manifest exists */
  version?: string;
  changelog?: string | null;
}

export interface PublishResult {
  module: any;
  version: string | null;
  versionRow: any | null;
  versionCreated: boolean;
  slugChanged: boolean;
}

/**
 * Apply a new archive/manifest to an existing module: refresh contract columns, force slug == manifest id,
 * create a ModuleVersion row when the version is new, and reject re-publishing an existing version with
 * different content (409). Throws PublishError.
 */
export async function publishVersion(existing: any, input: PublishInput): Promise<PublishResult> {
  const { contract, buffer } = input;
  if (contract.hasContract && !contract.valid) {
    throw new PublishError(400, 'module.json is invalid', { errors: contract.errors, warnings: contract.warnings });
  }
  const manifest = contract.valid ? contract.manifest : undefined;

  // Slug must equal the manifest id
  let newSlug: string | undefined;
  if (manifest && manifest.id !== existing.slug) {
    const other = await prisma.module.findUnique({ where: { slug: manifest.id } });
    if (other && other.id !== existing.id) {
      throw new PublishError(409, slugCollisionMessage(manifest.id), { slug: manifest.id, conflictingModuleId: other.id });
    }
    newSlug = manifest.id;
  }

  // The manifest version is authoritative; the body version is only used for legacy archives / metadata-only bumps
  const version: string | null = manifest ? manifest.version : (input.version || null);
  if (version !== null && !semver.valid(version)) {
    throw new PublishError(400, `"${version}" is not a valid semver version`);
  }

  const hash = buffer ? await contentHashOfBuffer(buffer) : null;
  let versionRow: any = null;
  let versionCreated = false;

  if (version) {
    versionRow = await prisma.moduleVersion.findUnique({ where: { moduleId_version: { moduleId: existing.id, version } } });
    if (versionRow) {
      if (hash) {
        let stored: string | null = versionRow.contentHash || null;
        if (!stored && versionRow.zipStoragePath && fs.existsSync(versionRow.zipStoragePath)) {
          try { stored = await contentHashOfBuffer(fs.readFileSync(versionRow.zipStoragePath)); } catch { /* unreadable */ }
        }
        if (stored && stored !== hash) {
          throw new PublishError(409, `Version ${version} is already published with different content. Bump the version in module.json to publish a change.`, { version });
        }
        if (!versionRow.contentHash) {
          versionRow = await prisma.moduleVersion.update({ where: { id: versionRow.id }, data: { contentHash: hash } });
        }
      }
    } else {
      const fromArchive = !!buffer;
      versionRow = await prisma.moduleVersion.create({
        data: {
          moduleId: existing.id,
          version,
          zipStoragePath: fromArchive ? (input.zipPath ?? null) : existing.zipStoragePath,
          moduleJson: fromArchive ? (manifest ? JSON.stringify(manifest) : null) : existing.moduleJson,
          ...(fromArchive ? contractColumns(contract) : {
            contractVersion: existing.contractVersion, dependsOn: existing.dependsOn, requiredEnv: existing.requiredEnv,
            hostServices: existing.hostServices, eventsPublished: existing.eventsPublished,
            eventsConsumed: existing.eventsConsumed, permissions: existing.permissions,
          }),
          changelog: input.changelog ?? null,
          contentHash: hash,
        },
      });
      versionCreated = true;
    }
  }

  const all = await prisma.moduleVersion.findMany({ where: { moduleId: existing.id }, select: { version: true } });
  const latest = highestVersion(all.map((v) => v.version));
  const isLatest = !version || !latest || version === latest;

  const data: any = {};
  if (newSlug) data.slug = newSlug;
  if (buffer && isLatest) {
    // Refresh everything derived from the archive/manifest
    if (input.zipPath) data.zipStoragePath = input.zipPath;
    data.moduleJson = manifest ? JSON.stringify(manifest) : null;
    Object.assign(data, contractColumns(contract));
  }
  if (version && isLatest) data.version = version;
  const module = Object.keys(data).length
    ? await prisma.module.update({ where: { id: existing.id }, data, include: { category: true } })
    : existing;

  return { module, version, versionRow, versionCreated, slugChanged: !!newSlug };
}
