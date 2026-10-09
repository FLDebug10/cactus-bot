import type { Message } from "discord.js";
import { CHANNELS, LINKS } from "../config.ts";
import type { History } from "../grove/history.ts";
import { logger } from "../logger.ts";

const log = logger("signpost");

// "where do I report a bug?", asked to nobody in particular. Grove waits to
// see if a person answers, and points the way only when nobody did. This is
// plain pattern matching, so it works whether or not the brain is awake.

const WAIT_MS = 45_000;
const PER_CHANNEL_MS = 15 * 60_000;
const PER_USER_MS = 30 * 60_000;

const ASKS_WHERE = /\b(where|which channel|what channel)\b[^?.!]{0,50}\b(report|post|put|submit|send|share|suggest|ask|get help|find help|go|download|get)\b|\bhow (do|can|would|should) (i|we|you) (report|submit|suggest|download|get)\b/i;

interface Pointer {
  test: RegExp;
  line: string;
}

const POINTERS: readonly Pointer[] = [
  { test: /\b(bugs?|crash\w*|broken|glitch\w*|issues?|errors?)\b/i, line: `bugs go in <#${CHANNELS.bugReports}>! you can also use \`!report\` and i'll make the post for you` },
  { test: /\b(suggest\w*|ideas?|feature requests?)\b/i, line: `ideas go in <#${CHANNELS.suggestions}>, one post per idea!` },
  { test: /\bjam\b[^?.!]*\b(submit\w*|entr(y|ies))\b|\b(submit\w*|entr(y|ies))\b[^?.!]*\bjam\b/i, line: `jam entries go in <#${CHANNELS.jamSubmissions}>! the rules are in <#${CHANNELS.jamInfo}>` },
  { test: /\bjams?\b/i, line: `everything about the jams is in <#${CHANNELS.jamInfo}>, and people talk about them in <#${CHANNELS.jamDiscussion}>` },
  { test: /\b(addons?|java|code|coding|api)\b/i, line: `<#${CHANNELS.addonSupport}> is the place for java addon help! the addon docs are here: <${LINKS.addonDocs}>` },
  { test: /\b(datapacks?|data packs?|powers?|json|origins? (help|support))\b/i, line: `<#${CHANNELS.datapackSupport}> is the place for datapack and power help! the handbook helps too: <${LINKS.datapackDocs}>` },
  { test: /\b(screenshots?|clips?|videos?|pictures?|pics?|showcase|show off|media)\b/i, line: `pictures and clips go in <#${CHANNELS.mediaGallery}>, and people chat in threads on them!` },
  { test: /\b(download|get|install)\b[^?.!]*\b(apoli|origins|the mods?)\b/i, line: `apoli: <${LINKS.apoliModrinth}> and origins: <${LINKS.originsModrinth}> (they're on curseforge too)` },
  { test: /\b(staff|moderators?|admins?|appeal)\b/i, line: "you can dm me and i'll pass your message to the staff team!" },
];

export function pointerFor(text: string): string | null {
  if (!ASKS_WHERE.test(text)) return null;
  return POINTERS.find(pointer => pointer.test.test(text))?.line ?? null;
}

export class Signpost {
  private readonly history: History;
  private readonly isSupportChannel: (message: Message) => boolean;
  private readonly lastInChannel = new Map<string, number>();
  private readonly lastForUser = new Map<string, number>();

  constructor(history: History, isSupportChannel: (message: Message) => boolean) {
    this.history = history;
    this.isSupportChannel = isSupportChannel;
  }

  consider(message: Message): void {
    if (!message.inGuild() || this.isSupportChannel(message)) return;
    if (message.reference !== null || message.mentions.users.size > 0) return;
    const line = pointerFor(message.content);
    if (line === null) return;
    const now = Date.now();
    if (now - (this.lastInChannel.get(message.channelId) ?? 0) < PER_CHANNEL_MS) return;
    if (now - (this.lastForUser.get(message.author.id) ?? 0) < PER_USER_MS) return;

    setTimeout(() => {
      // Somebody else already said something: they're probably helping.
      const after = this.history.after(message.channelId, message.id);
      if (after.some(seen => seen.authorId !== message.author.id && !seen.isBot)) return;
      const at = Date.now();
      this.lastInChannel.set(message.channelId, at);
      this.lastForUser.set(message.author.id, at);
      message.reply({ content: `psst! ${line}`, allowedMentions: { parse: [], repliedUser: false }, failIfNotExists: false })
        .catch(error => log.warn("could not point the way", error));
    }, WAIT_MS).unref?.();
  }
}
