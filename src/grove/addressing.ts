// Is a message meant for Grove? Mentions and replies always are. Its name in
// the message usually is, unless it's the Minecraft biome. And right after
// Grove answered someone, their next message might be too: the brain decides
// that one, and stays quiet ([skip]) when it was meant for somebody else.

import type { Addressing } from "./types.ts";

export interface AddressingInput {
  content: string;
  mentionsGrove: boolean;
  repliesToGrove: boolean;
  repliesToSomeoneElse: boolean;
  mentionsSomeoneElse: boolean;
  // Grove answered this person in this channel a moment ago.
  talkingWithGrove: boolean;
}

const NAME = /\bgrove\b/gi;
// "a cherry grove", "the grove biome": Minecraft's groves, not Grove.
const BIOME_BEFORE = /\b(cherry|snowy|a|the|this|that|in|into|old|orange|olive|lemon|bamboo|birch|oak|spruce)\s+$/i;
const BIOME_AFTER = /^\s*(biomes?|street|st\b|road|rd\b|park|city|village)/i;

export function namesGrove(content: string): boolean {
  const text = content.replace(/<a?:\w+:\d+>|<[@#][!&]?\d+>|https?:\/\/\S+|```[\s\S]*?```|`[^`]*`/g, " ");
  for (const match of text.matchAll(NAME)) {
    const at = match.index ?? 0;
    const before = text.slice(Math.max(0, at - 20), at);
    const after = text.slice(at + match[0].length, at + match[0].length + 20);
    if (!BIOME_BEFORE.test(before) && !BIOME_AFTER.test(after)) return true;
  }
  return false;
}

export function addressingOf(input: AddressingInput): Addressing | null {
  if (input.mentionsGrove || input.repliesToGrove) return "direct";
  if (namesGrove(input.content)) return "named";
  if (input.talkingWithGrove && !input.repliesToSomeoneElse && !input.mentionsSomeoneElse) return "followup";
  return null;
}
