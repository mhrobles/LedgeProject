import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SqlPool } from './sql.js';

export async function runMigrations(pool: SqlPool, migrationsDir = join(process.cwd(), 'migrations')): Promise<void> {
  await pool.query(`
    create table if not exists schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  if (!existsSync(migrationsDir)) {
    return;
  }

  const applied = await pool.query<{ version: string }>('select version from schema_migrations order by version asc');
  const appliedVersions = new Set(applied.rows.map((row) => row.version));
  const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();

  for (const file of files) {
    if (appliedVersions.has(file)) {
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations(version) values ($1)', [file]);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
}
