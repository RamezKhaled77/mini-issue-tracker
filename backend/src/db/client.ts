import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema.js";
import { runMigrations } from "./migrate.js";

export interface DbConfig {
  dbPath: string;
  runMigrationsOnOpen?: boolean;
}

export function createDb(config: DbConfig) {
  if (config.dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  }
  const sqlite = new Database(config.dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  if (config.runMigrationsOnOpen) {
    runMigrations(sqlite);
  }
  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof createDb>;