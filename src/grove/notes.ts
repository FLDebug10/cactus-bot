// What Grove reads before it answers a question about the mods, so a small
// model doesn't have to remember to look things up: the Handbook page that
// matches (fields and an example), the Java class that implements that power,
// action or condition (the codec names every real field), and, when the
// question is about the code itself, the best matching source.

import type { FileRecord } from "./knowledge/chunk.ts";
import { conceptHints, conceptPages } from "./knowledge/concepts.ts";
import { examplesOf, KIND_WORDS, lookup, type Schema, type TypeInfo } from "./knowledge/schema.ts";
import type { KnowledgeStore, SearchHit } from "./knowledge/store.ts";
import type { ChatLine } from "./types.ts";

export interface Note {
  title: string;
  url: string;
  body: string;
}

// Words that are about the mods in any sentence, and the names of their classes and ids.
const MOD_WORDS = /\b(?:apoli|origins?|powers?|datapacks?|data ?packs?|addons?|json|mcfunction|conditions?|actions?|keybinds?|resources?|hud|badges?|layers?|modrinth|curseforge|fabric|neoforge|mods?|handbook|docs|crash\w*|errors?|bugs?|install\w*|download\w*|versions?|loader|commands?|1\.20\.1|1\.21\.1|merling|enderian|elytrian|avian|arachnid|shulk|feline|blazeborn|phantom|slimekin|buzzborne)\b|\b[a-z0-9_]+:[a-z0-9_/]+\b|\b[a-z]+(?:_[a-z0-9]+){2,}\b|\b\w+(?:Power|Action|Condition|Mixin|Codec)\b/i;

// Words that are about the mods only when someone is asking for something.
const GAME_WORDS = /\b(?:players?|entit(?:y|ies)|mobs?|hitbox\w*|scale|size|smaller|bigger|tiny|giant|fog|shaders?|particles?|models?|textures?|skins?|attributes?|fly|flying|flight|jump\w*|health|hearts?|damage|tags?|predicates?|ticks?|cooldowns?|cameras?|fov|zoom|glow\w*|invisib\w*|teleport\w*|projectiles?|fireballs?|faster|slower|climb\w*|swim\w*|night vision|hunger|armou?r)\b/i;
const ASKING = /\?|\b(?:how|can|could|would|make|create|add|give|gives|want|need|help|why|what|is there|does|do you|write|build|set|change|fix|turn|let)\b/i;

// Short messages ("players actually, also make it purple") only make sense with
// what the same person said just before.
const SHORT_MESSAGE_WORDS = 14;

// What to look up for this message: the message itself, what it replies to,
// and (when it's short) what the same person said a moment ago. Grove's own
// lines stay out, they may be wrong.
export function notesQuery(target: ChatLine, replyTo: ChatLine | null, transcript: readonly ChatLine[]): string {
  const parts = [target.content];
  if (replyTo !== null && !replyTo.isGrove) parts.push(replyTo.content);
  if (target.content.trim().split(/\s+/).length < SHORT_MESSAGE_WORDS) {
    const earlier = transcript.filter(line => line.authorId === target.authorId && !line.isGrove).slice(-2).reverse();
    for (const line of earlier) parts.push(line.content);
  }
  return parts.join("\n");
}

export function isModQuestion(text: string): boolean {
  return MOD_WORDS.test(text) || (GAME_WORDS.test(text) && ASKING.test(text));
}

// Questions about the code itself, not about how to use a power.
const WANTS_SOURCE = /\b(?:source|code|java|class(?:es)?|mixin|codec|implement\w*|internal\w*|under the hood|stack ?trace|exception|npe|crash\w*|api|register|registry)\b/i;

export function wantsSource(text: string): boolean {
  return WANTS_SOURCE.test(text);
}

const LINKS = /\[([^\]]*)\]\([^)]*\)/g;

// Links and bold marks cost tokens and say nothing a model needs.
function plain(markdown: string): string {
  return markdown.replace(LINKS, "$1").replace(/\*\*/g, "").replace(/[ \t]+\n/g, "\n");
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const edge = cut.lastIndexOf("\n");
  return `${edge > max * 0.6 ? cut.slice(0, edge) : cut}\n…`;
}

const FIELDS_HEADING = /^##[ \t]+(?:fields|parameters|arguments|syntax|options)\b/i;
const DESCRIPTION_MAX = 150;

function rowCells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, "|"));
}

// A table row as one short line. Fields tables become "- `cooldown` (Integer, default 1): what it does".
function rowLine(header: readonly string[], cells: readonly string[]): string {
  const column = (pattern: RegExp) => header.findIndex(name => pattern.test(name));
  const [name, type, fallback, about] = [column(/^(?:field|name|key)s?$/), column(/^type$/), column(/^default$/), column(/^(?:description|purpose|meaning|notes?)$/)];
  if (name === -1 || type === -1) return `- ${cells.filter(cell => cell.length > 0).join(" · ")}`;
  const value = (cells[fallback] ?? "").replace(/^_|_$/g, "").replace(/\*\*/g, "").trim();
  const text = (cells[about] ?? "").replace(/(^|[\s(])_([^_\s][^_]*?)_(?=[\s).,]|$)/g, "$1$2");
  // "—" or an empty cell means "no default", not "required": only a page that says required is believed.
  const given = /required/i.test(value) || /^required\b/i.test(text) ? ", required" : /^optional$/i.test(value) ? ", optional" : fallback === -1 || /^(?:—|-|)$/.test(value) ? "" : `, default ${value}`;
  return `- ${cells[name]} (${cells[type]}${given})${text.length > 0 ? `: ${clip(text, DESCRIPTION_MAX).replace(/\n…$/, "…")}` : ""}`;
}

// Markdown tables as one line per row. Padded tables cost a model three times
// the tokens, and a small model reads lines better than columns. Code is left alone.
export function compactTables(text: string): string {
  const out: string[] = [];
  let header: string[] | null = null;
  let fenced = false;
  for (const line of text.split("\n")) {
    if (line.trimStart().startsWith("```")) fenced = !fenced;
    if (fenced || !line.includes("|") || line.trimStart().startsWith("```")) {
      header = null;
      out.push(line);
      continue;
    }
    const cells = rowCells(line);
    if (cells.every(cell => /^:?-{2,}:?$/.test(cell) || cell.length === 0)) continue;
    if (header === null) {
      header = cells.map(cell => cell.toLowerCase());
      continue;
    }
    out.push(rowLine(header, cells));
  }
  return out.join("\n");
}

// The part of a Handbook page worth reading before writing JSON: what it is,
// every field, and the page's own examples (up to `examples` of them). The
// rest (history, compatibility notes) stays out.
export function condensePage(markdown: string, max: number, examples = 1): string {
  const text = compactTables(plain(markdown));
  const sections = text.split(/\n(?=##[ \t])/);
  const intro = (sections[0] ?? "").trim();
  const fields = sections.find(section => FIELDS_HEADING.test(section))?.trim();
  const found = examplesOf(markdown).slice(0, examples);
  if (fields === undefined && found.length === 0) return clip(sections.slice(0, 3).join("\n\n"), max);

  const head = clip(intro, Math.min(600, Math.floor(max * 0.25)));
  const shown = found.map(example => `Example: ${example.title}\n\`\`\`json\n${example.json}\n\`\`\`${example.caption !== undefined ? `\n${example.caption}` : ""}`);
  // The first example is worth more than the tail of a long fields list.
  const first = shown[0] !== undefined && shown[0].length <= max * 0.4 ? shown[0] : null;
  let room = max - head.length - (first?.length ?? 0) - 4;
  const parts = [head];
  if (fields !== undefined) {
    const body = clip(fields, Math.max(300, room));
    parts.push(body);
    room -= body.length;
  }
  if (first !== null) parts.push(first);
  for (const more of shown.slice(1)) {
    if (more.length > room) break;
    parts.push(more);
    room -= more.length;
  }
  return parts.join("\n\n");
}

// One line per type an example uses, with its real fields, so the model can
// change an example without guessing: "`apoli:heal` (entity action): amount".
export function typeCards(schema: Schema, ids: Iterable<string>, limit = 6): string[] {
  const cards: string[] = [];
  for (const id of new Set(ids)) {
    for (const info of lookup(schema, id)) {
      if (!info.documented || info.meta || cards.length >= limit) continue;
      const fields = [...info.fields.values()].map(field => (field.holds === null || field.holds === "action" || field.holds === "condition" ? field.name : `${field.name} (${KIND_WORDS[field.holds]})`));
      cards.push(`\`${id}\` (${KIND_WORDS[info.kind]}): ${fields.length > 0 ? fields.join(", ") : "no fields"}`);
    }
  }
  return cards;
}

const EXAMPLE_TYPE = /"type"\s*:\s*"((?:apoli|origins):[a-z0-9_]+)"/g;

// A Java file without its package line, imports and blank runs.
export function codeOnly(java: string, max: number): string {
  const lines = java.split(/\r?\n/).filter(line => !/^(?:package|import)\s/.test(line));
  return clip(lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(), max);
}

const SUFFIX_BY_SECTION: ReadonlyArray<readonly [RegExp, string]> = [
  [/\/\d+-powers?\//, "Power"],
  [/-actions\//, "Action"],
  [/-conditions\//, "Condition"],
];

// The class behind a page's type: the one its registration names, else one named
// after the id ("apoli:modify_fog" on a power page is ModifyFogPower).
function classOf(path: string, text: string, schema?: Schema): { source: string; name: string } | null {
  const type = /Type ID:\**\s*`(apoli|origins):([a-z0-9_]+)`/.exec(text);
  if (type === null) return null;
  const registered = schema === undefined ? undefined : lookup(schema, `${type[1]}:${type[2]}`).find(info => info.className !== null)?.className;
  if (registered != null) return { source: type[1]!, name: registered };
  const suffix = SUFFIX_BY_SECTION.find(([pattern]) => pattern.test(path))?.[1];
  if (suffix === undefined) return null;
  const pascal = type[2]!.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join("");
  return { source: type[1]!, name: `${pascal}${suffix}` };
}

// Hex colors a person typed, in the forms power fields use. A small model gets
// these wrong when it converts them itself.
export function colorHints(text: string): Note | null {
  const found = new Set<string>();
  for (const match of text.matchAll(/(?:#|0x)([0-9a-f]{6})\b/gi)) found.add(match[1]!.toLowerCase());
  if (found.size === 0) return null;
  const lines = [...found].slice(0, 3).map(hex => {
    const [r, g, b] = [0, 2, 4].map(at => Number.parseInt(hex.slice(at, at + 2), 16)) as [number, number, number];
    const unit = (channel: number) => (channel / 255).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
    return `#${hex} = rgb(${r}, ${g}, ${b}) = ${unit(r)}, ${unit(g)}, ${unit(b)} as 0 to 1 channels = ${Number.parseInt(hex, 16)} as one number`;
  });
  return { title: "Colors in their message, already converted", url: "", body: lines.join("\n") };
}

export interface GatherOptions {
  // Whether to look at the source even if the question isn't about code.
  alwaysSource?: boolean;
  // Sources to search for code (the primary version of each mod).
  codeSources?: readonly string[];
  // What really exists: the pages of type ids the question names, the fields a
  // page leaves out, and the types its examples use.
  schema?: Schema;
}

// Most requests are for a power, so a power's page beats the action, condition and command pages that share its name.
const POWER_PAGES = /\/\d+-powers\//;
const ACTION_PAGES = /-actions\//;
const CONDITION_PAGES = /-conditions\//;
const COMMAND_PAGES = /\/\d+-commands\//;
const WEAK_MATCH = 0.6;
// News posts only help when someone is asking what changed.
const NEWS = /\b(?:new|news|changes?|changed|updates?|updated|releases?|released|version|changelog|blog|added|since)\b/i;

function preferredPages(query: string): RegExp {
  if (/\bpowers?\b/i.test(query)) return POWER_PAGES;
  if (/\bconditions?\b/i.test(query)) return CONDITION_PAGES;
  if (/\bactions?\b/i.test(query)) return ACTION_PAGES;
  if (/\bcommands?\b|\/apoli\b/i.test(query)) return COMMAND_PAGES;
  return POWER_PAGES;
}

const PAGE_BUDGETS = [2_600, 1_200, 900, 700] as const;
const MAX_PAGES = 4;
const CHUNK_BUDGET = 900;
const CLASS_BUDGET = 1_500;
// snake_case ids people type ("if_else_list"), with or without their namespace.
const NAMED_ID = /\b(?:(apoli|origins):)?([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b|\b(apoli|origins):([a-z][a-z0-9]+)\b/g;

interface Page {
  file: FileRecord | null;
  // A search hit without a file of its own (a blog post section).
  hit?: SearchHit;
}

function sourceNote(hit: SearchHit): Note {
  return { title: `${hit.title} (lines ${hit.startLine}-${hit.endLine})`, url: hit.url, body: `\`\`\`java\n${codeOnly(hit.body, CHUNK_BUDGET)}\n\`\`\`` };
}

// The type a Handbook page documents, as the schema knows it (with what its code adds).
function typeOfPage(schema: Schema | undefined, file: FileRecord): TypeInfo | undefined {
  const id = /Type ID:\**\s*`([a-z0-9_.-]+:[a-z0-9_/.-]+)`/.exec(file.text)?.[1];
  if (schema === undefined || id === undefined) return undefined;
  return lookup(schema, id).find(info => info.url === file.url) ?? lookup(schema, id)[0];
}

// Fields the type's code reads that its page doesn't list, so the model never thinks they don't exist.
function missingFields(info: TypeInfo | undefined, text: string): string {
  if (info === undefined) return "";
  const missing = [...info.fields.values()].filter(field => !text.includes(`\`${field.name}\``));
  if (missing.length === 0) return "";
  return `\nAlso in its code: ${missing.map(field => (field.holds === null || field.holds === "action" || field.holds === "condition" ? `\`${field.name}\`` : `\`${field.name}\` (${KIND_WORDS[field.holds]})`)).join(", ")}`;
}

// The pages of the ids a question names, the power's page first unless it asks about an action or condition.
function namedPages(store: KnowledgeStore, schema: Schema | undefined, query: string): FileRecord[] {
  if (schema === undefined) return [];
  const files: FileRecord[] = [];
  const order = (info: TypeInfo) => (/\bconditions?\b/i.test(query) ? (info.kind.endsWith("_condition") ? 0 : 1) : /\bactions?\b/i.test(query) ? (info.kind.endsWith("_action") ? 0 : 1) : info.kind === "power" ? 0 : 1);
  for (const match of query.matchAll(NAMED_ID)) {
    const namespace = match[1] ?? match[3] ?? "apoli";
    const id = `${namespace}:${match[2] ?? match[4]}`;
    const documented = [...lookup(schema, id)].filter(info => info.documented).sort((a, b) => order(a) - order(b))[0];
    const file = documented === undefined ? null : store.page(documented.url);
    if (file !== null && !files.some(known => known.path === file.path)) files.push(file);
  }
  return files;
}

const HINTS_TITLE = "How this is usually done";

// The checked hints in the notes, one per line.
export function hintsOf(notes: readonly Note[] | null): string[] {
  const body = notes?.find(note => note.title === HINTS_TITLE)?.body ?? "";
  return body.split("\n").map(line => line.replace(/^- /, "").trim()).filter(line => line.length > 0);
}

// The type the notes are mostly about: the first page's Type ID.
export function mainTypeOf(notes: readonly Note[] | null): string | null {
  for (const note of notes ?? []) {
    const id = /Type ID:\**\s*`([a-z0-9_.-]+:[a-z0-9_/.-]+)`/.exec(note.body)?.[1];
    if (id !== undefined) return id;
  }
  return null;
}

// The notes for one message: the Handbook pages for what it names or describes
// (then the best search matches), the real types their examples use, and, when
// the question is about code, the class behind the top page and source matches.
// `null` when the message isn't about the mods.
export function gatherNotes(store: KnowledgeStore, query: string, options: GatherOptions = {}): Note[] | null {
  if (!isModQuestion(query)) return null;
  const schema = options.schema;
  const notes: Note[] = [];
  const hints = conceptHints(query);
  if (hints.length > 0) notes.push({ title: HINTS_TITLE, url: "", body: hints.map(hint => `- ${hint}`).join("\n") });
  const colors = colorHints(query);
  if (colors !== null) notes.push(colors);

  const pages: Page[] = [];
  const add = (page: Page) => {
    const key = page.file?.path ?? page.hit?.url;
    if (pages.length < MAX_PAGES && !pages.some(known => (known.file?.path ?? known.hit?.url) === key)) pages.push(page);
  };
  for (const file of namedPages(store, schema, query)) add({ file });
  for (const reference of conceptPages(query)) {
    const file = store.page(reference);
    if (file !== null) add({ file });
  }

  const found = store.search(query, { kind: "docs", limit: 4, perFile: 1, prefer: preferredPages(query) });
  // A page whose match is far weaker than the best of its kind is noise, not a second opinion.
  // Pages named after the question beat pages that only mention it, so the latter are a fallback.
  const best = (named: boolean) => found.reduce((top, hit) => (hit.named === named ? Math.max(top, -hit.score) : top), 0);
  const [bestNamed, bestText] = [best(true), best(false)];
  const strong = found.filter(hit => -hit.score >= (hit.named ? bestNamed : bestText) * WEAK_MATCH);
  const named = strong.filter(hit => hit.named);
  const pool = named.length > 0 ? named : strong;
  const reference = pool.filter(hit => !hit.path.startsWith("src/content/blog/"));
  const docs = (reference.length > 0 && !NEWS.test(query) ? reference : pool).slice(0, 3);
  // Search results only fill what the named and described pages left.
  const searchRoom = Math.max(pages.length === 0 ? 3 : 1, MAX_PAGES - pages.length);
  for (const hit of docs.slice(0, searchRoom)) {
    const file = hit.path.startsWith("src/content/blog/") ? null : store.file(hit.source, hit.path);
    add(file === null ? { file: null, hit } : { file });
  }

  const shownIds = new Set<string>();
  const usedIds: string[] = [];
  for (const [rank, page] of pages.entries()) {
    const budget = PAGE_BUDGETS[Math.min(rank, PAGE_BUDGETS.length - 1)]!;
    if (page.file === null) {
      notes.push({ title: page.hit!.title, url: page.hit!.url, body: clip(page.hit!.body, rank === 0 ? 1_400 : 700) });
      continue;
    }
    const info = typeOfPage(schema, page.file);
    if (info !== undefined) shownIds.add(info.id);
    const body = condensePage(page.file.text, budget, rank === 0 ? 2 : 1);
    notes.push({ title: page.file.title, url: page.file.url, body: `${body}${missingFields(info, page.file.text)}` });
    // The first page's examples are the ones the answer will be built from.
    if (rank === 0) for (const match of body.matchAll(EXAMPLE_TYPE)) usedIds.push(match[1]!);
  }
  if (schema !== undefined) {
    const cards = typeCards(schema, usedIds.filter(id => !shownIds.has(id)));
    if (cards.length > 0) notes.push({ title: "The other types the first page's examples use, with their real fields", url: "", body: cards.join("\n") });
  }

  if (options.alwaysSource === true || WANTS_SOURCE.test(query) || pages.length === 0) {
    const top = pages[0]?.file;
    const named = top === undefined || top === null ? null : classOf(top.path, top.text, schema);
    const file = named === null ? null : store.classFile(named.source, named.name);
    if (file !== null) notes.push({ title: file.title, url: file.url, body: `\`\`\`java\n${codeOnly(file.text, CLASS_BUDGET)}\n\`\`\`` });
    const shown = new Set(notes.map(note => note.url));
    const code = store.search(query, { kind: "code", limit: 2, perFile: 1, ...(options.codeSources !== undefined ? { source: options.codeSources } : {}) });
    for (const hit of code) if (!shown.has(hit.url)) notes.push(sourceNote(hit));
  }
  return notes;
}
