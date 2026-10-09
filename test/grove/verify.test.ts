import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BrainUnavailable, type BrainReply, type BrainRequest } from "../../src/grove/brain.ts";
import { checkedReply } from "../../src/grove/checked.ts";
import { buildCatalog, snakeCase } from "../../src/grove/knowledge/catalog.ts";
import { correctionFor, hasProblems, problemsIn, withoutInventedTypes } from "../../src/grove/verify.ts";

const FOG = `Changes the fog.

Type ID: \`apoli:modify_fog\`

## Fields

| Field | Type | Purpose |
| --- | --- | --- |
| \`s\` | Float | Fog start. |
| \`v\` | Float | Fog end. |
| \`r\` | Float | Red. |

## Examples

\`\`\`json
{ "type": "apoli:modify_fog", "s": 0, "v": 4, "fade_in": 0.5 }
\`\`\`
`;

const catalog = buildCatalog(
  [
    { path: "src/content/docs/datapack/02-powers/modify_fog.md", text: FOG },
    { path: "src/content/docs/datapack/02-powers/multiple.md", text: "Type ID: `apoli:multiple`\n\nSeveral powers in one." },
    { path: "src/content/docs/datapack/01-introduction/02-powers.md", text: "Every power has a `loading_priority` and a `hidden` flag, and `sneak_hint` in examples." },
    { path: "src/content/docs/datapack/02-powers/model.md", text: 'Type ID: `apoli:model`\n\n```json\n{ "type": "apoli:model", "parts": [{ "type": "apoli:pitch" }] }\n```' },
  ],
  [
    "src/main/java/dev/overgrown/apoli/power/builtin/ActionOnKeyPressPower.java",
    "src/main/java/dev/overgrown/apoli/action/builtin/bientity/ActorAction.java",
    "src/main/java/dev/overgrown/origins/condition/builtin/entity/NbtCondition.java",
    "src/main/java/dev/overgrown/apoli/power/Power.java",
  ],
);

const fenced = (json: string) => `here you go\n\`\`\`json\n${json}\n\`\`\`\nenjoy`;

describe("what exists in Apoli and Origins", () => {
  it("reads type ids from the Handbook and from class names", () => {
    assert.equal(catalog.types.has("apoli:modify_fog"), true);
    assert.equal(catalog.types.has("apoli:pitch"), true, "ids used in examples count");
    assert.equal(catalog.types.has("apoli:action_on_key_press"), true);
    assert.equal(catalog.types.has("apoli:actor"), true);
    assert.equal(catalog.types.has("origins:nbt"), true);
    assert.equal(catalog.types.has("apoli:power"), false);
    assert.equal(snakeCase("ActionOnKeyPress"), "action_on_key_press");
    assert.equal(snakeCase("NBTCheck"), "nbt_check");
    assert.deepEqual([...catalog.fields.get("apoli:modify_fog") ?? []].sort(), ["fade_in", "r", "s", "type", "v"]);
    assert.equal(catalog.common.has("loading_priority"), true);
    assert.equal(catalog.common.has("sneak_hint"), true);
  });
});

describe("checking what Grove writes", () => {
  it("accepts real types and documented fields, including the ones every power has", () => {
    const json = '{ "type": "apoli:modify_fog", "s": 8, "v": 24, "r": 0.56, "fade_in": 1, "condition": { "type": "apoli:action_on_key_press" }, "loading_priority": 2, "hidden": true }';
    assert.equal(hasProblems(problemsIn(fenced(json), catalog)), false);
  });

  it("finds a type id that doesn't exist, in nested objects too", () => {
    const problems = problemsIn(fenced('{ "type": "apoli:modify_fog", "condition": { "type": "apoli:on_entity_damage" }, "action": { "type": "origins:spawn_butterflies" } }'), catalog);
    assert.deepEqual(problems.types, ["apoli:on_entity_damage", "origins:spawn_butterflies"]);
  });

  it("finds a field a real type doesn't have", () => {
    const problems = problemsIn(fenced('{ "type": "apoli:modify_fog", "s": 1, "fog_color": "#fff", "fog_radius": 12 }'), catalog);
    assert.deepEqual(problems.fields, [{ type: "apoli:modify_fog", names: ["fog_color", "fog_radius"] }]);
    assert.deepEqual(problems.types, []);
  });

  it("leaves alone what isn't ours to judge", () => {
    const json = '{ "type": "apoli:multiple", "anything": { "type": "apoli:modify_fog", "s": 1 }, "other": { "type": "mymod:custom", "x": 1 }, "part": { "type": "pitch" } }';
    assert.equal(hasProblems(problemsIn(fenced(json), catalog)), false);
    assert.equal(hasProblems(problemsIn('no code, just "type": "apoli:nothing"', catalog)), false);
  });

  it("still checks type ids in json that doesn't parse", () => {
    const problems = problemsIn(fenced('{ "type": "apoli:invented", "s": 1, // a comment\n }'), catalog);
    assert.deepEqual(problems.types, ["apoli:invented"]);
  });

  it("checks nothing without a library", () => {
    assert.equal(hasProblems(problemsIn(fenced('{ "type": "apoli:invented" }'), buildCatalog([], []))), false);
  });

  it("tells the model what is wrong and what the real fields are", () => {
    const problems = problemsIn(fenced('{ "type": "apoli:modify_fog", "fog_color": 1, "x": { "type": "apoli:nope" } }'), catalog);
    const text = correctionFor(problems, catalog);
    assert.match(text, /don't exist in Apoli or Origins: apoli:nope/);
    assert.match(text, /apoli:modify_fog has no fields called fog_color, x\. The Handbook page mentions: s, v, r, fade_in\./);
    assert.match(correctionFor({ types: [], fields: [{ type: "apoli:modify_fog", names: ["fog_color"] }] }, catalog), /has no field called fog_color\./);
  });

  it("drops only the code blocks that use invented types", () => {
    const text = `a\n\`\`\`json\n{ "type": "apoli:nope" }\n\`\`\`\nb\n\`\`\`json\n{ "type": "apoli:modify_fog", "s": 1 }\n\`\`\`\nc`;
    const cleaned = withoutInventedTypes(text, catalog);
    assert.equal(cleaned.removed, 1);
    assert.doesNotMatch(cleaned.text, /apoli:nope/);
    assert.match(cleaned.text, /apoli:modify_fog/);
    assert.match(cleaned.text, /^a\n+b/);
  });
});

function fakeBrain(replies: Array<string | Error>) {
  const requests: BrainRequest[] = [];
  const brain = {
    async reply(request: BrainRequest): Promise<BrainReply> {
      requests.push(request);
      const next = replies.shift();
      if (next === undefined) throw new Error("no more replies");
      if (next instanceof Error) throw next;
      return { text: next, brain: "local", model: "m", toolCalls: [`t${requests.length}`], promptTokens: 100, replyTokens: 10, ms: 1_000 };
    },
  };
  return { brain, requests };
}

const request: BrainRequest = { system: "S", messages: [{ role: "user", content: "sam: make butterflies" }], maxToolRounds: 3 };
const BAD = fenced('{ "type": "apoli:spawn_butterflies" }');
const GOOD = fenced('{ "type": "apoli:modify_fog", "s": 1 }');

describe("answering with a check", () => {
  it("answers once when nothing is wrong", async () => {
    const { brain, requests } = fakeBrain([GOOD]);
    const reply = await checkedReply(brain, request, catalog);
    assert.equal(requests.length, 1);
    assert.equal(reply.corrected, false);
    assert.equal(reply.text, GOOD);
  });

  it("answers once when there is no library to check against", async () => {
    const { brain, requests } = fakeBrain([BAD]);
    assert.equal((await checkedReply(brain, request, null)).text, BAD);
    assert.equal(requests.length, 1);
  });

  it("gives the model one chance to fix an invented type, and keeps the fix", async () => {
    const { brain, requests } = fakeBrain([BAD, GOOD]);
    const reply = await checkedReply(brain, request, catalog);
    assert.equal(requests.length, 2);
    const second = requests[1]!;
    assert.deepEqual(second.messages.slice(-2).map(message => message.role), ["assistant", "user"]);
    assert.equal(second.messages[second.messages.length - 2]?.content, BAD);
    assert.match(second.messages[second.messages.length - 1]?.content ?? "", /apoli:spawn_butterflies/);
    assert.equal(second.maxToolRounds, 2);
    assert.equal(reply.text, GOOD);
    assert.equal(reply.corrected, true);
    assert.deepEqual(reply.toolCalls, ["t1", "t2"]);
    assert.equal(reply.promptTokens, 200);
    assert.equal(reply.ms, 2_000);
  });

  it("leaves the json out when the second try is just as invented", async () => {
    const { brain } = fakeBrain([BAD, `${BAD}\nthis should work`]);
    const reply = await checkedReply(brain, request, catalog);
    assert.doesNotMatch(reply.text, /spawn_butterflies/);
    assert.match(reply.text, /this should work/);
    assert.match(reply.text, /i left the json out/);
  });

  it("falls back to the first answer, cleaned, when the brain goes away mid-check", async () => {
    const { brain } = fakeBrain([BAD, new BrainUnavailable("gone")]);
    const reply = await checkedReply(brain, request, catalog);
    assert.doesNotMatch(reply.text, /spawn_butterflies/);
    assert.match(reply.text, /i left the json out/);
    assert.equal(reply.corrected, true);
  });

  it("lets other failures through", async () => {
    const { brain } = fakeBrain([BAD, new Error("boom")]);
    await assert.rejects(checkedReply(brain, request, catalog), /boom/);
  });
});
