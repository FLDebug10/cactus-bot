import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BrainUnavailable, type BrainReply, type BrainRequest } from "../../src/grove/brain.ts";
import { checkedReply, handbookExample, withoutLeaks } from "../../src/grove/checked.ts";
import { buildSchema } from "../../src/grove/knowledge/schema.ts";
import { blocksIn, commandProblems, correctionFor, looseJson, problemsIn, withoutBadBlocks } from "../../src/grove/verify.ts";
import { fixtureSchema } from "./schemaFixture.ts";

const schema = fixtureSchema();
const fenced = (json: string, language = "json") => `here you go\n\`\`\`${language}\n${json}\n\`\`\`\nenjoy`;
const problems = (json: string) => problemsIn(fenced(json), schema);
const texts = (json: string) => problems(json).map(problem => `${problem.at}: ${problem.text}`);

describe("reading json the way models write it", () => {
  it("accepts comments, trailing commas and fragments cut from a bigger file", () => {
    assert.deepEqual(looseJson('{ "a": 1, // one\n "b": [1, 2,], }'), { value: { a: 1, b: [1, 2] } });
    assert.deepEqual(looseJson('"entity_action": { "type": "apoli:heal", "amount": 2 }'), { value: { entity_action: { type: "apoli:heal", amount: 2 } } });
    assert.deepEqual(looseJson('{ "url": "https://x.y/z", "note": "a // b" }'), { value: { url: "https://x.y/z", note: "a // b" } });
    assert.deepEqual(looseJson('{ "a": 1, // the last one\n /* and done */ }'), { value: { a: 1 } });
    assert.deepEqual(looseJson('{ "quote": "say \\"hi\\", // not a comment" }'), { value: { quote: 'say "hi", // not a comment' } });
    assert.ok("error" in looseJson('{ "type": "apoli:and", "actions": [ ... ] }'));
  });

  it("only looks at json blocks", () => {
    assert.deepEqual(blocksIn(`${fenced('{ "type": "apoli:heal" }')}\n${fenced("ShaderPower.codec();", "java")}`), ['{ "type": "apoli:heal" }\n']);
  });
});

describe("checking what Grove writes", () => {
  it("accepts the Handbook's own examples, legacy ids and the origins namespace", () => {
    assert.deepEqual(texts('{ "type": "apoli:action_on_hit", "bientity_action": { "type": "apoli:add_velocity", "z": 2 }, "cooldown": 20, "condition": { "type": "apoli:sneaking", "inverted": true } }'), []);
    assert.deepEqual(texts('{ "type": "origins:target_action_on_hit", "target_action": { "type": "origins:heal", "amount": 2 } }'), []);
    assert.deepEqual(texts('"self_action": { "type": "apoli:heal", "amount": 2, }'), []);
    assert.deepEqual(texts('{ "type": "apoli:modify_damage", "self_action": { "type": "apoli:heal", "amount": 1 } }'), [], "a field only the code has");
  });

  it("catches an action without a type, as text or as an object", () => {
    const found = texts('{ "type": "apoli:action_on_hit", "bientity_action": { "target_action": "push_entity", "strength": 2 } }');
    assert.equal(found.length, 2);
    assert.match(found[0]!, /^bientity_action: the object in "bientity_action" has no "type"\. It has to be a bi-entity action/);
    assert.match(found[1]!, /^bientity_action\.target_action: "bientity_action\.target_action" must be an object with its own "type" \(an entity action\), not the text "push_entity"/);
  });

  it("catches a real type in the wrong kind of field, and says where it goes on that power", () => {
    const [found] = texts('{ "type": "apoli:action_on_hit", "bientity_action": { "type": "apoli:heal", "amount": 2 } }');
    assert.equal(found, 'bientity_action: "bientity_action" takes a bi-entity action, but apoli:heal is an entity action. Keep apoli:heal and move it to "target_action" (Action run on the target (the entity that was hit)) or "self_action" (Action run on the actor (the entity that has the power)) on apoli:action_on_hit.');
    assert.equal(problems('{ "type": "apoli:action_on_hit", "bientity_action": { "type": "apoli:heal" } }')[0]?.invented, undefined);
  });

  it("judges a meta type by where it sits", () => {
    const inBientity = texts('{ "type": "apoli:action_on_hit", "bientity_action": { "type": "apoli:if_else", "condition": { "type": "apoli:sneaking" }, "if_action": { "type": "apoli:add_velocity", "z": 1 } } }');
    assert.equal(inBientity.length, 1);
    assert.match(inBientity[0]!, /^bientity_action\.condition: .* takes a bi-entity condition, but apoli:sneaking is an entity condition\./);
    assert.deepEqual(texts('{ "type": "apoli:action_on_hit", "self_action": { "type": "apoli:if_else", "condition": { "type": "apoli:sneaking" }, "if_action": { "type": "apoli:heal", "amount": 1 } } }'), []);
    assert.deepEqual(texts('{ "type": "apoli:action_on_hit", "bientity_action": { "type": "apoli:and", "actions": [{ "type": "apoli:add_velocity", "z": 1 }, { "type": "apoli:heal" }] } }').length, 1);
  });

  it("catches made-up types and fields, with real ones to use instead", () => {
    const made = problems('{ "type": "apoli:action_on_hit", "bientity_action": { "type": "apoli:push_entity" } }');
    assert.equal(made[0]?.invented, true);
    assert.match(made[0]?.text ?? "", /^apoli:push_entity doesn't exist\. Real bi-entity actions that might fit: apoli:add_velocity/);
    assert.deepEqual(texts('{ "type": "apoli:action_on_hit", "self_action": { "type": "apoli:heal", "hearts": 2 } }'), ['self_action: apoli:heal has no field "hearts". Its fields are: amount.']);
    assert.match(texts('{ "type": "apoli:fly_away" }')[0] ?? "", /apoli:fly_away doesn't exist in Apoli or Origins/);
    assert.deepEqual(texts('{ "type": "apoli:action_on_hit", "target_action": { "type": "heal", "amount": 2 } }'), ['target_action: write the type as "apoli:heal", with the namespace.']);
  });

  it("checks the fields of data types, and what they hold", () => {
    assert.deepEqual(texts('{ "type": "apoli:action_on_hit", "hud_render": { "should_render": true, "bar_index": 2 } }'), []);
    assert.deepEqual(texts('{ "type": "apoli:action_on_hit", "hud_render": { "should_render": true, "render_type": "bar", "color": "green" } }'), ['hud_render: "render_type", "color" aren\'t fields of Hud Render. Its fields are: should_render, bar_index, condition.']);
    assert.match(texts('{ "type": "apoli:action_on_hit", "hud_render": { "condition": { "type": "apoli:heal" } } }')[0] ?? "", /^hud_render\.condition: .*takes an entity condition, but apoli:heal is an entity action/);
    assert.deepEqual(texts('{ "type": "apoli:action_on_hit", "hud_render": false }'), [], "short forms are left alone");
  });

  it("knows an origin's powers are power ids, not types", () => {
    assert.deepEqual(texts('{ "icon": "minecraft:emerald", "powers": ["origins:phantomize", "mypack:glide"] }'), []);
    const found = problems('{ "icon": "minecraft:emerald", "powers": ["apoli:heal", "origins:fly_fast"] }');
    assert.equal(found[0]?.text, '"apoli:heal" is an entity action type, not a power. "powers" lists power ids: the pack\'s own power files ("<namespace>:<file name>").');
    assert.equal(found[0]?.at, "powers[0]");
    assert.equal(found[1]?.invented, true);
    assert.match(found[1]?.text ?? "", /^"origins:fly_fast" isn't a power that exists\. .* or ones Origins ships, like "origins:phantomize"\.$/);
    assert.deepEqual(texts('{ "origins": ["origins:phantom", "mypack:merling"] }'), []);
  });

  it("catches a ticks and seconds sum that doesn't add up", () => {
    assert.deepEqual(problemsIn("a cooldown of 300 ticks (5 seconds) is fine", schema).map(problem => problem.text), ["300 ticks is 15 seconds, not 5: 20 ticks are 1 second, so 5 seconds is 100 ticks. Fix the number in the json too."]);
    assert.deepEqual(problemsIn("it runs every 100 ticks (5 seconds), so 20 ticks is 1 second and 2.5 seconds is 50 ticks", schema), []);
    assert.equal(problemsIn("ticks down every 2 ticks (1 second)", schema).length, 1);
  });

  it("checks values that come from a fixed list, old capitals included", () => {
    const health = (comparison: string) => `{ "type": "apoli:action_on_hit", "condition": { "type": "apoli:relative_health", "comparison": "${comparison}", "compare_to": 0.3 } }`;
    assert.deepEqual(texts(health("<=")), []);
    assert.deepEqual(texts(health("less_than")), ['condition.comparison: "less_than" can\'t go in "comparison". It takes one of: <, <=, >, >=, ==, !=.']);
  });

  it("checks the mods' commands against their pages and their code", () => {
    const said = (text: string) => commandProblems(text, schema).map(problem => problem.text);
    assert.deepEqual(said("```mcfunction\norigin grant @s origins:merling\n```"), ['/origin grant @s origins:merling: /origin has no "grant". Its sub-commands are: set, revoke, gui.']);
    assert.deepEqual(said("```\n/origin set @s origins:merling\n```"), ['/origin set @s origins:merling: that isn\'t how "set" is written. It\'s /origin set <targets> <layer> <origin>.']);
    assert.deepEqual(said("```\n/origin set @s origins:origin origins:merling\n/origin gui\n/origin revoke @a origins:origin\n```"), []);
    assert.deepEqual(said("use `/origin set` for that, or `/origin set <targets> <layer> <origin>`"), [], "a mention names a sub-command, a pattern isn't a command");
    assert.deepEqual(said("```\n/disguise @s creeper\n/disguise query @s\n```"), [], "the code takes a target right after the name, and knows query");
    assert.deepEqual(said("```\n/apoli:clone summon @s ~ ~1 ~ {count:2}\n```"), [], "a position is three words");
    assert.deepEqual(said("```java\nOrigin origin = OriginRegistry.get(id);\n```\n```\neffect give @s minecraft:speed\n```"), []);
    assert.match(problemsIn("```\n/origin pick @s\n```", schema)[0]?.text ?? "", /has no "pick"/);
    assert.deepEqual(said("```json\n{ \"type\": \"apoli:execute_command\", \"command\": \"origin grant @s origins:merling\" }\n```"), ['/origin grant @s origins:merling: /origin has no "grant". Its sub-commands are: set, revoke, gui.'], "commands inside json too");
    assert.deepEqual(said("try `/origin set <targets> <your layer>:<your origin>`"), [], "a placeholder with spaces is still a pattern");
  });

  it("knows a placeholder from a made-up type", () => {
    assert.match(texts('{ "type": "apoli:your_power_type", "condition": { "type": "apoli:sneaking" } }')[0] ?? "", /apoli:your_power_type is a placeholder, not a real type\. Put a real type from your notes there/);
    assert.match(problemsIn("grant `apoli:example_power` to yourself", schema)[0]?.text ?? "", /a made-up id\. Something in their own pack is "<namespace>:<name>"/);
  });

  it("cuts a wrong block with the sentence that led into it, and keeps the rest of the line", () => {
    const text = 'it\'s `apoli:sneaking` with "inverted": true. here\'s how that looks:\n\n```json\n{ "type": "apoli:nope" }\n```\nthat\'s all';
    assert.equal(withoutBadBlocks(text, schema).text, 'it\'s `apoli:sneaking` with "inverted": true. \nthat\'s all');
  });

  it("catches a power with its type under another name", () => {
    assert.match(texts('{ "type_id": "apoli:action_on_hit", "on_hit": { "action": "set_on_fire" } }')[0] ?? "", /"type_id" isn't a field\. A power file starts with "type"/);
  });

  it("checks the sub-powers of apoli:multiple and leaves macros, other mods, badges and data types alone", () => {
    assert.match(texts('{ "type": "apoli:multiple", "a": { "type": "apoli:action_on_hit" }, "b": { "type": "apoli:fly" }, "hidden": true }')[0] ?? "", /^b: apoli:fly doesn't exist/);
    assert.deepEqual(texts('{ "type": "apoli:action_on_hit", "self_action": { "type": "apoli:macro", "macro": "x:y" } }'), []);
    assert.deepEqual(texts('{ "type": "mymod:custom", "x": 1, "y": { "type": "apoli:heal", "amount": 1 } }'), []);
    assert.deepEqual(texts('{ "type": "apoli:tooltip", "text": "hi", "badges": [{ "type": "origins:tooltip", "sprite": "a:b", "text": "c" }] }'), []);
    assert.deepEqual(texts('{ "channel": { "type": "apoli:pitch" } }'), []);
    assert.deepEqual(texts('{ "type": "apoli:modify_damage", "data": { "power": "a:b", "operation": "remove" } }'), [], "another mod's wrapper with fields of its own");
    assert.match(texts('{ "type": "apoli:modify_damage", "data": { "action": { "type": "apoli:nope" } } }')[0] ?? "", /apoli:nope doesn't exist/, "the types inside a wrapper are still checked");
  });

  it("reports json that doesn't parse, and made-up ids in it", () => {
    const found = problems('{ "type": "apoli:nope", "x": }');
    assert.match(found[0]?.text ?? "", /^the json doesn't parse/);
    assert.equal(found[1]?.text, "apoli:nope doesn't exist in Apoli or Origins.");
  });

  it("checks nothing without a library", () => {
    assert.deepEqual(problemsIn(fenced('{ "type": "apoli:invented" }'), buildSchema([], [])), []);
  });

  it("only offers 'Apoli can't do it' when something was made up", () => {
    const moved = correctionFor(problems('{ "type": "apoli:action_on_hit", "bientity_action": { "type": "apoli:heal" } }'));
    assert.match(moved, /^The json has mistakes:\n- at bientity_action: /);
    assert.match(moved, /Fix only these and keep the rest of your answer \(the same power type, what it does and when\) as it was\.$/);
    assert.match(correctionFor(problems('{ "type": "apoli:nope" }')), /If no real type does what they asked, say so instead of guessing\.$/);
  });

  it("drops only the json blocks that are still wrong", () => {
    const text = `a\n\`\`\`json\n{ "type": "apoli:nope" }\n\`\`\`\nb\n\`\`\`json\n{ "type": "apoli:heal", "amount": 1 }\n\`\`\`\n\`\`\`json\n{ "type": "apoli:heal", }\n\`\`\`\n\`\`\`java\nint x;\n\`\`\`\nc`;
    const cleaned = withoutBadBlocks(text, schema);
    assert.equal(cleaned.removed, 1);
    assert.doesNotMatch(cleaned.text, /apoli:nope/);
    assert.match(cleaned.text, /"amount": 1/);
    assert.match(cleaned.text, /int x;/);
    assert.match(cleaned.text, /^a\n+b/);
    const led = withoutBadBlocks("it works like this.\nhere's the fixed example:\n\n```json\n{ \"type\": \"apoli:nope\" }\n```\nthat's all", schema);
    assert.equal(led.text, "it works like this.\n\nthat's all");
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

describe("holding what a reply says to its own json", () => {
  const said = (text: string, question?: string) => problemsIn(text, schema, question).map(problem => problem.text);

  it("counts hearts in health points", () => {
    const heal = (amount: number) => fenced(`{ "type": "apoli:action_on_hit", "self_action": { "type": "apoli:heal", "amount": ${amount} } }`);
    assert.ok(said(`${heal(5)}\nit heals you 5 hearts every hit`).some(text => /"amount": 5 is 2\.5 hearts, not 5\. For 5 hearts it's "amount": 10/.test(text)));
    assert.deepEqual(said(`${heal(4)}\nit heals you 2 hearts (4 health points)`).filter(text => /hearts/.test(text)), []);
  });

  it("holds a cooldown to the file, but not the rule for ticks", () => {
    const key = fenced('{ "type": "apoli:action_on_key_press", "entity_action": { "type": "apoli:heal", "amount": 2 }, "cooldown": 100 }');
    assert.ok(said(`${key}\nthe cooldown is 500 ticks, which is 5 seconds`).some(text => /a cooldown of 500 ticks, but the json has "cooldown": 100/.test(text)));
    assert.deepEqual(said(`${key}\nit has a 5 second cooldown`).filter(text => /cooldown of/.test(text)), []);
    assert.deepEqual(said(`${key}\nthe cooldown is in ticks (20 ticks = 1 second)`).filter(text => /cooldown of/.test(text)), []);
  });

  it("knows night is daytime turned around, when they asked for night", () => {
    const day = fenced('{ "type": "apoli:action_on_hit", "self_action": { "type": "apoli:heal", "amount": 2 }, "condition": { "type": "apoli:daytime" } }');
    assert.ok(said(day, "can i make a power that only works at night?").some(text => /"inverted": true/.test(text)));
    assert.deepEqual(said(day, "can i make a power that only works during the day?").filter(text => /they asked for/.test(text)), []);
    assert.deepEqual(said(day).filter(text => /they asked for/.test(text)), [], "without their message there's nothing to hold it to");
    assert.equal(withoutBadBlocks(`here:\n${day}\nthat's it`, schema, "only at night please").removed, 1, "and the block goes when it still says so");
  });
});

const request: BrainRequest = { system: "S", messages: [{ role: "user", content: "sam: make me hit things" }], maxToolRounds: 3, followThrough: () => null };
const BAD = fenced('{ "type": "apoli:action_on_hit", "bientity_action": { "type": "apoli:heal", "amount": 2 } }');
const INVENTED = fenced('{ "type": "apoli:spawn_butterflies" }');
const GOOD = fenced('{ "type": "apoli:action_on_hit", "self_action": { "type": "apoli:heal", "amount": 2 } }');

describe("answering with a check", () => {
  it("answers once when nothing is wrong, or when there's no library", async () => {
    const { brain, requests } = fakeBrain([GOOD, BAD]);
    const reply = await checkedReply(brain, request, schema);
    assert.equal(reply.text, GOOD);
    assert.equal(reply.corrected, false);
    assert.equal((await checkedReply(brain, request, null)).text, BAD);
    assert.equal(requests.length, 2);
  });

  it("asks for the reply again with a note they can't see, never as a turn to apologize for", async () => {
    const { brain, requests } = fakeBrain([BAD, GOOD]);
    const reply = await checkedReply(brain, request, schema);
    assert.equal(requests.length, 2);
    const second = requests[1]!;
    assert.deepEqual(second.messages.map(message => message.role), ["user"], "no assistant turn with the draft");
    const note = second.messages[0]?.content ?? "";
    assert.match(note, /^sam: make me hit things\n\n\[note to grove, they can't see this: you drafted this reply\n"""\n/);
    assert.match(note, /move it to "target_action"/);
    assert.match(note, /no apology, and don't mention a draft, a mistake or a check\.\]$/);
    assert.equal(second.maxToolRounds, 1);
    assert.equal(second.followThrough, undefined);
    assert.equal(reply.text, GOOD);
    assert.equal(reply.corrected, true);
    assert.equal(reply.problems.length, 1);
    assert.deepEqual(reply.toolCalls, ["t1", "t2"]);
    assert.equal(reply.ms, 2_000);
  });

  it("shows the Handbook's own example when the json is still wrong", async () => {
    const { brain } = fakeBrain([INVENTED, `${INVENTED}\nit's an \`apoli:action_on_hit\`, so it fires every time you hit something`]);
    const reply = await checkedReply(brain, request, schema, { mainType: "apoli:action_on_hit" });
    assert.doesNotMatch(reply.text, /spawn_butterflies/);
    assert.match(reply.text, /every time you hit something\n\nhere's the handbook's own example for `apoli:action_on_hit` to start from:\n```json\n\{\n {4}"type": "apoli:action_on_hit"/);
    assert.match(reply.text, /docs\/datapack\/powers\/action_on_hit\/$/);
    assert.equal(handbookExample(schema, ["apoli:nope", null]), null);
  });

  it("drops what a rewritten reply says about the rewrite", async () => {
    const leaky = `here's the fix for your bar. i swapped the operation for the right one. it drains while you sprint.\n${GOOD.replace(/^here you go\n/, "")}`;
    const reply = await checkedReply(fakeBrain([BAD, leaky]).brain, request, schema);
    assert.match(reply.text, /^it drains while you sprint\.\n```json/);
    assert.equal(withoutLeaks("oops, sorry!"), "", "a reply that is only that is kept as it was by checkedReply");
  });

  it("says it isn't sure when only filler is left", async () => {
    const { brain } = fakeBrain([INVENTED, `here you go:\n${INVENTED.replace(/^here you go\n/, "")}\ni hope that helps! rain is my favorite thing too.`]);
    const reply = await checkedReply(brain, request, schema, { mainType: "apoli:action_on_hit" });
    assert.match(reply.text, /^hmm, i'm not sure about that one and i don't want to guess\.\n\nhere's the handbook's own example for `apoli:action_on_hit`/);
  });

  it("says the checked hint when its own json had to go", async () => {
    const { brain } = fakeBrain([INVENTED, INVENTED]);
    const hint = 'Only at night: give the power "condition": { "type": "apoli:daytime", "inverted": true }.';
    const reply = await checkedReply(brain, request, schema, { mainType: "apoli:action_on_hit", hints: [hint] });
    assert.match(reply.text, new RegExp(`here's how it's done:\\n- ${hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n\\nhere's the handbook's own example`));
  });

  it("takes out sentences about made-up types and links, and says so when nothing is left", async () => {
    const invented = "you want `apoli:night` for that. see https://0vergrown.github.io/Handbook/docs/datapack/entity-conditions/night/ for more.";
    const { brain } = fakeBrain([invented, invented]);
    const reply = await checkedReply(brain, request, schema, { mainType: "apoli:sneaking" });
    assert.equal(reply.text, "hmm, i'm not sure about that one and i don't want to guess. the closest handbook page is https://0vergrown.github.io/Handbook/docs/datapack/entity-conditions/sneaking/");
    const mixed = "it's `apoli:sneaking` with \"inverted\": true. or try `apoli:not_sneaking`. that's all!";
    const kept = await checkedReply(fakeBrain([mixed, mixed]).brain, request, schema);
    assert.equal(kept.text, "it's `apoli:sneaking` with \"inverted\": true. that's all!");
  });

  it("falls back to the first answer, cleaned, when the brain goes away mid-check", async () => {
    const { brain } = fakeBrain([INVENTED, new BrainUnavailable("gone")]);
    const reply = await checkedReply(brain, request, schema);
    assert.doesNotMatch(reply.text, /spawn_butterflies/);
    assert.match(reply.text, /i couldn't get the json right/);
    assert.equal(reply.corrected, true);
  });

  it("lets other failures through", async () => {
    const { brain } = fakeBrain([BAD, new Error("boom")]);
    await assert.rejects(checkedReply(brain, request, schema), /boom/);
  });
});
