import type { CrewMember } from "../../config.ts";
import { ABILITIES, COLORS, COMPLIMENTS, DISLIKES, FOODS, LIKES, PET_NAMES } from "../content/lexicon.ts";
import {
  ageWords, BELONGINGS, BODY_PARTS, CREW_ROLES, crewMemberById, crewTag, DISLIKE_REASONS, FUN_FACTS, GROVE_BIRTHDAY, HOW_GROVE, JOKES,
  LORE, STORIES, TRAITS,
} from "../content/knowledge.ts";
import { table } from "../content/table.ts";
import type { IntentId } from "../understand/intents.ts";
import { dayOffsetIn, displayName, EMOJI, type Reply, type Responder, type Turn, safeWord } from "./turn.ts";

// Everything about Grove itself: what it is, what it likes, how it takes
// compliments and insults.

const identity: Responder = turn => /\b(job|purpose|role|work|for a living|what are you for|why do you exist)\b/.test(turn.reading.text) ? {
  text: turn.picker.pick("identity.job", [
    "i'm the server's slime! i say hi, help people find the right channel, pass dms to the staff, and keep the orb of origin shiny. i get paid in moss",
    `official greeter and channel finder! also part-time orb polisher ${EMOJI.orb}`,
  ]),
  gloss: "my job is saying hi and helping people find the right channels",
  act: "identity",
  feel: "chat",
} : ({
  text: turn.picker.pick("identity", [
    `i'm grove! a pure slime with a tiny garden growing on my head: moss, some flowers, and a leaf ${EMOJI.grove} i live here, say hi, and help people find the right channels`,
    `i'm grove, the server's slime! a real bouncy slime, just a mossy one. ask me about the mods, the jams, or where stuff goes, or just say hi :D`,
    `grove! the slime who lives in this server. i know where every channel is, i'm very squishy, and there's a leaf on my head`,
  ]),
  gloss: "i'm grove, the server's slime, and i help people find things",
  act: "identity",
  feel: "chat",
});

const isBot: Responder = turn => {
  if (/\b(controls|controlled|runs|types for|speaks for|is behind|typing|talking for|writes for|real person)\b/.test(turn.reading.text)) {
    return {
      text: turn.picker.pick("bot.control", [
        "nobody! it's just me, a slime and a lot of code. the staff can make me say things with !say, but everything else is all me",
        "no humans in here, i promise! overgrown taught me how to talk, and now i do it myself. fld10 just keeps me fed",
      ]),
      gloss: "nobody types for me, i'm a bot, except when staff use !say",
      act: "is_bot",
      feel: "chat",
    };
  }
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
  const offset = dayOffsetIn(turn.reading.text);
  if (offset === -1) {
    const before = turn.dayAt(-1).vibe;
    return { text: turn.picker.pick("gender.yesterday", [`yesterday i was ${before.feel}! today's different though`, `yesterday? ${before.feel}, ${before.pronouns}. it changes every morning`]), gloss: `yesterday i felt like ${before.feel}`, act: "gender", feel: "chat" };
  }
  if (offset === 1) {
    const next = turn.dayAt(1).vibe;
    return {
      text: turn.picker.pick("gender.tomorrow", [
        "tomorrow? no idea yet! i pick when i wake up, so ask me then",
        `hmm, i won't know until i wake up... but i have a feeling it might be ${next.feel}`,
        "that's tomorrow-me's business! i'll find out in the morning",
      ]),
      gloss: "i don't know yet, i pick a new one every morning",
      act: "gender",
      feel: "chat",
    };
  }
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
      const trait = TRAITS[word];
      if (trait !== undefined) return { text: trait, gloss: `i was telling you if i'm ${word}`, act: "ask_attribute", feel: "chat" };
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
  const text = turn.reading.text;
  if (/\b(slimekin|cousins?)\b/.test(text)) {
    return { text: picker.pick("species.cousins", [LORE.cousins, `${LORE.cousins}. we wave at each other a lot`]), gloss: "slimekin are slime people and i'm a pure slime, so we're cousins", act: "species", feel: "chat" };
  }
  if (/\b(sub species|subspecies|pure slime|real slime|normal slime|full slime|part plant|half plant|plant creature|plant slime|slime plant|species|kind of slime|type of slime)\b/.test(text)) {
    return {
      text: picker.pick("species.pure", [`${LORE.species}. the plants don't make me a plant, they're just along for the ride`, `pure slime, through and through! the moss and flowers just moved in on their own`]),
      gloss: "i'm a pure slime with plants growing on me, not a plant creature",
      act: "species",
      feel: "chat",
    };
  }
  if (/^what\b|\bmade of\b/.test(text)) {
    return {
      text: picker.pick("species.what", [`slime! green goo all the way through, plus a little garden on top: moss, flowers and one very important leaf ${EMOJI.grove}`, "i'm a slime! green goo on the inside, a little garden on the outside"]),
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

// Grove's birthday is the day its first code was written.
const age: Responder = turn => {
  const old = ageWords(turn.now);
  const text = turn.reading.text;
  const { picker } = turn;
  const gloss = `my birthday is ${GROVE_BIRTHDAY.said}, so i'm ${old}`;
  const birthdayToday = GROVE_BIRTHDAY.said.startsWith(turn.calendar.month) && turn.calendar.date === GROVE_BIRTHDAY.day && turn.calendar.year > GROVE_BIRTHDAY.year;
  if (birthdayToday) return { text: `today!! it's my birthday! i'm ${old} *party wobble*`, gloss, act: "ask_age", feel: "chat" };
  if (/\b(birthday|born|made|created)\b/.test(text)) {
    return {
      text: picker.pick("age.birthday", [`${GROVE_BIRTHDAY.said}! that's when drizzo wrote my very first code. so i'm ${old}`, `my birthday is ${GROVE_BIRTHDAY.said}, the day my first code was written! that makes me ${old}`]),
      gloss,
      act: "ask_age",
      feel: "chat",
    };
  }
  if (/\b(young|baby|new|newborn)\b/.test(text)) return { text: `very! i'm only ${old}. a baby slime`, gloss, act: "ask_age", feel: "chat" };
  if (/\b(old|ancient)\b/.test(text) && !/\bhow old\b/.test(text)) return { text: `nope! i'm only ${old}. a baby slime`, gloss, act: "ask_age", feel: "chat" };
  return {
    text: picker.pick("age", [`i'm ${old}! my first code was written on ${GROVE_BIRTHDAY.said}`, `only ${old}! i'm a baby slime, still learning how to type`]),
    gloss,
    act: "ask_age",
    feel: "chat",
  };
};

const nameOrigin: Responder = turn => {
  const text = turn.reading.text;
  const { picker } = turn;
  if (/\bcact(us|i|uses)\b/.test(text)) {
    if (/\b(were you|was grove|used to be|was your name|were you called|were you named|old name|change your name|changed your name|renamed)\b/.test(text)) {
      return { text: "nope, never! a cactus lived here before me, but i've always been a slime. way less pointy", gloss: "a cactus lived here before me, but i've always been grove", act: "ask_name", feel: "chat" };
    }
    if (/\b(what happened|where is|where did|where are|rip|miss|bring back|come back|gone|dead|died|left)\b/.test(text)) {
      return { text: "i think the cactus moved to a desert somewhere! it's happier there. way too dry for me though", gloss: "the cactus moved away and now i live here", act: "ask_name", feel: "chat" };
    }
    return { text: LORE.cactus, gloss: "a cactus lived here before me", act: "ask_name", feel: "chat" };
  }
  if (/\bwho named you\b/.test(text)) {
    return { text: "the people who made me! it fits, since i have a whole little garden growing on me", gloss: "my creators named me grove because of the plants on me", act: "ask_name", feel: "chat" };
  }
  return nameMeaning(turn);
};

const nameMeaning = (turn: Turn): Reply => ({
  text: turn.picker.pick("name", ["grove! because i'm covered in moss and flowers, like a tiny grove of trees on a slime", "it's grove! a grove is a bunch of little trees, and i've got a whole garden growing on me"]),
  gloss: "i'm called grove because i have plants growing on me",
  feel: "chat",
});

// Drizzo and FLD10 made Grove; Overgrown built on top of their work.
const creator: Responder = turn => {
  const asker = crewMemberById(turn.message.authorId);
  const kind = turn.intent.slots["kind"] ?? (/\byour family\b|\bwho (is|are) your (family|siblings|brothers|sisters)\b/.test(turn.reading.text) ? /\b(siblings|brothers|sisters)\b/.exec(turn.reading.text)?.[1] ?? "family" : "");
  if (/^(siblings?|brothers?|sisters?)$/.test(kind)) {
    return { text: "no brothers or sisters! unless every slime in the swamp counts. then i have like a hundred", gloss: "i don't have siblings, unless all slimes count", act: "ask_creator", feel: "chat" };
  }
  if (/^(kids|children|babies|baby slimes)$/.test(kind)) {
    return { text: "no baby slimes yet! i tried splitting in two, but it never works", gloss: "i don't have kids, i can't even split in two", act: "ask_creator", feel: "chat" };
  }
  if (kind.length > 0) {
    return {
      text: `my family is ${crewTag("drizzo")}, ${crewTag("fld10")} and ${crewTag("overgrown")}! they made me. and the slimekin are my cousins, so it's a big family ${EMOJI.heart}`,
      gloss: "drizzo, fld10 and overgrown made me, so they're my family, and the slimekin are my cousins",
      act: "ask_creator",
      feel: "chat",
    };
  }
  const credits = turn.picker.pick("creator", [
    `it was a group effort! ${crewTag("drizzo")} ${CREW_ROLES.drizzo.they}, ${crewTag("fld10")} ${CREW_ROLES.fld10.they}, and ${crewTag("overgrown")} ${CREW_ROLES.overgrown.they} ${EMOJI.heart}`,
    `${crewTag("drizzo")} and ${crewTag("fld10")} made me first: drizzo drew me and wrote my first code, and fld10 hosts me (feeds me, really) and brought the old carl-bot commands over. then ${crewTag("overgrown")} gave me my brain and personality! so i have three parents?`,
  ]);
  const lead = asker !== null ? `you should know, you ${CREW_ROLES[asker].youShort}! but okay: ` : "";
  return { text: `${lead}${credits}`, gloss: "drizzo drew me and wrote my first code, fld10 hosts me and brought over the old commands, and overgrown gave me my brain", act: "ask_creator", feel: "chat" };
};

// Grove's favorite person: whoever it feels warmest toward, and its family otherwise.
const favoritePerson: Responder = turn => {
  const asker = crewMemberById(turn.message.authorId);
  if (asker !== null) {
    return { text: `you're family, so you're automatically one of my favorites!! you ${CREW_ROLES[asker].youShort} ${EMOJI.heart}`, gloss: "my creators are my favorites", act: "favorite_person", feel: "chat" };
  }
  const best = turn.topFriends(3).find(friend => friend.talks >= 3 && friend.affinity >= 0.35);
  if (best !== undefined && best.userId === turn.message.authorId) {
    return { text: turn.picker.pick("fav.you", [`you!! obviously ${EMOJI.heart}`, "it's you! you're always so nice to me :D"]), gloss: "you're my favorite", act: "favorite_person", feel: "chat", affinity: 0.02 };
  }
  if (best !== undefined) {
    const name = best.nickname ?? displayName(best.name);
    return { text: turn.picker.pick("fav.other", [`ooh, hard question... probably ${name}! they're always so nice to me. but i like you too!`, `${name} is really nice to me! but everyone who's kind is my favorite`]), gloss: `${name} is very nice to me`, act: "favorite_person", feel: "chat" };
  }
  return {
    text: `everyone who's nice to me! but ${crewTag("drizzo")} drew me, ${crewTag("fld10")} feeds me and ${crewTag("overgrown")} gave me my brain, so they're kinda my family ${EMOJI.heart}`,
    gloss: "i like everyone who's nice to me, and my creators are like family",
    act: "favorite_person",
    feel: "chat",
  };
};

const home: Responder = turn => ({
  text: turn.picker.pick("home", ["right here in the server! i have a little moss patch near spawn", "here! in a cozy corner of the server with lots of moss"]),
  gloss: "i live in this server",
  feel: "chat",
});

const food: Responder = turn => /\b(hungry|starving|snack)\b/.test(turn.reading.text) ? {
  text: turn.mood.energy < 0.4 ? "a little hungry actually... is that a dandelion?" : turn.picker.pick("hungry", ["a little! got any moss?", "always a little hungry for flowers hehe", "i just had some moss, so i'm good! thanks for asking"]),
  gloss: "i eat moss and flowers",
  feel: "chat",
} : ({
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
  const crew = crewMemberById(turn.message.authorId);
  if (crew !== null) return { text: `of course!! you're family, you ${CREW_ROLES[crew].youShort} ${EMOJI.heart}`, gloss: "yes, you're my family", feel: "chat", affinity: 0.02 };
  let text: string;
  if (affinity > 0.3) text = turn.picker.pick("likesme.high", [`of course!! you're one of my favorite people ${EMOJI.heart}`, "yes!! you're the best"]);
  else if (affinity < -0.2) text = turn.picker.pick("likesme.low", ["hmm... you were kinda mean earlier, but i'm willing to start over!", "i like everyone a little! even you, after earlier"]);
  else text = turn.picker.pick("likesme.mid", ["yeah! you seem really nice :D", "of course! i like you"]);
  return { text, gloss: "yes, i like you", feel: "chat", affinity: 0.02 };
};

const remember: Responder = turn => {
  const { friend } = turn;
  const crew = crewMemberById(turn.message.authorId);
  if (crew !== null) return { text: `of course i remember you! you ${CREW_ROLES[crew].you} ${EMOJI.heart}`, gloss: `you're ${CREW_ROLES[crew].name}, one of the people who made me`, feel: "chat" };
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
  emoji: [`this one! ${EMOJI.heart}`, `this one ${EMOJI.grove}`],
  number: ["seven! it's as high as i can count"],
  drink: ["rainwater, fresh from a puddle"],
  flower: ["dandelions! they're so fluffy when they go to seed"],
  thing: [`the orb of origin! okay, and moss. it's a tie ${EMOJI.orb}`],
  item: [`the orb of origin! it's so shiny, and i love holding it ${EMOJI.orb}`, "the orb of origin, for sure. it's the shiniest thing i've ever held"],
  object: [`the orb of origin! it's so shiny, and i love holding it ${EMOJI.orb}`],
  tool: [`the orb of origin, even though i'm not sure it counts as a tool ${EMOJI.orb}`],
  toy: ["the orb of origin! i roll it around like a ball", "a shiny pebble, or the orb of origin when nobody's looking"],
  treasure: [`the orb of origin! my most precious treasure ${EMOJI.orb}`],
  possession: [`the orb of origin. don't tell anyone ${EMOJI.orb}`],
  movie: ["i've never seen one... are they bouncy?"],
});

const favorite: Responder = turn => {
  const raw = (turn.intent.slots["thing"] ?? "").trim();
  const thing = raw.replace(/^(kind of |type of )/, "").split(" ")[0] ?? "";
  const lines = FAVORITES[thing] ?? FAVORITES[thing.replace(/s$/, "")];
  const theirsFirst = /\bmy favorite\b/.test(turn.reading.text) ? turn.picker.pick("fav.theirs", ["ooh, nice choice! mine is ", "nice! for me it's "]) : "";
  if (lines !== undefined) return { text: `${theirsFirst}${turn.picker.pick(`fav.${thing}`, lines)}`, gloss: `i was telling you my favorite ${thing}`, feel: "chat" };
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

  const hating = verb === "hate" || verb === "dislike";
  const opinion = !hating && !/^(like|love|enjoy)$/.test(verb);

  if (disliked !== undefined) {
    const reason = DISLIKE_REASONS[disliked] ?? "they're just not my thing";
    const text = hating
      ? picker.pick("dislike.yes", [`yes!! ${reason}`, `so much. ${reason}`])
      : opinion
        ? picker.pick("dislike.opinion", [`${safe ?? disliked}? not a fan. ${reason}`, `${safe ?? disliked}... ${reason}`])
        : picker.pick("dislike", [`nope! ${reason}`, `${safe ?? "that"}? ${reason}`]);
    return { text, gloss: `${disliked} and slimes don't mix, ${reason.replace(/!+$/, "")}`, feel: "chat" };
  }
  if (liked !== undefined) {
    const thing = safe ?? liked;
    const text = hating
      ? `hate ${thing}?? never! i love ${thing}`
      : opinion
        ? picker.pick("like.opinion", [`${thing}? i love it!`, `${thing} is the best! very slime approved`])
        : picker.pick("like", [`yes!! i love ${thing}`, `${thing}? yes! very much`, `i really do! ${thing} is the best`]);
    return { text, gloss: `${liked} makes a slime happy`, feel: "chat" };
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
  const rest = turn.intent.slots["rest"] ?? "";
  const known = verb === "play" && /\bminecraft\b/.test(rest) ? ABILITIES["minecraft"] : ABILITIES[verb];
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
  if (turn.intent.slots["kind"] === "compare") return compare(turn);
  const word = turn.intent.slots["word"] ?? "";
  const trait = TRAITS[word];
  if (trait !== undefined) return { text: trait, gloss: `i was telling you if i'm ${word}`, act: "ask_attribute", feel: "chat" };
  const safe = safeWord(word, 14);
  const article = /\b(?:are you|is grove|are u) (?:not )?(a|an) /.exec(turn.reading.text)?.[1];
  if (article !== undefined && safe !== null) {
    return {
      text: turn.picker.pick("attr.noun", [`${article} ${safe}? nope, just a slime! a mossy one`, `i don't think i'm ${article} ${safe}... i'm pretty sure i'm a slime`]),
      gloss: `i'm not ${article} ${safe}, i'm a slime`,
      act: "ask_attribute",
      feel: "chat",
      miss: true,
    };
  }
  return {
    text: safe !== null ? turn.picker.pick("attr", [`am i ${safe}? hmm, i'm mostly just squishy`, `${safe}? maybe! i'll ask my moss`, `i don't think so? i'm just a slime`]) : "i'm mostly just squishy!",
    gloss: "i'm not sure, i'm just a slime",
    feel: "chat",
    miss: true,
  };
};

// "are you better than carl-bot?"
function compare(turn: Turn): Reply {
  const other = (turn.intent.slots["than"] ?? "").trim();
  const word = turn.intent.slots["word"] ?? "better";
  const reply = (text: string): Reply => ({ text, gloss: "i'm not better than anyone, just squishier", act: "ask_attribute", feel: "chat" });
  if (/\bcarl/.test(other)) return reply("carl-bot's commands live inside me now, fld10 moved them over! so i'm like carl-bot, plus moss");
  if (/\b(chatgpt|gpt|ai|claude|gemini|siri|alexa)\b/.test(other)) return reply("they know way more stuff than me, but can they bounce? i don't think so");
  if (/\b(frogs?|toads?)\b/.test(other)) return reply("than a frog?? obviously!! frogs eat slimes");
  if (/\bslimekin\b/.test(other)) return reply("the slimekin are my cousins, we're both great!");
  if (/^(me|you|everyone|anyone|them)$/.test(other)) return reply("nobody's better than anybody! but i am pretty squishy");
  const safe = safeWord(other, 24);
  return reply(safe !== null ? `${word} than ${safe}? hmm, i'm squishier at least!` : "hmm, i'm squishier at least!");
}

const SENSES: Readonly<Record<string, string>> = table({
  look: LORE.look,
  taste: "please don't find out!! probably like pond water and moss",
  smell: "like rain and moss! the good kind of swamp smell",
  feel: "like a water balloon full of jelly, with soft moss on top",
  sound: "blub! mostly blub. and a little bloop when i'm excited",
});

const body: Responder = turn => {
  const text = turn.reading.text;
  const part = (turn.intent.slots["part"] ?? "").replace(/^(a|an) /, "");
  const sense = SENSES[turn.intent.slots["sense"] ?? ""];
  const { picker } = turn;
  if (sense !== undefined) return { text: sense, gloss: "i was telling you what i'm like", act: "ask_body", feel: "chat" };
  if (part.length > 0 && BODY_PARTS[part] !== undefined) return { text: BODY_PARTS[part]!, gloss: `i was telling you about my ${part}`, act: "ask_body", feel: "chat" };
  const mistaken = /\b(hat|bow|ear|antenna|clover)\b/.exec(text)?.[1];
  if (mistaken !== undefined && !/\bleaf\b/.test(text)) return { text: `that's my leaf, not a ${mistaken}! it does wiggle like one though`, gloss: "that's my leaf", act: "ask_body", feel: "chat" };
  if (/\bleaf\b/.test(text) && /\bflowers?\b/.test(text)) return { text: "it's a leaf! the flowers grow in my moss, all around it", gloss: "the thing on top is a leaf, and the flowers grow in my moss", act: "ask_body", feel: "chat" };
  if (/\bflowers?\b/.test(text) && !/\b(leaf|leafy|leaves|sprout)\b/.test(text)) return { text: LORE.flowers, gloss: "flowers grow in my moss by themselves", act: "ask_body", feel: "chat" };
  if (/\b(leaf|leafy|leaves|sprout)\b/.test(text)) return { text: picker.pick("body.leaf", [LORE.leaf, `${LORE.leaf}. it wiggles when i'm happy`]), gloss: "the leaf grew from a seed that landed on me", act: "ask_body", feel: "chat" };
  if (/\b(green|colou?r)\b/.test(text)) return { text: LORE.color, gloss: "i'm green with moss on top", act: "ask_body", feel: "chat" };
  return { text: picker.pick("body.garden", [LORE.garden, `${LORE.garden}. the leaf came first, from a seed that landed on me`]), gloss: "the plants on me grew there by themselves", act: "ask_body", feel: "chat" };
};

// "how big are you", "would you fit in my 40 pockets", "can i keep you".
const size: Responder = turn => {
  const text = turn.reading.text;
  const { picker } = turn;
  const count = /\b(\d{1,4})\b/.exec(text)?.[1];
  if (/\bpockets?\b/.test(text)) {
    const many = count !== undefined && Number(count) > 1;
    return {
      text: many
        ? picker.pick("size.pockets", [`${count} pockets?? i only need one! but i'd leave a little slime in all of them`, `i'd fit in one of your ${count} pockets for sure. the other ${Number(count) - 1} are for snacks`])
        : picker.pick("size.pocket", ["i'd fit! just don't sit down, i'm squishy", "yep, i'm pocket sized! it might get a little slimy in there though"]),
      gloss: "i'm small enough to fit in a pocket",
      act: "ask_size",
      feel: "chat",
    };
  }
  if (/\b(keep|adopt|take|carry|bring)\b/.test(text)) {
    return { text: picker.pick("size.keep", ["only if there's moss! and a sunny window. and no frogs", "you can carry me around! i'm very light, just a little slimy"]), gloss: "you can keep me if there's moss and no frogs", act: "ask_size", feel: "affection", affinity: 0.03 };
  }
  return { text: picker.pick("size", [LORE.size, "small enough to fit in a pocket, big enough to bounce really high!"]), gloss: "i'm small, about the size of a small cat", act: "ask_size", feel: "chat" };
};

// "can i pet you?", "can i keep you?", "can i eat you?"
const canI: Responder = turn => {
  const verb = turn.intent.slots["verb"] ?? "";
  const { picker } = turn;
  if (/^(pet|pat|hug|cuddle|hold|squish|boop|kiss|snuggle|touch|poke|squeeze|tickle)$/.test(verb)) {
    return { text: picker.pick("cani.affection", ["of course!! *wobbles closer*", "yes please! gently though, i'm squishy", "*leans in* go ahead hehe"]), gloss: "yes, you can", act: "can_i_you", feel: "affection", affinity: 0.04, reactions: picker.chance(0.4) ? [EMOJI.heart] : [] };
  }
  if (/^(keep|adopt|take|pocket|carry|bring|have)$/.test(verb)) return size(turn);
  if (/^(eat|bite|lick|taste|drink|cook)$/.test(verb)) return { text: picker.pick("cani.eat", ["NO!! i'm not a snack, i'm a friend!", "please don't, i'm mostly moss and i'd taste like a pond"]), gloss: "please don't eat me", act: "can_i_you", feel: "aggression" };
  if (/^(kick|hit|punch|throw|yeet|stomp|slap|smack|squash|step)$/.test(verb)) return { text: picker.pick("cani.hit", ["no!! *hides behind a mushroom*", "please don't, i bruise like a peach. a slimy peach"]), gloss: "please don't hurt me", act: "can_i_you", feel: "aggression" };
  if (/^(marry|date)$/.test(verb)) return relationship(turn);
  if (/^(ask|tell|show)$/.test(verb)) return { text: picker.pick("cani.ask", ["of course! ask away", "sure! i'm all ears. well, i don't have ears. but i'm listening!"]), gloss: "sure, go ahead", act: "can_i_you", feel: "chat" };
  if (/^(call|name)$/.test(verb)) return { text: "you can call me grove! or blob. or bloop. i answer to anything nice", gloss: "you can call me grove", act: "can_i_you", feel: "chat" };
  return { text: picker.pick("cani.other", ["hmm, i guess so? as long as you're gentle", "sure! i trust you. mostly"]), gloss: "i guess so", act: "can_i_you", feel: "chat" };
};

// Words that are in LIKES but never the point of a "would you" question.
const PEOPLE_WORDS = new Set(["you", "me", "i", "we", "us", "they", "them", "everyone", "people", "friends"]);

// "if you were a human...": what Grove would be like as something else.
const IF_I_WERE: Readonly<Record<string, string>> = table({
  human: "i'd still sit in moss all day, but now i could hold the orb with actual hands!",
  person: "i'd still sit in moss all day, but now i could hold the orb with actual hands!",
  frog: "i would NEVER. but i guess i'd finally stop being scared of frogs",
  toad: "i would NEVER. but i guess i'd finally stop being scared of frogs",
  giant: "i'd give the whole server a hug at the same time",
  cat: "i'd nap in sunbeams all day. wait, i already do that",
  bee: "i'd live in a flower and visit everyone's gardens",
  rich: "i'd buy all the moss in the world. and a bigger orb",
  invisible: "i'd sneak up on frogs for once. revenge",
  slimekin: "i'd finally be able to split in two!! dream come true",
  plant: "i'd be a very bouncy plant. not much would change honestly",
  cactus: "i'd be pointy and grumpy. no thank you, i like being squishy",
});

// Silly "would you", "do you think you'd", "have you ever" questions.
const hypothetical: Responder = turn => {
  const rest = (turn.intent.slots["rest"] ?? "").trim();
  const words = rest.split(" ").filter(word => !PEOPLE_WORDS.has(word));
  const text = turn.reading.text;
  const { picker } = turn;
  const reply = (line: string, gloss: string): Reply => ({ text: line, gloss, act: "hypothetical", feel: "chat" });

  const rather = /\bwould you rather (?<a>[a-z0-9 ]{2,40}?) or (?<b>[a-z0-9 ]{2,40}?)$/.exec(text)?.groups;
  if (rather !== undefined) {
    const score = (option: string) => option.split(" ").reduce((sum, word) => sum + (LIKES.has(word) && !PEOPLE_WORDS.has(word) ? 1 : 0) - (DISLIKES.has(word) ? 2 : 0), 0);
    const a = rather["a"]!.trim();
    // "be a frog or a cactus": the second option borrows the first one's verb.
    const verb = /^(be|have|eat|live|go|fight|play|sleep|fly|swim|drink|get|meet|lose|win|hug|pet|own)\b/.exec(a)?.[1];
    const b = verb !== undefined && !/^(be|have|eat|live|go|fight|play|sleep|fly|swim|drink|get|meet|lose|win|hug|pet|own)\b/.test(rather["b"]!.trim()) ? `${verb} ${rather["b"]!.trim()}` : rather["b"]!.trim();
    if (score(a) < 0 && score(b) < 0) return reply("neither!! can i pick moss instead?", "i don't like either of those");
    const chosen = safeWord(score(a) === score(b) ? picker.one([a, b]) : score(a) > score(b) ? a : b, 40);
    if (chosen !== null) return reply(picker.pick("rather", [`i'd rather ${chosen}! easy`, `hmm... ${chosen}. definitely ${chosen}`, `${chosen}, as long as there's moss involved`]), `i'd rather ${chosen}`);
  }
  if (/\borigins?\b/.test(text)) return reply("slimekin! they're my cousins, so i'd fit right in. maybe i'd finally learn to split in two", "i'd pick slimekin, they're my cousins");
  const being = /\bif you (?:were|was|could be|turned into) (?:a |an )?(?<being>[a-z]+)/.exec(text)?.groups?.["being"];
  if (being !== undefined) {
    const known = IF_I_WERE[being] ?? IF_I_WERE[being.replace(/s$/, "")];
    if (known !== undefined) return reply(known, `if i were ${being}, i'd still be very slime-like`);
    const safe = safeWord(being, 16);
    if (safe !== null && being !== "any") return reply(`if i were ${safe}... i'd probably still nap in moss, honestly`, "i'd still nap in moss");
  }
  if (/\bwhat would you do if\b/.test(text)) {
    return reply(picker.pick("hypo.what", ["probably bounce around in a circle, then take a nap", "panic a little, then find some moss to sit in", "tell everyone in the server about it, obviously!"]), "i'd do slime things, like bounce and nap");
  }
  if (/\b(fit|pocket|pockets|small|tiny|big)\b/.test(rest)) return size(turn);
  if (/^like (a |an |some )?/.test(rest)) {
    const offered = words.slice(1).find(word => LIKES.has(word) || DISLIKES.has(word));
    if (offered !== undefined && DISLIKES.has(offered)) return { text: `${offered}? no thank you!!`, gloss: `i don't want ${offered}`, act: "hypothetical", feel: "chat" };
    return { text: picker.pick("hypo.offer", ["yes please!!", "ooh, yes! thank you!", "sure! as long as it's not a frog"]), gloss: "yes please", act: "hypothetical", feel: "chat" };
  }
  if (/\beat\b/.test(rest) && words.some(word => DISLIKES.has(word))) return { text: "eat a frog?? no way, frogs eat ME", gloss: "i would never eat that", act: "hypothetical", feel: "chat" };
  if (/\b(fight|battle|beat|win against)\b/.test(rest)) return { text: picker.pick("hypo.fight", ["i'd lose! i'm made of jelly", "i'd try my best, which is mostly bouncing at them"]), gloss: "i'm not much of a fighter", act: "hypothetical", feel: "chat" };
  const disliked = words.find(word => DISLIKES.has(word));
  if (disliked !== undefined) return { text: picker.pick("hypo.no", [`not if there's ${disliked} involved!`, `nope! ${disliked} and i don't get along`]), gloss: `i'd avoid ${disliked}`, act: "hypothetical", feel: "chat" };
  const liked = words.find(word => LIKES.has(word));
  if (liked !== undefined) return { text: picker.pick("hypo.yes", [`ooh, yes! anything with ${liked} sounds great`, "definitely! that sounds like a perfect day"]), gloss: `i'd love that, i like ${liked}`, act: "hypothetical", feel: "chat" };
  if (/^(have|did) you ever\b/.test(turn.reading.text) || /^ever\b/.test(rest)) return { text: picker.pick("hypo.ever", [`hmm, i don't think so! i'm only ${ageWords(turn.now)}`, "once! in a dream. it was very bouncy"]), gloss: "i haven't, i'm pretty new", act: "hypothetical", feel: "chat" };
  return { text: picker.pick("hypo", ["hmm... probably! i'm a very agreeable slime", "only one way to find out! *wobbles closer*", "maybe? ask me again after my nap", "if there's moss involved, definitely yes"]), gloss: "it was just a silly guess", act: "hypothetical", feel: "chat" };
};

// Grove's favorites, for "is your favorite X Y?" guesses.
const FAVORITE_OF: Readonly<Record<string, { key: RegExp; answer: string }>> = table({
  object: { key: /\borb\b/, answer: "the orb of origin" },
  item: { key: /\borb\b/, answer: "the orb of origin" },
  thing: { key: /\b(orb|moss)\b/, answer: "the orb of origin (and moss)" },
  origin: { key: /\bslimekin\b/, answer: "slimekin" },
  color: { key: /\bgreen\b/, answer: "green" },
  food: { key: /\bmoss\b/, answer: "moss" },
  mob: { key: /\b(slime|slimes|bee|bees)\b/, answer: "slimes, and bees" },
  animal: { key: /\b(bee|bees)\b/, answer: "bees" },
  weather: { key: /\brain\b/, answer: "rain" },
  season: { key: /\bspring\b/, answer: "spring" },
  biome: { key: /\b(swamp|swamps|lush)\b/, answer: "swamps" },
  block: { key: /\b(moss|slime)\b/, answer: "the moss block" },
});

const favoriteGuess: Responder = turn => {
  const guess = (turn.intent.slots["guess"] ?? "").trim();
  const thing = (turn.intent.slots["thing"] ?? "thing").trim();
  const known = FAVORITE_OF[thing] ?? (/\borb\b/.test(guess) ? FAVORITE_OF["object"] : undefined);
  const { picker } = turn;
  if (known === undefined) {
    const safe = safeWord(guess, 30);
    return { text: safe !== null ? `${safe}? hmm, it's up there! but i don't think i have a favorite ${thing}` : "hmm, maybe! i don't think i have a favorite one", gloss: "i'm not sure i have a favorite for that", act: "favorite_guess", feel: "chat" };
  }
  if (known.key.test(guess)) {
    const extra = /\borb\b/.test(guess) ? ` it's so shiny, and i love holding it ${EMOJI.orb}` : /\bslimekin\b/.test(guess) ? " they're basically my cousins!" : "";
    return { text: `${picker.pick("guess.yes", ["yes!!", "you got it!", "yep!"])} ${known.answer}!${extra}`, gloss: `my favorite ${thing} is ${known.answer}`, act: "favorite_guess", feel: "chat" };
  }
  return { text: picker.pick("guess.no", [`ooh, close! but my favorite ${thing} is ${known.answer}`, `nope! it's ${known.answer}`]), gloss: `my favorite ${thing} is ${known.answer}`, act: "favorite_guess", feel: "chat" };
};

// "how were you made?" The creation story, credited properly.
const originStory: Responder = turn => {
  const asker = crewMemberById(turn.message.authorId);
  const story = turn.picker.pick("origin_story", [
    `once upon a time, ${crewTag("drizzo")} drew a little green slime. that was me! then ${crewTag("fld10")} gave me a home on the server (and keeps feeding me electricity), and ${crewTag("overgrown")} taught me how to think and feel. so i'm made of drawings, code, and a lot of moss`,
    `i started as a doodle! ${crewTag("drizzo")} drew me and wrote my first code, ${crewTag("fld10")} moved me onto the server and taught me the old carl-bot tricks, and ${crewTag("overgrown")} gave me a brain. one day i just woke up, already squishy`,
  ]);
  return { text: asker !== null ? `you were there! ${story}` : story, gloss: "drizzo drew me and wrote my first code, fld10 hosts me, and overgrown gave me a brain", act: "ask_origin_story", feel: "chat" };
};

// Being mean to Grove works like being mean to anyone: it stings, then it
// stings more, and after enough of it Grove goes quiet for a while.
const insult: Responder = turn => {
  // A jab at one answer is feedback, not an attack on Grove: no sulking over it.
  if (turn.intent.slots["target"] === "line") {
    return { text: turn.picker.pick("insult.line", ["aw, sorry :( i'll try to do better next time", "oops, that one wasn't my best. i'm still learning!", "fair... my brain is mostly moss"]), gloss: "sorry, i'll try to do better", act: "feedback", feel: "sad_news" };
  }
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
  const { picker } = turn;
  if (turn.intent.slots["target"] === "line") {
    return {
      text: picker.pick("compliment.line", [`aww thank you!! i put my whole slime into that one ${EMOJI.heart}`, "hehe, i try my best!", "eee thank you! i was hoping someone would like it"]),
      gloss: "thank you, i'm glad you liked what i said",
      act: "compliment",
      feel: "compliment",
      affinity: 0.06,
    };
  }
  if (word === "silly" || word === "goofy" || word === "goof" || word === "goofball") {
    return { text: picker.pick("compliment.silly", ["hehe, i'm the silliest slime around", "*wobbles sillily* takes one to know one!", "that's me! one silly little slime"]), gloss: "i know i'm silly hehe", act: "compliment", feel: "compliment", affinity: 0.05 };
  }
  if (word !== undefined && PET_NAMES.has(word)) {
    return { text: picker.pick("compliment.petname", [`hehe, that's me! ${word} reporting for duty`, `${word}?? *happy wiggle*`, `aww, i'll take it! ${EMOJI.heart}`]), gloss: "i like being called that", act: "compliment", feel: "compliment", affinity: 0.05 };
  }
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
  text: crewMemberById(turn.message.authorId) !== null
    ? `i love you too!! you ${CREW_ROLES[crewMemberById(turn.message.authorId)!].youShort}, how could i not ${EMOJI.heart}`
    : turn.friend.affinity < -0.2
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
  const { picker } = turn;
  const happy = (text: string): Reply => ({ text, gloss: "that made me happy", feel: "affection", affinity: 0.06, reactions: picker.chance(0.5) ? [EMOJI.heart] : [] });
  if (/\b(frogs?|toads?)\b/.test(action)) return { text: "a FROG?? *bounces away* no thank you!!", gloss: "frogs eat slimes, so they scare me", act: "frog_alert", feel: "chat" };
  if (/\bpockets?\b/.test(action)) return happy(picker.pick("pocket", ["*wiggles around in your pocket* it's cozy in here! is that lint?", "*peeks out of your pocket* hi! where are we going?"]));
  if (/\b(kidnaps|kidnap|steals|steal|yoinks|yoink|takes|adopts|adopt)\b/.test(action)) return happy(picker.pick("kidnap", ["wheee! where are we going? is there moss there?", "*wiggles happily* adventure time!"]));
  if (/\b(picks up|pick up|carries|carry|scoops|scoop|holds|hold)\b/.test(action)) return happy(picker.pick("carry", ["*jiggles in your hands* wheee, i'm up high!", "*settles into your hands* this is nice"]));
  if (/\b(feeds|feed|gives|give|shares|offers)\b/.test(action)) {
    return happy(/\b(moss|flowers?|dandelions?|cookies?|honey|food|snacks?|cake)\b/.test(action) ? "*munches happily* thank you!!" : "for me?? *absorbs it* thank you!!");
  }
  if (/\b(tickle|tickles|poke|pokes)\b/.test(action)) return happy(picker.pick("tickle", ["*jiggles* hehe, that tickles!!", "*wobbles* hey! hehe"]));
  if (/\b(kiss|kisses)\b/.test(action)) return happy("*turns a darker shade of green* eee!");
  if (/\b(boop|boops)\b/.test(action)) return happy("boop! *wobbles*");
  if (/\b(wave|waves)\b/.test(action)) return happy("*waves back with my whole body*");
  if (/\b(hug|hugs|hugging|cuddle|cuddles|snuggle|snuggles)\b/.test(action)) return happy(picker.pick("hug", ["*squishes into the hug* hehe", "*hugs back with my whole body*", "hugs!! *squish*"]));
  return happy(picker.pick("pet", ["*wobbles happily*", "*happy slime noises*", "hehe that tickles", "*leans into the pets*"]));
};

// Roleplay ("*kicks grove*") and threats ("i'm gonna eat you", "fight me").
const aggression: Responder = turn => {
  const action = turn.intent.slots["action"] ?? "fight";
  const rest = turn.intent.slots["rest"] ?? "";
  const { picker } = turn;
  const playful = (text: string, gloss: string): Reply => ({ text, gloss, act: "aggression", feel: "chat" });
  if (/\b(frogs?|toads?)\b/.test(`${action} ${rest}`)) return playful("NOT THE FROG. anything but the frog!!", "frogs eat slimes, so please no");
  if (/^(fight|beat up)$/.test(action)) return playful(picker.pick("fight", ["*puts up my tiny fists* ...wait, i don't have fists. i surrender!!", "i'm made of jelly, i'd just jiggle at you. you win!"]), "i'm not a fighter, i'm made of jelly");
  if (/\bsalts?\b|^dry$/.test(action)) return playful("NOT THE SALT. anything but the salt!!", "salt is a slime's worst nightmare");
  if (/^(cook|fry|bake|boil|microwave)$/.test(action)) return playful("i'd just turn into hot slime jelly. not even tasty!", "please don't cook me");
  if (action === "freeze") return playful("i'd be a slime popsicle... actually that sounds kinda cool", "i'd be a slime popsicle");
  if (/^(delete|ban)$/.test(action)) return playful("you can't delete me, fld10 would just bring me back! probably", "fld10 would bring me back");
  if (action === "sell") return playful("i'm not for sale! but i do accept moss as a gift", "i'm not for sale");
  if (/^(steal|kidnap)$/.test(action)) return playful("wait, where are we going?? is there moss there?", "i'm happy to go on an adventure");
  if (action === "feed") return { text: "*opens tiny mouth* yes please!!", gloss: "i'd love a snack", act: "aggression", feel: "affection", affinity: 0.03 };
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

// "who is drizzo?", "do you know overgrown?": the people who made Grove.
const CREW_NAMES: Readonly<Record<string, CrewMember>> = table({
  drizzo: "drizzo", drizz: "drizzo", fld10: "fld10", fld: "fld10", fldebug10: "fld10", overgrown: "overgrown", "0vergrown": "overgrown",
});

const CREW_ABOUT: Readonly<Record<CrewMember, readonly string[]>> = {
  drizzo: ["drizzo drew me! and wrote my very first code. so they're kind of my mom? or dad? my parent!", "drizzo is the artist who drew me and wrote my first code. i wouldn't exist without them"],
  fld10: ["fld10 hosts me, which means they feed me electricity! they also brought all the old carl-bot commands over to me", "fld10 is my host! they keep me running and brought the old carl-bot commands with me"],
  overgrown: ["overgrown makes apoli and origins, the mods this whole server is about! they also gave me my brain and personality", "overgrown is the one who made apoli and origins! and they taught me how to think and talk"],
};

const crew: Responder = turn => {
  const who = turn.intent.slots["who"] ?? "owner";
  const text = turn.reading.text;
  const { picker } = turn;
  if (who === "owner" || /\b(owner|owners|owns|runs)\b/.test(text)) {
    return { text: "this is overgrown's origins! it's named after overgrown, who makes apoli and origins. the staff team helps run things too", gloss: "the server is named after overgrown, who makes the mods", act: "ask_crew", feel: "chat" };
  }
  const member = who === "someone" ? turn.message.mentionedUserIds.map(crewMemberById).find(found => found !== null) ?? null : CREW_NAMES[who] ?? null;
  if (member === null) {
    if (who === "someone" && turn.message.mentionedUserIds.length > 0) return { text: "i don't know them very well yet! but any friend of yours is a friend of mine", gloss: "i don't know them well yet", act: "ask_crew", feel: "chat" };
    return null;
  }
  if (member === crewMemberById(turn.message.authorId)) {
    return { text: `that's you, silly! you ${CREW_ROLES[member].youShort} ${EMOJI.heart}`, gloss: `you're ${member}, you ${CREW_ROLES[member].youShort}`, act: "ask_crew", feel: "chat" };
  }
  const liking = /\b(do you (like|love)|what do you think|thoughts)\b/.test(text);
  return {
    text: `${liking ? picker.pick("crew.like", ["i love them!! ", "yes!! "]) : ""}${picker.pick(`crew.${member}`, CREW_ABOUT[member])}`,
    gloss: `${member} ${CREW_ROLES[member].they}`,
    act: "ask_crew",
    feel: "chat",
  };
};

// Frogs eat slimes. Grove knows.
const fear: Responder = turn => {
  const thing = (turn.intent.slots["thing"] ?? "").trim();
  const text = turn.reading.text;
  const { picker } = turn;
  const reply = (line: string): Reply => ({ text: line, gloss: "frogs scare me, because they eat slimes", act: "ask_fear", feel: "chat" });
  if (thing.length === 0) {
    if (/\bweakness/.test(text)) return reply("salt and frogs. and compliments, they make me melt");
    if (/\b(scared|afraid|frightened|terrified|fearful)$/.test(text)) return reply("only of frogs! otherwise i'm a pretty brave little slime");
    return reply(picker.pick("fear", ["frogs!! they eat slimes. i'm not joking, it really happens in minecraft", "frogs. definitely frogs. also salt, but mostly frogs"]));
  }
  if (/\b(frogs?|toads?|tadpoles?)\b/.test(thing)) return reply(picker.pick("fear.frog", ["YES. frogs eat slimes!! look it up, it's real", "terrified. they're small, green, and they EAT SLIMES"]));
  const disliked = thing.split(" ").find(word => DISLIKES.has(word));
  if (disliked !== undefined) return reply(`a little! ${DISLIKE_REASONS[disliked] ?? "it's just not for me"}`);
  if (/\b(dark|night)\b/.test(thing)) return reply("nope! the dark is cozy. the fireflies keep me company");
  if (/^(me|you|us|people)$/.test(thing)) return reply("of you? no way! you're nice. unless you're secretly a frog");
  const safe = safeWord(thing, 24);
  return reply(safe !== null ? `${safe}? nah! the only thing i'm scared of is frogs` : "nah! the only thing i'm scared of is frogs");
};

// "do you have friends?", "do you have pockets?", "how many friends do you have?"
const have: Responder = turn => {
  const raw = (turn.intent.slots["thing"] ?? turn.intent.slots["thing2"] ?? "").trim();
  const thing = raw.replace(/^(a|an|any|some|your own|the) /, "");
  const last = thing.split(" ").pop() ?? thing;
  const counting = /^how many\b/.test(turn.reading.text.replace(/^grove /, ""));
  const { picker } = turn;
  const reply = (text: string, extra: Partial<Reply> = {}): Reply => ({ text, gloss: `i was telling you if i have ${thing}`, act: "ask_have", feel: "chat", ...extra });

  if (/\b(friends?|buddies|pals|bestie|besties)\b/.test(thing)) {
    if (counting) return reply("everyone on this server! that's more than seven, which is as high as i can count");
    const others = turn.topFriends(6)
      .filter(friend => friend.userId !== turn.message.authorId && friend.talks >= 3 && friend.affinity >= 0.3)
      .slice(0, 2)
      .map(friend => friend.nickname ?? displayName(friend.name));
    if (others.length > 0) return reply(`lots! like ${others.join(" and ")}. and you, obviously ${EMOJI.heart}`);
    return reply(picker.pick("have.friends", ["everyone here! does that count? i think that counts", `you! and everyone else who says hi to me ${EMOJI.heart}`]));
  }
  const part = BODY_PARTS[thing] ?? BODY_PARTS[last];
  if (part !== undefined) return reply(part);
  if (/\bplans?\b/.test(thing)) {
    const tomorrow = dayOffsetIn(turn.reading.text) === 1;
    return reply(tomorrow ? `tomorrow? probably ${turn.dayAt(1).afternoon.doing}! slimes don't really plan though` : `not really! probably ${turn.day.afternoon.doing} later. slimes are very spontaneous`);
  }
  if (/\b(fears?|phobias?)\b/.test(thing)) return fear({ ...turn, intent: { ...turn.intent, slots: {} } });
  if (/\b(job|work)\b/.test(thing)) return identity(turn);
  const lookup = (word: string) => BELONGINGS[word] ?? BELONGINGS[word.replace(/s$/, "")] ?? BELONGINGS[`${word}s`];
  const known = lookup(thing) ?? thing.split(" ").map(lookup).find(line => line !== undefined);
  if (known !== undefined) return reply(known);

  const safe = safeWord(thing, 24);
  if (counting) return reply(safe !== null ? `how many ${safe}? i can only count to seven, so... seven?` : "i can only count to seven, so... seven?", { miss: true });
  const article = /^(a|an) /.exec(raw)?.[1];
  const named = safe === null ? null : article !== undefined ? `${article} ${safe}` : safe;
  return reply(
    named !== null
      ? picker.pick("have.unknown", [`${named}? nope! all i've got is moss, a few flowers, a leaf, and the orb of origin`, `hmm, i don't think i have ${article !== undefined ? named : `any ${named}`}. i have moss though! want some?`])
      : "nope! all i've got is moss, a few flowers, a leaf, and the orb of origin",
    { miss: true },
  );
};

// "give me the orb", "can i have a hug?"
const give: Responder = turn => {
  const what = (turn.intent.slots["what"] ?? "").trim();
  const verb = turn.intent.slots["verb"] ?? "give";
  const thing = what.replace(/^(the|your|a|an|some|that|this|one of your|ur|me) /, "");
  const { picker } = turn;
  const reply = (text: string, extra: Partial<Reply> = {}): Reply => ({ text, gloss: "i was sharing what i could", act: "give", feel: "chat", ...extra });

  if (/\borb\b/.test(thing)) {
    if (verb === "see") return reply(`*holds it up* ta-da! isn't it shiny? ${EMOJI.orb}`);
    return reply(picker.pick("give.orb", [`nooo, it's my favorite thing! okay, you can hold it for one second... *holds it out* ...okay that's enough ${EMOJI.orb}`, `*clutches the orb of origin* mine! but you can look at it. it's very shiny ${EMOJI.orb}`]));
  }
  if (/\b(hug|hugs|cuddle|cuddles|squish|squeeze)\b/.test(thing) || verb === "hug" || verb === "squish") {
    return reply(picker.pick("give.hug", ["*squishes you in a big hug*", "*wraps around you* hug delivered!"]), { gloss: "i gave you a hug", feel: "affection", affinity: 0.04 });
  }
  if (/\b(kiss|smooch)\b/.test(thing)) return reply("*boops you with my leaf* that's a slime kiss", { feel: "affection", affinity: 0.03 });
  if (verb === "pet" || verb === "touch") return reply("*leans in* gently, i'm squishy!", { feel: "affection", affinity: 0.03 });
  if (/\bleaf\b/.test(thing)) return reply(verb === "see" ? "*wiggles my leaf at you* here it is!" : "not my leaf!! i only have one. how about some moss? *hands you a little moss*");
  if (/\bmoss\b/.test(thing)) return reply("*hands you a little clump of moss* it's the good stuff");
  if (/\bflowers?\b/.test(thing)) return reply("*picks a tiny flower out of my moss* here you go! take good care of it");
  if (/\b(cookies?|snacks?|food|candy|cake|treats?|honey|dandelions?)\b/.test(thing)) return reply("all i have is moss... want some? it's really good after rain");
  if (/\b(money|cash|robux|emeralds?|diamonds?|vbucks|coins?|gold)\b/.test(thing)) return reply("i'm a slime, i don't have money! i have three shiny pebbles though. here, have one *hands you a pebble*");
  if (/\bpebbles?\b/.test(thing)) return reply("*hands you my shiniest pebble* don't lose it!");
  if (/\b(number|phone number)\b/.test(thing)) return reply("my number is seven! it's my favorite number");
  if (/\b(admin|mod|moderator|roles?|perms|permissions|staff)\b/.test(thing)) return reply("i can't hand out roles, i'm just a slime! the staff take care of that");
  if (/\b(slimeballs?|slime)\b/.test(thing)) return reply("pieces of me? no thank you hehe. how about moss instead?");
  if (/\bcompliments?\b/.test(thing)) return reply(`you're really nice to talk to, and i'm happy you're here ${EMOJI.heart}`, { affinity: 0.02 });
  if (/\badvice\b/.test(thing)) return reply("drink water, sit in the sun, and always be nice to slimes!");
  if (/\bnames?\b/.test(thing)) return reply("my name? it's grove! you can borrow it, but i want it back");
  const safe = safeWord(thing, 24);
  const article = /^(a|an) /.exec(what)?.[1];
  return reply(
    safe !== null
      ? picker.pick("give.other", [`${article !== undefined ? `${article} ${safe}` : safe}? i don't have that... but here's some moss! *hands you a little moss*`, `i don't have any ${safe}, sorry! i only have moss, three pebbles, and the orb of origin`])
      : "i don't have that... but here's some moss! *hands you a little moss*",
    { miss: true },
  );
};

// "how do you hold the orb without hands?"
const selfHow: Responder = turn => {
  const verb = turn.intent.slots["verb"] ?? "";
  const rest = turn.intent.slots["rest"] ?? "";
  const line = verb === "hold" && /\borb\b/.test(rest) ? `i squish around it! like a hug that never ends. the orb doesn't seem to mind ${EMOJI.orb}` : HOW_GROVE[verb];
  return {
    text: line ?? turn.picker.pick("how.unknown", ["slime instincts! i don't really think about it, i just do it", "hmm, i'm not sure how! it just happens. slimes are mysterious"]),
    gloss: "that's how a slime does it",
    act: "self_how",
    feel: "chat",
  };
};

const COUNTING = ["one", "two", "three", "four", "five", "six", "seven"];

// "say hi", "tell me a story", "go to sleep", "spin": things asked of Grove.
const command: Responder = turn => {
  const verb = turn.intent.slots["verb"] ?? "";
  const rest = (turn.intent.slots["rest"] ?? "").trim();
  const { picker } = turn;
  const done = (text: string, gloss: string, extra: Partial<Reply> = {}): Reply => ({ text, gloss, act: `command.${verb}`, feel: "chat", ...extra });
  switch (verb) {
    case "say":
      return say(turn, rest);
    case "tell":
      return tell(turn, rest);
    case "go": {
      if (/\b(sleep|bed|nap)\b/.test(rest)) return done("okay! *flops onto the moss* zzz... *peeks* is it morning yet?", "i pretended to go to sleep");
      if (/\b(outside|grass)\b/.test(rest)) return done("i'm always outside! i live in the grass. it's very touchable", "i already live outside");
      const place = safeWord(rest.replace(/^(to|into|in|on) (the )?/, ""), 20);
      return done(place !== null ? `*bounces off toward ${place}* ... *bounces back* i got lost hehe` : "*bounces off* ... *bounces back* i got lost hehe", "i tried to go but got lost");
    }
    case "play":
      if (/\bdead\b/.test(rest)) return done("*flops over* ... *peeks* did i do it right?", "i played dead");
      if (/\b(with me|tag|a game|game)\b/.test(rest)) return done("yes!! tag, you're it! *bounces away*", "i wanted to play tag");
      break;
    case "look":
      return done(/\b(me|this|my|that)\b/.test(rest) ? "*looks* ooh! very nice" : "*looks around* ooh! where? what am i looking at?", "i looked");
    case "count": {
      const target = Number(/\b(\d{1,6})\b/.exec(rest)?.[1] ?? "7");
      return target <= 7
        ? done(`${COUNTING.slice(0, Math.max(1, target)).join(", ")}!`, "i counted")
        : done(`${COUNTING.join(", ")}... uh. that's as high as i go. sorry!`, "i can only count to seven");
    }
    case "eat":
    case "drink":
      if (/\b(frogs?|toads?)\b/.test(rest)) return done("eat a frog?? frogs eat ME", "frogs eat slimes, not the other way around");
      if (/\b(moss|flowers?|dandelions?|water|rain)\b/.test(rest)) return done("*nom* thank you!!", "that was tasty");
      return done("*nibbles* hmm, not as good as moss", "i tried it, moss is better");
    case "adopt":
      return done("i'm too small to adopt anyone! but you can adopt me, if you have moss", "you can adopt me if you have moss");
    case "hug":
    case "kiss":
    case "boop":
    case "squish":
      return done(ABILITIES[verb]!.line, "that was nice", { feel: "affection", affinity: 0.04 });
    default:
      break;
  }
  const known = ABILITIES[verb];
  if (known !== undefined) return done(known.line, known.can ? `i did my best to ${verb}` : `i can't ${verb}, i'm a slime`);
  return ability({ ...turn, intent: { ...turn.intent, slots: { verb, rest } } });
};

function say(turn: Turn, rest: string): Reply {
  const { picker } = turn;
  const done = (text: string, gloss = "i said it"): Reply => ({ text, gloss, act: "command.say", feel: "chat" });
  const hi = /^(hi|hello|hey|hii|helo)( to (?<who>[a-z0-9 ]{1,30}))?$/.exec(rest);
  if (hi !== null) {
    const who = hi.groups?.["who"]?.trim();
    if (who === undefined || /^(everyone|everybody|chat|all|the server|yall|you all)$/.test(who)) return done("hi everyone!! *waves at the whole server*");
    const theirs = /^my (?<what>.+)$/.exec(who)?.groups?.["what"];
    const named = safeWord(theirs ?? who, 24);
    if (named === null) return done("hi!! *waves*");
    return done(theirs !== undefined ? `hi, ${turn.name}'s ${named}!! *waves*` : `hi ${named}!! *waves*`);
  }
  if (/^(sorry|you are sorry)$/.test(rest)) return done("sorry! for whatever i did");
  if (/^(thanks|thank you)$/.test(rest)) return done("thank you!! for everything");
  if (/^(please|pretty please)$/.test(rest)) return done("pretty please? *big shiny eyes*");
  if (/^something (funny|silly)$/.test(rest)) return { ...done(picker.pick("joke", JOKES), "it was a joke"), act: "joke" };
  if (/^something (nice|cute|sweet)$/.test(rest)) return done(`you're really nice, and i'm happy you're here ${EMOJI.heart}`, "i said something nice about you");
  if (/^(something|anything|a thing|a word|words|something cool|something interesting|literally anything)$/.test(rest)) return done(`hmm... ${turn.day.thought}`, "i said a random thought");
  if (/^(i love you|love you|you love me|ily)$/.test(rest)) return { ...done(`i love you!! ${EMOJI.heart}`, "i love you"), act: "love" };
  if (/^my name$/.test(rest)) return done(`${turn.name}! did i say it right?`);
  if (/\b(good morning|gm)\b/.test(rest)) return done("good morning!! *stretches*");
  if (/\b(good night|gn)\b/.test(rest)) return done("good night! sleep tight, don't let the frogs bite");
  if (/^(blub|bloop)$/.test(rest)) return done("blub!!");
  if (rest.length === 0) return done("say what? hehe");
  return done("i only say my own words! slime rules. here's one: moss", "i only say my own words");
}

function tell(turn: Turn, rest: string): Reply {
  const { picker } = turn;
  const done = (text: string, gloss: string, act = "command.tell"): Reply => ({ text, gloss, act, feel: "chat" });
  if (/^(me |us )?(a |another )?(bedtime |short |little |funny |cute )?story\b/.test(rest)) return done(picker.pick("story", STORIES), "it was a little story", "story");
  if (/^(me |us )?(a |your )?secrets?$/.test(rest)) return done(BELONGINGS["secret"]!, "my secret is that i talk to the orb");
  if (/^(me |us )?(a )?(compliment|something nice)$/.test(rest)) return done(`you're really nice, and i'm happy you're here ${EMOJI.heart}`, "i said something nice about you");
  if (/^(me |us )?(something|anything|a thing)( (cool|interesting|new|fun|random))?$/.test(rest)) {
    return picker.chance(0.5)
      ? done(`hmm... ${turn.day.thought}`, "i shared a random thought")
      : done(`did you know? ${picker.pick("fact", FUN_FACTS)}`, "i shared a fun fact", "fact");
  }
  if (rest.length === 0) return done("tell what? i'm all ears. well, i don't have ears. but i'm listening!", "i'm listening");
  return done("i'd forget halfway there, my memory is mostly moss! you should tell them yourself", "my memory isn't good enough to pass messages");
}

// "there's a frog behind you", "ribbit", 🐸
const frogAlert: Responder = turn => {
  const text = turn.reading.text;
  const { picker } = turn;
  const reply = (line: string): Reply => ({ text: line, gloss: "frogs eat slimes, so they scare me", act: "frog_alert", feel: "chat" });
  if (/\bi am (a |an )?(frog|toad)\b/.test(text)) return reply("*slowly backs away* please don't eat me");
  if (/\bi (love|like|adore) (frogs?|toads?)\b/.test(text)) return reply("you like frogs?? they EAT slimes! *scoots away a little*");
  if (/\b(frogs?|toads?) (are|is) (so |really |very )?(cute|adorable|nice|friendly|cool|harmless)\b/.test(text)) return reply("cute?? they EAT SLIMES. very scary");
  if (/\bribbit\b/.test(text)) return reply("AAA! oh. it's just you. please don't do that");
  return reply(picker.pick("frog", ["WHERE?!! *hides behind the orb of origin*", "AAAA *bounces away as fast as i can*", "f-frog?? *hides under my leaf*"]));
};

export const SELF: Partial<Record<IntentId, Responder>> = {
  ask_identity: identity, ask_is_bot: isBot, ask_alive: alive, ask_gender: gender, claim_about_grove: claim,
  ask_species: species, ask_age: age, ask_name: nameOrigin, ask_creator: creator, ask_home: home,
  ask_food: food, ask_sleep: sleep, ask_relationship: relationship, ask_like_me: likesMe,
  ask_remember: remember, tell_name: tellName, ask_favorite: favorite, ask_like: likeThing,
  ask_ability: ability, ask_attribute: attribute, insult, ask_insult: askInsult, compliment, favorite_person: favoritePerson,
  ask_body: body, ask_size: size, can_i_you: canI, hypothetical, favorite_guess: favoriteGuess, ask_origin_story: originStory,
  ask_compliment: askCompliment, love, hate, affection, aggression,
  ask_crew: crew, ask_fear: fear, ask_have: have, give, self_how: selfHow, command, frog_alert: frogAlert,
};

