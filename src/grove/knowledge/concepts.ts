// What people ask for in their own words, and the Handbook pages of the types
// that do it. A search finds pages that share words with a question, but "only
// at night" shares none with apoli:daytime, and "heals me every 5 seconds while
// I'm in water" needs three pages (action_over_time, heal, submerged_in) that
// no single search ranks together. The table covers the common asks only;
// everything else is left to the search.
//
// A hint is the one fact a small model gets wrong about it (ticks are not
// seconds, night is daytime inverted). Every hint is checked against the
// Handbook and the source, and must stay that way when they change.
//
// Pages are named by their Handbook link without the "/docs/datapack/" part.

interface Concept {
  pattern: RegExp;
  pages: readonly string[];
  hint?: string;
}

const SUBJECT = "(?:i|you|we|they|he|she|it|the player|players|someone|my character|the entity)";

const CONCEPTS: readonly Concept[] = [
  // What makes a power fire.
  {
    pattern: new RegExp(`\\b(?:when|whenever|if|after|each time|every time)\\s+${SUBJECT}\\s+(?:hit|hits|attack|attacks|punch|punches|strike|strikes|melee)\\b|\\bon hit\\b|\\bhitting (?:an? |the )?(?:entity|mob|player|enemy|something|someone)|\\bupon hitting\\b`, "i"),
    pages: ["powers/action_on_hit"],
    hint: 'apoli:action_on_hit fires when you hit something: "target_action" runs an entity action on the one you hit, "self_action" one on you, and "bientity_action" a bi-entity action on the pair.',
  },
  {
    pattern: new RegExp(`\\b(?:when|whenever|if|after|each time|every time)\\s+${SUBJECT}(?:(?:'m|'re|'s)\\s+|\\s+(?:get|gets|got|am|are|is|was|being)\\s+)(?:hit|attacked|hurt|damaged)\\b|\\bwhen hit\\b|\\bgetting hit\\b|\\b(?:when|whenever|if)\\s+${SUBJECT}\\s+takes?\\s+damage\\b`, "i"),
    pages: ["powers/action_when_hit"],
    hint: 'apoli:action_when_hit fires when you get hit: "self_action" runs an entity action on you, and "attacker_action" one on whoever hit you.',
  },
  {
    pattern: /\bpress(?:es|ing|ed)?\s+(?:a|the|my|their|an?)?\s*(?:\w+\s+)?(?:key|button)\b|\bkey\s?binds?\b|\bhot\s?keys?\b|\babilit(?:y|ies) key\b|\bactive abilit(?:y|ies)\b/i,
    pages: ["powers/action_on_key_press"],
    hint: 'apoli:action_on_key_press runs its "entity_action" when the key is pressed (the primary ability key unless "key" says otherwise). "cooldown" is in ticks: 20 ticks = 1 second.',
  },
  {
    pattern: /\bevery\s+(?:\d+(?:\.\d+)?|a|one|few|couple(?: of)?)?\s*(?:seconds?|secs?|ticks?|minutes?|mins?)\b|\bover time\b|\bperiodically\b|\bevery (?:second|tick|minute)\b|\bconstantly\b/i,
    pages: ["powers/action_over_time"],
    hint: 'apoli:action_over_time runs its "entity_action" every "interval" ticks: 20 ticks = 1 second, so every 5 seconds is "interval": 100. Give it a "condition" to run only some of the time.',
  },
  { pattern: new RegExp(`\\bwhen\\s+${SUBJECT}\\s+lands?\\b|\\bon landing\\b|\\bwhen landing\\b`, "i"), pages: ["powers/action_on_land"] },
  { pattern: new RegExp(`\\bwhen\\s+${SUBJECT}\\s+(?:die|dies)\\b|\\bon death\\b|\\bupon death\\b`, "i"), pages: ["powers/action_on_death"] },
  { pattern: new RegExp(`\\bwhen\\s+${SUBJECT}\\s+(?:eat|eats|use|uses|drink|drinks|right[- ]clicks?)\\b`, "i"), pages: ["powers/action_on_item_use"] },
  // What a power does.
  { pattern: /\bnight vision\b|\bsee in the dark\b/i, pages: ["powers/night_vision"] },
  { pattern: /\bwalk(?:s|ing)? on (?:water|lava|fluids?)\b/i, pages: ["powers/walk_on_fluid"] },
  { pattern: /\bbreathe? under\s?water\b|\bwater breathing\b|\bnever drown\b/i, pages: ["powers/water_breathing"] },
  { pattern: /\b(?:creative )?fl(?:y|ying|ight)\b|\blevitat\w*\b/i, pages: ["powers/creative_flight"] },
  { pattern: /\bglid(?:e|ing)\b|\belytra\b/i, pages: ["powers/elytra_flight"] },
  { pattern: /\binvisib\w*\b/i, pages: ["powers/invisibility"] },
  {
    pattern: /\bglow(?:s|ing)?\b|\boutline\b/i,
    pages: ["powers/entity_glow", "powers/self_glow"],
    hint: 'apoli:self_glow makes you glow, apoli:entity_glow makes others glow for you. Their "entity_condition" only picks WHO sees or gets the glow. To glow only some of the time (like at low health), give the power its own "condition".',
  },
  { pattern: /\bclimb\w*\b|\bwall ?climb\w*\b/i, pages: ["powers/climbing"] },
  { pattern: /\b(?:smaller|bigger|larger|tiny|giant|shrink\w*|resiz\w*)\b|\bchange (?:the |my |their )?size\b/i, pages: ["powers/scale"] },
  {
    pattern: /\bfall damage\b|\btake no fall\b|\bfall (?:slower|softly)\b/i,
    pages: ["powers/modify_falling", "damage-conditions/from_falling"],
    hint: 'No fall damage: apoli:modify_falling with "take_fall_damage": false. Less fall damage: apoli:modify_damage_taken with "damage_condition": { "type": "apoli:from_falling" } and a "modifier".',
  },
  {
    pattern: /\b(?:immune|immunity|resist\w*|invulnerab\w*|can'?t burn)\b[^.?!]*\b(?:fire|flames?|lava|burn\w*)\b|\bfire\s?proof\b|\bfire immun\w*/i,
    pages: ["powers/invulnerability", "damage-conditions/in_tag"],
    hint: 'Immune to fire: apoli:invulnerability with "damage_condition": { "type": "apoli:in_tag", "tag": "minecraft:is_fire" } (the vanilla tag of every fire damage type).',
  },
  { pattern: /\b(?:immune|immunity|invulnerab\w*|can'?t (?:be hurt|take damage))\b/i, pages: ["powers/invulnerability"] },
  {
    pattern: /\b(?:strength|haste|regeneration|resistance|jump boost|slow falling|fire resistance|absorption|luck|slowness|weakness|poison|wither|nausea|blindness|levitation|(?:status|potion) effects?)\b[^.?!]*\b(?:when|while|whenever|if|during|in|at|as long as)\b/i,
    pages: ["entity-actions/apply_effect", "powers/action_over_time"],
    hint: 'A potion effect while something is true: an apoli:action_over_time with "interval": 20, "entity_action": { "type": "apoli:apply_effect", "effect": { "effect": "minecraft:strength", "duration": 40, "amplifier": 0 } } and that "condition". Keep the duration longer than the interval so it never runs out.',
  },
  { pattern: /\b(?:mana|stamina|energy|resource bar|resource|meter)\b/i, pages: ["powers/resource"] },
  {
    pattern: /\b(?:drain\w*|goes down|go down|decreas\w*|fills? up|goes up|increas\w*|refill\w*)\b[^.?!]*\b(?:resource|bar|mana|stamina|energy|meter)\b|\b(?:resource|bar|mana|stamina|energy|meter)\b[^.?!]*\b(?:drain\w*|goes down|go down|decreas\w*|fills? up|goes up|increas\w*|refill\w*)\b/i,
    pages: ["entity-actions/modify_resource", "powers/action_over_time"],
    hint: 'A bar that drains or fills over time is two powers in one apoli:multiple: an apoli:resource (the bar) and an apoli:action_over_time whose "entity_action" is an apoli:modify_resource with "resource": "*:*_<the bar\'s key>" and a "modifier" like { "operation": "add_base_early", "value": -1 }.',
  },
  {
    pattern: /\b(?:move|run|walk|swim)(?:s|ing)? (?:faster|slower)\b|\bmovement speed\b|\bspeed\s+(?:2|ii|two|boost)\b|\bgives? (?:me |them |you )?(?:a )?speed\b/i,
    pages: ["powers/attribute"],
    hint: 'Walking faster: an apoli:attribute power with "modifier": { "attribute": "minecraft:generic.movement_speed", "operation": "multiply_base", "value": 0.4 } (40% faster, like Speed II). Add a "condition" to make it work only sometimes.',
  },
  { pattern: /\bmore (?:health|hearts|armou?r)\b|\bmax(?:imum)? health\b|\battributes?\b/i, pages: ["powers/attribute"] },
  { pattern: /\bphas(?:e|ing)\b|\bthrough (?:walls|blocks)\b|\bnoclip\b/i, pages: ["powers/phasing"] },
  { pattern: /\b(?:permanent|always have|constant) (?:status |potion )?effects?\b/i, pages: ["powers/stacking_status_effect"] },
  { pattern: /\bdeal (?:more|less|extra|double|half) damage\b|\b(?:stronger|weaker) (?:attacks|hits)\b|\bmore damage\b/i, pages: ["powers/modify_damage_dealt"] },
  { pattern: /\btake (?:less|more|extra|double|half|no) damage\b|\bdamage resistance\b/i, pages: ["powers/modify_damage_taken"] },
  { pattern: /\bjump (?:higher|boost)\b|\bhigher jumps?\b|\bdouble jump\b/i, pages: ["powers/modify_jump"] },
  {
    pattern: /\btoggle\w*\b|\bturn (?:it |them )?on and off\b|\bswitch (?:it |them )?on and off\b/i,
    pages: ["powers/toggle", "entity-conditions/power_active"],
    hint: 'apoli:toggle only switches itself on and off with its key (the primary ability key unless "key" says otherwise). To make another power follow it, give that power "condition": { "type": "apoli:power_active", "power": "<the toggle power\'s id>" }.',
  },
  { pattern: /\bparticles?\b/i, pages: ["powers/particle", "entity-actions/spawn_particles"] },
  { pattern: /\bfog\b/i, pages: ["powers/modify_fog"] },
  { pattern: /\bburn(?:s|ing)? in (?:the )?(?:sun|daylight)\b/i, pages: ["powers/burn", "entity-conditions/exposed_to_sun"] },
  // What an action does.
  { pattern: /\bheal(?:s|ing|ed)?\b|\bregenerat\w*\b|\bregain health\b/i, pages: ["entity-actions/heal"], hint: 'apoli:heal "amount" is in health points: 2 = one heart. A negative amount hurts instead.' },
  { pattern: /\b(?:set|sets|setting|lights?)\s+(?:\w+\s+){0,2}on fire\b|\bignite\w*\b/i, pages: ["entity-actions/set_on_fire"] },
  { pattern: /\b(?:launch|fling|propel|knock\s?back|push|yeet|dash|leap)\w*\b|\b(?:up|for)wards?\b/i, pages: ["entity-actions/add_velocity"] },
  { pattern: /\b(?:damage|hurt)s?\s+(?:them|the target|mobs|enemies|entities|nearby|everyone|the attacker)\b/i, pages: ["entity-actions/damage"] },
  { pattern: /\bteleport\w*\b|\bblink\b/i, pages: ["entity-actions/teleport"] },
  { pattern: /\bplays? (?:a )?sounds?\b|\bsound effects?\b/i, pages: ["entity-actions/play_sound"] },
  { pattern: /\b(?:run|runs|execute|executes)\s+(?:a\s+)?(?:command|function)\b/i, pages: ["entity-actions/execute_command"] },
  { pattern: /\b(?:give|gives|apply|applies|add|adds)\s+(?:\w+\s+){0,3}(?:status |potion )?(?:effects?|potions?)\b/i, pages: ["entity-actions/apply_effect"] },
  { pattern: /\b(?:feed|feeds|restore hunger|saturation)\b/i, pages: ["entity-actions/feed"] },
  { pattern: /\bsummon\w*\b|\bspawn(?:s|ing)?\s+(?:an?\s+)?(?:mob|entity|creature|zombie|minion)s?\b/i, pages: ["entity-actions/spawn_entity"] },
  // When a power is active.
  {
    pattern: /\b(?:in|under|touching|inside|into)\s+(?:the\s+)?water\b|\bunder\s?water\b|\bsubmerged\b|\bswimming\b|\bwet\b/i,
    pages: ["entity-conditions/submerged_in", "entity-conditions/fluid_height"],
    hint: 'In water: { "type": "apoli:submerged_in", "fluid": "minecraft:water" } passes while the eyes are under water. Put it in the power\'s "condition" to make it work only then.',
  },
  { pattern: /\b(?:in|under|touching|inside)\s+(?:the\s+)?lava\b/i, pages: ["entity-conditions/submerged_in", "entity-conditions/fluid_height"] },
  {
    pattern: /\bat night\b|\bnight\s?time\b|\bduring the night\b|\bwhen it'?s (?:dark|night)\b|\b(?:only )?(?:works|active) at night\b/i,
    pages: ["entity-conditions/daytime", "entity-conditions/time_of_day"],
    hint: 'Only at night: give the power "condition": { "type": "apoli:daytime", "inverted": true }. Every power can take a "condition".',
  },
  {
    pattern: /\bduring the day\b|\bday\s?time\b|\bwhen it'?s day\b|\bin the day\b/i,
    pages: ["entity-conditions/daytime", "entity-conditions/time_of_day"],
    hint: 'Only in the day: give the power "condition": { "type": "apoli:daytime" }. Every power can take a "condition".',
  },
  { pattern: /\bin (?:the )?(?:sun|sunlight)\b|\bunder the (?:open )?sky\b|\bexposed to (?:the )?sun\b/i, pages: ["entity-conditions/exposed_to_sun"] },
  { pattern: /\b(?:in the|while it'?s|when it'?s|in) rain\w*\b|\braining\b/i, pages: ["entity-conditions/in_rain"] },
  { pattern: /\bsneak\w*\b|\bcrouch\w*\b|\bshifting\b/i, pages: ["entity-conditions/sneaking"], hint: 'While sneaking: give the power "condition": { "type": "apoli:sneaking" }.' },
  { pattern: /\bsprint\w*\b/i, pages: ["entity-conditions/sprinting"], hint: 'While sprinting: { "type": "apoli:sprinting" } (it only works on players).' },
  { pattern: /\b(?:while|when|if)\s+(?:i'?m|i am|you'?re|they'?re|it'?s)?\s*(?:on fire|burning)\b/i, pages: ["entity-conditions/on_fire"] },
  {
    pattern: /\b(?:low|below|under|less than|lower than)\s+(?:on\s+)?(?:\d+\s+)?(?:health|hp|hearts?)\b|\bhealth (?:is )?(?:below|under|low|less)\b/i,
    pages: ["entity-conditions/relative_health", "entity-conditions/health"],
    hint: 'Low health: { "type": "apoli:relative_health", "comparison": "<=", "compare_to": 0.3 } passes at 30% health or less (it compares health / max health, 0 to 1).',
  },
  { pattern: /\bholding\b|\bwearing\b|\bequipped\b|\bin (?:my|their|your) (?:main ?)?hand\b/i, pages: ["entity-conditions/equipped_item"] },
  { pattern: /\bstanding on\b|\bon top of (?:a |the )?block\b/i, pages: ["entity-conditions/on_block"] },
  // Origins.
  {
    pattern: /\b(?:make|making|create|creating|write|writing|own|custom|new)\s+(?:an?\s+|my\s+|my own\s+|a custom\s+|custom\s+)?origins?\b|\borigin files?\b/i,
    pages: ["origins/overview", "origins/layers"],
    hint: 'An origin is a file in data/<namespace>/origins/ (its file name is its id) with an "icon", an "impact" and a "powers" list of power ids. To put it on the normal pick screen, add data/origins/origin_layers/origin.json to the pack with "origins": ["<namespace>:<name>"].',
  },
  {
    pattern: /\/origin\b|\borigin command\b|\bcommand\b[^.?!]*\borigins?\b|\b(?:give|set|change|switch)\s+(?:\w+\s+){0,3}(?:an?\s+)?origin\b[^.?!]*\bcommand\b/i,
    pages: ["commands/origin"],
    hint: '/origin set <targets> <layer> <origin> gives someone an origin. The normal pick screen is the layer origins:origin, so: /origin set @s origins:origin origins:merling',
  },
  { pattern: /\borigin layers?\b|\blayer files?\b/i, pages: ["origins/layers"] },
  {
    pattern: /\/(?:apoli:)?power\b|\bpower command\b|\b(?:give|grant|take|remove|revoke)\b[^.?!]*\bpowers?\b[^.?!]*\bcommand\b|\bcommand\b[^.?!]*\b(?:give|grant|take|remove|revoke)\b[^.?!]*\bpowers?\b/i,
    pages: ["commands/power"],
    hint: '/power grant <targets> <power> gives a power and /power revoke <targets> <power> takes it away. <power> is the power file\'s id: data/mypack/powers/fire_punch.json is mypack:fire_punch. A command goes in a ```mcfunction block, not in json.',
  },
  { pattern: /\bbadges?\b/i, pages: ["origins/badges"] },
];

// The pages for what the question asks for, in the order the table lists them
// (what triggers it, what it does, when), at most `limit`.
export function conceptPages(question: string, limit = 4): string[] {
  const pages: string[] = [];
  for (const { pattern, pages: found } of CONCEPTS) {
    if (!pattern.test(question)) continue;
    for (const page of found) if (!pages.includes(page)) pages.push(page);
  }
  return pages.slice(0, limit);
}

// The hints for what the question asks for.
export function conceptHints(question: string, limit = 4): string[] {
  return CONCEPTS.filter(concept => concept.hint !== undefined && concept.pattern.test(question)).map(concept => concept.hint!).slice(0, limit);
}

// Every page the table points to, so a test can check them against the library.
export function allConceptPages(): string[] {
  return [...new Set(CONCEPTS.flatMap(concept => concept.pages))];
}
