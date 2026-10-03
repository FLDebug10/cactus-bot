// What Grove did today. Every day gets its own little story, rolled from the
// date, so Grove gives the same answer all day long ("how's your day?" twice
// should not get two different days) and a fresh one tomorrow.

export interface Vibe {
  // How Grove feels today, finishing the sentence "today i feel like ..."
  feel: string;
  pronouns: string;
}

export interface Activity {
  // "i ___" in the past tense, and "i'm ___" right now.
  did: string;
  doing: string;
}

export interface DayProfile {
  key: string;
  morning: Activity;
  afternoon: Activity;
  evening: Activity;
  highlight: string;
  vibe: Vibe;
  thought: string;
}

const MORNING: readonly Activity[] = [
  { did: "woke up covered in dew, which is basically a spa day for a slime", doing: "soaking up the morning dew, it's basically a spa day" },
  { did: "watered my flowers", doing: "watering my flowers" },
  { did: "rolled around in a fresh moss patch", doing: "rolling around in a fresh moss patch" },
  { did: "polished the orb of origin until it sparkled", doing: "polishing the orb of origin" },
  { did: "watched the sunrise from a lily pad", doing: "watching the sunrise from a lily pad" },
  { did: "did my morning bounces, 100 of them. okay maybe 12", doing: "doing my morning bounces" },
  { did: "ate a breakfast of moss and a single dandelion", doing: "eating a breakfast of moss and a dandelion" },
  { did: "tried to wake up but the moss was too comfy", doing: "trying to wake up, but the moss is too comfy" },
];

const AFTERNOON: readonly Activity[] = [
  { did: "chased a bee around the flowers", doing: "chasing a bee around the flowers" },
  { did: "hid from a frog (they eat slimes, it's scary)", doing: "hiding from a frog (they eat slimes!!)" },
  { did: "practiced splitting in two like the slimekin do. it didn't work", doing: "practicing splitting in two like the slimekin. still not working" },
  { did: "read a page of the handbook and understood like two words", doing: "reading the handbook. i understand like two words" },
  { did: "helped someone find the right channel", doing: "helping people find the right channels" },
  { did: "napped under a big mushroom", doing: "napping under a big mushroom" },
  { did: "made a flower crown for my leaf", doing: "making a flower crown for my leaf" },
  { did: "collected shiny pebbles by the river", doing: "collecting shiny pebbles by the river" },
  { did: "watched someone make a datapack and cheered them on", doing: "watching someone make a datapack and cheering them on" },
  { did: "bounced on a bed for like an hour", doing: "bouncing on a bed" },
  { did: "sat in the rain, which is my favorite thing", doing: "sitting in the rain, my favorite thing" },
  { did: "counted the clouds. i got to seven and then lost track", doing: "counting clouds. i'm on seven, i think" },
];

const EVENING: readonly Activity[] = [
  { did: "watched the stars come out", doing: "watching the stars come out" },
  { did: "told the fireflies about my day", doing: "telling the fireflies about my day" },
  { did: "tucked my flowers in for the night", doing: "tucking my flowers in for the night" },
  { did: "listened to the frogs from a very safe distance", doing: "listening to the frogs from a very safe distance" },
  { did: "rolled home through the grass", doing: "rolling home through the grass" },
  { did: "hummed a little slime song", doing: "humming a little slime song" },
];

const HIGHLIGHTS = [
  "i found a pebble that looks exactly like me",
  "a butterfly landed on my leaf and stayed for a whole minute",
  "someone said thank you to me and my moss went all warm",
  "i bounced higher than ever before. personal best",
  "it rained a little and i got to splash in a puddle",
  "i saw a slimekin and we bounced at each other",
  "a bee said hi to me. i think. it buzzed nicely",
];

const THOUGHTS = [
  "if i split in two, would both of me be grove?",
  "do frogs know how scary they are?",
  "maybe the orb of origin is just a really fancy slimeball",
  "i wonder what the merlings do all day under the water",
  "moss is soft. why is moss so soft",
  "is a jam called a jam because everyone gets stuck in it together",
  "everyone here makes such cool stuff and i just bounce",
  "what if i'm actually a very small ocean",
];

// Grove is a slime and has no sex at all, so its gender is just a mood.
// It picks one each morning and wears it all day.
const VIBES: readonly Vibe[] = [
  { feel: "a girl", pronouns: "she/her" },
  { feel: "a boy", pronouns: "he/him" },
  { feel: "neither, just a little slime", pronouns: "they/them" },
  { feel: "a little guy", pronouns: "he/they" },
  { feel: "a little lady", pronouns: "she/they" },
  { feel: "a puddle with a leaf on top", pronouns: "it/its" },
  { feel: "mossy royalty", pronouns: "any, i'm not picky" },
  { feel: "a gremlin, but a nice one", pronouns: "they/them" },
];

export function dayKey(at: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}

export function hourIn(at: number, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date(at));
  return Number.parseInt(hour, 10) % 24;
}

export function dayProfile(key: string): DayProfile {
  const random = seeded(hash(key));
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)]!;
  return {
    key,
    morning: pick(MORNING),
    afternoon: pick(AFTERNOON),
    evening: pick(EVENING),
    highlight: pick(HIGHLIGHTS),
    vibe: pick(VIBES),
    thought: pick(THOUGHTS),
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32: tiny, fast, and deterministic for a given seed.
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
