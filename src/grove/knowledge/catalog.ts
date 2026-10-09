// What counts as real in Apoli and Origins, read from the library: every type
// id (the Handbook names them all, and each power, action and condition class is
// named after its id) and the field names each Handbook page documents. Grove
// checks the JSON it writes against this, because a small model will happily
// invent "apoli:spawn_entity" or a "fog_color" field.

export interface Catalog {
  // "apoli:modify_fog"
  types: ReadonlySet<string>;
  // Type id -> every name its Handbook pages mention in backticks or in an example.
  fields: ReadonlyMap<string, ReadonlySet<string>>;
  // Names any power, action or condition may have (the introduction pages).
  common: ReadonlySet<string>;
}

export interface CatalogFile {
  path: string;
  text: string;
}

const TYPE_ID = /Type ID:\s*`((?:apoli|origins):[a-z0-9_]+)`/g;
const ANY_ID = /`((?:apoli|origins):[a-z0-9_]+)`/g;
// Examples use ids the prose never backticks: model part channels ("apoli:pitch"), effect kinds...
const TYPE_IN_EXAMPLE = /"type"\s*:\s*"((?:apoli|origins):[a-z0-9_]+)"/g;
const BACKTICKED = /`([a-z_][a-z0-9_]*)`/g;
const JSON_KEY = /"([a-z_][a-z0-9_]*)"\s*:/g;
const CLASS_PATH = /\/dev\/overgrown\/(apoli|origins)\/.+\/builtin\/(?:.+\/)?([A-Za-z0-9]+)(Power|Action|Condition)\.java$/;

function names(text: string): string[] {
  return [...text.matchAll(BACKTICKED), ...text.matchAll(JSON_KEY)].map(match => match[1]!);
}

// "ActionOnKeyPress" -> "action_on_key_press"
export function snakeCase(pascal: string): string {
  return pascal.replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2").replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

// On every power, action and condition, whatever its page says.
const EVERYWHERE = ["type", "condition", "inverted", "name", "description", "hidden", "badges", "loading_priority"];

export function buildCatalog(docs: Iterable<CatalogFile>, codePaths: Iterable<string>): Catalog {
  const types = new Set<string>();
  const fields = new Map<string, Set<string>>();
  const common = new Set<string>(EVERYWHERE);
  for (const doc of docs) {
    for (const match of doc.text.matchAll(ANY_ID)) types.add(match[1]!);
    for (const match of doc.text.matchAll(TYPE_IN_EXAMPLE)) types.add(match[1]!);
    const own = [...doc.text.matchAll(TYPE_ID)].map(match => match[1]!);
    const documented = names(doc.text);
    for (const id of own) {
      types.add(id);
      const known = fields.get(id) ?? new Set<string>();
      for (const name of documented) known.add(name);
      fields.set(id, known);
    }
    if (doc.path.includes("/01-introduction/")) for (const name of documented) common.add(name);
  }
  for (const path of codePaths) {
    const named = CLASS_PATH.exec(path);
    if (named !== null) types.add(`${named[1]}:${snakeCase(named[2]!)}`);
  }
  return { types, fields, common };
}
