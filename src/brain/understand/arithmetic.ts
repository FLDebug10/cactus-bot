// Sums people ask Grove: "what's 24 divided by 5", "grove what is 20 time 30",
// "50*(12+8)", "what's 15% of 80", "solve 2x + 3 = 7", "is 7 x 8 = 54?".
// Words become symbols, and the sum has to parse completely. A sum written
// with symbols alone only counts when the rest of the message is small talk
// (or a "what's" right before it), so "i rate it 10/10", "what's 2-3 weeks"
// and "my birthday is 10/03/2026" are never taken for questions.

import { table } from "../content/table.ts";

export interface MathProblem {
  // Numbers, + - * / ^, brackets, "sqrt", "cbrt", "=" and the unknown letter.
  expression: string;
  // The unknown in an equation ("x" in "2x + 3 = 7"), or "".
  variable: string;
}

export type MathAnswer =
  | { kind: "value"; value: number; remainder: readonly [number, number] | null }
  | { kind: "check"; value: number; claimed: number; right: boolean; shown: string }
  | { kind: "solved"; variable: string; value: number }
  | { kind: "every" | "none"; variable: string }
  | { kind: "huge"; value: number }
  | { kind: "zero" | "imaginary" | "too_hard" };

type Op = "+" | "-" | "*" | "/" | "^";

type Item = (
  | { kind: "num"; value: number }
  | { kind: "op"; op: Op }
  | { kind: "open" }
  | { kind: "close" }
  | { kind: "fn"; fn: "sqrt" | "cbrt" }
  | { kind: "eq" }
  | { kind: "var"; name: string }
  | { kind: "word"; word: string }
  | { kind: "ask" }
) & {
  // Written in words ("divided by", "squared"), which only a sum would say.
  wordy?: boolean;
};

const UNITS: Readonly<Record<string, number>> = table({
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
});

const SCALES: Readonly<Record<string, number>> = table({ hundred: 100, thousand: 1_000, million: 1_000_000, billion: 1_000_000_000 });

// Words between two numbers that turn them into a sum.
const INFIX: ReadonlyArray<readonly [readonly string[], Op]> = [
  [["raised", "to", "the", "power", "of"], "^"], [["to", "the", "power", "of"], "^"], [["to", "the", "power"], "^"],
  [["raised", "to", "the"], "^"], [["raised", "to"], "^"], [["to", "the"], "^"],
  [["multiplied", "by"], "*"], [["multiply", "by"], "*"], [["times"], "*"], [["time"], "*"], [["x"], "*"],
  [["divided", "by"], "/"], [["divide", "by"], "/"], [["divided"], "/"], [["over"], "/"],
  [["plus"], "+"], [["minus"], "-"], [["take", "away"], "-"],
];

// "add 5 and 3", "subtract 3 from 10", "the product of 4 and 6".
const VERB_FORMS: ReadonlyArray<{ words: readonly string[]; joins: readonly string[]; op: Op; flip: boolean }> = [
  { words: ["add"], joins: ["and", "to", "plus"], op: "+", flip: false },
  { words: ["the", "sum", "of"], joins: ["and"], op: "+", flip: false },
  { words: ["sum", "of"], joins: ["and"], op: "+", flip: false },
  { words: ["subtract"], joins: ["from"], op: "-", flip: true },
  { words: ["take"], joins: ["from"], op: "-", flip: true },
  { words: ["the", "difference", "between"], joins: ["and"], op: "-", flip: false },
  { words: ["multiply"], joins: ["by", "and", "times"], op: "*", flip: false },
  { words: ["the", "product", "of"], joins: ["and"], op: "*", flip: false },
  { words: ["product", "of"], joins: ["and"], op: "*", flip: false },
  { words: ["divide"], joins: ["by"], op: "/", flip: false },
  { words: ["the", "quotient", "of"], joins: ["and"], op: "/", flip: false },
];

const FUNCTIONS: ReadonlyArray<readonly [readonly string[], "sqrt" | "cbrt"]> = [
  [["square", "root", "of"], "sqrt"], [["square", "root"], "sqrt"], [["sqrt"], "sqrt"], [["root", "of"], "sqrt"],
  [["cube", "root", "of"], "cbrt"], [["cube", "root"], "cbrt"], [["cbrt"], "cbrt"],
];

// "half of 50", "double 12": a number and a times sign in one word or two.
const SCALERS: ReadonlyArray<readonly [readonly string[], number]> = [
  [["a", "half", "of"], 0.5], [["one", "half", "of"], 0.5], [["half", "of"], 0.5],
  [["a", "quarter", "of"], 0.25], [["one", "quarter", "of"], 0.25], [["a", "fourth", "of"], 0.25], [["quarter", "of"], 0.25],
  [["double"], 2], [["twice"], 2], [["triple"], 3], [["thrice"], 3],
];

const THIRDS: readonly (readonly string[])[] = [["a", "third", "of"], ["one", "third", "of"], ["third", "of"]];

// Words that can sit around a sum without making it something else. The
// short ones are what is left of contractions ("it's" -> "it", "s").
const SMALL_TALK = new Set(`
  grove grovey hey hi hello yo um uh umm so ok okay please pls plz quick quickly real question math maths what is
  are was does do did it the answer to how much calculate calc compute solve work out figure can could would will
  you tell me help with this that equal equals be lol lmao bro bruh dude hmm hm wait i need know want wanna for my
  homework now again find get give just then and also an a of if on in result solution value right correct
  thanks thank fr yes yeah oh ah btw exactly number numbers friend bestie buddy pal mate rn cuz because
  someone sum gonna going try trying asking ask answer answers check checking s m re ll t d ve
`.trim().split(/\s+/));

const CUE = /\b(what is|how much is|calculate|calc|compute|solve|work out|figure out|what does)$/;

// "it's 24/7", "a 50/50 chance", "9/10": sayings and ratings, unless someone asks "what's 9/10".
const IDIOMS = /^(24 \/ 7|50 \/ 50|\d+(\.\d+)? \/ (5|10|100))$/;

// Letters that can be the unknown in an equation.
const UNKNOWNS = new Set(["x", "y", "z", "n"]);

const QUICK_CHECK = /\d|\b(plus|minus|times|divided|multiply|multiplied|subtract|squared|cubed|root|sqrt|percent|half|double|triple|twice|sum|product)\b|[√²³×÷]/;

export function mathIn(raw: string): MathProblem | null {
  const lower = raw.toLowerCase();
  if (!QUICK_CHECK.test(lower)) return null;
  const text = lower
    .replace(/<a?:\w+:\d+>|<@[!&]?\d+>|<#\d+>|https?:\/\/\S+/g, " ")
    .replace(/`/g, " ")
    .replace(/[×✕✖]/g, " * ")
    .replace(/÷/g, " / ")
    .replace(/[−–]/g, " - ")
    .replace(/√/g, " sqrt ")
    .replace(/²/g, " ^ 2 ")
    .replace(/³/g, " ^ 3 ")
    .replace(/\*\*/g, " ^ ")
    .replace(/([a-z])-(?=[a-z])/g, "$1 ")
    .replace(/\bwhat'?s\b/g, "what is")
    .replace(/\bhow'?s\b/g, "how is");

  const tokens = text.match(/\d+(?:,\d{3})+(?:\.\d+)?|\d*\.\d+|\d+|[a-z]+|[-+*/^()=%?:,]/g);
  if (tokens === null) return null;

  const numbers = withNumbers(tokens);
  const variable = unknownIn(numbers);
  const items = toItems(numbers, variable);
  const startsAsking = /^\W*(?:(?:grove|hey|hi|um|so|ok|okay|wait)\W+)*(?:is|does|did|do)\b/.test(text);

  let best: { start: number; end: number; expression: string; variable: string; wordy: boolean } | null = null;
  for (const run of runsIn(items)) {
    const found = readRun(items.slice(run.start, run.end), variable, startsAsking);
    if (found === null) continue;
    if (best === null || run.end - run.start > best.end - best.start) best = { ...found, ...run };
  }
  if (best === null) return null;

  if (!best.wordy) {
    const { start, end } = best;
    const wordsOf = (from: number, to: number) => items.slice(from, to).flatMap(item => (item.kind === "word" ? [item.word] : []));
    const before = wordsOf(0, start);
    const after = wordsOf(end, items.length);
    const cued = CUE.test(before.join(" "));
    if (!after.every(word => SMALL_TALK.has(word))) return null;
    if (!cued && !before.every(word => SMALL_TALK.has(word))) return null;
    if (!cued && IDIOMS.test(best.expression)) return null;
  }
  return { expression: best.expression, variable: best.variable };
}

interface Token {
  text: string;
  // Set when the token was a number, written as digits or as words.
  value: number | null;
  wordy: boolean;
}

// "twenty five" -> 25, "a hundred and five" -> 105, "1,000" -> 1000.
function withNumbers(tokens: readonly string[]): Token[] {
  const out: Token[] = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index]!;
    if (/\d/.test(token)) {
      out.push({ text: token, value: Number(token.replace(/,/g, "")), wordy: false });
      index++;
      continue;
    }
    const spoken = spokenNumber(tokens, index);
    if (spoken !== null) {
      out.push({ text: tokens.slice(index, spoken.end).join(" "), value: spoken.value, wordy: true });
      index = spoken.end;
      continue;
    }
    out.push({ text: token, value: null, wordy: false });
    index++;
  }
  return out;
}

function spokenNumber(tokens: readonly string[], start: number): { value: number; end: number } | null {
  let total = 0;
  let current = 0;
  let index = start;
  let any = false;
  let afterScale = false;
  while (index < tokens.length) {
    const word = tokens[index]!;
    const next = tokens[index + 1];
    if (word === "a" && !any && next !== undefined && SCALES[next] !== undefined) {
      current = 1;
      index++;
      continue;
    }
    if (word === "and" && afterScale && next !== undefined && UNITS[next] !== undefined) {
      index++;
      continue;
    }
    const unit = UNITS[word];
    const scale = SCALES[word];
    if (unit !== undefined) {
      current += unit;
      afterScale = false;
    } else if (scale !== undefined && (any || current > 0)) {
      if (scale === 100) current = (current === 0 ? 1 : current) * 100;
      else {
        total += (current === 0 ? 1 : current) * scale;
        current = 0;
      }
      afterScale = true;
    } else break;
    any = true;
    index++;
  }
  return any ? { value: total + current, end: index } : null;
}

// The letter an equation asks for: "solve for y", or an "x" stuck to a number or sign.
function unknownIn(tokens: readonly Token[]): string {
  if (!tokens.some(token => token.text === "=" || token.text === "equals" || token.text === "equal")) return "";
  const touches = (neighbour: Token | undefined) => neighbour !== undefined && (neighbour.value !== null || /^[-+*/^()=]$/.test(neighbour.text));
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    const next = tokens[index + 1];
    if (token.text === "for" && tokens[index - 1]?.text === "solve" && next !== undefined && UNKNOWNS.has(next.text)) return next.text;
    if (!UNKNOWNS.has(token.text)) continue;
    const before = tokens[index - 1];
    // "2 x 3 = 6": an x between two numbers is a times sign.
    if (before !== undefined && before.value !== null && next !== undefined && next.value !== null) continue;
    if (touches(before) || touches(next)) return token.text;
  }
  return "";
}

function matchesAt(tokens: readonly Token[], index: number, words: readonly string[]): boolean {
  return words.every((word, offset) => tokens[index + offset]?.text === word);
}

// A number, a bracket, a minus sign or a function can start the next operand.
function startsOperand(tokens: readonly Token[], index: number, variable: string): boolean {
  const token = tokens[index];
  if (token === undefined) return false;
  if (token.value !== null || token.text === "(" || token.text === "-" || (variable !== "" && token.text === variable)) return true;
  return FUNCTIONS.some(([words]) => matchesAt(tokens, index, words));
}

function toItems(tokens: readonly Token[], variable: string): Item[] {
  const items: Item[] = [];
  const endsOperand = () => {
    const last = items[items.length - 1];
    return last !== undefined && (last.kind === "num" || last.kind === "close" || last.kind === "var");
  };
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index]!;

    if (token.value !== null) {
      items.push({ kind: "num", value: token.value, wordy: token.wordy });
      index++;
      continue;
    }

    const verb = VERB_FORMS.find(form => matchesAt(tokens, index, form.words));
    if (verb !== undefined) {
      const at = index + verb.words.length;
      const first = tokens[at];
      const join = tokens[at + 1];
      const second = tokens[at + 2];
      if (first !== undefined && first.value !== null && join !== undefined && verb.joins.includes(join.text) && second !== undefined && second.value !== null) {
        const [a, b] = verb.flip ? [second.value, first.value] : [first.value, second.value];
        items.push({ kind: "open" }, { kind: "num", value: a }, { kind: "op", op: verb.op, wordy: true }, { kind: "num", value: b }, { kind: "close" });
        index = at + 3;
        continue;
      }
    }

    if (endsOperand()) {
      if ((token.text === "%" || token.text === "percent") && tokens[index + 1]?.text === "of") {
        items.push({ kind: "op", op: "/", wordy: true }, { kind: "num", value: 100 }, { kind: "op", op: "*" });
        index += 2;
        continue;
      }
      if (token.text === "%" || token.text === "percent") {
        items.push({ kind: "op", op: "/", wordy: true }, { kind: "num", value: 100 });
        index++;
        continue;
      }
      if (token.text === "squared" || token.text === "cubed") {
        items.push({ kind: "op", op: "^", wordy: true }, { kind: "num", value: token.text === "squared" ? 2 : 3 });
        index++;
        continue;
      }
      // "3/4 of 100": "of" after a fraction multiplies.
      const sign = items[items.length - 2];
      if (token.text === "of" && sign !== undefined && sign.kind === "op" && sign.op === "/" && startsOperand(tokens, index + 1, variable)) {
        items.push({ kind: "op", op: "*", wordy: true });
        index++;
        continue;
      }
      const infix = INFIX.find(([words]) => matchesAt(tokens, index, words) && startsOperand(tokens, index + words.length, variable));
      if (infix !== undefined && !(infix[0][0] === "x" && variable === "x")) {
        items.push({ kind: "op", op: infix[1], wordy: infix[0][0] !== "x" });
        index += infix[0].length;
        continue;
      }
    }

    const fn = FUNCTIONS.find(([words]) => matchesAt(tokens, index, words));
    if (fn !== undefined && startsOperand(tokens, index + fn[0].length, variable)) {
      items.push({ kind: "fn", fn: fn[1], wordy: fn[0][0] !== "sqrt" && fn[0][0] !== "cbrt" });
      index += fn[0].length;
      continue;
    }
    const scaler = SCALERS.find(([words]) => matchesAt(tokens, index, words));
    if (scaler !== undefined && startsOperand(tokens, index + scaler[0].length, variable)) {
      items.push({ kind: "num", value: scaler[1] }, { kind: "op", op: "*", wordy: true });
      index += scaler[0].length;
      continue;
    }
    const third = THIRDS.find(words => matchesAt(tokens, index, words));
    if (third !== undefined && startsOperand(tokens, index + third.length, variable)) {
      items.push({ kind: "open" }, { kind: "num", value: 1 }, { kind: "op", op: "/", wordy: true }, { kind: "num", value: 3 }, { kind: "close" }, { kind: "op", op: "*" });
      index += third.length;
      continue;
    }

    if (variable !== "" && token.text === variable) {
      items.push({ kind: "var", name: variable });
      index++;
      continue;
    }
    if (token.text === "equals" || token.text === "equal") {
      items.push({ kind: "eq" });
      index += token.text === "equal" && tokens[index + 1]?.text === "to" ? 2 : 1;
      continue;
    }
    switch (token.text) {
      case "+": case "-": case "*": case "/": case "^":
        items.push({ kind: "op", op: token.text });
        break;
      case "(":
        items.push({ kind: "open" });
        break;
      case ")":
        items.push({ kind: "close" });
        break;
      case "=":
        items.push({ kind: "eq" });
        break;
      // "solve for y: 4y - 2 = 10": a colon or comma ends one thought.
      case "?": case ":": case ",":
        items.push({ kind: "ask" });
        break;
      case "%":
        break;
      default:
        items.push({ kind: "word", word: token.text });
    }
    index++;
  }
  return items;
}

function runsIn(items: readonly Item[]): Array<{ start: number; end: number }> {
  const runs: Array<{ start: number; end: number }> = [];
  let start = -1;
  items.forEach((item, index) => {
    if (item.kind !== "word" && item.kind !== "ask") {
      if (start < 0) start = index;
    } else if (start >= 0) {
      runs.push({ start, end: index });
      start = -1;
    }
  });
  if (start >= 0) runs.push({ start, end: items.length });
  return runs;
}

// Turns one run of math items into an expression, if it is a real sum.
function readRun(found: readonly Item[], variable: string, startsAsking: boolean): { expression: string; variable: string; wordy: boolean } | null {
  let run = [...found];
  const depth = () => run.reduce((sum, item) => sum + (item.kind === "open" ? 1 : item.kind === "close" ? -1 : 0), 0);
  // Brackets that belong to the sentence or a smiley: "(what's 2+2)", "2+2 :)".
  while (run.length > 0 && (run[run.length - 1]!.kind === "eq" || run[run.length - 1]!.kind === "open" || (run[run.length - 1]!.kind === "close" && depth() < 0))) run.pop();
  while (run.length > 0 && (run[0]!.kind === "eq" || run[0]!.kind === "close" || (run[0]!.kind === "open" && depth() > 0))) run.shift();
  if (run.length === 0) return null;

  // "is 7 x 8 56": the answer to check, written straight after the sum.
  const last = run[run.length - 1]!;
  const beforeLast = run[run.length - 2];
  if (startsAsking && last.kind === "num" && (beforeLast?.kind === "num" || beforeLast?.kind === "close") && !run.some(item => item.kind === "eq")) {
    run = [...run.slice(0, -1), { kind: "eq" }, last];
  }

  const operators = run.filter(item => item.kind === "op" || item.kind === "fn");
  const unknown = variable !== "" && run.some(item => item.kind === "var");
  if (operators.length === 0 && !unknown) return null;
  if (unknown && !run.some(item => item.kind === "eq")) return null;

  const expression = run.map(serialize).join(" ");
  const answer = solveMath({ expression, variable: unknown ? variable : "" });
  if (answer.kind === "too_hard" && !unknown) return null;

  // "10/03/2026" and "555-123-4567" are dates and phone numbers, not sums.
  const shapedLikeADate = run.length === 5 && operators.length === 2 && operators.every(item => item.kind === "op" && (item.op === "/" || item.op === "-"));
  const wordy = run.some(item => item.wordy === true) || unknown || run.some(item => item.kind === "open") || (operators.length >= 2 && !shapedLikeADate);
  return { expression, variable: unknown ? variable : "", wordy };
}

function serialize(item: Item): string {
  switch (item.kind) {
    case "num": return String(item.value);
    case "op": return item.op;
    case "open": return "(";
    case "close": return ")";
    case "fn": return item.fn;
    case "eq": return "=";
    case "var": return item.name;
    default: return "";
  }
}

interface Linear {
  // k * unknown + c
  k: number;
  c: number;
}

class MathTrouble extends Error {
  readonly kind: "zero" | "imaginary" | "too_hard";

  constructor(kind: "zero" | "imaginary" | "too_hard") {
    super(kind);
    this.kind = kind;
  }
}

const constant = (c: number): Linear => ({ k: 0, c });

export function solveMath(problem: MathProblem): MathAnswer {
  const tokens = problem.expression.match(/\d+(?:\.\d+)?(?:e[-+]?\d+)?|sqrt|cbrt|[a-z]|[-+*/^()=]/g) ?? [];
  const sides: string[][] = [[]];
  for (const token of tokens) {
    if (token === "=") sides.push([]);
    else sides[sides.length - 1]!.push(token);
  }
  if (sides.length > 2 || sides.some(side => side.length === 0)) return { kind: "too_hard" };

  try {
    const values = sides.map(side => parseSide(side, problem.variable));
    const left = values[0]!;
    const right = values[1];
    if (right === undefined) {
      if (left.k !== 0) return { kind: "too_hard" };
      return valueAnswer(left.c, problem.expression);
    }
    if (problem.variable === "") {
      const leftFirst = sides[0]!.length >= sides[1]!.length;
      const sum = leftFirst ? left.c : right.c;
      const claimed = leftFirst ? right.c : left.c;
      if (!Number.isFinite(sum) || Math.abs(sum) >= 1e15) return { kind: "huge", value: sum };
      return { kind: "check", value: sum, claimed, right: close(sum, claimed), shown: prettyExpression((leftFirst ? sides[0]! : sides[1]!).join(" ")) };
    }
    const k = left.k - right.k;
    const c = right.c - left.c;
    if (Math.abs(k) < 1e-12) return { kind: Math.abs(c) < 1e-9 ? "every" : "none", variable: problem.variable };
    return { kind: "solved", variable: problem.variable, value: c / k };
  } catch (error) {
    if (error instanceof MathTrouble) return { kind: error.kind };
    throw error;
  }
}

function valueAnswer(value: number, expression: string): MathAnswer {
  if (Number.isNaN(value)) return { kind: "imaginary" };
  if (!Number.isFinite(value) || Math.abs(value) >= 1e15) return { kind: "huge", value };
  const division = /^(\d+) \/ (\d+)$/.exec(expression);
  let remainder: readonly [number, number] | null = null;
  if (division !== null) {
    const top = Number(division[1]);
    const bottom = Number(division[2]);
    if (bottom > 0 && top % bottom !== 0) remainder = [Math.floor(top / bottom), top % bottom];
  }
  return { kind: "value", value, remainder };
}

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

// Recursive descent over one side of an equation, in "k * unknown + c" form,
// so a plain sum and a simple equation share one parser.
function parseSide(tokens: readonly string[], variable: string): Linear {
  let position = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];

  const multiply = (a: Linear, b: Linear): Linear => {
    if (a.k !== 0 && b.k !== 0) throw new MathTrouble("too_hard");
    return { k: a.k * b.c + b.k * a.c, c: a.c * b.c };
  };
  const divide = (a: Linear, b: Linear): Linear => {
    if (b.k !== 0) throw new MathTrouble("too_hard");
    if (b.c === 0) throw new MathTrouble("zero");
    return { k: a.k / b.c, c: a.c / b.c };
  };

  // Something that can follow an operand with no sign between: "2(3)", "2x", "(1)(2)".
  const startsImplicit = (next: string | undefined) => {
    if (next === undefined) return false;
    if (next === "(" || next === "sqrt" || next === "cbrt" || (variable !== "" && next === variable)) return true;
    const previous = tokens[position - 1];
    return /^\d/.test(next) && (previous === ")" || (variable !== "" && previous === variable));
  };

  function sum(): Linear {
    let value = product();
    while (peek() === "+" || peek() === "-") {
      const sign = take() === "+" ? 1 : -1;
      const right = product();
      value = { k: value.k + sign * right.k, c: value.c + sign * right.c };
    }
    return value;
  }

  function product(): Linear {
    let value = unary();
    for (;;) {
      const next = peek();
      if (next === "*") {
        take();
        value = multiply(value, unary());
      } else if (next === "/") {
        take();
        value = divide(value, unary());
      } else if (startsImplicit(next)) {
        value = multiply(value, unary());
      } else return value;
    }
  }

  function unary(): Linear {
    if (peek() === "-") {
      take();
      const value = unary();
      return { k: -value.k, c: -value.c };
    }
    if (peek() === "+") {
      take();
      return unary();
    }
    return power();
  }

  function power(): Linear {
    const base = atom();
    if (peek() !== "^") return base;
    take();
    const exponent = unary();
    if (base.k !== 0 || exponent.k !== 0) throw new MathTrouble("too_hard");
    const value = Math.pow(base.c, exponent.c);
    if (Number.isNaN(value)) throw new MathTrouble("imaginary");
    return constant(value);
  }

  function atom(): Linear {
    const token = take();
    if (token === "(") {
      const value = sum();
      if (take() !== ")") throw new MathTrouble("too_hard");
      return value;
    }
    if (token === "sqrt" || token === "cbrt") {
      const inner = unary();
      if (inner.k !== 0) throw new MathTrouble("too_hard");
      if (token === "sqrt" && inner.c < 0) throw new MathTrouble("imaginary");
      return constant(token === "sqrt" ? Math.sqrt(inner.c) : Math.cbrt(inner.c));
    }
    if (variable !== "" && token === variable) return { k: 1, c: 0 };
    if (token !== undefined && /^\d/.test(token)) return constant(Number(token));
    throw new MathTrouble("too_hard");
  }

  const value = sum();
  if (position !== tokens.length) throw new MathTrouble("too_hard");
  return value;
}

// How Grove writes a number: "4.8", "3.3333" (not exact), "12,345".
export function spokenValue(value: number): { text: string; exact: boolean } {
  const whole = Math.round(value);
  if (Math.abs(value - whole) < 1e-9) return { text: withCommas(whole === 0 ? 0 : whole), exact: true };
  const rounded = Number(value.toFixed(4));
  return { text: withCommas(rounded), exact: Math.abs(rounded - value) < 1e-9 };
}

function withCommas(value: number): string {
  const [whole, fraction] = String(value).split(".");
  const grouped = Math.abs(value) >= 10_000 ? whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : whole!;
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

// "50 * ( 12 + 8 )" -> "50 × (12 + 8)". No asterisks, which Discord reads as italics.
export function prettyExpression(expression: string): string {
  return expression
    .replace(/\*/g, "×")
    .replace(/\//g, "÷")
    .replace(/sqrt /g, "√")
    .replace(/cbrt /g, "∛")
    .replace(/\( /g, "(")
    .replace(/ \)/g, ")");
}
