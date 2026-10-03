import type { Expectation } from "../types.ts";

// Short-term memory: what was said recently in each channel, what Grove said
// to whom, and where each person is in their conversation with Grove. This is
// what lets several people talk to Grove at once, lets someone else chime in
// on a reply Grove gave to another person, and lets "what does that mean?"
// find the line it is about.

export interface SeenMessage {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  isGrove: boolean;
  isBot: boolean;
  raw: string;
  at: number;
  replyToId: string | null;
  replyToAuthorId: string | null;
  mentionsGrove: boolean;
  mentionedUserIds: readonly string[];
}

export interface GroveLine {
  id: string;
  channelId: string;
  toUserId: string;
  toUserName: string;
  act: string;
  topic: string | null;
  text: string;
  gloss: string | null;
  at: number;
}

export interface Session {
  channelId: string;
  userId: string;
  // When Grove last actually said something to this person here.
  lastAt: number;
  lastAct: string | null;
  lastTopic: string | null;
  expectation: Expectation | null;
  expectationAt: number;
  insults: number[];
  sulkingUntil: number;
  turns: number;
}

interface OpenQuestion {
  messageId: string;
  channelId: string;
  askerId: string;
  at: number;
  answered: boolean;
}

const CHANNEL_HISTORY = 60;
const MAX_GROVE_LINES = 1500;
const SESSION_TTL = 3 * 60 * 60 * 1000;
const CONVERSATION_WINDOW = 2 * 60 * 1000;
const EXPECTATION_WINDOW = 5 * 60 * 1000;

export class Conversations {
  private readonly history = new Map<string, SeenMessage[]>();
  private readonly lines = new Map<string, GroveLine>();
  private readonly lastLineInChannel = new Map<string, GroveLine>();
  private readonly sessions = new Map<string, Session>();
  private readonly openQuestions = new Map<string, OpenQuestion>();
  private readonly groveSpoke = new Map<string, number[]>();
  private readonly quietUntil = new Map<string, number>();
  private readonly handled = new Set<string>();
  private readonly handledOrder: string[] = [];

  observe(message: SeenMessage): void {
    let buffer = this.history.get(message.channelId);
    if (buffer === undefined) {
      buffer = [];
      this.history.set(message.channelId, buffer);
    }
    buffer.push(message);
    if (buffer.length > CHANNEL_HISTORY) buffer.splice(0, buffer.length - CHANNEL_HISTORY);

    if (message.isBot) return;
    for (const question of this.openQuestions.values()) {
      if (question.answered || question.channelId !== message.channelId) continue;
      if (question.askerId === message.authorId) {
        if (/\b(nvm|never ?mind|found it|figured it out|got it)\b/i.test(message.raw)) question.answered = true;
        continue;
      }
      // Someone replied to them, pinged them, or pointed at a channel: a person answered.
      if (message.replyToId === question.messageId || message.mentionedUserIds.includes(question.askerId) || /<#\d+>/.test(message.raw)) {
        question.answered = true;
      }
    }
  }

  find(channelId: string, messageId: string): SeenMessage | undefined {
    const buffer = this.history.get(channelId);
    if (buffer === undefined) return undefined;
    for (let i = buffer.length - 1; i >= 0; i--) {
      if (buffer[i]!.id === messageId) return buffer[i];
    }
    return undefined;
  }

  // The message right above this one in the channel.
  previous(channelId: string, messageId: string): SeenMessage | undefined {
    const buffer = this.history.get(channelId);
    if (buffer === undefined) return undefined;
    for (let i = buffer.length - 1; i > 0; i--) {
      if (buffer[i]!.id === messageId) return buffer[i - 1];
    }
    return undefined;
  }

  recent(channelId: string): readonly SeenMessage[] {
    return this.history.get(channelId) ?? [];
  }

  // What this person said in the last few seconds that Grove has not answered:
  // people often split one thought across messages ("grove" ... "are you a girl").
  fragments(channelId: string, userId: string, now: number, windowMs: number): SeenMessage[] {
    const buffer = this.history.get(channelId) ?? [];
    const out: SeenMessage[] = [];
    for (let i = buffer.length - 1; i >= 0; i--) {
      const message = buffer[i]!;
      if (now - message.at > windowMs) break;
      if (message.isGrove || this.handled.has(message.id)) break;
      if (message.authorId === userId) out.unshift(message);
    }
    return out;
  }

  // Grove answered (or reacted to) these, so they never merge into a later message.
  markHandled(messageIds: readonly string[]): void {
    for (const id of messageIds) {
      if (this.handled.has(id)) continue;
      this.handled.add(id);
      this.handledOrder.push(id);
    }
    while (this.handledOrder.length > 2000) this.handled.delete(this.handledOrder.shift()!);
  }

  line(messageId: string): GroveLine | undefined {
    return this.lines.get(messageId);
  }

  lastLine(channelId: string): GroveLine | undefined {
    return this.lastLineInChannel.get(channelId);
  }

  // The last thing Grove said to this person here, if it was recent.
  lastLineTo(channelId: string, userId: string, now: number, windowMs: number): GroveLine | undefined {
    const buffer = this.history.get(channelId) ?? [];
    for (let i = buffer.length - 1; i >= 0; i--) {
      const message = buffer[i]!;
      if (now - message.at > windowMs) break;
      if (!message.isGrove) continue;
      const line = this.lines.get(message.id);
      if (line !== undefined && line.toUserId === userId) return line;
    }
    return undefined;
  }

  remember(line: GroveLine): void {
    this.lines.set(line.id, line);
    this.lastLineInChannel.set(line.channelId, line);
    if (this.lines.size > MAX_GROVE_LINES) {
      const oldest = this.lines.keys().next().value;
      if (oldest !== undefined) this.lines.delete(oldest);
    }
    const spoke = this.groveSpoke.get(line.channelId) ?? [];
    spoke.push(line.at);
    while (spoke.length > 0 && line.at - spoke[0]! > 60_000) spoke.shift();
    this.groveSpoke.set(line.channelId, spoke);
  }

  session(channelId: string, userId: string): Session {
    const key = `${channelId}:${userId}`;
    let session = this.sessions.get(key);
    if (session === undefined) {
      session = {
        channelId, userId, lastAt: 0, lastAct: null, lastTopic: null, expectation: null, expectationAt: 0,
        insults: [], sulkingUntil: 0, turns: 0,
      };
      this.sessions.set(key, session);
    }
    return session;
  }

  expectationOf(session: Session, now: number): Expectation | null {
    if (session.expectation === null || now - session.expectationAt > EXPECTATION_WINDOW) return null;
    return session.expectation;
  }

  // Still mid-conversation: Grove answered this person moments ago, or is
  // waiting on an answer from them, and nobody else has taken the floor since.
  inConversation(channelId: string, userId: string, now: number): boolean {
    const session = this.sessions.get(`${channelId}:${userId}`);
    if (session === undefined) return false;
    const waiting = this.expectationOf(session, now) !== null;
    if (!waiting && now - session.lastAt > CONVERSATION_WINDOW) return false;

    const buffer = this.history.get(channelId) ?? [];
    let othersSince = 0;
    for (let i = buffer.length - 1; i >= 0; i--) {
      const message = buffer[i]!;
      if (message.at < session.lastAt) break;
      if (message.isGrove) {
        const line = this.lines.get(message.id);
        if (line !== undefined && line.toUserId !== userId) return false;
        continue;
      }
      if (!message.isBot && message.authorId !== userId) othersSince++;
    }
    return othersSince <= (waiting ? 4 : 2);
  }

  spokeRecently(channelId: string, now: number, windowMs: number): number {
    const spoke = this.groveSpoke.get(channelId) ?? [];
    let count = 0;
    for (const at of spoke) if (now - at <= windowMs) count++;
    return count;
  }

  hush(channelId: string, until: number): void {
    if (until <= 0) this.quietUntil.delete(channelId);
    else this.quietUntil.set(channelId, until);
  }

  hushed(channelId: string, now: number): boolean {
    return (this.quietUntil.get(channelId) ?? 0) > now;
  }

  openQuestion(messageId: string, channelId: string, askerId: string, now: number): void {
    this.openQuestions.set(messageId, { messageId, channelId, askerId, at: now, answered: false });
  }

  stillUnanswered(messageId: string): boolean {
    const question = this.openQuestions.get(messageId);
    this.openQuestions.delete(messageId);
    return question !== undefined && !question.answered;
  }

  prune(now: number): void {
    for (const [key, session] of this.sessions) {
      if (now - Math.max(session.lastAt, session.sulkingUntil) > SESSION_TTL) this.sessions.delete(key);
    }
    for (const [id, question] of this.openQuestions) {
      if (now - question.at > 10 * 60 * 1000) this.openQuestions.delete(id);
    }
    for (const [channelId, until] of this.quietUntil) {
      if (until <= now) this.quietUntil.delete(channelId);
    }
  }
}
