import { table } from "../content/table.ts";
import type { Reading } from "../text/reader.ts";

const POSITIVE: Readonly<Record<string, number>> = table({
  love: 1, like: 0.5, good: 0.6, great: 0.8, awesome: 0.9, amazing: 0.9, cool: 0.6, nice: 0.6, fun: 0.6,
  happy: 0.8, glad: 0.7, yay: 0.8, excited: 0.8, best: 0.8, beautiful: 0.8, cute: 0.7, funny: 0.6,
  perfect: 0.9, wonderful: 0.9, fantastic: 0.9, finally: 0.4, finished: 0.4, works: 0.5, working: 0.4,
  fixed: 0.6, won: 0.8, win: 0.6, proud: 0.7, enjoy: 0.6, enjoyed: 0.6, thanks: 0.5, thank: 0.5,
  fine: 0.3, okay: 0.2, ok: 0.2, well: 0.2, chill: 0.4, relaxing: 0.5, productive: 0.6, epic: 0.7,
  goated: 0.8, based: 0.5, slay: 0.7, fire: 0.6, lit: 0.6, w: 0.5,
});

const NEGATIVE: Readonly<Record<string, number>> = table({
  hate: 1, bad: 0.7, awful: 0.9, terrible: 0.9, horrible: 0.9, sad: 0.8, angry: 0.8, mad: 0.7,
  upset: 0.8, annoying: 0.6, annoyed: 0.6, boring: 0.5, bored: 0.4, worst: 0.9, ugly: 0.7, stupid: 0.7,
  dumb: 0.7, broken: 0.6, crash: 0.5, crashing: 0.5, crashed: 0.5, sucks: 0.8, suck: 0.8, tired: 0.4,
  exhausted: 0.6, sick: 0.6, hurt: 0.6, lost: 0.4, failed: 0.6, fail: 0.5, stressed: 0.7, anxious: 0.6,
  depressed: 0.9, lonely: 0.7, cry: 0.6, crying: 0.6, rough: 0.5, meh: 0.3, mid: 0.4, cringe: 0.5,
  frustrated: 0.7, ugh: 0.5, l: 0.4, trash: 0.7, garbage: 0.7, scared: 0.6, worried: 0.6,
});

const NEGATORS = new Set(["not", "never", "no", "nothing", "hardly", "barely", "without"]);
const BOOSTERS = new Set(["so", "very", "really", "super", "extremely", "hella", "mega", "too", "literally", "absolutely", "incredibly"]);

const HAPPY_EMOJI = new Set(["heart", "❤", "❤️", "🥰", "😍", "😊", "😁", "😄", "🙂", "💚", "💖", "✨", "🎉", "grove_heart", "👍"]);
const SAD_EMOJI = new Set(["😢", "😞", "😔", "☹", "🙁", "💔", "😡", "😠", "😤", "👎"]);

// A rough -1..1 read of the mood of a message.
export function sentimentOf(reading: Reading): number {
  let score = 0;
  const tokens = reading.tokens;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    let value = (POSITIVE[token] ?? 0) - (NEGATIVE[token] ?? 0);
    if (value === 0) continue;

    for (let back = 1; back <= 3 && i - back >= 0; back++) {
      if (NEGATORS.has(tokens[i - back]!)) {
        value = -value * 0.8;
        break;
      }
    }
    if (i > 0 && BOOSTERS.has(tokens[i - 1]!)) value *= 1.4;
    score += value;
  }

  for (const emoji of reading.emojis) {
    if (HAPPY_EMOJI.has(emoji)) score += 0.6;
    else if (SAD_EMOJI.has(emoji)) score -= 0.6;
  }
  if (reading.laugh) score += 0.3;

  return Math.max(-1, Math.min(1, score / 2));
}
