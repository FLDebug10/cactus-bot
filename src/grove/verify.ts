// Checks the JSON Grove writes against what really exists. A small model
// invents type ids ("apoli:spawn_entity") and fields ("fog_color") that look
// right and do nothing, which is worse than no answer. Type ids and field names
// can be checked exactly, so Grove gets one chance to fix them, and what it
// still can't back up is left out.

import type { Catalog } from "./knowledge/catalog.ts";

export interface Problems {
  // Type ids that don't exist.
  types: string[];
  // Fields a real type doesn't have, by type.
  fields: Array<{ type: string; names: string[] }>;
}

const FENCE = /```[a-z]*\r?\n([\s\S]*?)```/gi;
const TYPE_VALUE = /"type"\s*:\s*"([^"]+)"/g;
const MOD_NAMESPACES = new Set(["apoli", "origins"]);
// Types whose fields are whatever the datapack author names them.
const FREE_FORM = new Set(["apoli:multiple", "origins:multiple"]);

// Only "apoli:" and "origins:" ids are ours to judge: another mod's ids aren't known here, and a
// bare "type" ("pitch") belongs to a data type such as a model part channel, not to a power.
function ourId(value: string): string | null {
  const id = value.trim().toLowerCase();
  const colon = id.indexOf(":");
  return colon !== -1 && MOD_NAMESPACES.has(id.slice(0, colon)) ? id : null;
}

function* objects(value: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(value)) {
    for (const item of value) yield* objects(item);
  } else if (typeof value === "object" && value !== null) {
    yield value as Record<string, unknown>;
    for (const child of Object.values(value)) yield* objects(child);
  }
}

function parse(block: string): unknown {
  try {
    return JSON.parse(block);
  } catch {
    return undefined;
  }
}

export function blocksIn(text: string): string[] {
  return [...text.matchAll(FENCE)].map(match => match[1]!);
}

export function problemsIn(text: string, catalog: Catalog): Problems {
  const problems: Problems = { types: [], fields: [] };
  if (catalog.types.size === 0) return problems;
  for (const block of blocksIn(text)) {
    for (const match of block.matchAll(TYPE_VALUE)) {
      const id = ourId(match[1]!);
      if (id !== null && !catalog.types.has(id) && !problems.types.includes(id)) problems.types.push(id);
    }
    const parsed = parse(block);
    if (parsed === undefined) continue;
    for (const object of objects(parsed)) {
      const raw = object["type"];
      const id = typeof raw === "string" ? ourId(raw) : null;
      const documented = id === null || FREE_FORM.has(id) ? undefined : catalog.fields.get(id);
      if (id === null || documented === undefined) continue;
      const unknown = Object.keys(object).filter(key => key !== "type" && !documented.has(key) && !catalog.common.has(key));
      if (unknown.length > 0 && !problems.fields.some(entry => entry.type === id && entry.names.join() === unknown.join())) problems.fields.push({ type: id, names: unknown });
    }
  }
  return problems;
}

export function hasProblems(problems: Problems): boolean {
  return problems.types.length > 0 || problems.fields.length > 0;
}

const FIELD_HINT_MAX = 24;

// What to tell the model so it can fix its own answer.
export function correctionFor(problems: Problems, catalog: Catalog): string {
  const lines: string[] = [];
  if (problems.types.length > 0) {
    lines.push(`These type ids don't exist in Apoli or Origins: ${problems.types.join(", ")}. Look up the real ones with search_handbook (or search_source) and use those.`);
  }
  for (const { type, names } of problems.fields) {
    const real = [...(catalog.fields.get(type) ?? [])].filter(name => !catalog.common.has(name)).slice(0, FIELD_HINT_MAX);
    lines.push(`${type} has no ${names.length === 1 ? "field" : "fields"} called ${names.join(", ")}. The Handbook page mentions: ${real.join(", ")}.`);
  }
  return `(Check your json before you send it. ${lines.join(" ")} Fix it, or if the mods can't do this, say so honestly instead of guessing.)`;
}

// The answer without any code block that still uses a type id that doesn't exist.
export function withoutInventedTypes(text: string, catalog: Catalog): { text: string; removed: number } {
  let removed = 0;
  const kept = text.replace(FENCE, (block, body: string) => {
    const invented = [...body.matchAll(TYPE_VALUE)].some(match => {
      const id = ourId(match[1]!);
      return id !== null && !catalog.types.has(id);
    });
    if (invented) removed++;
    return invented ? "" : block;
  });
  return { text: kept.replace(/\n{3,}/g, "\n\n").trim(), removed };
}
