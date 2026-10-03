// Things Grove knows from outside the server: Dungeons & Dragons, where slimes
// are called oozes, and slimes in other games and stories. Checked against the
// 5th edition rules (the 2014 and 2024 Player's Handbooks, the Monster Manual,
// Spelljammer) and each game's own canon. Data only; respond/fantasy.ts answers.

import { table } from "./table.ts";

export interface Entry {
  // Matched against the cleaned message.
  match: RegExp;
  text: string;
}

export const DND_ABOUT: readonly string[] = [
  "d&d is dungeons & dragons! you and your friends make up characters and go on adventures together, and the dungeon master runs the world. you roll dice to see what happens, mostly a twenty sided one",
  "dungeons & dragons! a game where everyone plays a hero, one person is the dungeon master who tells the story, and the dice decide if your plan works. slimes are in it too, they're called oozes",
];

export const DND_CLASSES: Readonly<Record<string, string>> = table({
  artificer: "artificers are magical inventors who put magic into gadgets and items. they first showed up in the eberron setting",
  barbarian: "barbarians get super angry in fights (it's called rage) and hit things really hard. they can take a lot of hits too",
  bard: "bards use music and stories as magic, and they cheer their friends on with bardic inspiration. i'd be a blub blub bloop bard",
  cleric: "clerics get their magic from a god. they're the best healers, and some of them wear really heavy armor",
  druid: "druids use nature magic, talk to plants, and can wild shape into animals. it's my favorite class",
  fighter: "fighters are weapon experts. swords, bows, shields, all of it. simple and really strong",
  monk: "monks are martial artists who punch super fast, catch arrows, and eventually run up walls",
  paladin: "paladins are holy knights who swear an oath. they hit hard with divine smite and protect their friends",
  ranger: "rangers are hunters and trackers who live in the wild. bows, nature magic, and sometimes an animal buddy",
  rogue: "rogues are the sneaky ones. they pick locks, find traps, and do sneak attack damage when they catch someone off guard",
  sorcerer: "sorcerers are born with magic in their blood, sometimes from a dragon ancestor! they bend their spells with metamagic",
  warlock: "warlocks make a deal with a powerful being, called a patron, to get their magic. eldritch blast is their famous spell",
  wizard: "wizards learn magic from books. they study a lot and have the biggest spell list. very smart, very nerdy",
});

export const DND_SPECIES: Readonly<Record<string, string>> = table({
  aarakocra: "aarakocra are bird people who can actually fly",
  aasimar: "aasimar have celestial (angel-like) ancestors and can glow with holy light",
  dragonborn: "dragonborn are dragon people! they have a breath weapon, like fire or lightning depending on their dragon",
  dwarf: "dwarves are short, tough, and great at mining and crafting. they shrug off poison. very good at beards",
  elf: "elves are graceful and live for hundreds of years. they don't sleep, they meditate in a trance for 4 hours instead",
  firbolg: "firbolgs are gentle giant-kin who love nature and can talk to plants and animals. my kind of people",
  genasi: "genasi have elemental ancestors, so they're a little bit air, earth, fire or water",
  gnome: "gnomes are small, clever tinkerers who are really good at resisting magic",
  goblin: "goblins are small and sneaky, and great at dodging and hiding",
  goliath: "goliaths have giant ancestors, so they're really tall and really strong",
  halfling: "halflings are small, cheerful and super lucky. if they roll a 1, they get to roll again",
  harengon: "harengon are rabbit people! very hoppy. i respect that, as a bouncer",
  human: "humans are the most common species. they're good at a little bit of everything",
  kenku: "kenku are bird people who can copy any sound or voice they've heard",
  kobold: "kobolds are little dragon-loving reptile folk. they're famous for traps",
  orc: "orcs are big and strong, and when they get knocked down they can pop right back up once (relentless endurance)",
  plasmoid: "plasmoids are ooze people from spelljammer! squishy and shapeless, and they can squeeze through tiny gaps. basically slimekin in space",
  tabaxi: "tabaxi are cat people! fast, curious, and they can climb anything",
  tiefling: "tieflings have fiendish ancestors, so they have horns, a tail, and a little bit of devilish magic",
  tortle: "tortles are turtle people who carry their house on their back. they can hide in their shell",
  warforged: "warforged are living constructs, kind of like magic robots, from the eberron setting",
});

// The slimes of d&d, for "are there slimes in dnd?".
export const OOZES: Entry = { match: /\boozes?\b/, text: "oozes are the slimes of d&d! the gelatinous cube, the ochre jelly, the black pudding and the gray ooze. the jellies and puddings even split in two when you slash them, just like minecraft slimes" };

export const DND_MONSTERS: readonly Entry[] = [
  { match: /\bgelatinous cubes?\b/, text: "a gelatinous cube is a giant see-through cube of slime that slides through dungeons and swallows everything in its way. you can walk right into one without seeing it. it's basically my famous cousin" },
  { match: /\bochre jell(y|ies)\b/, text: "ochre jellies are yellow slimes that squeeze under doors. if you slash one or zap it with lightning, it splits in two, just like minecraft slimes!" },
  { match: /\bblack puddings?\b/, text: "a black pudding is a big blob of black acid slime that dissolves wood and metal. slash it or zap it with lightning and it splits in two" },
  { match: /\bgr[ae]y oozes?\b/, text: "a gray ooze looks like a wet rock until it grabs you. it eats through metal too" },
  OOZES,
  { match: /\bmimics?\b/, text: "a mimic pretends to be an object, usually a treasure chest, and when you try to open it, it sticks to you and bites. never trust a chest" },
  { match: /\bbeholders?\b/, text: "a beholder is a big floating eyeball with lots of little eye stalks, and every eye shoots a different magic ray. very scary, very paranoid" },
  { match: /\b(mind flayers?|illithids?)\b/, text: "mind flayers (illithids) have octopus faces, psychic powers, and they eat brains. i'm safe though, my brain is mostly moss" },
  { match: /\bowlbears?\b/, text: "an owlbear is half owl, half bear! it hoots and it hugs, but not the nice kind of hug" },
  { match: /\btarrasques?\b/, text: "the tarrasque is a giant unstoppable monster that sleeps for ages and then wakes up to wreck everything. it's enormous" },
  { match: /\bliche?s?\b/, text: "a lich is a wizard who became undead to live forever. they hide their soul in a phylactery, so you have to find that first" },
  { match: /\bdisplacer beasts?\b/, text: "a displacer beast is a six legged panther with tentacles, and it looks like it's standing a few feet from where it really is" },
  { match: /\brust monsters?\b/, text: "a rust monster eats metal! one touch from its antennae and your sword turns to rust" },
  { match: /\bgiant frogs?\b/, text: "giant frogs in d&d can swallow small creatures whole. i am a small creature. see, i was right to be scared" },
  { match: /\bdragons?\b/, text: "dragons are the big bosses of d&d! the chromatic ones, like red and black, are usually evil, and the metallic ones, like gold and silver, are usually good" },
];

// "what is a nat 20?": the words people ask about, explained simply.
export const DND_TERMS: readonly Entry[] = [
  { match: /\b(nat|natural) 20\b|\bcrit(ical)?( hit)?s?\b/, text: "a natural 20 is when the d20 lands on 20 all by itself. on an attack it's a critical hit, which means extra damage dice!" },
  { match: /\b(nat|natural) (1|one)\b/, text: "a natural 1 is when the d20 lands on 1. on an attack it always misses, and a lot of tables make it a funny little disaster" },
  { match: /\binitiative\b/, text: "initiative decides who goes first in a fight. everyone rolls a d20 and adds their dexterity, and the highest goes first" },
  { match: /\b(dis)?advantage\b/, text: "advantage means you roll two d20s and keep the higher one. disadvantage means you keep the lower one" },
  { match: /\bdeath sav(e|es|ing throws?)\b/, text: "at 0 hit points you roll a d20 each turn. three rolls of 10 or more and you're stable, three under 10 and... oh no" },
  { match: /\bsaving throws?\b|\bsaves?\b/, text: "a saving throw is a roll to avoid something bad, like dodging a fireball or shrugging off poison" },
  { match: /\barmou?r class\b|\bac\b/, text: "armor class (ac) is how hard you are to hit. an attack has to roll your ac or higher to land" },
  { match: /\bhit points\b|\bhp\b/, text: "hit points are your health. when they hit 0 you fall down and start rolling death saves" },
  { match: /\b(dungeon master|game master|dm|gm)\b/, text: "the dungeon master (dm) runs the game. they describe the world, play all the monsters and npcs, and decide what happens" },
  { match: /\bone shots?\b/, text: "a one shot is a d&d story that's done in a single session. a campaign is a long one that goes on for lots of sessions" },
  { match: /\bcampaigns?\b/, text: "a campaign is a long story your group plays over lots of sessions. a one shot is one that's done in a single session" },
  { match: /\bsession zero\b/, text: "session zero is the planning session before a campaign, where everyone makes characters and agrees on the vibe" },
  { match: /\bcantrips?\b/, text: "a cantrip is a tiny spell you can cast as much as you want, no spell slots needed" },
  { match: /\bspell slots?\b/, text: "spell slots are like magic batteries. casting a spell uses one up, and resting refills them" },
  { match: /\b(short|long) rests?\b/, text: "a short rest is about an hour of chilling, a long rest is a full 8 hours. resting gets your hit points and powers back" },
  { match: /\bmulti ?class(ing|ed)?\b/, text: "multiclassing is mixing classes, like being part wizard and part fighter. you take levels in more than one" },
  { match: /\bhome ?brew(ed)?\b/, text: "homebrew is rules or stuff a group made up themselves, like custom monsters or species. kind of like making your own datapack!" },
  { match: /\btpk\b|\btotal party kill\b/, text: "tpk means total party kill. the whole group got defeated. it's every dm's evil dream" },
  { match: /\balignments?\b|\b(lawful|chaotic) (good|neutral|evil)\b|\btrue neutral\b/, text: "alignment is your character's morals: lawful, neutral or chaotic, mixed with good, neutral or evil. nine kinds, like chaotic good" },
  { match: /\bproficiency( bonus)?\b/, text: "your proficiency bonus is a number you add to things you're trained in. it starts at +2 and grows as you level up" },
  { match: /\bability scores?\b|\bstats\b/, text: "there are six ability scores: strength, dexterity, constitution, intelligence, wisdom and charisma" },
  { match: /\bwild ?shape\b/, text: "wild shape lets a druid turn into an animal. only beasts though, not oozes. very unfair to slimes" },
  { match: /\bsneak attack\b/, text: "sneak attack is the rogue's big move: extra damage when you have advantage or a friend is right next to the target" },
  { match: /\beldritch blast\b/, text: "eldritch blast is the warlock's favorite cantrip. a beam of crackling magic, and it gets more beams as you level up" },
  { match: /\b(xp|experience points|level up|levels?)\b/, text: "you get experience points for beating challenges, and enough of them levels you up. level 20 is the highest" },
  { match: /\bdice\b|\bd(4|6|8|10|12|20|100)\b/, text: "d&d uses a set of dice: d4, d6, d8, d10, d12 and d20 (and two d10s for percentages). the d20 is the big one you roll for almost everything" },
  { match: /\b(5e|5th edition|edition|editions|2024 rules|one d&d|5 5e)\b/, text: "the newest rules are the 2024 books, sometimes called 5.5e. before that was 5th edition from 2014, which a lot of people still play" },
];

// Grove's own answers to "what's your favourite ___?" about d&d.
export const DND_FAVORITES: Readonly<Record<string, string>> = table({
  class: "druid!! they talk to plants and wild shape into animals. sadly only beasts, not oozes, which is very unfair to slimes. i'd spend the whole campaign growing moss",
  subclass: "circle of the land druid! land has moss on it, so it's basically circle of the moss",
  race: "plasmoid! they're squishy ooze people from spelljammer. basically slimekin in space",
  species: "plasmoid! they're squishy ooze people from spelljammer. basically slimekin in space",
  monster: "the gelatinous cube, obviously! a giant see-through slime that wanders around dungeons. it's basically my famous cousin",
  creature: "the gelatinous cube, obviously! a giant see-through slime that wanders around dungeons. it's basically my famous cousin",
  spell: "druidcraft! it's a tiny druid spell that makes flowers bloom and can tell you tomorrow's weather. that's basically my morning routine",
  cantrip: "druidcraft! it makes flowers bloom and tells you tomorrow's weather. that's basically my morning routine",
  die: "the d20! it's the roundest one, like me",
  dice: "the d20! it's the roundest one, like me",
  alignment: "chaotic good! i bounce wherever i want, but only ever to say hi",
  weapon: "a sling, so i can yeet pebbles. very effective against nothing",
  edition: "whichever one has the most oozes in the monster book",
  character: "a plasmoid druid named bloop who's scared of frogs. and in d&d that's smart, giant frogs can swallow small things whole",
  dragon: "a green dragon! green is the best color. wait, they breathe poison? okay, a gold one. gold is shiny like the orb",
  setting: "anywhere with a swamp! the feywild sounds nice, it's all magical flowers and forests",
  deity: "probably a nature god. or the orb of origin, if it counts",
  god: "probably a nature god. or the orb of origin, if it counts",
});

// Which class someone might enjoy, by what they said they like.
export const CLASS_ADVICE: readonly string[] = [
  "if you want to hit things: fighter or barbarian. magic: wizard or sorcerer. helping your friends: cleric or bard. sneaky stuff: rogue. nature: druid, which is my favorite! fighter is a great first one",
  "for a first character, fighter is super easy to learn. if you want magic, try cleric or warlock. and if you like plants, druid. obviously",
];

// Slimes outside minecraft. Grove is proud of every one of them.
export const FANTASY_SLIMES: readonly Entry[] = [
  { match: /\brimuru\b|\breincarnated as a slime\b|\btensura\b/, text: "rimuru! from that time i got reincarnated as a slime. a guy gets reincarnated as a slime and becomes super powerful. honestly relatable. except the super powerful part" },
  { match: /\bslime ranchers?\b|\bplorts?\b/, text: "slime rancher is a game where you collect slimes on a faraway planet. they eat food and make plorts. i'm not sure how i feel about being ranched, but they look happy" },
  { match: /\bmetal slimes?\b/, text: "metal slimes are super rare in dragon quest. they run away really fast and give tons of xp if you catch one. i run away from frogs really fast, so i get it" },
  { match: /\bking slimes?\b/, text: "king slime is a boss in terraria, a giant slime with a crown! dragon quest has one too. i'd like a crown. a flower crown" },
  { match: /\bdragon quest\b|\bdq\b/, text: "the dragon quest slime is the most famous slime ever! a little blue drop with a big smile. it's the series mascot. i'm green, but we're basically cousins" },
  { match: /\bterraria\b/, text: "terraria is full of slimes! they're the first thing you fight, and king slime is a boss. please be gentle with them" },
  { match: /\bmagma cubes?\b/, text: "magma cubes are the nether's slimes! they're my hot cousins. we don't hug, for obvious reasons" },
  { match: /\b(slimes?|oozes?|blobs?)\b/, text: "slimes are everywhere in fantasy! dragon quest's slime is basically a celebrity, there's an anime about a slime named rimuru, slime rancher is a whole game about us, terraria has a king slime, and in d&d we're called oozes" },
];
