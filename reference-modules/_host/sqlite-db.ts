import { DatabaseSync } from 'node:sqlite';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from '@moduleforge/host-types';

/** Db implementation over Node's built-in SQLite (no native deps). */
export function createSqliteDb(file = ':memory:'): Db {
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA foreign_keys = ON');
  const norm = (p: unknown[] = []) => p.map((v) => (v === undefined ? null : v)) as any[];
  return {
    async query<T>(sql: string, params?: unknown[]) {
      return sqlite.prepare(sql).all(...norm(params)) as T[];
    },
    async exec(sql: string, params?: unknown[]) {
      const r = sqlite.prepare(sql).run(...norm(params));
      return { changes: Number(r.changes) };
    },
  };
}

/** Run every migrations/*.sql of a module, in filename order. (Demo-grade: no applied-migration tracking.) */
export async function runMigrations(db: Db, moduleDir: string): Promise<void> {
  const dir = join(moduleDir, 'migrations');
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    const statements = readFileSync(join(dir, f), 'utf8').split(';').map((s) => s.trim()).filter(Boolean);
    for (const s of statements) await db.exec(s);
  }
}
