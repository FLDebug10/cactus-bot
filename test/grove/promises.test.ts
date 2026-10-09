import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPromise, promisedLookup } from "../../src/grove/promises.ts";

const QUESTION = "can u check the handbook for me on how i would make an action happen upon hitting an entity?";

describe("a reply that only promises to look", () => {
  it("is caught in the words Grove really used", () => {
    assert.equal(isPromise("got it! let's look at `apoli:action_on_hit` for that. i'll pull up the handbook page so we can see exactly how to set up the actor and target actions when someone gets hit. 🧪📖"), true);
    assert.equal(isPromise("oops! let me search the handbook for `action_on_hit` instead. 🧪🔍"), true);
    assert.equal(isPromise("one sec, checking the source for that!"), true);
    assert.equal(isPromise("hold on, i'm gonna dig through the handbook"), true);
  });

  it("is not an answer, an offer at the end of one, or plain chat", () => {
    assert.equal(isPromise("it's `apoli:action_on_hit`!\n```json\n{ \"type\": \"apoli:action_on_hit\" }\n```\nlet me know if you want changes"), false);
    assert.equal(isPromise("let me know if you want me to look into more fields!"), false);
    assert.equal(isPromise("i love looking at moss"), false);
    assert.equal(isPromise(`use apoli:action_on_hit with a target_action. ${"it fires after the damage lands. ".repeat(20)} i'll check back later`), false);
  });

  it("becomes the lookup it promised", () => {
    assert.deepEqual(promisedLookup("got it! let's look at `apoli:action_on_hit` for that. i'll pull up the handbook page.", QUESTION), { name: "read_handbook_page", arguments: { page: "apoli:action_on_hit" } });
    assert.deepEqual(promisedLookup("oops! let me search the handbook for `action_on_hit` instead.", "can u give me an example"), { name: "read_handbook_page", arguments: { page: "action_on_hit" } });
    assert.deepEqual(promisedLookup("let me check the source for ShaderPower real quick", "where is ShaderPower"), { name: "search_source", arguments: { query: "where is ShaderPower" } });
    assert.deepEqual(promisedLookup('let me search the handbook for "resource bar"', "how do i make a bar"), { name: "search_handbook", arguments: { query: "resource bar" } });
    assert.deepEqual(promisedLookup("hmm, let me look that up!", QUESTION), { name: "search_handbook", arguments: { query: QUESTION } });
    assert.equal(promisedLookup("it's `apoli:action_on_hit`, here you go", QUESTION), null);
  });
});
