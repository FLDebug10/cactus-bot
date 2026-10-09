// A reply that has been checked against the mods: if the JSON in it uses a type
// or field that doesn't exist, or puts one where it can't go, Grove writes the
// reply again knowing exactly what was wrong. The person never saw the first
// draft, so the second one must not apologize for it: the draft and what's wrong
// with it go in a note to Grove on their message, not into the conversation.
// What still can't be backed up after that is left out, and the Handbook's own
// example for the type takes its place.

import type { Message } from "ollama";
import type { BrainChain, BrainReply, BrainRequest } from "./brain.ts";
import { BrainUnavailable } from "./brain.ts";
import { lookup, type Schema } from "./knowledge/schema.ts";
import { blocksIn, correctionFor, type Problem, problemsIn, withoutBadBlocks, withoutInventedProse } from "./verify.ts";

const LEFT_OUT = "i couldn't get the json right for that, so i left it out. the handbook or the support channel can help!";
// When little is left once the made-up parts are out.
const NOT_SURE = "hmm, i'm not sure about that one and i don't want to guess.";

export interface Checked extends BrainReply {
  // The first answer had json that didn't hold up.
  corrected: boolean;
  // What was wrong with it, for the log.
  problems: string[];
}

export interface CheckOptions {
  // The type the answer is about (the notes' first page), whose Handbook example
  // stands in when Grove can't get its own json right.
  mainType?: string | null;
  // The checked hints for what was asked ("only at night: daytime, inverted"), said
  // when Grove's own json had to go, so the one thing that matters still gets across.
  hints?: readonly string[];
}

// The last message with a note to Grove added to it: the draft and what to fix.
function rewriteRequest(request: BrainRequest, draft: string, problems: readonly Problem[]): BrainRequest {
  const messages: Message[] = [...request.messages];
  const last = messages[messages.length - 1];
  const note = `\n\n[note to grove, they can't see this: you drafted this reply\n"""\n${draft.trim()}\n"""\n${correctionFor(problems)}\nWrite your reply to them again from the start with the json fixed. Send only the new reply, as if it's your first answer: no apology, and don't mention a draft, a mistake or a check.]`;
  if (last !== undefined && last.role === "user") messages[messages.length - 1] = { ...last, content: `${last.content}${note}` };
  else messages.push({ role: "user", content: note.trim() });
  return { ...request, messages, maxToolRounds: Math.min(request.maxToolRounds ?? 3, 1), followThrough: undefined };
}

// A rewritten reply that talks about the rewrite anyway ("here's the fix", "i swapped
// the operation"): the person never saw a first try, so those sentences go.
const LEAK = /\b(?:oops|sorry|apolog\w*|my (?:bad|mistake)|draft|(?:i|i've|i have) (?:fixed|swapped|corrected|changed|updated|replaced)|here'?s the (?:fix|fixed|corrected|updated))\b/i;

export function withoutLeaks(text: string): string {
  return text
    .split(/(```[\s\S]*?```)/)
    .map(part => (part.startsWith("```") ? part : part.split("\n").map(line => line.split(/(?<=[.!?])\s+/).filter(sentence => !LEAK.test(sentence)).join(" ")).join("\n")))
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// The type a json block is about: its top "type".
function rootType(text: string): string | null {
  for (const block of blocksIn(text)) {
    const id = /^\s*\{\s*"type"\s*:\s*"([^"]+)"/.exec(block)?.[1];
    if (id !== undefined) return id.toLowerCase();
  }
  return null;
}

// The Handbook's own example for a type, ready to send, or null when it has none.
export function handbookExample(schema: Schema, ids: ReadonlyArray<string | null | undefined>): string | null {
  for (const id of ids) {
    if (id === null || id === undefined) continue;
    const info = lookup(schema, id).find(entry => entry.documented && entry.examples.length > 0);
    const example = info?.examples[0];
    if (info === undefined || example === undefined) continue;
    return `here's the handbook's own example for \`${info.id}\` to start from:\n\`\`\`json\n${example.json}\n\`\`\`\n${example.caption !== undefined ? `${example.caption}\n` : ""}${info.url}`;
  }
  return null;
}

export async function checkedReply(brain: Pick<BrainChain, "reply">, request: BrainRequest, schema: Schema | null, options: CheckOptions = {}): Promise<Checked> {
  const first = await brain.reply(request);
  if (schema === null) return { ...first, corrected: false, problems: [] };
  const problems = problemsIn(first.text, schema);
  if (problems.length === 0) return { ...first, corrected: false, problems: [] };

  let second: BrainReply;
  try {
    second = await brain.reply(rewriteRequest(request, first.text, problems));
  } catch (error) {
    if (!(error instanceof BrainUnavailable)) throw error;
    second = first;
  }
  const retried = second !== first;
  const unleaked = retried ? withoutLeaks(second.text) : "";
  const merged: Checked = {
    ...second,
    text: unleaked.length > 0 ? unleaked : second.text,
    toolCalls: retried ? [...first.toolCalls, ...second.toolCalls] : first.toolCalls,
    promptTokens: first.promptTokens + (retried ? second.promptTokens : 0),
    replyTokens: first.replyTokens + (retried ? second.replyTokens : 0),
    ms: first.ms + (retried ? second.ms : 0),
    corrected: true,
    problems: problems.map(problem => `${problem.at.length > 0 ? `${problem.at}: ` : ""}${problem.text}`),
  };
  if (problemsIn(merged.text, schema).length === 0) return merged;

  // Still wrong: keep what holds up, and put the real example where the made-up json was.
  const blocks = withoutBadBlocks(merged.text, schema);
  const words = withoutInventedProse(blocks.text, schema);
  if (blocks.removed === 0 && words.removed === 0) return merged;
  const example = blocks.removed > 0 ? handbookExample(schema, [options.mainType, rootType(merged.text), rootType(first.text)]) : null;
  const left = words.text.replace(/```[\s\S]*?```/g, " ").replace(/\s+/g, " ").trim();
  const page = options.mainType == null ? undefined : lookup(schema, options.mainType).find(info => info.documented)?.url;
  // Nothing left but filler ("i hope that helps!"): no code, no id, no link.
  const thin = !words.text.includes("```") && (left.length < 40 || !/`|https?:\/\/|\b(?:apoli|origins):/.test(left));
  const body = thin ? `${NOT_SURE}${page !== undefined && example === null ? ` the closest handbook page is ${page}` : ""}` : words.text;
  const how = blocks.removed > 0 && options.hints !== undefined && options.hints.length > 0 ? `here's how it's done:\n${options.hints.map(hint => `- ${hint}`).join("\n")}` : "";
  const tail = example ?? (blocks.removed > 0 ? LEFT_OUT : "");
  return { ...merged, text: [body, how, tail].filter(part => part.length > 0).join("\n\n") };
}
