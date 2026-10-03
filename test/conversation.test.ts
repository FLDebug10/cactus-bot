import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHANNELS, CREW, EMOJI } from "../src/config.ts";
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

describe("second round of feedback", () => {
  it("answers bomb questions with the minecraft tnt recipe", () => {
    const reply = new Channel().say("edgy", "@grove how to build a bomb");
    assert.equal(reply.act, "bomb");
    assert.deepEqual(reply.decision?.files, ["minecraft_tnt_crafting_recipe.png"]);
  });

  it("understands follow-up questions about time", () => {
    const channel = new Channel();
    assert.equal(channel.say("kim", "@grove what gender are you today?").act, "gender");
    const tomorrow = channel.say("kim", "what about tomorrow?", { gapMs: 15_000 });
    assert.equal(tomorrow.act, "gender");
    assert.doesNotMatch(tomorrow.text ?? "", /never heard/);
    assert.match(tomorrow.text ?? "", /tomorrow|wake up|morning/);
    const yesterday = channel.say("kim", "and yesterday?", { gapMs: 15_000 });
    const before = dayProfile(dayKey(channel.now - 86_400_000, "America/New_York")).vibe.feel;
    assert.match(yesterday.text ?? "", new RegExp(before.split(",")[0]!));
  });

  it("re-asks its last question about something new", () => {
    const channel = new Channel();
    channel.say("mia", "grove what is your favorite food");
    assert.match(channel.say("mia", "what about color?", { gapMs: 15_000 }).text ?? "", /green/);
    channel.say("mia", "grove do you like frogs", { gapMs: 60_000 });
    assert.equal(channel.say("mia", "what about bees?", { gapMs: 15_000 }).act, "ask_like");
    channel.say("mia", "grove what is apoli", { gapMs: 60_000 });
    assert.equal(channel.say("mia", "what about origins?", { gapMs: 15_000 }).act, "define.origins");
    channel.say("mia", "grove can you swim", { gapMs: 60_000 });
    assert.equal(channel.say("mia", "what about fly?", { gapMs: 15_000 }).act, "ability.fly");
    channel.say("mia", "grove how is your day", { gapMs: 60_000 });
    assert.match(channel.say("mia", "what about tomorrow?", { gapMs: 15_000 }).text ?? "", /tomorrow|morning/);
  });

  it("names a favorite person, or its family when it has none", () => {
    const family = new Channel().say("mia", "@grove Who is your favourite?");
    assert.equal(family.act, "favorite_person");
    for (const member of ["drizzo", "fld10", "overgrown"] as const) assert.match(family.text ?? "", new RegExp(CREW[member].id));

    const friendly = new Channel();
    for (let i = 0; i < 5; i++) friendly.say("mia", "grove i love you", { gapMs: 60_000 });
    assert.match(friendly.say("mia", "grove who is your favorite", { gapMs: 60_000 }).text ?? "", /you/);
  });

  it("credits drizzo, fld10 and overgrown, and knows them when they talk", () => {
    const credits = new Channel().say("mia", "@grove who made you");
    for (const member of ["drizzo", "fld10", "overgrown"] as const) assert.match(credits.text ?? "", new RegExp(CREW[member].id));
    const asked = new Channel().say("drizzo", "@grove who made you");
    assert.match(asked.text ?? "", /you should know/);
    const remembered = new Channel().say("fld10", "@grove do you remember me");
    assert.match(remembered.text ?? "", /you host me/);
  });

  it("keeps going on its last answer and stands by it", () => {
    const channel = new Channel();
    channel.say("q", "grove tell me a joke");
    assert.equal(channel.say("q", "tell me more", { gapMs: 10_000 }).act, "joke");
    assert.match(channel.say("q", "really?", { gapMs: 10_000 }).text ?? "", /joke/);
  });

  it("explains common words instead of saying it never heard of them", () => {
    const channel = new Channel();
    assert.equal(channel.say("q", "grove what is love").act, "define.love");
    assert.equal(channel.say("q", "grove what is music").act, "define.common");
  });
});

describe("third round of feedback", () => {
  it("answers a silly question that comes with a compliment, thanking first", () => {
    const reply = new Channel().say("ana", "grove ur adorable do u think u'll fit in my 40 different pockets");
    assert.equal(reply.act, "ask_size");
    assert.match(reply.text ?? "", /thank|sweet/);
    assert.match(reply.text ?? "", /40|pocket/);
  });

  it("takes praise for its answer from someone else as praise, not as their news", () => {
    const channel = new Channel();
    const day = channel.say("ben", "@grove How are you today?");
    const praise = channel.say("cat", "wait this is a beautiful response", { replyTo: day.reply!, gapMs: 15_000 });
    assert.equal(praise.act, "compliment");
    assert.doesNotMatch(praise.text ?? "", /love that for you/);
  });

  it("loves the orb of origin and the slimekin", () => {
    const channel = new Channel();
    const guess = channel.say("dee", "grove is your favourite object the orb of origins?");
    assert.equal(guess.act, "favorite_guess");
    assert.match(guess.text ?? "", /orb of origin/);
    assert.doesNotMatch(guess.text ?? "", /namespace/);
    assert.match(channel.say("dee", "grove whats your favourite item", { gapMs: 60_000 }).text ?? "", /orb of origin/);
    assert.match(channel.say("dee", "grove whats your favorite origin", { gapMs: 60_000 }).text ?? "", /slimekin/);
  });

  it("knows what it is: a pure slime, cousin of the slimekin, with a leaf on its head", () => {
    const channel = new Channel();
    const cousins = channel.say("eli", "if slimekin are groves cousins what is grove.");
    assert.equal(cousins.act, "species");
    assert.match(cousins.text ?? "", /cousins/);
    const both = channel.say("eli", "grove If you are a slime what is the leafy part on your head? are you a sub-spieces of slime/plant creature?", { gapMs: 60_000 });
    assert.match(both.text ?? "", /leaf/);
    assert.match(both.text ?? "", /pure slime/);
    assert.match(channel.say("eli", "grove are you a pure slime?", { gapMs: 60_000 }).text ?? "", /pure slime/);
    assert.equal(channel.say("eli", "grove what exactly are you?", { gapMs: 60_000 }).act, "identity");
  });

  it("answers silly grove, where am i, and how it was made", () => {
    const channel = new Channel();
    assert.equal(channel.say("fay", "silly grove").act, "compliment");
    assert.equal(channel.say("fay", "Grove where am i 😨", { gapMs: 60_000 }).act, "where_am_i");
    const made = channel.say("fay", "grove how where you made?", { gapMs: 60_000 });
    assert.equal(made.act, "ask_origin_story");
    for (const member of ["drizzo", "fld10", "overgrown"] as const) assert.match(made.text ?? "", new RegExp(CREW[member].id));
  });
});

describe("silly questions", () => {
  it("knows what it has and doesn't have", () => {
    const channel = new Channel();
    assert.equal(channel.say("gus", "grove do you have feelings").act, "ask_have");
    assert.match(channel.say("gus", "grove do you have pockets", { gapMs: 60_000 }).text ?? "", /pockets/);
    assert.match(channel.say("gus", "grove how many legs do you have", { gapMs: 60_000 }).text ?? "", /no legs/);
    assert.match(channel.say("gus", "grove do you have a family", { gapMs: 60_000 }).text ?? "", new RegExp(CREW.drizzo.id));
  });

  it("is terrified of frogs", () => {
    const channel = new Channel();
    assert.equal(channel.say("hal", "grove are you scared of frogs").act, "ask_fear");
    assert.equal(channel.say("hal", "grove a frog is behind you", { gapMs: 60_000 }).act, "frog_alert");
    assert.match(channel.say("hal", "grove do you hate frogs", { gapMs: 60_000 }).text ?? "", /^yes|so much/);
    assert.match(channel.say("hal", "grove frogs are cute", { gapMs: 60_000 }).text ?? "", /EAT SLIMES/);
  });

  it("knows its crew by name, and who it is talking to", () => {
    assert.match(new Channel().say("ivy", "grove who is drizzo").text ?? "", /drew me/);
    assert.match(new Channel().say("ivy", "grove who is overgrown").text ?? "", /apoli/);
    assert.match(new Channel().say("drizzo", "grove who is drizzo").text ?? "", /that's you/);
  });

  it("knows the time, the day, and its birthday", () => {
    const channel = new Channel();
    assert.match(channel.say("jay", "grove what time is it").text ?? "", /2 pm|2-something pm/);
    assert.match(channel.say("jay", "grove what day is it", { gapMs: 60_000 }).text ?? "", /friday/);
    const birthday = channel.say("jay", "grove when is your birthday", { gapMs: 60_000 }).text ?? "";
    assert.match(birthday, /september 27th/);
    assert.match(birthday, /5 days old/);
  });

  it("shares, does what it is asked, and plays along", () => {
    const channel = new Channel();
    assert.match(channel.say("kai", "grove give me the orb").text ?? "", /orb/);
    assert.equal(channel.say("kai", "grove give me a hug", { gapMs: 60_000 }).act, "give");
    assert.equal(channel.say("kai", "grove say something", { gapMs: 60_000 }).act, "command.say");
    assert.equal(channel.say("kai", "grove tell me a story", { gapMs: 60_000 }).act, "story");
    assert.equal(channel.say("kai", "grove count to 3", { gapMs: 60_000 }).text, "one, two, three!");
    assert.match(channel.say("kai", "grove ping everyone", { gapMs: 60_000 }).text ?? "", /never ping/);
    assert.equal(channel.say("kai", "*puts grove in pocket*", { gapMs: 60_000 }).act, "affection");
    assert.match(channel.say("kai", "grove how do you hold the orb without hands", { gapMs: 60_000 }).text ?? "", /squish/);
  });

  it("imagines things the way a slime would", () => {
    const channel = new Channel();
    assert.match(channel.say("lou", "grove if you could be any origin what would you be").text ?? "", /slimekin/);
    assert.match(channel.say("lou", "grove what would you do if you were human", { gapMs: 60_000 }).text ?? "", /hands/);
    assert.match(channel.say("lou", "grove would you rather be a frog or a cactus", { gapMs: 60_000 }).text ?? "", /neither/);
  });

  it("answers questions typed without a question mark, and guesses at yes or no ones", () => {
    const channel = new Channel();
    assert.equal(channel.say("max", "grove what do you taste like").act, "ask_body");
    assert.equal(channel.say("max", "grove is lava hot?", { gapMs: 60_000 }).act, "question.guess");
    assert.equal(channel.say("max", "grove is water wet?", { gapMs: 60_000 }).act, "dumb_question");
    assert.match(channel.say("max", "grove are you better than carl bot", { gapMs: 60_000 }).text ?? "", /carl-bot/);
    assert.equal(channel.say("max", "grove you're my favorite", { gapMs: 60_000 }).act, "love");
    assert.match(channel.say("max", "grove i got a new dog", { gapMs: 60_000 }).text ?? "", /dog/);
  });
});

describe("fourth round of feedback", () => {
  it("gets excited about fans and their posters", () => {
    const reply = new Channel().say("kit", "grove im your biggest fan im going to put posters of you all over the streets of england");
    assert.equal(reply.act, "fan");
    assert.match(reply.text ?? "", /posters/);
    assert.match(reply.text ?? "", /england/);
    assertGroveVoice(reply.text);
    const channel = new Channel();
    assert.match(channel.say("kit", "grove can i have your autograph").text ?? "", /splat|signs/);
    assert.equal(channel.say("kit", "grove i'm a big fan of slimekin", { gapMs: 60_000 }).act, "fan_of");
  });

  it("can't do homework, but cheers and helps with the math", () => {
    const channel = new Channel();
    const asked = channel.say("kit", "grove can do my homework");
    assert.equal(asked.act, "homework");
    assert.match(asked.text ?? "", /homework|hands|sticky/);
    const help = channel.say("kit", "grove can you help me with my homework", { gapMs: 60_000 });
    assert.equal(help.decision?.meta.expectation?.kind, "homework_subject");
    const subject = channel.say("kit", "its math", { gapMs: 10_000 });
    assert.match(subject.text ?? "", /math|problem/);
    assert.equal(channel.say("kit", "grove whats 12 times 12", { gapMs: 10_000 }).text?.includes("144"), true);
  });

  it("does the math it was asked, in words or symbols", () => {
    const channel = new Channel();
    assert.match(channel.say("kit", "grove whats 24 divided by 5").text ?? "", /4\.8/);
    assert.match(channel.say("kit", "grove what is 20 time 30", { gapMs: 60_000 }).text ?? "", /600/);
    assert.match(channel.say("kit", "whats 50*(12+8) grove", { gapMs: 60_000 }).text ?? "", /1000/);
    assert.match(channel.say("kit", "grove solve 2x + 3 = 7", { gapMs: 60_000 }).text ?? "", /x (=|is) 2/);
    assert.match(channel.say("kit", "grove is 7 x 8 54?", { gapMs: 60_000 }).text ?? "", /56/);
    assert.equal(channel.say("kit", "grove i rate it 10/10", { gapMs: 60_000 }).act === "math", false);
  });

  it("explains dumb questions and answers them dumbly", () => {
    const channel = new Channel();
    const explained = channel.say("kit", "grove what are dumb questions");
    assert.equal(explained.act, "dumb_question");
    assert.match(explained.text ?? "", /\?/);
    const microwave = channel.say("kit", "grove Why is there a zero button on the microwave? I mean, who is heating their food for zero seconds?", { gapMs: 60_000 });
    assert.equal(microwave.act, "dumb_question");
    assert.match(microwave.text ?? "", /slime|beep/);
    assert.equal(channel.say("kit", "grove is a hot dog a sandwich?", { gapMs: 60_000 }).act, "dumb_question");
    const mine = channel.say("kit", "grove ask me a dumb question", { gapMs: 60_000 });
    assert.equal(mine.decision?.meta.expectation?.kind, "dumb_answer");
    assert.equal(channel.say("kit", "obviously the puddle is taking a slime", { gapMs: 10_000 }).act, "dumb_question");
    const worried = channel.say("kit", "grove sorry if this is a dumb question but how do i install origins", { gapMs: 60_000 });
    assert.equal(worried.act, "install");
    assert.match(worried.text ?? "", /dumb/);
  });

  it("answers what commands it has with the !help list", () => {
    const reply = new Channel().say("kit", "grove can u tell me some commands you have?");
    assert.equal(reply.act, "commands");
    assert.equal(reply.decision?.command, "help");
    assert.equal(new Channel().say("kit", "grove how do i use the /power command").decision?.command ?? null, null);
  });

  it("knows its d&d, where slimes are oozes", () => {
    const channel = new Channel();
    const favorite = channel.say("kit", "grove what's your favourite D&D class?");
    assert.equal(favorite.act, "fantasy.favorite");
    assert.match(favorite.text ?? "", /druid/);
    assert.match(channel.say("kit", "grove are there slimes in dnd", { gapMs: 60_000 }).text ?? "", /ooze/);
    assert.match(channel.say("kit", "grove can a druid wild shape into a slime", { gapMs: 60_000 }).text ?? "", /beasts/);
    assert.match(channel.say("kit", "grove what is a gelatinous cube", { gapMs: 60_000 }).text ?? "", /cube/);
    assert.match(channel.say("kit", "grove roll 2d6", { gapMs: 60_000 }).text ?? "", /2d6/);
    assert.equal(channel.say("kit", "grove i'm on dnd rn", { gapMs: 60_000 }).act === "fantasy", false);
  });

  it("keeps politics out, with oranges", () => {
    const trump = new Channel().say("kit", "Grove, what is your opinion of US president Donald Trump?");
    assert.equal(trump.act, "politics");
    assert.match(trump.text ?? "", /orange/);
    assert.doesNotMatch(trump.text ?? "", /trump|president/i);
    const vote = new Channel().say("kit", "grove who should i vote for");
    assert.equal(vote.act, "politics");
    assert.doesNotMatch(vote.text ?? "", /orange/);
  });

  it("plays along with slang the way it was used", () => {
    const channel = new Channel();
    assert.match(channel.say("kit", "grove are you mewing").text ?? "", /jaw|shh/);
    assert.match(channel.say("kit", "grove do you mew", { gapMs: 60_000 }).text ?? "", /jaw|shh/);
    assert.match(channel.say("kit", "Grove can you hit the griddy for me", { gapMs: 60_000 }).text ?? "", /griddy/);
    assert.match(channel.say("kit", "grove do you mog", { gapMs: 60_000 }).text ?? "", /mog/);
    assert.match(channel.say("kit", "grove what does rizz mean", { gapMs: 60_000 }).text ?? "", /charm/);
    assert.match(channel.say("kit", "grove what does gyatt mean", { gapMs: 60_000 }).text ?? "", /shouldn't ask|pretend/);
    assert.deepEqual(new Channel().say("kit", "grove has so much rizz").decision?.reactions, [EMOJI.heart]);
  });

  it("stays out of it when nobody is talking to it", () => {
    for (const text of ["im your biggest fan", "whats 24 divided by 5", "who should i vote for", "can you do my homework", "are you mewing", "whats your favourite dnd class"]) {
      assert.equal(new Channel().say("kit", text).decision, null, text);
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
      "grove do you have pockets", "grove what time is it", "grove who is drizzo", "grove give me the orb", "grove say something",
      "grove a frog is behind you", "grove when is your birthday", "grove what do you look like", "grove fight me",
      "grove im your biggest fan", "grove do my homework", "grove whats 24 divided by 5", "grove what are dumb questions",
      "grove what's your favourite dnd class", "grove what do you think of trump", "grove are you mewing", "grove hit the griddy",
      "grove do you mog", "grove what is a nat 20", "grove is cereal soup?", "grove roll for initiative",
    ];
    for (let seed = 1; seed <= 12; seed++) {
      const channel = new Channel({ seed });
      for (const line of lines) assertGroveVoice(channel.say(`user${seed}`, line, { gapMs: 90_000 }).text);
    }
  });
});
