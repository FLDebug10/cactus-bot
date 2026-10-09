import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addressingOf, namesGrove } from "../../src/grove/addressing.ts";
import { History } from "../../src/grove/history.ts";
import { buildPrompt } from "../../src/grove/prompt.ts";
import type { ChatLine } from "../../src/grove/types.ts";

const base = { mentionsGrove: false, repliesToGrove: false, repliesToSomeoneElse: false, mentionsSomeoneElse: false, talkingWithGrove: false };

function line(id: string, author: string, content: string, at: number, extra: Partial<ChatLine> = {}): ChatLine {
  return { id, channelId: "c", authorId: author, authorName: author, isGrove: author === "grove", isBot: author === "grove", content, at, replyToId: null, ...extra };
}

describe("addressing", () => {
  it("knows when Grove is talked to", () => {
    assert.equal(addressingOf({ ...base, content: "hi", mentionsGrove: true }), "direct");
    assert.equal(addressingOf({ ...base, content: "lol", repliesToGrove: true }), "direct");
    assert.equal(addressingOf({ ...base, content: "hey grove how are you" }), "named");
    assert.equal(addressingOf({ ...base, content: "Grove, what's apoli?" }), "named");
    assert.equal(addressingOf({ ...base, content: "thanks!", talkingWithGrove: true }), "followup");
    assert.equal(addressingOf({ ...base, content: "thanks!", talkingWithGrove: true, repliesToSomeoneElse: true }), null);
    assert.equal(addressingOf({ ...base, content: "anyone know how powers work?" }), null);
  });

  it("doesn't mistake the biome for Grove", () => {
    assert.equal(namesGrove("i found a cherry grove"), false);
    assert.equal(namesGrove("the grove biome has powder snow"), false);
    assert.equal(namesGrove("my mangrove swamp"), false);
    assert.equal(namesGrove("grove is so cute"), true);
    assert.equal(namesGrove("ask `grove` in code"), false);
  });
});

describe("history", () => {
  it("keeps lines in time order and knows who Grove is talking with", () => {
    const history = new History();
    history.add(line("2", "sam", "second", 2_000));
    history.add(line("1", "sam", "first", 1_000));
    history.add(line("3", "ana", "third", 3_000));
    assert.deepEqual(history.before("c", "3", 10, 60_000).map(seen => seen.id), ["1", "2"]);
    assert.deepEqual(history.after("c", "1").map(seen => seen.id), ["2", "3"]);
    history.noteAnswered("c", "sam", 10_000);
    assert.equal(history.talkingWith("c", "sam", 10_000 + 60_000), true);
    assert.equal(history.talkingWith("c", "sam", 10_000 + 10 * 60_000), false);
    assert.equal(history.talkingWith("c", "ana", 10_000), false);
    history.add(line("5", "ana", "hey sam", 20_000));
    assert.equal(history.talkingWith("c", "sam", 30_000), false);
  });
});

describe("prompt", () => {
  it("turns the conversation into chat turns ending with the message to answer", () => {
    const transcript = [
      line("1", "sam", "hey grove", 1_000),
      line("2", "grove", "hi sam!", 2_000),
      line("3", "ana", "lol", 3_000, { replyToId: "2" }),
    ];
    const prompt = buildPrompt({
      persona: "PERSONA",
      moment: "MOMENT",
      notes: [],
      transcript,
      target: line("4", "sam", "what's a power?", 4_000),
      replyTo: null,
      attachments: [{ name: "power.json", text: "{\"type\": \"apoli:attribute\"}" }],
    });
    assert.match(prompt.system, /^PERSONA\n\nMOMENT$/);
    assert.deepEqual(prompt.messages.map(message => message.role), ["user", "assistant", "user", "user"]);
    assert.equal(prompt.messages[0]?.content, "sam: hey grove");
    assert.equal(prompt.messages[2]?.content, "ana (replying to you): lol");
    assert.match(prompt.messages[3]?.content ?? "", /^sam: what's a power\?\n\n\[attached file power\.json\]\n```json\n/);
  });

  it("drops the oldest lines first when the conversation is long", () => {
    const transcript = Array.from({ length: 30 }, (_, index) => line(String(index), "sam", `message number ${index} ${"x".repeat(300)}`, index * 1_000));
    const prompt = buildPrompt({ persona: "P", moment: "M", notes: [], transcript, target: line("99", "sam", "hi", 99_000), replyTo: null, attachments: [], budget: { transcript: 1_500 } });
    const said = prompt.messages.map(message => message.content).join("\n");
    assert.doesNotMatch(said, /message number 0 /);
    assert.match(said, /message number 29 /);
  });

  it("puts handbook notes in the system prompt", () => {
    const prompt = buildPrompt({
      persona: "P",
      moment: "M",
      notes: [{ source: "handbook", kind: "docs", path: "p", title: "Resource (Power Type)", url: "https://0vergrown.github.io/Handbook/docs/datapack/powers/resource/", body: "Type ID: `apoli:resource`", snippet: "", startLine: 1, endLine: 1 }],
      transcript: [],
      target: line("1", "sam", "how do resources work", 1),
      replyTo: null,
      attachments: [],
    });
    assert.match(prompt.system, /REFERENCE NOTES/);
    assert.match(prompt.system, /\[Resource \(Power Type\)\]\(https:\/\/0vergrown\.github\.io\/Handbook\/docs\/datapack\/powers\/resource\/\)/);
  });
});
