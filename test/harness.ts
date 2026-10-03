import { Grove } from "../src/brain/grove.ts";
import { seeded } from "../src/brain/state/day.ts";
import { InMemoryMemory } from "../src/brain/state/memory.ts";
import type { ChatMessage, Decision } from "../src/brain/types.ts";

export const GROVE_ID = "100000000000000001";

// A message in the fake channel: its id and who wrote it ("grove" for Grove).
export interface Ref {
  id: string;
  author: string;
}

export interface Exchange {
  message: Ref;
  decision: Decision | null;
  reply: Ref | null;
  text: string | null;
  act: string | null;
}

// A fake channel: people talk, Grove answers, and the clock only moves when
// the test says so. Seeded randomness keeps every run identical.
export class Channel {
  readonly grove: Grove;
  readonly channelId: string;
  now: number;
  private nextId = 1;
  private readonly users = new Map<string, string>();

  constructor(options: { seed?: number; start?: number; helpUnanswered?: boolean; channelId?: string } = {}) {
    // 2026-10-02 at 14:00 in New York: mid-afternoon, Grove is wide awake.
    this.now = options.start ?? Date.UTC(2026, 9, 2, 18, 0, 0);
    this.channelId = options.channelId ?? "general";
    this.grove = new Grove({
      memory: new InMemoryMemory(),
      timezone: "America/New_York",
      clock: { now: () => this.now },
      random: seeded(options.seed ?? 7),
      helpUnanswered: options.helpUnanswered ?? true,
    });
    this.grove.setIdentity(GROVE_ID);
  }

  userId(name: string): string {
    if (name === "grove") return GROVE_ID;
    let id = this.users.get(name);
    if (id === undefined) {
      id = `2${String(this.users.size + 1).padStart(17, "0")}`;
      this.users.set(name, id);
    }
    return id;
  }

  // `name` says `content` ("@grove" is an @mention). Grove's answer, if any,
  // is delivered straight away unless it is waiting to see if a person answers.
  say(name: string, content: string, options: { replyTo?: Ref; gapMs?: number; mentions?: readonly string[] } = {}): Exchange {
    this.now += options.gapMs ?? 20_000;
    const text = content.replace(/@grove\b/gi, `<@${GROVE_ID}>`);
    const message: ChatMessage = {
      id: String(this.nextId++),
      channelId: this.channelId,
      parentId: null,
      authorId: this.userId(name),
      authorName: name,
      authorIsBot: false,
      content: text,
      createdAt: this.now,
      replyToId: options.replyTo?.id ?? null,
      replyToAuthorId: options.replyTo !== undefined ? this.userId(options.replyTo.author) : null,
      mentionsGrove: text.includes(`<@${GROVE_ID}>`),
      mentionedUserIds: (options.mentions ?? []).map(person => this.userId(person)),
      hasMedia: false,
    };
    this.grove.observe(message);
    const decision = this.grove.consider(message);
    const ref: Ref = { id: message.id, author: name };
    if (decision === null) return { message: ref, decision: null, reply: null, text: null, act: null };
    if (decision.waitForSilenceMs > 0) return { message: ref, decision, reply: null, text: decision.text, act: decision.meta.act };
    return { message: ref, decision, ...this.deliver(decision, message) };
  }

  // Delivers a decision that was waiting for silence, the way the Discord adapter would.
  deliverLater(exchange: Exchange): { reply: Ref | null; text: string | null } | null {
    if (exchange.decision === null || !this.grove.stillUnanswered(exchange.message.id)) return null;
    this.now += exchange.decision.waitForSilenceMs;
    const trigger: ChatMessage = {
      id: exchange.message.id, channelId: this.channelId, parentId: null, authorId: this.userId(exchange.message.author),
      authorName: exchange.message.author, authorIsBot: false, content: "", createdAt: this.now, replyToId: null,
      replyToAuthorId: null, mentionsGrove: false, mentionedUserIds: [], hasMedia: false,
    };
    const delivered = this.deliver(exchange.decision, trigger);
    return { reply: delivered.reply, text: delivered.text };
  }

  private deliver(decision: Decision, trigger: ChatMessage): { reply: Ref | null; text: string | null; act: string } {
    let reply: Ref | null = null;
    if (decision.text !== null) {
      reply = { id: String(this.nextId++), author: "grove" };
      this.grove.observe({
        ...trigger,
        id: reply.id,
        authorId: GROVE_ID,
        authorName: "Grove",
        authorIsBot: true,
        content: decision.text,
        createdAt: this.now,
        replyToId: trigger.id,
        replyToAuthorId: trigger.authorId,
        mentionsGrove: false,
        mentionedUserIds: [],
      });
    }
    this.grove.didSay(decision, reply?.id ?? null, this.now);
    return { reply, text: decision.text, act: decision.meta.act };
  }
}
