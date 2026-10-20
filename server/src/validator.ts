import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import semver from 'semver';

export const CONTRACT_VERSION = '1';
export const LEGACY_WARNING = 'legacy: no contract';
/** Host services a module may declare in requires.hostServices. Unknown names only produce a warning. */
export const KNOWN_HOST_SERVICES = ['auth.currentUser', 'db', 'notifications', 'storage', 'email', 'events', 'logger'];

export interface ContractIssue {
  path: string;
  message: string;
}

export interface ContractValidationResult {
  /** true when a module.json was found */
  hasContract: boolean;
  /** true when no module.json exists, or it exists and is valid */
  valid: boolean;
  /** "1" for a valid contract, null for legacy modules */
  contractVersion: string | null;
  errors: ContractIssue[];
  warnings: string[];
  manifest?: any;
}

let cachedValidate: any = null;
function loadSchema(): any {
  const candidates = [
    path.resolve(__dirname, '../../shared/module.schema.json'),
    path.resolve(__dirname, '../../../shared/module.schema.json'),
    path.resolve(process.cwd(), 'shared/module.schema.json'),
    path.resolve(process.cwd(), '../shared/module.schema.json'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return JSON.parse(fs.readFileSync(c, 'utf8'));
  }
  throw new Error('shared/module.schema.json not found');
}
function getSchemaValidator() {
  if (!cachedValidate) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    cachedValidate = ajv.compile(loadSchema());
  }
  return cachedValidate;
}

/** Validate an already-parsed module.json object against the v1 contract (schema + semantic checks). */
export function validateManifestObject(manifest: any): ContractValidationResult {
  const errors: ContractIssue[] = [];
  const warnings: string[] = [];
  const validate = getSchemaValidator();
  if (!validate(manifest)) {
    for (const e of validate.errors || []) {
      const extra = e.keyword === 'additionalProperties' ? ` (${(e.params as any).additionalProperty})` : '';
      errors.push({ path: e.instancePath || '/', message: `${e.message}${extra}` });
    }
    return { hasContract: true, valid: false, contractVersion: null, errors, warnings };
  }

  const id: string = manifest.id;
  const err = (p: string, message: string) => errors.push({ path: p, message });

  (manifest.dependsOn || []).forEach((d: any, i: number) => {
    if (d.id === id) err(`/dependsOn/${i}/id`, 'a module cannot depend on itself');
    if (!semver.validRange(d.versionRange)) err(`/dependsOn/${i}/versionRange`, `invalid semver range "${d.versionRange}"`);
  });
  const depIds = (manifest.dependsOn || []).map((d: any) => d.id);
  if (new Set(depIds).size !== depIds.length) err('/dependsOn', 'duplicate dependency ids');

  const cr = manifest.compatibility?.moduleforge;
  if (cr !== undefined && !semver.validRange(cr)) err('/compatibility/moduleforge', `invalid semver range "${cr}"`);

  (manifest.permissions || []).forEach((p: string, i: number) => {
    if (!p.startsWith(`${id}.`)) err(`/permissions/${i}`, `permission "${p}" must be namespaced with the module id "${id}."`);
  });
  // Event names are `<module_id_with_underscores>.<event>`; only publishes is constrained, consumes may be cross-module.
  const eventPrefix = `${id.replace(/-/g, '_')}.`;
  (manifest.events?.publishes || []).forEach((p: string, i: number) => {
    if (!p.startsWith(eventPrefix)) err(`/events/publishes/${i}`, `published event "${p}" must start with the module id (hyphens as underscores) "${eventPrefix}"`);
  });
  (manifest.events?.consumes || []).forEach((p: string, i: number) => {
    if (p.startsWith(eventPrefix)) warnings.push(`events.consumes[${i}]: module consumes its own event "${p}"`);
  });

  const db = manifest.requires?.database;
  if (db?.prefix) {
    (db.tables || []).forEach((t: string, i: number) => {
      if (!t.startsWith(db.prefix)) err(`/requires/database/tables/${i}`, `table "${t}" must start with prefix "${db.prefix}"`);
    });
  } else if (db?.tables?.length) {
    warnings.push('requires.database.tables declared without a prefix; table names may collide with other modules');
  }

  (manifest.requires?.hostServices || []).forEach((s: string) => {
    if (!KNOWN_HOST_SERVICES.includes(s)) warnings.push(`unknown host service "${s}" (known: ${KNOWN_HOST_SERVICES.join(', ')})`);
  });
  const envNames = (manifest.requires?.env || []).map((e: any) => e.name);
  if (new Set(envNames).size !== envNames.length) err('/requires/env', 'duplicate env var names');

  if (manifest.type === 'backend' && manifest.provides?.uiExports?.length) {
    warnings.push('type is "backend" but provides.uiExports is non-empty');
  }
  if (manifest.type === 'frontend' && manifest.provides?.apiPrefix) {
    warnings.push('type is "frontend" but provides.apiPrefix is set');
  }
  if (!manifest.compatibility?.moduleforge) warnings.push('compatibility.moduleforge not declared');
  if (manifest.contractVersion === undefined) warnings.push(`contractVersion not set; assuming "${CONTRACT_VERSION}"`);

  return {
    hasContract: true,
    valid: errors.length === 0,
    contractVersion: errors.length === 0 ? CONTRACT_VERSION : null,
    errors,
    warnings,
    manifest: errors.length === 0 ? manifest : undefined,
  };
}

/** Parse + validate raw module.json text. */
export function validateManifestText(raw: string): ContractValidationResult {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (e: any) {
    return {
      hasContract: true,
      valid: false,
      contractVersion: null,
      errors: [{ path: '/', message: `module.json is not valid JSON: ${e.message}` }],
      warnings: [],
    };
  }
  return validateManifestObject(parsed);
}

/** Result for a module without module.json. */
export function legacyResult(): ContractValidationResult {
  return { hasContract: false, valid: true, contractVersion: null, errors: [], warnings: [LEGACY_WARNING] };
}

const MODULE_JSON_RE = /(^|\/)module\.json$/;

/** Find module.json in a zip (root, or inside a single top-level folder as GitHub archives do) and validate it. */
export async function validateContractInZip(zip: JSZip): Promise<ContractValidationResult> {
  const files = Object.keys(zip.files).filter((n) => !zip.files[n].dir && MODULE_JSON_RE.test(n));
  if (files.length === 0) return legacyResult();
  // Prefer the shallowest module.json
  files.sort((a, b) => a.split('/').length - b.split('/').length);
  const raw = await zip.files[files[0]].async('string');
  return validateManifestText(raw);
}

export async function validateContractInBuffer(buffer: Buffer): Promise<ContractValidationResult> {
  try {
    return await validateContractInZip(await JSZip.loadAsync(buffer));
  } catch {
    return legacyResult();
  }
}

/** Validate a GitHub-style file tree (path -> text) already extracted from a repo. */
export function validateContractInTree(files: Record<string, string>): ContractValidationResult {
  const names = Object.keys(files).filter((n) => MODULE_JSON_RE.test(n));
  if (names.length === 0) return legacyResult();
  names.sort((a, b) => a.split('/').length - b.split('/').length);
  return validateManifestText(files[names[0]]);
}

export interface ZipValidationResult {
  valid: boolean;
  error?: string;
  message?: string;
  fileCount?: number;
  extractedMetadata?: {
    name?: string;
    slug?: string;
    description?: string;
    author?: string;
    category?: string;
    version?: string;
    technologies?: string[];
  };
  /** Contract validation outcome (legacy result when no module.json). */
  contract?: ContractValidationResult;
  warnings?: string[];
}

export async function validateZipBuffer(buffer: Buffer): Promise<ZipValidationResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (e) {
    return {
      valid: false,
      error: 'Invalid or corrupted ZIP file.',
    };
  }

  const entries = Object.keys(zip.files);
  if (entries.length === 0) {
    return {
      valid: false,
      error: 'ZIP file contains no files.',
    };
  }

  // Count actual files (excluding directory entries)
  let fileCount = 0;
  let moduleJsonEntry: JSZip.JSZipObject | null = null;

  zip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir) {
      fileCount++;
      if (relativePath.endsWith('module.json') && (!moduleJsonEntry || relativePath === 'module.json')) {
        moduleJsonEntry = zipEntry;
      }
    }
  });

  if (fileCount === 0) {
    return {
      valid: false,
      error: 'ZIP file contains no files.',
    };
  }

  // Optional: Try parsing module.json if present to pre-fill metadata
  let extractedMetadata: ZipValidationResult['extractedMetadata'] = undefined;
  if (moduleJsonEntry) {
    try {
      const rawText = await (moduleJsonEntry as JSZip.JSZipObject).async('string');
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === 'object') {
        extractedMetadata = {
          name: typeof parsed.name === 'string' ? parsed.name : undefined,
          slug: typeof parsed.slug === 'string' ? parsed.slug : (typeof parsed.id === 'string' ? parsed.id : undefined),
          description: typeof parsed.description === 'string' ? parsed.description : undefined,
          author: typeof parsed.author === 'string' ? parsed.author : undefined,
          category: typeof parsed.category === 'string' ? parsed.category : undefined,
          version: typeof parsed.version === 'string' ? parsed.version : undefined,
          technologies: Array.isArray(parsed.technologies) ? parsed.technologies : undefined,
        };
      }
    } catch (e) {
      // Parse errors are reported through `contract.errors` below
    }
  }

  const contract = await validateContractInZip(zip);

  // The zip itself stays "valid" for upload purposes; callers decide what to do with contract.errors.
  return {
    valid: true,
    message: 'ZIP file is valid',
    fileCount,
    extractedMetadata,
    contract,
    warnings: contract.warnings,
  };
}
