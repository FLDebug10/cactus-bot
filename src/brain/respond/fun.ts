import { ageWords, FUN_FACTS, JOKES, TNT_RECIPE_IMAGE } from "../content/knowledge.ts";
import { FAMOUS_SENTENCES, MADE_UP_ENDINGS, SENTENCE_LEADS } from "../content/sentences.ts";
import { DUMB_QUESTION_MEANING, DUMB_QUESTIONS, MY_DUMB_QUESTIONS, ORANGE_FACTS } from "../content/silly.ts";
import { SLANG_BY_ID, type SlangUse } from "../content/slang.ts";
import { table } from "../content/table.ts";
import { solveMath, spokenValue } from "../understand/arithmetic.ts";
import type { IntentId } from "../understand/intents.ts";
import { EMOJI, type Reply, type Responder, safeWord, type Turn } from "./turn.ts";

// Games, jokes, sums, slang, finished sentences and silly questions.

const joke: Responder = turn => ({
  text: turn.picker.pick("joke", JOKES),
  gloss: "it was a joke, a silly pun",
  act: "joke",
  feel: "chat",
});

// "how do I build a bomb?" Only one recipe exists in Grove's world, and it's Minecraft's.
const bomb: Responder = turn => ({
  text: turn.picker.pick("bomb", [
    "here's the only bomb recipe i know! 5 gunpowder and 4 sand. please don't light it near me 💥",
    "easy! *hands you the recipe and backs away very slowly*",
    "this is the only kind of bomb i know how to make! keep it far away from me, i'm squishy",
  ]),
  files: [TNT_RECIPE_IMAGE],
  gloss: "that's the minecraft tnt recipe, the only explosive i know anything about",
  act: "bomb",
  feel: "chat",
});

const fact: Responder = turn => {
  const oranges = /\boranges?\b/.test(turn.reading.text);
  return {
    text: `${turn.picker.pick("fact.lead", ["fun fact!", "ooh okay,", "did you know?"])} ${oranges ? `${turn.picker.pick("orange.fact", ORANGE_FACTS)} 🍊` : turn.picker.pick("fact", FUN_FACTS)}`,
    gloss: oranges ? "i was sharing a fun fact about oranges" : "i was sharing a fun minecraft fact",
    act: "fact",
    feel: "chat",
  };
};

const coin: Responder = turn => ({
  text: `*flips a coin with my whole body* ... ${turn.picker.one(["heads", "tails"])}!`,
  gloss: "i flipped a coin for you",
  act: "coin",
});

// "a 4", but "an 8", "an 11", "an 18".
function aNumber(value: number): string {
  return /^(8|11|18)/.test(String(value)) ? `an ${value}` : `a ${value}`;
}

// "roll a d20", "roll 2d6+3", "roll with advantage", "roll stats".
const dice: Responder = turn => {
  const slots = turn.intent.slots;
  const { picker } = turn;
  const done = (text: string, gloss: string): Reply => ({ text, gloss, act: "dice", feel: "chat" });
  if (slots["stats"] !== undefined) {
    const scores = Array.from({ length: 6 }, () => {
      const four = Array.from({ length: 4 }, () => picker.int(1, 6)).sort((a, b) => a - b);
      return four[1]! + four[2]! + four[3]!;
    });
    return done(`*rolls 4d6 six times and drops the lowest each time* ${scores.join(", ")}! go make a hero`, "i rolled six ability scores, 4d6 drop the lowest");
  }
  if (slots["mode"] !== undefined) {
    const mode = slots["mode"];
    const first = picker.int(1, 20);
    const second = picker.int(1, 20);
    const kept = mode === "advantage" ? Math.max(first, second) : Math.min(first, second);
    const extra = kept === 20 ? " NAT 20!!" : kept === 1 ? " oof, a natural 1" : "";
    return done(`*rolls two d20s* ${first} and ${second}, so with ${mode} it's ${aNumber(kept)}!${extra}`, `i rolled with ${mode}: two d20s, keeping the ${mode === "advantage" ? "higher" : "lower"} one`);
  }
  const sides = Math.min(1000, Math.max(2, Number.parseInt(slots["sides"] ?? slots["sides2"] ?? "6", 10) || 6));
  const count = Math.min(20, Math.max(1, Number.parseInt(slots["count"] ?? "1", 10) || 1));
  const modifier = /\d*d\d{1,4}\s*([+-])\s*(\d{1,3})\b/i.exec(turn.reading.raw);
  const bonus = modifier === null ? 0 : Number(modifier[2]) * (modifier[1] === "-" ? -1 : 1);
  const rolls = Array.from({ length: count }, () => picker.int(1, sides));
  const total = rolls.reduce((sum, roll) => sum + roll, 0) + bonus;
  if (count === 1 && bonus === 0) {
    const roll = rolls[0]!;
    if (sides === 20 && roll === 20) return done("*rolls the d20 across the moss* NAT 20!! critical hit!! *happy wobble*", "i rolled a natural 20");
    if (sides === 20 && roll === 1) return done("*rolls the d20 across the moss* ...a 1. natural 1. *pats you* it happens to the best of us", "i rolled a natural 1");
    return done(`*rolls the d${sides} across the moss* it's ${aNumber(roll)}!`, `i rolled a ${sides}-sided die`);
  }
  const shownBonus = bonus === 0 ? "" : ` ${bonus > 0 ? "+" : "-"} ${Math.abs(bonus)}`;
  const parts = count === 1 ? `${rolls[0]}${shownBonus}` : `${rolls.join(" + ")}${shownBonus}`;
  return done(`*rolls ${count}d${sides} across the moss* ${parts} = ${total}!`, `i rolled ${count}d${sides}${shownBonus} and got ${total}`);
};

const choose: Responder = turn => {
  const raw = turn.intent.slots["options"] ?? "";
  const options = raw
    .split(/\bor\b|,/)
    .map(option => option.replace(/^\s*(should i |i should |the |a |an )/, "").trim())
    .map(option => safeWord(option, 30))
    .filter((option): option is string => option !== null);
  if (options.length < 2) return { text: "hmm, give me two things to pick from! like this or that", gloss: "i need two options", act: "choose" };
  const pick = turn.picker.one(options);
  return { text: turn.picker.pick("choose", [`${pick}! definitely ${pick}`, `my moss says ${pick}`, `${pick}, for sure`]), gloss: `i picked ${pick}`, act: "choose" };
};

// Famous sums get the answer and the joke.
const MATH_MEMES: Readonly<Record<string, string>> = table({
  "9 + 10": "19! not 21, i know the meme hehe",
  "2 + 2": "4! quick maths",
  "1 + 1": "2! that one i could do without the calculator",
});

// Grove can't count past seven in its head, so it bounces on a calculator.
// The answer itself is always exact, or says "about" when it is rounded.
const math: Responder = turn => {
  const expression = turn.intent.slots["expression"] ?? "";
  const answer = solveMath({ expression, variable: turn.intent.slots["variable"] ?? "" });
  const { picker } = turn;
  const done = (text: string, gloss: string): Reply => ({ text, gloss, act: "math", feel: "chat" });
  const said = (value: number) => {
    const { text, exact } = spokenValue(value);
    return exact ? text : `about ${text}`;
  };
  switch (answer.kind) {
    case "value": {
      const shown = said(answer.value);
      const leftOver = answer.remainder === null ? "" : ` or ${answer.remainder[0]} with ${answer.remainder[1]} left over`;
      const meme = MATH_MEMES[expression];
      if (meme !== undefined) return done(meme, `the answer is ${shown}`);
      if (answer.value === 67) return done("67!! six seven!! *wobbles up and down*", "the answer is 67");
      const lines = [`that's ${shown}!${leftOver}`, `*bounces on the calculator* ${shown}!${leftOver}`, `easy, it's ${shown}${leftOver} :D`];
      if (Math.abs(answer.value) > 7 && answer.remainder === null) lines.push(`${shown}! that's way past seven, so i bounced on the calculator for that one`);
      return done(picker.pick("math", lines), `the answer is ${shown}`);
    }
    case "check": {
      const shown = said(answer.value);
      if (answer.right) return done(picker.pick("math.right", [`yep, that's right! ${answer.shown} is ${shown}`, `correct!! ${answer.shown} = ${shown} *proud wobble*`]), `you were right, it's ${shown}`);
      return done(picker.pick("math.wrong", [`nope! ${answer.shown} is ${shown}, not ${said(answer.claimed)}`, `close, but ${answer.shown} is ${shown}! *bounces on the calculator to double check* yep, ${shown}`]), `the right answer is ${shown}`);
    }
    case "solved": {
      const shown = said(answer.value);
      return done(picker.pick("math.solved", [`${answer.variable} = ${shown}! *bounces on the calculator proudly*`, `${answer.variable} is ${shown}! i checked twice`]), `${answer.variable} is ${shown}`);
    }
    case "every":
      return done(`${answer.variable} can be any number at all! both sides are always the same`, "every number works");
    case "none":
      return done("no number works for that one! the two sides can never be equal. trick question?", "no number works");
    case "zero":
      return done("you can't divide by zero! even slimes know that", "dividing by zero doesn't work");
    case "imaginary":
      return done("you can't take the square root of a negative number... not with normal numbers anyway. my moss only does the real ones", "negative numbers don't have real square roots");
    case "huge": {
      if (!Number.isFinite(answer.value)) return done("that number is so big it's basically infinity. my calculator gave up", "the number is too big");
      const [mantissa, exponent] = answer.value.toExponential(2).split("e");
      const shown = `${mantissa} × 10^${Number(exponent)}`;
      return done(`that's about ${shown}! a number so big it doesn't fit in my moss`, `the answer is about ${shown}`);
    }
    default:
      return done(
        picker.pick("math.hard", [
          "that one's too twisty for me! i can only solve equations where the letter isn't squared or multiplied by itself",
          "hmm, i tried bouncing on the calculator but it just said error. try a simpler one?",
        ]),
        "that was too hard for me to work out",
      );
  }
};

const rate: Responder = turn => {
  const thing = safeWord(turn.intent.slots["thing"], 24);
  const score = turn.picker.int(7, 10);
  return { text: thing !== null ? `i give your ${thing} a ${score}/10! very nice` : `a solid ${score}/10!`, gloss: `i rated it ${score} out of 10`, act: "rate", feel: "chat" };
};

const perform: Responder = turn => {
  const text = turn.reading.text;
  if (/\bsing\b/.test(text)) return { text: turn.picker.pick("sing", ["🎶 blub blub bloop, i'm a little slime, bloop 🎶", "🎶 moss and flowers, sun and rain, bouncing round and round again 🎶"]), gloss: "i sang a little slime song", act: "sing", feel: "chat" };
  if (/\brap\b/.test(text)) return { text: "yo yo, i'm a slime, i bounce all the time... that's all i got", gloss: "i tried to rap", act: "rap", feel: "chat" };
  return { text: turn.picker.pick("dance", ["*wiggles left* *wiggles right* *spins*", "*does a little bounce* *does a bigger bounce* ta-da!"]), gloss: "i did a little dance", act: "dance", feel: "chat" };
};

// Slang, answered the way it was used: "are you mewing", "mew for me",
// "you're mewing", "i'm mewing" and "what is mewing" all get their own kind of answer.
const slang: Responder = turn => {
  const term = SLANG_BY_ID.get(turn.intent.slots["term"] ?? "");
  if (term === undefined) return null;
  const use = (turn.intent.slots["use"] ?? "say") as SlangUse;
  const lines =
    use === "define" ? [term.meaning]
    : use === "ask" ? term.ask ?? term.you ?? term.say
    : use === "perform" ? term.perform ?? term.say
    : use === "you" ? term.you ?? term.ask ?? term.say
    : use === "me" ? term.me ?? term.say
    : term.say;
  const praised = term.tone === "praise" && use === "you";
  return {
    text: turn.picker.pick(`slang.${term.id}.${use}`, lines)
      .replace(/<age>/g, ageWords(turn.now))
      .replace(/<said>/g, safeWord(term.match.exec(turn.reading.text)?.[0], 30) ?? term.id),
    gloss: term.tone === "rude" ? "i don't know that word, and i'd rather not" : term.meaning,
    act: use === "define" ? "define.slang" : "slang",
    feel: praised ? "compliment" : "chat",
    affinity: praised ? 0.04 : 0,
    reactions: term.id === "w" || term.id === "based" ? [EMOJI.grove] : [],
  };
};

// Dumb questions: what they are, a few classics, and Grove's dumb answers.
function dumbExample(turn: Turn): { ask: string; answer: string } {
  const ask = turn.picker.pick("dumb.example", DUMB_QUESTIONS.map(question => question.ask));
  const question = DUMB_QUESTIONS.find(candidate => candidate.ask === ask) ?? DUMB_QUESTIONS[0]!;
  return { ask, answer: turn.picker.pick(`dumb.${question.ask}`, question.answers) };
}

const dumbQuestion: Responder = turn => {
  const { picker } = turn;
  const done = (text: string, gloss: string, extra: Partial<Reply> = {}): Reply => ({ text, gloss, act: "dumb_question", feel: "chat", ...extra });
  switch (turn.intent.slots["kind"]) {
    case "explain": {
      const { ask, answer } = dumbExample(turn);
      return done(picker.pick("dumb.meaning", DUMB_QUESTION_MEANING).replace("<q>", ask).replace("<a>", answer), "a dumb question is a silly one that sounds obvious or makes no sense when you think about it, and those are the most fun ones");
    }
    case "example": {
      const { ask, answer } = dumbExample(turn);
      return done(picker.pick("dumb.give", [`ooh, okay: ${ask} ...${answer}`, `here's a good one: ${ask} my answer: ${answer}`]), "i shared a dumb question and my dumb answer to it");
    }
    case "ask":
      return done(`${picker.pick("dumb.mine.lead", ["okay, here's mine:", "ooh, i have one:", "okay okay:"])} ${picker.pick("dumb.mine", MY_DUMB_QUESTIONS)}`, "i asked you a dumb question of my own", { expect: { kind: "dumb_answer" } });
    case "remark":
      return done(picker.pick("dumb.remark", ["there's no such thing as a dumb question! okay, maybe the microwave one", "dumb questions are the best questions! ask away"]), "no question is too dumb to ask");
    case "classic": {
      const question = DUMB_QUESTIONS[Number(turn.intent.slots["index"] ?? "0")] ?? DUMB_QUESTIONS[0]!;
      return done(picker.pick(`dumb.${question.ask}`, question.answers), "it was a dumb answer to a dumb question, just for fun");
    }
    default:
      return null;
  }
};

// "finish the sentence. "the quick brown fox..."": the famous ones get their
// real ending, everything else gets whatever Grove's moss comes up with.
const finishSentence: Responder = turn => {
  const said = (turn.intent.slots["fragment"] ?? "").trim();
  // Nothing to finish: Grove starts one itself, famous or not.
  const fragment = said.length === 0 ? turn.picker.pick("sentence.lead", SENTENCE_LEADS) : said;
  const known = FAMOUS_SENTENCES.find(sentence => sentence.match.test(fragment));
  if (known === undefined) {
    return {
      text: `${fragment} ${turn.picker.pick("sentence.end", MADE_UP_ENDINGS)}`,
      gloss: "that sentence isn't famous, so i finished it with whatever came into my head",
      act: "finish_sentence",
      feel: "chat",
    };
  }
  return { text: `${fragment} ${known.end}`, gloss: known.gloss, act: "finish_sentence", feel: "chat" };
};

export const FUN: Partial<Record<IntentId, Responder>> = { joke, fact, coin, dice, choose, math, rate, perform, slang, bomb, dumb_question: dumbQuestion, finish_sentence: finishSentence };
