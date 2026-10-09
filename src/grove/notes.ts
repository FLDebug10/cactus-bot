// What Grove reads before it answers a question about the mods, so a small
// model doesn't have to remember to look things up: the Handbook page that
// matches (fields and an example), the Java class that implements that power,
// action or condition (the codec names every real field), and, when the
// question is about the code itself, the best matching source.

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

const FIELDS_HEADING = /^## (?:fields|parameters|arguments|syntax|options)\b/i;
const EXAMPLES_HEADING = /^## examples?\b/i;

// The part of a Handbook page worth reading before writing JSON: what it is,
// every field, and the first example. The rest (notes, history) stays out.
export function condensePage(markdown: string, max: number): string {
  const text = plain(markdown);
  const sections = text.split(/\n(?=## )/);
  const intro = sections[0] ?? "";
  const fields = sections.find(section => FIELDS_HEADING.test(section));
  const examples = sections.find(section => EXAMPLES_HEADING.test(section));
  if (fields === undefined && examples === undefined) return clip(sections.slice(0, 3).join("\n\n"), max);

  const parts = [clip(intro.trim(), Math.min(700, Math.floor(max * 0.3)))];
  let room = max - parts[0]!.length;
  if (fields !== undefined) {
    const shown = clip(fields.trim(), Math.max(400, room - 350));
    parts.push(shown);
    room -= shown.length;
  }
  if (examples !== undefined && room > 150) {
    const heading = examples.split("\n", 1)[0]!;
    const fenced = /```[\s\S]*?```/.exec(examples);
    if (fenced !== null) {
      const lead = examples.slice(examples.indexOf("\n") + 1, fenced.index).trim().split("\n").pop() ?? "";
      const block = [heading, lead, fenced[0]].filter(part => part.length > 0).join("\n");
      if (block.length <= room) parts.push(block);
    }
  }
  return parts.join("\n\n");
}

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

// "apoli:modify_fog" on a power page is ModifyFogPower, on an entity action page ModifyFogAction...
function classOf(path: string, text: string): { source: string; name: string } | null {
  const type = /Type ID:\s*`(apoli|origins):([a-z0-9_]+)`/.exec(text);
  if (type === null) return null;
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

const PAGE_BUDGETS = [2_600, 1_300, 600] as const;
const CHUNK_BUDGET = 900;
const CLASS_BUDGET = 1_500;

function pageNote(store: KnowledgeStore, hit: SearchHit, rank: number): { note: Note; text: string } {
  const file = hit.path.startsWith("src/content/blog/") ? null : store.file(hit.source, hit.path);
  if (file === null) return { note: { title: hit.title, url: hit.url, body: clip(hit.body, rank === 0 ? 1_400 : 700) }, text: "" };
  return { note: { title: file.title, url: file.url, body: condensePage(file.text, PAGE_BUDGETS[Math.min(rank, PAGE_BUDGETS.length - 1)]!) }, text: file.text };
}

function sourceNote(hit: SearchHit): Note {
  return { title: `${hit.title} (lines ${hit.startLine}-${hit.endLine})`, url: hit.url, body: `\`\`\`java\n${codeOnly(hit.body, CHUNK_BUDGET)}\n\`\`\`` };
}

// The notes for one message: Handbook pages first, then the class behind the
// top page, then source matches when the question is about code (or nothing in
// the Handbook matched). `null` when the message isn't about the mods.
export function gatherNotes(store: KnowledgeStore, query: string, options: GatherOptions = {}): Note[] | null {
  if (!isModQuestion(query)) return null;
  const notes: Note[] = [];
  const colors = colorHints(query);
  if (colors !== null) notes.push(colors);

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
  let classNote: Note | null = null;
  for (const [rank, hit] of docs.entries()) {
    const { note, text } = pageNote(store, hit, rank);
    notes.push(note);
    if (classNote !== null || rank > 1 || text.length === 0) continue;
    const named = classOf(hit.path, text);
    const file = named === null ? null : store.classFile(named.source, named.name);
    if (file !== null) classNote = { title: file.title, url: file.url, body: `\`\`\`java\n${codeOnly(file.text, CLASS_BUDGET)}\n\`\`\`` };
  }
  if (classNote !== null) notes.splice(colors === null ? 1 : 2, 0, classNote);

  if (options.alwaysSource === true || WANTS_SOURCE.test(query) || docs.length === 0) {
    const shown = new Set(notes.map(note => note.url));
    const code = store.search(query, { kind: "code", limit: 2, perFile: 1, ...(options.codeSources !== undefined ? { source: options.codeSources } : {}) });
    for (const hit of code) if (!shown.has(hit.url)) notes.push(sourceNote(hit));
  }
  return notes;
}
