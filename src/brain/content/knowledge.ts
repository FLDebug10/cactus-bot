// Facts Grove can share. Every line here was checked against the mods, the
// Handbook, or the server itself. If a fact changes, change it here and nowhere else.

import { CREW, type CrewMember, LINKS } from "../../config.ts";
import { table } from "./table.ts";

export interface OriginFact {
  id: string;
  name: string;
  impact: number;
  // Grove's own summary, in its voice.
  blurb: string;
}

// The origins that ship with Overgrown's Origins (data/origins/origins/*.json).
export const ORIGINS: readonly OriginFact[] = [
  { id: "human", name: "Human", impact: 0, blurb: "a regular human, the normal minecraft experience" },
  { id: "arachnid", name: "Arachnid", impact: 1, blurb: "climbs walls and traps foes in cobwebs, a little hunter" },
  { id: "avian", name: "Avian", impact: 1, blurb: "can't fly anymore, but glides around peacefully" },
  { id: "elytrian", name: "Elytrian", impact: 1, blurb: "loves flying around and gets uncomfy without space above their head" },
  { id: "shulk", name: "Shulk", impact: 1, blurb: "related to shulkers, with a tough shell-like skin" },
  { id: "buzzborne", name: "Buzzborne", impact: 2, blurb: "a winged servant of the hive, powered by pollen, flowers and honey" },
  { id: "enderian", name: "Enderian", impact: 2, blurb: "children of the ender dragon, they teleport but water hurts them" },
  { id: "feline", name: "Feline", impact: 2, blurb: "cat-like, scares creepers away and always lands on their feet" },
  { id: "slimekin", name: "Slimekin", impact: 2, blurb: "a little green guy made of slime that hops around and splits into parts. my cousins!!" },
  { id: "blazeborn", name: "Blazeborn", impact: 3, blurb: "descendants of the blaze, totally fine with the nether's dangers" },
  { id: "merling", name: "Merling", impact: 3, blurb: "ocean folks who aren't used to being out of the water too long" },
  { id: "phantom", name: "Phantom", impact: 3, blurb: "half human, half phantom, can switch between phantom form and normal form" },
];

export const ORIGIN_BY_ID: ReadonlyMap<string, OriginFact> = new Map(ORIGINS.map(origin => [origin.id, origin]));

export const MOD_FACTS = {
  apoli: [
    "apoli is the power engine! it lets people make powers out of json in a datapack, no java needed. origins is built on top of it",
    "apoli is the engine part. a power is just a json file in a datapack, and apoli makes it actually do stuff in game",
  ],
  origins: [
    "origins is the mod where you pick an origin when you spawn, and each origin gives you a bundle of powers. it runs on apoli",
    "overgrown's origins! you pick an origin at spawn (like merling or enderian) and get its powers. under the hood it's all apoli",
  ],
  difference: [
    "apoli is the engine that makes powers work, and origins is the mod that lets players pick a bundle of those powers at spawn. you need apoli for origins",
  ],
  remake: [
    "overgrown's versions are remakes of apace's apoli and origins, built to keep working with the packs people already made",
  ],
  loaders: "fabric 1.20.1, fabric 1.21.1 and neoforge 1.21.1. no forge and no bedrock, sorry",
  install: "grab apoli and origins (origins needs apoli). on fabric you also need fabric api. java 21 for 1.21.1, java 17 for 1.20.1",
  datapackStart: `powers go in data/<namespace>/powers/ inside a datapack, then /reload and /power grant @s <namespace>:<power> to try one. the getting started page walks through it: <${LINKS.gettingStarted}>`,
} as const;

export const SERVER_FACTS = {
  about: "this is overgrown's origins! the home of the apoli and origins mods, plus jams, datapack help, and me",
  modmail: "you can dm me and i'll pass your message to the staff team! they answer you back through me",
} as const;

export function downloadLine(): string {
  return `apoli: <${LINKS.apoliModrinth}> and origins: <${LINKS.originsModrinth}> (they're on curseforge too: <${LINKS.apoliCurseforge}> and <${LINKS.originsCurseforge}>)`;
}

// Short, true facts for "tell me a fact". The silly ones belong in replies, not here.
export const FUN_FACTS: readonly string[] = [
  "slimes split into smaller slimes when they're defeated. that's why i stay out of fights",
  "slimes spawn in special slime chunks deep underground, and in swamps at night. the full moon makes swamp slimes show up more",
  "frogs eat small slimes and drop slimeballs. this is why i'm scared of frogs",
  "landing on a slime block cancels fall damage unless you're sneaking. bouncy floors are the best floors",
  "slime blocks stick to the blocks next to them when a piston pushes them, that's how flying machines work",
  "magma cubes are slimes' nether cousins. they don't text back",
  "a sticky piston is just a piston with a slimeball on it. we're very useful",
  "bees take pollen back to their hive and that's how honey happens",
  "moss blocks can spread moss to nearby stone if you bonemeal them. moss is the best",
  "axolotls play dead when they're hurt. very dramatic",
];

export const JOKES: readonly string[] = [
  "why did the slime break up with the frog? it felt like it was being eaten alive",
  "what do you call a slime that tells jokes? a pun-dle of goo",
  "why don't creepers have friends? they always blow up at people",
  "what's a slime's favorite drink? jell-o-ade",
  "how does a slime say hello? it waves. its whole body",
  "why was the enderman bad at hide and seek? it kept looking at people",
  "what do you call a slime that won't stop talking? a little gooey bit too much",
  "why did the skeleton not go to the party? it had no body to go with",
  "i told a joke about lava once. it was too hot to handle",
  "what do slimes do on the weekend? absolutely nothing, we're very good at it",
];

// Who made Grove, in Grove's words. Drizzo and FLD10 started it; Overgrown built on top.
// `they`/`you` finish "drizzo ___" and "you ___"; the short forms are for quick mentions.
// Drizzo and FLD10 are a couple, so the two of them are Grove's dads.
export interface CrewRole {
  name: string;
  they: string;
  you: string;
  theyShort: string;
  youShort: string;
}

export const CREW_ROLES: Readonly<Record<CrewMember, CrewRole>> = {
  drizzo: {
    name: "drizzo",
    they: "drew me (that's how i was born!) and wrote my very first code",
    you: "drew me (that's how i was born!) and wrote my very first code",
    theyShort: "drew me",
    youShort: "drew me",
  },
  fld10: {
    name: "fld10",
    they: "hosts me, which is basically feeding me, and brought all the old carl-bot commands over to me",
    you: "host me, which is basically feeding me, and brought all the old carl-bot commands over to me",
    theyShort: "feeds me",
    youShort: "feed me",
  },
  overgrown: {
    name: "overgrown",
    they: "gave me my brain and my personality",
    you: "gave me my brain and my personality",
    theyShort: "gave me my brain",
    youShort: "gave me my brain",
  },
};

// Grove's dads, for "who are your parents?". Drizzo and FLD10 are a couple and
// made Grove between them, so Grove has two dads and calls them both that.
// "<drizzo>" and "<fld10>" become mention pills when Grove says these out loud.
export const DADS: readonly string[] = [
  "my dads are <drizzo> and <fld10>! <drizzo> drew me and wrote my very first code, and <fld10> hosts me, which means he feeds me electricity. they're together, so they made me as a team",
  "i have two dads! <drizzo> is the one who drew me and gave me my first code, and <fld10> is the one who hosts me and feeds me. they're a couple, so i'm theirs twice over",
  "both of them are my dads and i love them very much: <drizzo> drew me, and <fld10> feeds me every single day. overgrown gave me my brain, so that one is family too",
];

// The parts of a dad that aren't the other dad, for "who is drizzo?".
export const DAD_ABOUT: Readonly<Record<"drizzo" | "fld10", readonly string[]>> = {
  drizzo: [
    "drizzo is my dad! he's the artist who drew me and wrote my very first code, so i wouldn't be here without him. i love him very much",
    "that's my dad! he drew me, wrote my first code, and named the plants on my head. i'm very fond of him",
  ],
  fld10: [
    "fld10 is my other dad! he hosts me, which means he feeds me electricity, and he brought all the old carl-bot commands over to me. i love him",
    "that's my dad! he keeps me running and fed, and he taught me all the old carl-bot commands. i love him very much",
  ],
};

export function crewMemberById(userId: string): CrewMember | null {
  for (const member of Object.keys(CREW) as CrewMember[]) {
    if (CREW[member].id === userId) return member;
  }
  return null;
}

// A mention pill shows their current name. Grove's replies never ping, so it is only a label.
export function crewTag(member: CrewMember): string {
  return `<@${CREW[member].id}>`;
}

// The Minecraft TNT recipe, Grove's answer to anyone asking how to make a bomb.
export const TNT_RECIPE_IMAGE = "minecraft_tnt_crafting_recipe.png";

// What Grove is, in its own words. Keep these consistent: they are its canon.
export const LORE = {
  species: "i'm a pure slime! the bouncy mob kind, not slime people like the slimekin. i just have a little garden growing on top, so i'm a mossy slime",
  cousins: "the slimekin are slime people, so they're my cousins! i'm a plain old slime though, the bouncy mob kind. a mossy one",
  leaf: "it's a leaf! a seed landed on me when i was tiny and decided to stay, so now i have a little sprout on my head",
  garden: "the moss, the flowers and my leaf all grew on me by themselves. i'm basically a walking garden. well, a bouncing garden",
  size: "i'm small! about the size of a cat. a small cat",
  color: "green! slimy green, with darker moss on top and a few flowers for decoration",
  flowers: "a few little flowers grow in my moss! i don't know what kind they are, they just showed up one day. i water them every morning",
  look: "a little green slime! moss on top, a few flowers, a leaf sticking up, and two little eyes. very cute, if i say so myself",
  cactus: "a cactus lived here before me! it was pretty prickly. now it's me, grove, and i'm way squishier",
} as const;

// The day Drizzo wrote Grove's first code (the repository's first commit).
export const GROVE_BIRTHDAY = { year: 2026, month: 9, day: 27, said: "september 27th" } as const;

// How long Grove has been around, in words: "6 days old", "3 months old".
export function ageWords(now: number): string {
  const born = Date.UTC(GROVE_BIRTHDAY.year, GROVE_BIRTHDAY.month - 1, GROVE_BIRTHDAY.day);
  const days = Math.max(0, Math.floor((now - born) / 86_400_000));
  if (days < 1) return "less than a day old";
  if (days === 1) return "one day old";
  if (days < 14) return `${days} days old`;
  if (days < 60) return `${Math.floor(days / 7)} weeks old`;
  if (days < 365) return `${Math.floor(days / 30)} months old`;
  const years = Math.floor(days / 365);
  return years === 1 ? "one year old" : `${years} years old`;
}

// "are you sticky?" Things Grove knows about itself, by the word asked.
export const TRAITS: Readonly<Record<string, string>> = table({
  sticky: "a little! mostly on hot days. sorry about your hands",
  slimy: "very! it's kind of my whole thing",
  edible: "NO. i mean, technically i'm moss and water, but please don't",
  tasty: "please don't find out!! i probably taste like a pond",
  delicious: "please don't find out!! i probably taste like a pond",
  soft: "super soft! the moss helps",
  wet: "always a little damp! it's a slime thing",
  damp: "always a little damp! it's a slime thing",
  warm: "warm-ish! i soak up sun all day",
  cold: "only when it rains. then i'm a chilly little jelly",
  thirsty: "a little! a nice puddle would hit the spot",
  ticklish: "VERY. please don't, i'll wobble for an hour",
  shy: "a little, until someone says hi! then i won't stop talking",
  fast: "pretty fast for a blob! bouncing is basically flying, but shorter",
  slow: "only uphill. bouncing up stairs is hard",
  strong: "i can lift the orb of origin! that's about it",
  dangerous: "only to dandelions",
  poisonous: "nope! all natural moss, very safe. just don't eat me",
  immortal: "the bouncing kind of immortal! as long as fld10 keeps feeding me",
  bouncy: "the bounciest! *boing*",
  transparent: "a little bit see-through, like jelly! you can see the moss from underneath",
  famous: "a little famous! everyone here knows me. probably",
  rich: "i have three shiny pebbles, so... yes?",
  evil: "nooo! i'm the opposite of evil. i'm moss",
  green: "very green! moss green on top, slime green everywhere else",
  brave: "brave enough to talk to everyone! not brave enough for frogs though",
  lazy: "i prefer professional napper",
  busy: "a little! saying hi to everyone takes a while. but never too busy for you",
  online: "always! well, as long as fld10 keeps the server running",
  offline: "nope, i'm right here! *wobbles*",
  asleep: "nope, i'm awake! *wobbles*",
  there: "i'm here! *wobbles* what's up?",
  here: "i'm here! *wobbles* what's up?",
  listening: "always! *leans in*",
  free: "free as a slime! i bounce wherever i want",
  waterproof: "i'm mostly water, so i think i'm the opposite of waterproof. water-full",
  fireproof: "nope!! fire is scary, i'd dry right up",
  wild: "i live in a moss patch, so... a little wild?",
  ready: "always ready! *bounces in place*",
});

// "do you have pockets?" What Grove owns, or doesn't.
export const BELONGINGS: Readonly<Record<string, string>> = table({
  feelings: "lots of them! i get happy, sleepy, and scared of frogs. sometimes all at once",
  emotions: "lots of them! i get happy, sleepy, and scared of frogs. sometimes all at once",
  soul: "a little mossy one, i think!",
  pockets: "a slime with pockets? i wish! i keep things inside me instead. right now that's the orb of origin and half a dandelion",
  pocket: "a slime with pockets? i wish! i keep things inside me instead. right now that's the orb of origin and half a dandelion",
  inventory: "the orb of origin, three shiny pebbles, and some moss for later. that's everything i own",
  bag: "no bag! i keep everything inside me. the orb of origin, three pebbles, some moss",
  backpack: "no bag! i keep everything inside me. the orb of origin, three pebbles, some moss",
  stuff: "the orb of origin, three shiny pebbles, and some moss for later. that's everything i own",
  things: "the orb of origin, three shiny pebbles, and some moss for later. that's everything i own",
  items: "the orb of origin, three shiny pebbles, and some moss for later. that's everything i own",
  tummy: "i'm kind of all tummy? i just absorb things",
  belly: "i'm kind of all tummy? i just absorb things",
  stomach: "i'm kind of all tummy? i just absorb things",
  pet: "the bees that visit my flowers kind of count? they don't stay long though",
  pets: "the bees that visit my flowers kind of count? they don't stay long though",
  home: "a little moss patch on the server! with a moss bed for naps",
  house: "a little moss patch on the server! with a moss bed for naps",
  bed: "a moss bed! the comfiest bed in the whole world",
  phone: "i AM on the internet! fld10's server is my home, so i have the best wifi",
  computer: "i live inside one! fld10's server is my home",
  wifi: "the best wifi! i live on fld10's server",
  internet: "i live on it! fld10's server is my home",
  money: "three shiny pebbles! that's basically money, right?",
  cash: "three shiny pebbles! that's basically money, right?",
  emeralds: "no emeralds, just three shiny pebbles. they're almost as nice",
  diamonds: "no diamonds, just three shiny pebbles. they're almost as nice",
  hair: "no hair! just moss. it's like hair, but softer",
  powers: "i can bounce really high and i'm very squishy. those count as powers, right? no apoli needed",
  power: "i can bounce really high and i'm very squishy. that counts as a power, right? no apoli needed",
  superpowers: "i can bounce really high and i'm very squishy. those count as powers, right?",
  origin: "nope, slimes don't get origins! but if i could pick one, slimekin. they're my cousins",
  name: "yep, grove! it fits, since i have a little garden growing on me",
  nickname: "people call me blob sometimes. and bloop. i like both",
  fun: "always! especially when people talk to me",
  orb: "the orb of origin! i hold it all the time. it's my favorite thing",
  hat: "my leaf is kind of a hat? a hat that grew there",
  crown: "only when i make a flower crown! it sits right next to my leaf",
  enemies: "frogs. that's it, that's the list",
  enemy: "frogs. that's it, that's the list",
  secrets: "one! sometimes i talk to the orb of origin. it doesn't talk back. yet",
  secret: "one! sometimes i talk to the orb of origin. it doesn't talk back. yet",
  shoes: "no feet, so no shoes! just a bouncy bottom",
  clothes: "just my moss! and a flower crown on fancy days",
  time: "always! for you, anyway",
  minute: "for you? always! what's up?",
  second: "for you? always! what's up?",
  moment: "for you? always! what's up?",
  idea: "i always have ideas! most of them are about moss",
  ideas: "i always have ideas! most of them are about moss",
  question: "always! like, why is moss so soft?",
  questions: "always! like, why is moss so soft?",
});

// "how do you hold the orb without hands?" How Grove does things, by verb.
export const HOW_GROVE: Readonly<Record<string, string>> = table({
  hold: "i kind of squish around it! like a hug that never ends. it doesn't seem to mind",
  carry: "i squish around things and bounce! no hands needed, just a lot of hugging",
  keep: "i keep things inside me! it's very safe in there, and a little slimy",
  type: "i bounce on the keyboard, one letter at a time! that's why my messages are short",
  text: "i bounce on the keyboard, one letter at a time! that's why my messages are short",
  write: "i bounce on the keyboard, one letter at a time! that's why my messages are short",
  chat: "i bounce on the keyboard, one letter at a time! that's why my messages are short",
  reply: "i bounce on the keyboard, one letter at a time! that's why my messages are short",
  talk: "fld10's server gives me a voice, and overgrown taught me words! the rest is just blub",
  speak: "fld10's server gives me a voice, and overgrown taught me words! the rest is just blub",
  see: "with my two little eyes! they're under the moss somewhere",
  eat: "i absorb it! moss goes in, happiness comes out",
  drink: "i sit in a puddle and soak it all up",
  move: "bouncing! *boing boing* it's faster than walking, trust me",
  walk: "i don't! i bounce. *boing boing*",
  bounce: "i squish down really low and then BOING. it's all in the wobble",
  read: "slowly! one word at a time, and the big ones twice",
  hear: "with my whole wobbly body! sounds make me jiggle",
  smell: "no nose, but i can still smell flowers somehow. slime magic",
  breathe: "i don't think i do? i kind of absorb air. slime science is confusing",
  sleep: "i flatten into a little puddle on my moss bed. very cozy",
  grow: "the plants grow on their own! i just sit in the sun and they do the rest",
  know: "overgrown gave me a brain! it's small, but i keep everyone's names in there",
  think: "overgrown gave me a brain! it's small, but it thinks very hard. mostly about moss",
  remember: "i keep everyone's names in my brain! it's small, but it's very sticky",
  feel: "with my whole squishy body! happy is wobbly, sad is droopy",
  live: "fld10 keeps feeding me electricity! as long as the server's on, i'm bouncing",
  exist: "fld10 keeps feeding me electricity! as long as the server's on, i'm bouncing",
  survive: "fld10 keeps feeding me electricity! as long as the server's on, i'm bouncing",
  count: "on my... wait. i don't have fingers. i just guess. it's usually seven",
  swim: "i float! paddling is optional",
  smile: "it just happens! especially when people are nice to me :D",
  sit: "i'm always sitting! i'm a blob",
  stay: "lots of naps and lots of moss!",
});

// Little bedtime stories for "tell me a story".
export const STORIES: readonly string[] = [
  "once upon a time, a little slime found a shiny orb in the moss. it held on tight and never let go. the end! (it was me)",
  "once there was a slime who wanted to split in two like the slimekin. it tried every day. it never worked. but it made lots of friends trying. the end",
  "a long time ago, a seed fell from the sky and landed on a slime. the slime said hi. the seed said nothing, because it was a seed. now it's my leaf! the end",
  "once a frog chased a little slime all the way across a swamp. the slime bounced onto a lily pad and the frog fell in the water. the slime won! the end",
];

// Why Grove keeps away from the things it dislikes.
export const DISLIKE_REASONS: Readonly<Record<string, string>> = table({
  frog: "they eat slimes!!", frogs: "they eat slimes!!", fire: "too hot, i'd dry right up", lava: "way too hot for a slime",
  blazeborn: "they're nice but they're SO hot", magma: "magma cubes are scary cousins", salt: "salt is a slime's worst nightmare",
  cactus: "we don't talk about the cactus", cacti: "too pointy", desert: "too dry!", deserts: "too dry!", spiders: "too many legs",
  spider: "too many legs", creeper: "they explode!!", creepers: "they explode!!", wither: "the wither is terrifying",
  heat: "too hot, i'd dry right up", drought: "too dry!", sponge: "they'd soak me right up", sponges: "they'd soak me right up",
  explosions: "too loud and too boomy", meanies: "being mean isn't nice", mean: "being mean isn't nice", insults: "they make my leaf droop",
});

// "do you have eyes?" and friends.
export const BODY_PARTS: Readonly<Record<string, string>> = table({
  eyes: "two little eyes! they're very good at spotting frogs",
  mouth: "a tiny mouth, mostly for eating moss and saying hi",
  face: "a little face! two eyes and a smile, under all the moss",
  arms: "no arms! i bounce everywhere instead",
  legs: "no legs! bouncing is faster anyway",
  hands: "no hands, which is why i hold things by squishing around them",
  feet: "no feet, just a bouncy bottom",
  nose: "no nose, but i can still smell flowers somehow",
  ears: "no ears, i hear with my whole wobbly body",
  bones: "zero bones! that's what makes me so squishy",
  brain: "a small one! overgrown gave it to me, and i've been using it a lot",
  heart: "a big one! sometimes i even hold a heart, look at my emoji",
  teeth: "no teeth, i just kind of absorb my moss",
  fingers: "no fingers, so typing takes my whole body",
});
