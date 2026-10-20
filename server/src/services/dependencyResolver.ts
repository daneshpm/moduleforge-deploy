import semver from 'semver';

export interface DependencyRef {
  id: string;
  versionRange: string;
}

/** A module already present in a project. `id` is the module slug (or manifest id). */
export interface ProjectModuleRef {
  id: string;
  /** alternative identifiers (e.g. DB slug and manifest id) */
  aliases?: string[];
  version: string;
  dependsOn?: DependencyRef[];
}

export interface CandidateModule {
  id: string;
  aliases?: string[];
  version: string;
  dependsOn?: DependencyRef[];
}

export interface MissingDependency {
  id: string;
  versionRange: string;
  requiredBy: string;
}

export interface DependencyConflict {
  id: string;
  versionRange: string;
  installedVersion: string;
  /** module whose requirement is violated */
  requiredBy: string;
  reason: string;
}

export interface ResolveResult {
  missing: MissingDependency[];
  conflicts: DependencyConflict[];
}

/** Safely parse a JSON `dependsOn` column into DependencyRef[]. */
export function parseDependsOn(raw: unknown): DependencyRef[] {
  if (Array.isArray(raw)) return raw.filter((d) => d && typeof d.id === 'string');
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((d) => d && typeof d.id === 'string') : [];
  } catch {
    return [];
  }
}

const names = (m: { id: string; aliases?: string[] }) => [m.id, ...(m.aliases || [])];

function satisfies(version: string, range: string): boolean {
  const v = semver.valid(semver.coerce(version));
  return !!v && semver.satisfies(v, range, { includePrerelease: true });
}

/**
 * Check what adding `newModule` to a project containing `projectModules` would break.
 *  - missing: newModule depends on a module that is not in the project
 *  - conflicts: an installed dependency has a version outside the required range, or an
 *    installed module depends on newModule with a range newModule's version does not satisfy
 */
export function resolve(projectModules: ProjectModuleRef[], newModule: CandidateModule): ResolveResult {
  const missing: MissingDependency[] = [];
  const conflicts: DependencyConflict[] = [];

  for (const dep of newModule.dependsOn || []) {
    const installed = projectModules.find((m) => names(m).includes(dep.id));
    if (!installed) {
      missing.push({ id: dep.id, versionRange: dep.versionRange, requiredBy: newModule.id });
    } else if (!semver.validRange(dep.versionRange) || !satisfies(installed.version, dep.versionRange)) {
      conflicts.push({
        id: dep.id,
        versionRange: dep.versionRange,
        installedVersion: installed.version,
        requiredBy: newModule.id,
        reason: `${newModule.id}@${newModule.version} requires ${dep.id} ${dep.versionRange} but ${installed.version} is installed`,
      });
    }
  }

  // Reverse check: installed modules that depend on newModule (e.g. an upgrade/replace)
  for (const pm of projectModules) {
    if (names(pm).some((n) => names(newModule).includes(n))) continue;
    for (const dep of pm.dependsOn || []) {
      if (names(newModule).includes(dep.id) && !satisfies(newModule.version, dep.versionRange)) {
        conflicts.push({
          id: newModule.id,
          versionRange: dep.versionRange,
          installedVersion: newModule.version,
          requiredBy: pm.id,
          reason: `${pm.id}@${pm.version} requires ${dep.id} ${dep.versionRange} but ${newModule.version} would be added`,
        });
      }
    }
  }

  return { missing, conflicts };
}

function manifestIdOf(mod: any): string | null {
  try {
    const id = mod?.moduleJson ? JSON.parse(mod.moduleJson).id : null;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

function aliasesOf(mod: any): string[] {
  const mid = manifestIdOf(mod);
  return [mod.id, ...(mid ? [mid] : [])];
}

/** Convenience: build refs from Prisma ProjectModule rows (with `module` included). */
export function projectModuleRefsFromRows(rows: any[]): ProjectModuleRef[] {
  return rows
    .filter((r) => r.module)
    .map((r) => ({
      id: r.module.slug,
      aliases: aliasesOf(r.module),
      version: r.moduleVersion || r.module.version || '0.0.0',
      dependsOn: parseDependsOn(r.module.dependsOn),
    }));
}

export function candidateFromModule(mod: any, version?: string): CandidateModule {
  return {
    id: mod.slug,
    aliases: aliasesOf(mod),
    version: version || mod.version || '0.0.0',
    dependsOn: parseDependsOn(mod.dependsOn),
  };
}

/** Flatten a resolve() result into human readable warnings. */
export function resolveWarnings(r: ResolveResult): string[] {
  return [
    ...r.missing.map((m) => `Missing dependency: ${m.requiredBy} requires ${m.id} ${m.versionRange}, which is not in this project`),
    ...r.conflicts.map((c) => `Version conflict: ${c.reason}`),
  ];
}
