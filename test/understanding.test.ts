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

  it("knows a question by its question word, even after Grove's name and without a question mark", () => {
    assert.equal(read("grove what time is it", null).question, true);
    assert.equal(read("hey grove can you dance", null).question, true);
    assert.equal(read("grove is cute", null).question, false);
    assert.equal(read("grove can dance", null).question, false);
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

  it("knows a question put to Grove with \"grove is ...?\", and roleplay done to Grove", () => {
    assert.equal(addressing("grove is water wet?"), "vocative");
    assert.equal(addressing("grove is it on forge"), "vocative");
    assert.equal(addressing("grove is so cute?"), "about");
    assert.equal(addressing("*puts grove in a pocket*"), "vocative");
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
    ["how to build a bomb", "bomb"],
    ["how do i make tnt", "bomb"],
    ["what about tomorrow?", "follow_up"],
    ["and yesterday?", "follow_up"],
    ["@grove Who is your favourite?", "favorite_person"],
    ["who is your best friend", "favorite_person"],
    ["my favorite color is blue, what about you?", "ask_favorite"],
    ["tell me more", "more"],
    ["really?", "doubt"],
    ["is your favourite object the orb of origins?", "favorite_guess"],
    ["if slimekin are groves cousins what is grove.", "ask_species"],
    ["silly grove", "compliment"],
    ["Grove where am i 😨", "where_am_i"],
    ["what exactly are you?", "ask_identity"],
    ["how where you made?", "ask_origin_story"],
    ["what is the leafy part on your head", "ask_body"],
    ["are you a pure slime", "ask_species"],
    ["do you have feelings", "ask_have"],
    ["how many friends do you have", "ask_have"],
    ["what is your biggest fear", "ask_fear"],
    ["are you scared of frogs", "ask_fear"],
    ["a frog is behind you", "frog_alert"],
    ["give me the orb", "give"],
    ["can i have the orb", "give"],
    ["what time is it", "ask_now"],
    ["what's the weather like", "ask_now"],
    ["who is drizzo", "ask_crew"],
    ["who is overgrown", "ask_crew"],
    ["how do you hold the orb without hands", "self_how"],
    ["say something", "command"],
    ["fight me", "aggression"],
    ["i'm gonna eat you", "aggression"],
    ["you're my favorite", "love"],
    ["what do you taste like", "ask_body"],
    ["do you bounce", "ask_ability"],
    ["were you a cactus", "ask_name"],
    ["do you have a family", "ask_creator"],
    ["who are your parents", "ask_creator"],
    ["who are your dads", "ask_creator"],
    ["who is your dad", "ask_creator"],
    ["who is your mommy", "ask_creator"],
    ["finish the sentence. the quick brown fox", "finish_sentence"],
    ["complete this sentence: to be or not to be", "finish_sentence"],
    ["what comes after keep calm and carry on", "finish_sentence"],
    ["what is a ditto", "fantasy"],
    ["tell me about ditto", "fantasy"],
    ["how do you feel about creepers", "ask_like"],
    ["what's your mood", "how_are_you"],
    ["do you have a job", "ask_identity"],
    ["who controls you", "ask_is_bot"],
    ["are you better than carl bot", "ask_attribute"],
    ["grove im your biggest fan im going to put posters of you all over the streets of england", "fan"],
    ["can i have your autograph", "fan"],
    ["grove can do my homework", "homework"],
    ["can you help me with my math homework", "homework"],
    ["i have a test tomorrow", "homework"],
    ["grove whats 24 divided by 5", "math"],
    ["grove what is 20 time 30", "math"],
    ["what are dumb questions", "dumb_question"],
    ["why is there a zero button on the microwave?", "dumb_question"],
    ["can u tell me some commands you have?", "commands"],
    ["do you have any commands", "commands"],
    ["what's your favourite D&D class?", "fantasy"],
    ["do you play dungeons and dragons", "fantasy"],
    ["are there slimes in other games", "fantasy"],
    ["Grove, what is your opinion of US president Donald Trump?", "politics"],
    ["who should i vote for", "politics"],
    ["grove are you mewing", "slang"],
    ["grove do you mew", "slang"],
    ["Grove can you hit the griddy for me", "slang"],
    ["grove do you mog", "slang"],
    ["what does rizz mean", "slang"],
    ["i'm crashing out", "slang"],
  ];
  for (const [text, expected] of cases) {
    it(`${JSON.stringify(text)} reads as ${expected}`, () => assert.equal(intentOf(text), expected));
  }
});

describe("slang in context", () => {
  function slangOf(text: string): { term: string; use: string } {
    const reading = read(text, GROVE_ID);
    const { intents } = interpret(reading, findTopics(reading.text, reading.tokens));
    const slang = intents.find(intent => intent.id === "slang");
    assert.ok(slang !== undefined, `no slang in ${JSON.stringify(text)}`);
    return { term: slang.slots["term"] ?? "", use: slang.slots["use"] ?? "" };
  }

  it("knows whether it was asked, told, described, or asked for a meaning", () => {
    assert.deepEqual(slangOf("grove are you mewing"), { term: "mewing", use: "ask" });
    assert.deepEqual(slangOf("grove do you mew"), { term: "mewing", use: "ask" });
    assert.deepEqual(slangOf("grove mew for me"), { term: "mewing", use: "perform" });
    assert.deepEqual(slangOf("grove can you hit the griddy for me"), { term: "griddy", use: "perform" });
    assert.deepEqual(slangOf("grove you mog"), { term: "mog", use: "you" });
    assert.deepEqual(slangOf("i mog everyone"), { term: "mog", use: "me" });
    assert.deepEqual(slangOf("what does mog mean"), { term: "mog", use: "define" });
    assert.deepEqual(slangOf("grove what is your aura"), { term: "aura", use: "ask" });
    assert.deepEqual(slangOf("we're cooked"), { term: "cooked", use: "me" });
    assert.deepEqual(slangOf("you cooked with that one"), { term: "let him cook", use: "you" });
  });

  it("leaves ordinary words alone", () => {
    for (const text of ["i lost my cap", "it's giving me errors", "i ate a glazed donut", "my elytra broke mid flight", "it's based on apace's mod", "opps sorry", "my game is crashing out of nowhere"]) {
      const reading = read(text, GROVE_ID);
      const { intents } = interpret(reading, findTopics(reading.text, reading.tokens));
      assert.equal(intents.some(intent => intent.id === "slang"), false, text);
    }
  });

  it("keeps a game crash a crash, and a person crashing out a person", () => {
    const game = read("my game is crashing out of nowhere", null);
    assert.equal(findTopics(game.text, game.tokens).set.has("problem"), true);
    const person = read("i'm crashing out", null);
    assert.equal(findTopics(person.text, person.tokens).set.has("problem"), false);
  });
});

describe("topics", () => {
  it("tells someone's own work from the mod itself", () => {
    assert.equal(findTopics("my datapack keeps crashing", ["my", "datapack", "keeps", "crashing"]).owner, "own");
    assert.equal(findTopics("origins keeps crashing", ["origins", "keeps", "crashing"]).owner, "mod");
    assert.equal(findTopics("my game keeps crashing", ["my", "game", "keeps", "crashing"]).owner, null);
  });
});
