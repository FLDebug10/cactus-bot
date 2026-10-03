import { FEELINGS } from "../content/lexicon.ts";
import type { IntentId } from "../understand/intents.ts";
import { channel, curiousWord, EMOJI, type Reply, type Responder, type Turn } from "./turn.ts";

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

const greet: Responder = turn => {
  const { picker, name, friend, now } = turn;
  const away = now - friend.lastSeen;
  const part = partOfDay(turn.hour);

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

const whatDoing: Responder = turn => ({
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
  if (sentiment > 0.3) return { text: picker.pick("stmt.good", ["yay!! that's awesome :D", "ooh nice!!", "that's so cool!", "love that for you!"]), gloss: "that sounds great", feel: "good_news" };
  if (sentiment < -0.3) return { text: picker.pick("stmt.bad", ["aw, that sounds rough :( *pats you with a tiny slime hand*", "oh no :( i'm sorry", "that's not fun at all"]), gloss: "i'm sorry that happened", feel: "sad_news" };

  if (/\b(not|no|never|anymore|nobody|nothing|cannot)\b/.test(turn.reading.text)) {
    return { text: picker.pick("stmt.negative", ["oh no, really?", "aw, that's not great", "hmm, that doesn't sound fun"]), gloss: "that doesn't sound good", feel: "chat", miss: true };
  }
  const word = curiousWord(turn.intent.slots["text"]?.split(" ") ?? turn.reading.tokens);
  if (word !== null && picker.chance(0.35)) {
    return { text: picker.pick("stmt.curious", [`${word}? is that bouncy?`, `ooh, ${word}! i don't think i've ever seen one`, `wait, what's ${word}? is it like moss?`]), gloss: `i was curious what ${word} is`, feel: "chat" };
  }
  return { text: picker.pick("stmt", ["ooh, tell me more!", "huh, i didn't know that", "interesting! *wobbles thoughtfully*", "mm, i see!", "oh, really?", "hmm, okay!"]), gloss: "i was listening", feel: "chat", miss: true };
};

export const SOCIAL: Partial<Record<IntentId, Responder>> = {
  greet, farewell, thank, apologize, laugh, ack, agree, disagree,
  how_are_you: howAreYou, how_is_day: howIsDay, what_doing: whatDoing, ask_thinking: thinking,
  ask_feeling: askFeeling, share_feeling: shareFeeling, distress, confused, statement, why,
};
