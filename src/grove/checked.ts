// A reply that has been checked against the mods: if the JSON in it uses a type
// id or field that doesn't exist, Grove is told what's wrong and tries once
// more (with its lookups), and what it still can't back up is left out.

import type { BrainChain, BrainReply, BrainRequest } from "./brain.ts";
import { BrainUnavailable } from "./brain.ts";
import type { Catalog } from "./knowledge/catalog.ts";
import { correctionFor, hasProblems, problemsIn, withoutInventedTypes } from "./verify.ts";

const LEFT_OUT = "i couldn't find the right power types for that, so i left the json out. the handbook or the support channel can help!";

export interface Checked extends BrainReply {
  // The first answer had invented types or fields.
  corrected: boolean;
}

export async function checkedReply(brain: Pick<BrainChain, "reply">, request: BrainRequest, catalog: Catalog | null): Promise<Checked> {
  const first = await brain.reply(request);
  if (catalog === null) return { ...first, corrected: false };
  const problems = problemsIn(first.text, catalog);
  if (!hasProblems(problems)) return { ...first, corrected: false };

  let second: BrainReply;
  try {
    second = await brain.reply({
      ...request,
      messages: [...request.messages, { role: "assistant", content: first.text }, { role: "user", content: correctionFor(problems, catalog) }],
      maxToolRounds: 2,
    });
  } catch (error) {
    if (!(error instanceof BrainUnavailable)) throw error;
    second = first;
  }
  const retried = second !== first;
  const merged: Checked = {
    ...second,
    toolCalls: retried ? [...first.toolCalls, ...second.toolCalls] : first.toolCalls,
    promptTokens: first.promptTokens + (retried ? second.promptTokens : 0),
    replyTokens: first.replyTokens + (retried ? second.replyTokens : 0),
    ms: first.ms + (retried ? second.ms : 0),
    corrected: true,
  };

  const cleaned = withoutInventedTypes(merged.text, catalog);
  return cleaned.removed === 0 ? merged : { ...merged, text: `${cleaned.text}\n${LEFT_OUT}`.trim() };
}
