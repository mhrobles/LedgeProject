import { newDb } from 'pg-mem';
import { AppConfig } from '../src/config.js';
import { PostgresRepository } from '../src/infra/repository.js';
import { runMigrations } from '../src/infra/migrations.js';

export function buildTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 0,
    databaseUrl: 'postgres://test:test@localhost:5432/test',
    apiKey: 'test-key',
    sourceDbPath: './northwind.db',
    runtimeDbPath: './.runtime/northwind.db',
    fxBaseCurrency: 'USD',
    ingestionWindowMinutes: 15,
    ...overrides
  };
}

export async function createTestRepository() {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool();
  await runMigrations(pool as never);
  const repository = new PostgresRepository(pool as never);
  return { pool, repository };
}
