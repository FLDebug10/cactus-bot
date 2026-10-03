import "dotenv/config";
import { ActivityType, ChannelType, Events, type Message } from "discord.js";
import { Grove } from "./brain/grove.ts";
import type { ChatMessage } from "./brain/types.ts";
import { helpText, runCommand } from "./commands/registry.ts";
import { deploySlashCommands, handleInteraction } from "./commands/slash.ts";
import type { Services } from "./commands/command.ts";
import { CHANNELS, SETTINGS } from "./config.ts";
import { CustomCommandStore } from "./db/customCommands.ts";
import { openDatabase } from "./db/database.ts";
import { SqliteMemory } from "./db/groveMemory.ts";
import { ModmailLinks, SuggestionClaims } from "./db/threadLinks.ts";
import { createClient } from "./discord/client.ts";
import { GroveChat } from "./features/chat.ts";
import { MediaGallery } from "./features/mediaGallery.ts";
import { Modmail } from "./features/modmail.ts";
import { tagNewSuggestion } from "./features/suggestions.ts";
import { logger } from "./logger.ts";

const log = logger("main");

if (SETTINGS.token === undefined) {
  log.error("no TOKEN in the environment, set it in .env");
  process.exit(1);
}
const token = SETTINGS.token;

const db = openDatabase(SETTINGS.databasePath);
const client = createClient();

// Forums where chatter would get in the way: suggestion posts are worked
// through by staff, the modmail forum is the DM relay, and the media gallery
// itself is a no-talk zone (its threads are fine).
const QUIET_PARENTS = new Set<string>([CHANNELS.suggestions, CHANNELS.modmail]);
const SUPPORT_CHANNELS = new Set<string>([CHANNELS.bugReports, CHANNELS.datapackSupport, CHANNELS.addonSupport, CHANNELS.suggestions]);

const grove = new Grove({
  memory: new SqliteMemory(db),
  timezone: SETTINGS.timezone,
  helpUnanswered: SETTINGS.helpUnanswered,
  isQuiet: (message: ChatMessage) => message.channelId === CHANNELS.mediaGallery || (message.parentId !== null && QUIET_PARENTS.has(message.parentId)),
  isSupportChannel: (message: ChatMessage) => SUPPORT_CHANNELS.has(message.channelId) || (message.parentId !== null && SUPPORT_CHANNELS.has(message.parentId)),
});

const modmailLinks = new ModmailLinks(db);
const services: Services = {
  client,
  customCommands: new CustomCommandStore(db),
  claims: new SuggestionClaims(db),
  modmailLinks,
  modmail: new Modmail(client, modmailLinks),
  grove,
};
const chat = new GroveChat(grove, client, name => (name === "help" ? helpText(services) : null));
const gallery = new MediaGallery();

client.once(Events.ClientReady, async ready => {
  grove.setIdentity(ready.user.id);
  ready.user.setActivity("Overgrown's Origins", { type: ActivityType.Playing });
  try {
    await deploySlashCommands(token, ready.user.id);
  } catch (error) {
    log.error("could not register slash commands", error);
  }
  log.info(`online as ${ready.user.tag}`);
});

client.on(Events.ThreadCreate, (thread, newlyCreated) => {
  void tagNewSuggestion(thread, newlyCreated);
});

client.on(Events.InteractionCreate, interaction => {
  void handleInteraction(interaction, services.customCommands);
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
  // These conversations are private, so Grove's chat memory never sees them.
  if (services.modmail.isModmailThread(message)) {
    if (!message.author.bot && /^!closemail\b/i.test(message.content.trim())) await services.modmail.close(message);
    else if (!message.author.bot) await services.modmail.fromStaff(message);
    return;
  }

  // Grove keeps the public conversation in mind: other bots and its own lines included,
  // commands and removed gallery posts not.
  if (message.author.bot || message.webhookId !== null) {
    chat.observe(message);
    return;
  }
  if (SETTINGS.moderateMediaGallery && (await gallery.check(message))) return;
  if (await runCommand(message, services)) return;
  chat.observe(message);
  chat.respond(message);
}

client.on(Events.Error, error => log.error("discord client error", error));
process.on("unhandledRejection", error => log.error("unhandled rejection", error));

const housekeeping = setInterval(() => grove.tick(), 60_000);
housekeeping.unref();

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  log.info(`${signal} received, shutting down`);
  grove.tick();
  await client.destroy();
  db.close();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await client.login(token);
