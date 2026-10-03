import { LINKS } from "../../config.ts";
import { ageWords, CREW_ROLES, crewMemberById, FUN_FACTS, JOKES } from "../content/knowledge.ts";
import { FEELINGS } from "../content/lexicon.ts";
import type { IntentId } from "../understand/intents.ts";
import { channel, curiousWord, dayOffsetIn, EMOJI, type Reply, type Responder, safeWord, type Turn } from "./turn.ts";

// Small talk: hellos, goodbyes, feelings, and keeping a conversation going.

function partOfDay(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 23) return "evening";
  return "night";
}

// What Grove is up to right now, as "i'm ___".
function nowActivity(turn: Turn): string {
  switch (partOfDay(turn.hour)) {
    case "morning": return turn.day.morning.doing;
    case "afternoon": return turn.day.afternoon.doing;
    default: return turn.day.evening.doing;
  }
}

const CREW_GREETINGS = {
  drizzo: ["drizzo!! hi hi, it's the one who drew me!", "hi drizzo! my favorite artist :D", "drizzo! *happy wobble* you made me look so cute"],
  fld10: ["fld10! hi! thanks for the snacks (the electricity)", "hi fld10! my host and food provider!", "fld10!! *bounces* the server's nice and warm today"],
  overgrown: ["overgrown! hi! my brain says hi too", "hi overgrown! *brain wiggle*", "overgrown!! i've been thinking lots, just like you taught me"],
} as const;

const greet: Responder = turn => {
  const { picker, name, friend, now } = turn;
  const away = now - friend.lastSeen;
  const part = partOfDay(turn.hour);

  const crew = crewMemberById(turn.message.authorId);
  if (crew !== null && picker.chance(0.6)) {
    return { text: picker.pick(`greet.${crew}`, CREW_GREETINGS[crew]), gloss: `i was saying hi to ${CREW_ROLES[crew].name}, who ${CREW_ROLES[crew].theyShort}`, feel: "chat" };
  }

  if (friend.talks === 0) {
    return {
      text: picker.pick("greet.new", [
        `hi {${name}|there}! i'm grove, the server's slime ${EMOJI.grove}`,
        `oh, a new friend! hi ${name}! i'm grove {:D|hehe}`,
        `hello! i don't think we've met. i'm grove! *wobbles*`,
      ]),
      gloss: "i was saying hi and introducing myself",
      feel: "chat",
      affinity: 0.02,
    };
  }

  if (friend.talks > 2 && away > 3 * 24 * 60 * 60 * 1000) {
    return {
      text: picker.pick("greet.longtime", [
        `${name}!! it's been forever, i missed you ${EMOJI.heart}`,
        `omg hi ${name}! long time no see! *bounces*`,
        `${name}! you're back!! where have you been?`,
      ]),
      gloss: "i haven't seen you in a while and i'm happy you're back",
      feel: "chat",
    };
  }

  const timed: Record<typeof part, readonly string[]> = {
    morning: [`good morning{!|!!} i just {woke up|rolled out of my moss bed}`, `morning ${name}! the dew is extra nice today`],
    afternoon: [`hi ${name}{!| :D}`, `hello hello!`],
    evening: [`good evening{!| :D} the fireflies are coming out`, `hi ${name}! cozy evening huh`],
    night: [`hi! you're up late too huh`, `hey ${name}... *sleepy wave*`],
  };

  const lines = [
    `hii ${name}!`, `hello hello!`, `oh hi! *wobbles happily*`, `heyy {:D|hehe}`, `hi hi ${name}!`,
    `hi! i was just ${nowActivity(turn)}`, ...timed[part],
  ];
  const reply: Reply = { text: picker.pick("greet", lines), gloss: "i was just saying hi back", feel: "chat" };
  if (picker.chance(0.35)) {
    reply.text += picker.pick("greet.ask", [" how are you?", " how's it going?", " what's up?"]);
    reply.expect = { kind: "their_feeling" };
  }
  return reply;
};

const farewell: Responder = turn => {
  const night = partOfDay(turn.hour) === "night" || /\b(night|sleep|bed)\b/.test(turn.reading.text);
  return {
    text: night
      ? turn.picker.pick("bye.night", [`good night ${turn.name}! sleep tight, don't let the frogs bite`, "night night! 💤", "sweet dreams! i'll keep the moss warm"])
      : turn.picker.pick("bye", [`bye bye ${turn.name}!`, "see you later! *waves with my whole body*", `bye! come back soon ${EMOJI.heart}`, "later! have fun out there"]),
    gloss: "i was saying goodbye",
    feel: "chat",
  };
};

const thank: Responder = turn => {
  const helped = turn.lastLineToThem !== null || turn.repliedLine !== null;
  return {
    text: helped
      ? turn.picker.pick("thanks", [`you're welcome!! ${EMOJI.heart}`, "anytime {:D|hehe}", "happy to help!", "no problem! that's what i'm here for", "hehe of course!"])
      : turn.picker.pick("thanks.random", ["for what? hehe you're welcome anyway!", "aww, you're welcome! i don't know what for but i'll take it"]),
    gloss: "i was saying you're welcome",
    feel: "thanks",
    affinity: 0.04,
    reactions: turn.picker.chance(0.3) ? [EMOJI.heart] : [],
  };
};

const apologize: Responder = turn => {
  const wasMean = turn.session.insults.length > 0 || turn.session.sulkingUntil > turn.now || turn.friend.affinity < -0.1;
  if (wasMean) {
    return {
      text: turn.picker.pick("forgive", [`it's okay, i forgive you! ${EMOJI.heart}`, "aw, thank you for saying sorry. we're good!", "apology accepted! *happy wobble*"]),
      gloss: "i forgive you",
      feel: "apology",
      affinity: 0.15,
    };
  }
  return { text: turn.picker.pick("sorry", ["aw no need to be sorry!", "it's okay! you're fine", "nothing to be sorry about :)"]), gloss: "it's fine, you didn't do anything wrong", feel: "chat" };
};

const laugh: Responder = turn => {
  const atGrove = turn.repliedLine !== null || (turn.lastLineToThem !== null && turn.now - turn.lastLineToThem.at < 60_000);
  if (!atGrove || turn.picker.chance(0.5)) return { text: "", silent: true, reactions: ["😄"], feel: "laugh" };
  return { text: turn.picker.pick("laugh", ["hehe glad you liked it", "i'm pretty funny for a slime huh", "hehe :D", "*proud wobble*"]), gloss: "i'm happy you laughed", feel: "joke_landed" };
};

const ack: Responder = turn => ({ text: "", silent: true, reactions: turn.picker.chance(0.4) ? [EMOJI.grove] : [] });

const agree: Responder = turn => ({ text: turn.picker.pick("agree", ["right?? {:D|hehe}", "exactly!", "yeah!!", "glad we agree :D"]), gloss: "i agree with you", feel: "chat" });

const disagree: Responder = turn => ({ text: turn.picker.pick("disagree", ["aw okay", "hmm, fair enough", "oh! okay then", "that's okay, slimes can be wrong sometimes"]), gloss: "okay, you don't agree and that's fine", feel: "chat" });

function causeLine(turn: Turn): string {
  const cause = turn.mood.cause;
  if (cause === null) return "";
  switch (cause.event) {
    case "insult": return "someone called me mean names earlier";
    case "hate": return "someone was really mean to me earlier";
    case "aggression": return "someone kicked me earlier, ow";
    default: return "";
  }
}

const howAreYou: Responder = turn => {
  const { picker, mood } = turn;
  const cause = causeLine(turn);
  const lines: Record<typeof mood.label, readonly string[]> = {
    joyful: [`i'm SO good today!! ${turn.day.highlight}. how about you?`, "amazing!! i'm extra bouncy today. how are you?"],
    happy: [`i'm good! just ${nowActivity(turn)}. how are you?`, "pretty good! the moss is soft and the sun is out. you?", "i'm doing great, thanks for asking! how about you?"],
    okay: ["i'm okay! kinda chill today. how about you?", "not bad! just vibing in my moss patch. hbu?"],
    sad: [`a little down tbh${cause ? `... ${cause}` : ""}. but talking helps! how are you?`, "eh, kind of a gray day for me. how are you doing?"],
    hurt: [`not great${cause ? `... ${cause}` : ""}. but i'll bounce back! how are you?`, "a bit sad honestly, but you asking helps. how are you?"],
    sleepy: ["sleepy... *yawns* but good! you?", "tired but happy! my moss bed is calling me. how about you?"],
  };
  return {
    text: picker.pick(`howareyou.${mood.label}`, lines[mood.label]),
    gloss: mood.label === "hurt" || mood.label === "sad" ? "i'm feeling a bit down, but i'm okay" : "i'm doing well",
    feel: "chat",
    expect: { kind: "their_feeling" },
  };
};

const howIsDay: Responder = turn => {
  const { day, picker } = turn;
  const offset = dayOffsetIn(turn.reading.text);
  if (offset === 1) {
    const plan = turn.dayAt(1);
    return {
      text: picker.pick("day.tomorrow", [
        `tomorrow i'll probably be ${plan.afternoon.doing}! slimes don't really plan ahead though`,
        `hmm, i have a feeling i'll be ${plan.morning.doing} in the morning. after that, who knows!`,
      ]),
      gloss: "i don't really plan, but i'll probably be doing slime things tomorrow",
      act: "how_is_day",
      feel: "chat",
    };
  }
  if (offset === -1 && !/\bnight\b/.test(turn.reading.text)) {
    const past = turn.dayAt(-1);
    return {
      text: picker.pick("day.yesterday", [`yesterday was nice! i ${past.morning.did}, and later i ${past.afternoon.did}`, `pretty good! i remember that ${past.highlight}`]),
      gloss: "yesterday was a nice slime day",
      act: "how_is_day",
      feel: "chat",
    };
  }
  if (/\bnight\b/.test(turn.reading.text)) {
    return {
      text: `${picker.pick("night.story", ["it was cozy!", "really nice!", "so peaceful!"])} i ${day.evening.did}, then slept in my moss bed. ${picker.pick("night.ask", ["how was yours?", "how about you?"])}`,
      gloss: "my night was nice and cozy",
      act: "how_is_day",
      feel: "chat",
      expect: { kind: "their_day" },
    };
  }
  const part = partOfDay(turn.hour);
  const story =
    part === "morning" ? `it just started! i ${day.morning.did}` :
    part === "afternoon" ? `pretty good! i ${day.morning.did}, then i ${day.afternoon.did}` :
    `really nice! i ${day.afternoon.did}, and just now i ${day.evening.did}`;
  const extra = picker.chance(0.4) ? ` oh and ${day.highlight}!` : "";
  return {
    text: `${story}.${extra} ${picker.pick("day.ask", ["how's yours going?", "how about yours?", "how's your day been?"])}`,
    gloss: "my day's been really nice, i've just been doing normal slime stuff",
    act: "how_is_day",
    feel: "chat",
    expect: { kind: "their_day" },
  };
};

const whatDoing: Responder = turn => {
  if (dayOffsetIn(turn.reading.text) === 1) {
    return {
      text: `tomorrow? probably ${turn.dayAt(1).afternoon.doing}! but i never really know until i wake up`,
      gloss: "i don't plan much, but i'll probably be doing slime stuff",
      feel: "chat",
    };
  }
  if (/\b(all day|for fun|free time|every day|usually|on weekends|at night|no one is around)\b/.test(turn.reading.text)) {
    const { day } = turn;
    return {
      text: turn.picker.pick("doing.routine", [
        `slime stuff! today i ${day.morning.did}, then i ${day.afternoon.did}. most days are moss, naps, and saying hi to people`,
        `i bounce around saying hi, help people find the right channel, and nap in my moss. today i also ${day.afternoon.did}!`,
      ]),
      gloss: "i do slime stuff: moss, naps, and saying hi to people",
      act: "what_doing",
      feel: "chat",
    };
  }
  return whatDoingNow(turn);
};

const whatDoingNow = (turn: Turn): Reply => ({
  text: turn.picker.pick("doing", [
    `just ${nowActivity(turn)}! what about you?`,
    "talking to you! and wobbling a little",
    `honestly? i was just thinking... ${turn.day.thought}`,
    partOfDay(turn.hour) === "night" ? "trying to sleep, but the server's never fully quiet. you?" : "bouncing around the server, saying hi to people!",
  ]),
  gloss: "i was telling you what i'm up to",
  feel: "chat",
  expect: { kind: "their_feeling" },
});

// "what time is it?", "how's the weather?": Grove only knows its own corner of the world.
const now: Responder = turn => {
  const text = turn.reading.text;
  const { picker, calendar, day } = turn;
  const part = partOfDay(turn.hour);
  const reply = (line: string, gloss: string): Reply => ({ text: line, gloss, act: "ask_now", feel: "chat" });
  if (/\braining\b/.test(text)) {
    return reply(day.weather.startsWith("rainy") ? "it rained here today! i sat right in it" : `not here! it's ${day.weather} in my moss patch`, `the weather here is ${day.weather}`);
  }
  if (/\b(weather|sunny|snowing|cold|hot|warm|cloudy|stormy|windy)\b/.test(text)) {
    return reply(picker.pick("weather", [`here it's ${day.weather}! i can't see your window though`, `in my moss patch it's ${day.weather}. how is it where you are?`]), `the weather here is ${day.weather}`);
  }
  if (/\b(weekend|weekday)\b/.test(text)) {
    const weekend = calendar.weekday === "saturday" || calendar.weekday === "sunday";
    return reply(weekend ? `yes!! it's ${calendar.weekday}! extra nap time` : `nope, it's ${calendar.weekday}. the weekend is coming though!`, `today is ${calendar.weekday}`);
  }
  if (/^(grove )?is it (night|day|morning|evening|afternoon)\b/.test(text)) {
    return reply(`for me it's ${part === "night" ? "nighttime" : part}! the moss patch is ${part === "night" ? "all dark and cozy" : "nice and bright"}`, `it's ${part} where i live`);
  }
  if (/\btime\b/.test(text)) {
    const hour = turn.hour % 12 === 0 ? 12 : turn.hour % 12;
    const half = turn.hour < 12 ? "am" : "pm";
    return reply(picker.pick("time", [`around ${hour} ${half} where i live! slime time is mostly nap time though`, `it's ${hour}-something ${half} for me! i don't have a clock, i just look at the sun`]), `it's around ${hour} ${half} where i live`);
  }
  if (/\byear\b/.test(text)) return reply(`${calendar.year}! my very first year, i'm only ${ageWords(turn.now)}`, `it's ${calendar.year}`);
  if (/\bmonth\b/.test(text)) return reply(`it's ${calendar.month}! ${calendar.month === "september" || calendar.month === "october" || calendar.month === "november" ? "the leaves are changing, but mine stays green" : "a very good month for moss"}`, `it's ${calendar.month}`);
  return reply(picker.pick("date", [`it's ${calendar.weekday}, ${calendar.month} ${calendar.date}! i think. slimes are bad at calendars`, `${calendar.weekday}! ${calendar.month} ${calendar.date}, if my moss is right`]), `today is ${calendar.weekday}, ${calendar.month} ${calendar.date}`);
};

const thinking: Responder = turn => ({
  text: turn.picker.pick("thinking", [`honestly? ${turn.day.thought}`, `i was wondering... ${turn.day.thought}`, "mostly moss. it's always moss"]),
  gloss: "i was sharing a random thought i had",
  feel: "chat",
});

const askFeeling: Responder = turn => {
  const asked = turn.intent.slots["feeling"] ?? "";
  const kind = FEELINGS[asked];
  const label = turn.mood.label;
  const sad = label === "sad" || label === "hurt";
  let text: string;
  if (asked === "hungry") text = turn.picker.pick("hungry", ["a little! i could go for some moss", "always a bit hungry for flowers hehe"]);
  else if (kind === "tired") text = label === "sleepy" ? "so tired... *yawns*" : "nope! i'm wide awake";
  else if (kind === "bored") text = "never! there's always someone fun to talk to here";
  else if (kind === "lonely") text = "not right now, you're here!";
  else if (kind === "bad") text = sad ? `a little${causeLine(turn) ? `... ${causeLine(turn)}` : ""}. but i'll be okay!` : "nope! i'm happy right now :D";
  else text = sad ? "not super happy right now... but getting better" : "yep! very happy :D";
  return { text, gloss: "i was telling you how i feel", feel: "chat" };
};

function respondToFeeling(turn: Turn, feelingWord: string | undefined): Reply {
  const kind = feelingWord !== undefined ? FEELINGS[feelingWord] : undefined;
  const mood = kind ?? (turn.sentiment > 0.15 ? "good" : turn.sentiment < -0.15 ? "bad" : undefined);
  const { picker } = turn;
  switch (mood) {
    case "good": return { text: picker.pick("feel.good", ["yay!! that makes me happy too :D", "that's awesome!! *happy bounce*", "glad to hear it!"]), gloss: "i'm happy you're doing well", feel: "good_news" };
    case "bad": return { text: picker.pick("feel.bad", ["aw no :( do you want a hug? *wobbles closer*", "i'm sorry :( i hope it gets better. sending squishy hugs", "that sounds rough. i'm here if you wanna talk"]), gloss: "i'm sorry you're feeling bad", feel: "sad_news" };
    case "tired": return { text: picker.pick("feel.tired", ["go get some rest! even slimes need naps", "sleep is important! moss beds are the best, if you can find one"]), gloss: "you should rest", feel: "chat" };
    case "bored": return { text: picker.pick("feel.bored", [`ooh, you could make a datapack! or check ${channel("jamInfo")} in case a jam is going on`, "wanna hear a joke? just ask!", "we could talk! tell me something fun"]), gloss: "i was suggesting something to do", feel: "chat" };
    case "lonely": return { text: picker.pick("feel.lonely", [`i'm here! you can talk to me anytime ${EMOJI.heart}`, "you're not alone, i'm right here! *sits next to you*"]), gloss: "you can always talk to me", feel: "chat" };
    default: return { text: picker.pick("feel.neutral", ["that's fair! days like that are okay too", "mm, i get that", "fair enough! thanks for telling me"]), gloss: "okay, thanks for telling me", feel: "chat" };
  }
}

const shareFeeling: Responder = turn => respondToFeeling(turn, turn.intent.slots["feeling"]);

const distress: Responder = turn => ({
  text: turn.picker.pick("distress", [
    "hey, i'm really sorry you're feeling like that. i'm just a little slime, but you matter a lot. please talk to someone you trust, or a crisis line where you live. you can also dm me and the staff team will see it 💚",
  ]),
  gloss: "i'm worried about you, and talking to someone you trust really helps",
  act: "distress",
  feel: "sad_news",
});

// "what does that even mean?" Look up the line they mean and say it plainly.
const confused: Responder = turn => {
  const line = turn.repliedLine ?? turn.lastLineToThem ?? (turn.lastLineHere !== null && turn.now - turn.lastLineHere.at < 2 * 60_000 ? turn.lastLineHere : null);
  if (line === null) {
    return { text: turn.picker.pick("confused.none", ["hm? what's confusing? i'm a little lost too hehe", "what do you mean? i'm just a slime, you might have to say it slower"]), gloss: null, feel: "chat" };
  }
  if (line.gloss === null || line.gloss.length === 0) {
    return { text: turn.picker.pick("confused.nogloss", ["honestly i'm not sure either, my brain is mostly moss hehe", "uhh... good question. i think i got my words tangled"]), gloss: null, feel: "chat" };
  }
  const forThem = line.toUserId === turn.message.authorId;
  const text = forThem
    ? turn.picker.pick("clarify.self", [`oh sorry! i meant ${line.gloss}`, `oops, i just meant ${line.gloss}`, `i was just saying ${line.gloss} hehe`])
    : turn.picker.pick("clarify.other", [`oh, i was telling ${line.toUserName} that ${line.gloss}`, `i meant ${line.gloss}! i was talking to ${line.toUserName} hehe`]);
  return { text, gloss: line.gloss, act: "clarify", topic: line.topic, feel: "chat" };
};

// "where am i 😨"
const whereAmI: Responder = turn => {
  const scared = turn.reading.emojis.some(emoji => ["😨", "😰", "😱", "😳", "😟", "🫣"].includes(emoji));
  const lead = scared ? "don't panic! " : "";
  return {
    text: lead + turn.picker.pick("where_am_i", [
      `you're in <#${turn.message.channelId}>, in the overgrown's origins server! it's safe here`,
      "on discord, in front of a screen... when you should be outside touching grass and meeting other slimes",
      "you're in the overgrown's origins discord! home of apoli, origins, and me",
      "somewhere cozy, with me! that's all that matters",
    ]),
    gloss: "you're in the overgrown's origins discord server",
    act: "where_am_i",
    feel: "chat",
  };
};

// "tell me more": keep going on whatever Grove just said.
const more: Responder = turn => {
  const line = turn.repliedLine ?? turn.lastLineToThem;
  const { picker } = turn;
  const act = line?.act ?? "";
  if (act === "joke") return { text: picker.pick("joke", JOKES), gloss: "it was another joke", act: "joke", feel: "chat" };
  if (act === "fact") return { text: `${picker.pick("fact.more", ["okay okay, another one!", "ooh, here's another!"])} ${picker.pick("fact", FUN_FACTS)}`, gloss: "i shared another fun fact", act: "fact", feel: "chat" };
  if (act === "how_is_day" || act === "what_doing" || line?.intent === "how_are_you") {
    return { text: picker.pick("more.day", [`oh and ${turn.day.highlight}!`, `oh, and i keep wondering... ${turn.day.thought}`]), gloss: "i was telling you more about my day", act: "how_is_day", feel: "chat" };
  }
  if (act.startsWith("define") || act.startsWith("howto") || act.startsWith("versions") || act.startsWith("install")) {
    return { text: `the handbook has way more about it than my mossy brain: <${LINKS.handbook}>`, gloss: "the handbook explains it in more detail", act: "define.more", feel: "chat" };
  }
  if (act.startsWith("route")) return { text: "that's pretty much it! the people in that channel can help way more than me", gloss: "that channel is the right place for the rest", feel: "chat" };
  if (act === "gender") return { text: "that's all there is to it! i pick a new one every morning", gloss: "my gender changes every day", act: "gender", feel: "chat" };
  return { text: picker.pick("more.none", ["hmm, that's all i've got! i'm a slime of few words", "that's it, that's the whole story hehe"]), gloss: null, feel: "chat" };
};

// "really?": Grove stands by what it said, unless it was joking.
const doubt: Responder = turn => {
  const line = turn.repliedLine ?? turn.lastLineToThem;
  const { picker } = turn;
  if (line === null) return { text: "really what? hehe", gloss: null, feel: "chat" };
  if (line.act === "joke") return { text: picker.pick("doubt.joke", ["okay no, it was a joke hehe", "it's a joke! laugh! please?"]), gloss: "that was just a joke", feel: "chat" };
  if (line.act === "eightball") return { text: "i mean... my moss isn't always right", gloss: "it was just a guess", feel: "chat" };
  return { text: picker.pick("doubt", ["yep! slime's honor", "for real for real!", "yes really! would this face lie to you?"]), gloss: line.gloss ?? "i meant what i said", feel: "chat" };
};

// "why?" right after Grove said something: give the reason behind that line.
const why: Responder = turn => {
  const line = turn.repliedLine ?? turn.lastLineToThem;
  if (line === null || line.gloss === null || line.gloss.length === 0) {
    return { text: turn.picker.pick("why.none", ["hmm, i don't really know why... that's just how slimes are!", "because! slime logic, it's very complicated"]), gloss: null, feel: "chat" };
  }
  return { text: turn.picker.pick("why", [`well, ${line.gloss}`, `because ${line.gloss}!`, `hmm, mostly because ${line.gloss}`]), gloss: line.gloss, act: "why", topic: line.topic, feel: "chat" };
};

// Answers to something Grove asked a moment ago. Returns null when the message
// does not look like an answer, so the normal intent handling runs instead.
export function answerExpectation(turn: Turn): Reply | null {
  const expectation = turn.expectation;
  if (expectation === null) return null;
  const id: IntentId = turn.intent.id;

  switch (expectation.kind) {
    case "their_day":
    case "their_feeling": {
      if (id === "share_feeling" || id === "statement" || id === "agree" || id === "disagree" || id === "ack") {
        const feeling = turn.intent.slots["feeling"] ?? turn.reading.tokens.find(token => FEELINGS[token] !== undefined);
        const reply = respondToFeeling(turn, feeling);
        reply.expect = null;
        return reply;
      }
      return null;
    }
    default:
      return null;
  }
}

// When nothing more specific fits: react to the feeling of what was said, or
// get curious about it, the way a small creature would.
const statement: Responder = turn => {
  const { picker, sentiment } = turn;
  // Replying to Grove's own message, a feeling is usually about that message.
  if (turn.repliedLine !== null && sentiment > 0.3) {
    return { text: picker.pick("stmt.aboutme.good", [`aww thank you!! ${EMOJI.heart}`, "hehe, i'm glad you liked it!", "eee, that makes me so happy"]), gloss: "thank you, i'm happy you liked it", feel: "compliment", affinity: 0.04 };
  }
  if (turn.repliedLine !== null && sentiment < -0.3) {
    return { text: picker.pick("stmt.aboutme.bad", ["aw, sorry :( i'll try to do better", "oh no, did i say something wrong?"]), gloss: "sorry if that wasn't helpful", feel: "sad_news" };
  }
  const news = newsIn(turn);
  if (news !== null) return news;
  if (sentiment > 0.3) return { text: picker.pick("stmt.good", ["yay!! that's awesome :D", "ooh nice!!", "that's so cool!", "love that for you!"]), gloss: "that sounds great", feel: "good_news" };
  if (sentiment < -0.3) return { text: picker.pick("stmt.bad", ["aw, that sounds rough :( *pats you with a tiny slime hand*", "oh no :( i'm sorry", "that's not fun at all"]), gloss: "i'm sorry that happened", feel: "sad_news" };

  if (/\b(not|no|never|anymore|nobody|nothing|cannot)\b/.test(turn.reading.text)) {
    return { text: picker.pick("stmt.negative", ["oh no, really?", "aw, that's not great", "hmm, that doesn't sound fun"]), gloss: "that doesn't sound good", feel: "chat", miss: true };
  }
  const word = curiousWord(turn.intent.slots["text"]?.split(" ") ?? turn.reading.tokens);
  if (word !== null && picker.chance(0.35)) {
    return { text: picker.pick("stmt.curious", [`${word}? is that bouncy?`, `ooh, ${word}! i don't think i've ever seen one`, `wait, what's ${word}? is it like moss?`]), gloss: `i was curious what ${word} is`, feel: "chat" };
  }
  return {
    text: picker.pick("stmt", [
      "ooh, tell me more!",
      "huh, i didn't know that! *files it away in my moss brain*",
      "interesting! *wobbles thoughtfully*",
      "ooh! my leaf perked up, keep going",
      "oh, really?",
      "noted! well, as noted as a slime can note things",
    ]),
    gloss: "i was listening",
    feel: "chat",
    miss: true,
  };
};

const PETS = new Set(["dog", "puppy", "cat", "kitten", "bird", "fish", "hamster", "bunny", "rabbit", "turtle", "snake", "lizard", "parrot", "pet"]);
const NOT_NEWS = new Set(["question", "problem", "idea", "issue", "bug", "doubt", "feeling", "headache", "test", "exam", "cold", "flu", "crash", "error"]);

// "i got a new dog", "i made a datapack": good news gets cheered on.
function newsIn(turn: Turn): Reply | null {
  const match = /\bi (?:just )?(?<verb>got|bought|made|built|found|adopted|finished|drew|won|painted|baked|caught|have) (?<article>a |an |my |some )?(?<fresh>new |first |own )?(?<thing>[a-z]+)\b/.exec(turn.reading.text)?.groups;
  if (match === undefined) return null;
  const thing = safeWord(match["thing"], 16);
  const verb = match["verb"] ?? "";
  if (thing === null || NOT_NEWS.has(thing) || (verb === "have" && match["fresh"] === undefined)) return null;
  const { picker } = turn;
  const article = (match["article"] ?? "").trim();
  const named = article === "a" || article === "an" ? `${article} ${thing}` : thing;
  const reply = (text: string): Reply => ({ text, gloss: `i was happy about your ${thing}`, feel: "good_news" });
  if (thing === "frog" || thing === "frogs") return reply("a FROG?? please keep it far away from me");
  if (PETS.has(thing)) return reply(picker.pick("news.pet", [`${named}?! that's so cool, what's its name?`, `aww, ${named}! give it a pat from me`]));
  if (verb === "won") return reply(`you won?! congrats!! ${EMOJI.heart}`);
  if (/^(made|built|finished|drew|painted|baked)$/.test(verb)) return reply(picker.pick("news.made", [`ooh, you ${verb} ${named}? that's so cool, i'm proud of you!`, `you ${verb} ${named}?! that's awesome!!`]));
  return reply(picker.pick("news", [`ooh, ${named}! that's so cool`, `${named}?! nice!! tell me everything`]));
}

export const SOCIAL: Partial<Record<IntentId, Responder>> = {
  greet, farewell, thank, apologize, laugh, ack, agree, disagree,
  how_are_you: howAreYou, how_is_day: howIsDay, what_doing: whatDoing, ask_thinking: thinking,
  ask_feeling: askFeeling, share_feeling: shareFeeling, distress, confused, statement, why, more, doubt, where_am_i: whereAmI,
  ask_now: now,
};
