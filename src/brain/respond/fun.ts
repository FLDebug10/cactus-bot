import { FUN_FACTS, JOKES, TNT_RECIPE_IMAGE } from "../content/knowledge.ts";
import { table } from "../content/table.ts";
import type { IntentId } from "../understand/intents.ts";
import { EMOJI, type Responder, safeWord } from "./turn.ts";

// Games, jokes, and slang.

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

const fact: Responder = turn => ({
  text: `${turn.picker.pick("fact.lead", ["fun fact!", "ooh okay,", "did you know?"])} ${turn.picker.pick("fact", FUN_FACTS)}`,
  gloss: "i was sharing a fun minecraft fact",
  act: "fact",
  feel: "chat",
});

const coin: Responder = turn => ({
  text: `*flips a coin with my whole body* ... ${turn.picker.one(["heads", "tails"])}!`,
  gloss: "i flipped a coin for you",
  act: "coin",
});

const dice: Responder = turn => {
  const sides = Math.min(1000, Math.max(2, Number.parseInt(turn.intent.slots["sides"] ?? turn.intent.slots["sides2"] ?? "6", 10) || 6));
  const roll = turn.picker.int(1, sides);
  return { text: `*rolls the d${sides} across the moss* it's a ${roll}!`, gloss: `i rolled a ${sides}-sided die`, act: "dice" };
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

// A tiny arithmetic evaluator: numbers, + - * / ^, and brackets. No eval.
function evaluate(expression: string): number | null {
  const tokens = expression.replace(/[x×]/g, "*").replace(/÷/g, "/").match(/\d+(?:\.\d+)?|[+\-*/^()]/g);
  if (tokens === null) return null;
  let position = 0;

  const peek = () => tokens[position];
  const take = () => tokens[position++];

  function primary(): number {
    const token = take();
    if (token === "(") {
      const value = sum();
      if (take() !== ")") throw new Error("bracket");
      return value;
    }
    if (token === "-") return -primary();
    if (token === undefined || !/^\d/.test(token)) throw new Error("number");
    return Number.parseFloat(token);
  }
  function power(): number {
    const base = primary();
    if (peek() === "^") {
      take();
      return Math.pow(base, power());
    }
    return base;
  }
  function product(): number {
    let value = power();
    while (peek() === "*" || peek() === "/") {
      const op = take();
      const right = power();
      value = op === "*" ? value * right : value / right;
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (peek() === "+" || peek() === "-") {
      const op = take();
      const right = product();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  try {
    const value = sum();
    return position === tokens.length ? value : null;
  } catch {
    return null;
  }
}

const math: Responder = turn => {
  const value = evaluate(turn.intent.slots["expression"] ?? "");
  if (value === null) return { text: "hmm, i tried counting that on my... i don't have fingers. i got lost", gloss: "i couldn't work that out", act: "math" };
  if (!Number.isFinite(value)) return { text: "you can't divide by zero! even slimes know that", gloss: "dividing by zero doesn't work", act: "math" };
  const shown = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
  return {
    text: turn.picker.pick("math", [`that's ${shown}!`, `${shown}! i counted on my... wait, i don't have fingers. but it's ${shown}`, `easy, it's ${shown} :D`]),
    gloss: `the answer is ${shown}`,
    act: "math",
  };
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

const SLANG_LINES: Readonly<Record<string, readonly string[]>> = table({
  rizz: ["rizz? i have slime rizz. it's very sticky", "my rizz is 100% moss-based"],
  sigma: ["i don't know what that means, but i'm a slime, so probably not"],
  skibidi: ["i've heard the kids say that... i'm too mossy to understand"],
  ohio: ["is ohio a biome? is it swampy?"],
  gyatt: ["i don't know what that means and i feel like i shouldn't ask"],
  mewing: ["i don't have a jaw, so i can't mew. i can wobble though"],
  bussin: ["bussin like moss after rain!"],
  cap: ["no cap, i'm a slime. slimes can't lie, we're see-through"],
  nocap: ["no cap!! i'm too squishy to lie"],
  slay: ["slay!! 💅 i don't have nails but i'm doing the hand thing in my heart"],
  based: ["based!! :D"],
  goated: ["goated!! i feel very goated today"],
  mid: ["aw, mid? :("],
  ratio: ["please don't ratio me, i'm small"],
  sus: ["i'm not sus, i'm slimy. different thing"],
  npc: ["i'm not an npc, i'm a slime! okay, i'm a bot. but a slime bot"],
  aura: ["+1000 aura for talking to me"],
  delulu: ["being delulu is the solulu"],
  sheesh: ["sheeeesh"],
  yeet: ["please don't yeet me, i'll splat"],
  pog: ["pog!! :D"],
  w: ["W!! :D"],
  l: ["aw, an L? :("],
  drip: ["my drip is a flower crown. very fashionable"],
  fanum: ["please don't fanum tax my moss"],
  griddy: ["*attempts the griddy* *falls over* i don't have legs"],
  ate: ["ate and left no crumbs!"],
});

const slang: Responder = turn => {
  const term = turn.intent.slots["term"] ?? "";
  const lines = SLANG_LINES[term];
  if (lines === undefined) return null;
  return { text: turn.picker.pick(`slang.${term}`, lines), gloss: `i was reacting to the slang ${term}`, act: "slang", feel: "chat", reactions: term === "w" || term === "based" ? [EMOJI.grove] : [] };
};

export const FUN: Partial<Record<IntentId, Responder>> = { joke, fact, coin, dice, choose, math, rate, perform, slang, bomb };
