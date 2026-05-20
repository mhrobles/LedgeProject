import { existsSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  port: number;
  databaseUrl: string;
  apiKey: string;
  sourceDbPath: string;
  runtimeDbPath: string;
  northwindSha256?: string;
  fxBaseCurrency: string;
  ingestionWindowMinutes: number;
}

export function loadConfig(): AppConfig {
  const port = Number(process.env.PORT ?? 3000);
  const sourceDbPath = resolve(process.env.SOURCE_DB_PATH ?? './northwind.db');
  const runtimeDbPath = resolve(process.env.RUNTIME_DB_PATH ?? './.runtime/northwind.db');
  const northwindSha256 = process.env.NORTHWIND_SHA256?.trim() || undefined;

  return {
    port,
    databaseUrl: process.env.DATABASE_URL ?? 'postgres://ledge:ledge@localhost:5432/ledge',
    apiKey: process.env.API_KEY ?? 'change-me',
    sourceDbPath,
    runtimeDbPath,
    fxBaseCurrency: process.env.FX_BASE_CURRENCY ?? 'USD',
    ingestionWindowMinutes: Number(process.env.INGESTION_WINDOW_MINUTES ?? 15)
    ,
    ...(northwindSha256 ? { northwindSha256 } : {})
  };
}

export function ensureNorthwindRuntimeCopy(config: AppConfig): string {
  if (!existsSync(config.sourceDbPath)) {
    throw new Error(`Northwind source database was not found at ${config.sourceDbPath}`);
  }

  if (config.northwindSha256) {
    const hash = createHash('sha256').update(readFileSync(config.sourceDbPath)).digest('hex');
    if (hash !== config.northwindSha256) {
      throw new Error(`Northwind checksum mismatch. Expected ${config.northwindSha256}, got ${hash}`);
    }
  }

  const runtimeDirectory = dirname(config.runtimeDbPath);
  mkdirSync(runtimeDirectory, { recursive: true });

  if (!existsSync(config.runtimeDbPath)) {
    copyFileSync(config.sourceDbPath, config.runtimeDbPath);
  }

  return config.runtimeDbPath;
}
