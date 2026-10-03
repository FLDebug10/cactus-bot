import { read, type Reading } from "./text/reader.ts";
import { addressingOf, type Addressing } from "./understand/addressing.ts";
import { interpret, type Intent, type IntentId, weightOf } from "./understand/intents.ts";
import { sentimentOf } from "./understand/sentiment.ts";
import { findTopics, type Topics } from "./understand/topics.ts";
import { Conversations, type SeenMessage, type Session } from "./state/conversation.ts";
import { dayKey, dayProfile, hourIn } from "./state/day.ts";
import { type Friend, type Memory, newFriend } from "./state/memory.ts";
import { Mood } from "./state/mood.ts";
import { FUN } from "./respond/fun.ts";
import { answerHelpTopic, answerProblemSource, HELP, topicalFallback } from "./respond/help.ts";
import { Picker } from "./respond/picker.ts";
import { SELF } from "./respond/self.ts";
import { answerExpectation, SOCIAL } from "./respond/social.ts";
import { displayName, EMOJI, type Reply, type Responder, type Turn } from "./respond/turn.ts";
import { speak } from "./respond/voice.ts";
import type { ChatMessage, Clock, Decision, Random } from "./types.ts";

export interface GroveOptions {
  memory: Memory;
  timezone: string;
  clock?: Clock;
  random?: Random;
  // Answer obvious "where does this go?" questions nobody else answered.
  helpUnanswered?: boolean;
  // Channels where Grove never chats (the modmail and suggestion forums, the media gallery).
  isQuiet?: (message: ChatMessage) => boolean;
  // Channels that already are the right place for help; no unprompted pointers there.
  isSupportChannel?: (message: ChatMessage) => boolean;
}

const RESPONDERS: Partial<Record<IntentId, Responder>> = { ...SOCIAL, ...SELF, ...HELP, ...FUN };

// Intents worth answering when nobody addressed Grove at all, after a pause
// in which no person answered first.
const UNPROMPTED_HELP = new Set<IntentId>(["problem", "suggestion", "media", "jam_info", "jam_submit", "jam_chat", "download", "versions", "install", "contact_staff", "where_to", "channels"]);

// Mid-conversation, these keep Grove talking even without its name.
const CONTINUATION_OK = new Set<IntentId>([
  "confused", "thank", "apologize", "farewell", "love", "hate", "compliment", "insult", "ask_insult",
  "ask_compliment", "how_are_you", "how_is_day", "what_doing", "ask_thinking", "ask_feeling", "ask_identity",
  "ask_is_bot", "ask_alive", "ask_gender", "ask_age", "ask_name", "ask_creator", "ask_species", "ask_home",
  "ask_food", "ask_sleep", "ask_relationship", "ask_like_me", "ask_remember", "tell_name", "ask_favorite",
  "ask_like", "ask_ability", "joke", "fact", "coin", "dice", "choose", "math", "perform", "affection",
  "aggression", "help", "problem", "suggestion", "media", "jam_info", "jam_submit", "jam_chat", "define",
  "download", "versions", "install", "commands", "contact_staff", "origin_list", "best_origin", "how_to",
  "where_to", "distress", "laugh", "share_feeling", "claim_about_grove", "why", "channels", "compat",
]);

// Reactions that, right under one of Grove's messages, are about that message.
const REACTIONS_TO_GROVE = new Set<IntentId>(["confused", "why", "laugh"]);

const ABOUT_GROVE_QUESTIONS = new Set<IntentId>(["ask_is_bot", "ask_alive", "ask_gender", "ask_identity", "ask_species", "ask_age", "ask_name", "ask_creator", "claim_about_grove"]);

const FRAGMENT_WINDOW = 8_000;
const UNANSWERED_WAIT = 45_000;

export class Grove {
  private readonly memory: Memory;
  private readonly timezone: string;
  private readonly clock: Clock;
  private readonly random: Random;
  private readonly helpUnanswered: boolean;
  private readonly isQuiet: (message: ChatMessage) => boolean;
  private readonly isSupportChannel: (message: ChatMessage) => boolean;
  private readonly conversations = new Conversations();
  private readonly picker: Picker;
  private readonly mood: Mood;
  private readonly lastAboutReaction = new Map<string, number>();
  private readonly lastUnprompted = new Map<string, number>();
  private groveId: string | null = null;
  private moodSavedAt = 0;

  constructor(options: GroveOptions) {
    this.memory = options.memory;
    this.timezone = options.timezone;
    this.clock = options.clock ?? { now: () => Date.now() };
    this.random = options.random ?? Math.random;
    this.helpUnanswered = options.helpUnanswered ?? true;
    this.isQuiet = options.isQuiet ?? (() => false);
    this.isSupportChannel = options.isSupportChannel ?? (() => false);
    this.picker = new Picker(this.random);
    const now = this.clock.now();
    this.mood = new Mood(now, at => hourIn(at, this.timezone));

    const saved = this.memory.loadState("mood");
    if (saved !== null) {
      try {
        const { valence, energy, at } = JSON.parse(saved) as { valence: number; energy: number; at: number };
        this.mood.restore(valence, energy, at);
      } catch {
        // A damaged mood record just means Grove starts the day fresh.
      }
    }
  }

  setIdentity(groveId: string): void {
    this.groveId = groveId;
  }

  // Every message Grove can see goes through here first, its own included.
  observe(message: ChatMessage): void {
    const seen: SeenMessage = {
      id: message.id,
      channelId: message.channelId,
      authorId: message.authorId,
      authorName: message.authorName,
      isGrove: this.groveId !== null && message.authorId === this.groveId,
      isBot: message.authorIsBot,
      raw: message.content,
      at: message.createdAt,
      replyToId: message.replyToId,
      replyToAuthorId: message.replyToAuthorId,
      mentionsGrove: message.mentionsGrove,
      mentionedUserIds: message.mentionedUserIds,
    };
    this.conversations.observe(seen);
  }

  // Decides whether and how Grove answers. Call `observe` first.
  consider(message: ChatMessage): Decision | null {
    if (message.authorIsBot || this.groveId === null || message.authorId === this.groveId) return null;
    if (message.content.trim().length === 0 || this.isQuiet(message)) return null;

    const now = this.clock.now();
    const fragments = this.conversations.fragments(message.channelId, message.authorId, now, FRAGMENT_WINDOW);
    const parts = fragments.length > 1 ? fragments : [];
    const raw = parts.length > 0 ? parts.map(part => part.raw).join("\n") : message.content;
    const mentionsGrove = message.mentionsGrove || parts.some(part => part.mentionsGrove);
    const replyToAuthorId = message.replyToAuthorId ?? parts.find(part => part.replyToAuthorId !== null)?.replyToAuthorId ?? null;
    const replyToId = message.replyToId ?? parts.find(part => part.replyToId !== null)?.replyToId ?? null;

    if (this.conversations.hushed(message.channelId, now) && !mentionsGrove) return null;

    const reading = read(raw, this.groveId);
    const topics = findTopics(reading.text, reading.tokens);
    const { intents, greeted } = interpret(reading, topics);
    const repliesToGrove = replyToAuthorId !== null && replyToAuthorId === this.groveId;
    const addressing = addressingOf({
      reading,
      mentionsGrove,
      repliesToGrove,
      repliesToSomeoneElse: replyToAuthorId !== null && !repliesToGrove && replyToAuthorId !== message.authorId,
      mentionsSomeoneElse: message.mentionedUserIds.length > 0,
      inConversation: this.conversations.inConversation(message.channelId, message.authorId, now),
    });

    const primary = pickPrimary(intents);
    if (primary === null) return null;

    const session = this.conversations.session(message.channelId, message.authorId);

    // "tf does that even mean", typed right under Grove's message without the
    // reply button, is still about what Grove just said.
    if (addressing === "none" && REACTIONS_TO_GROVE.has(primary.id) && this.rightAfterGrove(message, now)) {
      return this.respondTo(message, reading, primary, intents, topics, "continuation", greeted, session, replyToId, now, parts);
    }

    if (addressing === "none") return this.unprompted(message, reading.question, primary, intents, topics, reading, now, session, greeted);
    if (addressing === "about") return this.overheard(message, primary, intents, topics, reading, now, session, greeted);
    if (addressing === "continuation" && !this.worthContinuing(primary, session, now)) return null;
    return this.respondTo(message, reading, primary, intents, topics, addressing, greeted, session, replyToId, now, parts);
  }

  private respondTo(message: ChatMessage, reading: Reading, primary: Intent, intents: readonly Intent[], topics: Topics, addressing: Addressing, greeted: boolean, session: Session, replyToId: string | null, now: number, parts: readonly SeenMessage[]): Decision | null {
    if (session.sulkingUntil > now && primary.id !== "apologize" && primary.id !== "distress") return null;
    if (this.conversations.spokeRecently(message.channelId, now, 60_000) >= 10 && addressing !== "direct") return null;

    const turn = this.buildTurn(message, reading, primary, intents, topics, addressing, greeted, session, replyToId, now);
    const reply = this.choose(turn);
    if (reply === null) return null;
    return this.finish(turn, reply, 0, parts.map(part => part.id));
  }

  private rightAfterGrove(message: ChatMessage, now: number): boolean {
    if (message.replyToId !== null || message.mentionedUserIds.length > 0) return false;
    const above = this.conversations.previous(message.channelId, message.id);
    return above !== undefined && above.isGrove && now - above.at < 90_000;
  }

  // After the adapter actually sent a reply, so Grove knows what it said and
  // who it is now talking with. `sentMessageId` is null for a reaction-only decision.
  didSay(decision: Decision, sentMessageId: string | null, sentAt: number): void {
    this.conversations.markHandled(decision.meta.covers);
    if (decision.text === null || sentMessageId === null) return;

    const session = this.conversations.session(decision.meta.channelId, decision.meta.toUserId);
    session.lastAt = sentAt;
    session.lastAct = decision.meta.act;
    if (decision.meta.topic !== null) session.lastTopic = decision.meta.topic;
    session.expectation = decision.meta.expectation;
    session.expectationAt = sentAt;

    this.conversations.remember({
      id: sentMessageId,
      channelId: decision.meta.channelId,
      toUserId: decision.meta.toUserId,
      toUserName: decision.meta.toUserName,
      act: decision.meta.act,
      topic: decision.meta.topic,
      text: decision.text,
      gloss: decision.meta.gloss,
      at: sentAt,
    });
  }

  stillUnanswered(messageId: string): boolean {
    return this.conversations.stillUnanswered(messageId);
  }

  hush(channelId: string, minutes: number): void {
    this.conversations.hush(channelId, minutes <= 0 ? 0 : this.clock.now() + minutes * 60_000);
  }

  misses(limit: number): Array<{ at: number; userId: string; text: string }> {
    return this.memory.recentMisses(limit);
  }

  // Housekeeping, about once a minute.
  tick(): void {
    const now = this.clock.now();
    this.conversations.prune(now);
    if (now - this.moodSavedAt > 60_000) {
      const snapshot = this.mood.snapshot(now);
      this.memory.saveState("mood", JSON.stringify({ valence: snapshot.valence, energy: snapshot.energy, at: now }));
      this.moodSavedAt = now;
    }
  }

  private worthContinuing(primary: Intent, session: Session, now: number): boolean {
    if (this.conversations.expectationOf(session, now) !== null) return true;
    return CONTINUATION_OK.has(primary.id) && primary.confidence >= 0.75;
  }

  // Grove was named in passing. A heart for kind words, a sad face for mean
  // ones, and a hand raised for questions about itself. Never a flood.
  private overheard(message: ChatMessage, primary: Intent, intents: readonly Intent[], topics: Topics, reading: Reading, now: number, session: Session, greeted: boolean): Decision | null {
    const last = this.lastAboutReaction.get(message.channelId) ?? 0;
    if (now - last < 2 * 60_000) return null;
    const kind = primary.id;

    if (kind === "compliment" || kind === "love") {
      this.lastAboutReaction.set(message.channelId, now);
      this.mood.feel(kind === "love" ? "love" : "compliment", message.authorName, now);
      return reactionOnly(message, [EMOJI.heart], "overheard.kind");
    }
    if (kind === "insult" || kind === "hate") {
      this.lastAboutReaction.set(message.channelId, now);
      this.mood.feel("insult", message.authorName, now);
      if (this.picker.chance(0.3)) {
        const turn = this.buildTurn(message, reading, primary, intents, topics, "about", greeted, session, message.replyToId, now);
        return this.finish(turn, { text: this.picker.pick("overheard.mean", ["i can hear you, you know :(", "hey!! i'm right here :("]), gloss: "i heard that and it was mean", act: "overheard.mean" }, 0);
      }
      return reactionOnly(message, ["🥺"], "overheard.mean");
    }
    if (ABOUT_GROVE_QUESTIONS.has(kind) && reading.question && this.picker.chance(0.7)) {
      this.lastAboutReaction.set(message.channelId, now);
      const turn = this.buildTurn(message, reading, primary, intents, topics, "about", greeted, session, message.replyToId, now);
      const reply = this.choose(turn);
      if (reply === null || reply.silent) return null;
      reply.text = `${this.picker.pick("overheard.lead", ["ooh, that's me! ", "hi, that's me! ", ""])}${reply.text}`;
      return this.finish(turn, reply, 0);
    }
    return null;
  }

  // Nobody talked to Grove, but someone asked where something goes. Wait and
  // see if a person answers first. Grove only steps in when nobody did.
  private unprompted(message: ChatMessage, question: boolean, primary: Intent, intents: readonly Intent[], topics: Topics, reading: Reading, now: number, session: Session, greeted: boolean): Decision | null {
    if (!this.helpUnanswered || !question || this.isSupportChannel(message)) return null;
    if (!UNPROMPTED_HELP.has(primary.id) || primary.confidence < 0.75) return null;
    if (message.replyToId !== null || message.mentionedUserIds.length > 0) return null;
    if (now - (this.lastUnprompted.get(message.channelId) ?? 0) < 15 * 60_000) return null;
    if (now - (this.lastUnprompted.get(`user:${message.authorId}`) ?? 0) < 30 * 60_000) return null;

    const turn = this.buildTurn(message, reading, primary, intents, topics, "none", greeted, session, null, now);
    const reply = this.choose(turn);
    if (reply === null || reply.silent || reply.miss || (reply.expect !== undefined && reply.expect !== null)) return null;

    this.lastUnprompted.set(message.channelId, now);
    this.lastUnprompted.set(`user:${message.authorId}`, now);
    this.conversations.openQuestion(message.id, message.channelId, message.authorId, now);
    reply.text = `${this.picker.pick("unprompted.lead", ["psst! ", "oh, i can help! ", ""])}${reply.text}`;
    return this.finish(turn, reply, UNANSWERED_WAIT);
  }

  private buildTurn(message: ChatMessage, reading: Reading, primary: Intent, intents: readonly Intent[], topics: Topics, addressing: Addressing, greeted: boolean, session: Session, replyToId: string | null, now: number): Turn {
    const friend: Friend = this.memory.friend(message.authorId) ?? newFriend(message.authorId, message.authorName, now);
    const repliedTo = replyToId !== null ? this.conversations.find(message.channelId, replyToId) ?? null : null;
    return {
      message,
      reading,
      intent: primary,
      intents,
      topics,
      sentiment: sentimentOf(reading),
      greeted,
      addressing,
      name: friend.nickname ?? displayName(message.authorName),
      friend,
      session,
      mood: this.mood.snapshot(now),
      day: dayProfile(dayKey(now, this.timezone)),
      hour: hourIn(now, this.timezone),
      now,
      picker: this.picker,
      repliedTo,
      repliedLine: replyToId !== null ? this.conversations.line(replyToId) ?? null : null,
      lastLineToThem: this.conversations.lastLineTo(message.channelId, message.authorId, now, 5 * 60_000) ?? null,
      lastLineHere: this.conversations.lastLine(message.channelId) ?? null,
      expectation: this.conversations.expectationOf(session, now),
    };
  }

  private choose(turn: Turn): Reply | null {
    const answered = answerProblemSource(turn) ?? answerHelpTopic(turn) ?? answerExpectation(turn);
    if (answered !== null) return answered;

    const responder = RESPONDERS[turn.intent.id];
    const reply = responder?.(turn) ?? null;
    if (reply !== null) return reply;

    const topical = topicalFallback(turn);
    if (topical !== null) return topical;

    if (turn.intent.id === "statement" || turn.intent.id === "slang") return RESPONDERS.statement!(turn);
    return unknownQuestion(turn);
  }

  // Applies what the reply does to Grove (mood, memory, session) and turns it into a Decision.
  private finish(turn: Turn, reply: Reply, waitForSilenceMs: number, covers: readonly string[] = []): Decision | null {
    const { message, session, friend, now } = turn;
    const who = turn.name;

    if (reply.feel !== undefined) this.mood.feel(reply.feel, who, now);
    if (reply.act === "insult" || reply.act === "hate") session.insults = [...session.insults.filter(at => now - at < 15 * 60_000), now];
    if (reply.act === "compliment" || reply.act === "love" || turn.intent.id === "apologize") session.insults = [];
    if (reply.sulkMs !== undefined) session.sulkingUntil = now + reply.sulkMs;
    if (turn.intent.id === "apologize") session.sulkingUntil = 0;

    // Unprompted help may never be sent (a person might answer first), so it
    // leaves no trace in Grove's memory of who it has talked with.
    const topic = reply.topic ?? null;
    if (waitForSilenceMs === 0) {
      friend.name = message.authorName;
      friend.lastSeen = now;
      friend.talks += 1;
      friend.affinity = Math.max(-1, Math.min(1, friend.affinity + (reply.affinity ?? 0)));
      if (topic !== null) friend.lastTopic = topic;
      this.memory.save(friend);
      session.turns += 1;
    }

    if (reply.miss === true) this.memory.noteMiss(message.channelId, message.authorId, message.content.slice(0, 300), now);

    const silent = reply.silent === true || reply.text.trim().length === 0;
    const reactions = [...(reply.reactions ?? [])];
    if (silent && reactions.length === 0) return null;

    let text: string | null = null;
    if (!silent) {
      let body = reply.text;
      if (turn.greeted && turn.intent.id !== "greet" && turn.intent.id !== "distress" && this.picker.chance(0.5)) {
        body = `${this.picker.pick("greet.lead", [`hi ${turn.name}! `, "hii! ", "hello! "])}${body}`;
      }
      const informative = /^(route|define|download|versions|install|modmail|commands|howto|origin_list|server_info|distress|channels)/.test(reply.act ?? "");
      const somber = reply.feel === "sad_news" || reply.feel === "insult" || reply.feel === "hate" || reply.feel === "aggression";
      text = speak(body, this.mood.snapshot(now), this.random, !informative && !somber);
    }

    const delayMs = text === null ? 300 + Math.floor(this.random() * 600) : Math.min(4500, 700 + text.length * 25 + Math.floor(this.random() * 500));
    return {
      replyToMessageId: message.id,
      text,
      reactions,
      delayMs,
      waitForSilenceMs,
      meta: {
        covers: covers.length > 0 ? covers : [message.id],
        act: reply.act ?? turn.intent.id,
        topic,
        channelId: message.channelId,
        toUserId: message.authorId,
        toUserName: turn.name,
        gloss: reply.gloss ?? null,
        expectation: reply.expect ?? null,
      },
    };
  }
}

function pickPrimary(intents: readonly Intent[]): Intent | null {
  let best: Intent | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const intent of intents) {
    const score = weightOf(intent.id) * (0.5 + intent.confidence);
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }
  return best;
}

function reactionOnly(message: ChatMessage, reactions: readonly string[], act: string): Decision {
  return {
    replyToMessageId: message.id,
    text: null,
    reactions,
    delayMs: 400,
    waitForSilenceMs: 0,
    meta: { covers: [message.id], act, topic: null, channelId: message.channelId, toUserId: message.authorId, toUserName: message.authorName, gloss: null, expectation: null },
  };
}

// A question Grove has no answer for. Honest, in character, and pointing
// somewhere useful when the question sounds like mod business.
function unknownQuestion(turn: Turn): Reply {
  const text = turn.reading.text;
  const { picker } = turn;
  if (/^(will (i|we)|should (i|we)|am i going to|is it going to|are we going to|do i have a chance)\b/.test(text)) {
    return {
      text: picker.pick("eightball", ["hmm... my moss says yes!", "my leaf is twitching... that means probably!", "ask me again after my nap", "the orb of origin says... maybe?", "hmm, my moss says not today"]),
      gloss: "it was just a fun guess, i can't really see the future",
      act: "eightball",
    };
  }
  if (/\b(you|your|yourself)\b/.test(text)) {
    return {
      text: picker.pick("q.self", ["ooh, a question about me! hmm, i'm not sure, i'm just a slime. ask me something easier, like my favorite color", "hmm, i don't know that about myself! i'm still figuring me out"]),
      gloss: "i don't know the answer to that about myself",
      act: "question.self",
      miss: true,
    };
  }
  return {
    text: picker.pick("q.unknown", [
      "hmm, i don't know that one... i'm a slime, i mostly know about the server and the mods! maybe someone here knows?",
      "that's a tough one for my mossy brain! i know the server and the mods best",
      "ooh, no idea! but if it's about the mods or the server, try asking me a different way",
    ]),
    gloss: "i didn't know the answer",
    act: "question.unknown",
    miss: true,
  };
}
