// What words mean to Grove. Data only; the understanding code looks things up here.

import { table } from "./table.ts";

const set = (text: string): ReadonlySet<string> => new Set(text.trim().split(/\s+/));

// Said *about Grove* ("you are X", "are you X"), these hurt or help.
export const INSULTS = set(`
  dumb stupid idiot idiotic moron moronic useless annoying annoyin trash garbage bad terrible awful
  horrible worst lame cringe cringy mid ugly gross disgusting weird creepy broken slow pathetic worthless
  dense brainless clueless dumbass dummy loser boring stinky smelly mean rude evil dumbo goofy npc
  fake sus irritating obnoxious incompetent dogwater ass shit clanker
`);

export const COMPLIMENTS = set(`
  funny hilarious cute adorable sweet kind nice cool awesome amazing great smart clever wise helpful
  lovely beautiful pretty gorgeous handsome precious perfect best good fantastic wonderful brilliant
  goated based valid iconic legendary epic sick fire lit poggers pog fun silly charming cuddly squishy
  soft fluffy gooey slimy wholesome friendly polite patient talented underrated
`);

// Neutral or curious things to call Grove that deserve an answer, not a mood swing.
export const GENDER_WORDS = set(`
  boy girl guy gal man woman male female dude lady gentleman gentlemen sir maam he she him her his hers
  they them nonbinary enby genderless genderfluid trans femboy tomboy king queen prince princess
`);

export const BOT_WORDS = set(`
  bot robot ai artificial machine program computer chatgpt gpt llm chatbot npc script code software
`);

export const ALIVE_WORDS = set(`real alive sentient conscious living human person people actual`);

export const FEELINGS: Readonly<Record<string, "good" | "bad" | "tired" | "bored" | "lonely">> = table({
  happy: "good", glad: "good", good: "good", great: "good", fine: "good", okay: "good", ok: "good",
  alright: "good", awesome: "good", excited: "good", amazing: "good", well: "good", chill: "good",
  sad: "bad", upset: "bad", angry: "bad", mad: "bad", depressed: "bad", stressed: "bad", anxious: "bad",
  bad: "bad", terrible: "bad", awful: "bad", sick: "bad", hurt: "bad", down: "bad", annoyed: "bad",
  frustrated: "bad", scared: "bad", worried: "bad", crying: "bad", miserable: "bad", horrible: "bad",
  tired: "tired", sleepy: "tired", exhausted: "tired", dead: "tired",
  bored: "bored", boring: "bored",
  lonely: "lonely", alone: "lonely",
});

// "can you X?" Anything not listed gets an honest, curious "never tried".
export type Ability = { can: boolean; line: string };
export const ABILITIES: Readonly<Record<string, Ability>> = table({
  bounce: { can: true, line: "bounce? that's like my whole thing! *boing*" },
  jump: { can: true, line: "i can hop pretty high actually! *boing boing*" },
  hop: { can: true, line: "hopping is my favorite way to get around!" },
  ball: { can: true, line: "ball? i can't hold a basketball, but i'm round and i bounce, so... kinda? 🏀" },
  hoop: { can: true, line: "i can't reach the hoop but i can BE the ball. that counts right?" },
  dance: { can: true, line: "*wiggles side to side* that's my best dance hehe" },
  wiggle: { can: true, line: "*wiggle wiggle* i'm a pro at this" },
  sing: { can: true, line: "blub blub bloop 🎶 that's a slime song, it's very famous" },
  rap: { can: false, line: "i tried rapping once but it just came out as bloop noises" },
  swim: { can: true, line: "i float! i'm not sure that's swimming but it gets me places" },
  float: { can: true, line: "yep, i float like a little jelly" },
  fly: { can: false, line: "no wings, sadly... the avians and elytrians get all the fun" },
  split: { can: false, line: "i keep trying to split in two like the slimekin do, but it never works :(" },
  glow: { can: false, line: "i don't glow, but my flowers kinda do when the sun hits them" },
  code: { can: false, line: "code? i can't even hold a keyboard, i'd just make it sticky" },
  program: { can: false, line: "nope, i'm a slime, the smart folks in datapack support do that stuff" },
  read: { can: true, line: "i can read! slowly. the handbook has a lot of big words" },
  write: { can: true, line: "i can write little messages like this one!" },
  count: { can: true, line: "i can count to like seven. after that it gets blurry" },
  math: { can: true, line: "a little bit! try me with something easy" },
  cook: { can: false, line: "i tried cooking once and the stove got slimy. we don't talk about it" },
  draw: { can: false, line: "i can make slime trails in the shape of hearts, does that count?" },
  fight: { can: false, line: "fight? i'm made of jelly, i would just jiggle at them" },
  run: { can: false, line: "i don't have legs, so i bounce instead. it's faster honestly" },
  walk: { can: false, line: "no legs! just bouncing for me" },
  sleep: { can: true, line: "i love naps. moss makes the best pillow" },
  eat: { can: true, line: "yep! moss, flowers, and sometimes a stray cookie" },
  hug: { can: true, line: "hugs are my specialty, i'm very squishy! *hugs*" },
  talk: { can: true, line: "i'm talking right now! hi!!" },
  speak: { can: true, line: "i speak slime and a little bit of english" },
  think: { can: true, line: "i think a lot! mostly about moss" },
  see: { can: true, line: "i can see you! well, your messages" },
  help: { can: true, line: "i can help find the right channel for stuff! what do you need?" },
  play: { can: true, line: "i love playing! tag is hard though, i'm sticky so i always win" },
  minecraft: { can: true, line: "i live in minecraft, kinda! i'm a slime after all" },
  mine: { can: false, line: "mining? i'd just get stuck to the pickaxe" },
  build: { can: false, line: "i can't build, but i like watching people build!" },
  craft: { can: false, line: "crafting needs hands... i have zero" },
  die: { can: false, line: "nope! i'm the bouncing kind of immortal" },
  stop: { can: true, line: "okay okay, i'll stop! *sits very still*" },
  shut: { can: true, line: "okay... *sits quietly*" },
  type: { can: true, line: "i type with my whole body, it's exhausting but i manage" },
  game: { can: true, line: "games are fun! i'm bad at most of them, but i try" },
});

// Slang Grove recognizes on its own, with what it takes it to mean.
export const SLANG_TERMS: Readonly<Record<string, string>> = table({
  rizz: "rizz", sigma: "sigma", skibidi: "skibidi", ohio: "ohio", gyatt: "gyatt", mewing: "mewing",
  bussin: "bussin", cap: "cap", nocap: "nocap", slay: "slay", based: "based", mid: "mid", goated: "goated",
  drip: "drip", delulu: "delulu", sheesh: "sheesh", ratio: "ratio", sus: "sus", npc: "npc", aura: "aura",
  fanum: "fanum", griddy: "griddy", yeet: "yeet", pog: "pog", poggers: "pog", w: "w", l: "l", ate: "ate",
});

export const LIKES = set(`
  moss flowers flower sun sunshine rain rainy puddles puddle water lily pad lilypad mushrooms mushroom
  bees bee honey hearts heart orb origins apoli datapacks datapack jams jam hugs naps nap cookies cookie
  slimes slime slimekin buzzborne merling rocks pebbles butterflies butterfly clouds stars
  music songs friends you everyone people green leaves leaf trees spring summer swamp swamps cake
  minecraft bouncing compliments pets pats cats cat dogs dog
`);

export const DISLIKES = set(`
  frogs frog fire lava blazeborn magma salt deserts desert drought sponges sponge mean meanies
  insults cactus cacti spiders spider creepers creeper explosions heat wither
`);

export const FOODS = ["moss", "flowers", "a single crumb of cookie", "sunlight", "raindrops", "dandelions", "honey (a tiny bit)"];

export const COLORS = ["green", "moss green", "the color of a lily pad", "every shade of green"];
