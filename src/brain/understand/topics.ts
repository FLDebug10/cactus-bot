import { ORIGINS } from "../content/knowledge.ts";
import { table } from "../content/table.ts";

export type Topic =
  | "apoli" | "origins" | "origin" | "handbook" | "datapack" | "resourcepack" | "addon" | "json"
  | "problem" | "crash" | "suggestion" | "media" | "jam" | "download" | "versions" | "install"
  | "staff" | "commands";

// Single words that point at a topic. Multi-word cues are matched as phrases below.
const TOPIC_WORDS: Readonly<Record<string, readonly Topic[]>> = table({
  apoli: ["apoli"], opoli: ["apoli"],
  origins: ["origins"], overgrown: ["origins"],
  handbook: ["handbook"], wiki: ["handbook"], docs: ["handbook"], documentation: ["handbook"], tutorial: ["handbook"],
  datapack: ["datapack"], datapacks: ["datapack"], power: ["datapack"], powers: ["datapack"], mcfunction: ["datapack"],
  layer: ["datapack"], layers: ["datapack"], badge: ["datapack"], badges: ["datapack"], namespace: ["datapack"],
  mcmeta: ["datapack"], condition: ["datapack"], conditions: ["datapack"], scoreboard: ["datapack"],
  json: ["json", "datapack"],
  resourcepack: ["resourcepack"], resourcepacks: ["resourcepack"], texturepack: ["resourcepack"],
  texture: ["resourcepack"], textures: ["resourcepack"], sprite: ["resourcepack"], sprites: ["resourcepack"],
  model: ["resourcepack"], models: ["resourcepack"], hud: ["resourcepack"],
  addon: ["addon"], addons: ["addon"], java: ["addon"], mixin: ["addon"], mixins: ["addon"], gradle: ["addon"],
  api: ["addon"], intellij: ["addon"], kubejs: ["addon"],
  bug: ["problem"], bugs: ["problem"], bugged: ["problem"], buggy: ["problem"], glitch: ["problem"],
  glitched: ["problem"], glitching: ["problem"], broken: ["problem"], error: ["problem"], errors: ["problem"],
  issue: ["problem"], issues: ["problem"], problem: ["problem"], problems: ["problem"], trouble: ["problem"],
  exception: ["problem"], lag: ["problem"], freezes: ["problem"], freezing: ["problem"],
  crash: ["crash", "problem"], crashes: ["crash", "problem"], crashing: ["crash", "problem"],
  crashed: ["crash", "problem"],
  suggestion: ["suggestion"], suggestions: ["suggestion"], suggest: ["suggestion"], idea: ["suggestion"],
  ideas: ["suggestion"], feature: ["suggestion"], features: ["suggestion"],
  screenshot: ["media"], screenshots: ["media"], video: ["media"], videos: ["media"], clip: ["media"],
  clips: ["media"], gallery: ["media"], media: ["media"], showcase: ["media"], gif: ["media"],
  picture: ["media"], pictures: ["media"], image: ["media"], images: ["media"], art: ["media"],
  jam: ["jam"], jams: ["jam"], competition: ["jam"], contest: ["jam"], comp: ["jam"], submission: ["jam"],
  submissions: ["jam"], theme: ["jam"], deadline: ["jam"],
  download: ["download"], downloads: ["download"], downloading: ["download"], modrinth: ["download"],
  curseforge: ["download"],
  version: ["versions"], versions: ["versions"], loader: ["versions"], loaders: ["versions"],
  forge: ["versions"], neoforge: ["versions"], fabric: ["versions"], quilt: ["versions"], bedrock: ["versions"],
  install: ["install"], installing: ["install"], installed: ["install"],
  staff: ["staff"], moderator: ["staff"], moderators: ["staff"], admin: ["staff"], admins: ["staff"],
  owner: ["staff"],
});

const TOPIC_PHRASES: ReadonlyArray<readonly [RegExp, readonly Topic[]]> = [
  [/\bdata pack\b/, ["datapack"]],
  [/\bresource pack\b|\btexture pack\b/, ["resourcepack"]],
  [/\b(not working|does not work|do not work|stopped working|will not (load|work|start|launch|open)|is not working)\b/, ["problem"]],
  [/\b(game jam|jam entry|my entry)\b/, ["jam"]],
  [/\b(fabric api|my mod|make a mod|making a mod|java mod)\b/, ["addon"]],
  [/\b(custom origin|my own origin|make an? origin|create an? origin|making an? origin|origin file|my origin)\b/, ["datapack"]],
  [/\b(1 ?\. ?20|1 ?\. ?21|1201|1211)\b/, ["versions"]],
  [/\b1 (1[6-9]|2[0-9])( \d{1,2})?\b/, ["versions"]],
  [/\b(your commands|bot commands|the commands|what commands)\b/, ["commands"]],
  [/\b(the mods|mod team|the staff)\b/, ["staff"]],
];

const ORIGIN_NAMES = new Set(ORIGINS.map(origin => origin.id));

export interface Topics {
  set: ReadonlySet<Topic>;
  // Which shipped origin was named, if any.
  originId: string | null;
  // "my datapack" (their own work) versus "the mod" (the mod itself).
  owner: "own" | "mod" | null;
}

export function findTopics(text: string, tokens: readonly string[]): Topics {
  const set = new Set<Topic>();
  let originId: string | null = null;

  for (const token of tokens) {
    const topics = TOPIC_WORDS[token];
    if (topics !== undefined) for (const topic of topics) set.add(topic);
    if (originId === null && ORIGIN_NAMES.has(token)) {
      originId = token;
      set.add("origin");
    }
  }
  for (const [pattern, topics] of TOPIC_PHRASES) {
    if (pattern.test(text)) for (const topic of topics) set.add(topic);
  }

  // "my enderian doesn't teleport anymore": a mod thing that stopped working is a problem.
  const modish = originId !== null || set.has("apoli") || set.has("origins") || set.has("datapack") || set.has("addon") || set.has("resourcepack");
  if (modish && STOPPED.test(text) && !OPINION.test(text)) set.add("problem");

  return { set, originId, owner: ownerOf(text) };
}

// "i don't like merling" is an opinion, not a bug.
const OPINION = /\b(do not|does not|did not|can not|cannot) (like|love|want|know|understand|think|care|mind|enjoy|prefer|get it)\b/;
const STOPPED = /\b(does not|do not|did not|will not|can not|cannot|is not|are not|no longer|stopped|anymore|broke|broken|keeps)\b/;

const OWN_WORK = /\b(my|our|i made|i am making|i made a|i wrote|my own|i coded|i created)\b(?: \w+){0,2} (datapack|datapacks|pack|packs|power|powers|origin|origins|layer|json|function|functions|addon|mod|code|resourcepack|texture|textures|model|badge|condition|action|file|files)\b/;
const MOD_ITSELF = /\b(the|this|your|overgrown) (mod|mods|origins|apoli|origin mod|update)\b|\b(origins|apoli) (is|keeps|crashes|crashed|crashing|broke|broken|does not|will not|is not)\b/;

function ownerOf(text: string): "own" | "mod" | null {
  if (OWN_WORK.test(text)) return "own";
  if (MOD_ITSELF.test(text)) return "mod";
  return null;
}
