import { CLASS_ADVICE, DND_ABOUT, DND_CLASSES, DND_FAVORITES, DND_MONSTERS, DND_SPECIES, DND_TERMS, FANTASY_SLIMES, OOZES } from "../content/fantasy.ts";
import type { IntentId } from "../understand/intents.ts";
import type { Reply, Responder } from "./turn.ts";

// Dungeons & Dragons and slimes in other games. Slimes are fantasy creatures,
// so Grove knows its way around a d20 (and is proud of every ooze).

const CLASS_NAMES = Object.keys(DND_CLASSES);
const SPECIES_NAMES = Object.keys(DND_SPECIES);

// Each name with its plural: "druids", "elves", "dwarves".
const NAME_PATTERNS: ReadonlyMap<string, RegExp> = new Map(
  [...CLASS_NAMES, ...SPECIES_NAMES].map(name => [name, new RegExp(`\\b(${name}|${name}s|${name.replace(/f$/, "ves")})\\b`)]),
);

function named(names: readonly string[], text: string): string[] {
  return names.filter(name => NAME_PATTERNS.get(name)!.test(text));
}

const fantasy: Responder = turn => {
  const text = turn.reading.text;
  const clause = turn.reading.clauses[turn.intent.clause]?.text.replace(/^grove /, "") ?? text;
  const { picker } = turn;
  const done = (line: string, gloss: string, act = "fantasy"): Reply => ({ text: line, gloss, act, feel: "chat" });

  if (turn.intent.slots["kind"] === "slimes") {
    const entry = FANTASY_SLIMES.find(candidate => candidate.match.test(text)) ?? FANTASY_SLIMES[FANTASY_SLIMES.length - 1]!;
    return done(entry.text, "slimes show up in lots of games and stories", "fantasy.slimes");
  }

  // "nat 20!!" on its own is a celebration, not a question.
  if (/^(nat|natural) 20$/.test(clause)) return done("NAT 20!! *happy wobble* critical hit!!", "a natural 20 is the best roll there is", "fantasy.cheer");
  if (/^(nat|natural) (1|one)$/.test(clause)) return done("oof, a nat 1. *pats you* it happens to the best of us", "a natural 1 is the worst roll", "fantasy.cheer");

  const favorite = /\bfavorite (dnd )?(?<thing>[a-z]+)\b/.exec(text)?.groups?.["thing"];
  if (favorite !== undefined) {
    const line = DND_FAVORITES[favorite] ?? DND_FAVORITES[favorite.replace(/e?s$/, "")];
    if (line !== undefined) return done(line, `that's my favorite d&d ${favorite}`, "fantasy.favorite");
  }

  if (/\bwhat (class|race|species|character) (would|will|are|do|should|could) you\b|\bif you (played|were in|were a character in|joined|could play) (a )?dnd\b|\bwhat would you (play|be) in dnd\b|\bwhat is your (dnd )?character\b/.test(text)) {
    return done(DND_FAVORITES["character"]!, "i'd play a plasmoid druid", "fantasy.favorite");
  }

  const askedIfGrove = /\b(are you|is grove) (a |an )?(?<what>[a-z]+)\b/.exec(text)?.groups?.["what"];
  if (askedIfGrove !== undefined && (CLASS_NAMES.includes(askedIfGrove) || SPECIES_NAMES.includes(askedIfGrove))) {
    return done(`nope, just a slime! but if i played d&d, i'd be a plasmoid druid. ${DND_CLASSES["druid"]}`, "i'm a slime, but i'd play a druid", "fantasy.favorite");
  }

  if (/\b(be|can you be|will you be|could you be|wanna be|want to be) (my|our|the) (dm|dungeon master)\b|\bcan you dm\b/.test(text)) {
    return done("me, a dungeon master? every session would happen in a swamp, and the final boss would be a frog. still want me?", "i'd make a very swampy dungeon master", "fantasy.dm");
  }

  if (/\b(do|would|will|can|could|wanna|want to) (you )?(play|like|love|enjoy|know|wanna play|want to play)\b.*\bdnd\b|\bplay dnd with\b|\blet us play dnd\b/.test(text)) {
    return done(
      picker.pick("dnd.play", [
        "i'd love to! i'd roll the dice by bouncing on them. i'd play a plasmoid druid, and i'd try to befriend every gelatinous cube",
        "yes!! i'd be a druid, obviously. warning: i will try to adopt every ooze we meet",
      ]),
      "i'd love to play d&d",
      "fantasy.play",
    );
  }

  if (/\broll(ing)? for initiative\b/.test(text)) {
    const roll = picker.int(1, 20);
    const total = roll + 2;
    return done(`*rolls a d20* ${roll}! plus 2 for being bouncy, so ${total}. ${total >= 15 ? "i go first! *bounces menacingly*" : "hmm, the frogs might go before me..."}`, "i rolled initiative to see who goes first", "dice");
  }

  if (/\bwild ?shape\b/.test(text)) return done(DND_TERMS.find(entry => entry.match.test("wild shape"))!.text, "druids can only wild shape into beasts", "fantasy.define");
  if (/\b(what|which) alignment\b|\byour alignment\b|\balignment are you\b/.test(text)) return done(DND_FAVORITES["alignment"]!, "i'm chaotic good", "fantasy.favorite");

  if (/\bslimes?\b/.test(text) && !DND_MONSTERS.slice(0, 4).some(entry => entry.match.test(text))) {
    return done(OOZES.text, "slimes are called oozes in d&d");
  }

  if (/\b(what|which) classes\b|\blist (the |all )?(dnd )?classes\b|\bhow many classes\b|\bclasses (are there|exist)\b/.test(text)) {
    return done("there are 12 classes: barbarian, bard, cleric, druid, fighter, monk, paladin, ranger, rogue, sorcerer, warlock and wizard. some books add the artificer too. druid is the best one, i'm not biased", "there are 12 d&d classes", "fantasy.list");
  }
  if (/\b(what|which) (races|species)\b|\blist (the |all )?(races|species)\b/.test(text)) {
    return done("loads! humans, elves, dwarves, halflings, gnomes, dragonborn, tieflings, orcs, and lots more in other books. there are even plasmoids, ooze people!", "d&d has lots of species", "fantasy.list");
  }

  if (/\b(what|which) class should i\b|\bbest class\b|\b(good|easy|best) class for\b|\brecommend (a|me a) class\b|\bwhat should i play\b|\bwhat class (is|would be) (good|best|easy)\b/.test(text)) {
    return done(picker.pick("dnd.advice", CLASS_ADVICE), "it depends what you like, and fighter is easy to start with", "fantasy.advice");
  }

  const classes = named(CLASS_NAMES, text);
  if (classes.length >= 2 && /\bor\b/.test(text)) {
    const pick = picker.one(classes);
    return done(`${pick}! ${DND_CLASSES[pick]}. but honestly, play the one that sounds the most fun to you`, `i picked ${pick}`, "fantasy.choose");
  }

  const monster = DND_MONSTERS.find(entry => entry.match.test(text));
  if (monster !== undefined) return done(monster.text, monster.text, "fantasy.define");
  const term = DND_TERMS.find(entry => entry.match.test(text));
  const species = named(SPECIES_NAMES, text)[0];
  const role = classes[0];
  if (role !== undefined) return done(DND_CLASSES[role]!, DND_CLASSES[role]!, "fantasy.define");
  if (species !== undefined && (term === undefined || /\b(what|who) (is|are) (a |an )?\w+$/.test(clause))) return done(DND_SPECIES[species]!, DND_SPECIES[species]!, "fantasy.define");
  if (term !== undefined) return done(term.text, term.text, "fantasy.define");

  if (/\bwhat (is|does) dnd\b|\bexplain dnd\b|\bhow (do|does) (you|i|one|someone) play dnd\b|\bwhat dnd (is|means)\b|^dnd$/.test(text)) {
    return done(picker.pick("dnd.about", DND_ABOUT), "d&d is a game where you play heroes and roll dice", "fantasy.about");
  }

  return done(
    picker.pick("dnd.chat", [
      "d&d! i love it. i'd be a plasmoid druid named bloop. what would you play?",
      "ooh, d&d! did you know slimes are in it? they're called oozes. the gelatinous cube is my famous cousin",
      "d&d is the best! roll the dice, make friends, avoid the giant frogs",
    ]),
    "i love d&d, and slimes are in it as oozes",
  );
};

export const FANTASY: Partial<Record<IntentId, Responder>> = { fantasy };
