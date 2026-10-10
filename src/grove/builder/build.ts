// Making a power someone asked for. The plan comes from planner.ts, the JSON from
// the building blocks, and the library has the last word: a power with anything
// it doesn't know isn't sent. The reply is put together here too. The model only
// writes the line that hands the power over: describing a file it didn't write, it
// still got the numbers wrong ("the cooldown is 500 ticks" for a cooldown of 100).

import type { BrainChain, BrainReply, BrainRequest } from "../brain.ts";
import { lookupIn, type Schema } from "../knowledge/schema.ts";
import type { Note } from "../notes.ts";
import type { ChatLine } from "../types.ts";
import { blocksIn, problemsInBlock } from "../verify.ts";
import { type Built, compose, type Plan } from "./blocks.ts";
import { planPower } from "./planner.ts";
import { asksForPower, followUpKind } from "./reading.ts";

export interface PowerBuild extends Built {
  // The words it was built from, follow-ups included.
  request: string;
  plan: Plan;
  // The Handbook page of each type in it, the power type first.
  pages: Array<{ id: string; url: string }>;
}

// How far back a "yeah" or "make it 20 seconds" can reach for the request it answers.
const FOLLOW_UP_LINES = 8;

// The request to build from: the message itself, or for a follow-up, the same
// person's earlier request with their changes after it. null when there's nothing to build.
export function powerRequest(target: ChatLine, transcript: readonly ChatLine[]): string | null {
  if (asksForPower(target.content)) return target.content;
  const kind = followUpKind(target.content);
  if (kind === null) return null;
  const changes: string[] = kind === "change" ? [target.content] : [];
  let answered = false;
  for (let index = transcript.length - 1, seen = 0; index >= 0 && seen < FOLLOW_UP_LINES; index--, seen++) {
    const line = transcript[index]!;
    if (line.isGrove) {
      if (blocksIn(line.content).length > 0) answered = true;
      continue;
    }
    if (line.authorId !== target.authorId) continue;
    if (asksForPower(line.content)) {
      // "yeah" after Grove already sent the power is just a yeah.
      if (kind === "confirm" && answered) return null;
      return [line.content, ...changes].join("\n");
    }
    if (followUpKind(line.content) === "change") changes.unshift(line.content);
  }
  return null;
}

export async function buildPower(brain: Pick<BrainChain, "reply">, target: ChatLine, transcript: readonly ChatLine[], schema: Schema): Promise<PowerBuild | null> {
  const request = powerRequest(target, transcript);
  if (request === null) return null;
  const plan = await planPower(brain, request);
  if (plan === null) return null;
  const built = compose(plan);
  if (built === null || problemsInBlock(built.json, schema).length > 0) return null;
  const pages: PowerBuild["pages"] = [];
  for (const used of [...built.used].sort((a, b) => Number(b.kind === "power") - Number(a.kind === "power"))) {
    const url = lookupIn(schema, used.id, used.kind)?.url;
    if (url !== undefined && !pages.some(page => page.url === url)) pages.push({ id: used.id, url });
  }
  return { ...built, request, plan, pages };
}

// The built power as the first of Grove's notes, so the line Grove writes fits it.
export function powerNote(build: PowerBuild): Note {
  const lines = ["```json", build.json, "```", `what it does: ${build.does}`];
  return { title: "THE POWER FOR THEIR MESSAGE (already built and checked, it goes out under your message)", url: "", body: lines.join("\n") };
}

// A sentence that says how the power works, or gives a number: those come from the build.
const DESCRIBES = /\b(?:when|whenever|every|each time|while|if|until|anyone|anything|everyone|everything|whoever|whatever|target|attacker|ticks?|seconds?|hearts?|level|amplifier|cooldown|interval|duration|json|file|handbook|datapack|reload|grant|note|it'?ll|it will|this (?:power|one|will|makes|lets|gives)|you'?ll|makes? you|lets? you|gives? you)\b|\d|`|\[|\b(?:apoli|origins):|https?:\/\//i;
// A line that talks about a mistake nobody saw ("whoops, i forgot the cooldown").
const SORRY = /\b(?:w?hoops|oops|sorry|apolog\w*|forgot|my (?:bad|mistake)|mistake|again)\b/i;
const INTRO_MAX = 140;
// Livelier than answers about the mods: the line has no facts in it to get wrong.
const INTRO_TEMPERATURE = 0.8;
const PLAIN_INTRO = "here you go!";

// Grove's own line handing the power over: its first sentences, up to the first one
// that starts explaining.
export function introFrom(text: string): string {
  const prose = text.replace(/```[\s\S]*?```/g, "\n").trim();
  const kept: string[] = [];
  for (const sentence of prose.split(/(?<=[.!?])\s+|\n+/).map(part => part.trim()).filter(part => part.length > 0)) {
    if (SORRY.test(sentence)) continue;
    if (DESCRIBES.test(sentence) || sentence.length > INTRO_MAX) break;
    // The message started with "grove", so the model sometimes calls them that.
    const line = sentence.replace(/,?\s*\bgrove\b\s*(?=[!.?,]|$)/gi, "").replace(/[:,]\s*$/, "!");
    if (line.replace(/[^a-z]/gi, "").length > 0) kept.push(line);
    if (kept.length === 2) break;
  }
  return kept.length > 0 ? kept.join(" ") : PLAIN_INTRO;
}

// The whole reply: Grove's line, the file, what it does and the units, and its Handbook page.
export function powerReply(intro: string, build: PowerBuild): string {
  const lines = [introFrom(intro), "", "```json", build.json, "```", build.does];
  if (build.tips.length > 0) lines.push(`good to know: ${build.tips.join(". ")}.`);
  if (build.pages[0] !== undefined) lines.push(build.pages[0].url);
  return lines.join("\n");
}

// Asks the brain for the line that hands the power over, and puts the reply together.
export async function replyWithPower(brain: Pick<BrainChain, "reply">, request: BrainRequest, build: PowerBuild): Promise<BrainReply> {
  const reply = await brain.reply({ ...request, tools: undefined, followThrough: undefined, maxTokens: 80, temperature: INTRO_TEMPERATURE });
  return { ...reply, text: powerReply(reply.text, build) };
}
