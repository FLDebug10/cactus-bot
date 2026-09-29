import sqlite3, { Database } from 'sqlite3';
import { open } from 'sqlite';

export async function data(): Promise<any> {
    const db = await open({
        filename: './db.sqlite',
        driver: sqlite3.Database,
    });

    await db.run(`
    CREATE TABLE IF NOT EXISTS suggestions (
        threadID TEXT PRIMARY KEY,
        user TEXT
    );
    `);
    await db.run(`
    CREATE TABLE IF NOT EXISTS modMail (
        user TEXT PRIMARY KEY,
        threadID TEXT
    );
    `)

    return db;
}

export function getTableAsMap<T extends {primary: String}>(
    db: Database,
  tableName: string
): Promise<Map<T['primary'], T>> {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM ${tableName}`, (error, rows: T[]) => {
      if (error) {
        reject(error);
        return;
      }

      const map = new Map<String, T>(
        rows.map((row) => [row.primary, row])
      );

      resolve(map);
    });
  });
}