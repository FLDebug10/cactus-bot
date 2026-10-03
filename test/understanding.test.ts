import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { read } from "../src/brain/text/reader.ts";
import { addressingOf, type Addressing } from "../src/brain/understand/addressing.ts";
import { interpret, type IntentId, weightOf } from "../src/brain/understand/intents.ts";
import { findTopics } from "../src/brain/understand/topics.ts";
import { GROVE_ID } from "./harness.ts";

function intentOf(text: string): IntentId {
  const reading = read(text, GROVE_ID);
  const { intents } = interpret(reading, findTopics(reading.text, reading.tokens));
  assert.ok(intents.length > 0, `no intent for ${JSON.stringify(text)}`);
  return [...intents].sort((a, b) => weightOf(b.id) * (0.5 + b.confidence) - weightOf(a.id) * (0.5 + a.confidence))[0]!.id;
}

function addressing(text: string): Addressing {
  return addressingOf({ reading: read(text, GROVE_ID), mentionsGrove: false, repliesToGrove: false, repliesToSomeoneElse: false, mentionsSomeoneElse: false, inConversation: false });
}

describe("reading", () => {
  it("expands slang and contractions", () => {
    assert.equal(read("r u ok", null).text, "are you ok");
    assert.equal(read("hows ur day", null).text, "how is your day");
    assert.equal(read("wdym", null).text, "what do you mean");
    assert.equal(read("I'm sad", null).text, "i am sad");
  });

  it("unstretches elongated words", () => {
    assert.equal(read("heyyyyy", null).text, "hey");
    assert.equal(read("sooooo goooood", null).text, "so good");
  });

  it("repairs typos only toward words that matter", () => {
    assert.equal(read("my datpack is broken", null).text, "my datapack is broken");
    assert.equal(read("where do i put my sugestion", null).text, "where do i put my suggestion");
    assert.equal(read("whats the handbok", null).text, "what is the handbook");
    assert.equal(read("orgins crashes", null).text, "origins crashes");
    assert.equal(read("i drove home and ate an apple", null).text, "i drove home and ate an apple");
  });

  it("reads an @mention of Grove, and misspellings of its name, as the name", () => {
    assert.equal(read(`<@${GROVE_ID}> hi`, GROVE_ID).names.length, 1);
    assert.equal(read("gorve are you ok", null).names.length, 1);
    assert.equal(read("i love groves of trees", null).names.length, 0);
  });

  it("notices laughter, questions and roleplay", () => {
    assert.equal(read("lmaooo", null).laugh, true);
    assert.equal(read("💀", null).laugh, true);
    assert.equal(read("you ok?", null).question, true);
    assert.equal(read("*pets grove*", null).action, "pets grove");
  });
});

describe("addressing", () => {
  it("knows when Grove is being talked to", () => {
    for (const text of ["hey grove", "grove are you ok", "thanks grove!", "are you okay grove", "grove my game keeps crashing", "grove, what is apoli"]) {
      assert.equal(addressing(text), "vocative", text);
    }
  });

  it("knows when Grove is only being talked about", () => {
    for (const text of ["grove is so cute", "i think grove's emoji is cute", "ask grove about it", "i found a cherry grove biome"]) {
      assert.equal(addressing(text), "about", text);
    }
  });

  it("ignores messages that are not about Grove at all", () => {
    assert.equal(addressing("anyone want to play"), "none");
  });
});

describe("intents for the messages Grove used to get wrong", () => {
  const cases: Array<[string, IntentId]> = [
    ["Hey, @grove are you dumb?", "ask_insult"],
    ["You are stupid", "insult"],
    ["ur stupid", "insult"],
    ["Grove you are funny", "compliment"],
    ["@grove are you a guy or girl?", "ask_gender"],
    ["what gender are you?", "ask_gender"],
    ["@grove how is ur day", "how_is_day"],
    ["tf does that even mean", "confused"],
    ["I'm having trouble with my datapack. It is crashing my game.", "problem"],
    ["@grove Can you ball?", "ask_ability"],
    ["@grove what is overgrown's apoli?", "define"],
    ["where do i submit my jam entry", "jam_submit"],
    ["when is the next jam", "jam_info"],
    ["where can we talk about the jam", "jam_chat"],
    ["where do i report bugs?", "where_to"],
    ["i have an idea for a new origin", "suggestion"],
    ["where can i post my screenshots", "media"],
    ["is origins on neoforge", "versions"],
    ["are you a bot", "ask_is_bot"],
    ["are you a slime", "ask_species"],
    ["i love you grove", "love"],
    ["thank you!", "thank"],
    ["whats 2+2", "math"],
    ["tell me a joke", "joke"],
    ["do you have rizz", "slang"],
    ["can you tell me what apoli is", "define"],
    ["how do i contact the staff", "contact_staff"],
  ];
  for (const [text, expected] of cases) {
    it(`${JSON.stringify(text)} reads as ${expected}`, () => assert.equal(intentOf(text), expected));
  }
});

describe("topics", () => {
  it("tells someone's own work from the mod itself", () => {
    assert.equal(findTopics("my datapack keeps crashing", ["my", "datapack", "keeps", "crashing"]).owner, "own");
    assert.equal(findTopics("origins keeps crashing", ["origins", "keeps", "crashing"]).owner, "mod");
    assert.equal(findTopics("my game keeps crashing", ["my", "game", "keeps", "crashing"]).owner, null);
  });
});
