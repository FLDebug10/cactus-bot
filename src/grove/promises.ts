// A small model often answers a question with a promise instead of the answer
// ("got it! let's look at `apoli:action_on_hit`, i'll pull up the handbook
// page"), and no lookup ever follows, because it wrote the words instead of
// calling the tool. Grove does the lookup it promised for it and then asks for
// the answer, so a promise becomes an answer instead of the end of the reply.

export interface PromisedLookup {
  name: string;
  arguments: Record<string, unknown>;
}

const PROMISE = /\b(?:let me(?! know)|lemme|i'?ll|i will|i'?m (?:gonna|going to)|gonna|going to|one sec(?:ond)?|hold on|give me a (?:sec|second|moment|minute)|let'?s)\b[^.!?\n]{0,60}?\b(?:search\w*|check\w*|look\w*|pull\w*|find|grab\w*|read\w*|dig\w*|fetch\w*|open\w*|peek\w*|see what)\b/i;
// Long replies with real content that end with "i'll check more if you want" are answers, not promises.
const MAX_PROMISE = 600;
const ID = /`((?:apoli|origins):[a-z0-9_]+)`|`([a-z][a-z0-9]*(?:_[a-z0-9]+)+)`|\b((?:apoli|origins):[a-z0-9_]+)\b/;
const QUOTED = /\b(?:for|about|on|at)\s+["“'`]([^"”'`\n]{3,48})["”'`]/;

export function isPromise(reply: string): boolean {
  return reply.length <= MAX_PROMISE && !reply.includes("```") && PROMISE.test(reply);
}

// The lookup a reply promised: the page it named, the code it wanted to read, or
// a search for what it said it would search (else for the question itself).
export function promisedLookup(reply: string, question: string): PromisedLookup | null {
  if (!isPromise(reply)) return null;
  const named = ID.exec(reply);
  const id = named === null ? undefined : named[1] ?? named[2] ?? named[3];
  if (/\b(?:source|code|java|class)\b/i.test(reply)) return { name: "search_source", arguments: { query: id ?? question } };
  if (id !== undefined) return { name: "read_handbook_page", arguments: { page: id } };
  return { name: "search_handbook", arguments: { query: QUOTED.exec(reply)?.[1] ?? question } };
}
