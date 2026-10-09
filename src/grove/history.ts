// What Grove saw lately in each channel, so the brain gets the conversation
// and not just one message. Kept in memory only: a restart backfills from
// Discord, and nothing about chat is written to disk.

import type { ChatLine } from "./types.ts";

const PER_CHANNEL = 40;
const KEEP_FOR_MS = 6 * 60 * 60_000;
const TALK_WINDOW_MS = 3 * 60_000;

interface ChannelLog {
  lines: ChatLine[];
  touchedAt: number;
  backfilled: boolean;
}

export class History {
  private readonly channels = new Map<string, ChannelLog>();
  // "<channel>:<user>" -> when Grove last answered that person there.
  private readonly answered = new Map<string, number>();

  private log(channelId: string): ChannelLog {
    let log = this.channels.get(channelId);
    if (log === undefined) {
      log = { lines: [], touchedAt: 0, backfilled: false };
      this.channels.set(channelId, log);
    }
    return log;
  }

  add(line: ChatLine): void {
    const log = this.log(line.channelId);
    log.touchedAt = Math.max(log.touchedAt, line.at);
    const existing = log.lines.findIndex(seen => seen.id === line.id);
    if (existing !== -1) {
      log.lines[existing] = line;
      return;
    }
    let index = log.lines.length;
    while (index > 0 && log.lines[index - 1]!.at > line.at) index--;
    log.lines.splice(index, 0, line);
    if (log.lines.length > PER_CHANNEL) log.lines.splice(0, log.lines.length - PER_CHANNEL);
  }

  needsBackfill(channelId: string): boolean {
    return !this.log(channelId).backfilled;
  }

  markBackfilled(channelId: string): void {
    this.log(channelId).backfilled = true;
  }

  find(channelId: string, id: string): ChatLine | undefined {
    return this.channels.get(channelId)?.lines.find(line => line.id === id);
  }

  // Lines before `beforeId` (oldest first), within `maxAgeMs` of it.
  before(channelId: string, beforeId: string, limit: number, maxAgeMs: number): ChatLine[] {
    const lines = this.channels.get(channelId)?.lines ?? [];
    const index = lines.findIndex(line => line.id === beforeId);
    const end = index === -1 ? lines.length : index;
    const anchor = lines[index]?.at ?? lines[end - 1]?.at ?? 0;
    return lines.slice(Math.max(0, end - limit), end).filter(line => anchor - line.at <= maxAgeMs);
  }

  // Lines after `afterId` in the same channel.
  after(channelId: string, afterId: string): ChatLine[] {
    const lines = this.channels.get(channelId)?.lines ?? [];
    const index = lines.findIndex(line => line.id === afterId);
    return index === -1 ? [] : lines.slice(index + 1);
  }

  noteAnswered(channelId: string, userId: string, at: number): void {
    this.answered.set(`${channelId}:${userId}`, at);
  }

  // Grove answered this person a moment ago, and nobody else has spoken since,
  // so their next message is probably still for Grove.
  talkingWith(channelId: string, userId: string, now: number): boolean {
    const at = this.answered.get(`${channelId}:${userId}`);
    if (at === undefined || now - at > TALK_WINDOW_MS) return false;
    const lines = this.channels.get(channelId)?.lines ?? [];
    return !lines.some(line => line.at > at && !line.isGrove && !line.isBot && line.authorId !== userId);
  }

  prune(now: number): void {
    for (const [channelId, log] of this.channels) {
      if (now - log.touchedAt > KEEP_FOR_MS) this.channels.delete(channelId);
    }
    for (const [key, at] of this.answered) {
      if (now - at > TALK_WINDOW_MS) this.answered.delete(key);
    }
  }
}
