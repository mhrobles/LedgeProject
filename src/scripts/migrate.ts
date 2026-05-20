import { loadConfig } from '../config.js';
import { createPool } from '../infra/postgres.js';
import { runMigrations } from '../infra/migrations.js';

const config = loadConfig();
const pool = createPool(config.databaseUrl);

runMigrations(pool)
  .then(() => {
    process.stdout.write('migrations complete\n');
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
