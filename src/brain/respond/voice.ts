import type { MoodSnapshot } from "../state/mood.ts";
import type { Random } from "../types.ts";

// Grove's way of typing, applied to every line it says:
//   lowercase, like someone chatting rather than writing an essay, except
//   for a word written in capitals on purpose ("frogs EAT slimes")
//   no em or en dashes and no semicolons (nobody types those in chat)
//   at most one custom emoji per message
//   a little flourish that follows its mood
// Links, mentions, channel tags and custom emojis are protected from all of it.

// Emoticons whose capital letters are the face (":D", "XD", "D:") stay as typed,
// and so do whole words in capitals, which are shouted on purpose.
const PROTECTED = /<a?:\w+:\d+>|<[@#][!&]?\d+>|<https?:\/\/[^>\s]+>|https?:\/\/\S+|`[^`]*`|:D\b|\bXD\b|\bxD\b|\bD:|:P\b|\bOwO\b|\bUwU\b|\b[A-Z]{2,}\b/g;
const CUSTOM_EMOJI = /<a?:\w+:\d+>/g;

export function speak(text: string, mood: MoodSnapshot, random: Random, flourish = true): string {
  const kept: string[] = [];
  let body = text.replace(PROTECTED, match => {
    kept.push(match);
    return `\u0000${kept.length - 1}\u0000`;
  });

  body = body
    .toLowerCase()
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+--\s+/g, ", ")
    .replace(/;/g, ".")
    .replace(/…/g, "...")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*([.!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (flourish) body = withMood(body, mood, random);

  let emojiSeen = 0;
  body = body.replace(/\u0000(\d+)\u0000/g, (_, index: string) => kept[Number(index)] ?? "");
  body = body.replace(CUSTOM_EMOJI, match => (++emojiSeen > 1 ? "" : match)).replace(/[ \t]{2,}/g, " ").trim();
  return body;
}

const ENDS_EXPRESSIVE = /([!?.]{2,}|:\)|:\(|:d|:3|<3|xd|\u0000\d+\u0000|\p{Extended_Pictographic}|\*)$/u;

function withMood(body: string, mood: MoodSnapshot, random: Random): string {
  if (ENDS_EXPRESSIVE.test(body) || /\b(hehe|haha)\b/.test(body)) return body;
  const roll = random();
  switch (mood.label) {
    case "joyful":
      if (roll < 0.12) return `${trimEnd(body)}!! :D`;
      if (roll < 0.22) return `${trimEnd(body)} hehe`;
      return body;
    case "happy":
      if (roll < 0.07) return `${trimEnd(body)} :)`;
      if (roll < 0.12) return `${trimEnd(body)} :3`;
      return body;
    case "sad":
      if (roll < 0.2) return `${trimEnd(body)} :(`;
      return body;
    case "hurt":
      if (roll < 0.3) return `${trimEnd(body)} 🥺`;
      return body;
    case "sleepy":
      if (roll < 0.1) return `*yawns* ${body}`;
      return body;
    default:
      return body;
  }
}

function trimEnd(body: string): string {
  return body.replace(/[.\s]+$/, "");
}
