// Grove's library: every indexed chunk in an SQLite full-text table, plus the
// whole files so a tool can read a page or a class in full. It lives in its
// own database file, because it can always be rebuilt from GitHub.

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ChunkRecord, FileRecord } from "./chunk.ts";

export interface SearchHit {
  source: string;
  kind: "docs" | "code";
  path: string;
  title: string;
  url: string;
  body: string;
  snippet: string;
  startLine: number;
  endLine: number;
}

export interface SourceInfo {
  name: string;
  sha: string;
  syncedAt: number;
  files: number;
  chunks: number;
}

export interface SearchOptions {
  kind?: "docs" | "code";
  source?: string;
  limit?: number;
}

const SCHEMA = `
  CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5(
    title, keywords, body,
    source UNINDEXED, kind UNINDEXED, path UNINDEXED, url UNINDEXED, start_line UNINDEXED, end_line UNINDEXED,
    tokenize = 'unicode61 remove_diacritics 2'
  );
  CREATE TABLE IF NOT EXISTS files (
    source TEXT NOT NULL,
    path TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    text TEXT NOT NULL,
    PRIMARY KEY (source, path)
  );
  CREATE TABLE IF NOT EXISTS sources (
    name TEXT PRIMARY KEY,
    sha TEXT NOT NULL,
    synced_at INTEGER NOT NULL,
    files INTEGER NOT NULL,
    chunks INTEGER NOT NULL
  );
`;

// Words that say nothing about what someone is looking for.
const STOPWORDS = new Set(`
  a an the and or but if then so to of in on at by for with about from into over after before i me my you your
  it its is are was were be been being am do does did have has had will would can could should may might must
  this that these those what which who whom whose when where why how not no yes just like really very too also
  much many some any all every each other such only own same than there here hey hi hello please pls thanks
  thank grove know want need make made get got use using used work works working way thing things something
  someone anyone help question ask tell show give let lets im ive dont doesnt cant wont whats hows
`.trim().split(/\s+/));

function words(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/<a?:\w+:\d+>|<[@#][!&]?\d+>|https?:\/\/\S+/g, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(word => word.length >= 2 && !STOPWORDS.has(word));
}

// A forgiving FTS5 query: any of the words may match (bm25 ranks pages with
// more of them higher), and identifiers like `apoli:action_on_key_press` or
// `ShaderPower` are also searched as exact phrases.
export function ftsQuery(text: string): string | null {
  const terms = [...new Set(words(text))].slice(0, 16);
  if (terms.length === 0) return null;
  const phrases = new Set<string>();
  for (const identifier of text.match(/[A-Za-z0-9]+(?:[:_./][A-Za-z0-9]+)+|[a-z]+(?:[A-Z][a-z0-9]+)+|[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+/g) ?? []) {
    const parts = words(identifier.replace(/[:_./]/g, " "));
    if (parts.length >= 2 && parts.length <= 6) phrases.add(parts.join(" "));
  }
  const quoted = [...[...phrases].map(phrase => `"${phrase}"`), ...terms.map(term => `"${term}"`)];
  return quoted.join(" OR ");
}

interface ChunkRow {
  title: string;
  body: string;
  snip: string;
  source: string;
  kind: "docs" | "code";
  path: string;
  url: string;
  start_line: number;
  end_line: number;
}

export class KnowledgeStore {
  private readonly db: Database.Database;
  private readonly searchStatement;
  private readonly fileStatement;
  private readonly fileByUrl;
  private readonly fileByTitle;
  private readonly filesLike;
  private readonly sourceStatement;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(SCHEMA);
    this.searchStatement = this.db.prepare(`
      SELECT title, body, snippet(chunks, 2, '', '', ' … ', 28) AS snip, source, kind, path, url, start_line, end_line
      FROM chunks
      WHERE chunks MATCH @query AND (@kind IS NULL OR kind = @kind) AND (@source IS NULL OR source = @source)
      ORDER BY bm25(chunks, 6.0, 3.0, 1.0)
      LIMIT @limit
    `);
    this.fileStatement = this.db.prepare("SELECT source, path, title, url, text FROM files WHERE source = ? AND path = ?");
    this.fileByUrl = this.db.prepare("SELECT source, path, title, url, text FROM files WHERE url = ? OR url = ? LIMIT 1");
    this.fileByTitle = this.db.prepare("SELECT source, path, title, url, text FROM files WHERE source = 'handbook' AND lower(title) = lower(?) LIMIT 1");
    this.filesLike = this.db.prepare("SELECT source, path, title, url, text FROM files WHERE path LIKE ? ESCAPE '\\' ORDER BY length(path) LIMIT 5");
    this.sourceStatement = this.db.prepare("SELECT name, sha, synced_at AS syncedAt, files, chunks FROM sources WHERE name = ?");
  }

  // Swaps one source's files for a new set in a single transaction, so a search
  // never sees half an update.
  replaceSource(name: string, sha: string, files: readonly FileRecord[], chunks: readonly ChunkRecord[], at: number): void {
    const insertChunk = this.db.prepare(`
      INSERT INTO chunks (title, keywords, body, source, kind, path, url, start_line, end_line)
      VALUES (@title, @keywords, @body, @source, @kind, @path, @url, @startLine, @endLine)
    `);
    const insertFile = this.db.prepare("INSERT OR REPLACE INTO files (source, path, title, url, text) VALUES (@source, @path, @title, @url, @text)");
    const swap = this.db.transaction(() => {
      this.db.prepare("DELETE FROM chunks WHERE source = ?").run(name);
      this.db.prepare("DELETE FROM files WHERE source = ?").run(name);
      for (const file of files) insertFile.run(file);
      for (const chunk of chunks) insertChunk.run(chunk);
      this.db.prepare("INSERT OR REPLACE INTO sources (name, sha, synced_at, files, chunks) VALUES (?, ?, ?, ?, ?)").run(name, sha, at, files.length, chunks.length);
    });
    swap();
  }

  touchSource(name: string, at: number): void {
    this.db.prepare("UPDATE sources SET synced_at = ? WHERE name = ?").run(at, name);
  }

  source(name: string): SourceInfo | null {
    return (this.sourceStatement.get(name) as SourceInfo | undefined) ?? null;
  }

  sources(): SourceInfo[] {
    return this.db.prepare("SELECT name, sha, synced_at AS syncedAt, files, chunks FROM sources ORDER BY name").all() as SourceInfo[];
  }

  isEmpty(): boolean {
    return this.db.prepare("SELECT 1 FROM sources LIMIT 1").get() === undefined;
  }

  search(text: string, options: SearchOptions = {}): SearchHit[] {
    const query = ftsQuery(text);
    if (query === null) return [];
    const rows = this.searchStatement.all({ query, kind: options.kind ?? null, source: options.source ?? null, limit: options.limit ?? 5 }) as ChunkRow[];
    return rows.map(row => ({
      source: row.source,
      kind: row.kind,
      path: row.path,
      title: row.title,
      url: row.url,
      body: row.body,
      snippet: row.snip,
      startLine: row.start_line,
      endLine: row.end_line,
    }));
  }

  // A Handbook page by its link, its slug ("powers/attribute") or its title.
  page(reference: string): FileRecord | null {
    const ref = reference.trim();
    if (ref.length === 0) return null;
    const url = /https?:\/\/\S+/.exec(ref)?.[0];
    if (url !== undefined) {
      const clean = url.replace(/[#?].*$/, "").replace(/\/?$/, "/");
      return (this.fileByUrl.get(clean, clean.slice(0, -1)) as FileRecord | undefined) ?? null;
    }
    const byTitle = this.fileByTitle.get(ref) as FileRecord | undefined;
    if (byTitle !== undefined) return byTitle;
    const slug = ref.replace(/^\/+|\/+$/g, "").replace(/^apoli:|^origins:/, "");
    const like = (this.db.prepare("SELECT source, path, title, url, text FROM files WHERE source = 'handbook' AND url LIKE ? ESCAPE '\\' ORDER BY length(url) LIMIT 1")
      .get(`%/${escapeLike(slug)}/`) as FileRecord | undefined);
    if (like !== undefined) return like;
    return this.search(ref, { kind: "docs", limit: 1 }).map(hit => this.file(hit.source, hit.path)).find(file => file !== null) ?? null;
  }

  file(source: string, path: string): FileRecord | null {
    return (this.fileStatement.get(source, path) as FileRecord | undefined) ?? null;
  }

  // A source file by its path or the end of it ("power/builtin/ShaderPower.java", "ShaderPower").
  findFile(reference: string, source?: string): FileRecord | null {
    const ref = reference.trim().replace(/^\/+/, "").replace(/#L\d+(-L\d+)?$/, "");
    if (ref.length === 0) return null;
    const github = /github\.com\/[^/]+\/([^/]+)\/blob\/[^/]+\/(.+)$/.exec(ref);
    if (github !== null) {
      const found = this.file(github[1]!.toLowerCase(), github[2]!);
      if (found !== null) return found;
    }
    const tail = ref.includes(".") ? ref : `${ref}.java`;
    const rows = this.filesLike.all(`%${escapeLike(tail)}`) as FileRecord[];
    const matching = rows.filter(row => row.source !== "handbook" && (source === undefined || row.source === source));
    return matching[0] ?? null;
  }

  close(): void {
    this.db.close();
  }
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, match => `\\${match}`);
}
