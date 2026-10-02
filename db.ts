import Database from 'better-sqlite3';
import { Command } from '.';

export async function data(): Promise<any> {
    const db = new Database("data/database.db")

    await db.prepare(`
    CREATE TABLE IF NOT EXISTS suggestions (
        thread TEXT PRIMARY KEY,
        user TEXT
    )
    `).run();
    await db.prepare(`
    CREATE TABLE IF NOT EXISTS modMail (
        user TEXT PRIMARY KEY,
        thread TEXT
    )
    `).run()

    await db.prepare(`
    CREATE TABLE IF NOT EXISTS commands (
        cmd TEXT PRIMARY KEY,
        help TEXT,
        out TEXT
    )
    `).run()

    return db;
}

export type Thread = {
  user: string,
  thread: string
}

export async function getSuggestions(db: any): Promise<Thread[]> {
  if (!(db instanceof Database)) return Promise.reject();

  return Promise.resolve(db.prepare(`
    SELECT * FROM suggestions
    `).all() as Thread[])
}

export async function getModMail(db: any): Promise<Thread[]> {
  if (!(db instanceof Database)) return Promise.reject();

  return Promise.resolve(db.prepare(`
    SELECT * FROM modMail
    `).all() as Thread[])
}

export async function getCommands(db: any): Promise<Command[]> {
  if (!(db instanceof Database)) return Promise.reject();

  return Promise.resolve(db.prepare(`
    SELECT * FROM commands
    `).all() as Command[])
}