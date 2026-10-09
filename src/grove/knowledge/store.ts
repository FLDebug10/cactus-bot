// Grove's library: every indexed chunk in an SQLite full-text table, plus the
// whole files so a tool can read a page or a class in full. It lives in its
// own database file, because it can always be rebuilt from GitHub.

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { ChunkRecord, FileRecord } from "./chunk.ts";
import { buildSchema, type Schema, type SchemaPage } from "./schema.ts";
import { applySynonyms } from "./synonyms.ts";

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
  // bm25: lower is a better match, and it is negative.
  score: number;
  // A Handbook page whose own title holds a word of the question ("Scale" for "make me smaller").
  named: boolean;
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
  // One source, or several ("apoli", ["apoli", "origins"]). Unset searches them all.
  source?: string | readonly string[];
  limit?: number;
  // Most chunks of one file in the results. Unset allows two.
  perFile?: number;
  // Paths that match are ranked a few places higher than their score alone would.
  prefer?: RegExp;
}

// Stemming, so "entitys", "entities" and "entity" are one word, and "invisible" finds "invisibility".
const TOKENIZER = "porter unicode61 remove_diacritics 2";
// Bumped whenever files are indexed differently (2: pages keep their legacy ids). An older
// index is thrown away at open and downloaded again by the next sync.
const INDEX_VERSION = 2;

const SCHEMA = `
  CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5(
    title, keywords, body,
    source UNINDEXED, kind UNINDEXED, path UNINDEXED, url UNINDEXED, start_line UNINDEXED, end_line UNINDEXED,
    tokenize = '${TOKENIZER}'
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
  actually instead maybe kind sort bit lot able gives giving makes making wants needs
`.trim().split(/\s+/));

// Words that sit in nearly every Handbook title ("Modify Fog (Power Type)"), so a title match on them means nothing.
const TITLE_GENERIC = new Set(`
  power powers player players entity entities type types block blocks item items action actions condition conditions
  data mod mods apoli origin origins mob mobs
  give change modify add set remove apply grant
`.trim().split(/\s+/));

function words(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/<a?:\w+:\d+>|<[@#][!&]?\d+>|https?:\/\/\S+/g, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(word => word.length >= 2 && !STOPWORDS.has(word));
}

// The words to search for: the person's, plus the docs' own words for what they
// described ("smaller" -> "scale"), minus the words that only match by accident.
function searchTerms(text: string): string[] {
  return applySynonyms(text, [...new Set(words(text))].slice(0, 16));
}

// A forgiving FTS5 query: any of the words may match (bm25 ranks pages with
// more of them higher), and identifiers like `apoli:action_on_key_press` or
// `ShaderPower` are also searched as exact phrases.
export function ftsQuery(text: string): string | null {
  const terms = searchTerms(text);
  if (terms.length === 0) return null;
  const phrases = new Set<string>();
  for (const identifier of text.match(/[A-Za-z0-9]+(?:[:_./][A-Za-z0-9]+)+|[a-z]+(?:[A-Z][a-z0-9]+)+|[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+/g) ?? []) {
    const parts = words(identifier.replace(/[:_./]/g, " "));
    if (parts.length >= 2 && parts.length <= 6) phrases.add(parts.join(" "));
  }
  const quoted = [...[...phrases].map(phrase => `"${phrase}"`), ...terms.map(term => `"${term}"`)];
  return quoted.join(" OR ");
}

// Matches only a page's own title, for the words that say something about it.
function titleQuery(text: string): string | null {
  const terms = searchTerms(text).filter(term => !TITLE_GENERIC.has(term));
  return terms.length === 0 ? null : `title : (${terms.map(term => `"${term}"`).join(" OR ")})`;
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
  score: number;
}

export class KnowledgeStore {
  private readonly db: Database.Database;
  private readonly searchStatement;
  private readonly titleStatement;
  private readonly fileStatement;
  private readonly fileByUrl;
  private readonly fileByTitle;
  private readonly filesLike;
  private readonly classStatement;
  private readonly sourceStatement;
  private schemaCache: { key: string; schema: Schema } | null = null;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    const existing = this.db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'sources'").get() !== undefined;
    if (existing && (this.db.pragma("user_version", { simple: true }) as number) < INDEX_VERSION) {
      this.db.exec("DROP TABLE IF EXISTS chunks; DROP TABLE IF EXISTS files; DROP TABLE IF EXISTS sources;");
    }
    this.db.exec(SCHEMA);
    this.db.pragma(`user_version = ${INDEX_VERSION}`);
    this.searchStatement = this.db.prepare(`
      SELECT title, body, snippet(chunks, 2, '', '', ' … ', 28) AS snip, bm25(chunks, 6.0, 3.0, 1.0) AS score, source, kind, path, url, start_line, end_line
      FROM chunks
      WHERE chunks MATCH @query AND (@kind IS NULL OR kind = @kind) AND (@sources IS NULL OR source IN (SELECT value FROM json_each(@sources)))
      ORDER BY score
      LIMIT @limit
    `);
    // The first chunk of each Handbook page (its title has no " › section" in it) whose title has the words.
    this.titleStatement = this.db.prepare(`
      SELECT title, body, snippet(chunks, 2, '', '', ' … ', 28) AS snip, bm25(chunks, 1.0, 0.0, 0.0) AS score, source, kind, path, url, start_line, end_line
      FROM chunks
      WHERE chunks MATCH @query AND kind = 'docs' AND instr(title, ' › ') = 0 AND (@sources IS NULL OR source IN (SELECT value FROM json_each(@sources)))
      ORDER BY score
      LIMIT 40
    `);
    this.fileStatement = this.db.prepare("SELECT source, path, title, url, text FROM files WHERE source = ? AND path = ?");
    this.fileByUrl = this.db.prepare("SELECT source, path, title, url, text FROM files WHERE url = ? OR url = ? LIMIT 1");
    this.fileByTitle = this.db.prepare("SELECT source, path, title, url, text FROM files WHERE source = 'handbook' AND lower(title) = lower(?) LIMIT 1");
    this.filesLike = this.db.prepare("SELECT source, path, title, url, text FROM files WHERE path LIKE @pattern ESCAPE '\\' AND (@sources IS NULL OR source IN (SELECT value FROM json_each(@sources))) ORDER BY length(path) LIMIT 5");
    this.classStatement = this.db.prepare("SELECT source, path, title, url, text FROM files WHERE source = ? AND path LIKE ? ESCAPE '\\' ORDER BY length(path) LIMIT 1");
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
    this.schemaCache = null;
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

  // Best matches first, at most `perFile` from any one file. For the Handbook,
  // pages named after what was asked come before pages that merely mention it
  // (bm25 can't tell them apart: a word that fills a chunk scores the same as
  // one in the title). News posts and mixin classes are real matches but rarely
  // the answer, so they sit several places lower, and `prefer` lifts.
  search(text: string, options: SearchOptions = {}): SearchHit[] {
    const query = ftsQuery(text);
    if (query === null) return [];
    const limit = options.limit ?? 5;
    const perFile = options.perFile ?? 2;
    const sources = options.source === undefined ? null : JSON.stringify(typeof options.source === "string" ? [options.source] : options.source);
    const mixinWanted = /mixin/i.test(text);
    const adjust = (row: ChunkRow, index: number, named: boolean) => {
      const demotion = row.path.startsWith("src/content/blog/") ? 6 : !mixinWanted && row.path.includes("/mixin/") ? 3 : 0;
      return index + demotion - (options.prefer?.test(row.path) === true ? (named ? 20 : 3) : 0);
    };

    const taken = new Map<string, number>();
    const ranked: Array<{ row: ChunkRow; rank: number; named: boolean }> = [];
    const titled = options.kind === "docs" ? titleQuery(text) : null;
    if (titled !== null) {
      const named = this.titleStatement.all({ query: titled, sources }) as ChunkRow[];
      named.forEach((row, index) => {
        taken.set(`${row.source}\0${row.path}`, perFile);
        ranked.push({ row, rank: adjust(row, index, true) - 1_000, named: true });
      });
    }
    const rows = this.searchStatement.all({ query, kind: options.kind ?? null, sources, limit: Math.min(60, Math.max(24, limit * 8)) }) as ChunkRow[];
    rows.forEach((row, index) => {
      const file = `${row.source}\0${row.path}`;
      const count = taken.get(file) ?? 0;
      if (count >= perFile) return;
      taken.set(file, count + 1);
      ranked.push({ row, rank: adjust(row, index, false), named: false });
    });
    ranked.sort((a, b) => a.rank - b.rank);
    return ranked.slice(0, limit).map(({ row, named }) => ({
      source: row.source,
      kind: row.kind,
      path: row.path,
      title: row.title,
      url: row.url,
      body: row.body,
      snippet: row.snip,
      startLine: row.start_line,
      endLine: row.end_line,
      score: row.score,
      named,
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

  // A source file by its link, its path or the end of it ("power/builtin/ShaderPower.java",
  // "ShaderPower"), in one source, several, or all of them.
  findFile(reference: string, source?: string | readonly string[]): FileRecord | null {
    const ref = reference.trim().replace(/^\/+/, "").replace(/#L\d+(-L\d+)?$/, "");
    if (ref.length === 0) return null;
    const github = /github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/.exec(ref);
    if (github !== null) {
      const url = `https://github.com/${github[1]}/${github[2]}/blob/${github[3]}/${github[4]}`;
      const found = this.fileByUrl.get(url, url) as FileRecord | undefined;
      if (found !== undefined) return found;
    }
    const tail = ref.includes(".") ? ref : `${ref}.java`;
    const sources = source === undefined ? null : JSON.stringify(typeof source === "string" ? [source] : source);
    const rows = this.filesLike.all({ pattern: `%${escapeLike(tail)}`, sources }) as FileRecord[];
    return rows.find(row => row.source !== "handbook") ?? null;
  }

  // Every type id by kind, with its documented fields and examples, for checking
  // what Grove writes: the Handbook's pages plus the registration code of the
  // given sources (the main build of each mod). Read once and kept until the
  // next sync changes the library.
  schema(codeSources: readonly string[]): Schema {
    const key = codeSources.join(",");
    if (this.schemaCache?.key !== key) {
      const pages = this.db.prepare("SELECT path, title, url, text FROM files WHERE source = 'handbook' AND path LIKE 'src/content/docs/%'").all() as SchemaPage[];
      const code = this.db
        .prepare("SELECT source, path, text FROM files WHERE source IN (SELECT value FROM json_each(?)) AND path LIKE '%.java'")
        .all(JSON.stringify(codeSources)) as Array<{ source: string; path: string; text: string }>;
      const sources = code.map(row => ({ namespace: row.source.split("-")[0]!, path: row.path, text: row.text }));
      const links = (this.db.prepare("SELECT url FROM files").all() as Array<{ url: string }>).map(row => row.url);
      const data = this.db.prepare("SELECT path, text FROM files WHERE source IN (SELECT value FROM json_each(?)) AND path LIKE 'src/main/resources/data/%'").all(JSON.stringify(codeSources)) as Array<{ path: string; text: string }>;
      this.schemaCache = { key, schema: buildSchema(pages, sources, { links, data }) };
    }
    return this.schemaCache.schema;
  }

  // The Java file of a class by its exact name ("ModifyFogPower"), in one source.
  classFile(source: string, className: string): FileRecord | null {
    return (this.classStatement.get(source, `%/${escapeLike(className)}.java`) as FileRecord | undefined) ?? null;
  }

  close(): void {
    this.db.close();
  }
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, match => `\\${match}`);
}
