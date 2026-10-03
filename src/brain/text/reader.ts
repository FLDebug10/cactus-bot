import { REAL_WORDS } from "../content/realWords.ts";
import { CONTRACTIONS, CORRECTION_TARGETS, KNOWN_WORDS, LAUGH_WORDS, SLANG } from "../content/words.ts";
import { Speller } from "./speller.ts";

export interface Clause {
  tokens: readonly string[];
  text: string;
  question: boolean;
}

// One place where Grove's name shows up in a message, with what surrounds it,
// so the addressing logic can tell "grove, are you okay" from "grove is cute".
export interface NameUse {
  index: number;
  before: string | null;
  after: string | null;
  // The word after `after`: "grove is IT raining" versus "grove is SO cute".
  afterNext: string | null;
  // A comma, a vocative greeting, or the start/end of a clause right next to the name.
  boundaryBefore: boolean;
  boundaryAfter: boolean;
  possessive: boolean;
}

export interface Reading {
  raw: string;
  text: string;
  tokens: readonly string[];
  clauses: readonly Clause[];
  question: boolean;
  exclaim: boolean;
  laugh: boolean;
  shouting: boolean;
  action: string | null;
  emojis: readonly string[];
  hasLink: boolean;
  hasCode: boolean;
  names: readonly NameUse[];
  corrections: ReadonlyArray<readonly [string, string]>;
}

export const GROVE_NAMES: ReadonlySet<string> = new Set([
  "grove", "grovey", "grovie", "grovy", "grovee", "groveee", "gorve", "grvoe", "groev", "grobe", "grovw", "grov",
]);

const QUESTION_OPENERS = new Set([
  "who", "what", "when", "where", "which", "whose", "why", "how", "is", "are", "am", "was", "were", "do",
  "does", "did", "can", "could", "should", "would", "will", "shall", "may", "might", "have", "has",
]);

const LAUGH_EMOJI = new Set(["😂", "🤣", "😭", "💀", "😹", "😆"]);

const speller = new Speller(new Set([...KNOWN_WORDS, ...REAL_WORDS, ...Object.keys(SLANG), ...Object.keys(CONTRACTIONS), ...GROVE_NAMES]), CORRECTION_TARGETS);

export function isGroveName(token: string): boolean {
  return GROVE_NAMES.has(token);
}

// Turns raw Discord text into normalized tokens and clauses. `groveId` lets an
// @mention of Grove read as the word "grove", which keeps "@Grove are you ok"
// and "grove are you ok" identical from here on.
export function read(raw: string, groveId: string | null): Reading {
  const emojis: string[] = [];
  let hasLink = false;
  let hasCode = false;

  let text = raw.normalize("NFKC");

  text = text.replace(/```[\s\S]*?```/g, () => {
    hasCode = true;
    return " ";
  });
  text = text.replace(/`[^`\n]*`/g, () => {
    hasCode = true;
    return " ";
  });
  text = text.replace(/https?:\/\/\S+/gi, () => {
    hasLink = true;
    return " ";
  });
  text = text.replace(/<a?:(\w+):\d+>/g, (_, name: string) => {
    emojis.push(name.toLowerCase());
    return " ";
  });
  text = text.replace(/<@!?(\d+)>/g, (_, id: string) => (groveId !== null && id === groveId ? " grove " : " someone "));
  text = text.replace(/<@&\d+>/g, " ").replace(/<#\d+>/g, " ");
  text = text.replace(/<3+/g, () => {
    emojis.push("heart");
    return " ";
  });

  for (const match of text.matchAll(/\p{Extended_Pictographic}/gu)) emojis.push(match[0]);

  const letters = text.replace(/[^\p{L}]/gu, "");
  const shouting = letters.length >= 6 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();

  const actionMatch = /(?:^|\s)[*_]([^*_\n]{2,80})[*_](?=\s|$)/.exec(text);

  text = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[“”]/g, '"');

  const rawTokens = text.match(/[a-z0-9]+(?:'[a-z]+)*|[?!.,;:]+/g) ?? [];
  const tokens: string[] = [];
  const corrections: Array<[string, string]> = [];
  const names: NameUse[] = [];
  const clauses: Clause[] = [];
  let clause: string[] = [];
  let clauseQuestion = false;
  let questionMark = false;
  let exclaim = false;
  let laugh = emojis.some(e => LAUGH_EMOJI.has(e));
  let pendingBoundary = true;

  const closeClause = () => {
    if (clause.length > 0) {
      const opener = clause[0]!;
      clauses.push({ tokens: clause, text: clause.join(" "), question: clauseQuestion || QUESTION_OPENERS.has(opener) });
    }
    clause = [];
    clauseQuestion = false;
  };

  for (const rawToken of rawTokens) {
    if (/^[?!.,;:]+$/.test(rawToken)) {
      if (rawToken.includes("?")) {
        questionMark = true;
        clauseQuestion = true;
      }
      if (rawToken.includes("!")) exclaim = true;
      const lastName = names[names.length - 1];
      if (lastName !== undefined && lastName.index === tokens.length - 1) lastName.boundaryAfter = true;
      pendingBoundary = true;
      if (/[?!.;]/.test(rawToken)) closeClause();
      continue;
    }

    let word = rawToken;
    let possessive = false;
    if (word.endsWith("'s") && CONTRACTIONS[word] === undefined) {
      word = word.slice(0, -2);
      possessive = true;
    }
    word = unstretch(word);

    if (isGroveName(word) || (possessive && isGroveName(word))) {
      names.push({
        index: tokens.length,
        before: tokens[tokens.length - 1] ?? null,
        after: null,
        afterNext: null,
        boundaryBefore: pendingBoundary,
        boundaryAfter: false,
        possessive,
      });
      tokens.push("grove");
      clause.push("grove");
      pendingBoundary = false;
      continue;
    }

    for (const piece of expand(word, corrections)) {
      if (LAUGH_WORDS.has(piece)) laugh = true;
      const previousName = names[names.length - 1];
      if (previousName !== undefined && previousName.index === tokens.length - 1 && previousName.after === null) {
        previousName.after = piece;
      } else if (previousName !== undefined && previousName.index === tokens.length - 2 && previousName.afterNext === null) {
        previousName.afterNext = piece;
      }
      tokens.push(piece);
      clause.push(piece);
    }
    pendingBoundary = false;
  }
  closeClause();

  for (const use of names) {
    if (use.index === tokens.length - 1) use.boundaryAfter = true;
  }

  const question = questionMark || clauses.some(c => c.question);

  return {
    raw,
    text: tokens.join(" "),
    tokens,
    clauses,
    question,
    exclaim,
    laugh,
    shouting,
    action: actionMatch ? read(actionMatch[1]!, groveId).text : null,
    emojis,
    hasLink,
    hasCode,
    names,
    corrections,
  };
}

// "heyyyyy" -> "hey", "sooo" -> "so", "goood" -> "good": collapse runs of three
// or more letters to two, then to one, keeping the first form that is a real word.
function unstretch(word: string): string {
  if (!/(.)\1\1/.test(word)) return word;
  const double = word.replace(/(.)\1{2,}/g, "$1$1");
  if (isKnown(double)) return double;
  const single = word.replace(/(.)\1{2,}/g, "$1");
  if (isKnown(single)) return single;
  return double;
}

function isKnown(word: string): boolean {
  return KNOWN_WORDS.has(word) || SLANG[word] !== undefined || CONTRACTIONS[word] !== undefined
    || CORRECTION_TARGETS.has(word) || LAUGH_WORDS.has(word) || isGroveName(word);
}

function expand(word: string, corrections: Array<[string, string]>): readonly string[] {
  const contraction = CONTRACTIONS[word];
  if (contraction !== undefined) return contraction;
  const slang = SLANG[word];
  if (slang !== undefined) return slang;
  if (LAUGH_WORDS.has(word)) return [word];
  const fixed = speller.correct(word);
  if (fixed !== word) {
    corrections.push([word, fixed]);
    const fixedSlang = SLANG[fixed];
    if (fixedSlang !== undefined) return fixedSlang;
  }
  return [fixed];
}
