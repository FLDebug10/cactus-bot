// Everything that names a Discord object, a link, or a tuning knob lives here,
// so moving a channel or retuning Grove never means hunting through feature code.

function env(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? undefined : value.trim();
}

function envFlag(name: string, fallback: boolean): boolean {
  const value = env(name);
  if (value === undefined) return fallback;
  return !["0", "false", "no", "off"].includes(value.toLowerCase());
}

function envInt(name: string, fallback: number): number {
  const value = Number.parseInt(env(name) ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const GUILD_ID = "1531431326371283196";

export const CHANNELS = {
  bugReports: "1533408856682663956",
  suggestions: "1533408806833229834",
  datapackSupport: "1533211757407895634",
  addonSupport: "1547323194564812931",
  mediaGallery: "1534524067481255997",
  jamInfo: "1533211609747689562",
  jamSubmissions: "1533211566869184706",
  jamDiscussion: "1533210797227114556",
  modmail: "1554472572647768064",
} as const;

export type ChannelKey = keyof typeof CHANNELS;

export const FORUM_TAGS = {
  closed: "1553708235582869604",
  claimed: "1553708304860057620",
  pendingReview: "1553812865071186000",
} as const;

// Contributors and staff. Anyone with Manage Threads counts as staff too.
export const STAFF_ROLE_IDS: readonly string[] = [
  "1531431940178317385",
  "1547964808912048299",
  "1548817360247332874",
  "1554994395449917581",
  "1547961618980274226",
];

// The people who made Grove. It recognizes them, and credits them when asked.
export const CREW = {
  drizzo: { id: "545113206646112286", username: "_drizzo_" },
  fld10: { id: "967451640581996594", username: "_fld10_" },
  overgrown: { id: "900379751653445673", username: "0vergrown" },
} as const;

export type CrewMember = keyof typeof CREW;

export const EMOJI = {
  grove: "<:grove:1554976275729223740>",
  orb: "<:grove_orb:1555207821291683950>",
  heart: "<:grove_heart:1555697272099045396>",
} as const;

export const LINKS = {
  handbook: "https://0vergrown.github.io/Handbook/",
  datapackDocs: "https://0vergrown.github.io/Handbook/docs/datapack/introduction/overview/",
  gettingStarted: "https://0vergrown.github.io/Handbook/docs/datapack/introduction/getting-started/",
  originsDocs: "https://0vergrown.github.io/Handbook/docs/datapack/origins/overview/",
  addonDocs: "https://0vergrown.github.io/Handbook/docs/addon/introduction/overview/",
  modrinthCollection: "https://modrinth.com/collection/P0Z8iLdQ",
  apoliModrinth: "https://modrinth.com/mod/opoli",
  originsModrinth: "https://modrinth.com/mod/overgrowns-origins",
  apoliCurseforge: "https://www.curseforge.com/minecraft/mc-mods/opoli",
  originsCurseforge: "https://www.curseforge.com/minecraft/mc-mods/o-origins",
  github: "https://github.com/0vergrown",
  jsonChecker: "https://jsonchecker.com/",
} as const;

export const COMMAND_PREFIX = "!";

export const SETTINGS = {
  token: env("TOKEN"),
  databasePath: env("DATABASE_PATH") ?? "data/database.db",
  // Grove's sense of morning and night follows this clock.
  timezone: env("GROVE_TIMEZONE") ?? "America/New_York",
  // Grove answers obvious "where do I report this?" questions nobody else answered.
  helpUnanswered: envFlag("GROVE_HELP_UNANSWERED", true),
  // Removes text-only posts from the media gallery and explains the rule.
  moderateMediaGallery: envFlag("GROVE_MODERATE_MEDIA", true),
  logLevel: env("LOG_LEVEL") ?? "info",
} as const;

// Grove's chatting brain: an Ollama server on Overgrown's computer, which the VM
// reaches through an SSH tunnel (see deploy/brain/SETUP.md). When it can't be
// reached, Grove still runs every command and moderation rule, it just doesn't chat.
export const BRAIN = {
  url: env("GROVE_BRAIN_URL") ?? "http://127.0.0.1:11434",
  model: env("GROVE_BRAIN_MODEL") ?? "qwen3.5:4b",
  // Tokens the model can see at once: persona, recent chat, handbook notes and tool results.
  contextTokens: envInt("GROVE_BRAIN_CONTEXT", 8192),
  // How long Ollama keeps the model in memory after a reply ("10m", "1h"). Unset = Ollama's default.
  keepAlive: env("GROVE_BRAIN_KEEP_ALIVE") ?? null,
  // Let thinking models reason before answering. Smarter, but much slower.
  think: envFlag("GROVE_BRAIN_THINK", false),
  timeoutMs: envInt("GROVE_BRAIN_TIMEOUT_MS", 120_000),
  // Show the model screenshots people attach, when it can see images.
  vision: envFlag("GROVE_BRAIN_VISION", true),
  // Tell people (at most every 15 minutes per channel) when the brain is asleep.
  offlineNotice: envFlag("GROVE_OFFLINE_NOTICE", true),
  // For models with built-in multi-token prediction (qwen3.5:4b-mtp-q4_K_M): how
  // many tokens to guess ahead. Unset = off. 3 is a good start.
  draftTokens: envInt("GROVE_BRAIN_DRAFT_TOKENS", 0) || null,
} as const;

// An optional second brain on Ollama's cloud, which works while Overgrown's
// computer is off but has monthly credits. Without an API key it isn't used.
export const CLOUD = {
  apiKey: env("GROVE_CLOUD_API_KEY") ?? env("OLLAMA_API_KEY") ?? null,
  url: env("GROVE_CLOUD_URL") ?? "https://ollama.com",
  model: env("GROVE_CLOUD_MODEL") ?? "glm-5.3-flash",
  // true: the cloud answers first and the local model takes over when credits run
  // out. false: the local model answers, the cloud only covers while it's off.
  first: envFlag("GROVE_CLOUD_FIRST", true),
  contextTokens: envInt("GROVE_CLOUD_CONTEXT", 32_768),
} as const;

export interface KnowledgeSource {
  // The key in the library, and in search filters.
  name: string;
  repo: string;
  branch: string;
  kind: "docs" | "code";
  // For source code: which mod and which build ("fabric-1.21.1"), so a question about
  // 1.20.1 or NeoForge searches the right tree.
  mod?: "apoli" | "origins";
  build?: string;
}

// The build the Handbook documents, and the one Grove searches unless asked otherwise.
export const MAIN_BUILD = "fabric-1.21.1";
export const BUILDS = ["fabric-1.21.1", "fabric-1.20.1", "neoforge-1.21.1"] as const;

function code(mod: "apoli" | "origins", build: (typeof BUILDS)[number]): KnowledgeSource {
  const [loader, version] = build.split("-") as [string, string];
  return {
    name: build === MAIN_BUILD ? mod : `${mod}-${build}`,
    repo: `0vergrown/${mod === "apoli" ? "Apoli" : "Origins"}`,
    branch: `${loader === "fabric" ? "Fabric" : "NeoForge"}-${version}`,
    kind: "code",
    mod,
    build,
  };
}

// What Grove can look things up in: the Handbook, and the mods' own source for
// every loader and Minecraft version they ship on (one branch per build).
const KNOWLEDGE_SOURCES: readonly KnowledgeSource[] = [
  { name: "handbook", repo: "0vergrown/Handbook", branch: "main", kind: "docs" },
  ...(["apoli", "origins"] as const).flatMap(mod => BUILDS.map(build => code(mod, build))),
];

export const KNOWLEDGE = {
  path: env("GROVE_KNOWLEDGE_PATH") ?? "data/knowledge.db",
  refreshHours: envInt("GROVE_KNOWLEDGE_REFRESH_HOURS", 6),
  sources: KNOWLEDGE_SOURCES,
} as const;

// The library sources holding one build's code, e.g. ["apoli", "origins"] for the main build.
export function codeSourcesOf(build: string, mod?: string): string[] {
  return KNOWLEDGE_SOURCES.filter(source => source.kind === "code" && source.build === build && (mod === undefined || source.mod === mod)).map(source => source.name);
}

export const MODERATION = {
  // Repeat explicit questions inside the window get a timeout, longer each time.
  explicitTimeouts: envFlag("GROVE_EXPLICIT_TIMEOUTS", true),
  timeoutMinutes: [10, 60],
  strikeWindowMs: 24 * 60 * 60_000,
} as const;
