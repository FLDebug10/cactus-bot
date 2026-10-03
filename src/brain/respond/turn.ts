import { CHANNELS, type ChannelKey, EMOJI } from "../../config.ts";
import { ORIGIN_BY_ID } from "../content/knowledge.ts";
import { DISLIKES, LIKES } from "../content/lexicon.ts";
import { CORRECTION_TARGETS } from "../content/words.ts";
import type { Intent, IntentId, Slots } from "../understand/intents.ts";
import type { Topics } from "../understand/topics.ts";
import type { Addressing } from "../understand/addressing.ts";
import type { Reading } from "../text/reader.ts";
import type { Calendar, DayProfile } from "../state/day.ts";
import type { MoodEvent, MoodSnapshot } from "../state/mood.ts";
import type { Friend } from "../state/memory.ts";
import type { GroveLine, SeenMessage, Session } from "../state/conversation.ts";
import type { ChatMessage, Expectation } from "../types.ts";
import type { Picker } from "./picker.ts";

// Everything a responder may look at while deciding what Grove says.
export interface Turn {
  message: ChatMessage;
  reading: Reading;
  intent: Intent;
  intents: readonly Intent[];
  // A compliment, thanks or "love you" that came with the question, answered first in a few words.
  lead: Intent | null;
  // A second question in the same message, answered after the first.
  also: Intent | null;
  topics: Topics;
  sentiment: number;
  greeted: boolean;
  addressing: Addressing;
  // What Grove calls this person.
  name: string;
  friend: Friend;
  session: Session;
  mood: MoodSnapshot;
  day: DayProfile;
  // Grove's day `offset` days from today: 1 is tomorrow, -1 yesterday.
  dayAt(offset: number): DayProfile;
  hour: number;
  // Today's date where Grove lives.
  calendar: Calendar;
  now: number;
  picker: Picker;
  // The message this one replies to, and the Grove line it is, if it is one.
  repliedTo: SeenMessage | null;
  repliedLine: GroveLine | null;
  // Grove's most recent line to this person in this channel.
  lastLineToThem: GroveLine | null;
  // Grove's most recent line in this channel, to anyone.
  lastLineHere: GroveLine | null;
  expectation: Expectation | null;
  // The people Grove likes most, warmest first.
  topFriends(limit: number): Friend[];
}

export interface Reply {
  text: string;
  // What Grove meant, in plain words, so "what does that mean?" can be answered later.
  gloss?: string | null;
  act?: string;
  topic?: string | null;
  reactions?: readonly string[];
  // Images from assets/ to attach, by file name.
  files?: readonly string[];
  // What this answered, when it differs from the message's own intent (a follow-up that got resolved).
  about?: { intent: IntentId; slots: Slots; question: string };
  feel?: MoodEvent;
  expect?: Expectation | null;
  // React only, say nothing.
  silent?: boolean;
  // Stop answering this person for this long (they were mean, or asked Grove to go away).
  sulkMs?: number;
  affinity?: number;
  // Grove did not understand; worth logging so its brain can be taught later.
  miss?: boolean;
}

export type Responder = (turn: Turn) => Reply | null;

// "tomorrow" -> 1, "yesterday" or "last night" -> -1, anything else -> today.
export function dayOffsetIn(text: string): number {
  if (/\btomorrow\b/.test(text)) return 1;
  if (/\byesterday\b|\blast night\b/.test(text)) return -1;
  return 0;
}

export function channel(key: ChannelKey): string {
  return `<#${CHANNELS[key]}>`;
}

export { EMOJI };

const BLOCKED = new Set([
  "nigger", "nigga", "faggot", "fag", "retard", "retarded", "tranny", "kike", "chink", "spic", "cunt", "whore",
  "slut", "rape", "rapist", "nazi", "hitler", "porn", "sex", "cock", "dick", "penis", "vagina", "pussy", "fuck",
  "fucking", "shit", "bitch", "ass", "asshole", "kys",
]);

// Only short, plain words ever get repeated back, and never anything nasty.
export function safeWord(word: string | undefined, maxLength = 18): string | null {
  if (word === undefined) return null;
  const cleaned = word.trim().toLowerCase();
  if (cleaned.length < 2 || cleaned.length > maxLength) return null;
  if (!/^[a-z][a-z0-9' -]*$/.test(cleaned)) return null;
  if (cleaned.split(/[\s-]+/).some(part => BLOCKED.has(part))) return null;
  return cleaned;
}

// How Grove writes someone's name: their display name, lowercase like the rest
// of its typing, stripped of symbols. Never a mention, so Grove never pings.
export function displayName(raw: string): string {
  const cleaned = raw
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24)
    .trim()
    .toLowerCase();
  if (cleaned.length < 2 || cleaned.split(" ").some(part => BLOCKED.has(part))) return "friend";
  return cleaned;
}

const STOPWORDS = new Set(`
  a an the and or but if then so to of in on at by for with about from into over after before i me my you your
  it its is are was were be been being am do does did have has had will would can could should may might must
  this that these those what which who whom whose when where why how not no yes just like really very so too
  also very much many some any all every each other another such only own same than too very s t can will
  dont should now grove someone thing things stuff lot lots kind sort bit get got make made go going went
`.trim().split(/\s+/));

// A plain, safe noun-ish word from the clause, for curious little echoes. Never
// a word Grove already knows about: asking "what's slimekin?" would be silly.
export function curiousWord(tokens: readonly string[]): string | null {
  let best: string | null = null;
  for (const token of tokens) {
    if (STOPWORDS.has(token) || token.length < 4 || token.length > 12) continue;
    if (CORRECTION_TARGETS.has(token) || LIKES.has(token) || DISLIKES.has(token) || ORIGIN_BY_ID.has(token)) continue;
    const safe = safeWord(token, 12);
    if (safe !== null && (best === null || safe.length > best.length)) best = safe;
  }
  return best;
}
