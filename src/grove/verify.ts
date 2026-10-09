// Checks the JSON Grove writes against what really exists in Apoli and Origins.
// A small model invents type ids ("apoli:spawn_entity") and fields
// ("fog_color"), writes actions without a type ("entity_action": "push_entity"),
// and puts real types in the wrong place (an entity action where a bi-entity
// action belongs). It all looks right and does nothing, which is worse than no
// answer, and it can all be checked exactly, because every field that holds an
// action or a condition says which kind (see knowledge/schema.ts). Grove gets
// one chance to fix what's found, and what it still can't back up is left out.

import {
  type CommandInfo,
  type DataInfo,
  type Field,
  type Kind,
  KIND_WORDS,
  type Schema,
  type TypeInfo,
  fieldOn,
  hasTypes,
  known,
  knowsField,
  linkKey,
  lookup,
  lookupIn,
  popularIds,
  resolveHolds,
  similarIds,
} from "./knowledge/schema.ts";

export interface Problem {
  // Where in the json: "bientity_action", "entity_action.actions[1]", "" for the top.
  at: string;
  // What's wrong, said to the model.
  text: string;
  // The id that's made up or in the wrong place, when there is one.
  id?: string;
  // A made-up type (Apoli may not be able to do it at all), or a real one used wrong.
  invented?: boolean;
}

const FENCE = /```([a-z0-9]*)[ \t]*\r?\n([\s\S]*?)```/gi;
const JSON_LANGUAGES = new Set(["", "json", "jsonc", "json5"]);
const TYPE_VALUE = /"type"\s*:\s*"([^"]+)"/g;
const OURS = /^(?:apoli|origins):/;
// A macro call stands in for whatever the macro expands to, so it fits anywhere.
const MACRO = "apoli:macro";
// "apoli:your_power_type", "apoli:<power>", "apoli:example_power": a stand-in written where a real id belongs.
const PLACEHOLDER_ID = /your|example|placeholder|power_?type|_here|namespace|[<>]/;

// What to say about a made-up id: a placeholder needs a real choice, anything else a real alternative.
function madeUp(id: string, otherwise: string): string {
  return PLACEHOLDER_ID.test(id) ? `${id} is a placeholder, not a real type. Put a real type from your notes there (any power can take a "condition"), or show only the part they asked about.` : otherwise;
}
// The fields of an apoli:multiple that belong to the bundle, not to a sub-power.
const MULTIPLE_RESERVED = new Set(["type", "loading_priority", "name", "description", "hidden", "condition", "tags", "skill", "sub_powers", "load_condition", "badges"]);

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The json code blocks in a reply (```json, or ``` with json in it).
export function blocksIn(text: string): string[] {
  return [...text.matchAll(FENCE)].filter(match => JSON_LANGUAGES.has(match[1]!.toLowerCase()) && /^\s*[{["]/.test(match[2]!)).map(match => match[2]!);
}

// Comments removed, read one character at a time so a quote inside a comment
// or a "//" inside a string is never mistaken for the other.
function uncommented(text: string): string {
  let out = "";
  for (let at = 0; at < text.length; at++) {
    const char = text[at]!;
    if (char === '"') {
      let end = at + 1;
      while (end < text.length && text[end] !== '"') end += text[end] === "\\" ? 2 : 1;
      out += text.slice(at, end + 1);
      at = end;
    } else if (char === "/" && text[at + 1] === "/") {
      while (at + 1 < text.length && text[at + 1] !== "\n") at++;
    } else if (char === "/" && text[at + 1] === "*") {
      const end = text.indexOf("*/", at + 2);
      at = end === -1 ? text.length : end + 1;
    } else {
      out += char;
    }
  }
  return out;
}

// Comments, then trailing commas, removed. Strings are left alone.
function withoutComments(text: string): string {
  return uncommented(text).replace(/("(?:[^"\\]|\\.)*")|,(\s*[}\]])/g, (match, string: string | undefined, close: string | undefined) => (string !== undefined ? match : close!));
}

// JSON as models write it: with comments or trailing commas, or a fragment like
// `"entity_action": { ... }` cut out of a bigger file.
export function looseJson(text: string): { value: unknown } | { error: string } {
  const cleaned = withoutComments(text).trim();
  const attempts = [text, cleaned, ...(/^"[^"]+"\s*:/.test(cleaned) ? [`{${cleaned}}`] : [])];
  let error = "";
  for (const attempt of attempts) {
    try {
      return { value: JSON.parse(attempt) };
    } catch (caught) {
      if (error.length === 0) error = caught instanceof Error ? caught.message : String(caught);
    }
  }
  return { error };
}

const AN = /^[aeiou]/i;
function a(kind: Kind): string {
  const words = KIND_WORDS[kind];
  return `${AN.test(words) ? "an" : "a"} ${words}`;
}

function where(at: string): string {
  return at.length === 0 ? "the top object" : `"${at}"`;
}

function child(at: string, key: string | number): string {
  return typeof key === "number" ? `${at}[${key}]` : at.length === 0 ? key : `${at}.${key}`;
}

function list(ids: readonly string[]): string {
  return ids.join(", ");
}

// Real ids of a kind to point the model at: the ones that sound like what it wanted, else the most used.
function suggestions(schema: Schema, kind: Kind, wanted: string): string {
  const similar = similarIds(schema, kind, wanted, 5);
  return list(similar.length > 0 ? similar : popularIds(schema, kind, 5));
}

// "amount, ..., target_action (holds an entity action)", the real fields of a type.
function fieldList(info: TypeInfo, kind: Kind | null): string {
  return [...info.fields.values()]
    .slice(0, 20)
    .map(field => {
      const holds = field.holds === null ? null : kind === null ? null : resolveHolds(field.holds, kind);
      return holds === null ? field.name : `${field.name} (${field.many ? "list of " : ""}${KIND_WORDS[holds]}s)`;
    })
    .join(", ");
}

// The fields of `holder` that take a type of `kind`, with what each does: where a misplaced type would fit.
function fieldsHolding(holder: TypeInfo | null, kind: Kind, context: Kind | null): string[] {
  if (holder === null || context === null) return [];
  return [...holder.fields.values()]
    .filter(field => field.holds !== null && resolveHolds(field.holds, context) === kind)
    .map(field => `"${field.name}"${field.about !== undefined ? ` (${field.about.replace(/\.$/, "").slice(0, 90)})` : ""}`);
}

class Walk {
  readonly problems: Problem[] = [];
  private readonly schema: Schema;

  constructor(schema: Schema) {
    this.schema = schema;
  }

  // A value that has to be a power, action or condition of `kind`.
  slot(value: unknown, kind: Kind, at: string, holder: TypeInfo | null, holderKind: Kind | null): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) => this.slot(item, kind, child(at, index), holder, holderKind));
      return;
    }
    if (typeof value === "string") {
      this.problems.push({ at, text: `${where(at)} must be an object with its own "type" (${a(kind)}), not the text "${value}". Real ones: ${suggestions(this.schema, kind, value)}.` });
      return;
    }
    if (!isObject(value)) return;
    const raw = value["type"];
    if (typeof raw !== "string") {
      const hint = Object.entries(value).filter(([, item]) => typeof item === "string").map(([, item]) => String(item)).join(" ");
      this.problems.push({ at, text: `the object in ${where(at)} has no "type". It has to be ${a(kind)}, for example ${suggestions(this.schema, kind, hint)}.` });
      this.any(value, at);
      return;
    }
    const id = raw.trim().toLowerCase();
    if (id === MACRO) return;
    if (!id.includes(":")) {
      const guess = lookupIn(this.schema, `apoli:${id}`, kind);
      if (guess !== undefined) {
        this.problems.push({ at, id, text: `write the type as "apoli:${id}", with the namespace.` });
        this.fields(value, guess, kind, at);
      } else {
        this.problems.push({ at, id, invented: true, text: `"${raw}" isn't ${a(kind)}. Real ones: ${suggestions(this.schema, kind, id)}.` });
      }
      return;
    }
    if (!OURS.test(id) && lookup(this.schema, id).length === 0) return;
    const info = lookupIn(this.schema, id, kind);
    if (info !== undefined) {
      this.fields(value, info, kind, at);
      return;
    }
    const elsewhere = lookup(this.schema, id)[0];
    if (elsewhere !== undefined) {
      const fits = fieldsHolding(holder, elsewhere.kind, holderKind);
      const fix = fits.length > 0
        ? ` Keep ${id} and move it to ${fits.join(" or ")} on ${holder!.id}.`
        : ` Real ${KIND_WORDS[kind]}s: ${suggestions(this.schema, kind, id)}.`;
      this.problems.push({ at, id, text: `${where(at)} takes ${a(kind)}, but ${id} is ${a(elsewhere.kind)}.${fix}` });
      this.fields(value, elsewhere, elsewhere.kind, at);
      return;
    }
    this.problems.push({ at, id, invented: true, text: madeUp(id, `${id} doesn't exist. Real ${KIND_WORDS[kind]}s that might fit: ${suggestions(this.schema, kind, id)}.`) });
    this.any(value, at, true);
  }

  // A value nothing says the kind of: a whole file, a fragment, a data type's object.
  any(value: unknown, at: string, skipOwnType = false): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) => this.any(item, child(at, index)));
      return;
    }
    if (!isObject(value)) return;
    const raw = value["type"];
    if (!skipOwnType && typeof raw === "string" && raw.includes(":")) {
      const id = raw.trim().toLowerCase();
      const entries = lookup(this.schema, id);
      // Powers never sit inside anything but an apoli:multiple (which checks its own).
      if (at.length > 0 && entries.length > 0 && entries.every(entry => entry.kind === "power")) {
        this.problems.push({ at, id, text: `${id} is a power type, and a power can't go inside ${where(at)}. Make it a power of its own (its own file, or a sub-power of an apoli:multiple).` });
      }
      if (entries.length > 0) {
        const best = this.bestFit(value, entries);
        // Another mod's wrapper with fields of its own, like a Pufferfish's Skills reward:
        // { "type": "apoli:power", "data": { "power": ..., "operation": "remove" } }. Only
        // the types inside it are ours to check.
        const data = value["data"];
        if (isObject(data) && !knowsField(best, "data")) {
          this.any(data, child(at, "data"));
          return;
        }
        this.fields(value, best, entries.length === 1 ? best.kind : null, at);
        return;
      }
      if (OURS.test(id) && !this.schema.mentioned.has(id)) {
        this.problems.push({ at, id, invented: true, text: madeUp(id, `${id} doesn't exist in Apoli or Origins. Look up the real type.`) });
      }
    }
    if (!("type" in value)) this.idLists(value, at);
    for (const [key, item] of Object.entries(value)) {
      if (key === "type") continue;
      const kind = this.schema.slots.get(key);
      if (kind !== undefined) this.slot(item, kind, child(at, key), null, null);
      else this.any(item, child(at, key));
    }
  }

  // An origin's "powers" and a layer's "origins" list ids of the pack's own files or the
  // mods' data, never type ids ("powers": ["apoli:heal"] grants nothing).
  private idLists(value: Json, at: string): void {
    for (const [key, folder, what] of [["powers", "powers", "power"], ["origins", "origins", "origin"]] as const) {
      const list = value[key];
      if (!Array.isArray(list)) continue;
      list.forEach((entry, index) => {
        if (typeof entry !== "string") return;
        const id = entry.trim().toLowerCase();
        if (!OURS.test(id) || this.schema.content.get(id) === folder) return;
        const asType = lookup(this.schema, id)[0];
        const shipped = [...this.schema.content].filter(([, from]) => from === folder).map(([known]) => known).find(known => known.startsWith(id.slice(0, id.indexOf(":") + 1)));
        const instead = `"${key}" lists ${what} ids: the pack's own ${what} files ("<namespace>:<file name>")${shipped !== undefined ? ` or ones Origins ships, like "${shipped}"` : ""}.`;
        this.problems.push({
          at: child(child(at, key), index),
          id,
          invented: asType === undefined,
          text: asType !== undefined ? `"${entry}" is ${typeWords(asType.kind)}, not a ${what}. ${instead}` : `"${entry}" isn't a ${what} that exists. ${instead}`,
        });
      });
    }
  }

  // A value from a fixed list ("comparison": "<=", "operation": "add_base_early"). Old packs write them in capitals.
  private value(item: unknown, field: Field, at: string): void {
    const allowed = field.values === undefined ? undefined : this.schema.enums.get(field.values);
    if (allowed === undefined || typeof item !== "string" || allowed.has(item.toLowerCase())) return;
    this.problems.push({ at, text: `"${item}" can't go in "${field.name}". It takes one of: ${[...allowed].join(", ")}.` });
  }

  // A value of a data type with fields of its own ("hud_render": { "should_render": true }).
  // Only objects are judged: most data types also have a short form (a string, a number).
  data(value: unknown, info: DataInfo, at: string): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) => this.data(item, info, child(at, index)));
      return;
    }
    if (!isObject(value)) return;
    const unknown: string[] = [];
    for (const [key, item] of Object.entries(value)) {
      const field = info.fields.get(key);
      if (field === undefined && !info.names.has(key)) {
        unknown.push(key);
        this.any(item, child(at, key));
        continue;
      }
      const holds = field?.holds === null || field?.holds === undefined || field.holds === "action" || field.holds === "condition" ? null : field.holds;
      const data = field?.dataType === undefined ? undefined : this.schema.dataTypes.get(field.dataType);
      if (field !== undefined) this.value(item, field, child(at, key));
      if (holds !== null) this.slot(item, holds, child(at, key), null, null);
      else if (data !== undefined && data !== info) this.data(item, data, child(at, key));
      else this.any(item, child(at, key));
    }
    if (unknown.length > 0) {
      this.problems.push({ at, text: `${unknown.map(name => `"${name}"`).join(", ")} ${unknown.length === 1 ? "isn't a field" : "aren't fields"} of ${info.title}. Its fields are: ${[...info.fields.keys()].join(", ")}.` });
    }
  }

  // A type that exists in several kinds (apoli:and, apoli:explode): the one its fields fit best.
  private bestFit(value: Json, entries: readonly TypeInfo[]): TypeInfo {
    const misses = (info: TypeInfo) => Object.keys(value).filter(key => key !== "type" && !knowsField(info, key)).length;
    return [...entries].sort((x, y) => misses(x) - misses(y))[0]!;
  }

  // The fields of a known type. `kind` is null when it's unclear which kind of it this is,
  // and then a meta type's "action of the same kind" can't be judged.
  fields(value: Json, info: TypeInfo, kind: Kind | null, at: string): void {
    if (info.id === "apoli:multiple") {
      for (const [key, item] of Object.entries(value)) {
        if (MULTIPLE_RESERVED.has(key)) continue;
        if (isObject(item) && item["type"] === "apoli:macro") continue;
        this.slot(item, "power", child(at, key), null, null);
      }
      return;
    }
    const unknown: string[] = [];
    for (const [key, item] of Object.entries(value)) {
      if (key === "type") continue;
      if (!knowsField(info, key)) {
        unknown.push(key);
        this.any(item, child(at, key));
        continue;
      }
      const field = fieldOn(info, key);
      const holds = field?.holds === null || field === undefined ? null : kind === null && (field.holds === "action" || field.holds === "condition") ? null : resolveHolds(field.holds, kind ?? info.kind);
      const data = field?.dataType === undefined ? undefined : this.schema.dataTypes.get(field.dataType);
      if (field !== undefined) this.value(item, field, child(at, key));
      if (holds !== null) this.slot(item, holds, child(at, key), info, kind ?? info.kind);
      else if (data !== undefined) this.data(item, data, child(at, key));
      else this.any(item, child(at, key));
    }
    if (unknown.length > 0) {
      const fields = fieldList(info, kind);
      this.problems.push({
        at,
        id: info.id,
        text: `${info.id} has no ${unknown.length === 1 ? "field" : "fields"} ${unknown.map(name => `"${name}"`).join(", ")}.${fields.length > 0 ? ` Its fields are: ${fields}.` : ""}`,
      });
    }
  }
}

// A power written with its type under another name ("type_id": "apoli:..."), which loads as nothing.
const MISNAMED_TYPE = /^(?:type_?id|typeid|power_?type|power_?id|kind)$/i;

// The problems in one block of json.
export function problemsInBlock(block: string, schema: Schema): Problem[] {
  const parsed = looseJson(block);
  if ("error" in parsed) {
    const problems: Problem[] = [{ at: "", text: `the json doesn't parse (${parsed.error}). Write complete, valid json.` }];
    for (const match of block.matchAll(TYPE_VALUE)) {
      const id = match[1]!.trim().toLowerCase();
      if (OURS.test(id) && lookup(schema, id).length === 0 && !schema.mentioned.has(id)) problems.push({ at: "", id, invented: true, text: madeUp(id, `${id} doesn't exist in Apoli or Origins.`) });
    }
    return problems;
  }
  const walk = new Walk(schema);
  const root = parsed.value;
  if (isObject(root) && !("type" in root)) {
    const misnamed = Object.keys(root).find(key => MISNAMED_TYPE.test(key));
    if (misnamed !== undefined) walk.problems.push({ at: "", text: `"${misnamed}" isn't a field. A power file starts with "type": "apoli:<power type>", and every action and condition in it has its own "type". Use the shape of the page's example in your notes.` });
  }
  walk.any(root, "");
  return walk.problems;
}

// Ids and links written in the words of a reply, outside its code blocks. Not a
// command (/apoli:clone), a tag (#apoli:x), a file path (apoli:textures/...) or a prefix (apoli:model_).
const PROSE_ID = /(?<![/#\w:.-])((?:apoli|origins):[a-z0-9_]*[a-z0-9])(?![\w/:-]|\.\w)/g;
const CHECKED_LINK = /https?:\/\/(?:0vergrown\.github\.io\/Handbook\/docs\/|github\.com\/0vergrown\/(?:Apoli|Origins|Handbook)\/blob\/)[^\s<>()\]]*/g;

function prose(text: string): string {
  return text.replace(FENCE, " ");
}

// A link that goes nowhere in the library: a page or file the model made up.
function deadLink(url: string, schema: Schema): boolean {
  return schema.links.size > 0 && !schema.links.has(linkKey(url));
}

// A conversion the reply states that doesn't add up: "300 ticks (5 seconds)". 20 ticks are a second.
const TICKS_SECONDS = /(\d+(?:\.\d+)?)\s*ticks?\s*(?:\(\s*|is\s+|are\s+|=\s*|equals\s+)(?:about\s+|~\s*)?(\d+(?:\.\d+)?)\s*(?:seconds?|secs?)\b/gi;
const SECONDS_TICKS = /(\d+(?:\.\d+)?)\s*(?:seconds?|secs?)\s*(?:\(\s*|is\s+|are\s+|=\s*|equals\s+)(?:about\s+|~\s*)?(\d+(?:\.\d+)?)\s*ticks?\b/gi;

function tickProblems(words: string): Problem[] {
  const problems: Problem[] = [];
  const say = (value: number) => String(Math.round(value * 100) / 100);
  const check = (ticks: number, seconds: number) => {
    if (Math.abs(ticks - seconds * 20) < 0.5) return;
    problems.push({ at: "", text: `${say(ticks)} ticks is ${say(ticks / 20)} seconds, not ${say(seconds)}: 20 ticks are 1 second, so ${say(seconds)} seconds is ${say(seconds * 20)} ticks. Fix the number in the json too.` });
  };
  for (const match of words.matchAll(TICKS_SECONDS)) check(Number(match[1]), Number(match[2]));
  for (const match of words.matchAll(SECONDS_TICKS)) check(Number(match[2]), Number(match[1]));
  return problems;
}

// Made-up ids, dead links and conversions that don't add up in what the reply says.
export function proseProblems(text: string, schema: Schema): Problem[] {
  const words = prose(text);
  const problems: Problem[] = tickProblems(words);
  for (const match of new Set([...words.matchAll(PROSE_ID)].map(found => found[1]!.toLowerCase()))) {
    if (known(schema, match)) continue;
    const text = PLACEHOLDER_ID.test(match)
      ? `you wrote ${match}, a made-up id. Something in their own pack is "<namespace>:<name>" (like mypack:fire_punch), never apoli: or origins:.`
      : `you wrote ${match}, which doesn't exist in Apoli or Origins. Use only the types in your notes.`;
    problems.push({ at: "", id: match, invented: true, text });
  }
  for (const url of new Set([...words.matchAll(CHECKED_LINK)].map(found => found[0]))) {
    if (deadLink(url, schema)) problems.push({ at: "", invented: true, text: `the link ${linkKey(url)} doesn't exist. Only link pages and files from your notes.` });
  }
  return problems;
}

// One argument of a command: a selector with its brackets, an NBT compound, a quoted string, or a word.
const ARGUMENT = /@[a-z](?:\[[^\]]*\])?|\{[^}]*\}|"[^"]*"|\S+/gi;
// Code blocks that hold commands. Java, JSON and the rest only look like them ("Origin origin = ...").
const COMMAND_LANGUAGES = new Set(["", "mcfunction", "minecraft", "text", "txt", "plain", "plaintext", "sh", "bash", "shell", "console", "cmd"]);
// "<targets>", "<power namespace>:<power name>", "[position]", "get|set": a usage pattern written out, not a command to run.
const PLACEHOLDER = /[<>]|^\[.*\]$|\|/;
const COORDINATE = /^(?:[~^](?:-?\d*\.?\d+)?|-?\d+(?:\.\d+)?)$/;

// Whether `args` fit a usage like "revoke <targets> <power> from <source>" or "orb [<targets>] <layer> [<origin>]".
function fits(usage: readonly string[], args: readonly string[], at = 0, given = 0): boolean {
  if (at === usage.length) return given === args.length;
  const part = usage[at]!;
  if (part === "…" || part === "...") return true;
  const optional = /^\[.*\]$/.test(part);
  // Pages write optional arguments as "[<origin>]" and as "[origin]", so a bracketed word takes any value.
  // A literal may be a choice of words: "up|down".
  const literals = optional || /^<.*>$/.test(part) ? null : part.replace(/\\/g, "").toLowerCase().split("|");
  const takes = given < args.length && (literals === null || literals.includes(args[given]!.toLowerCase())) && fits(usage, args, at + 1, given + 1);
  // A position is three words: "~ ~1 ~".
  const position = literals === null && /pos|location|coord/i.test(part) && args.slice(given, given + 3).filter(arg => COORDINATE.test(arg)).length === 3 && fits(usage, args, at + 1, given + 3);
  return takes || position || (optional && fits(usage, args, at + 1, given));
}

// A type id where a usage wants a power id ("/power revoke @s apoli:heal"): the value at "<power>",
// when every part before it in the usage is required, so the position is certain.
function typeAsPower(usage: readonly string[], args: readonly string[], schema: Schema): string | null {
  const at = usage.indexOf("<power>");
  if (at === -1 || usage.slice(0, at).some(part => /^\[/.test(part))) return null;
  const id = args[at]?.toLowerCase();
  if (id === undefined || !OURS.test(id) || schema.content.get(id) === "powers") return null;
  const asType = lookup(schema, id)[0];
  return asType === undefined ? null : `"${args[at]}" is ${typeWords(asType.kind)}, not a power id. Use the id of a power file: "<namespace>:<file name>".`;
}

// "an entity action type", "a power type".
function typeWords(kind: Kind): string {
  return kind === "power" ? a(kind) : `${a(kind)} type`;
}

// What's wrong with one command, or null when it's written the way its page (or its code) says.
// A mention in the words ("use `/origin set`") only has to name a real sub-command.
function commandProblem(command: CommandInfo, args: readonly string[], mention: boolean, schema: Schema): string | null {
  if (args.length === 0 || args.some(arg => PLACEHOLDER.test(arg))) return null;
  const usages = command.usages.map(usage => usage.split(/\s+/));
  const shown = (list: ReadonlyArray<readonly string[]>) => list.map(usage => `/${command.names[0]} ${usage.join(" ")}`).join(" or ");
  // A command whose usages start with an argument has no sub-commands to name.
  if (usages.some(usage => /^[<[]/.test(usage[0]!))) return mention || usages.some(usage => fits(usage, args)) ? null : `that isn't how it's written. It's ${shown(usages)}.`;
  const sub = args[0]!.toLowerCase();
  const same = usages.filter(usage => usage[0]!.replace(/\\/g, "").toLowerCase().split("|").includes(sub));
  if (same.length === 0) {
    if (command.literals.has(sub) || command.takesArgument) return null;
    return `/${command.names[0]} has no "${args[0]}". Its sub-commands are: ${[...new Set(usages.map(usage => usage[0]!))].join(", ")}.`;
  }
  if (mention && args.length === 1) return null;
  const fitting = same.find(usage => fits(usage, args));
  if (fitting !== undefined) return typeAsPower(fitting, args, schema);
  return `that isn't how "${args[0]}" is written. It's ${shown(same)}.`;
}

// The command lines in a reply: lines of its command code blocks, the "command" of an
// apoli:execute_command in its json, and `/inline` mentions.
function commandLines(text: string): Array<{ line: string; mention: boolean }> {
  const lines: Array<{ line: string; mention: boolean }> = [];
  for (const match of text.matchAll(FENCE)) {
    if (/^\s*[{["]/.test(match[2]!)) {
      for (const command of match[2]!.matchAll(/"command"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) lines.push({ line: command[1]!.replace(/\\"/g, '"'), mention: false });
      continue;
    }
    if (!COMMAND_LANGUAGES.has(match[1]!.toLowerCase())) continue;
    for (const line of match[2]!.split("\n")) lines.push({ line, mention: false });
  }
  for (const match of prose(text).matchAll(/`(\/[^`\n]+)`/g)) lines.push({ line: match[1]!, mention: true });
  return lines;
}

// Commands of the mods written wrong: a sub-command that doesn't exist, or arguments that don't fit.
export function commandProblems(text: string, schema: Schema): Problem[] {
  if (schema.commands.size === 0) return [];
  const problems: Problem[] = [];
  for (const { line: raw, mention } of commandLines(text)) {
    const line = raw.trim().replace(/^\//, "");
    const [name, ...args] = line.match(ARGUMENT) ?? [];
    const command = name === undefined ? undefined : schema.commands.get(name);
    const problem = command === undefined ? null : commandProblem(command, args, mention, schema);
    if (problem !== null) problems.push({ at: "", text: `/${line}: ${problem}` });
  }
  return problems;
}

// Every problem in a reply: its json, its commands, and the ids and links it mentions.
export function problemsIn(text: string, schema: Schema): Problem[] {
  if (!hasTypes(schema)) return [];
  const blocks = blocksIn(text);
  const inJson = blocks.flatMap((block, index) => problemsInBlock(block, schema).map(problem => (blocks.length > 1 ? { ...problem, at: `block ${index + 1}${problem.at.length > 0 ? ` ${problem.at}` : ""}` } : problem)));
  return [...inJson, ...commandProblems(text, schema), ...proseProblems(text, schema)];
}

// The reply without the sentences that name a made-up id or a dead link (code blocks are left to withoutBadBlocks).
export function withoutInventedProse(text: string, schema: Schema): { text: string; removed: number } {
  let removed = 0;
  const bad = (sentence: string) =>
    [...sentence.matchAll(PROSE_ID)].some(match => !known(schema, match[1]!.toLowerCase())) ||
    [...sentence.matchAll(CHECKED_LINK)].some(match => deadLink(match[0], schema)) ||
    commandProblems(sentence, schema).length > 0;
  const parts = text.split(/(```[\s\S]*?```)/);
  const kept = parts.map(part => {
    if (part.startsWith("```")) return part;
    return part
      .split("\n")
      .map(line => {
        const sentences = line.split(/(?<=[.!?])\s+/);
        const good = sentences.filter(sentence => !bad(sentence));
        removed += sentences.length - good.length;
        return good.join(" ");
      })
      .join("\n");
  });
  return { text: kept.join("").replace(/\n{3,}/g, "\n\n").trim(), removed };
}

// What to tell the model so it can fix its own answer. Only a made-up type may
// mean Apoli can't do it at all: a real type in the wrong place just moves.
export function correctionFor(problems: readonly Problem[]): string {
  const lines = problems.slice(0, 8).map(problem => `- ${problem.at.length > 0 ? `at ${problem.at}: ` : ""}${problem.text}`);
  const invented = problems.some(problem => problem.invented === true);
  const after = invented
    ? "Fix them with real types and fields only. If no real type does what they asked, say so instead of guessing."
    : "Fix only these and keep the rest of your answer (the same power type, what it does and when) as it was.";
  return `The json has mistakes:\n${lines.join("\n")}\n${after}`;
}

// Made-up ids in a block that doesn't parse. Without them it may only be missing a comma.
function inventedIds(block: string, schema: Schema): boolean {
  return [...block.matchAll(TYPE_VALUE)].some(match => {
    const id = match[1]!.trim().toLowerCase();
    return OURS.test(id) && lookup(schema, id).length === 0 && !schema.mentioned.has(id);
  });
}

// Whether a code block still has mistakes: json that doesn't hold up, or commands written wrong.
function badBlock(language: string, body: string, schema: Schema): boolean {
  if (!JSON_LANGUAGES.has(language.toLowerCase()) || !/^\s*[{["]/.test(body)) return commandProblems(`\`\`\`${language}\n${body}\`\`\``, schema).length > 0;
  const parsed = looseJson(body);
  return "error" in parsed ? inventedIds(body, schema) : problemsInBlock(body, schema).length > 0;
}

// The answer without the code blocks that still have mistakes in them, and without the
// sentence that led into each one ("here's how that looks:").
export function withoutBadBlocks(text: string, schema: Schema): { text: string; removed: number } {
  let removed = 0;
  let out = "";
  let last = 0;
  for (const match of text.matchAll(FENCE)) {
    out += text.slice(last, match.index);
    last = match.index + match[0].length;
    if (!badBlock(match[1]!, match[2]!, schema)) {
      out += match[0];
      continue;
    }
    removed++;
    out = out.replace(/(^|[.!?)"]\s+|\n)[^.!?\n]{0,160}:\s*$/, "$1");
  }
  out += text.slice(last);
  return { text: out.replace(/\n{3,}/g, "\n\n").trim(), removed };
}
