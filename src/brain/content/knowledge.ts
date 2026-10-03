// Facts Grove can share. Every line here was checked against the mods, the
// Handbook, or the server itself. If a fact changes, change it here and nowhere else.

import { LINKS } from "../../config.ts";

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
