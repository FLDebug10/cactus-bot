// Grove's brain. It:
//
//   1. works out whether the message was aimed at it,
//   2. reads the recent history of the channel for context,
//   3. picks an intent with keyword rules and answers with a random line from
//      that intent's reply pool, never repeating itself.
//
// It keeps a small per-user session so follow ups like "yeah" or "ok" actually
// continue the conversation instead of landing in a generic shrug, and it
// debounces bursts of messages so someone can type three thoughts in a row and
// get one reply to the last one, like a person would.

import type { Message } from "discord.js";
import type { Command } from "./db.ts";
import { MODMAIL_FORUM_ID, SUGGESTIONS_FORUM_ID } from "./index.ts";
import {
  buildReplies,
  detectTopic,
  normalize,
  pickIntent,
  rankIntents,
  tokenize,
  type CommandHint,
  type Intent,
  type RecentMessage,
  type ResponseContext,
  type Topic,
} from "./chatResponses.ts";


// --- tuning ------------------------------------------------------------

/** How long Grove "types" before answering. Makes it feel less like a webhook. */
const RESPONSE_DELAY_MIN = 900;
const RESPONSE_DELAY_MAX = 2600;

/** Messages older than this stop being considered "the same question". */
const QUESTION_MEMORY = 5 * 60 * 1000;

/** A session is dropped this long after its last message. */
const SESSION_TTL = 30 * 60 * 1000;

/** Channel history is reused for this long instead of hitting the API again. */
const HISTORY_TTL = 30 * 1000;

/** How many messages of context to read. */
const HISTORY_LIMIT = 25;

/** Don't reuse one of the last N replies of a pool. */
const ANTI_REPEAT = 5;

/**
 * Upper bound on how long a burst of messages can postpone a reply, so a user
 * typing continuously can't keep Grove waiting indefinitely.
 */
const MAX_DEBOUNCE = 8000;

const PRUNE_INTERVAL = 10 * 60 * 1000;

/** Intents that carry on whatever the conversation was already about. */
const FOLLOW_UP_INTENTS = new Set<Intent>([
  "affirm",
  "deny",
  "uncertain",
  "greeting",
  "thanks",
  "laugh",
  "smalltalk",
  "thinking",
  "statement",
]);

// --- state -------------------------------------------------------------

interface Session {
  userId: string;
  channelId: string;
  /** what Grove last said, so "say that again" works */
  lastReply: string | null;
  lastIntent: Intent | null;
  /** subject of the conversation, so "yeah" means something */
  lastTopic: Topic | null;
  lastTopicAt: number;
  /** recent replies, used to avoid repeating itself */
  recentReplies: string[];
  lastQuestion: string | null;
  lastQuestionAt: number;
  updatedAt: number;
}

interface HistoryCacheEntry {
  at: number;
  messages: RecentMessage[];
}

interface PendingReply {
  timer: ReturnType<typeof setTimeout>;
  startedAt: number;
}

const sessions = new Map<string, Session>();
const pendingReplies = new Map<string, PendingReply>();
const historyCache = new Map<string, HistoryCacheEntry>();

/** ids of messages Grove itself sent, so it can spot replies to itself. */
const botMessageIds = new Set<string>();
const botMessageOrder: string[] = [];

const MAX_BOT_MESSAGE_IDS = 512;

const sessionKey = (channelId: string, userId: string) => `${channelId}:${userId}`;

export function noteBotMessage(id: string) {
  if (botMessageIds.has(id)) return;

  botMessageIds.add(id);
  botMessageOrder.push(id);

  while (botMessageOrder.length > MAX_BOT_MESSAGE_IDS) {
    const oldest = botMessageOrder.shift();

    if (oldest) botMessageIds.delete(oldest);
  }
}

function isReplyToBot(message: Message): boolean {
  const referenceId = message.reference?.messageId;

  if (!referenceId) return false;

  return botMessageIds.has(referenceId);
}

function getSession(channelId: string, userId: string): Session {
  const key = sessionKey(channelId, userId);
  const existing = sessions.get(key);

  if (existing) return existing;

  const session: Session = {
    userId,
    channelId,
    lastReply: null,
    lastIntent: null,
    lastTopic: null,
    lastTopicAt: 0,
    recentReplies: [],
    lastQuestion: null,
    lastQuestionAt: 0,
    updatedAt: Date.now(),
  };

  sessions.set(key, session);

  return session;
}

function prune() {
  const now = Date.now();

  for (const [key, session] of sessions) {
    if (now - session.updatedAt > SESSION_TTL) sessions.delete(key);
  }

  for (const [key, entry] of historyCache) {
    if (now - entry.at > HISTORY_TTL) historyCache.delete(key);
  }
}

const pruneTimer = setInterval(prune, PRUNE_INTERVAL);
pruneTimer.unref?.();


// --- helpers -----------------------------------------------------------

type TextBased = {
  id: string;
  messages: {
    fetch: (options: { limit: number }) => Promise<Map<string, any>>;
    fetch: (id: string) => Promise<any>;
  };
  sendTyping: () => Promise<void>;
};

function asTextBased(message: Message): TextBased | null {
  const channel = message.channel as any;

  if (channel.isDMBased?.()) return null;
  if (typeof channel.messages?.fetch !== "function") return null;

  return channel as TextBased;
}

/** Recent messages of the channel, cached briefly so bursts don't spam the API. */
async function loadHistory(channel: TextBased): Promise<RecentMessage[]> {
  const cached = historyCache.get(channel.id);

  if (cached && Date.now() - cached.at < HISTORY_TTL) return cached.messages;

  try {
    const fetched = await channel.messages.fetch({ limit: HISTORY_LIMIT });

    const messages: RecentMessage[] = [...fetched.values()]
      .filter((message: any) => typeof message.content === "string" && message.content.trim().length > 0)
      .map((message: any) => ({
        id: message.id,
        author: message.author?.username ?? "someone",
        authorId: message.author?.id ?? "",
        content: message.content,
        bot: message.author?.bot === true,
        createdTimestamp: message.createdTimestamp ?? 0,
      }))
      .sort((a: RecentMessage, b: RecentMessage) => a.createdTimestamp - b.createdTimestamp);

    historyCache.set(channel.id, { at: Date.now(), messages });

    return messages;
  } catch (error) {
    console.error("chat: couldn't read channel history:", error);

    return cached?.messages ?? [];
  }
}

async function loadMessage(channel: TextBased, id: string): Promise<string | null> {
  try {
    const message = await channel.messages.fetch(id);

    if (typeof message?.content !== "string" || message.content.trim().length === 0) return null;

    return message.content;
  } catch {
    return null;
  }
}

/**
 * Topics other people have been talking about in this channel, oldest first.
 * Grove's own messages and the asker's own messages are ignored so the bot
 * doesn't end up quoting itself back at the person it is replying to.
 */
function topicsFromHistory(history: RecentMessage[], authorId: string): Topic[] {
  const topics: Topic[] = [];

  const relevant = history
    .filter(entry => !entry.bot && entry.authorId !== authorId)
    .slice(-6);

  for (const entry of relevant) {
    const topic = detectTopic(normalize(entry.content));

    if (topic && !topics.includes(topic)) topics.push(topic);
  }

  return topics;
}

function pickFromPool(pool: string[], recent: string[], random: () => number): string | null {
  const cleaned = pool.filter(line => typeof line === "string" && line.trim().length > 0);

  if (cleaned.length === 0) return null;

  // only look back as far as the pool can afford, otherwise a three line pool
  // ends up with nothing left to say
  const lookback = Math.min(ANTI_REPEAT, Math.floor(cleaned.length / 2));
  const recentSlice = recent.slice(-lookback);
  const fresh = cleaned.filter(line => !recentSlice.includes(line));
  const source = fresh.length > 0 ? fresh : cleaned;

  return source[Math.floor(random() * source.length)];
}


// --- context -----------------------------------------------------------

async function buildContext(
  message: Message,
  channel: TextBased,
  session: Session,
  commands: CommandHint[],
): Promise<ResponseContext> {
  const raw = message.content ?? "";
  const text = normalize(raw);
  const tokens = tokenize(text);
  const history = await loadHistory(channel);

  const referenceId = message.reference?.messageId;
  let referenced: string | null = null;

  if (referenceId) {
    const inHistory = history.find(entry => entry.id === referenceId);

    referenced = inHistory ? inHistory.content : await loadMessage(channel, referenceId);
  }

  const now = Date.now();

  const repeatedQuestion =
    session.lastQuestion === text &&
    now - session.lastQuestionAt < QUESTION_MEMORY;

  return {
    text,
    tokens,
    raw,
    author: message.author.username,
    referenced: referenced === null ? null : normalize(referenced),
    historyTopics: topicsFromHistory(history, message.author.id),
    lastReply: session.lastReply,
    lastTopic:
      now - session.lastTopicAt < QUESTION_MEMORY ? session.lastTopic : null,
    repeatedQuestion,
    commands,
  };
}


// --- answering ---------------------------------------------------------

/**
 * Forums Grove keeps out of. Suggestion posts have staff working through them
 * and the modmail forum is the DM relay, so chatter in either just gets in the
 * way.
 *
 * Read lazily because `index.ts` imports this module — the constants only exist
 * once its body has run.
 */
function isQuietForum(parentId: string | null | undefined): boolean {
  if (parentId == null) return false;

  return parentId === SUGGESTIONS_FORUM_ID || parentId === MODMAIL_FORUM_ID;
}

/** Whether this message is Grove's business. */
export function shouldAnswer(message: Message, botId: string): boolean {
  if (botId.length === 0) return false;
  if (message.author.bot) return false;
  if (message.webhookId != null) return false;

  const channel = message.channel as any;

  // DMs belong to the modmail system.
  if (channel.isDMBased?.()) return false;

  if (isQuietForum(channel.parentId)) return false;

  const content = message.content ?? "";

  if (content.trim().length === 0) return false;

  // real commands win over chatter
  if (content.trim().startsWith("!")) return false;

  if (message.mentions.has(botId)) return true;

  return isReplyToBot(message);
}

/**
 * Entry point. Returns true if Grove took the message, in which case the reply
 * is sent a moment later (after a fake typing delay).
 */
export function handleChat(message: Message, botId: string, commands: Map<string, Command>): boolean {
  if (!shouldAnswer(message, botId)) return false;

  schedule(message, commands);

  return true;
}

function schedule(message: Message, commands: Map<string, Command>) {
  const key = sessionKey(message.channelId, message.author.id);
  const existing = pendingReplies.get(key);
  const now = Date.now();

  // someone is typing a follow up — answer the latest message only
  if (existing) clearTimeout(existing.timer);

  const startedAt = existing?.startedAt ?? now;
  const heldBack = now - startedAt;

  // wait a beat in case another message is coming, but never hold on forever
  const jitter = Math.min(
    RESPONSE_DELAY_MIN + Math.random() * (RESPONSE_DELAY_MAX - RESPONSE_DELAY_MIN),
    Math.max(200, MAX_DEBOUNCE - heldBack),
  );

  const timer = setTimeout(() => {
    pendingReplies.delete(key);

    respond(message, commands).catch(error => {
      console.error("chat: failed to answer:", error);
    });
  }, jitter);

  pendingReplies.set(key, { timer, startedAt });
}

/**
 * Keeps track of what the conversation is *about*, so a follow up like "yeah"
 * or "no" stays on the same subject instead of drifting.
 */
function resolveTopic(intent: Intent, ctx: ResponseContext): Topic | null {
  const direct = detectTopic(ctx.text);

  if (direct) return direct;

  const referenced = ctx.referenced ? detectTopic(ctx.referenced) : null;

  if (referenced) return referenced;

  // acknowledgements keep whatever the last turn was about
  const acknowledging = FOLLOW_UP_INTENTS.has(intent);

  if (acknowledging && ctx.lastTopic) return ctx.lastTopic;

  if (ctx.historyTopics.length > 0) return ctx.historyTopics[0];

  return ctx.lastTopic;
}

async function respond(message: Message, commands: Map<string, Command>) {
  const channel = asTextBased(message);

  if (!channel) return;

  const session = getSession(message.channelId, message.author.id);
  const now = Date.now();

  try {
    await channel.sendTyping();
  } catch {
    // typing indicators are optional, never fail the reply over one
  }

  const hints: CommandHint[] = [...commands.values()].map(command => ({
    cmd: command.cmd,
    help: command.help,
  }));

  const ctx = await buildContext(message, channel, session, hints);
  const ranked = rankIntents(ctx);

  let reply: string | null = null;
  let intent: Intent = "fallback";

  for (let attempt = 0; attempt < 3 && reply === null; attempt++) {
    intent = pickIntent(ranked, Math.random);

    const pool = buildReplies(intent, ctx, Math.random);

    reply = pickFromPool(pool, session.recentReplies, Math.random);

    // last attempt — take whatever is left even if it repeats
    if (reply === null && attempt === 2 && pool.length > 0) {
      reply = pool[Math.floor(Math.random() * pool.length)];
    }
  }

  if (reply === null) return;

  // work out what we ended up talking about, for the next follow up
  const topic = resolveTopic(intent, ctx);

  if (ctx.tokens.size > 0) {
    session.lastQuestion = ctx.text;
    session.lastQuestionAt = now;
  }

  session.lastIntent = intent;
  session.lastReply = reply;
  session.lastTopic = topic;
  session.lastTopicAt = now;
  session.recentReplies = [...session.recentReplies, reply].slice(-20);
  session.updatedAt = now;

  const sent = await message.reply(reply);

  noteBotMessage(sent.id);

  console.log(
    `chat: answered ${message.author.username} in #${message.channel.name ?? message.channelId} ` +
    `(intent=${intent}, topic=${topic ?? "none"})`
  );
}