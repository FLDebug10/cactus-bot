import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { codeFieldsOf, examplesOf, fieldOn, fieldsOf, holdsOf, knowsField, lookup, lookupIn, popularIds, registrationsIn, similarIds } from "../../src/grove/knowledge/schema.ts";
import { fixtureSchema, PAGES, SOURCES } from "./schemaFixture.ts";

const schema = fixtureSchema();

describe("what a field holds", () => {
  it("reads the kind out of the Handbook's type column", () => {
    assert.deepEqual(holdsOf("Bi-entity Action Type"), { holds: "bientity_action", many: false });
    assert.deepEqual(holdsOf("[Array](/docs/datapack/data-types/array) of Entity Action Types"), { holds: "entity_action", many: true });
    assert.deepEqual(holdsOf("Entity Condition"), { holds: "entity_condition", many: false });
    assert.deepEqual(holdsOf("Bi-Entity Condition"), { holds: "bientity_condition", many: false });
    assert.deepEqual(holdsOf("Condition Type"), { holds: "condition", many: false });
    assert.deepEqual(holdsOf("Array of Action Types"), { holds: "action", many: true });
    assert.deepEqual(holdsOf("Array of Objects (Data Type)"), { holds: null, many: false });
    assert.deepEqual(holdsOf("Integer or Expression"), { holds: null, many: false });
  });

  it("parses fields tables with or without outer pipes, and keeps snake_case names", () => {
    const fields = fieldsOf(PAGES[0]!.text);
    assert.deepEqual([...fields.keys()], ["bientity_action", "target_action", "self_action", "cooldown", "hud_render"]);
    assert.equal(fields.get("target_action")?.about, "Action run on the target (the entity that was hit).");
    assert.equal(fields.get("cooldown")?.type, "Integer");
    assert.equal(fields.get("cooldown")?.dataType, undefined, "a number is not checked field by field");
    assert.equal(fields.get("hud_render")?.dataType, "hud-render");
    assert.deepEqual([...(schema.dataTypes.get("hud-render")?.fields.keys() ?? [])], ["should_render", "bar_index", "condition"], "a heading written with a tab still counts");
    assert.equal(fieldsOf(PAGES[1]!.text).get("damage_condition")?.holds, "damage_condition");
  });

  it("takes examples from the Examples section and the sections after it", () => {
    const examples = examplesOf(PAGES[0]!.text);
    assert.deepEqual(examples.map(example => example.title), ["Knockback on hit", "Heal the attacker"]);
    assert.match(examples[0]!.json, /"apoli:add_velocity"/);
  });

  it("names an example by the line that leads into it, and keeps the caption that follows it", () => {
    const page = "## Examples\n\n```json\n{ \"type\": \"apoli:heal\", \"amount\": 6 }\n```\n\nThis example will restore about 3 hearts to the entity.\n\n```json\n{ \"type\": \"apoli:heal\", \"amount\": -4 }\n```\n\nThis example takes 2 hearts away from the entity.\n\nNear-blindness:\n\n```json\n{ \"type\": \"apoli:modify_fog\" }\n```";
    const [restore, hurt, fog] = examplesOf(page);
    assert.deepEqual([restore?.title, restore?.caption], ["Example", "This example will restore about 3 hearts to the entity."]);
    assert.deepEqual([hurt?.title, hurt?.caption], ["Example", "This example takes 2 hearts away from the entity."], "the caption above belongs to the block before");
    assert.deepEqual([fog?.title, fog?.caption], ["Near-blindness", undefined]);
  });

  it("reads field names and their kinds from a codec, in either order", () => {
    const fields = codeFieldsOf(SOURCES[1]!.text);
    assert.equal(fields.get("self_action"), "entity_action");
    assert.equal(fields.get("damage_condition"), "damage_condition");
    assert.equal(fields.get("bientity_condition"), "bientity_condition");
    assert.equal(fields.get("modifier"), null);
  });
});

describe("the registration code", () => {
  it("finds ids, kinds, legacy ids, and the class behind each, constants and helpers included", () => {
    const powers = registrationsIn(SOURCES[0]!);
    assert.deepEqual(powers.map(found => found.id), ["apoli:action_on_hit", "apoli:modify_damage", "apoli:multiple", "apoli:tooltip", "apoli:secret_power"]);
    assert.deepEqual(powers[0]!.aliases, ["apoli:self_action_on_hit"]);
    assert.equal(powers[1]!.className, "ModifyDamagePower", "a constant instance is followed to its class");
    const meta = registrationsIn(SOURCES[3]!);
    assert.deepEqual(meta.map(found => `${found.id} ${found.kind}`), ["apoli:and entity_action", "apoli:if_else entity_action", "apoli:random_chance entity_action", "apoli:and bientity_action", "apoli:if_else bientity_action"]);
    assert.deepEqual(meta[2]!.aliases, ["apoli:chance"]);
  });
});

describe("the schema", () => {
  it("knows each type by kind, with its legacy ids from the page and the code", () => {
    assert.deepEqual(lookup(schema, "apoli:action_on_hit").map(info => info.kind), ["power"]);
    assert.equal(lookup(schema, "apoli:target_action_on_hit")[0]?.id, "apoli:action_on_hit");
    assert.equal(lookup(schema, "apoli:self_action_on_hit")[0]?.id, "apoli:action_on_hit");
    assert.deepEqual(lookup(schema, "apoli:add_velocity").map(info => info.kind).sort(), ["bientity_action", "entity_action"]);
    assert.equal(lookupIn(schema, "apoli:action_on_hit", "power")?.fields.get("bientity_action")?.holds, "bientity_action");
  });

  it("puts a meta type in the kinds its code registers, not in every kind", () => {
    assert.deepEqual(lookup(schema, "apoli:and").map(info => info.kind).sort(), ["bientity_action", "entity_action"]);
    assert.deepEqual(lookup(schema, "apoli:offset").map(info => info.kind), ["block_condition"]);
    assert.equal(lookup(schema, "apoli:chance")[0]?.kind, "entity_action");
  });

  it("adds the fields a page leaves out, and trusts the code about what a field holds", () => {
    const damage = lookupIn(schema, "apoli:modify_damage", "power")!;
    assert.equal(fieldOn(damage, "self_action")?.holds, "entity_action");
    assert.equal(knowsField(damage, "bientity_condition"), true);
    assert.equal(lookup(schema, "apoli:modify_damage_taken")[0]?.id, "apoli:modify_damage");
    assert.equal(lookupIn(schema, "apoli:either", "bientity_condition")?.fields.get("condition")?.holds, "entity_condition");
    assert.equal(knowsField(damage, "made_up"), false);
  });

  it("knows types without a page from the code, and doesn't judge their fields", () => {
    const fire = lookupIn(schema, "apoli:set_on_fire", "entity_action");
    assert.ok(fire);
    assert.equal(fire.documented, false);
    assert.equal(knowsField(fire, "anything"), true);
  });

  it("answers to origins: ids, but never reads a badge type as a power", () => {
    assert.equal(lookup(schema, "origins:heal")[0]?.id, "apoli:heal");
    assert.deepEqual(lookup(schema, "origins:tooltip"), []);
    assert.equal(schema.mentioned.has("apoli:pitch"), true);
  });

  it("suggests real ids of the right kind, never meta types", () => {
    assert.deepEqual(similarIds(schema, "bientity_action", "push_entity"), ["apoli:add_velocity"], "by what its page says it does");
    assert.equal(similarIds(schema, "bientity_action", "target_thing")[0], "apoli:target_action", "its own name counts most");
    assert.ok(!popularIds(schema, "bientity_action").includes("apoli:and"));
    assert.equal(schema.slots.get("target_action"), "entity_action");
    assert.equal(schema.slots.get("bientity_action"), "bientity_action");
  });
});
