import { AttachmentBuilder, type Client, type Message, MessageReferenceType } from "discord.js";
import { fileURLToPath } from "node:url";
import { BRAIN, CHANNELS, type ChannelKey, codeSourcesOf, CREW, type CrewMember, MAIN_BUILD, MODERATION } from "../config.ts";
import type { StrikeStore } from "../db/strikes.ts";
import { isStaff } from "../discord/members.ts";
import { addressingOf } from "../grove/addressing.ts";
import { type BrainChain, BrainUnavailable, type ToolBox } from "../grove/brain.ts";
import { checkedReply } from "../grove/checked.ts";
import { History } from "../grove/history.ts";
import type { Schema } from "../grove/knowledge/schema.ts";
import type { KnowledgeStore } from "../grove/knowledge/store.ts";
import { describeGifs, gifAttachment } from "../grove/links.ts";
import { gatherNotes, hintsOf, mainTypeOf, type Note, notesQuery } from "../grove/notes.ts";
import { persona, rightNow } from "../grove/persona.ts";
import { buildPrompt } from "../grove/prompt.ts";
import { promisedLookup } from "../grove/promises.ts";
import { asksAboutExplosives, EXPLOSIVE_LINES, explicitMatch, explicitReply, mentionsRealExplosives, TNT_RECIPE_IMAGE } from "../grove/reflexes.ts";
import { groveTools } from "../grove/tools.ts";
import type { Addressing, ChannelInfo, ChatLine, TextAttachment } from "../grove/types.ts";
import { splitMessage, voice } from "../grove/voice.ts";
import { logger } from "../logger.ts";

const log = logger("chat");

const asset = (name: string) => fileURLToPath(new URL(`../../assets/${name}`, import.meta.url));

// Where Grove sends people, in its own words. Modmail is a staff forum, so it isn't listed.
const PURPOSES: Partial<Record<ChannelKey, string>> = {
  bugReports: "report bugs in Apoli, Origins or the Handbook (the !report command makes the post for you)",
  suggestions: "ideas and feature requests, one post per idea",
  datapackSupport: "help with making powers and datapacks",
  addonSupport: "help with Java addons for Apoli and Origins",
  mediaGallery: "screenshots and clips only, people talk in threads on the posts",
  jamInfo: "jam info, dates, themes and rules",
  jamSubmissions: "where jam entries are submitted",
  jamDiscussion: "where people talk about the jams",
};

const TEXT_FILE = /\.(json|txt|log|mcfunction|java|toml|ya?ml|md|properties|mcmeta|cfg|js|ts)$/i;
const IMAGE_TYPE = /^image\/(png|jpe?g|webp)$/i;

const DEBOUNCE_MS = 1_500;
const STALE_MS = 3 * 60_000;
const OFFLINE_NOTICE_EVERY_MS = 15 * 60_000;
const TRANSCRIPT_LINES = 16;
// Tool results one reply may collect. The notes already carry most of what a lookup would find.
const TOOL_CHARS = 4_000;
const CODE_SOURCES = codeSourcesOf(MAIN_BUILD);
const TRANSCRIPT_AGE_MS = 45 * 60_000;
const OFFLINE_LINE = "zzz... my chatting brain is napping right now, so i can't chat. my commands still work though, try !help";
const OFF_TOPIC_LINE = "hmm, let's talk about something else!";

interface Job {
  message: Message<true>;
  addressing: Addressing;
  queuedAt: number;
}

interface ThreadInfo {
  name: string;
  parent: string;
  starter: string | null;
}

export interface ChatOptions {
  client: Client;
  brain: BrainChain;
  knowledge: KnowledgeStore | null;
  strikes: StrikeStore;
  timezone: string;
  // "!name: what it does" for every public command, for the persona.
  commands: () => readonly string[];
  // Channels where Grove never chats (the modmail and suggestion forums, the media gallery).
  isQuiet: (message: Message) => boolean;
  random?: () => number;
}

// Connects Grove's brain to Discord. Every message is remembered as context.
// A message meant for Grove gets the reflexes first (explosives, explicit
// stuff), then a reply from the brain when it's awake, or a sleepy 💤 when
// it isn't. Replies are made one at a time, in order.
export class GroveChat {
  readonly history = new History();
  private readonly options: ChatOptions;
  private readonly tools: ToolBox;
  private readonly random: () => number;
  private readonly hushedUntil = new Map<string, number>();
  private readonly lastOfflineNotice = new Map<string, number>();
  private readonly waiting = new Map<string, { timer: ReturnType<typeof setTimeout>; job: Job }>();
  private readonly active = new Set<string>();
  private readonly covered = new Set<string>();
  private readonly threads = new Map<string, ThreadInfo>();
  private readonly queue: Job[] = [];
  private working = false;
  private channelList: ChannelInfo[];
  private personaText: string;

  constructor(options: ChatOptions) {
    this.options = options;
    this.random = options.random ?? Math.random;
    this.tools = groveTools(options.knowledge, this.random);
    this.channelList = defaultChannels();
    this.personaText = persona({ channels: this.channelList, commands: options.commands() });
  }

  get channels(): readonly ChannelInfo[] {
    return this.channelList;
  }

  // Once logged in: learn the channels' real names, so "#bug-reports" in a reply becomes a link.
  async ready(): Promise<void> {
    const resolved: ChannelInfo[] = [];
    for (const info of defaultChannels()) {
      const channel = await this.options.client.channels.fetch(info.id).catch(() => null);
      const name = channel !== null && "name" in channel && typeof channel.name === "string" ? cleanChannelName(channel.name) : "";
      resolved.push(name.length > 0 ? { ...info, name } : info);
    }
    this.channelList = resolved;
    this.refreshPersona();
  }

  // Custom commands change at runtime, and the persona lists them.
  refreshPersona(): void {
    this.personaText = persona({ channels: this.channelList, commands: this.options.commands() });
  }

  hush(channelId: string, minutes: number): void {
    if (minutes <= 0) this.hushedUntil.delete(channelId);
    else this.hushedUntil.set(channelId, Date.now() + minutes * 60_000);
  }

  tick(): void {
    const now = Date.now();
    this.history.prune(now);
    for (const [channelId, until] of this.hushedUntil) if (until <= now) this.hushedUntil.delete(channelId);
    if (this.covered.size > 2_000) this.covered.clear();
    if (this.threads.size > 500) this.threads.clear();
  }

  observe(message: Message): void {
    if (!message.inGuild()) return;
    this.history.add(this.toLine(message));
  }

  // Returns true when the message was for Grove (answered, warned, or queued).
  async handle(message: Message): Promise<boolean> {
    const groveId = this.options.client.user?.id;
    if (groveId === undefined || !message.inGuild() || this.options.isQuiet(message)) return false;
    if (message.content.trim().length === 0 && message.attachments.size === 0) return false;

    const now = Date.now();
    const repliedUserId = isReply(message) ? message.mentions.repliedUser?.id ?? null : null;
    const key = `${message.channelId}:${message.author.id}`;
    const addressing = addressingOf({
      content: message.content,
      mentionsGrove: new RegExp(`<@!?${groveId}>`).test(message.content),
      repliesToGrove: repliedUserId === groveId,
      repliesToSomeoneElse: repliedUserId !== null && repliedUserId !== groveId && repliedUserId !== message.author.id,
      mentionsSomeoneElse: [...message.mentions.users.keys()].some(id => id !== groveId && id !== repliedUserId),
      talkingWithGrove: this.history.talkingWith(message.channelId, message.author.id, now) || this.active.has(key),
    });
    if (addressing === null) return false;
    if ((this.hushedUntil.get(message.channelId) ?? 0) > now && addressing !== "direct") return false;

    // The reflexes don't need the brain, so they always work.
    const explicit = explicitMatch(message.content);
    if (explicit !== null) {
      await this.onExplicit(message, explicit);
      return true;
    }
    if (addressing !== "followup" && asksAboutExplosives(message.content)) {
      await this.sendTnt(message);
      return true;
    }

    if (!this.options.brain.online) {
      if (addressing !== "followup") await this.sleepy(message);
      return true;
    }
    this.enqueue({ message, addressing, queuedAt: now });
    return true;
  }

  private async onExplicit(message: Message<true>, matched: string): Promise<void> {
    const now = Date.now();
    const strike = this.options.strikes.add(message.author.id, now, "explicit", message.content, MODERATION.strikeWindowMs);
    let timedOutFor: number | null = null;
    const member = message.member;
    if (strike >= 2 && MODERATION.explicitTimeouts && member !== null) {
      const minutes = MODERATION.timeoutMinutes[Math.min(strike - 2, MODERATION.timeoutMinutes.length - 1)]!;
      if (member.moderatable) {
        try {
          await member.timeout(minutes * 60_000, "Kept asking Grove explicit questions");
          timedOutFor = minutes;
        } catch (error) {
          log.warn(`could not time out ${message.author.tag}`, error);
        }
      } else {
        log.warn(`can't time out ${message.author.tag} (Grove needs Moderate Members, and a role above theirs)`);
      }
    }
    log.info(`explicit strike ${strike} for ${message.author.tag} in ${message.channelId} ("${matched}")${timedOutFor !== null ? `, timed out ${timedOutFor}m` : ""}`);
    await message
      .reply({ content: explicitReply(strike, timedOutFor), allowedMentions: { parse: [], repliedUser: false }, failIfNotExists: false })
      .catch(error => log.warn("could not send the explicit warning", error));
  }

  private async sendTnt(message: Message<true>): Promise<void> {
    const line = EXPLOSIVE_LINES[Math.floor(this.random() * EXPLOSIVE_LINES.length)]!;
    await message
      .reply({
        content: line,
        files: [new AttachmentBuilder(asset(TNT_RECIPE_IMAGE), { name: TNT_RECIPE_IMAGE })],
        allowedMentions: { parse: [], repliedUser: false },
        failIfNotExists: false,
      })
      .catch(error => log.warn("could not send the tnt recipe", error));
    this.history.noteAnswered(message.channelId, message.author.id, Date.now());
  }

  private async sleepy(message: Message<true>): Promise<void> {
    await message.react("💤").catch(() => undefined);
    if (!BRAIN.offlineNotice) return;
    const now = Date.now();
    if (now - (this.lastOfflineNotice.get(message.channelId) ?? 0) < OFFLINE_NOTICE_EVERY_MS) return;
    this.lastOfflineNotice.set(message.channelId, now);
    await message.reply({ content: OFFLINE_LINE, allowedMentions: { parse: [], repliedUser: false }, failIfNotExists: false }).catch(() => undefined);
  }

  // A burst of messages from one person becomes one reply to the last of them.
  private enqueue(job: Job): void {
    const key = `${job.message.channelId}:${job.message.author.id}`;
    const previous = this.waiting.get(key);
    if (previous !== undefined) clearTimeout(previous.timer);
    const addressing = previous !== undefined && previous.job.addressing !== "followup" ? previous.job.addressing : job.addressing;
    const merged: Job = { ...job, addressing };
    this.active.add(key);
    const timer = setTimeout(() => {
      this.waiting.delete(key);
      this.queue.push(merged);
      void this.pump();
    }, DEBOUNCE_MS);
    this.waiting.set(key, { timer, job: merged });
  }

  private async pump(): Promise<void> {
    if (this.working) return;
    this.working = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift()!;
        const key = `${job.message.channelId}:${job.message.author.id}`;
        try {
          if (!this.covered.has(job.message.id) && Date.now() - job.queuedAt < STALE_MS) await this.respond(job);
        } catch (error) {
          if (error instanceof BrainUnavailable) {
            if (job.addressing !== "followup") await this.sleepy(job.message);
          } else {
            log.error("could not answer", error);
          }
        } finally {
          const stillWaiting = this.waiting.has(key) || this.queue.some(queued => `${queued.message.channelId}:${queued.message.author.id}` === key);
          if (!stillWaiting) this.active.delete(key);
        }
      }
    } finally {
      this.working = false;
    }
  }

  private async respond(job: Job): Promise<void> {
    const { message } = job;
    // A follow-up may well be for someone else, so no "Grove is typing..." for those.
    const stopTyping = job.addressing === "followup" ? () => undefined : this.typing(message);
    try {
      await this.backfill(message);
      const target = this.history.find(message.channelId, message.id) ?? this.toLine(message);
      // Anything the same person added while Grove was busy is part of the question.
      const extra = this.history.after(message.channelId, message.id).filter(line => line.authorId === message.author.id && !this.covered.has(line.id));
      const merged: ChatLine = extra.length === 0 ? target : { ...target, content: [target.content, ...extra.map(line => line.content)].join("\n") };
      const transcript = this.history.before(message.channelId, message.id, TRANSCRIPT_LINES, TRANSCRIPT_AGE_MS);
      const replyTo = await this.repliedLine(message);
      const thread = await this.threadInfo(message);
      const attachments = await readTextAttachments(message);
      const images = BRAIN.vision && this.options.brain.can("vision") ? await readImages(message) : [];
      const schema = this.schema();
      const notes = this.notesFor(merged, replyTo, transcript, schema);

      const prompt = buildPrompt({
        persona: this.personaText,
        moment: rightNow({
          now: Date.now(),
          timezone: this.options.timezone,
          channel: thread?.parent ?? cleanChannelName(message.channel.name),
          thread: thread?.name ?? null,
          threadStarter: thread?.starter ?? null,
          speaker: { id: message.author.id, name: target.authorName, crew: crewOf(message.author.id), staff: isStaff(message.member) },
          addressing: job.addressing,
          imageCount: images.length,
          gif: merged.content.includes("[gif"),
        }),
        notes,
        transcript,
        target: merged,
        replyTo,
        attachments,
        followup: job.addressing === "followup",
      });

      const reply = await checkedReply(
        this.options.brain,
        {
          system: prompt.system,
          messages: prompt.messages,
          images,
          tools: this.tools,
          maxToolRounds: 3,
          toolBudget: TOOL_CHARS,
          followThrough: text => promisedLookup(text, merged.content),
          ...prompt.sampling,
        },
        schema,
        { mainType: mainTypeOf(notes), hints: hintsOf(notes) },
      );
      for (const line of [target, ...extra]) this.covered.add(line.id);
      let text = voice(reply.text, { channels: this.channelList });
      if (text === null) {
        log.info(`stayed quiet for ${target.authorName} in ${message.channelId} (${reply.ms} ms)`);
        return;
      }
      if (explicitMatch(text) !== null) text = OFF_TOPIC_LINE;
      if (mentionsRealExplosives(text)) {
        await this.sendTnt(message);
        return;
      }

      // A long answer (prose and a big json block) goes out as two messages, never cut mid-json.
      const [first, ...rest] = splitMessage(text);
      await message.reply({ content: first!, allowedMentions: { parse: [], repliedUser: false }, failIfNotExists: false });
      for (const more of rest) {
        if (message.channel.isSendable()) await message.channel.send({ content: more, allowedMentions: { parse: [] } });
      }
      this.history.noteAnswered(message.channelId, message.author.id, Date.now());
      const tools = `${reply.toolCalls.length > 0 ? `, tools: ${reply.toolCalls.join(" ")}` : ""}${reply.corrected ? ", fixed its json" : ""}`;
      log.info(`answered ${target.authorName} in ${message.channelId} with the ${reply.brain} brain (${job.addressing}, ${reply.ms} ms, ${reply.promptTokens}+${reply.replyTokens} tokens${tools})`);
      if (reply.problems.length > 0) log.info(`its first json had: ${reply.problems.join(" | ")}`);
    } finally {
      stopTyping();
    }
  }

  private typing(message: Message<true>): () => void {
    const channel = message.channel;
    if (!channel.isSendable()) return () => undefined;
    void channel.sendTyping().catch(() => undefined);
    const timer = setInterval(() => void channel.sendTyping().catch(() => undefined), 8_000);
    return () => clearInterval(timer);
  }

  // After a restart Grove has no memory of a channel, so it reads the last few messages once.
  private async backfill(message: Message<true>): Promise<void> {
    if (!this.history.needsBackfill(message.channelId)) return;
    this.history.markBackfilled(message.channelId);
    const earlier = await message.channel.messages.fetch({ limit: 20, before: message.id }).catch(() => null);
    if (earlier === null) return;
    for (const old of earlier.values()) if (old.inGuild()) this.history.add(this.toLine(old));
  }

  private async repliedLine(message: Message<true>): Promise<ChatLine | null> {
    const id = isReply(message) ? message.reference?.messageId : undefined;
    if (id === undefined) return null;
    const known = this.history.find(message.channelId, id);
    if (known !== undefined) return known;
    const fetched = await message.channel.messages.fetch(id).catch(() => null);
    return fetched === null || !fetched.inGuild() ? null : this.toLine(fetched);
  }

  private async threadInfo(message: Message<true>): Promise<ThreadInfo | null> {
    const channel = message.channel;
    if (!channel.isThread()) return null;
    const cached = this.threads.get(channel.id);
    if (cached !== undefined) return cached;
    const starter = await channel.fetchStarterMessage().catch(() => null);
    const info: ThreadInfo = {
      name: channel.name,
      parent: cleanChannelName(channel.parent?.name ?? "forum"),
      starter: starter === null || !starter.inGuild() ? null : squash(this.toLine(starter).content, 700),
    };
    this.threads.set(channel.id, info);
    return info;
  }

  // What exists in the mods, for the notes and for checking the json in a reply. null before the first sync.
  private schema(): Schema | null {
    const knowledge = this.options.knowledge;
    return knowledge === null || knowledge.isEmpty() ? null : knowledge.schema(CODE_SOURCES);
  }

  // What the library says about the message, read before the brain answers.
  // null when the message isn't about the mods (or there is no library yet).
  private notesFor(target: ChatLine, replyTo: ChatLine | null, transcript: readonly ChatLine[], schema: Schema | null): Note[] | null {
    const knowledge = this.options.knowledge;
    if (knowledge === null || knowledge.isEmpty()) return null;
    return gatherNotes(knowledge, notesQuery(target, replyTo, transcript), { codeSources: CODE_SOURCES, ...(schema !== null ? { schema } : {}) });
  }

  // The message as plain text: "@name" for mentions, "#name" for channels, ":name:" for emoji.
  toLine(message: Message<true>): ChatLine {
    const groveId = this.options.client.user?.id ?? null;
    const name = (id: string) => {
      if (id === groveId) return "grove";
      return message.mentions.members?.get(id)?.displayName ?? message.mentions.users.get(id)?.displayName ?? "someone";
    };
    let content = describeGifs(message.content)
      .replace(/<@!?(\d+)>/g, (_, id: string) => `@${name(id)}`)
      .replace(/<@&(\d+)>/g, (_, id: string) => `@${message.mentions.roles.get(id)?.name ?? "role"}`)
      .replace(/<#(\d+)>/g, (_, id: string) => {
        const known = this.channelList.find(channel => channel.id === id);
        const channel = message.mentions.channels.get(id);
        return `#${known?.name ?? (channel !== undefined && "name" in channel && typeof channel.name === "string" ? cleanChannelName(channel.name) : "channel")}`;
      })
      .replace(/<a?:(\w+):\d+>/g, ":$1:");
    const files: string[] = [];
    const gifs: string[] = [];
    for (const attachment of message.attachments.values()) {
      const gif = gifAttachment(attachment.name, attachment.contentType);
      if (gif === null) files.push(attachment.name);
      else gifs.push(gif);
    }
    if (files.length > 0) content += ` [attached: ${files.join(", ")}]`;
    if (gifs.length > 0) content += ` ${gifs.join(" ")}`;
    if (message.stickers.size > 0) content += ` [sticker: ${[...message.stickers.values()].map(sticker => sticker.name).join(", ")}]`;
    if (!content.includes("[gif") && message.embeds.some(found => found.data.type === "gifv")) content += " [gif]";
    const embed = message.embeds[0];
    if (content.trim().length === 0 && embed !== undefined) content = `[embed] ${[embed.title, embed.description].filter(Boolean).join(": ")}`;
    return {
      id: message.id,
      channelId: message.channelId,
      authorId: message.author.id,
      authorName: message.member?.displayName ?? message.author.globalName ?? message.author.username,
      isGrove: message.author.id === groveId,
      isBot: message.author.bot || message.webhookId !== null,
      content,
      at: message.createdTimestamp,
      replyToId: isReply(message) ? message.reference?.messageId ?? null : null,
    };
  }
}

function isReply(message: Message): boolean {
  return message.reference !== null && message.reference.type !== MessageReferenceType.Forward;
}

function crewOf(userId: string): string | null {
  for (const member of Object.keys(CREW) as CrewMember[]) if (CREW[member].id === userId) return member;
  return null;
}

function squash(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max)}…`;
}

// "🐛│bug-reports" -> "bug-reports"
export function cleanChannelName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
}

function defaultChannels(): ChannelInfo[] {
  return (Object.keys(PURPOSES) as ChannelKey[]).map(key => ({
    key,
    id: CHANNELS[key],
    name: key.replace(/([A-Z])/g, "-$1").toLowerCase(),
    purpose: PURPOSES[key]!,
  }));
}

async function download(url: string, maxBytes: number): Promise<Buffer | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;
    const data = Buffer.from(await response.arrayBuffer());
    return data.length > maxBytes ? null : data;
  } catch {
    return null;
  }
}

// Text files people attach (a power's json, a latest.log) are part of the question.
async function readTextAttachments(message: Message): Promise<TextAttachment[]> {
  const out: TextAttachment[] = [];
  for (const attachment of message.attachments.values()) {
    if (out.length >= 2 || !TEXT_FILE.test(attachment.name) || attachment.size > 300_000) continue;
    const data = await download(attachment.url, 300_000);
    if (data === null) continue;
    let text = data.toString("utf8");
    // Logs: the start says what loaded, the end says what broke.
    if (text.length > 6_000) text = `${text.slice(0, 2_500)}\n…\n${text.slice(-3_500)}`;
    out.push({ name: attachment.name, text });
  }
  return out;
}

async function readImages(message: Message): Promise<string[]> {
  const out: string[] = [];
  for (const attachment of message.attachments.values()) {
    if (out.length >= 2 || !IMAGE_TYPE.test(attachment.contentType ?? "") || attachment.size > 4_000_000) continue;
    const data = await download(attachment.url, 4_000_000);
    if (data !== null) out.push(data.toString("base64"));
  }
  return out;
}
