import "dotenv/config";
import { ActivityType, ChannelType, Events, type Message } from "discord.js";
import { commandSummary, runCommand } from "./commands/registry.ts";
import { deploySlashCommands, handleInteraction } from "./commands/slash.ts";
import type { Services } from "./commands/command.ts";
import { CHANNELS, KNOWLEDGE, SETTINGS } from "./config.ts";
import { CustomCommandStore } from "./db/customCommands.ts";
import { openDatabase } from "./db/database.ts";
import { StrikeStore } from "./db/strikes.ts";
import { ModmailLinks, SuggestionClaims } from "./db/threadLinks.ts";
import { createClient } from "./discord/client.ts";
import { GroveChat } from "./features/chat.ts";
import { MediaGallery } from "./features/mediaGallery.ts";
import { Modmail } from "./features/modmail.ts";
import { Signpost } from "./features/signpost.ts";
import { tagNewSuggestion } from "./features/suggestions.ts";
import { brainsFromConfig } from "./grove/brains.ts";
import { KnowledgeStore } from "./grove/knowledge/store.ts";
import { KnowledgeSync } from "./grove/knowledge/sync.ts";
import { logger } from "./logger.ts";

const log = logger("main");

if (SETTINGS.token === undefined) {
  log.error("no TOKEN in the environment, set it in .env");
  process.exit(1);
}
const token = SETTINGS.token;

const db = openDatabase(SETTINGS.databasePath);
const client = createClient();

// Grove's library: the Handbook and the mods' source, synced from GitHub.
// Without it Grove still chats, it just can't look things up.
let knowledge: KnowledgeStore | null = null;
let knowledgeSync: KnowledgeSync | null = null;
try {
  knowledge = new KnowledgeStore(KNOWLEDGE.path);
  knowledgeSync = new KnowledgeSync(knowledge, KNOWLEDGE.sources, { log: logger("knowledge") });
} catch (error) {
  log.error("could not open the knowledge index, Grove won't be able to look things up", error);
}

// Ollama Cloud first when there is an API key, then the model on Overgrown's computer.
const brain = brainsFromConfig(logger("brain"));

// Forums where chatter would get in the way: suggestion posts are worked
// through by staff, the modmail forum is the DM relay, and the media gallery
// itself is a no-talk zone (its threads are fine).
const QUIET_PARENTS = new Set<string>([CHANNELS.suggestions, CHANNELS.modmail]);
const SUPPORT_CHANNELS = new Set<string>([CHANNELS.bugReports, CHANNELS.datapackSupport, CHANNELS.addonSupport, CHANNELS.suggestions]);
const parentOf = (message: Message) => (message.channel.isThread() ? message.channel.parentId : null);
const isQuiet = (message: Message) => message.channelId === CHANNELS.mediaGallery || QUIET_PARENTS.has(parentOf(message) ?? "");
const isSupportChannel = (message: Message) => SUPPORT_CHANNELS.has(message.channelId) || SUPPORT_CHANNELS.has(parentOf(message) ?? "");

const modmailLinks = new ModmailLinks(db);
const customCommands = new CustomCommandStore(db);
const chat = new GroveChat({
  client,
  brain,
  knowledge,
  strikes: new StrikeStore(db),
  timezone: SETTINGS.timezone,
  commands: () => commandSummary(customCommands),
  isQuiet,
});
const services: Services = {
  client,
  customCommands,
  claims: new SuggestionClaims(db),
  modmailLinks,
  modmail: new Modmail(client, modmailLinks),
  chat,
  brain,
  knowledge,
  knowledgeSync,
};
const signpost = new Signpost(chat.history, isSupportChannel);
const gallery = new MediaGallery();

client.once(Events.ClientReady, async ready => {
  ready.user.setActivity("Overgrown's Origins", { type: ActivityType.Playing });
  try {
    await deploySlashCommands(token, ready.user.id);
  } catch (error) {
    log.error("could not register slash commands", error);
  }
  await chat.ready().catch(error => log.warn("could not look up channel names", error));
  brain.start();
  knowledgeSync?.start(KNOWLEDGE.refreshHours);
  log.info(`online as ${ready.user.tag}`);
});

client.on(Events.ThreadCreate, (thread, newlyCreated) => {
  void tagNewSuggestion(thread, newlyCreated);
});

client.on(Events.InteractionCreate, interaction => {
  void handleInteraction(interaction, customCommands);
});

client.on(Events.MessageCreate, message => {
  onMessage(message).catch(error => log.error("message handling failed", error));
});

async function onMessage(message: Message): Promise<void> {
  if (message.channel.type === ChannelType.DM) {
    if (!message.author.bot) await services.modmail.fromUser(message);
    return;
  }

  // In a modmail thread everything staff type goes to the user, except !closemail.
  // These conversations are private, so Grove's chat never sees them.
  if (services.modmail.isModmailThread(message)) {
    if (!message.author.bot && /^!closemail\b/i.test(message.content.trim())) await services.modmail.close(message);
    else if (!message.author.bot) await services.modmail.fromStaff(message);
    return;
  }

  // Grove keeps the public conversation in mind, other bots and its own lines included.
  if (message.author.bot || message.webhookId !== null) {
    chat.observe(message);
    return;
  }
  if (SETTINGS.moderateMediaGallery && (await gallery.check(message))) return;
  if (await runCommand(message, services)) return;
  chat.observe(message);
  const forGrove = await chat.handle(message);
  if (!forGrove && SETTINGS.helpUnanswered) signpost.consider(message);
}

client.on(Events.Error, error => log.error("discord client error", error));
process.on("unhandledRejection", error => log.error("unhandled rejection", error));

const housekeeping = setInterval(() => {
  chat.tick();
  chat.refreshPersona();
}, 60_000);
housekeeping.unref();

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  log.info(`${signal} received, shutting down`);
  brain.stop();
  knowledgeSync?.stop();
  await client.destroy();
  knowledge?.close();
  db.close();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await client.login(token);
