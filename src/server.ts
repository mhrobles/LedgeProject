import { loadConfig, ensureNorthwindRuntimeCopy } from './config.js';
import { createLogger } from './logger.js';
import { createPool } from './infra/postgres.js';
import { runMigrations } from './infra/migrations.js';
import { PostgresRepository } from './infra/repository.js';
import { createApp } from './app.js';

async function main() {
  const config = loadConfig();
  const logger = createLogger();
  const runtimeDbPath = ensureNorthwindRuntimeCopy(config);
  const pool = createPool(config.databaseUrl);

  await runMigrations(pool);

  const repository = new PostgresRepository(pool);
  const app = await createApp({ config, repository });

  const address = await app.listen({ port: config.port, host: '0.0.0.0' });
  logger.info({ address, runtimeDbPath }, 'Server started');

  const shutdown = async () => {
    await app.close();
    await pool.end();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
