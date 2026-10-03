import { read, type Reading } from "./text/reader.ts";
import { addressingOf, type Addressing } from "./understand/addressing.ts";
import { interpret, type Intent, type IntentId, weightOf } from "./understand/intents.ts";
import { sentimentOf } from "./understand/sentiment.ts";
import { findTopics, type Topics } from "./understand/topics.ts";
import { Conversations, type SeenMessage, type Session } from "./state/conversation.ts";
import { calendarIn, dayKey, dayProfile, hourIn } from "./state/day.ts";
import { type Friend, type Memory, newFriend } from "./state/memory.ts";
import { Mood } from "./state/mood.ts";
import { FANTASY } from "./respond/fantasy.ts";
import { FUN } from "./respond/fun.ts";
import { answerHelpTopic, answerProblemSource, HELP, topicalFallback } from "./respond/help.ts";
import { Picker } from "./respond/picker.ts";
import { SELF } from "./respond/self.ts";
import { answerExpectation, SOCIAL } from "./respond/social.ts";
import { displayName, EMOJI, type Reply, type Responder, type Turn } from "./respond/turn.ts";
import { speak } from "./respond/voice.ts";
import { LINKS } from "../config.ts";
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

const RESPONDERS: Partial<Record<IntentId, Responder>> = { ...SOCIAL, ...SELF, ...HELP, ...FUN, ...FANTASY };

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
  "bomb", "follow_up", "favorite_person", "more", "doubt", "where_am_i", "ask_origin_story", "ask_body", "ask_size",
  "can_i_you", "hypothetical", "favorite_guess", "ask_have", "ask_fear", "frog_alert", "give", "ask_now", "ask_crew", "self_how",
  "politics", "fan", "homework", "dumb_question", "fantasy", "slang",
]);

// Reactions that, right under one of Grove's messages, are about that message.
const REACTIONS_TO_GROVE = new Set<IntentId>(["confused", "why", "laugh", "follow_up", "more", "doubt"]);

// The words a follow-up can swap in when Grove's answer was about a day.
const TIME_WORDS = /\b(today|tonight|tomorrow|yesterday|right now|now)\b/;
const TIME_FOCUS = /^(today|tonight|tomorrow|yesterday|right now|now|last night)$/;

// The detail a follow-up replaces: "what about color?" after "what is your favorite food".
const SWAPPABLE_SLOTS = ["thing", "term", "verb", "word", "task", "feeling"] as const;
// Last words a follow-up must not replace: "how old are you" + "what about drizzo" is not "how old are drizzo".
const UNSWAPPABLE_ENDINGS = new Set(["you", "me", "it", "that", "this", "there", "them", "him", "her", "us", "grove", "today", "now"]);

const ABOUT_GROVE_QUESTIONS = new Set<IntentId>([
  "ask_is_bot", "ask_alive", "ask_gender", "ask_identity", "ask_species", "ask_age", "ask_name", "ask_creator", "claim_about_grove",
  "ask_fear", "ask_body", "ask_size", "ask_origin_story", "ask_have",
]);

// "grove is a hot dog a sandwich?" reads like a remark about Grove, but these
// can only be questions put to it.
const ALWAYS_TO_GROVE = new Set<IntentId>(["dumb_question", "politics", "math"]);

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
    let addressing = addressingOf({
      reading,
      mentionsGrove,
      repliesToGrove,
      repliesToSomeoneElse: replyToAuthorId !== null && !repliesToGrove && replyToAuthorId !== message.authorId,
      mentionsSomeoneElse: message.mentionedUserIds.length > 0,
      inConversation: this.conversations.inConversation(message.channelId, message.authorId, now),
    });

    const plan = planFor(intents);
    if (plan === null) return null;
    const primary = plan.primary;
    if (addressing === "about" && ALWAYS_TO_GROVE.has(primary.id) && reading.names[0]?.index === 0) addressing = "vocative";

    const session = this.conversations.session(message.channelId, message.authorId);

    // "tf does that even mean", typed right under Grove's message without the
    // reply button, is still about what Grove just said.
    if (addressing === "none" && REACTIONS_TO_GROVE.has(primary.id) && this.rightAfterGrove(message, now)) {
      return this.respondTo(message, reading, plan, intents, topics, "continuation", greeted, session, replyToId, now, parts);
    }

    if (addressing === "none") return this.unprompted(message, reading.question, plan, intents, topics, reading, now, session, greeted);
    if (addressing === "about") return this.overheard(message, plan, intents, topics, reading, now, session, greeted);
    if (addressing === "continuation" && !this.worthContinuing(primary, session, now)) return null;
    return this.respondTo(message, reading, plan, intents, topics, addressing, greeted, session, replyToId, now, parts);
  }

  private respondTo(message: ChatMessage, reading: Reading, plan: Plan, intents: readonly Intent[], topics: Topics, addressing: Addressing, greeted: boolean, session: Session, replyToId: string | null, now: number, parts: readonly SeenMessage[]): Decision | null {
    const primary = plan.primary;
    if (session.sulkingUntil > now && primary.id !== "apologize" && primary.id !== "distress") return null;
    if (this.conversations.spokeRecently(message.channelId, now, 60_000) >= 10 && addressing !== "direct") return null;

    const turn = this.buildTurn(message, reading, plan, intents, topics, addressing, greeted, session, replyToId, now);
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
      intent: decision.meta.intent,
      slots: decision.meta.slots,
      question: decision.meta.question,
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
  private overheard(message: ChatMessage, plan: Plan, intents: readonly Intent[], topics: Topics, reading: Reading, now: number, session: Session, greeted: boolean): Decision | null {
    const last = this.lastAboutReaction.get(message.channelId) ?? 0;
    if (now - last < 2 * 60_000) return null;
    const said = plan.lead ?? plan.primary;
    const kind = said.id;
    // "grove has so much rizz" is praise too.
    const praisingSlang = kind === "slang" && said.slots["tone"] === "praise" && said.slots["use"] === "you";

    if (kind === "compliment" || kind === "love" || kind === "fan" || praisingSlang) {
      this.lastAboutReaction.set(message.channelId, now);
      this.mood.feel(kind === "love" ? "love" : "compliment", message.authorName, now);
      return reactionOnly(message, [EMOJI.heart], "overheard.kind");
    }
    if (kind === "insult" || kind === "hate") {
      this.lastAboutReaction.set(message.channelId, now);
      this.mood.feel("insult", message.authorName, now);
      if (this.picker.chance(0.3)) {
        const turn = this.buildTurn(message, reading, plan, intents, topics, "about", greeted, session, message.replyToId, now);
        return this.finish(turn, { text: this.picker.pick("overheard.mean", ["i can hear you, you know :(", "hey!! i'm right here :("]), gloss: "i heard that and it was mean", act: "overheard.mean" }, 0);
      }
      return reactionOnly(message, ["🥺"], "overheard.mean");
    }
    if (ABOUT_GROVE_QUESTIONS.has(kind) && reading.question && this.picker.chance(0.7)) {
      this.lastAboutReaction.set(message.channelId, now);
      const turn = this.buildTurn(message, reading, plan, intents, topics, "about", greeted, session, message.replyToId, now);
      const reply = this.choose(turn);
      if (reply === null || reply.silent) return null;
      reply.text = `${this.picker.pick("overheard.lead", ["ooh, that's me! ", "hi, that's me! ", ""])}${reply.text}`;
      return this.finish(turn, reply, 0);
    }
    return null;
  }

  // Nobody talked to Grove, but someone asked where something goes. Wait and
  // see if a person answers first. Grove only steps in when nobody did.
  private unprompted(message: ChatMessage, question: boolean, plan: Plan, intents: readonly Intent[], topics: Topics, reading: Reading, now: number, session: Session, greeted: boolean): Decision | null {
    const primary = plan.primary;
    if (!this.helpUnanswered || !question || this.isSupportChannel(message)) return null;
    if (!UNPROMPTED_HELP.has(primary.id) || primary.confidence < 0.75) return null;
    if (message.replyToId !== null || message.mentionedUserIds.length > 0) return null;
    if (now - (this.lastUnprompted.get(message.channelId) ?? 0) < 15 * 60_000) return null;
    if (now - (this.lastUnprompted.get(`user:${message.authorId}`) ?? 0) < 30 * 60_000) return null;

    const turn = this.buildTurn(message, reading, { primary, lead: null, also: null }, intents, topics, "none", greeted, session, null, now);
    const reply = this.choose(turn);
    if (reply === null || reply.silent || reply.miss || (reply.expect !== undefined && reply.expect !== null)) return null;

    this.lastUnprompted.set(message.channelId, now);
    this.lastUnprompted.set(`user:${message.authorId}`, now);
    this.conversations.openQuestion(message.id, message.channelId, message.authorId, now);
    reply.text = `${this.picker.pick("unprompted.lead", ["psst! ", "oh, i can help! ", ""])}${reply.text}`;
    return this.finish(turn, reply, UNANSWERED_WAIT);
  }

  private buildTurn(message: ChatMessage, reading: Reading, plan: Plan, intents: readonly Intent[], topics: Topics, addressing: Addressing, greeted: boolean, session: Session, replyToId: string | null, now: number): Turn {
    const friend: Friend = this.memory.friend(message.authorId) ?? newFriend(message.authorId, message.authorName, now);
    const repliedTo = replyToId !== null ? this.conversations.find(message.channelId, replyToId) ?? null : null;
    return {
      message,
      reading,
      intent: plan.primary,
      intents,
      lead: plan.lead,
      also: plan.also,
      topics,
      sentiment: sentimentOf(reading),
      greeted,
      addressing,
      name: friend.nickname ?? displayName(message.authorName),
      friend,
      session,
      mood: this.mood.snapshot(now),
      day: dayProfile(dayKey(now, this.timezone)),
      dayAt: offset => dayProfile(dayKey(now + offset * 86_400_000, this.timezone)),
      topFriends: limit => this.memory.favorites(limit),
      hour: hourIn(now, this.timezone),
      calendar: calendarIn(now, this.timezone),
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

    if (turn.intent.id === "follow_up") {
      const resolved = this.resolveFollowUp(turn);
      const reply = resolved === null ? null : this.choose(resolved);
      if (resolved !== null && reply !== null) {
        reply.act ??= resolved.intent.id;
        reply.about ??= { intent: resolved.intent.id, slots: resolved.intent.slots, question: questionOf(resolved) };
        return reply;
      }
    }

    const responder = RESPONDERS[turn.intent.id];
    const reply = responder?.(turn) ?? null;
    if (reply !== null) return this.withSecondAnswer(turn, reply);

    const topical = topicalFallback(turn);
    if (topical !== null) return topical;

    if (turn.intent.id === "statement" || turn.intent.id === "slang") return RESPONDERS.statement!(turn);
    return unknownQuestion(turn);
  }

  // "what's the leafy part on your head? are you a sub-species?": answer both.
  private withSecondAnswer(turn: Turn, reply: Reply): Reply {
    const second = turn.also;
    if (second === null || reply.silent === true || reply.command !== undefined) return reply;
    const extra = RESPONDERS[second.id]?.({ ...turn, intent: second, also: null }) ?? null;
    if (extra === null || extra.silent === true || extra.text.length === 0 || extra.act === reply.act) return reply;
    const first = /[.!?)*]$/.test(reply.text.trim()) ? reply.text.trim() : `${reply.text.trim()}.`;
    const joined = `${first} ${this.picker.pick("also", ["oh, and ", "and ", "also, "])}${extra.text}`;
    if (joined.length > 600) return reply;
    return {
      ...reply,
      text: joined,
      gloss: reply.gloss !== undefined && reply.gloss !== null && extra.gloss ? `${reply.gloss}, and ${extra.gloss}` : reply.gloss ?? extra.gloss ?? null,
      files: [...(reply.files ?? []), ...(extra.files ?? [])],
      miss: reply.miss === true && extra.miss === true,
    };
  }

  // "what about tomorrow?" / "and color?": take the question Grove last answered
  // for this person, swap in the new detail, and read it as a fresh question.
  private resolveFollowUp(turn: Turn): Turn | null {
    const focus = (turn.intent.slots["focus"] ?? "").replace(/^(the|your|a|an) /, "").trim();
    if (focus.length === 0) return null;
    const recentHere = turn.lastLineHere !== null && turn.now - turn.lastLineHere.at < 90_000 ? turn.lastLineHere : null;
    const line = turn.repliedLine ?? turn.lastLineToThem ?? recentHere;

    let question = focus;
    if (line !== null && line.question.length > 0) {
      if (TIME_FOCUS.test(focus)) {
        question = TIME_WORDS.test(line.question) ? line.question.replace(TIME_WORDS, focus) : `${line.question} ${focus}`;
      } else {
        const detail = SWAPPABLE_SLOTS.map(slot => line.slots[slot]).find(value => value !== undefined && value.length > 0);
        const words = line.question.split(" ");
        const last = words[words.length - 1] ?? "";
        if (detail !== undefined && line.question.includes(detail)) question = line.question.replace(detail, focus);
        else if (words.length >= 3 && !UNSWAPPABLE_ENDINGS.has(last)) question = [...words.slice(0, -1), focus].join(" ");
      }
    }

    const reading = read(question, this.groveId);
    const topics = findTopics(reading.text, reading.tokens);
    const primary = pickPrimary(interpret(reading, topics).intents);
    if (primary === null || primary.id === "follow_up") return null;
    return { ...turn, reading, topics, intent: primary, intents: [primary], lead: null, also: null, sentiment: sentimentOf(reading) };
  }

  // A few words for the compliment, thanks or love that came along with a question.
  private leadIn(turn: Turn, kind: IntentId): string {
    switch (kind) {
      case "compliment":
        this.mood.feel("compliment", turn.name, turn.now);
        turn.friend.affinity = Math.min(1, turn.friend.affinity + 0.05);
        return this.picker.pick("lead.compliment", ["aww thank you!! ", "hehe, you're sweet! ", "eee thank you! "]);
      case "love":
        this.mood.feel("love", turn.name, turn.now);
        turn.friend.affinity = Math.min(1, turn.friend.affinity + 0.08);
        return this.picker.pick("lead.love", ["love you too!! ", "aww, love you too! "]);
      case "thank":
        this.mood.feel("thanks", turn.name, turn.now);
        return this.picker.pick("lead.thank", ["you're welcome! ", "anytime! "]);
      case "laugh":
        return "hehe ";
      case "greet":
        return this.picker.pick("lead.greet", [`hi ${turn.name}! `, "hii! "]);
      case "dumb_question":
        return this.picker.pick("lead.dumb", ["no such thing as a dumb question! ", "not dumb at all! "]);
      default:
        return "";
    }
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

    const silent = reply.silent === true || reply.text.trim().length === 0;
    // The lead-in also moves Grove's feelings, so it is worked out before memory is saved.
    const lead = !silent && turn.lead !== null ? this.leadIn(turn, turn.lead.id) : "";

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

    const reactions = [...(reply.reactions ?? [])];
    if (silent && reactions.length === 0) return null;

    let text: string | null = null;
    if (!silent) {
      let body = reply.text;
      if (lead.length > 0) body = `${lead}${body}`;
      else if (turn.greeted && turn.intent.id !== "greet" && turn.intent.id !== "distress" && this.picker.chance(0.5)) {
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
      files: silent ? [] : [...(reply.files ?? [])],
      command: silent ? null : reply.command ?? null,
      delayMs,
      waitForSilenceMs,
      meta: {
        covers: covers.length > 0 ? covers : [message.id],
        act: reply.act ?? turn.intent.id,
        intent: reply.about?.intent ?? turn.intent.id,
        slots: reply.about?.slots ?? turn.intent.slots,
        question: reply.about?.question ?? questionOf(turn),
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

// Social bits that can preface a real answer: "ur adorable, do u think u'll fit in my pocket?"
const LEAD_INS = new Set<IntentId>(["compliment", "love", "thank", "laugh", "greet"]);
// Things that never need answering a second time in the same reply.
const NOT_A_SECOND_ANSWER = new Set<IntentId>([
  "compliment", "love", "thank", "greet", "farewell", "insult", "hate", "apologize", "laugh", "ack", "agree", "disagree",
  "statement", "question", "distress", "confused", "why", "more", "doubt", "follow_up", "slang",
]);

interface Plan {
  primary: Intent;
  lead: Intent | null;
  also: Intent | null;
}

function planFor(intents: readonly Intent[]): Plan | null {
  const best = pickPrimary(intents);
  if (best === null) return null;
  let primary = best;
  let lead: Intent | null = null;
  if (LEAD_INS.has(best.id)) {
    const substance = pickPrimary(intents.filter(intent => intent.clause !== best.clause && !LEAD_INS.has(intent.id) && intent.id !== "statement" && intent.id !== "ack"));
    if (substance !== null) {
      primary = substance;
      lead = best;
    }
  }
  // "sorry if this is a dumb question, but...": a reassurance, then the answer.
  const worried = intents.find(intent => intent.id === "dumb_question" && intent.slots["kind"] === "remark" && intent.clause !== primary.clause);
  if (lead === null && worried !== undefined) lead = worried;
  const also = pickPrimary(intents.filter(intent => intent !== lead && intent.clause !== primary.clause && intent.id !== primary.id && !NOT_A_SECOND_ANSWER.has(intent.id)));
  return { primary, lead, also };
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

// The clause Grove actually answered, kept so a follow-up can re-ask it.
function questionOf(turn: Turn): string {
  return turn.reading.clauses[turn.intent.clause]?.text ?? turn.reading.text;
}

function reactionOnly(message: ChatMessage, reactions: readonly string[], act: string): Decision {
  return {
    replyToMessageId: message.id,
    text: null,
    reactions,
    files: [],
    command: null,
    delayMs: 400,
    waitForSilenceMs: 0,
    meta: { covers: [message.id], act, intent: act, slots: {}, question: "", topic: null, channelId: message.channelId, toUserId: message.authorId, toUserName: message.authorName, gloss: null, expectation: null },
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
  if (/\b(links?|url)\b/.test(text)) {
    return {
      text: `which link? i know the handbook (<${LINKS.handbook}>) and where to download the mods (<${LINKS.originsModrinth}>). just ask!`,
      gloss: "i know the handbook and download links",
      act: "links",
    };
  }
  const asked = text.replace(/^((grove|hey|so|ok|okay|but|and|wait|also|um|hmm) )+/, "");
  if (/^(is|are|was|were|does|do|did|can|could|would|will|has|have) /.test(asked) && !/^[a-z]+ (i|we)\b/.test(asked) && !/\b(you|your|yourself|grove)\b/.test(asked)) {
    return {
      text: picker.pick("q.guess", [
        "hmm... i think so? but i'm a slime, so don't quote me on that",
        "my moss says yes! my moss is wrong a lot though",
        "probably? you might want to ask someone with a bigger brain than mine hehe",
      ]),
      gloss: "it was just a guess, i don't really know",
      act: "question.guess",
      miss: true,
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
