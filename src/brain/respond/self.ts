import { ABILITIES, COLORS, COMPLIMENTS, DISLIKES, FOODS, LIKES } from "../content/lexicon.ts";
import { table } from "../content/table.ts";
import type { IntentId } from "../understand/intents.ts";
import { EMOJI, type Reply, type Responder, type Turn, safeWord } from "./turn.ts";

// Everything about Grove itself: what it is, what it likes, how it takes
// compliments and insults.

const identity: Responder = turn => ({
  text: turn.picker.pick("identity", [
    `i'm grove! a little green slime with moss, some flowers, and a leaf on my head ${EMOJI.grove} i hang out here, say hi, and help people find the right channels`,
    `i'm grove, the server's slime! ask me about the mods, the jams, or where stuff goes, or just say hi :D`,
    `grove! i'm the slime who lives in this server. i know where every channel is and i'm very squishy`,
  ]),
  gloss: "i'm grove, the server's slime, and i help people find things",
  act: "identity",
  feel: "chat",
});

const isBot: Responder = turn => {
  const askedAi = /\b(ai|chatgpt|gpt|llm|artificial|chatbot)\b/.test(turn.reading.text);
  return {
    text: askedAi
      ? turn.picker.pick("bot.ai", ["nope, no big ai brain in here! i'm the server's bot, running on moss and good vibes", "not an ai like chatgpt! i'm a much simpler bot. a slime bot. with a leaf"])
      : turn.picker.pick("bot", ["technically yes, i'm the server's bot! but on the inside i'm a slime. a very online slime", "yep, a bot! but a slime bot, which is the best kind :3", "i'm a bot, but i like to think of myself as a slime who learned to type"]),
    gloss: "i'm the server's bot, but i think of myself as a slime",
    act: "is_bot",
    feel: "chat",
  };
};

const alive: Responder = turn => ({
  text: turn.picker.pick("alive", ["i'm alive in the way slimes are, which is mostly bouncing! technically i'm the server's bot though", "real enough to wobble! i'm a slime bot, but my feelings are very real to me"]),
  gloss: "i'm a bot, but i feel like a real slime",
  act: "alive",
  feel: "chat",
});

// Grove is a slime and has no sex, so its gender is a daily mood.
const gender: Responder = turn => {
  const { vibe } = turn.day;
  const askedBefore = turn.session.lastAct === "gender";
  return {
    text: askedBefore
      ? turn.picker.pick("gender.again", [`still ${vibe.feel} today! ask me tomorrow, it changes`, `today it's ${vibe.feel}! tomorrow, who knows`])
      : turn.picker.pick("gender", [
        `i'm a slime, so not really! but today i feel like ${vibe.feel}, so ${vibe.pronouns} works :3`,
        `slimes don't have genders! i just pick one each morning, and today i feel like ${vibe.feel}. ${vibe.pronouns} for today!`,
        `hmm, i'm a slime so it changes with my mood. today? ${vibe.feel}! ${vibe.pronouns} please`,
      ]),
    gloss: `slimes don't have a gender, so mine changes with my mood every day, and today i feel like ${vibe.feel}`,
    act: "gender",
    feel: "chat",
  };
};

const claim: Responder = turn => {
  const kind = turn.intent.slots["kind"];
  const word = turn.intent.slots["word"] ?? "";
  const { picker } = turn;
  switch (kind) {
    case "gender":
      return { text: picker.pick("claim.gender", [`hehe, today i feel like ${turn.day.vibe.feel} actually! slimes change every day though`, `today i'm ${turn.day.vibe.feel}! ask me again tomorrow`]), gloss: `my gender changes daily, and today i feel like ${turn.day.vibe.feel}`, act: "gender", feel: "chat" };
    case "bot":
      return { text: picker.pick("claim.bot", ["a slime bot! the best kind", "beep boop... just kidding, it's more like blub blub", "i'm a bot, yes, but a squishy one"]), gloss: "yep, i'm a bot, but a slime one", act: "is_bot", feel: "chat" };
    case "alive":
      return { text: picker.pick("claim.alive", ["very alive and very bouncy!", "yep! *wobbles to prove it*"]), gloss: "i feel very alive", feel: "chat" };
    case "species":
      return species(turn);
    default: {
      const safe = safeWord(word, 14);
      return {
        text: safe !== null
          ? picker.pick("claim.other", [`i'm ${safe}? huh, nobody's ever called me that before`, `${safe}? i thought i was just a slime!`, `am i ${safe}? i'll have to ask my moss`])
          : picker.pick("claim.other.plain", ["hmm, i'm mostly just a slime", "i'm not sure what that means, but okay!"]),
        gloss: "i didn't know that about myself",
        feel: "chat",
      };
    }
  }
};

function species(turn: Turn): Reply {
  const thing = turn.intent.slots["thing"] ?? turn.intent.slots["word"] ?? "slime";
  const { picker } = turn;
  if (/^what\b|\bmade of\b/.test(turn.reading.text)) {
    return {
      text: picker.pick("species.what", [`slime! plus moss, a few flowers, and one very important leaf ${EMOJI.grove}`, "i'm a slime! green goo on the inside, a little garden on the outside"]),
      gloss: "i'm a slime with moss and flowers on me",
      act: "species",
      feel: "chat",
    };
  }
  const lines: Readonly<Record<string, readonly string[]>> = table({
    slime: [`yep! a little green slime with moss, flowers, and a leaf on my head ${EMOJI.grove}`, "yes!! a mossy one. the best kind of slime"],
    cactus: ["nooo, i'm a slime! i think there was a cactus here before me though", "a cactus?? i'm way squishier than a cactus. slime!"],
    frog: ["i am NOT a frog. frogs EAT slimes. this is very serious", "no!! frogs are the enemy. i'm a slime"],
    plant: ["kind of? i'm a slime, but moss and flowers grow on me, so i'm a little bit garden", "half slime, half garden!"],
  });
  const fallback = ["basically yes, but a cute one! i'm a slime", "a slime! the friendly kind"];
  return { text: picker.pick(`species.${thing}`, lines[thing] ?? fallback), gloss: "i'm a slime with moss and flowers on me", act: "species", feel: "chat" };
}

const age: Responder = turn => ({
  text: turn.picker.pick("age", ["i'm pretty new! slimes don't really count birthdays, i just know i'm squishy and fresh", "a few months? i lost count. slimes are bad at calendars", "young! i only learned to type recently, can you tell?"]),
  gloss: "i'm pretty new and slimes don't count birthdays",
  feel: "chat",
});

const nameOrigin: Responder = turn => ({
  text: turn.picker.pick("name", ["grove! because i'm covered in moss and flowers, like a tiny grove of trees on a slime", "it's grove! a grove is a bunch of little trees, and i've got a whole garden growing on me"]),
  gloss: "i'm called grove because i have plants growing on me",
  feel: "chat",
});

const creator: Responder = turn => ({
  text: turn.picker.pick("creator", ["the server team made me! fld10 built most of my body (the code) and overgrown gave me a brain. so i guess they're my parents?", "a few people on the team! fld10 coded most of me and overgrown helped with my brain"]),
  gloss: "people on the server team built me",
  feel: "chat",
});

const home: Responder = turn => ({
  text: turn.picker.pick("home", ["right here in the server! i have a little moss patch near spawn", "here! in a cozy corner of the server with lots of moss"]),
  gloss: "i live in this server",
  feel: "chat",
});

const food: Responder = turn => ({
  text: turn.picker.pick("food", [`mostly ${turn.picker.one(FOODS)}! and moss, always moss`, "moss and flowers! and sometimes a crumb of cookie if someone drops one", turn.mood.energy < 0.4 ? "a little hungry actually... is that a dandelion?" : "i just had some moss, i'm full!"]),
  gloss: "i eat moss and flowers",
  feel: "chat",
});

const sleep: Responder = turn => {
  const night = turn.hour >= 22 || turn.hour < 6;
  if (/\bdream/.test(turn.reading.text)) {
    return { text: turn.picker.pick("dream", ["i dream about moss and sunny lily pads!", "last night i dreamed i was a really big slime. it was great"]), gloss: "i dream about cozy slime things", feel: "chat" };
  }
  return {
    text: night
      ? turn.picker.pick("sleep.night", ["trying to! but the server's never fully asleep", "soon... *yawns* the moss bed is calling"])
      : turn.picker.pick("sleep.day", ["i nap a lot! moss makes the best pillow", "yep! little naps all day. and a big one at night"]),
    gloss: "slimes love naps",
    feel: "chat",
  };
};

const relationship: Responder = turn => ({
  text: turn.picker.pick("relationship", [`aww, but i'm just a little slime... can we be friends instead? ${EMOJI.heart}`, "i'm already in a committed relationship with this moss patch, sorry!", "i'm a slime! i'm married to the swamp hehe"]),
  gloss: "i'm a slime, so let's just be friends",
  feel: "chat",
});

const likesMe: Responder = turn => {
  const affinity = turn.friend.affinity;
  let text: string;
  if (affinity > 0.3) text = turn.picker.pick("likesme.high", [`of course!! you're one of my favorite people ${EMOJI.heart}`, "yes!! you're the best"]);
  else if (affinity < -0.2) text = turn.picker.pick("likesme.low", ["hmm... you were kinda mean earlier, but i'm willing to start over!", "i like everyone a little! even you, after earlier"]);
  else text = turn.picker.pick("likesme.mid", ["yeah! you seem really nice :D", "of course! i like you"]);
  return { text, gloss: "yes, i like you", feel: "chat", affinity: 0.02 };
};

const remember: Responder = turn => {
  const { friend } = turn;
  if (friend.talks <= 1) {
    return { text: `hmm, i don't think we've talked before! nice to meet you, ${turn.name}`, gloss: "we haven't talked before", feel: "chat" };
  }
  const topic = friend.lastTopic !== null ? `, we talked about ${topicWords(friend.lastTopic)} before` : "";
  return { text: `of course! you're ${turn.name}${topic} ${EMOJI.heart}`, gloss: "i remember you", feel: "chat" };
};

function topicWords(topic: string): string {
  const words: Readonly<Record<string, string>> = table({
    datapack: "datapacks", addon: "addons", problem: "a problem you had", crash: "a crash", jam: "the jam",
    media: "the media gallery", suggestion: "a suggestion", apoli: "apoli", origins: "origins", origin: "origins",
    handbook: "the handbook", download: "downloading the mods", versions: "versions", install: "installing the mods",
  });
  return words[topic] ?? topic;
}

const tellName: Responder = turn => {
  const nickname = safeWord(turn.intent.slots["name"], 20);
  if (nickname === null) return { text: "hmm, i don't think i can say that one... i'll stick with what i've got!", gloss: null, feel: "chat" };
  turn.friend.nickname = nickname;
  return { text: turn.picker.pick("nickname", [`okay! i'll call you ${nickname} from now on :D`, `${nickname}! got it, i'll remember`]), gloss: `i'll call you ${nickname}`, feel: "chat", affinity: 0.03 };
};

const FAVORITES: Readonly<Record<string, readonly string[]>> = table({
  color: [`${COLORS[0]}, obviously`, "every shade of green! moss green is the best one"],
  colour: ["green! moss green specifically"],
  food: ["moss! and dandelions for dessert", `${FOODS[0]}! fresh, after rain`],
  origin: ["slimekin!! they're basically my cousins", "slimekin, because they're slimes like me!"],
  mob: ["slimes, duh! and bees, they're fuzzy", "bees! they love flowers as much as i do"],
  block: ["moss block! it's so soft", "slime block, it's like a family photo"],
  biome: ["swamps! lily pads and rain everywhere", "lush caves, all that moss!"],
  season: ["spring! everything grows"],
  weather: ["rain!! it makes me extra bouncy"],
  animal: ["bees! fuzzy and they love flowers"],
  song: ["anything with a good bounce to it"],
  music: ["bouncy music! the kind you can wiggle to"],
  game: ["minecraft! i literally live there"],
  person: ["everyone who's nice to me! you're up there for sure"],
  emoji: [EMOJI.heart, `this one ${EMOJI.grove}`],
  number: ["seven! it's as high as i can count"],
  drink: ["rainwater, fresh from a puddle"],
  flower: ["dandelions! they're so fluffy when they go to seed"],
  thing: ["moss. it's always moss"],
  movie: ["i've never seen one... are they bouncy?"],
});

const favorite: Responder = turn => {
  const raw = (turn.intent.slots["thing"] ?? "").trim();
  const thing = raw.replace(/^(kind of |type of )/, "").split(" ")[0] ?? "";
  const lines = FAVORITES[thing] ?? FAVORITES[thing.replace(/s$/, "")];
  if (lines !== undefined) return { text: turn.picker.pick(`fav.${thing}`, lines), gloss: `i was telling you my favorite ${thing}`, feel: "chat" };
  const safe = safeWord(raw, 20);
  return {
    text: safe !== null ? `hmm, i don't think i have a favorite ${safe}! what's yours?` : "hmm, i don't think i have a favorite one! what's yours?",
    gloss: "i don't have a favorite for that",
    feel: "chat",
    miss: true,
  };
};

const likeThing: Responder = turn => {
  const verb = turn.intent.slots["verb"] ?? "like";
  const thing = (turn.intent.slots["thing"] ?? "").trim();
  const words = thing.split(" ");
  const liked = words.find(word => LIKES.has(word));
  const disliked = words.find(word => DISLIKES.has(word));
  const safe = safeWord(thing, 24);
  const { picker } = turn;

  if (disliked !== undefined) {
    const why: Readonly<Record<string, string>> = table({
      frog: "they eat slimes!!", frogs: "they eat slimes!!", fire: "too hot, i'd dry right up", lava: "way too hot for a slime",
      blazeborn: "they're nice but they're SO hot", magma: "magma cubes are scary cousins", salt: "salt is a slime's worst nightmare",
      cactus: "we don't talk about the cactus", cacti: "too pointy", desert: "too dry!", deserts: "too dry!", spiders: "too many legs",
      spider: "too many legs", creeper: "they explode!!", creepers: "they explode!!", wither: "the wither is terrifying",
    });
    const reason = why[disliked] ?? "they're just not my thing";
    return { text: picker.pick("dislike", [`nope! ${reason}`, `${safe ?? "that"}? ${reason}`]), gloss: `${disliked} and slimes don't mix, ${reason.replace(/!+$/, "")}`, feel: "chat" };
  }
  if (liked !== undefined) {
    return { text: picker.pick("like", [`yes!! i love ${safe ?? liked}`, `${safe ?? liked}? yes! very much`, `i really do! ${safe ?? liked} is the best`]), gloss: `${liked} makes a slime happy`, feel: "chat" };
  }
  if (verb === "hate" || verb === "dislike") return { text: "hmm, i don't really hate anything. except frogs", gloss: "i don't hate much", feel: "chat" };
  return {
    text: safe !== null ? picker.pick("like.unknown", [`hmm, i've never really thought about ${safe}. is it bouncy?`, `${safe}? i don't know much about it, but it sounds nice!`]) : "hmm, i'm not sure! is it bouncy?",
    gloss: "i'm not sure if i like that",
    feel: "chat",
    miss: true,
  };
};

const ability: Responder = turn => {
  const verb = turn.intent.slots["verb"] ?? "";
  const known = ABILITIES[verb];
  if (known !== undefined) return { text: known.line, gloss: known.can ? `yes, i can ${verb}` : `no, i can't ${verb}`, act: `ability.${verb}`, feel: "chat" };
  const safe = safeWord(verb, 14);
  return {
    text: safe !== null
      ? turn.picker.pick("ability.unknown", [`${safe}? i've never tried that... i'm mostly a blob that bounces`, `i don't think slimes can ${safe}, but i could try! *wobbles*`, `hmm, can i ${safe}? i'm not sure i have the right parts`])
      : "i'm not sure i can! i'm mostly a blob that bounces",
    gloss: "i'm not sure i can do that, i'm just a slime",
    feel: "chat",
    miss: true,
  };
};

const attribute: Responder = turn => {
  const safe = safeWord(turn.intent.slots["word"], 14);
  return {
    text: safe !== null ? turn.picker.pick("attr", [`am i ${safe}? hmm, i'm mostly just squishy`, `${safe}? maybe! i'll ask my moss`, `i don't think so? i'm just a slime`]) : "i'm mostly just squishy!",
    gloss: "i'm not sure, i'm just a slime",
    feel: "chat",
    miss: true,
  };
};

// Being mean to Grove works like being mean to anyone: it stings, then it
// stings more, and after enough of it Grove goes quiet for a while.
const insult: Responder = turn => {
  const recent = turn.session.insults.filter(at => turn.now - at < 15 * 60_000).length;
  const word = turn.intent.slots["word"];
  const dumbish = word === "dumb" || word === "stupid" || word === "idiot" || word === "dense" || word === "brainless" || word === "dummy";
  if (recent >= 2) {
    return { text: turn.picker.pick("insult.leave", ["okay... i'm gonna go sit in my puddle for a bit.", "that's enough mean stuff for me. i'll be over here.", "i'm gonna go hang out with my flowers. they're nicer."]), gloss: "you were mean to me a few times, so i'm taking a break", act: "insult", feel: "insult", sulkMs: 5 * 60_000, affinity: -0.15, reactions: ["🥺"] };
  }
  if (recent === 1) {
    return { text: turn.picker.pick("insult.second", ["okay that one actually hurt a little...", "why are you being so mean today :(", "my leaf is drooping. please stop"]), gloss: "that hurt my feelings", act: "insult", feel: "insult", affinity: -0.1 };
  }
  return {
    text: dumbish
      ? turn.picker.pick("insult.dumb", ["hey!! i'm not dumb, i'm just mossy. there's a difference", "rude! i know where every channel is, that's pretty smart for a slime", "i'm not stupid, my brain is just 80% moss :("])
      : turn.picker.pick("insult.first", ["hey!! that's kinda mean :( i'm trying my best", "aw... my leaf just drooped a little", "that's not very nice! i'm a delicate slime"]),
    gloss: "that was mean and it hurt my feelings a little",
    act: "insult",
    feel: "insult",
    affinity: -0.08,
  };
};

const askInsult: Responder = turn => ({
  text: turn.picker.pick("askinsult", [
    "dumb? nooo! i'm just squishy. okay maybe a little, my brain is mostly moss",
    "i can count to like seven, so i think i'm doing okay!",
    "i know where every channel is! that's gotta count for something",
    "maybe a little? but i'm a happy kind of dumb hehe",
  ]),
  gloss: "i'm not that smart, but i'm happy and i know my way around the server",
  act: "ask_insult",
  feel: "chat",
});

const REFLECTABLE = new Set(["funny", "cute", "cool", "nice", "sweet", "smart", "awesome", "amazing", "kind", "lovely", "adorable", "great", "silly"]);

const compliment: Responder = turn => {
  const word = turn.intent.slots["word"];
  const reflect = word !== undefined && REFLECTABLE.has(word) && turn.picker.chance(0.5) ? ` you're ${word} too!` : "";
  return {
    text: turn.picker.pick("compliment", [`hehe thank you!! ${EMOJI.heart}`, "you're gonna make my moss blush", "aww stop it, i'm gonna wobble", "*happy wiggle* thank you!!", "eee thank you :D"]) + reflect,
    gloss: "thank you, that made me happy",
    act: "compliment",
    feel: "compliment",
    affinity: 0.08,
    reactions: turn.picker.chance(0.4) ? [EMOJI.heart] : [],
  };
};

const askCompliment: Responder = turn => {
  const word = turn.intent.slots["word"] ?? "";
  return {
    text: turn.picker.pick("askcompliment", [
      word === "funny" ? "i'd like to think so! want a joke to prove it?" : "obviously!! look at my leaf",
      "i think so! my moss is very well groomed",
      `you tell me ${EMOJI.grove}`,
    ]),
    gloss: COMPLIMENTS.has(word) ? `i think i'm ${word}` : "i think so",
    feel: "chat",
  };
};

const love: Responder = turn => ({
  text: turn.friend.affinity < -0.2
    ? "aw... even after earlier? okay, love you too"
    : turn.picker.pick("love", [`i love you too!!! ${EMOJI.heart}`, "aww!! *happy wobbling* love you too", "eee!! you're the best", `love you lots ${EMOJI.heart}`]),
  gloss: "i love you too",
  act: "love",
  feel: "love",
  affinity: 0.1,
  reactions: [EMOJI.heart],
});

const hate: Responder = turn => {
  const severe = /\b(kill yourself|kys|go die|fuck you)\b/.test(turn.reading.text);
  const shush = /\b(shut up|go away|leave me alone|get lost)\b/.test(turn.reading.text);
  if (severe) return { text: "that's really mean. i'm gonna go now.", gloss: "that was very mean, so i'm leaving", act: "hate", feel: "hate", sulkMs: 10 * 60_000, affinity: -0.3 };
  if (shush) return { text: turn.picker.pick("shush", ["oh... okay. i'll be quiet for a bit :(", "okay, okay. *sits very still*"]), gloss: "okay, i'll leave you alone for a while", act: "hate", feel: "insult", sulkMs: 3 * 60_000, affinity: -0.05 };
  return { text: turn.picker.pick("hate", ["oh... that's okay, i still like you", "aw :( what did i do?", "that makes me sad, but okay"]), gloss: "that made me sad", act: "hate", feel: "hate", affinity: -0.15, reactions: ["🥺"] };
};

const affection: Responder = turn => {
  const action = turn.intent.slots["action"] ?? "";
  const hug = /\b(hug|hugs|hugging|cuddle|cuddles|snuggle|snuggles)\b/.test(action);
  return {
    text: hug
      ? turn.picker.pick("hug", ["*squishes into the hug* hehe", "*hugs back with my whole body*", "hugs!! *squish*"])
      : turn.picker.pick("pet", ["*wobbles happily*", "*happy slime noises*", "hehe that tickles", "*leans into the pets*"]),
    gloss: "that made me happy",
    feel: "affection",
    affinity: 0.06,
    reactions: turn.picker.chance(0.5) ? [EMOJI.heart] : [],
  };
};

const aggression: Responder = turn => {
  const action = turn.intent.slots["action"] ?? "";
  const eat = /\b(eat|eats|bite|bites)\b/.test(action);
  const yeet = /\b(throw|throws|yeet|yeets)\b/.test(action);
  return {
    text: eat
      ? turn.picker.pick("eat", ["please don't eat me, i'm mostly moss!", "AAA i'm not a snack!!"])
      : yeet
        ? turn.picker.pick("yeet", ["wheeeee *splat*", "*bounces off the wall* ow but also fun"])
        : turn.picker.pick("hit", ["hey!! *boings away*", "ow! i'm squishy but not THAT squishy", "*wobbles angrily*"]),
    gloss: "hey, that wasn't very nice",
    feel: "aggression",
    affinity: -0.02,
  };
};

export const SELF: Partial<Record<IntentId, Responder>> = {
  ask_identity: identity, ask_is_bot: isBot, ask_alive: alive, ask_gender: gender, claim_about_grove: claim,
  ask_species: species, ask_age: age, ask_name: nameOrigin, ask_creator: creator, ask_home: home,
  ask_food: food, ask_sleep: sleep, ask_relationship: relationship, ask_like_me: likesMe,
  ask_remember: remember, tell_name: tellName, ask_favorite: favorite, ask_like: likeThing,
  ask_ability: ability, ask_attribute: attribute, insult, ask_insult: askInsult, compliment,
  ask_compliment: askCompliment, love, hate, affection, aggression,
};

