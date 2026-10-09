// What really exists in Apoli and Origins, read from the library, so the JSON
// Grove writes can be checked: every type id and the kind it belongs to (a
// power, an entity action, a bi-entity condition...), the fields each type's
// Handbook page lists, which of those fields hold another action or condition
// and of which kind, and the page's own examples. A small model mixes these up
// ("apoli:apply_effect" in a bientity_action, an untyped "entity_action":
// "push_entity"), and every one of those mistakes can be caught here.
//
// Ids come from two places: the Handbook (one page per type, with the legacy
// ids it still answers to) and the mods' registration code
// (`ActionTypes.ENTITY.register(...)`, `PowerTypeRegistry.register(...)` and
// their `addTypeAlias(...)`), which also knows types the Handbook hasn't caught
// up with. Fields only come from the Handbook, so a type without a page is
// never judged on its fields.

export type Kind =
  | "power"
  | "entity_action"
  | "bientity_action"
  | "block_action"
  | "item_action"
  | "entity_condition"
  | "bientity_condition"
  | "block_condition"
  | "item_condition"
  | "damage_condition"
  | "biome_condition"
  | "fluid_condition";

export const ACTION_KINDS: readonly Kind[] = ["entity_action", "bientity_action", "block_action", "item_action"];
export const CONDITION_KINDS: readonly Kind[] = ["entity_condition", "bientity_condition", "block_condition", "item_condition", "damage_condition", "biome_condition", "fluid_condition"];

// "a bi-entity action", for sentences the model reads.
export const KIND_WORDS: Readonly<Record<Kind, string>> = {
  power: "power type",
  entity_action: "entity action",
  bientity_action: "bi-entity action",
  block_action: "block action",
  item_action: "item action",
  entity_condition: "entity condition",
  bientity_condition: "bi-entity condition",
  block_condition: "block condition",
  item_condition: "item condition",
  damage_condition: "damage condition",
  biome_condition: "biome condition",
  fluid_condition: "fluid condition",
};

// What a field holds: a power, an action or condition of one kind, or, on the
// meta types (which work in every kind), "an action / a condition of the same
// kind as the place this one sits in".
export type Holds = Kind | "action" | "condition";

export interface Field {
  name: string;
  // The type column as the Handbook writes it: "Bi-entity Action Type".
  type: string;
  holds: Holds | null;
  // A list of them ("Array of Action Types").
  many: boolean;
  required: boolean;
  // The description column: "Action run on the target (the entity that was hit)."
  about?: string;
  // The data type it holds, by its Handbook page ("hud-render"), when it has fields of its own.
  dataType?: string;
  // The data type page that lists the only values it takes ("comparison").
  values?: string;
}

// A command and the ways its sub-commands are written: "set <targets> <layer> <origin>".
export interface CommandInfo {
  // How it's typed: "origin", "apoli:power", "power".
  names: readonly string[];
  title: string;
  url: string;
  usages: readonly string[];
  // Every word its code knows (`Commands.literal("query")`), for sub-commands the page leaves out.
  literals: ReadonlySet<string>;
  // Its code also takes an argument right after the name (`/disguise @s creeper`), so the
  // first word isn't always a sub-command.
  takesArgument: boolean;
}

// A data type with fields of its own (Hud Render, Attribute Modifier...), as its Handbook page lists them.
export interface DataInfo {
  slug: string;
  title: string;
  url: string;
  fields: ReadonlyMap<string, Field>;
  names: ReadonlySet<string>;
}

// Data types that are one of a list of values, checked when their page lists them in a table.
const ENUM_DATA = new Set(["comparison", "attribute-modifier-operation"]);

// Data types that are values, or whose shape is too open to check field by field
// (a text component, an item stack's components, NBT).
const UNCHECKED_DATA = new Set([
  "array", "boolean", "float", "integer", "string", "identifier", "expression", "object", "nbt", "text-component",
  "item-stack", "positioned-item-stack", "ingredient", "crafting-recipe", "particle-effect", "food-component",
  "entity-type-tag-like", "comparison", "space", "hand", "easing", "unit", "shape-type", "render-type",
  "attribute-modifier-operation", "destruction-type", "fluid-handling", "heightmap-type", "process-mode",
  "container-type", "inventory-type", "player-model-type", "body-part", "action-result", "set-iteration", "stat", "team", "scale-type",
]);

export interface Example {
  title: string;
  json: string;
  // The sentence right after the block that says what it does ("This example takes 2 hearts away").
  caption?: string;
}

export interface TypeInfo {
  id: string;
  kind: Kind;
  // A meta type exists in every kind of its family, and is described once.
  meta: boolean;
  title: string;
  url: string;
  summary: string;
  // From the fields table. Empty for a type with no Handbook page.
  fields: ReadonlyMap<string, Field>;
  // Every name the page mentions, in backticks or as a key in an example. A
  // field is only called unknown when the page never mentions it at all.
  names: ReadonlySet<string>;
  examples: readonly Example[];
  documented: boolean;
  // The Java class its registration names ("ModifyDamagePower"), when the code was read.
  className: string | null;
}

export interface Schema {
  // Type id or legacy id -> the type, once per kind it exists in (apoli:explode is three).
  types: ReadonlyMap<string, readonly TypeInfo[]>;
  // Kind -> the ids of its documented types, for suggesting real ones.
  byKind: ReadonlyMap<Kind, readonly string[]>;
  // Every id the Handbook writes anywhere. Data types have ids of their own
  // ("apoli:pitch" for a model part channel) that are no power, action or condition.
  mentioned: ReadonlySet<string>;
  // How often each id is used in the Handbook's examples: the common ones first when suggesting.
  uses: ReadonlyMap<string, number>;
  // Field names that hold the same kind on every type that has them ("entity_action"),
  // for json cut out of a bigger file.
  slots: ReadonlyMap<string, Kind>;
  // Ids with a Handbook page that are no power, action or condition: badge types like
  // "origins:tooltip", which must not be read as the apoli:tooltip power.
  other: ReadonlySet<string>;
  // Every link Grove may send: Handbook pages and source files, without anchors.
  links: ReadonlySet<string>;
  // Ids of the mods' own data, which people talk about and aren't types: the
  // origins:phantomize power, the origins:human origin. Each with the data folder
  // it's from ("powers", "origins", "tags"), "" when it's only used, not defined.
  content: ReadonlyMap<string, string>;
  // Data types with fields of their own, by page ("hud-render").
  dataTypes: ReadonlyMap<string, DataInfo>;
  // Data types that are one of a fixed list of values, by page ("comparison" -> "<", "<=", ...).
  enums: ReadonlyMap<string, ReadonlySet<string>>;
  // Commands by every name they're typed with ("origin", "apoli:power", "power").
  commands: ReadonlyMap<string, CommandInfo>;
}

export interface SchemaExtras {
  // Links of every file in the library.
  links?: Iterable<string>;
  // The mods' own data files ("src/main/resources/data/origins/powers/phantomize.json"):
  // their ids, and the ids they use ("tag": "origins:ignore_diet"), are real.
  data?: Iterable<{ path: string; text: string }>;
}

// A link as it's kept: no anchor or query, one trailing slash on Handbook pages.
export function linkKey(url: string): string {
  const bare = url.replace(/[#?].*$/, "").replace(/[).,!?:;'"`]+$/, "");
  return bare.includes("/Handbook/") ? bare.replace(/\/?$/, "/") : bare;
}

// "src/main/resources/data/origins/powers/phantomize.json" -> origins:phantomize from "powers",
// "src/main/resources/data/origins/tags/item/ignore_diet.json" -> origins:ignore_diet from "tags"
export function dataId(path: string): { id: string; folder: string } | null {
  const tag = /^src\/main\/resources\/data\/([a-z0-9_.-]+)\/tags\/[a-z0-9_]+\/(.+)\.json$/.exec(path);
  if (tag !== null) return { id: `${tag[1]}:${tag[2]}`, folder: "tags" };
  const match = /^src\/main\/resources\/data\/([a-z0-9_.-]+)\/([a-z0-9_]+)\/(.+)\.json$/.exec(path);
  return match === null ? null : { id: `${match[1]}:${match[3]}`, folder: match[2]! };
}

export interface SchemaPage {
  path: string;
  title: string;
  url: string;
  text: string;
}

export interface SchemaSource {
  // "apoli" or "origins": the namespace of `id("...")` in that mod's code.
  namespace: string;
  path: string;
  text: string;
}

export function familyOf(kind: Kind): "power" | "action" | "condition" {
  return kind === "power" ? "power" : kind.endsWith("_action") ? "action" : "condition";
}

// The condition kind that goes with an action kind (an entity action's if_else tests an entity condition).
export function conditionFor(kind: Kind): Kind {
  switch (kind) {
    case "entity_action":
      return "entity_condition";
    case "bientity_action":
      return "bientity_condition";
    case "block_action":
      return "block_condition";
    case "item_action":
      return "item_condition";
    default:
      return kind;
  }
}

// The kind a field holds, on a type that sits in `context`.
export function resolveHolds(holds: Holds, context: Kind): Kind | null {
  if (holds === "action") return familyOf(context) === "action" ? context : null;
  if (holds === "condition") return familyOf(context) === "power" ? "entity_condition" : conditionFor(context);
  return holds;
}

const TITLE_KINDS: ReadonlyArray<readonly [RegExp, Kind | "meta_action" | "meta_condition"]> = [
  [/\(power type\)$/i, "power"],
  [/\(bi-?entity action type\)$/i, "bientity_action"],
  [/\(entity action type\)$/i, "entity_action"],
  [/\(block action type\)$/i, "block_action"],
  [/\(item action type\)$/i, "item_action"],
  [/\(meta action type\)$/i, "meta_action"],
  [/\(bi-?entity condition type\)$/i, "bientity_condition"],
  [/\(entity condition type\)$/i, "entity_condition"],
  [/\(block condition type\)$/i, "block_condition"],
  [/\(item condition type\)$/i, "item_condition"],
  [/\(damage condition type\)$/i, "damage_condition"],
  [/\(biome condition type\)$/i, "biome_condition"],
  [/\(fluid condition type\)$/i, "fluid_condition"],
  [/\(meta condition type\)$/i, "meta_condition"],
];

function kindsOfTitle(title: string): Kind[] {
  const found = TITLE_KINDS.find(([pattern]) => pattern.test(title.trim()))?.[1];
  if (found === undefined) return [];
  if (found === "meta_action") return [...ACTION_KINDS];
  if (found === "meta_condition") return [...CONDITION_KINDS];
  return [found];
}

const HOLDS_PATTERNS: ReadonlyArray<readonly [RegExp, Holds]> = [
  [/bi-?entity actions?\b/, "bientity_action"],
  [/entity actions?\b/, "entity_action"],
  [/block actions?\b/, "block_action"],
  [/item actions?\b/, "item_action"],
  [/bi-?entity conditions?\b/, "bientity_condition"],
  [/entity conditions?\b/, "entity_condition"],
  [/block conditions?\b/, "block_condition"],
  [/item conditions?\b/, "item_condition"],
  [/damage conditions?\b/, "damage_condition"],
  [/biome conditions?\b/, "biome_condition"],
  [/fluid conditions?\b/, "fluid_condition"],
  [/^(?:array of |list of )?action types?$/, "action"],
  [/^(?:array of |list of )?condition types?$/, "condition"],
  [/^(?:array of |list of )?power types?$/, "power"],
];

// "Array of Entity Action Types" -> entity actions, many.
export function holdsOf(type: string): { holds: Holds | null; many: boolean } {
  const text = plainCell(type).toLowerCase();
  // "Array of Objects (Data Type)" holds objects that hold actions, not actions.
  if (/\bobjects?\b|data type|predicate/.test(text)) return { holds: null, many: false };
  const holds = HOLDS_PATTERNS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
  return { holds, many: holds !== null && /\b(?:array|list)\b/.test(text) };
}

// Markdown out of a table cell or heading: links, bold, code ticks and _italics_ (but not snake_case).
function plainCell(cell: string): string {
  return cell
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*`]/g, "")
    .replace(/(^|[\s(])_([^_\s][^_]*?)_(?=[\s).,]|$)/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

// Fields every power, action and condition has, whatever its page says.
export const COMMON_FIELDS: Readonly<Record<"power" | "action" | "condition", readonly Field[]>> = {
  power: [
    field("type", "Identifier"),
    field("name", "Text Component"),
    field("description", "Text Component"),
    field("condition", "Entity Condition Type"),
    field("hidden", "Boolean"),
    field("tags", "String"),
    field("load_condition", "Meta Condition"),
    field("loading_priority", "Integer"),
    field("badges", "Array of Badges"),
    field("skill", "Object"),
  ],
  action: [field("type", "Identifier")],
  condition: [field("type", "Identifier"), field("inverted", "Boolean")],
};

function field(name: string, type: string): Field {
  return { name, type, ...holdsOf(type), required: false };
}

const TYPE_ID_LINE = /Type ID:\**\s*`([a-z0-9_.-]+:[a-z0-9_/.-]+)`([^\n]*)/;
const ALSO_LINE = /^Also answers to:([^\n]*)$/m;
const ID_IN_TICKS = /`([a-z0-9_.-]+:[a-z0-9_/.-]+)`/g;
const BACKTICKED = /`([a-z_][a-z0-9_]*)`/g;
const JSON_KEY = /"([a-z_][a-z0-9_]*)"\s*:/g;
const FIELDS_HEADING = /^##[ \t]+(?:fields|parameters|arguments|options)\b/im;
const EXAMPLES_HEADING = /^##[ \t]+examples?\b/im;
const DATA_LINK = /\/docs\/datapack\/data-types\/([a-z0-9-]+)/g;
const FENCE = /```(?:json[c5]?)?[ \t]*\r?\n([\s\S]*?)```/g;

// The text under a "## " heading, up to the next "## " heading.
function section(text: string, heading: RegExp): string | null {
  const start = text.search(heading);
  if (start === -1) return null;
  const rest = text.slice(start);
  const next = rest.slice(3).search(/^##[ \t]/m);
  return next === -1 ? rest : rest.slice(0, next + 3);
}

// The data type a type cell links to, if it is one worth checking: "[Array](...) of [Status Effect Instance](...)".
function dataTypeOf(cell: string): string | undefined {
  return [...cell.matchAll(DATA_LINK)].map(match => match[1]!).filter(slug => !UNCHECKED_DATA.has(slug)).pop();
}

// The enum page a type cell links to, when that's all it can be ("[Comparison](...)", not "Comparison or Expression").
function enumOf(cell: string): string | undefined {
  const links = [...cell.matchAll(DATA_LINK)].map(match => match[1]!);
  return links.length === 1 && !/\bor\b/i.test(plainCell(cell)) ? links[0] : undefined;
}

// The values an enum page's tables list, aliases included: "`<=`", "`add_base_early`",
// "`multiply_base_additive` (aliases: `multiply_base`)". Formulas have spaces and stay out.
function enumValues(text: string): Set<string> {
  const values = new Set<string>();
  for (const line of text.split("\n")) {
    if (!line.includes("|")) continue;
    for (const match of line.matchAll(/`([^`\s]+)`/g)) values.add(match[1]!.toLowerCase());
  }
  return values;
}

// A command page as its names and usages: the sub-command table's first column.
function commandOf(page: SchemaPage): CommandInfo | null {
  const name = /^(.+?)\s*\(Command\)$/i.exec(page.title.trim())?.[1]?.toLowerCase().replace(/\s+/g, "_");
  if (name === undefined) return null;
  const usages: string[] = [];
  for (const line of (section(page.text, /^##[ \t]+sub-?commands\b/im) ?? "").split("\n")) {
    const usage = /^`([a-z][^`]*)`$/.exec(cells(line)[0] ?? "")?.[1];
    if (usage !== undefined && line.includes("|")) usages.push(usage.trim());
  }
  if (usages.length === 0) return null;
  const names = new Set([name, `apoli:${name}`]);
  for (const match of page.text.matchAll(/`\/([a-z0-9_:]+)`/g)) if (match[1] === name || match[1]!.endsWith(`:${name}`)) names.add(match[1]!);
  return { names: [...names], title: page.title, url: page.url, usages, literals: new Set(), takesArgument: false };
}

// The words a command class registers, added to the command it roots, and whether
// its root takes an argument directly (`root.then(Commands.argument("targets", ...))`).
function addLiterals(commands: ReadonlyMap<string, CommandInfo>, java: string): void {
  const literals = [...java.matchAll(/\bliteral\(\s*"([a-z0-9_:]+)"\s*\)/g)].map(match => match[1]!);
  for (const root of new Set(literals.map(literal => commands.get(literal)).filter(info => info !== undefined))) {
    for (const literal of literals) (root.literals as Set<string>).add(literal);
  }
  for (const match of java.matchAll(/(\w+)\s*=\s*Commands\.literal\(\s*"([a-z0-9_:]+)"\s*\)/g)) {
    const command = commands.get(match[2]!);
    if (command !== undefined && new RegExp(`\\b${match[1]}\\s*\\.then\\(\\s*Commands\\.argument\\(`).test(java)) (command as { takesArgument: boolean }).takesArgument = true;
  }
}

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map(cell => cell.trim());
}

// Every row of every table under the page's "## Fields" heading (sub-headings included).
export function fieldsOf(text: string): Map<string, Field> {
  const fields = new Map<string, Field>();
  const body = section(text, FIELDS_HEADING);
  if (body === null) return fields;
  let columns: { name: number; type: number; fallback: number; about: number } | null = null;
  for (const line of body.split("\n")) {
    if (!line.includes("|")) {
      columns = null;
      continue;
    }
    const row = cells(line);
    if (row.every(cell => /^:?-{2,}:?$/.test(cell) || cell === "")) continue;
    if (columns === null) {
      const header = row.map(cell => plainCell(cell).toLowerCase());
      const name = header.findIndex(cell => /^(?:field|name|key)s?$/.test(cell));
      const type = header.findIndex(cell => cell === "type");
      const about = header.findIndex(cell => /^(?:description|purpose|meaning|notes?)$/.test(cell));
      columns = { name: name === -1 ? 0 : name, type, fallback: header.findIndex(cell => cell === "default"), about };
      continue;
    }
    if (columns.type === -1) continue;
    const nameCell = row[columns.name] ?? "";
    const ticked = [...nameCell.matchAll(/`([^`]+)`/g)].map(match => match[1]!.replace(/^"|"$/g, ""));
    const names = ticked.length > 0 ? ticked : [plainCell(nameCell)];
    const type = row[columns.type] ?? "";
    const fallback = plainCell(row[columns.fallback] ?? "").toLowerCase();
    const required = columns.fallback !== -1 && (fallback === "" || fallback === "—" || fallback === "-" || fallback.includes("required"));
    const about = columns.about === -1 ? "" : plainCell(row[columns.about] ?? "");
    const dataType = dataTypeOf(type);
    const values = enumOf(type);
    for (const name of names) {
      if (!/^[a-z_][a-z0-9_]*$/i.test(name)) continue;
      fields.set(name, {
        name,
        type: plainCell(type),
        ...holdsOf(type),
        required,
        ...(about.length > 0 ? { about } : {}),
        ...(dataType !== undefined ? { dataType } : {}),
        ...(values !== undefined ? { values } : {}),
      });
    }
  }
  return fields;
}

// The page's examples, each named after the heading above it. Pages put them
// under "## Examples" or in their own "## <name>" sections after it.
export function examplesOf(text: string): Example[] {
  const start = text.search(EXAMPLES_HEADING);
  const scope = start === -1 ? text : text.slice(start);
  const examples: Example[] = [];
  for (const match of scope.matchAll(FENCE)) {
    const before = scope.slice(0, match.index);
    const heading = plainCell([...before.matchAll(/^#{2,4} (.+)$/gm)].pop()?.[1] ?? "Examples");
    // Under a bare "Examples" heading, a line that leads into the block names it ("Near-blindness:").
    // A line that only ends a sentence is the caption of the block before, not this one's name.
    const lead = before.trimEnd().split("\n").pop()?.trim() ?? "";
    const named = /^examples?$/i.test(heading) && lead.endsWith(":") && lead.length <= 120 && !lead.startsWith("#") ? plainCell(lead).replace(/:$/, "") : heading;
    const after = scope.slice(match.index + match[0].length).replace(/^\s+/, "").split("\n")[0]?.trim() ?? "";
    const caption = /^[A-Z]/.test(after) && !after.endsWith(":") && after.length <= 220 ? plainCell(after) : undefined;
    const json = match[1]!.trim();
    if (json.includes('"type"')) examples.push({ title: /^examples?$/i.test(named) ? "Example" : named, json, ...(caption !== undefined ? { caption } : {}) });
  }
  return examples;
}

function summaryOf(text: string): string {
  const first = text.split(/\n\s*\n/).map(part => part.trim()).find(part => part.length > 0 && !part.startsWith("#") && !/Type ID/.test(part)) ?? "";
  return plainCell(first).slice(0, 300);
}

function namesOn(text: string): Set<string> {
  const names = new Set<string>();
  for (const match of text.matchAll(BACKTICKED)) names.add(match[1]!);
  for (const match of text.matchAll(JSON_KEY)) names.add(match[1]!);
  return names;
}

// "self_action_on_hit" on an apoli page is "apoli:self_action_on_hit".
function qualified(id: string, namespace: string): string {
  return id.includes(":") ? id : `${namespace}:${id}`;
}

interface Registration {
  id: string;
  kind: Kind;
  aliases: string[];
  // The class behind it ("ModifyDamagePower"), whose codec names its fields.
  className: string | null;
  // Old field names the registration renames (`renameField("s", "start")`).
  renamed: string[];
}

const REGISTRIES: ReadonlyArray<readonly [string, Kind]> = [
  ["ActionTypes.ENTITY", "entity_action"],
  ["ActionTypes.BI_ENTITY", "bientity_action"],
  ["ActionTypes.BLOCK", "block_action"],
  ["ActionTypes.ITEM", "item_action"],
  ["ConditionTypes.ENTITY", "entity_condition"],
  ["ConditionTypes.BI_ENTITY", "bientity_condition"],
  ["ConditionTypes.BLOCK", "block_condition"],
  ["ConditionTypes.ITEM", "item_condition"],
  ["ConditionTypes.DAMAGE", "damage_condition"],
  ["ConditionTypes.BIOME", "biome_condition"],
  ["ConditionTypes.FLUID", "fluid_condition"],
  ["PowerTypeRegistry", "power"],
];
const REGISTRY_KIND = new Map(REGISTRIES);
const ID_EXPRESSION = /^\s*(?:(?:[\w.]+\.)?id\(\s*"([^"]+)"\s*\)|"([a-z0-9_.-]+:[a-z0-9_/.-]+)"|([A-Z][A-Z0-9_]*)\b)/;
const ALIAS = /addTypeAlias\(\s*(?:(?:[\w.]+\.)?id\(\s*"([^"]+)"\s*\)|"([^"]+)")/g;

// The text of a call from its opening parenthesis to the matching close.
function callText(text: string, open: number): string {
  let depth = 0;
  for (let at = open; at < text.length; at++) {
    const char = text[at];
    if (char === "(") depth++;
    else if (char === ")" && --depth === 0) return text.slice(open + 1, at);
  }
  return text.slice(open + 1);
}

// Every type a Java file registers: `ActionTypes.ENTITY.register(Apoli.id("heal"), ...)`,
// `PowerTypeRegistry.register(...)`, and the meta registries' `reg.register(AND, ...)`
// after `reg = ActionTypes.BI_ENTITY`.
export function registrationsIn(source: SchemaSource): Registration[] {
  const { text, namespace } = source;
  if (!text.includes(".register(")) return [];
  const constants = new Map<string, string>();
  for (const match of text.matchAll(/static final ResourceLocation\s+([A-Z0-9_]+)\s*=\s*(?:[\w.]+\.)?id\(\s*"([^"]+)"\s*\)/g)) constants.set(match[1]!, match[2]!);
  // Helpers like `chanceAliases()` that build the same aliases for several registrations.
  const helpers = new Map<string, string[]>();
  for (const match of text.matchAll(/AliasingOptions\s+(\w+)\s*\(\s*\)\s*\{([\s\S]*?)\n\s*\}/g)) {
    helpers.set(match[1]!, [...match[2]!.matchAll(ALIAS)].map(alias => qualified(alias[1] ?? alias[2]!, namespace)));
  }
  // `static final ModifyDamagePower MODIFY_DAMAGE = new ModifyDamagePower();`, registered by its name.
  const instances = new Map<string, string>();
  for (const match of text.matchAll(/\b([A-Z][A-Z0-9_]*)\s*=\s*new\s+(?:[a-z]\w*\.)*([A-Z]\w*)/g)) instances.set(match[1]!, match[2]!);
  const variables: Array<{ at: number; name: string; kind: Kind }> = [];
  for (const match of text.matchAll(/(\w+)\s*=\s*((?:ActionTypes|ConditionTypes)\.[A-Z_]+)\s*;/g)) {
    const kind = REGISTRY_KIND.get(match[2]!);
    if (kind !== undefined) variables.push({ at: match.index, name: match[1]!, kind });
  }

  const found: Registration[] = [];
  for (const match of text.matchAll(/((?:ActionTypes|ConditionTypes)\.[A-Z_]+|PowerTypeRegistry|\b\w+)\s*\.register\(/g)) {
    const receiver = match[1]!;
    const kind = REGISTRY_KIND.get(receiver) ?? variables.filter(variable => variable.name === receiver && variable.at < match.index).pop()?.kind;
    if (kind === undefined) continue;
    const call = callText(text, match.index + match[0].length - 1);
    const id = ID_EXPRESSION.exec(call);
    if (id === null) continue;
    const raw = id[1] ?? id[2] ?? (id[3] !== undefined ? constants.get(id[3]) : undefined);
    if (raw === undefined) continue;
    const aliases = [...call.matchAll(ALIAS)].map(alias => qualified(alias[1] ?? alias[2]!, namespace));
    for (const [helper, ids] of helpers) if (call.includes(`${helper}()`)) aliases.push(...ids);
    const instance = /^[^,]*,\s*([A-Z][A-Z0-9_]*)\s*[,)]?/.exec(call)?.[1];
    const className = /\bnew\s+(?:[a-z]\w*\.)*([A-Z]\w*)/.exec(call)?.[1] ?? (instance !== undefined ? instances.get(instance) ?? null : null);
    const renamed = [...call.matchAll(/renameField\(\s*"([a-z][a-z0-9_]*)"\s*,\s*"([a-z][a-z0-9_]*)"/g)].flatMap(match => [match[1]!, match[2]!]);
    found.push({ id: qualified(raw, namespace), kind, aliases, className, renamed });
  }
  return found;
}

const CODEC_KINDS: Readonly<Record<string, Kind>> = {
  EntityAction: "entity_action",
  BiEntityAction: "bientity_action",
  BlockAction: "block_action",
  ItemAction: "item_action",
  EntityCondition: "entity_condition",
  BiEntityCondition: "bientity_condition",
  BlockCondition: "block_condition",
  ItemCondition: "item_condition",
  DamageCondition: "damage_condition",
  BiomeCondition: "biome_condition",
  FluidCondition: "fluid_condition",
};
const CODE_FIELD = /\b(?:optionalFieldOf|fieldOf|strict|renameField|of)\(\s*"([a-z][a-z0-9_]*)"/g;
const CODEC_CLASS = "(?:[a-z]\\w*\\.)*((?:BiEntity|Entity|Block|Item|Damage|Biome|Fluid)(?:Action|Condition))\\.[A-Z_]+";
// `LoggedOptionalField.of("self_action", EntityAction.CODEC)`
const NAME_THEN_CODEC = new RegExp(`\\(\\s*"([a-z][a-z0-9_]*)"\\s*,\\s*${CODEC_CLASS}`, "g");
// `EntityAction.CODEC.optionalFieldOf("self_action")`
const CODEC_THEN_NAME = new RegExp(`${CODEC_CLASS}(?:\\.listOf\\(\\))?\\s*\\.\\s*(?:optionalFieldOf|fieldOf)\\(\\s*"([a-z][a-z0-9_]*)"`, "g");

// The field names a type's codec reads, and which of them hold an action or a condition of which kind.
export function codeFieldsOf(java: string): Map<string, Kind | null> {
  const fields = new Map<string, Kind | null>();
  for (const match of java.matchAll(CODE_FIELD)) if (!fields.has(match[1]!)) fields.set(match[1]!, null);
  for (const match of java.matchAll(NAME_THEN_CODEC)) fields.set(match[1]!, CODEC_KINDS[match[2]!] ?? null);
  for (const match of java.matchAll(CODEC_THEN_NAME)) fields.set(match[2]!, CODEC_KINDS[match[1]!] ?? null);
  return fields;
}

// A class's fields with its parent's, one level up (shared configs live in an abstract parent).
function classFields(className: string, classes: ReadonlyMap<string, string>): Map<string, Kind | null> {
  const text = classes.get(className);
  if (text === undefined) return new Map();
  const fields = codeFieldsOf(text);
  const parent = new RegExp(`class\\s+${className}\\b[^{]*?\\bextends\\s+([A-Z]\\w*)`).exec(text)?.[1];
  const inherited = parent === undefined ? new Map<string, Kind | null>() : codeFieldsOf(classes.get(parent) ?? "");
  for (const [name, holds] of inherited) if (!fields.has(name)) fields.set(name, holds);
  return fields;
}

// A documented type with what its code adds: fields the page left out, and the
// kind a field really holds where the page only says "Condition Type".
function withCode(info: TypeInfo, code: ReadonlyMap<string, Kind | null>, renamed: readonly string[]): TypeInfo {
  if (code.size === 0 && renamed.length === 0) return info;
  const fields = new Map(info.fields);
  for (const [name, holds] of code) {
    const known = fields.get(name);
    if (known === undefined) fields.set(name, { name, type: holds === null ? "" : KIND_WORDS[holds], holds, many: false, required: false });
    else if (holds !== null && known.holds !== holds && !info.meta) fields.set(name, { ...known, holds });
  }
  const names = new Set(info.names);
  for (const name of renamed) names.add(name);
  return { ...info, fields, names };
}

// One Handbook page as the types it describes (several for a meta type). A page
// with a Type ID that is no power, action or condition (a badge type) is `other`.
function pageTypes(page: SchemaPage): { info: TypeInfo[]; aliases: string[]; other: string | null } {
  const typeLine = TYPE_ID_LINE.exec(page.text);
  const kinds = kindsOfTitle(page.title);
  if (typeLine === null) return { info: [], aliases: [], other: null };
  if (kinds.length === 0) return { info: [], aliases: [], other: typeLine[1]! };
  const id = typeLine[1]!;
  const namespace = id.slice(0, id.indexOf(":"));
  const aliases = [...typeLine[2]!.matchAll(ID_IN_TICKS)].map(match => match[1]!);
  const also = ALSO_LINE.exec(page.text)?.[1] ?? "";
  for (const match of also.matchAll(/`([^`]+)`/g)) aliases.push(qualified(match[1]!, namespace));
  const fields = fieldsOf(page.text);
  const names = namesOn(page.text);
  const examples = examplesOf(page.text);
  const summary = summaryOf(page.text);
  const meta = kinds.length > 1;
  const info = kinds.map(kind => ({ id, kind, meta, title: page.title, url: page.url, summary, fields, names, examples, documented: true, className: null }));
  return { info, aliases: aliases.filter(alias => alias !== id), other: null };
}

// A legacy id with a page of its own reads its own fields and those of the type it stands for.
function merged(own: TypeInfo, target: TypeInfo): TypeInfo {
  const fields = new Map(target.fields);
  for (const [name, known] of own.fields) fields.set(name, known);
  return { ...own, fields, names: new Set([...own.names, ...target.names]) };
}

export function buildSchema(pages: Iterable<SchemaPage>, sources: Iterable<SchemaSource>, extras: SchemaExtras = {}): Schema {
  const links = new Set([...(extras.links ?? [])].map(linkKey));
  const content = new Map<string, string>();
  const used = (id: string) => {
    if (!content.has(id)) content.set(id, "");
  };
  for (const file of extras.data ?? []) {
    const entry = dataId(file.path);
    if (entry !== null) content.set(entry.id, entry.folder);
    for (const match of file.text.matchAll(/"#?((?:apoli|origins):[a-z0-9_/.-]+)"/g)) used(match[1]!);
  }
  const classes = new Map<string, string>();
  const registrations: Registration[] = [];
  for (const source of sources) {
    classes.set(source.path.slice(source.path.lastIndexOf("/") + 1).replace(/\.java$/, ""), source.text);
    registrations.push(...registrationsIn(source));
    // Everything the code names is real: items, entities, models, keys ("origins:orb_of_origin").
    for (const match of source.text.matchAll(/\b(?:(Apoli|Origins)\.)?id\(\s*"([a-z0-9_/.-]+)"\s*\)/g)) {
      used(`${match[1] === undefined ? source.namespace : match[1].toLowerCase()}:${match[2]}`);
    }
  }
  const registered = new Map(registrations.map(registration => [`${registration.id} ${registration.kind}`, registration]));
  const codeOf = (registration: Registration | undefined) => (registration?.className == null ? new Map<string, Kind | null>() : classFields(registration.className, classes));

  const types = new Map<string, TypeInfo[]>();
  const find = (id: string, kind: Kind) => types.get(id)?.find(entry => entry.kind === kind);
  const put = (id: string, info: TypeInfo) => {
    const list = (types.get(id) ?? []).filter(existing => existing.kind !== info.kind);
    types.set(id, [...list, info]);
  };
  // A legacy id: the type it stands for, unless it has a page of its own, which then reads both.
  const link = (alias: string, target: TypeInfo) => {
    const own = find(alias, target.kind);
    if (own === undefined) put(alias, target);
    else if (own.id === alias && own !== target) put(alias, merged(own, target));
  };
  const byKind = new Map<Kind, string[]>();
  const mentioned = new Set<string>();
  const uses = new Map<string, number>();
  const other = new Set<string>();
  const legacy: Array<{ alias: string; target: TypeInfo }> = [];
  const dataTypes = new Map<string, DataInfo>();
  const enums = new Map<string, Set<string>>();
  const commands = new Map<string, CommandInfo>();

  // Each page's own type first, with what its code adds, so a page always wins over another page's legacy id.
  for (const page of pages) {
    links.add(linkKey(page.url));
    for (const match of page.text.matchAll(ID_IN_TICKS)) mentioned.add(match[1]!);
    // Values in examples ("model": "apoli:player") and commands (/apoli:clone) are real too.
    for (const match of page.text.matchAll(/["/]((?:apoli|origins):[a-z0-9_/.-]+)/g)) mentioned.add(match[1]!.replace(/[.]$/, ""));
    for (const match of page.text.matchAll(/"type"\s*:\s*"([a-z0-9_.-]+:[a-z0-9_/.-]+)"/g)) {
      mentioned.add(match[1]!);
      uses.set(match[1]!, (uses.get(match[1]!) ?? 0) + 1);
    }
    const data = /\/\d+-data-types\/([a-z0-9-]+)\.md$/.exec(page.path)?.[1];
    if (data !== undefined && !UNCHECKED_DATA.has(data)) {
      const fields = fieldsOf(page.text);
      if (fields.size > 0) dataTypes.set(data, { slug: data, title: page.title.replace(/\s*\(Data Type\)$/i, ""), url: page.url, fields, names: namesOn(page.text) });
    }
    if (data !== undefined && ENUM_DATA.has(data)) {
      const values = enumValues(page.text);
      if (values.size > 0) enums.set(data, values);
    }
    const command = commandOf(page);
    if (command !== null) for (const name of command.names) commands.set(name, command);
    const found = pageTypes(page);
    if (found.other !== null) other.add(found.other);
    // A meta page covers every kind, but the code may register it for fewer (apoli:offset is block only).
    const inCode = found.info.filter(base => registered.has(`${base.id} ${base.kind}`));
    for (const base of inCode.length > 0 ? inCode : found.info) {
      if (find(base.id, base.kind) !== undefined) continue;
      const registration = registered.get(`${base.id} ${base.kind}`);
      const entry = { ...withCode(base, codeOf(registration), registration?.renamed ?? []), className: registration?.className ?? null };
      put(entry.id, entry);
      for (const alias of found.aliases) legacy.push({ alias, target: entry });
      const ids = byKind.get(entry.kind) ?? [];
      if (!ids.includes(entry.id)) ids.push(entry.id);
      byKind.set(entry.kind, ids);
    }
  }
  for (const { alias, target } of legacy) link(alias, target);
  for (const [, text] of classes) if (text.includes("literal(")) addLiterals(commands, text);

  // The code knows every type, documented or not, and every legacy id.
  for (const registration of registrations) {
    let entry = find(registration.id, registration.kind);
    if (entry === undefined) {
      const code = codeOf(registration);
      entry = {
        id: registration.id,
        kind: registration.kind,
        meta: false,
        title: "",
        url: "",
        summary: "",
        fields: new Map([...code].map(([name, holds]) => [name, { name, type: holds === null ? "" : KIND_WORDS[holds], holds, many: false, required: false }])),
        names: new Set(registration.renamed),
        examples: [],
        documented: false,
        className: registration.className,
      };
      put(registration.id, entry);
    }
    for (const alias of registration.aliases) link(alias, entry);
  }
  return { types, byKind, mentioned, uses, slots: slotsOf(types), other, links, content, dataTypes, enums, commands };
}

// Whether an id is real in any sense: a type, an id the Handbook writes, or the mods' own data.
export function known(schema: Schema, id: string): boolean {
  return lookup(schema, id).length > 0 || schema.mentioned.has(id) || schema.other.has(id) || schema.content.has(id);
}

function slotsOf(types: ReadonlyMap<string, readonly TypeInfo[]>): Map<string, Kind> {
  const seen = new Map<string, Kind | null>();
  for (const entries of types.values()) {
    for (const entry of entries) {
      if (entry.meta) continue;
      for (const field of [...entry.fields.values(), ...COMMON_FIELDS[familyOf(entry.kind)]]) {
        if (field.holds === null || field.holds === "action" || field.holds === "condition") continue;
        const before = seen.get(field.name);
        seen.set(field.name, before === undefined || before === field.holds ? field.holds : null);
      }
    }
  }
  const slots = new Map<string, Kind>();
  for (const [name, kind] of seen) if (kind !== null) slots.set(name, kind);
  return slots;
}

// The documented ids of a kind, without the meta types (apoli:and is never the replacement for a made-up action).
function concrete(schema: Schema, kind: Kind): string[] {
  return (schema.byKind.get(kind) ?? []).filter(id => lookupIn(schema, id, kind)?.meta !== true);
}

// The most used documented ids of a kind.
export function popularIds(schema: Schema, kind: Kind, limit = 6): string[] {
  return concrete(schema, kind).sort((x, y) => (schema.uses.get(y) ?? 0) - (schema.uses.get(x) ?? 0)).slice(0, limit);
}

// Origins answers to every Apoli id under its own namespace ("origins:health").
export function lookup(schema: Schema, id: string): readonly TypeInfo[] {
  const exact = schema.types.get(id);
  if (exact !== undefined) return exact;
  if (id.startsWith("origins:") && !schema.other.has(id)) return schema.types.get(`apoli:${id.slice("origins:".length)}`) ?? [];
  return [];
}

export function lookupIn(schema: Schema, id: string, kind: Kind): TypeInfo | undefined {
  return lookup(schema, id).find(entry => entry.kind === kind);
}

export function hasTypes(schema: Schema): boolean {
  return schema.types.size > 0;
}

// The field a name refers to on a type, including the fields every power, action or condition has.
export function fieldOn(info: TypeInfo, name: string): Field | undefined {
  return info.fields.get(name) ?? COMMON_FIELDS[familyOf(info.kind)].find(common => common.name === name);
}

// Whether a type may have a field: its table, the common fields, or anything its page mentions.
export function knowsField(info: TypeInfo, name: string): boolean {
  return !info.documented || fieldOn(info, name) !== undefined || info.names.has(name);
}

const SUGGEST_IGNORED = new Set(["the", "and", "for", "with", "that", "this", "when", "from", "entity", "action", "condition", "type", "apoli", "origins"]);

function wordsOf(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 2 && !SUGGEST_IGNORED.has(word));
}

function alike(a: string, b: string): boolean {
  return a === b || (a.length > 3 && b.length > 3 && (a.startsWith(b) || b.startsWith(a)));
}

// The documented ids of a kind that look most like what the model wanted, by
// the words of its made-up id against each real id and its summary:
// "set_effect" finds apoli:apply_effect, "push_entity" finds what "pushes".
export function similarIds(schema: Schema, kind: Kind, wanted: string, limit = 6): string[] {
  const words = wordsOf(wanted.replace(/^[a-z0-9_.-]+:/, "").replace(/_/g, " "));
  if (words.length === 0) return [];
  const scored = concrete(schema, kind).map(id => {
    const own = wordsOf(id.slice(id.indexOf(":") + 1).replace(/_/g, " "));
    const summary = wordsOf(lookupIn(schema, id, kind)?.summary ?? "");
    const score = words.reduce((total, word) => total + (own.some(other => alike(word, other)) ? 3 : summary.some(other => alike(word, other)) ? 1 : 0), 0);
    return { id, score };
  });
  return scored.filter(entry => entry.score > 0).sort((a, b) => b.score - a.score || a.id.length - b.id.length).slice(0, limit).map(entry => entry.id);
}
