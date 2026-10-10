import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BrainReply, BrainRequest } from "../../src/grove/brain.ts";
import { compose, type Plan, type PlannedAction } from "../../src/grove/builder/blocks.ts";
import { introFrom, powerReply, powerRequest, type PowerBuild } from "../../src/grove/builder/build.ts";
import { type Form, planPower, reconcile } from "../../src/grove/builder/planner.ts";
import { asksForPower, followUpKind, objectsIn, readRequest } from "../../src/grove/builder/reading.ts";
import type { ChatLine } from "../../src/grove/types.ts";

const plan = (overrides: Partial<Plan>): Plan => ({
  when: "passive", actions: [], passives: [], effects: [], level: null, levels: {}, color: null, target: null, percent: null, factor: null, hearts: null,
  from: [], conditions: [], cooldown: null, every: null, radius: null, toggle: false, ...overrides,
});
const action = (overrides: Partial<PlannedAction>): PlannedAction => ({
  who: "me", what: "effect", effect: null, seconds: null, level: null, hearts: null, entity: null, command: null, blocks: null, ...overrides,
});
const form = (actions: Form["actions"], passive = "none", passiveEffect = "none"): Form => ({ actions, passive, passive_effect: passiveEffect });
const act = (who: string, what: string, effect = "none", entity = "none") => ({ who, what, effect, entity });
const planFor = (request: string, answer: Form) => reconcile(readRequest(request), answer, objectsIn(request), request);

describe("reading a request for a power", () => {
  it("finds what sets it off, with being hit kept apart from hitting", () => {
    assert.deepEqual(readRequest("can you make a power, that gives entitys I hit the wither effect?").triggers, ["hit"]);
    assert.deepEqual(readRequest("a power that poisons anyone who hits me").triggers, ["hurt"]);
    assert.deepEqual(readRequest("when they hit me they get slowness").triggers, ["hurt"]);
    assert.deepEqual(readRequest("gives me strength when i kill something").triggers, ["kill"]);
    assert.deepEqual(readRequest("heals me every 5 seconds while i'm in water").triggers, ["time"]);
    assert.deepEqual(readRequest("i explode when i die").triggers, ["death"]);
    assert.deepEqual(readRequest("my hits set mobs on fire").triggers, ["hit"]);
    assert.deepEqual(readRequest("i want to breathe underwater").triggers, []);
  });

  it("reads when it works only where the words say so", () => {
    assert.deepEqual(readRequest("speed while i'm in water").conditions, ["in_water"]);
    assert.deepEqual(readRequest("i want to breathe underwater").conditions, [], "underwater is the ability here, not a condition");
    assert.deepEqual(readRequest("make me glow when sneaking").conditions, ["sneaking"]);
    assert.deepEqual(readRequest("only works at night").conditions, ["night"]);
    assert.deepEqual(readRequest("sets anyone who attacks me on fire").conditions, [], "setting on fire is the action");
  });

  it("names effects, the longer names first", () => {
    assert.deepEqual(readRequest("fire resistance and slow falling, then slowness").effects, ["fire_resistance", "slow_falling", "slowness"]);
    assert.deepEqual(readRequest("give them the wither effect").effects, ["wither"]);
    assert.deepEqual(readRequest("summon a wither skeleton").effects, []);
  });

  it("reads the numbers, the last one said winning", () => {
    const first = readRequest("slowness for 5 seconds with a 30 second cooldown");
    assert.deepEqual([first.seconds, first.cooldown], [5, 30]);
    assert.equal(readRequest("wither for 10 seconds\nmake it 20 seconds").seconds, 20);
    assert.equal(readRequest("every 3 seconds").every, 3);
    assert.equal(readRequest("give me 5 extra hearts").hearts, 5);
    assert.equal(readRequest("heal 1 heart when below 5 hearts").hearts, 1, "the hearts in a condition aren't the amount");
    assert.deepEqual(readRequest("give me speed 2").levels, { speed: 2 });
    assert.deepEqual(readRequest("strength ii when i kill").levels, { strength: 2 });
    assert.deepEqual(readRequest("speed 3 and jump boost 2 for 10 seconds").levels, { jump_boost: 2, speed: 3 });
    assert.equal(readRequest("speed 3 and slowness").level, null, "a level by one effect isn't every effect's");
    assert.deepEqual(readRequest("speed 3 for 10 seconds").numbers, ["3", "10"]);
    assert.deepEqual(readRequest("make me glow red").color, [1, 0, 0]);
    assert.equal(readRequest("take half damage from fire").percent, 50);
    assert.equal(readRequest("take no fall damage").percent, 100);
    assert.deepEqual([readRequest("power that doubles my speed").percent, readRequest("power that doubles my speed").numbers], [100, ["doubles"]]);
    assert.deepEqual(readRequest("make a power where sneaking makes me invisible").conditions, ["sneaking"]);
    assert.deepEqual(readRequest("fire resistance whenever i'm on fire").whats, [], "a condition, not an action");
    assert.deepEqual(readRequest("make a power that makes me immune to fall damage and fire").froms, ["falling", "fire"]);
    assert.deepEqual(readRequest("sets anyone who attacks me on fire").froms, [], "an action, not the damage");
  });

  it("knows a toggle, and what it can't build", () => {
    assert.equal(readRequest("a toggle ability that makes me invisible").toggle, true);
    assert.equal(readRequest("a toggle ability that makes me invisible").unsupported, null);
    assert.notEqual(readRequest("a mana bar that drains while i sprint").unsupported, null);
    assert.notEqual(readRequest("gives undead i hit weakness").unsupported, null);
    assert.equal(readRequest("yeah that sounds good").unsupported, null);
  });

  it("reads who an action is done to from the words after its verb", () => {
    assert.deepEqual(objectsIn("heals me 2 hearts every time i hit something"), { heal: "me" });
    assert.deepEqual(objectsIn("gives whatever i hit slowness"), { effect: "other" });
    assert.deepEqual(objectsIn("gives the player regeneration every 10 seconds"), { effect: "me" });
    assert.deepEqual(objectsIn("give me a power that poisons whoever hits me"), { effect: "other" }, "give me a power is about the power");
  });
});

describe("telling a request for a power from everything else", () => {
  it("knows a request when it sees one", () => {
    assert.equal(asksForPower("can you make a power, that gives entitys I hit the wither effect?"), true);
    assert.equal(asksForPower("power that heals me every 5 seconds while i'm in water"), true);
    assert.equal(asksForPower("what does apoli:resource do"), false);
    assert.equal(asksForPower("how do i take a power away from a player with a command"), false);
    assert.equal(asksForPower("my power doesn't work"), false);
    assert.equal(asksForPower("grove can you make me glow when i'm low on health?"), true, "an ability for them, without the word power");
    assert.equal(asksForPower("can you make me a sandwich"), false);
  });

  it("reads a yes and a change to the last request", () => {
    assert.equal(followUpKind("Yeah that sounds good"), "confirm");
    assert.equal(followUpKind("Just give it to me like that"), "confirm");
    assert.equal(followUpKind("make it 20 seconds"), "change");
    assert.equal(followUpKind("yes but add a 10 second cooldown"), "change");
    assert.equal(followUpKind("lol nice"), null);
  });

  let id = 1;
  const line = (content: string, grove = false): ChatLine => ({ id: String(id++), channelId: "c", authorId: grove ? "grove" : "sam", authorName: grove ? "grove" : "sam", isGrove: grove, isBot: grove, content, at: id, replyToId: null });

  it("builds a follow-up from the request it answers", () => {
    const asked = line("can you make a power that gives entities i hit the wither effect?");
    assert.equal(powerRequest(line("Yeah that sounds good"), [asked, line("sure! want it to last longer?", true)]), asked.content, "a yes to a question builds the request");
    assert.equal(powerRequest(line("Yeah that sounds good"), [asked, line("here you go!\n```json\n{}\n```", true)]), null, "a yes after the power is just a yes");
    assert.equal(powerRequest(line("make it 20 seconds"), [asked, line("here you go!\n```json\n{}\n```", true)]), `${asked.content}\nmake it 20 seconds`);
    assert.equal(powerRequest(line("make it 20 seconds"), []), null);
  });
});

describe("planning a power", () => {
  it("takes the trigger and the numbers from the words, and who from the model", () => {
    const wither = planFor("can you make a power, that gives entitys I hit the wither effect?", form([act("the one I hit", "give a status effect", "wither")]));
    assert.equal(wither?.when, "hit");
    assert.deepEqual(wither?.actions.map(found => [found.who, found.what, found.effect]), [["other", "effect", "wither"]]);
  });

  it("keeps each effect's own level, and the mob it's about", () => {
    const two = planFor("make an ability that gives me speed 3 and jump boost 2 for 10 seconds when i press a key", form([act("me", "give a status effect", "speed"), act("me", "give a status effect", "jump_boost")]));
    assert.deepEqual(two?.actions.map(found => [found.effect, found.level]), [["speed", 3], ["jump_boost", 2]]);
    const creepers = planFor("make a power where creepers i hit explode", form([act("the one I hit", "make an explosion")]));
    assert.deepEqual([creepers?.when, creepers?.target], ["hit", "creeper"]);
    assert.equal(planFor("gives me the wither effect when i hit", form([act("me", "give a status effect", "wither")]))?.target, null, "the effect, not the boss");
    assert.equal(readRequest("burn in the sun like a zombie").entity, null, "a comparison, not a mob");
  });

  it("trusts the words over the model about who", () => {
    const heal = planFor("grove make a power that heals me 2 hearts every time i hit something", form([act("the one I hit", "heal")]));
    assert.deepEqual(heal?.actions.map(found => [found.who, found.hearts]), [["me", 2]]);
  });

  it("sends others on a key press to the ones around you, and only when others are named", () => {
    const weakness = planFor("make a power that gives every mob near me weakness when i press a key", form([act("the one I hit", "give a status effect", "weakness")]));
    assert.equal(weakness?.actions[0]?.who, "near");
    const launch = planFor("an ability that launches me into the air when i press a key", form([act("the one I hit", "launch up into the air")]));
    assert.equal(launch?.actions[0]?.who, "me");
  });

  it("drops what the words don't back, and reads the model's slips the way they meant", () => {
    assert.equal(planFor("make a power that heals and launches whatever i hit", form([act("the one I hit", "make an explosion")])), null, "two things named, neither picked");
    const launched = planFor("make a power where the player i hit gets launched", form([act("the one I hit", "knock away from me")]));
    assert.deepEqual(launched?.actions.map(found => [found.who, found.what]), [["other", "launch"]], "the one thing the words name");
    const poison = planFor("make a power that poisons whatever i hit", form([act("the one I hit", "make an explosion")]));
    assert.deepEqual(poison?.actions.map(found => [found.who, found.what, found.effect]), [["other", "effect", "poison"]], "the effect they named, when nothing the model picked is backed");
    const regen = planFor("gives me regeneration when i press a key", form([act("me", "heal", "regeneration")]));
    assert.deepEqual(regen?.actions.map(found => [found.what, found.effect]), [["effect", "regeneration"]]);
    const lightning = planFor("summons lightning on whatever i hit", form([act("the one I hit", "summon an entity", "none", "lightning_bolt")]));
    assert.equal(lightning?.actions[0]?.what, "lightning");
  });

  it("makes a passive power from the ability the words name", () => {
    const glow = planFor("make a power that makes me glow when sneaking", form([], "be invisible"));
    assert.deepEqual([glow?.when, glow?.passives, glow?.conditions], ["passive", ["glow"], ["sneaking"]]);
    const speed = planFor("make a power that gives me speed while i'm in water", form([act("me", "give a status effect", "speed")]));
    assert.deepEqual([speed?.passives, speed?.effects], [["permanent_effect"], ["speed"]]);
    const both = planFor("i want a passive that gives me night vision and water breathing", form([], "see in the dark"));
    assert.deepEqual(both?.passives, ["night_vision", "breathe_underwater"], "two abilities, each its own sub-power");
    const immune = planFor("make a power that makes me immune to slowness and weakness", form([], "be immune to a status effect", "weakness"));
    assert.deepEqual(immune?.effects, ["weakness", "slowness"], "every effect they named, the model's first");
    assert.equal(planFor("gives me strength whenever i'm angry", form([act("me", "give a status effect", "strength")])), null, "a when nothing explains");
  });

  it("refuses what it can't build", () => {
    assert.equal(planFor("a power that gives me a mana bar", form([], "none")), null);
    assert.equal(planFor("power that heals me and gives me speed", form([], "have a status effect", "speed")), null, "the heal would be left out");
    assert.equal(planFor("gives me strength when i'm below 5 hearts", form([], "have a status effect", "strength")), null, "a number it can't use");
    assert.equal(planFor("make me glow red when i press a key", form([act("me", "give a status effect", "glowing")])), null, "a colour only a glow can take");
    assert.equal(planFor("when i hit something it gets poison and when they hit me they get wither", form([act("the one I hit", "give a status effect", "poison")])), null);
  });

  it("asks the model for a fixed form, coolly", async () => {
    let asked: BrainRequest | null = null;
    const brain = {
      reply: async (request: BrainRequest): Promise<BrainReply> => {
        asked = request;
        return { text: JSON.stringify(form([act("the one I hit", "give a status effect", "wither")])), brain: "local", model: "m", toolCalls: [], promptTokens: 0, replyTokens: 0, ms: 1 };
      },
    };
    const planned = await planPower(brain, "can you make a power, that gives entitys I hit the wither effect?");
    assert.equal(planned?.actions[0]?.effect, "wither");
    assert.equal(asked!.temperature, 0);
    assert.equal((asked!.format as { type?: string }).type, "object");
    assert.match(String(asked!.messages.at(-1)?.content), /it goes off: when I hit something/);
  });
});

describe("putting a power together", () => {
  it("puts the effect on the one you hit", () => {
    const built = compose(plan({ when: "hit", actions: [action({ who: "other", effect: "wither" })] }));
    assert.deepEqual(built?.power, { type: "apoli:action_on_hit", target_action: { type: "apoli:apply_effect", effect: { effect: "minecraft:wither", duration: 200, amplifier: 0 } } });
    assert.equal(built?.does, "whenever you hit something, the one you hit gets wither for 10 seconds.");
  });

  it("puts a mob filter where the trigger reads it", () => {
    const built = compose(plan({ when: "hit", target: "creeper", actions: [action({ who: "other", what: "explode" })] }));
    assert.deepEqual(built?.power, { type: "apoli:action_on_hit", target_action: { type: "apoli:explode", power: 3 }, target_condition: { type: "apoli:entity_type", entity_type: "minecraft:creeper" } });
    assert.equal(built?.does, "whenever you hit a creeper, the one you hit explodes.");
  });

  it("finds the attacker of a hit on you, and turns pushes around", () => {
    assert.deepEqual(compose(plan({ when: "hurt", actions: [action({ who: "other", effect: "poison", level: 2 })] }))?.power, {
      type: "apoli:action_when_hit",
      attacker_action: { type: "apoli:apply_effect", effect: { effect: "minecraft:poison", duration: 200, amplifier: 1 } },
    });
    assert.deepEqual(compose(plan({ when: "hurt", actions: [action({ who: "other", what: "push" })] }))?.power, {
      type: "apoli:action_when_hit",
      bientity_action: { type: "apoli:invert", action: { type: "apoli:add_velocity", z: 1.5, y: 0.3 } },
    });
  });

  it("reaches everything near you through an area of effect, with a cooldown in ticks", () => {
    const built = compose(plan({ when: "key", cooldown: 30, actions: [action({ who: "near", effect: "weakness" })] }));
    assert.deepEqual(built?.power, {
      type: "apoli:action_on_key_press",
      entity_action: { type: "apoli:area_of_effect", radius: 5, bientity_action: { type: "apoli:target_action", action: { type: "apoli:apply_effect", effect: { effect: "minecraft:weakness", duration: 200, amplifier: 0 } } } },
      cooldown: 600,
      hud_render: { should_render: true },
    });
    assert.match(built?.tips[0] ?? "", /"duration" and "cooldown" are in ticks/);
  });

  it("runs an action on you when you die through the one bi-entity action", () => {
    assert.deepEqual(compose(plan({ when: "death", actions: [action({ what: "explode" })] }))?.power, {
      type: "apoli:action_on_death",
      bientity_action: { type: "apoli:target_action", action: { type: "apoli:explode", power: 3, damage_self: false } },
    });
  });

  it("builds passives the way their pages say", () => {
    assert.deepEqual(compose(plan({ passives: ["less_damage"], percent: 100, from: ["falling"] }))?.power, { type: "apoli:invulnerability", damage_condition: { type: "apoli:from_falling" } });
    assert.deepEqual(compose(plan({ passives: ["less_damage"], percent: 100, from: ["falling", "fire"] }))?.power, {
      type: "apoli:invulnerability",
      damage_condition: { type: "apoli:any_of", conditions: [{ type: "apoli:from_falling" }, { type: "apoli:in_tag", tag: "minecraft:is_fire" }] },
    });
    assert.deepEqual(compose(plan({ passives: ["less_damage"], percent: 50, from: ["fire"] }))?.power, {
      type: "apoli:modify_damage_taken",
      modifier: { operation: "multiply_total_multiplicative", value: -0.5 },
      damage_condition: { type: "apoli:in_tag", tag: "minecraft:is_fire" },
    });
    assert.deepEqual(compose(plan({ passives: ["permanent_effect"], effects: ["night_vision"] }))?.power, { type: "apoli:night_vision" }, "the power, not an effect that flickers");
    assert.deepEqual(compose(plan({ passives: ["effect_immunity"], effects: ["poison", "wither"] }))?.power, { type: "apoli:effect_immunity", effects: ["minecraft:poison", "minecraft:wither"] });
    assert.deepEqual(compose(plan({ passives: ["glow"], color: [1, 0, 0] }))?.power, { type: "apoli:self_glow", use_teams: false, red: 1, green: 0, blue: 0 });
    assert.deepEqual(compose(plan({ passives: ["night_vision", "breathe_underwater"] }))?.power, {
      type: "apoli:multiple",
      night_vision: { type: "apoli:night_vision" },
      breathe_underwater: { type: "apoli:water_breathing" },
    });
    assert.deepEqual(compose(plan({ passives: ["glow"], conditions: ["night", "sneaking"] }))?.power, {
      type: "apoli:self_glow",
      condition: { type: "apoli:all_of", conditions: [{ type: "apoli:daytime", inverted: true }, { type: "apoli:sneaking" }] },
    });
  });

  it("switches a power with a toggle in the same file", () => {
    const built = compose(plan({ passives: ["invisible"], toggle: true }));
    assert.deepEqual(built?.power, {
      type: "apoli:multiple",
      toggle: { type: "apoli:toggle", active_by_default: false },
      ability: { type: "apoli:invisibility", condition: { type: "apoli:power_active", power: "*:*_toggle" } },
    });
    assert.match(built?.does ?? "", /^press your ability key to turn it on and off/);
  });

  it("won't build what doesn't add up", () => {
    assert.equal(compose(plan({ when: "key", actions: [action({ who: "other", what: "heal" })] })), null);
    assert.equal(compose(plan({ when: "hit", actions: [action({ who: "other", what: "summon" })] })), null);
    assert.equal(compose(plan({ passives: ["effect_immunity"] })), null);
    assert.equal(compose(plan({ when: "key", target: "zombie", actions: [action({ effect: "speed" })] })), null, "a key press has no mob to be about");
  });
});

describe("the reply around a built power", () => {
  it("keeps Grove's own line and drops anything that explains or apologizes", () => {
    assert.equal(introFrom("yay! here's your power! this power makes the one you hit wither for 10 seconds."), "yay! here's your power!");
    assert.equal(introFrom("whoops, i forgot the cooldown! here you go!"), "here you go!");
    assert.equal(introFrom("the cooldown is 500 ticks"), "here you go!");
    assert.equal(introFrom("yay, here you go, grove!"), "yay, here you go!");
    assert.equal(introFrom("hehe here it is:\n```json\n{}\n```"), "hehe here it is!");
  });

  it("puts the file, what it does, the units and the page under it", () => {
    const built = compose(plan({ when: "hit", actions: [action({ who: "other", effect: "wither" })] }))!;
    const build: PowerBuild = { ...built, request: "", plan: plan({}), pages: [{ id: "apoli:action_on_hit", url: "https://0vergrown.github.io/Handbook/docs/datapack/powers/action_on_hit/" }] };
    assert.equal(
      powerReply("yay!", build),
      `yay!\n\n\`\`\`json\n${built.json}\n\`\`\`\nwhenever you hit something, the one you hit gets wither for 10 seconds.\ngood to know: "duration" is in ticks (20 ticks = 1 second). "amplifier" 0 is level 1 and 1 is level 2.\nhttps://0vergrown.github.io/Handbook/docs/datapack/powers/action_on_hit/`,
    );
  });
});
