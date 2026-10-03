import { ALIVE_WORDS, BOT_WORDS, COMPLIMENTS, FEELINGS, GENDER_WORDS, INSULTS, PET_NAMES, SIZE_WORDS } from "../content/lexicon.ts";
import type { NameUse, Reading } from "../text/reader.ts";

// Who is this message for?
//   direct        Grove was @mentioned, or someone replied to one of Grove's messages.
//   vocative      Grove was named the way you name someone you talk to: "hey grove", "grove, are you ok", "thanks grove".
//   continuation  No name at all, but the person is mid-conversation with Grove and nothing points elsewhere.
//   about         Grove was named in passing: "grove is so cute", "ask grove".
//   none          Not Grove's business.
export type Addressing = "direct" | "vocative" | "continuation" | "about" | "none";

const CALLS = new Set([
  "hey", "hi", "hello", "yo", "oi", "ayo", "thanks", "thank", "ty", "love", "bye", "night", "morning",
  "ok", "okay", "dear", "sorry", "please", "pls", "good", "you", "lol", "lmao", "omg", "wow", "aw",
  "aww", "bro", "bruh", "night", "evening", "welcome", "congrats", "ily", "sup", "up", "goodnight", "cmon",
  "so", "and", "but", "wait", "also", "um", "uh", "hmm", "well", "btw", "anyway",
]);

const THIRD_PERSON_NEXT = new Set(["is", "was", "has", "had", "said", "says", "seems", "looks", "thinks", "just", "really", "keeps", "never", "always"]);
// "grove is IT on forge?", "grove is ORIGINS compatible": a question put to Grove, not a remark about it.
const QUESTION_SUBJECTS = new Set([
  "it", "there", "this", "that", "these", "those", "origins", "apoli", "my", "your", "anyone", "someone", "everyone",
  "he", "she", "they", "we", "you", "jam", "server", "handbook", "modrinth", "curseforge",
]);
// After "grove is", these describe Grove: "grove is so cute?" is a remark about
// it, while "grove is water wet?" is a question put to it.
const DESCRIBING = new Set([
  ...COMPLIMENTS, ...INSULTS, ...PET_NAMES, ...GENDER_WORDS, ...BOT_WORDS, ...ALIVE_WORDS, ...SIZE_WORDS, ...Object.keys(FEELINGS),
  "so", "really", "very", "kind", "sort", "such", "a", "an", "the", "literally", "actually", "pretty", "super", "too", "lowkey",
  "highkey", "honestly", "truly", "totally", "being", "just", "like", "most", "mega", "extremely", "hella", "quite", "always",
  "still", "little", "bit", "one", "real", "definitely", "probably", "secretly", "maybe", "not", "never", "going", "back",
  "here", "online", "offline", "down", "up", "on", "off", "sleeping", "asleep", "awake", "busy", "in", "at", "with", "from",
  "for", "to", "of", "afraid", "scared", "talking", "typing", "being", "getting", "acting", "trying", "gone", "done",
]);

// "grove is it on forge", "grove is water wet?": the name opens a question rather
// than a sentence about Grove.
export function asksThroughName(next: string | null | undefined, afterNext: string | null | undefined, wordsAfterVerb: number, question: boolean): boolean {
  if ((next !== "is" && next !== "was" && next !== "are") || afterNext === null || afterNext === undefined) return false;
  if (QUESTION_SUBJECTS.has(afterNext)) return true;
  return question && wordsAfterVerb >= 2 && !DESCRIBING.has(afterNext);
}

const THIRD_PERSON_BEFORE = new Set(["the", "a", "an", "ask", "about", "with", "and", "like", "tell", "ping", "cherry", "snowy", "this", "that", "said", "to", "from", "of"]);

function isVocative(use: NameUse, tokenCount: number, question: boolean): boolean {
  if (use.after === "biome" || use.before === "cherry" || use.before === "snowy") return false;
  if (use.possessive) return false;

  const before = use.before;
  const after = use.after;
  const atStart = use.index === 0 || use.boundaryBefore;
  const atEnd = use.boundaryAfter || use.index === tokenCount - 1;

  if (before !== null && CALLS.has(before)) return true;
  const asking = atStart && asksThroughName(after, use.afterNext, tokenCount - use.index - 2, question);
  if (after !== null && THIRD_PERSON_NEXT.has(after) && !use.boundaryAfter && !asking) return false;
  if (before !== null && THIRD_PERSON_BEFORE.has(before)) return false;
  // Opening or closing a sentence with someone's name is how you talk to them:
  // "grove my game keeps crashing", "are you okay grove".
  return atStart || atEnd;
}

export interface AddressingInput {
  reading: Reading;
  mentionsGrove: boolean;
  repliesToGrove: boolean;
  repliesToSomeoneElse: boolean;
  mentionsSomeoneElse: boolean;
  // The person talked with Grove moments ago and the thread is still warm.
  inConversation: boolean;
}

export function addressingOf(input: AddressingInput): Addressing {
  const { reading } = input;
  if (input.mentionsGrove || input.repliesToGrove) return "direct";

  // "*puts grove in a pocket*" is done to Grove, wherever its name lands.
  if (reading.action !== null && /\bgrove\b/.test(reading.action)) return "vocative";

  const names = reading.names;
  if (names.length > 0) {
    if (names.some(use => isVocative(use, reading.tokens.length, reading.question))) return "vocative";
    return "about";
  }

  if (input.inConversation && !input.repliesToSomeoneElse && !input.mentionsSomeoneElse) return "continuation";
  return "none";
}
