import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHANNELS, EMOJI } from "../src/config.ts";
import { dayKey, dayProfile } from "../src/brain/state/day.ts";
import { Channel } from "./harness.ts";

const BANNED = [/—/, /–/, /;/, /cactus brain/i, /rephras/i, /pay grade/i, /greetings, traveller/i];

function assertGroveVoice(text: string | null): void {
  if (text === null) return;
  for (const pattern of BANNED) assert.doesNotMatch(text, pattern, `grove said: ${text}`);
}

describe("the conversations from the bug reports", () => {
  it("handles being called dumb, then stupid, then funny", () => {
    const channel = new Channel();
    const first = channel.say("alex", "Hey, @grove are you dumb?");
    assert.equal(first.act, "ask_insult");
    assertGroveVoice(first.text);

    const second = channel.say("alex", "You are stupid", { replyTo: first.reply! });
    assert.equal(second.act, "insult");
    assertGroveVoice(second.text);

    const third = channel.say("sam", "Grove you are funny");
    assert.equal(third.act, "compliment");
    assertGroveVoice(third.text);
  });

  it("answers gender questions with the day's vibe, the same way all day", () => {
    const channel = new Channel();
    const vibe = dayProfile(dayKey(channel.now, "America/New_York")).vibe;
    const asked = channel.say("kim", "@grove are you a guy or girl?");
    assert.equal(asked.act, "gender");
    assert.match(asked.text ?? "", new RegExp(vibe.feel.split(",")[0]!));
    const again = channel.say("kim", "@grove what gender are you?");
    assert.match(again.text ?? "", new RegExp(vibe.feel.split(",")[0]!));
  });

  it("explains itself to someone else who did not understand", () => {
    const channel = new Channel();
    const day = channel.say("lee", "@grove how is ur day");
    assert.equal(day.act, "how_is_day");
    const confused = channel.say("max", "tf does that even mean", { replyTo: day.reply! });
    assert.equal(confused.act, "clarify");
    assert.match(confused.text ?? "", /lee/);
    assertGroveVoice(confused.text);
  });

  it("sends a crashing datapack to datapack support, not bug reports", () => {
    const channel = new Channel();
    const reply = channel.say("rin", "@grove I'm having trouble with my datapack. It is crashing my game.");
    assert.equal(reply.act, "route.datapack");
    assert.match(reply.text ?? "", new RegExp(CHANNELS.datapackSupport));
    assert.doesNotMatch(reply.text ?? "", new RegExp(CHANNELS.bugReports));
  });

  it("asks when it can't tell whose problem it is, then routes the answer", () => {
    const channel = new Channel();
    const asked = channel.say("ty", "grove my game keeps crashing");
    assert.equal(asked.act, "route.ask");
    const answered = channel.say("ty", "its my datapack");
    assert.equal(answered.act, "route.datapack");
    const other = new Channel();
    other.say("ty", "grove my game keeps crashing");
    assert.equal(other.say("ty", "it happens with just the mods").act, "route.bug");
  });

  it("knows ball slang and its own mods", () => {
    const channel = new Channel();
    assert.equal(channel.say("jo", "@grove Can you ball?").act, "ability.ball");
    const apoli = channel.say("pat", "@grove what is overgrown's apoli?");
    assert.equal(apoli.act, "define.apoli");
    assert.match(apoli.text ?? "", /power engine|engine part/);
  });

  it("points at the right jam channel for each jam question", () => {
    const channel = new Channel();
    assert.match(channel.say("vee", "@grove where do i submit my jam entry?").text ?? "", new RegExp(CHANNELS.jamSubmissions));
    assert.match(channel.say("vee", "grove when is the next jam").text ?? "", new RegExp(CHANNELS.jamInfo));
    assert.match(channel.say("vee", "where can i talk about the jam grove").text ?? "", new RegExp(CHANNELS.jamDiscussion));
  });
});

describe("social awareness", () => {
  it("reacts to being talked about instead of butting in, and never floods", () => {
    const channel = new Channel();
    const cute = channel.say("zed", "grove is so cute");
    assert.equal(cute.text, null);
    assert.deepEqual(cute.decision?.reactions, [EMOJI.heart]);
    assert.equal(channel.say("zed", "grove is the best", { gapMs: 10_000 }).decision, null);
    assert.equal(channel.say("ana", "i found a cherry grove biome today").decision, null);
  });

  it("keeps a conversation going without needing its name every time", () => {
    const channel = new Channel();
    const asked = channel.say("zed", "hey grove how are you");
    assert.equal(asked.act, "how_are_you");
    const followUp = channel.say("zed", "pretty good actually!", { gapMs: 8_000 });
    assert.notEqual(followUp.decision, null);
    assert.equal(followUp.decision?.meta.expectation, null);
  });

  it("stays out of other people's conversations", () => {
    const channel = new Channel();
    channel.say("zed", "hey grove");
    const other = channel.say("zed", "did you finish the build", { gapMs: 5_000, mentions: ["ana"] });
    assert.equal(other.decision, null);
  });

  it("goes quiet after repeated meanness and forgives an apology", () => {
    const channel = new Channel();
    channel.say("rude", "grove you are dumb");
    channel.say("rude", "grove you are stupid");
    const third = channel.say("rude", "grove you are useless");
    assert.ok(third.decision?.meta.act === "insult");
    assert.equal(channel.say("rude", "grove hello?").decision, null);
    const sorry = channel.say("rude", "grove im sorry");
    assert.equal(sorry.act, "apologize");
    assert.match(sorry.text ?? "", /forgive|accepted|we're good/);
  });

  it("answers an obvious unanswered question only when no person did", () => {
    const quiet = new Channel();
    const asked = quiet.say("new", "where do i report bugs?");
    assert.ok((asked.decision?.waitForSilenceMs ?? 0) > 0);
    const delivered = quiet.deliverLater(asked);
    assert.match(delivered?.text ?? "", new RegExp(CHANNELS.bugReports));

    const helped = new Channel();
    const question = helped.say("new", "where do i report bugs?");
    helped.say("helper", "in the bug reports channel!", { replyTo: question.message, gapMs: 5_000 });
    assert.equal(helped.deliverLater(question), null);
    // Grove never spoke, so the asker thanking the helper is not a conversation with Grove.
    assert.equal(helped.say("new", "thanks!", { gapMs: 5_000 }).decision, null);
  });

  it("knows a confused reaction typed right under its message is about that message", () => {
    const channel = new Channel();
    channel.say("lee", "@grove how is ur day");
    const reaction = channel.say("max", "tf does that even mean", { gapMs: 6_000 });
    assert.equal(reaction.act, "clarify");
    const later = new Channel();
    later.say("lee", "@grove how is ur day");
    later.say("ana", "anyway did anyone see the new update", { gapMs: 5_000 });
    assert.equal(later.say("max", "tf does that even mean", { gapMs: 5_000 }).decision, null);
  });

  it("merges a split message into one thought", () => {
    const channel = new Channel();
    const first = channel.say("kim", "@grove");
    const second = channel.say("kim", "are you a girl", { gapMs: 3_000 });
    assert.ok(first.decision !== null);
    assert.equal(second.act, "gender");
  });
});

describe("things a wider conversation turned up", () => {
  it("treats a mod feature that stopped working as a bug report", () => {
    const channel = new Channel();
    const reply = channel.say("ivy", "grove my enderian doesnt teleport anymore");
    assert.equal(reply.act, "route.bug");
    assert.equal(channel.say("ivy", "grove i don't like merling").act === "route.bug", false);
  });

  it("answers the version that was asked about", () => {
    const reply = new Channel().say("noah", "@grove is apoli on 1.21.4");
    assert.equal(reply.act, "versions");
    assert.match(reply.text ?? "", /not on 1\.21\.4/);
  });

  it("explains origins words and gives the reason behind its opinions", () => {
    const channel = new Channel();
    assert.equal(channel.say("noah", "grove whats a layer").act, "define.layer");
    assert.equal(channel.say("noah", "grove what is the orb of origin").act, "define.orb");
    const opinion = channel.say("mia", "grove what do you think about frogs");
    assert.match(opinion.text ?? "", /eat slimes/);
    const why = channel.say("mia", "why not", { gapMs: 10_000 });
    assert.equal(why.act, "why");
  });

  it("sends a build to the media gallery and lists the channels on request", () => {
    const channel = new Channel();
    assert.equal(channel.say("ivy", "grove i made a cool build, where should i post it").act, "route.media");
    const directory = channel.say("kai", "grove what channel is for help");
    assert.equal(directory.act, "channels");
    for (const id of [CHANNELS.bugReports, CHANNELS.datapackSupport, CHANNELS.addonSupport, CHANNELS.suggestions]) {
      assert.match(directory.text ?? "", new RegExp(id));
    }
  });

  it("follows up on its own help question", () => {
    const channel = new Channel();
    assert.equal(channel.say("kai", "grove help").act, "help");
    const routed = channel.say("kai", "it's about a datapack", { gapMs: 10_000 });
    assert.match(routed.text ?? "", new RegExp(CHANNELS.datapackSupport));
  });

  it("answers compatibility questions put to it with \"grove is ...\"", () => {
    const reply = new Channel().say("kai", "grove is origins compatible with other mods");
    assert.equal(reply.act, "compat");
  });

  it("does not giggle at sad news", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const text = new Channel({ seed }).say("sam", "grove i'm sad today").text ?? "";
      assert.doesNotMatch(text, /hehe|:D|:3|:\)/);
    }
  });
});

describe("robustness", () => {
  it("survives words that look like JavaScript internals", () => {
    const channel = new Channel();
    for (const text of ["grove constructor", "grove what is your favorite constructor", "grove can you toString", "grove __proto__", "grove do you like hasOwnProperty", "grove valueOf?"]) {
      assert.doesNotThrow(() => channel.say("probe", text, { gapMs: 90_000 }), text);
    }
  });
});

describe("grove's voice", () => {
  it("never uses dashes, semicolons or the old cactus lines, across lots of chatter", () => {
    const lines = [
      "hi grove", "grove how are you", "grove what are you doing", "grove tell me a joke", "grove tell me a fact",
      "grove are you a bot", "grove what is apoli", "grove what is origins", "grove how do i make a power",
      "grove where do i post my art", "grove i have a suggestion", "grove what is your favorite color",
      "grove do you like frogs", "grove can you fly", "grove what do you eat", "grove how old are you",
      "grove who made you", "grove is it on forge", "grove how do i install origins", "grove what origins are there",
      "grove what is merling", "grove the weather is nice", "grove i am sad", "grove what is the meaning of life",
      "grove roll a d20", "grove flip a coin", "grove pick pizza or tacos", "*pets grove*", "grove good night",
    ];
    for (let seed = 1; seed <= 12; seed++) {
      const channel = new Channel({ seed });
      for (const line of lines) assertGroveVoice(channel.say(`user${seed}`, line, { gapMs: 90_000 }).text);
    }
  });
});
