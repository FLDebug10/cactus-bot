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
