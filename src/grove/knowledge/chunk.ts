// Turns repository files into search chunks. A Handbook page becomes one chunk
// per "##" section, a Java file one chunk per ~60 lines, a data JSON one chunk.
// Each chunk carries the link a person would open to read it in full.

import type { KnowledgeSource } from "../../config.ts";

export interface FileRecord {
  source: string;
  path: string;
  title: string;
  url: string;
  text: string;
}

export interface ChunkRecord {
  source: string;
  kind: "docs" | "code";
  path: string;
  title: string;
  url: string;
  keywords: string;
  body: string;
  startLine: number;
  endLine: number;
}

export interface Prepared {
  file: FileRecord;
  chunks: ChunkRecord[];
}

const HANDBOOK = "https://0vergrown.github.io/Handbook";
const MAX_SECTION = 3_000;
const CODE_WINDOW = 60;
const CODE_OVERLAP = 10;
const MAX_JSON = 3_500;

// Which files of a repository are worth indexing.
export function wanted(source: KnowledgeSource, path: string, size: number): boolean {
  if (size > 400_000) return false;
  if (source.kind === "docs") return /^src\/content\/(docs\/.+|blog\/[^/]+)\.md$/.test(path);
  return /^src\/main\/java\/.+\.java$/.test(path) || /^src\/main\/resources\/data\/.+\.json$/.test(path) || path === "README.md";
}

// GitHub tarballs put everything under one "<repo>-<ref>/" folder.
export function stripRoot(path: string): string {
  const slash = path.indexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}

export function prepare(source: KnowledgeSource, path: string, text: string): Prepared | null {
  if (source.kind === "docs") return handbookFile(source, path, text);
  if (path.endsWith(".java")) return javaFile(source, path, text);
  if (path.endsWith(".json")) return jsonFile(source, path, text);
  if (path.endsWith(".md")) return readmeFile(source, path, text);
  return null;
}

const stripPrefix = (segment: string) => segment.replace(/^\d+-/, "");

// The same rule as the Handbook's own src/lib/content: numeric prefixes drop,
// and a group folder between section and page never enters the URL.
export function handbookUrl(path: string, slug: string | null): string | null {
  const docs = /^src\/content\/docs\/(.+)\.md$/.exec(path);
  if (docs !== null) {
    const parts = docs[1]!.split("/");
    if (parts.length < 3) return null;
    return `${HANDBOOK}/docs/${parts[0]}/${stripPrefix(parts[1]!)}/${stripPrefix(parts[parts.length - 1]!)}/`;
  }
  const blog = /^src\/content\/blog\/(.+)\.md$/.exec(path);
  if (blog !== null) return `${HANDBOOK}/blog/${slug ?? blog[1]!.replace(/^\d{4}-\d{2}-\d{2}-/, "")}/`;
  return null;
}

interface Frontmatter {
  meta: Map<string, string>;
  body: string;
}

function frontmatter(raw: string): Frontmatter {
  const meta = new Map<string, string>();
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (match === null) return { meta, body: raw };
  for (const line of match[1]!.split(/\r?\n/)) {
    const pair = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
    if (pair === null) continue;
    meta.set(pair[1]!, pair[2]!.trim().replace(/^"(.*)"$/, "$1"));
  }
  return { meta, body: raw.slice(match[0].length) };
}

function handbookFile(source: KnowledgeSource, path: string, raw: string): Prepared | null {
  const { meta, body } = frontmatter(raw);
  if (meta.get("draft") === "true") return null;
  const url = handbookUrl(path, meta.get("slug") ?? null);
  if (url === null) return null;

  const title = meta.get("title") ?? /^#\s+(.+)$/m.exec(body)?.[1] ?? path;
  const description = meta.get("description") ?? "";
  const typeId = /Type ID:\s*`([^`]+)`/.exec(body)?.[1] ?? "";
  const aliases = (meta.get("aliases") ?? "").replace(/[[\]"]/g, " ");
  const fileWords = path.split("/").pop()!.replace(/\.md$/, "").replace(/[-_]/g, " ");
  const keywords = [typeId, typeId.replace(/[:_]/g, " "), aliases, fileWords, description].join(" ").replace(/\s+/g, " ").trim();

  const text = body.trim();
  const chunks: ChunkRecord[] = [];
  const sections = text.split(/\n(?=## )/);
  let line = 1;
  for (const section of sections) {
    const heading = /^## (.+)$/m.exec(section)?.[1];
    const sectionTitle = heading === undefined ? title : `${title} › ${heading}`;
    for (const piece of pieces(section, MAX_SECTION)) {
      const lines = piece.split("\n").length;
      chunks.push({ source: source.name, kind: "docs", path, title: sectionTitle, url, keywords, body: piece.trim(), startLine: line, endLine: line + lines - 1 });
      line += lines;
    }
  }
  return { file: { source: source.name, path, title, url, text }, chunks };
}

// Long sections split on blank lines, never inside a code fence.
function pieces(section: string, max: number): string[] {
  if (section.length <= max) return [section];
  const out: string[] = [];
  let current = "";
  let fenced = false;
  for (const paragraph of section.split(/\n\n/)) {
    const fences = (paragraph.match(/```/g) ?? []).length;
    if (!fenced && current.length > 0 && current.length + paragraph.length > max) {
      out.push(current);
      current = "";
    }
    current = current.length === 0 ? paragraph : `${current}\n\n${paragraph}`;
    if (fences % 2 === 1) fenced = !fenced;
  }
  if (current.length > 0) out.push(current);
  return out;
}

function sourceUrl(source: KnowledgeSource, path: string, start?: number, end?: number): string {
  const lines = start === undefined ? "" : end === undefined || end === start ? `#L${start}` : `#L${start}-L${end}`;
  return `https://github.com/${source.repo}/blob/${source.branch}/${path}${lines}`;
}

// "ShaderPowerState" and "action_on_key_press" become words a person would search for.
export function identifierWords(code: string, limit = 80): string {
  const words = new Set<string>();
  for (const identifier of code.match(/[A-Za-z_][A-Za-z0-9_]{3,}/g) ?? []) {
    for (const word of identifier.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").replace(/_/g, " ").toLowerCase().split(" ")) {
      if (word.length >= 3) words.add(word);
    }
    if (words.size >= limit) break;
  }
  return [...words].join(" ");
}

function shortJavaPath(path: string): string {
  return path.replace(/^src\/main\/java\/dev\/overgrown\//, "");
}

// Line numbers as GitHub shows them: a file's final newline doesn't start another line.
function linesOf(text: string): string[] {
  return text.replace(/\r?\n$/, "").split(/\r?\n/);
}

function javaFile(source: KnowledgeSource, path: string, text: string): Prepared {
  const lines = linesOf(text);
  const short = shortJavaPath(path);
  const className = short.split("/").pop()!.replace(/\.java$/, "");
  const pathWords = identifierWords(short.replace(/\//g, " "), 20);
  const chunks: ChunkRecord[] = [];
  const step = CODE_WINDOW - CODE_OVERLAP;
  for (let start = 0; start < lines.length; start += step) {
    const end = Math.min(lines.length, start + CODE_WINDOW);
    const body = lines.slice(start, end).join("\n").trim();
    if (body.length > 0) {
      chunks.push({
        source: source.name,
        kind: "code",
        path,
        title: `${source.name}: ${short}`,
        url: sourceUrl(source, path, start + 1, end),
        keywords: `${className} ${pathWords} ${identifierWords(body)}`,
        body,
        startLine: start + 1,
        endLine: end,
      });
    }
    if (end >= lines.length) break;
  }
  return { file: { source: source.name, path, title: `${source.name}: ${short}`, url: sourceUrl(source, path), text }, chunks };
}

function jsonFile(source: KnowledgeSource, path: string, text: string): Prepared {
  const short = path.replace(/^src\/main\/resources\/data\//, "data/");
  const body = text.length > MAX_JSON ? `${text.slice(0, MAX_JSON)}\n…` : text;
  const lines = linesOf(text).length;
  const url = sourceUrl(source, path);
  return {
    file: { source: source.name, path, title: `${source.name}: ${short}`, url, text },
    chunks: [{ source: source.name, kind: "code", path, title: `${source.name}: ${short}`, url, keywords: identifierWords(`${short.replace(/[/.]/g, " ")} ${text}`, 60), body, startLine: 1, endLine: lines }],
  };
}

function readmeFile(source: KnowledgeSource, path: string, text: string): Prepared {
  const url = sourceUrl(source, path);
  const body = text.length > MAX_SECTION ? text.slice(0, MAX_SECTION) : text;
  return {
    file: { source: source.name, path, title: `${source.name}: README`, url, text },
    chunks: [{ source: source.name, kind: "code", path, title: `${source.name}: README`, url, keywords: `${source.name} readme`, body, startLine: 1, endLine: linesOf(text).length }],
  };
}
