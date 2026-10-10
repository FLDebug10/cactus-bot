// What a request for a power says in so many words: what sets it off, when it
// works, which effects, mobs and numbers it names. These are read with patterns,
// not by the model: they are the parts a small model got wrong most ("heals me
// every 5 seconds while in water" came back as "when I hit something"), and the
// words for them hardly vary. The model only decides what the patterns can't.

import { type DamageFrom, EFFECTS, type Passive, SUMMONS, type What, type When, type While } from "./blocks.ts";

export type NumberField = "seconds" | "every" | "cooldown" | "hearts" | "level" | "percent" | "factor" | "blocks";

export interface Signals {
  // Every trigger the words name; more than one means the request is too tangled to build.
  triggers: When[];
  conditions: While[];
  // The damage it's about, every source named.
  froms: DamageFrom[];
  near: boolean;
  effects: string[];
  entity: string | null;
  command: string | null;
  passives: Passive[];
  whats: What[];
  // In seconds.
  seconds: number | null;
  every: number | null;
  cooldown: number | null;
  hearts: number | null;
  level: number | null;
  // "speed 3 and jump boost 2": the level said right by each effect.
  levels: Record<string, number>;
  percent: number | null;
  factor: number | null;
  blocks: number | null;
  // Every number in the words, and the one each reading above took, so a plan
  // can show it used them all.
  numbers: string[];
  raw: Partial<Record<NumberField, string>>;
  rawLevels: Record<string, string>;
  // A glow colour as red, green and blue from 0 to 1.
  color: [number, number, number] | null;
  // Switched on and off with the ability key.
  toggle: boolean;
  // Something asked for that the building blocks can't do, in its own words.
  unsupported: string | null;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
};

// "a heart", "two seconds" and "half a heart" as digits, so one set of patterns reads them all.
export function withDigits(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\bhalf an? (heart|second|block)\b/g, "0.5 $1")
    .replace(/\b(?:a|an|one) (heart|second|minute|block)\b/g, "1 $1")
    .replace(new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join("|")})\\b`, "g"), word => String(NUMBER_WORDS[word]));
}

const SUBJECT = "(?:i|you|they|the player|my character)";

// In the order they are tried: dying before being hurt, being hurt before hitting.
const TRIGGERS: ReadonlyArray<[When, RegExp]> = [
  ["death", new RegExp(`\\b(?:when|whenever|if|once|after|as soon as)\\s+${SUBJECT}\\s+(?:die|dies|died|get killed|gets killed|am killed|is killed)\\b|\\b(?:on|upon|at|after) (?:my |their |your )?death\\b|\\bwhen (?:i'?m|you'?re) killed\\b`)],
  ["kill", new RegExp(`\\b(?:when|whenever|if|after|every time|each time|once)\\s+${SUBJECT}\\s+(?:kill|kills|killed|slay|slays)\\b|\\bon (?:a )?kill\\b|\\bfor (?:every|each) kill\\b|\\bkilling (?:something|anything|someone|an? \\w+|mobs?|players?|enem(?:y|ies)|things?|entit(?:y|ies))\\b|\\b(?:get|gets|getting) a kill\\b|\\b(?:mobs?|entit(?:y|ies|ys)|things?|whatever|anything|players?|enemies|something)\\s+${SUBJECT}\\s+(?:kill|slay)\\b`)],
  ["hurt", new RegExp(`\\b(?:hits?|attacks?|hurts?|damages?|punch(?:es)?|strikes?|shoots?)\\s+(?:me|you|the player)\\b|\\bwhen(?:ever)?\\s+${SUBJECT}(?:'m|'re| am| are| get| gets| got| take| takes)\\s+(?:hit|attacked|hurt|damaged|shot|struck|damage)\\b|\\b(?:my|the|their) attackers?\\b|\\battackers\\b|\\bwhen hit\\b|\\bgetting hit\\b|\\btaking damage\\b`)],
  ["hit", new RegExp(`\\b(?:i|you|the player|my character)\\s+(?:hit|hits|attack|attacks|punch|punches|strike|strikes|smack|smacks|whack|whacks|shoot|shoots|melee)\\b(?!\\s+(?:me|you)\\b)|\\bon hit\\b|\\bupon hitting\\b|\\bmy (?:hits|attacks|punches|swings|arrows)\\b|\\bhitting (?:an?|the|any)?\\s*(?:entit(?:y|ies)|mobs?|players?|enem(?:y|ies)|something|someone|anything|targets?|things?)\\b`)],
  ["key", /\bpress(?:es|ing|ed)?\s+(?:a|the|my|their|an?)?\s*(?:\w+\s+)?(?:key|button)\b|\bkey\s?binds?\b|\bhot\s?keys?\b|\babilit(?:y|ies) key\b|\bon key ?press\b|\bwhen (?:i|you) (?:use|activate|trigger) (?:it|the (?:power|ability)|my (?:power|ability)|this (?:power|ability))\b|\bactive abilit(?:y|ies)\b/],
  ["time", /\bevery\s+(?:\d+(?:\.\d+)?|few|couple(?: of)?|other)?\s*(?:seconds?|secs?|ticks?|minutes?|mins?)\b|\bover time\b|\bperiodically\b/],
  ["land", new RegExp(`\\bwhen(?:ever)?\\s+${SUBJECT}\\s+lands?\\b|\\bon landing\\b|\\bwhen landing\\b`)],
  ["eat", new RegExp(`\\bwhen(?:ever)?\\s+${SUBJECT}\\s+(?:eat|eats|drink|drinks|consume|consumes|finish eating)\\b|\\b(?:after|on|from|by) (?:eating|drinking)\\b|\\b(?:eating|drinking|consuming)\\s+(?:food|anything|something|an? \\w+|potions?|milk|meat)\\b`)],
];

const LIMIT = "(?:while|when|whenever|if|as long as|only)\\b[^.?!]{0,24}?";
const CONDITIONS: ReadonlyArray<[While, RegExp]> = [
  ["sneaking", new RegExp(`\\b${LIMIT}\\b(?:sneak\\w*|crouch\\w*|shifting)\\b|\\b(?:sneaking|crouching)\\b`)],
  ["sprinting", new RegExp(`\\b${LIMIT}\\bsprint\\w*\\b|\\bsprinting\\b`)],
  ["swimming", new RegExp(`\\b${LIMIT}\\bswim\\w*\\b|\\bswimming\\b`)],
  ["in_water", new RegExp(`\\b${LIMIT}\\b(?:in|under|inside|touching)\\s+(?:the\\s+)?water\\b|\\b${LIMIT}\\b(?:underwater|submerged|wet)\\b`)],
  ["in_lava", new RegExp(`\\b${LIMIT}\\b(?:in|inside|touching)\\s+(?:the\\s+)?lava\\b`)],
  ["on_fire", /\b(?:while|when|whenever|if|as long as)\s+(?:i'?m|i am|you'?re|you are|they'?re|they are)\s+(?:on fire|burning)\b|\bwhile (?:on fire|burning)\b/],
  ["night", /\bat night\b|\bnight\s?time\b|\bduring the night\b|\bwhen it'?s (?:dark|night)\b/],
  ["day", /\bduring the day\b|\bday\s?time\b|\bwhen it'?s day\b|\bin the day\b/],
  ["rain", /\b(?:in|during|under) (?:the )?rain\b|\b(?:when|whenever|while|if) it(?:'?s)? (?:rains|raining)\b|\bwhile (?:it'?s )?raining\b/],
  ["sunlight", /\b(?:in|under) (?:the )?(?:sun|sunlight)\b|\bexposed to (?:the )?sun\b|\bin daylight\b/],
  ["low_health", /\b(?:low|below|under|less than|lower than)\s+(?:on\s+)?(?:\d+\s+)?(?:health|hp|hearts?)\b|\bhealth (?:is )?(?:below|under|low|less)\b/],
];

// Only phrases that are about the damage itself: "set on fire" is an action, "damage from fire" a source.
const FROM: ReadonlyArray<[DamageFrom, RegExp]> = [
  ["falling", /\bfall(?:ing)? damage\b|\bfrom falling\b|\bfall(?:s)? (?:hurt|hurts)\b|\bimmune to fall(?:ing)?\b/],
  ["fire", /\b(?:from|by|to)\s+(?:the\s+)?(?:fire|flames?|lava|burning)\b|\b(?:fire|burn(?:ing)?|flame|lava) damage\b|\bfire\s?proof\b|\bimmune to (?:fire|lava|burning|flames?)\b/],
  ["projectiles", /\b(?:arrows?|projectiles?|bows?|crossbows?|tridents?|snowballs?)\b|\b(?:shoot|shoots|shooting|shot)\b|\branged\b/],
  ["explosions", /\b(?:from|by|to)\s+(?:an?\s+)?(?:explosions?|blasts?|creepers?|tnt)\b|\b(?:explosion|explosive|blast) damage\b|\bimmune to (?:explosions?|blasts?)\b/],
  ["magic", /\bmagic(?:al)? damage\b|\bfrom magic\b|\bimmune to magic\b/],
  ["drowning", /\bdrown(?:ing)? damage\b|\bfrom drowning\b|\bimmune to drowning\b/],
  ["melee", /\bmelee\b|\bwith (?:my |a |their )?(?:fists?|hands?|sword|axe)\b|\bpunch(?:es|ing)?\b/],
];

// The damage sources in an "immune to ..." or "from ..." clause: "immune to fall damage and fire".
const SOURCE_WORDS: ReadonlyArray<[DamageFrom, RegExp]> = [
  ["fire", /\b(?:fire|flames?|lava|burning)\b/],
  ["falling", /\bfall(?:s|ing)?\b/],
  ["projectiles", /\b(?:arrows?|projectiles?|tridents?|bows?|crossbows?|snowballs?)\b/],
  ["explosions", /\b(?:explosions?|explosive|blasts?|creepers?|tnt)\b/],
  ["magic", /\bmagic(?:al)?\b/],
  ["drowning", /\bdrown(?:ing)?\b/],
];
const SOURCE_CLAUSE = /\b(?:immun\w* to|resist\w* to|from|against)\s+([^.?!]+)/g;

function fromsIn(text: string): DamageFrom[] {
  const found = new Set<DamageFrom>(FROM.filter(([, pattern]) => pattern.test(text)).map(([from]) => from));
  for (const clause of text.matchAll(SOURCE_CLAUSE)) {
    for (const [from, pattern] of SOURCE_WORDS) if (pattern.test(clause[1]!)) found.add(from);
  }
  return [...found];
}

const NEAR = /\b(?:near|around|nearby|close to|surrounding)\s+(?:me|you|them|the player)\b|\bnearby\b|\bin an? (?:\d+(?:\.\d+)?[ -]?blocks? )?radius\b|\bin an? area\b|\baoe\b|\barea of effect\b|\bwithin \d+(?:\.\d+)? blocks?\b|\bevery(?:thing|one|body)? (?:mob|entity|player)s? (?:near|around)\b/;

// Named effects, the longer names first so "fire resistance" isn't read as "resistance" too.
const EFFECT_WORDS: ReadonlyArray<[string, RegExp]> = [
  ["fire_resistance", /\bfire[ _]res(?:istance|ist)?\b/g],
  ["slow_falling", /\bslow[ _]fall(?:ing)?\b|\bfeather ?fall(?:ing)?\b/g],
  ["night_vision", /\bnight[ _]vision\b/g],
  ["water_breathing", /\bwater[ _]breathing\b/g],
  ["jump_boost", /\bjump[ _]boost\b/g],
  ["mining_fatigue", /\bmining[ _]fatigue\b/g],
  ["instant_health", /\binstant[ _](?:health|heal(?:ing)?)\b/g],
  ["instant_damage", /\binstant[ _](?:damage|harm(?:ing)?)\b|\bharming\b/g],
  ["health_boost", /\bhealth[ _]boost\b/g],
  ["conduit_power", /\bconduit[ _]power\b/g],
  ["dolphins_grace", /\bdolphins?'?[ _]grace\b/g],
  ["bad_omen", /\bbad[ _]omen\b/g],
  ["hero_of_the_village", /\bhero[ _]of[ _]the[ _]village\b/g],
  ["trial_omen", /\btrial[ _]omen\b/g],
  ["raid_omen", /\braid[ _]omen\b/g],
  ["wind_charged", /\bwind[ _]charged\b/g],
  ["unluck", /\bunluck\b|\bbad[ _]luck\b/g],
  ["speed", /\bspeed\b|\bswiftness\b/g],
  ["slowness", /\bslow(?:ness|ed|s|ing)?\b/g],
  ["haste", /\bhaste\b/g],
  ["strength", /\bstrength\b/g],
  ["nausea", /\bnausea\b|\bconfus(?:ed|ion)\b|\bdizz(?:y|iness)\b/g],
  ["regeneration", /\bregen(?:eration|erate|erates|erating)?\b/g],
  ["resistance", /\bresistance\b/g],
  ["invisibility", /\binvisib(?:le|ility)\b/g],
  ["blindness", /\bblind(?:ness|ed|s)?\b/g],
  ["hunger", /\bhunger\b/g],
  ["weakness", /\bweak(?:ness|ened|en)?\b/g],
  ["poison", /\bpoison(?:s|ed|ing|ous)?\b/g],
  ["wither", /\bwither(?:ed|ing|s)?\b(?![ _](?:skeleton|rose|skull|boss))/g],
  ["absorption", /\babsorption\b/g],
  ["saturation", /\bsaturation\b/g],
  ["glowing", /\bglow(?:ing|s)?\b/g],
  ["levitation", /\blevitat(?:e|es|ion|ing)\b|\bfloat(?:s|ing|y)?\b/g],
  ["luck", /\bluck\b/g],
  ["darkness", /\bdarkness\b/g],
  ["weaving", /\bweaving\b/g],
  ["oozing", /\boozing\b/g],
  ["infested", /\binfest(?:ed|ation)\b/g],
];

const PASSIVES: ReadonlyArray<[Passive, RegExp]> = [
  ["burn_in_sun", /\bburn(?:s|ing)? (?:in|under) (?:the )?(?:sun|sunlight|daylight|day)\b|\bburn(?:s)? (?:during the day|in daytime)\b/],
  ["breathe_underwater", /\bbreathe? (?:under\s?water|in water)\b|\bwater breathing\b|\b(?:never|don'?t|can'?t|won'?t) drown\b/],
  ["night_vision", /\bnight vision\b|\bsee in the dark\b|\bdark ?vision\b/],
  ["walk_on_water", /\bwalk(?:s|ing)? on water\b|\bwater walk\w*\b/],
  ["walk_on_lava", /\bwalk(?:s|ing)? on lava\b/],
  ["glide", /\bglid(?:e|es|ing)\b|\belytra\b/],
  ["fly", /\bfly\b|\bflying\b|\bflight\b/],
  ["climb", /\bclimb\w*\b/],
  ["invisible", /\binvisib\w*\b/],
  ["glow", /\bglow\w*\b/],
  ["phase", /\bphas(?:e|ing)\b|\b(?:walk|go|move|pass)(?:es|s|ing)? through (?:walls|blocks)\b|\bnoclip\b/],
  ["effect_immunity", new RegExp(`\\bimmun\\w*\\s+to\\s+(?:the\\s+)?(?:${EFFECTS.join("|").replace(/_/g, "[ _]")}|poisons?|slowness|weakness)\\b|\\b(?:can'?t|cannot|never|don'?t|won'?t)\\s+(?:get|be|become)\\s+(?:the\\s+)?(?:${EFFECTS.join("|").replace(/_/g, "[ _]")}|poisoned|withered|slowed|weakened|blinded)\\b`)],
  ["less_damage", /\btakes?\s+(?:less|reduced|half|lower|\d+(?:\.\d+)?%\s+less|no)\s+(?:\w+\s+)?damage\b|\bimmun\w*\s+to\s+(?:fire|lava|burning|flames?|fall(?:ing)?|fall damage|explosions?|arrows|projectiles|drowning|magic|damage)\b|\bno fall damage\b|\bfire\s?proof\b|\b(?:don'?t|dont|never|can'?t|cant|won'?t) take (?:\w+ )?damage\b|\binvulnerab\w*\b/],
  ["more_damage_taken", /\btakes?\s+(?:more|extra|double|twice|\d+(?:\.\d+)?%\s+more)\s+(?:\w+\s+)?damage\b/],
  ["more_damage_dealt", /\b(?:deal|deals|do|does)\s+(?:more|extra|double|twice|\d+(?:\.\d+)?%\s+more)\s+(?:\w+\s+)?damage\b|\bstronger (?:hits|attacks|punches)\b|\bhit harder\b/],
  ["less_damage_dealt", /\b(?:deal|deals|do|does)\s+(?:less|half|\d+(?:\.\d+)?%\s+less)\s+(?:\w+\s+)?damage\b|\bweaker (?:hits|attacks)\b/],
  ["faster", /\b(?:move|moves|run|runs|walk|walks|swim|swims)(?:ing)?\s+faster\b|\bmovement speed\b|\bspeed boost\b|\bfaster\b|\b(?:double|doubles|triple|triples)\s+(?:my|your|their|the)\s+speed\b|\b(?:more|extra)\s+speed\b/],
  ["slower", /\b(?:move|moves|run|runs|walk|walks)(?:ing)?\s+slower\b|\bslower\b/],
  ["jump_higher", /\bjump(?:s|ing)? higher\b|\bhigher jumps?\b|\bsuper jump\b/],
  ["more_health", /\bmore (?:max(?:imum)? )?(?:health|hearts)\b|\bextra (?:hearts|health)\b|\bmax(?:imum)? health\b/],
  ["less_health", /\bless (?:max(?:imum)? )?(?:health|hearts)\b|\bfewer hearts\b/],
  ["bigger", /\b(?:bigger|larger|giant|taller|huge)\b|\b(?:twice|double|\d+(?:\.\d+)?x|\d+(?:\.\d+)? times) (?:the |my |as )?(?:size|big|tall|large)\b/],
  ["smaller", /\b(?:smaller|tiny|shorter|shrink\w*)\b|\bhalf (?:the |my )?size\b|\bhalf as (?:big|tall|large)\b/],
  ["permanent_effect", /\b(?:permanent|permanently|always (?:have|has|get)|infinite|forever)\b/],
];

const WHATS: ReadonlyArray<[What, RegExp]> = [
  ["lightning", /\blightning\b|\bsmites?\b|\bthunder\s?bolt\b/],
  ["summon", /\b(?:summon|summons|spawn|spawns|spawning|conjure|conjures)\b/],
  ["explode", /\bexplo(?:de|des|sion|sive)\b|\bblow(?:s)? up\b/],
  ["teleport_random", /\b(?:teleport|teleports|tp|warp|warps)\b[^.?!]{0,30}\brandom\w*\b|\brandom(?:ly)? teleport\w*\b/],
  ["teleport_forward", /\b(?:teleport|teleports|tp|blink|blinks|warp|warps)\b/],
  ["clear_effects", /\b(?:clear|clears|remove|removes|cure|cures|cleanse|cleanses)\b[^.?!]{0,30}\beffects?\b/],
  ["extinguish", /\b(?:put out|extinguish\w*)\b/],
  ["fire", /\bon fire\b|\bcatch(?:es)? (?:on )?fire\b|\bburst(?:s)? into flames\b|\bignite\w*\b|\bburn(?:s)? (?:them|it|the target|whoever|anyone|everything)\b|\bset(?:s)? (?:\w+ ){0,3}ablaze\b/],
  ["heal", /\bheal(?:s|ing|ed)?\b|\bregain\w*\b|\brestore (?:health|hearts)\b|\b(?:hearts?|health) back\b/],
  ["damage", /\b(?:deal|deals|do|does|take|takes)\s+(?:\d+(?:\.\d+)?\s+)?(?:hearts? of\s+)?damage\b|\bdamages?\b|\bhurts? (?:them|it|the target|whoever|anyone|everything)\b/],
  ["launch", /\blaunch\w*\b|\bfling\w*\b|\byeet\w*\b|\binto the (?:air|sky)\b|\bknock(?:s|ed)? (?:\w+ )?up\b|\bsend(?:s)? (?:\w+ )?flying\b/],
  ["push", /\bknock\s?back\b|\bknock(?:s|ed)? (?:\w+ )?(?:away|back)\b|\bpush(?:es|ed)?\b|\brepel\w*\b|\bshove\w*\b/],
  ["feed", /\bfeed(?:s)?\b|\b(?:restore|restores|refill|refills|fill|fills)\s+(?:\w+\s+)?hunger\b|\bsaturat\w*\b/],
  ["command", /\bcommand\b|\bruns? `?\//],
  ["effect", /\beffects?\b|\bpotions?\b/],
];

// Asks the building blocks can't say. A power without the part they asked for
// would be wrong, so these go to the normal answer instead.
const TOGGLE = /\btoggl\w*\b|\b(?:turn|turns|switch|switches|flip|flips)\s+(?:it |them |this |that )?(?:on and off|off and on)\b|\bon and off\b/;
const UNSUPPORTED = /\b(?:resources?|mana|stamina|energy|meter|bar|charges?|holding|hold(?:s)? (?:a|an|the)|wield\w*|wearing|wears?|equipped|armou?r|biomes?|nether|the end|overworld|dimensions?|desert|ocean|caves?|underground|y ?level|altitude|undead|hostile|monsters?|animals?|only (?:on |affects? |hits? |works on |targets? |for )?(?:players|mobs|villagers)|except|unless|other than|chances?|random chance|\d+(?:\.\d+)?\s*% chance|sometimes|double jump\w*|dash\w*|combos?|stacks?|stacking|particles?|sound effects?|plays? (?:a )?sounds?|noises?|colou?rs?|textures?|models?|animations?|shaders?|fog|hud|gui|menu|delay\w*|after \d+(?:\.\d+)? seconds|xp|experience|inventory|items?|craft\w*|recipes?|loot|drops?|tam(?:e|es|ed|ing)|ride|rides|riding|mount\w*|fireballs?|beams?|lasers?|raycast\w*|look(?:s|ing)? at|crosshair|aim\w*|break(?:s|ing)? blocks?|mine (?:a |blocks?|ores?)|mining(?! fatigue)|place(?:s)? blocks?|multiple powers|two powers|secondary key|blocks? (?:i|you) (?:stand|walk) on|standing on|counter|score\w*|team\w*)\b/;

function seconds(amount: string, unit: string | undefined): number {
  const value = Number.parseFloat(amount);
  if (unit === undefined) return value;
  if (/^(?:m|mins?|minutes?)$/.test(unit)) return value * 60;
  if (/^ticks?$/.test(unit)) return value / 20;
  return value;
}

const UNIT = "(s|secs?|seconds?|m|mins?|minutes?|ticks?)";
const NUM = "(\\d+(?:\\.\\d+)?)";

// The last of these said in the text: in "make it 20 seconds" after "for 10 seconds", 20 wins.
// Each pattern's first group is the number and its second, when it has one, the unit.
function lastOf(patterns: readonly RegExp[], text: string): { value: string; unit: string | undefined } | null {
  let best: { at: number; value: string; unit: string | undefined } | null = null;
  for (const pattern of patterns) {
    const global = new RegExp(pattern.source, "g");
    for (let match = global.exec(text); match !== null; match = global.exec(text)) {
      if (best === null || match.index >= best.at) best = { at: match.index, value: match[1]!, unit: match[2] };
    }
  }
  return best === null ? null : { value: best.value, unit: best.unit };
}

const DURATION = [
  new RegExp(`\\b(?:for|lasting|lasts|last|make it|change it to|set it to)\\s+${NUM}\\s*${UNIT}\\b`),
  new RegExp(`\\b${NUM}\\s*${UNIT}\\s+(?:of|long|duration|instead)\\b`),
  new RegExp(`\\b${NUM}[ -]?${UNIT}\\s+(?:${EFFECTS.join("|").replace(/_/g, "[ _]")}|poison|regen|fire)\\b`),
];
const EVERY = [new RegExp(`\\bevery\\s+${NUM}\\s*${UNIT}\\b`), new RegExp(`\\bevery ()${UNIT}\\b`)];
const COOLDOWN = [new RegExp(`\\b${NUM}\\s*${UNIT}\\s*-?\\s*cool\\s?downs?\\b`), new RegExp(`\\bcool\\s?downs?\\s+(?:of\\s+|is\\s+|to\\s+|:\\s*)?${NUM}\\s*${UNIT}?`)];
// Hearts, but not the ones in a condition ("below 5 hearts").
const HEARTS = [new RegExp(`(?<!(?:below|under|than|at|to)\\s)\\b${NUM}\\s*(?:(?:full|extra|more|additional|bonus|less|fewer)\\s+)?hearts?\\b`)];
const HEALTH_POINTS = [new RegExp(`(?<!(?:below|under|than|at|to)\\s)\\b${NUM}\\s*(?:hp|health points?)\\b`)];
// "level 2" on its own; a level said next to an effect is that effect's (levelsIn).
const LEVEL = [/\b(?:level|lvl|tier)\s*(\d{1,3}|i{1,3}|iv|vi{0,3}|ix|x)\b/];
const PERCENT = [new RegExp(`\\b${NUM}\\s*(?:%|percent)`)];
const FACTOR = [new RegExp(`\\b${NUM}\\s*(?:x|times)\\s+(?:as\\s+)?(?:big|bigger|large|larger|small|smaller|tall|taller|the size)\\b`)];
const BLOCKS = [new RegExp(`\\b${NUM}\\s*blocks?\\b`)];

function effectsIn(text: string): string[] {
  let masked = text;
  const found: Array<[number, string]> = [];
  for (const [effect, pattern] of EFFECT_WORDS) {
    masked = masked.replace(pattern, (match, ...rest) => {
      const at = rest.find(value => typeof value === "number") as number;
      found.push([at, effect]);
      return " ".repeat(match.length);
    });
  }
  return [...new Set(found.sort((a, b) => a[0] - b[0]).map(([, effect]) => effect))];
}

const SUMMON_PATTERNS = SUMMONS.map(name => [name, new RegExp(`\\b${name === "wolf" ? "(?:wolf|wolves)" : `${name.replace(/_/g, "[ _]")}(?:e?s)?`}\\b`)] as const);

const LIKE = /\b(?:like|as|similar to|same as|just like)\s+(?:an?\s+|the\s+)?$/;

// Mobs named in the words. "the wither effect" isn't the boss, so the wither counts
// only when something is summoned, and creepers or tnt in "damage from creepers" are a source.
function entityIn(text: string, froms: readonly DamageFrom[]): string | null {
  const summoning = /\b(?:summon|summons|spawn|spawns|spawning|conjure|conjures)\b/.test(text);
  let best: [number, string] | null = null;
  for (const [name, pattern] of SUMMON_PATTERNS) {
    if (name === "wither" && !summoning) continue;
    if ((name === "creeper" || name === "tnt") && froms.includes("explosions") && !summoning) continue;
    const match = pattern.exec(text);
    // "burn in the sun like a zombie" compares, it isn't about zombies.
    if (match === null || LIKE.test(text.slice(0, match.index))) continue;
    if (best === null || match.index < best[0]) best = [match.index, name];
  }
  return best?.[1] ?? null;
}

function whatsIn(raw: string): What[] {
  let text = raw;
  for (const [, pattern] of CONDITIONS) text = text.replace(new RegExp(pattern.source, "g"), match => " ".repeat(match.length));
  const whats = WHATS.filter(([, pattern]) => pattern.test(text)).map(([what]) => what);
  return whats.includes("teleport_random") ? whats.filter(what => what !== "teleport_forward") : whats;
}

// Who an action is done to, read off the words after its verb: "heals me",
// "gives whatever i hit". A small model leans towards "the one I hit" for every
// action on a hit; these words don't.
// "the player" is the one with the power, unless it's "the player i hit".
const ME = "(?:me|myself|us|ourselves|the (?:player|owner|holder|user)(?!\\s+(?:i|you|that|who|which)\\b))";
const OTHER = "(?:them|it|him|her|whoever|whatever|anyone|anything|anybody|everyone|everything|everybody|all|others?|the (?:target|mob|enemy|attacker|player|entity|one|thing|victim)s?|my (?:target|attacker|victim|enem(?:y|ies))|mobs?|entit(?:y|ies|ys)|enemies|players?|monsters?|targets?|attackers?|nearby \\w+|every \\w+|each \\w+|any \\w+|all \\w+)";
const VERBS: Partial<Record<What, string>> = {
  effect: "give|gives|giving|apply|applies|inflict|inflicts|poison|poisons|blind|blinds|slow|slows|weaken|weakens|grant|grants|make|makes|turn|turns",
  heal: "heal|heals|healing|regenerate|regenerates",
  damage: "damage|damages|hurt|hurts|harm|harms",
  fire: "set|sets|ignite|ignites|burn|burns|light|lights",
  launch: "launch|launches|fling|flings|yeet|yeets|send|sends|throw|throws",
  push: "push|pushes|knock|knocks|repel|repels|shove|shoves",
  lightning: "strike|strikes|smite|smites|zap|zaps",
  teleport_forward: "teleport|teleports|tp|tps|blink|blinks",
  teleport_random: "teleport|teleports|tp|tps",
  feed: "feed|feeds",
  clear_effects: "cure|cures|clear|clears|cleanse|cleanses",
  extinguish: "extinguish|extinguishes",
};
// "give me a power that..." is about the power, not an action.
const ABOUT_THE_POWER = /^\s+(?:a|an|the|this|that)\s+(?:power|ability|code|json|file|example)\b/;

// Other entities named at all: on a key press that means the ones around you.
export const OTHERS = /\b(?:mobs?|entit(?:y|ies|ys)|enemies|everyone|everything|everybody|others|players|monsters|creatures|things|anyone|anybody|whoever|whatever)\b/;

export function objectsIn(raw: string): Partial<Record<What, "me" | "other">> {
  const text = withDigits(raw);
  const found: Partial<Record<What, "me" | "other">> = {};
  for (const [what, verbs] of Object.entries(VERBS) as Array<[What, string]>) {
    const seen = new Set<"me" | "other">();
    const pattern = new RegExp(`\\b(?:${verbs})\\s+(${ME}|${OTHER})\\b`, "g");
    for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
      const object = new RegExp(`^${ME}$`).test(match[1]!) ? "me" : "other";
      if (object === "me" && ABOUT_THE_POWER.test(text.slice(match.index + match[0].length))) continue;
      seen.add(object);
    }
    if (what === "effect" && /\bi (?:get|gain|receive|become|am given)\b/.test(text)) seen.add("me");
    if (seen.size === 1) found[what] = [...seen][0]!;
  }
  return found;
}

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
const LEVEL_WORD = "(\\d{1,3}|i{1,3}|iv|vi{0,3}|ix|x)";

// The level said next to each effect: "speed 3", "level 2 haste", "strength level 2".
function levelsIn(text: string): { levels: Record<string, number>; raw: Record<string, string> } {
  const levels: Record<string, number> = {};
  const raw: Record<string, string> = {};
  for (const [effect, pattern] of EFFECT_WORDS) {
    const name = `(?:${pattern.source})`;
    for (const form of [`${name}\\s+(?:level\\s+|lvl\\s*)?${LEVEL_WORD}\\b`, `\\b(?:level|lvl)\\s*${LEVEL_WORD}\\s+${name}`]) {
      const match = new RegExp(form).exec(text);
      if (match === null || effect in levels) continue;
      levels[effect] = ROMAN[match[1]!] ?? Number.parseInt(match[1]!, 10);
      raw[effect] = match[1]!;
    }
  }
  return { levels, raw };
}

const COLORS: Record<string, [number, number, number]> = {
  red: [1, 0, 0], green: [0, 1, 0], blue: [0, 0, 1], yellow: [1, 1, 0], purple: [0.6, 0, 1], pink: [1, 0.5, 0.8], orange: [1, 0.5, 0],
  white: [1, 1, 1], cyan: [0, 1, 1], aqua: [0, 1, 1], magenta: [1, 0, 1], gold: [1, 0.84, 0], golden: [1, 0.84, 0], lime: [0.5, 1, 0],
};
const COLOR = new RegExp(`\\b(${Object.keys(COLORS).join("|")})\\b`);

// Numbers that aren't amounts: versions ("1.21.1") and ids ("mypack:power_2").
const NOT_AMOUNTS = /\b\d+\.\d+\.\d+\b|\b[a-z0-9_.-]+:[a-z0-9_/.-]+\b/g;

export function readRequest(raw: string): Signals {
  const text = withDigits(raw);
  const triggers = TRIGGERS.filter(([, pattern]) => pattern.test(text)).map(([when]) => when);
  const passives = PASSIVES.filter(([, pattern]) => pattern.test(text)).map(([passive]) => passive);
  const effects = effectsIn(text);

  const duration = lastOf(DURATION, text);
  const every = lastOf(EVERY, text);
  const cooldown = lastOf(COOLDOWN, text);
  const hearts = lastOf(HEARTS, text);
  const healthPoints = lastOf(HEALTH_POINTS, text);
  const level = lastOf(LEVEL, text);
  const percent = lastOf(PERCENT, text);
  const factor = lastOf(FACTOR, text);
  const blocks = lastOf(BLOCKS, text);
  const command = /`\/([^`\n]+)`|\b(?:run|runs|execute|executes)\s+(?:the\s+)?(?:command\s+)?["“]?\/([a-z][^"”\n]*?)["”]?(?:$|\s+(?:when|whenever|every|if)\b)/.exec(raw.toLowerCase());
  const unsupported = UNSUPPORTED.exec(text);

  let pct = percent === null ? null : Number.parseFloat(percent.value);
  const word = (pattern: RegExp) => pattern.exec(text)?.[0];
  let percentWord: string | undefined;
  if (pct === null) {
    if ((percentWord = word(/\bhalf\b/)) !== undefined) pct = 50;
    else if ((percentWord = word(/\b(?:double|doubles|doubled|twice)\b/)) !== undefined) pct = 100;
    else if ((percentWord = word(/\b(?:triple|triples|tripled)\b/)) !== undefined) pct = 200;
    else if ((percentWord = word(/\bquarter\b/)) !== undefined) pct = 25;
    else if (/\b(?:no|zero|none|immune|invulnerab\w*|fire\s?proof)\b|\b(?:don'?t|dont|never|can'?t|cant|won'?t|doesn'?t) take\b/.test(text) && passives.includes("less_damage")) pct = 100;
  }
  const levels = levelsIn(text);
  const froms = fromsIn(text);
  let size = factor === null ? null : Number.parseFloat(factor.value);
  let sizeWord: string | undefined;
  if (size === null && passives.some(passive => passive === "bigger" || passive === "smaller")) {
    if ((sizeWord = word(/\b(?:twice|double)\b/)) !== undefined) size = 2;
    else if ((sizeWord = word(/\bhalf\b/)) !== undefined) size = 0.5;
  }

  return {
    triggers,
    conditions: CONDITIONS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name),
    froms,
    near: NEAR.test(text),
    effects,
    entity: entityIn(text, froms),
    command: command === null ? null : (command[1] ?? command[2] ?? "").trim() || null,
    passives,
    whats: whatsIn(text),
    seconds: duration === null ? null : seconds(duration.value, duration.unit),
    every: every === null ? null : seconds(every.value === "" ? "1" : every.value, every.unit),
    cooldown: cooldown === null ? null : seconds(cooldown.value, cooldown.unit),
    hearts: hearts !== null ? Number.parseFloat(hearts.value) : healthPoints !== null ? Number.parseFloat(healthPoints.value) / 2 : null,
    level: level === null ? null : (ROMAN[level.value] ?? Number.parseInt(level.value, 10)),
    levels: levels.levels,
    percent: pct,
    factor: size,
    blocks: blocks === null ? null : Number.parseFloat(blocks.value),
    // "half" and "double" are amounts too: "doubles my speed" has to be used, or it isn't built.
    numbers: text.replace(NOT_AMOUNTS, " ").match(/\b\d+(?:\.\d+)?\b|\b(?:half|double|doubles|doubled|twice|triple|triples|tripled|quarter)\b/g) ?? [],
    raw: {
      ...(duration !== null ? { seconds: duration.value } : {}),
      ...(every !== null && every.value !== "" ? { every: every.value } : {}),
      ...(cooldown !== null ? { cooldown: cooldown.value } : {}),
      ...(hearts !== null ? { hearts: hearts.value } : healthPoints !== null ? { hearts: healthPoints.value } : {}),
      ...(level !== null ? { level: level.value } : {}),
      ...(percent !== null ? { percent: percent.value } : percentWord !== undefined ? { percent: percentWord } : {}),
      ...(factor !== null ? { factor: factor.value } : sizeWord !== undefined ? { factor: sizeWord } : {}),
      ...(blocks !== null ? { blocks: blocks.value } : {}),
    },
    rawLevels: levels.raw,
    color: (() => {
      const named = COLOR.exec(text)?.[1];
      return named === undefined ? null : COLORS[named]!;
    })(),
    toggle: TOGGLE.test(text),
    unsupported: unsupported?.[0] ?? null,
  };
}

const POWER_WORD = /\b(?:powers?|abilit(?:y|ies)|skills?|passives?|perks?)\b/i;
const MAKING = /\b(?:make|makes|making|made|create|creating|write|writing|code|coding|build|building|design|give|gives|need|want|wanna|how (?:do|would|can|could|should|to)|can (?:you|u)|could (?:you|u)|help me)\b/i;
// Asking about powers in general, or about a command, is a question for the Handbook, not a request to build one.
const NOT_A_BUILD = /\b(?:what (?:is|are|does)|explain|difference|why|doesn'?t work|not working|broken|bug|crash\w*|error|command|\/power|grant|revoke|list of|all the|which powers)\b/i;

// "a power that heals me", said without asking.
const DESCRIBED = /\b(?:powers?|abilit(?:y|ies))\s+(?:that|which|where|so that|so i|to make|for|when|while|like)\b|^\s*(?:an?\s+)?(?:power|ability)\s*:/i;

// "can you make me glow when i'm low on health": no "power" in it, but an ability for them.
const MAKE_ME = /\b(?:make|let|allow|help)\s+(?:me|my character|the player|players|us)\b/i;

// A message asking Grove to make one particular power.
export function asksForPower(text: string): boolean {
  if (NOT_A_BUILD.test(text)) return false;
  if (POWER_WORD.test(text) && (MAKING.test(text) || DESCRIBED.test(text))) return true;
  return MAKE_ME.test(text) && readRequest(text).passives.length > 0;
}

const CONFIRM = /^\s*(?:@\S+\s+)?(?:y(?:es|eah|ea|ep|up)?|sure|ok(?:ay)?|k|sounds? good|perfect|great|do it|go ahead|please|pls|plz|yes please|that works|that'?s (?:fine|good|perfect)|just give (?:it|that)(?: to me)?(?: like that)?|give (?:it|that)(?: to me)?(?: like that)?|send (?:it|that)|(?:can i (?:get|have)|give me|send me|show me) (?:it|that|the (?:code|json|file|power))|the (?:code|json|file) (?:please|pls)?)\b[\s\S]{0,60}$/i;
const CHANGE = /\b(?:make it|change it|instead|actually|also|add|without|longer|shorter|stronger|weaker|more|less|only|but)\b/i;

export type FollowUp = "confirm" | "change" | null;

// "yeah" or "just give it to me" after a request for a power, or a change to it ("make it 20 seconds").
export function followUpKind(text: string): FollowUp {
  const signals = readRequest(text);
  const named = signals.effects.length + signals.conditions.length + signals.triggers.length + signals.passives.length + (signals.near ? 1 : 0)
    + [signals.seconds, signals.every, signals.cooldown, signals.hearts, signals.level, signals.percent, signals.factor, signals.blocks].filter(value => value !== null).length;
  if (named > 0 && (CHANGE.test(text) || text.length <= 60)) return "change";
  if (CONFIRM.test(text)) return "confirm";
  return null;
}
