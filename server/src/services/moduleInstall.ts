import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import semver from 'semver';
import { ZipReader, assertZipWithinLimits, loadZip } from './zipLimits';

export interface FileEntry {
  path: string;
  content: Buffer | string;
}

export type FileMap = Record<string, string>;

const sha256 = (data: Buffer | string) => crypto.createHash('sha256').update(data).digest('hex');
const toPosix = (p: string) => p.split(path.sep).join('/');

/** Files of a module archive, with a single wrapping top-level folder (GitHub style) stripped and unsafe paths skipped. */
export async function extractZipFiles(zip: JSZip): Promise<Array<{ path: string; content: Buffer }>> {
  assertZipWithinLimits(zip); // entry count / declared sizes (throws ZipLimitError)
  const reader = new ZipReader(); // enforces per-file and total limits while inflating
  const entries = Object.keys(zip.files);
  const firstParts = new Set<string>();
  const hasRootFile = entries.some((p) => !zip.files[p].dir && !p.includes('/'));
  entries.forEach((p) => {
    const parts = p.split('/');
    if (parts.length > 1) firstParts.add(parts[0]);
  });
  const singleRoot = !hasRootFile && firstParts.size === 1 ? Array.from(firstParts)[0] + '/' : '';
  const out: Array<{ path: string; content: Buffer }> = [];
  for (const rel of entries) {
    const entry = zip.files[rel];
    if (entry.dir) continue;
    let clean = rel;
    if (singleRoot && clean.startsWith(singleRoot)) clean = clean.substring(singleRoot.length);
    if (!clean || clean.includes('..') || clean.startsWith('/') || clean.startsWith('\\')) continue;
    out.push({ path: clean, content: await reader.read(entry) });
  }
  return out;
}

/** path -> sha256 map plus one overall hash (order independent). */
export function fingerprintFiles(files: FileEntry[]): { hash: string; map: FileMap } {
  const map: FileMap = {};
  for (const f of files) map[f.path.replace(/^[/\\]+/, '')] = sha256(f.content);
  return { hash: hashOfMap(map), map };
}

export function hashOfMap(map: FileMap): string {
  const lines = Object.keys(map).sort().map((k) => `${k}\0${map[k]}`);
  return sha256(lines.join('\n'));
}

/** Content hash of an archive: ignores zip metadata (timestamps, compression, wrapping folder). */
export async function contentHashOfBuffer(buffer: Buffer): Promise<string> {
  const zip = await loadZip(buffer);
  return fingerprintFiles(await extractZipFiles(zip)).hash;
}

const SKIP_DIRS = new Set(['.git', 'node_modules']);

/** Fingerprint every file below `dir` (posix relative paths). Missing dir -> empty map. */
export function scanDirFingerprint(dir: string): FileMap {
  const map: FileMap = {};
  if (!fs.existsSync(dir)) return map;
  const walk = (cur: string, rel: string) => {
    for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
      if (SKIP_DIRS.has(ent.name)) continue;
      const full = path.join(cur, ent.name);
      const r = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(full, r);
      else map[toPosix(r)] = sha256(fs.readFileSync(full));
    }
  };
  walk(dir, '');
  return map;
}

export function parseFileMap(raw: unknown): FileMap | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

// ── Versions ────────────────────────────────────────────────────────────────

export function highestVersion(versions: string[]): string | null {
  const valid = versions.filter((v) => semver.valid(v));
  if (valid.length === 0) return null;
  return valid.sort(semver.rcompare)[0];
}

/** Highest published version satisfying `range` (prereleases excluded unless the range asks for them). */
export function resolveRange(versions: string[], range: string): string | null {
  if (!semver.validRange(range)) return null;
  return semver.maxSatisfying(versions.filter((v) => semver.valid(v)), range);
}

export interface VersionRequest {
  version?: string;
  range?: string;
}

/** Choose the published version for an install request: exact `version`, else highest satisfying `range`, else latest. */
export function selectVersion(versions: string[], req: VersionRequest): { version?: string; error?: string; status?: number } {
  if (req.version) {
    if (!versions.includes(req.version)) return { error: `Version ${req.version} is not published`, status: 404 };
    return { version: req.version };
  }
  if (req.range) {
    if (!semver.validRange(req.range)) return { error: `Invalid semver range "${req.range}"`, status: 400 };
    const v = resolveRange(versions, req.range);
    if (!v) return { error: `No published version satisfies ${req.range}`, status: 404 };
    return { version: v };
  }
  const latest = highestVersion(versions);
  return latest ? { version: latest } : { error: 'Module has no published versions', status: 404 };
}

export interface UpdateSummary {
  installed: string;
  latest: string | null;
  pinnedRange: string | null;
  latestSatisfyingPinnedRange: string | null;
  updateAvailable: boolean;
  breaking: boolean;
}

/** Compare an installed version against the published ones. With no pinned range, "^<installed>" is assumed for latestSatisfyingPinnedRange. */
export function summarizeUpdate(installed: string, versions: string[], pinnedRange?: string | null): UpdateSummary {
  const latest = highestVersion(versions);
  const range = pinnedRange && semver.validRange(pinnedRange) ? pinnedRange : semver.valid(installed) ? `^${installed}` : null;
  const sat = range ? resolveRange(versions, range) : null;
  const iv = semver.valid(installed);
  const newer = (v: string | null) => !!(v && iv && semver.gt(v, iv));
  return {
    installed,
    latest,
    pinnedRange: pinnedRange || null,
    latestSatisfyingPinnedRange: sat,
    updateAvailable: newer(latest),
    breaking: !!(latest && iv && newer(latest) && semver.major(latest) > semver.major(iv)),
  };
}

// ── Upgrade planning ────────────────────────────────────────────────────────

export interface Conflict {
  path: string;
  kind: 'modified' | 'deleted' | 'unknown-baseline';
}

export interface FilePlan {
  added: string[];
  changed: string[];
  removed: string[];
  unchanged: string[];
  /** locally edited files the new version does not touch; kept as-is */
  preserved: string[];
  conflicts: Conflict[];
}

/**
 * Compare the project's current files (`local`) with the install baseline and the new version.
 * Conflicts = local edits the upgrade would overwrite/remove (or any difference when there is no baseline).
 */
export function planUpgrade(baseline: FileMap | null, local: FileMap, next: FileMap): FilePlan {
  const plan: FilePlan = { added: [], changed: [], removed: [], unchanged: [], preserved: [], conflicts: [] };
  for (const p of Object.keys(next).sort()) {
    if (!(p in local)) plan.added.push(p);
    else if (local[p] === next[p]) plan.unchanged.push(p);
    else plan.changed.push(p);
  }
  if (!baseline) {
    for (const p of plan.changed) plan.conflicts.push({ path: p, kind: 'unknown-baseline' });
    return plan;
  }
  for (const p of Object.keys(baseline).sort()) {
    const inNext = p in next;
    if (!(p in local)) {
      if (inNext) plan.conflicts.push({ path: p, kind: 'deleted' });
      continue;
    }
    const edited = local[p] !== baseline[p];
    if (!inNext) {
      plan.removed.push(p);
      if (edited) plan.conflicts.push({ path: p, kind: 'modified' });
    } else if (edited && local[p] !== next[p]) {
      if (next[p] === baseline[p]) {
        // module did not change this file; keep the local edit
        plan.preserved.push(p);
        plan.changed = plan.changed.filter((c) => c !== p);
      } else {
        plan.conflicts.push({ path: p, kind: 'modified' });
      }
    }
  }
  return plan;
}

// ── Source files of a published version ─────────────────────────────────────

/** Archive path for a version: its ModuleVersion row, or the module's current archive when no row exists for the current version. */
export function archivePathFor(mod: any, versionRow?: any | null, version?: string): string | null {
  if (versionRow?.zipStoragePath && fs.existsSync(versionRow.zipStoragePath)) return versionRow.zipStoragePath;
  if (!versionRow && mod.zipStoragePath && fs.existsSync(mod.zipStoragePath) && (!version || version === mod.version)) {
    return mod.zipStoragePath;
  }
  return null;
}

/** Load the files of a published module version (archive only). Null when no archive is stored for it. */
export async function loadVersionFiles(mod: any, versionRow?: any | null, version?: string): Promise<FileEntry[] | null> {
  const p = archivePathFor(mod, versionRow, version);
  if (!p) return null;
  return extractZipFiles(await loadZip(fs.readFileSync(p)));
}
