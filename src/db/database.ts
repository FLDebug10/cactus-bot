import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type Db = Database.Database;

// Each entry upgrades the schema by one version; `PRAGMA user_version` records
// how far a database has come. Never edit a shipped migration, append a new one.
// The first one keeps the three tables the original bot created byte-for-byte,
// so the live database (registered commands, claims, open modmail) carries over.
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE IF NOT EXISTS suggestions (
    thread TEXT PRIMARY KEY,
    user TEXT
  );
  CREATE TABLE IF NOT EXISTS modMail (
    user TEXT PRIMARY KEY,
    thread TEXT
  );
  CREATE TABLE IF NOT EXISTS commands (
    cmd TEXT PRIMARY KEY,
    help TEXT,
    out TEXT
  );
  CREATE TABLE IF NOT EXISTS grove_users (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nickname TEXT,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    talks INTEGER NOT NULL DEFAULT 0,
    affinity REAL NOT NULL DEFAULT 0,
    likes TEXT NOT NULL DEFAULT '[]',
    last_topic TEXT
  );
  CREATE TABLE IF NOT EXISTS grove_misses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS grove_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS grove_strikes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    at INTEGER NOT NULL,
    kind TEXT NOT NULL,
    text TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS grove_strikes_by_user ON grove_strikes (user_id, kind, at);
  `,
];

export function openDatabase(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  const current = db.pragma("user_version", { simple: true }) as number;

  for (let version = current; version < MIGRATIONS.length; version++) {
    const upgrade = db.transaction(() => {
      db.exec(MIGRATIONS[version]!);
      db.pragma(`user_version = ${version + 1}`);
    });
    upgrade();
  }
}
