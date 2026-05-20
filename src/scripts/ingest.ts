import { loadConfig, ensureNorthwindRuntimeCopy } from '../config.js';
import { createPool } from '../infra/postgres.js';
import { runMigrations } from '../infra/migrations.js';
import { PostgresRepository } from '../infra/repository.js';
import { runIngestion } from '../pipeline/runIngestion.js';

const config = loadConfig();
const runtimeDbPath = ensureNorthwindRuntimeCopy(config);
const pool = createPool(config.databaseUrl);

async function main() {
  await runMigrations(pool);
  const repository = new PostgresRepository(pool);
  const summary = await runIngestion({
    config,
    repository,
    sourceDbPath: runtimeDbPath
  });

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
