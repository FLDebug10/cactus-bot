// The pieces Grove puts powers together from: what sets a power off, what it does
// and to whom, what it lets you do all the time, and when it works. Each piece is
// one Handbook type written the way its page says, so a power made of them loads
// as it is. A built power is still checked against the library before it is sent.
//
// The words in `label` are the choices the planner gives the model, so they say
// what a player would say, not what the type is called.

export type Json = Record<string, unknown>;

export type When = "hit" | "hurt" | "kill" | "key" | "time" | "land" | "death" | "eat" | "passive";
export type Who = "me" | "other" | "near";
export type What = "effect" | "clear_effects" | "heal" | "damage" | "fire" | "extinguish" | "launch" | "push" | "lightning" | "summon" | "explode" | "teleport_forward" | "teleport_random" | "feed" | "command";
export type Passive =
  | "fly" | "glide" | "breathe_underwater" | "night_vision" | "walk_on_water" | "walk_on_lava" | "climb" | "invisible" | "glow" | "phase"
  | "effect_immunity" | "less_damage" | "more_damage_taken" | "more_damage_dealt" | "less_damage_dealt" | "faster" | "slower" | "jump_higher"
  | "permanent_effect" | "more_health" | "less_health" | "bigger" | "smaller" | "burn_in_sun";
export type While = "sneaking" | "sprinting" | "swimming" | "in_water" | "in_lava" | "on_fire" | "night" | "day" | "rain" | "sunlight" | "low_health";
export type DamageFrom = "fire" | "falling" | "projectiles" | "explosions" | "magic" | "drowning" | "melee";

export interface PlannedAction {
  who: Who;
  what: What;
  effect: string | null;
  seconds: number | null;
  level: number | null;
  hearts: number | null;
  entity: string | null;
  command: string | null;
  // Teleport distance in blocks.
  blocks: number | null;
}

export interface Plan {
  when: When;
  actions: PlannedAction[];
  // Always-on abilities; several go in one apoli:multiple.
  passives: Passive[];
  // The status effects a passive is about, and their level: one for all, or each its own.
  effects: string[];
  level: number | null;
  levels: Record<string, number>;
  // A glow colour as red, green and blue from 0 to 1.
  color: [number, number, number] | null;
  // Only on this mob: "creepers i hit".
  target: string | null;
  // How much more or less: damage and speed in percent, size as a factor, health in hearts.
  percent: number | null;
  factor: number | null;
  hearts: number | null;
  // The damage it's about. None: any damage.
  from: DamageFrom[];
  conditions: While[];
  // In seconds, as people say them.
  cooldown: number | null;
  every: number | null;
  radius: number | null;
  // Switched on and off with the ability key.
  toggle: boolean;
}

// Every status effect in 1.21.1 (MobEffects).
export const EFFECTS = [
  "speed", "slowness", "haste", "mining_fatigue", "strength", "instant_health", "instant_damage", "jump_boost", "nausea", "regeneration",
  "resistance", "fire_resistance", "water_breathing", "invisibility", "blindness", "night_vision", "hunger", "weakness", "poison", "wither",
  "health_boost", "absorption", "saturation", "glowing", "levitation", "luck", "unluck", "slow_falling", "conduit_power", "dolphins_grace",
  "bad_omen", "hero_of_the_village", "darkness", "trial_omen", "raid_omen", "wind_charged", "weaving", "oozing", "infested",
] as const;

// What a power can sensibly summon: mobs and a few things that act on their own.
export const SUMMONS = [
  "allay", "armadillo", "axolotl", "bat", "bee", "blaze", "bogged", "breeze", "camel", "cat", "cave_spider", "chicken", "cod", "cow", "creeper",
  "dolphin", "donkey", "drowned", "elder_guardian", "enderman", "endermite", "evoker", "evoker_fangs", "firework_rocket", "fox", "frog", "ghast",
  "goat", "guardian", "hoglin", "horse", "husk", "iron_golem", "lightning_bolt", "llama", "magma_cube", "mooshroom", "mule", "ocelot", "panda",
  "parrot", "phantom", "pig", "piglin", "piglin_brute", "pillager", "polar_bear", "rabbit", "ravager", "sheep", "shulker", "silverfish",
  "skeleton", "skeleton_horse", "slime", "sniffer", "snow_golem", "spider", "squid", "stray", "strider", "tnt", "turtle", "vex", "villager",
  "vindicator", "warden", "witch", "wither", "wither_skeleton", "wolf", "zoglin", "zombie", "zombie_horse", "zombie_villager", "zombified_piglin",
] as const;

export interface Used {
  id: string;
  kind: "power" | "entity_action" | "bientity_action" | "entity_condition" | "damage_condition";
}

// Where a trigger puts an entity action for each entity it knows about. `pair`
// takes a bi-entity action whose actor is the owner and whose target is the other.
interface Trigger {
  type: string;
  label: string;
  // "whenever you hit something"
  event: string;
  // "the one you hit"; null when the trigger has nobody else.
  otherName: string | null;
  me: (action: Json) => Json;
  other: ((action: Json) => Json) | null;
  pair: ((action: Json) => Json) | null;
  cooldown: boolean;
  // Takes a damage condition for the hit (projectiles only, fire only).
  damage: boolean;
  // Where a filter on the other entity goes, and the event said with it ("whenever you hit a zombie").
  filter: { field: string; event: (mob: string) => string } | null;
}

const targetAction = (action: Json): Json => ({ type: "apoli:target_action", action });
const actorAction = (action: Json): Json => ({ type: "apoli:actor_action", action });

export const TRIGGERS: Record<Exclude<When, "passive">, Trigger> = {
  hit: {
    type: "apoli:action_on_hit",
    label: "when I hit something",
    event: "whenever you hit something",
    otherName: "the one you hit",
    me: action => ({ self_action: action }),
    other: action => ({ target_action: action }),
    pair: action => ({ bientity_action: action }),
    cooldown: true,
    damage: true,
    filter: { field: "target_condition", event: mob => `whenever you hit a ${mob}` },
  },
  hurt: {
    type: "apoli:action_when_hit",
    label: "when something hurts me",
    event: "whenever something hurts you",
    otherName: "whoever hurt you",
    me: action => ({ self_action: action }),
    other: action => ({ attacker_action: action }),
    // Its actor is the attacker, so a "from me to them" action is turned around.
    pair: action => ({ bientity_action: { type: "apoli:invert", action } }),
    cooldown: true,
    damage: true,
    filter: { field: "attacker_condition", event: mob => `whenever a ${mob} hurts you` },
  },
  kill: {
    type: "apoli:action_on_kill",
    label: "when I kill something",
    event: "whenever you kill something",
    otherName: "the one you killed",
    me: action => ({ self_action: action }),
    other: action => ({ target_action: action }),
    pair: action => ({ bientity_action: action }),
    cooldown: true,
    damage: true,
    filter: { field: "target_condition", event: mob => `whenever you kill a ${mob}` },
  },
  key: {
    type: "apoli:action_on_key_press",
    label: "when I press the ability key",
    event: "when you press your ability key",
    otherName: null,
    me: action => ({ entity_action: action }),
    other: null,
    pair: null,
    cooldown: true,
    damage: false,
    filter: null,
  },
  time: {
    type: "apoli:action_over_time",
    label: "every few seconds",
    event: "every few seconds",
    otherName: null,
    me: action => ({ entity_action: action }),
    other: null,
    pair: null,
    cooldown: false,
    damage: false,
    filter: null,
  },
  land: {
    type: "apoli:action_on_land",
    label: "when I land",
    event: "whenever you land",
    otherName: null,
    me: action => ({ entity_action: action }),
    other: null,
    pair: null,
    cooldown: false,
    damage: false,
    filter: null,
  },
  // The one who died is the target and the killer the actor; with no killer the
  // owner is both, so "me" is always right and "the killer" may be the owner.
  death: {
    type: "apoli:action_on_death",
    label: "when I die",
    event: "when you die",
    otherName: "whoever killed you",
    me: action => ({ bientity_action: targetAction(action) }),
    other: action => ({ bientity_action: actorAction(action) }),
    pair: null,
    cooldown: false,
    damage: true,
    filter: null,
  },
  eat: {
    type: "apoli:action_on_item_use",
    label: "when I finish eating or drinking",
    event: "whenever you finish eating or drinking something",
    otherName: null,
    me: action => ({ entity_action: action }),
    other: null,
    pair: null,
    cooldown: false,
    damage: false,
    filter: null,
  },
};

export const WHO_LABELS: Record<string, Who> = {
  me: "me",
  "the one I hit": "other",
  "the one who hurt me": "other",
  "the one I killed": "other",
  "the one who killed me": "other",
  "everything near me": "near",
};

export const WHAT_LABELS: Record<string, What> = {
  "give a status effect": "effect",
  "remove status effects": "clear_effects",
  heal: "heal",
  "deal damage": "damage",
  "set on fire": "fire",
  "put out fire": "extinguish",
  "launch up into the air": "launch",
  "knock away from me": "push",
  "strike with lightning": "lightning",
  "summon an entity": "summon",
  "make an explosion": "explode",
  "teleport forward": "teleport_forward",
  "teleport to a random spot": "teleport_random",
  "restore hunger": "feed",
  "run a command": "command",
};

export const PASSIVE_LABELS: Record<string, Passive> = {
  "fly like in creative mode": "fly",
  "glide like with an elytra": "glide",
  "breathe underwater": "breathe_underwater",
  "see in the dark": "night_vision",
  "walk on water": "walk_on_water",
  "walk on lava": "walk_on_lava",
  "climb walls": "climb",
  "be invisible": "invisible",
  glow: "glow",
  "phase through blocks": "phase",
  "be immune to a status effect": "effect_immunity",
  "take less damage": "less_damage",
  "take more damage": "more_damage_taken",
  "deal more damage": "more_damage_dealt",
  "deal less damage": "less_damage_dealt",
  "move faster": "faster",
  "move slower": "slower",
  "jump higher": "jump_higher",
  "have a status effect": "permanent_effect",
  "have more max health": "more_health",
  "have less max health": "less_health",
  "be bigger": "bigger",
  "be smaller": "smaller",
  "burn in sunlight": "burn_in_sun",
};

const CONDITIONS: Record<While, { condition: Json; words: string }> = {
  sneaking: { condition: { type: "apoli:sneaking" }, words: "while you're sneaking" },
  sprinting: { condition: { type: "apoli:sprinting" }, words: "while you're sprinting" },
  swimming: { condition: { type: "apoli:swimming" }, words: "while you're swimming" },
  in_water: { condition: { type: "apoli:submerged_in", fluid: "minecraft:water" }, words: "while you're underwater" },
  in_lava: { condition: { type: "apoli:submerged_in", fluid: "minecraft:lava" }, words: "while you're in lava" },
  on_fire: { condition: { type: "apoli:on_fire" }, words: "while you're on fire" },
  night: { condition: { type: "apoli:daytime", inverted: true }, words: "at night" },
  day: { condition: { type: "apoli:daytime" }, words: "during the day" },
  rain: { condition: { type: "apoli:in_rain" }, words: "while you're in the rain" },
  sunlight: { condition: { type: "apoli:exposed_to_sun" }, words: "while you're in sunlight" },
  low_health: { condition: { type: "apoli:relative_health", comparison: "<=", compare_to: 0.3 }, words: "while you're at 30% health or less" },
};

const DAMAGE_FROM: Record<DamageFrom, { condition: Json; words: string }> = {
  fire: { condition: { type: "apoli:in_tag", tag: "minecraft:is_fire" }, words: "fire" },
  falling: { condition: { type: "apoli:from_falling" }, words: "falling" },
  projectiles: { condition: { type: "apoli:projectile" }, words: "projectiles" },
  explosions: { condition: { type: "apoli:explosive" }, words: "explosions" },
  magic: { condition: { type: "apoli:type", damage_type: "minecraft:magic" }, words: "magic" },
  drowning: { condition: { type: "apoli:type", damage_type: "minecraft:drown" }, words: "drowning" },
  melee: { condition: { type: "apoli:projectile", inverted: true }, words: "anything but projectiles" },
};

// What a built power is: the file, what it does in Grove's words, what to change, and the types in it.
export interface Built {
  power: Json;
  json: string;
  does: string;
  tips: string[];
  used: Used[];
}

const ticks = (seconds: number) => Math.max(1, Math.round(seconds * 20));
const hp = (hearts: number) => Math.round(hearts * 2 * 100) / 100;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const effectName = (id: string) => id.replace(/_/g, " ");
const level = (value: number | null) => Math.min(255, Math.max(1, Math.round(value ?? 1)));
const listing = (items: readonly string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
// "you get" but "the one you hit gets".
const says = (who: string, one: string, you: string) => `${who} ${who === "you" ? you : one}`;

// The entity action for one planned action, with what it does in words, or null
// when the plan left out something it needs (what to summon, which command).
function entityAction(action: PlannedAction, who: string, used: Used[], tips: Set<string>): { json: Json; words: string } | null {
  const use = (id: string) => used.push({ id, kind: "entity_action" });
  switch (action.what) {
    case "effect": {
      if (action.effect === null) return null;
      const seconds = action.seconds ?? 10;
      const lvl = level(action.level);
      use("apoli:apply_effect");
      tips.add('ticks:"duration"').add('"amplifier" 0 is level 1 and 1 is level 2');
      return { json: { type: "apoli:apply_effect", effect: { effect: `minecraft:${action.effect}`, duration: ticks(seconds), amplifier: lvl - 1 } }, words: `${says(who, "gets", "get")} ${effectName(action.effect)}${lvl > 1 ? ` ${lvl}` : ""} for ${plural(seconds, "second")}` };
    }
    case "clear_effects":
      use("apoli:clear_effect");
      return action.effect === null
        ? { json: { type: "apoli:clear_effect" }, words: `${says(who, "loses", "lose")} every status effect` }
        : { json: { type: "apoli:clear_effect", effect: `minecraft:${action.effect}` }, words: `${says(who, "loses", "lose")} ${effectName(action.effect)}` };
    case "heal": {
      const hearts = action.hearts ?? 2;
      use("apoli:heal");
      tips.add('"amount" is in health points: 2 = one heart');
      return { json: { type: "apoli:heal", amount: hp(hearts) }, words: `${says(who, "heals", "heal")} ${plural(hearts, "heart")}` };
    }
    case "damage": {
      const hearts = action.hearts ?? 2;
      use("apoli:damage");
      tips.add('"amount" is in health points: 2 = one heart');
      return { json: { type: "apoli:damage", amount: hp(hearts), damage_type: "minecraft:generic" }, words: `${says(who, "takes", "take")} ${plural(hearts, "heart")} of damage` };
    }
    case "fire": {
      const seconds = Math.max(1, Math.round(action.seconds ?? 5));
      use("apoli:set_on_fire");
      tips.add('set_on_fire\'s "duration" is in seconds, not ticks');
      return { json: { type: "apoli:set_on_fire", duration: seconds }, words: `${says(who, "is", "are")} set on fire for ${plural(seconds, "second")}` };
    }
    case "extinguish":
      use("apoli:extinguish");
      return { json: { type: "apoli:extinguish" }, words: `${says(who, "stops", "stop")} burning` };
    case "launch":
      use("apoli:add_velocity");
      tips.add('a bigger "y" launches higher');
      return { json: { type: "apoli:add_velocity", y: 1 }, words: `${says(who, "is", "are")} launched into the air` };
    case "lightning":
      use("apoli:spawn_entity");
      return { json: { type: "apoli:spawn_entity", entity_type: "minecraft:lightning_bolt" }, words: `lightning strikes ${who}` };
    case "summon":
      if (action.entity === null) return null;
      use("apoli:spawn_entity");
      return { json: { type: "apoli:spawn_entity", entity_type: `minecraft:${action.entity}` }, words: `a ${effectName(action.entity)} spawns at ${who}` };
    case "explode":
      use("apoli:explode");
      tips.add('add "destruction_type": "none" to the explosion to keep the blocks');
      return { json: { type: "apoli:explode", power: 3, ...(action.who === "me" ? { damage_self: false } : {}) }, words: `${who === "you" ? "you explode" : `${who} explodes`}${action.who === "me" ? " without getting hurt" : ""}` };
    case "teleport_forward": {
      const blocks = action.blocks ?? 5;
      use("apoli:teleport");
      return { json: { type: "apoli:teleport", space: "local", z: blocks }, words: `${who === "you" ? "you teleport" : `${who} teleports`} ${plural(blocks, "block")} forward` };
    }
    case "teleport_random":
      use("apoli:random_teleport");
      return { json: { type: "apoli:random_teleport" }, words: `${who === "you" ? "you teleport" : `${who} teleports`} to a random spot nearby` };
    case "feed":
      use("apoli:feed");
      return { json: { type: "apoli:feed", food: 6, saturation: 2 }, words: `${says(who, "gets", "get")} 3 hunger shanks back` };
    case "command":
      if (action.command === null) return null;
      use("apoli:execute_command");
      return { json: { type: "apoli:execute_command", command: action.command.replace(/^\//, "") }, words: `\`/${action.command.replace(/^\//, "")}\` runs as ${who}` };
    case "push":
      return null;
  }
}

// Several actions for the same slot run one after another.
const together = (actions: Json[]): Json => (actions.length === 1 ? actions[0]! : { type: "apoli:and", actions });

function conditionOf(conditions: readonly While[], extra: readonly Json[] = []): Json | null {
  const all = [...extra, ...conditions.map(name => CONDITIONS[name].condition)];
  if (all.length === 0) return null;
  return all.length === 1 ? all[0]! : { type: "apoli:all_of", conditions: all };
}

function conditionWords(conditions: readonly While[]): string {
  return conditions.map(name => CONDITIONS[name].words).join(" and ");
}

function usedConditions(conditions: readonly While[], used: Used[]): void {
  for (const name of conditions) used.push({ id: String(CONDITIONS[name].condition.type), kind: "entity_condition" });
  if (conditions.length > 1) used.push({ id: "apoli:all_of", kind: "entity_condition" });
}

function triggered(plan: Plan, trigger: Trigger, used: Used[], tips: Set<string>): Built | null {
  const slots = new Map<string, { place: (action: Json) => Json; actions: Json[] }>();
  const add = (slot: string, place: (action: Json) => Json, action: Json) => {
    const found = slots.get(slot) ?? { place, actions: [] };
    found.actions.push(action);
    slots.set(slot, found);
  };
  const said: string[] = [];
  const radius = Math.max(1, Math.min(32, Math.round(plan.radius ?? 5)));

  for (const action of plan.actions) {
    const name = action.who === "me" ? "you" : action.who === "near" ? `everything within ${plural(radius, "block")} of you` : trigger.otherName;
    if (name === null) return null;
    if (action.what === "push") {
      // Away from the owner: a bi-entity push from the owner to each of them.
      const push: Json = { type: "apoli:add_velocity", z: 1.5, y: 0.3 };
      used.push({ id: "apoli:add_velocity", kind: "bientity_action" });
      if (action.who === "near") {
        used.push({ id: "apoli:area_of_effect", kind: "entity_action" });
        add("me", trigger.me, { type: "apoli:area_of_effect", radius, bientity_action: push });
      } else if (action.who === "other" && trigger.pair !== null) {
        if (trigger.type === "apoli:action_when_hit") used.push({ id: "apoli:invert", kind: "bientity_action" });
        add("pair", trigger.pair, push);
      } else {
        return null;
      }
      tips.add('a bigger "z" knocks them further');
      said.push(`${says(name, "is", "are")} knocked away from you`);
      continue;
    }
    const built = entityAction(action, name, used, tips);
    if (built === null) return null;
    said.push(built.words);
    if (action.who === "me") {
      add("me", trigger.me, built.json);
    } else if (action.who === "other") {
      if (trigger.other === null) return null;
      add("other", trigger.other, built.json);
    } else {
      used.push({ id: "apoli:area_of_effect", kind: "entity_action" }, { id: "apoli:target_action", kind: "bientity_action" });
      add("me", trigger.me, { type: "apoli:area_of_effect", radius, bientity_action: targetAction(built.json) });
    }
  }
  if (said.length === 0) return null;

  const power: Json = { type: trigger.type };
  used.push({ id: trigger.type, kind: "power" });
  if (trigger.type === "apoli:action_on_death") {
    // Both of its entities share the one bi-entity action.
    const parts = [...slots.values()].flatMap(slot => slot.actions.map(action => (slot.place(action).bientity_action as Json)));
    power.bientity_action = parts.length === 1 ? parts[0]! : { type: "apoli:and", actions: parts };
    used.push({ id: "apoli:target_action", kind: "bientity_action" });
    if (slots.has("other")) used.push({ id: "apoli:actor_action", kind: "bientity_action" });
    if (parts.length > 1) used.push({ id: "apoli:and", kind: "bientity_action" });
  } else {
    for (const slot of slots.values()) {
      Object.assign(power, slot.place(together(slot.actions)));
      if (slot.actions.length > 1) used.push({ id: "apoli:and", kind: slot.place === trigger.pair ? "bientity_action" : "entity_action" });
    }
  }

  if (trigger.type === "apoli:action_over_time") {
    const every = Math.max(0.05, plan.every ?? 5);
    power.interval = ticks(every);
    tips.add('ticks:"interval"');
  }
  if (trigger.damage && plan.from.length > 0) power.damage_condition = damageCondition(plan.from, used);
  if (plan.target !== null) {
    if (trigger.filter === null) return null;
    power[trigger.filter.field] = { type: "apoli:entity_type", entity_type: `minecraft:${plan.target}` };
    used.push({ id: "apoli:entity_type", kind: "entity_condition" });
  }
  if (trigger.cooldown && plan.cooldown !== null && plan.cooldown > 0) {
    power.cooldown = ticks(plan.cooldown);
    // The default bar, so the cooldown shows on the HUD.
    power.hud_render = { should_render: true };
    tips.add('ticks:"cooldown"');
  }
  const condition = conditionOf(plan.conditions);
  if (condition !== null) {
    power.condition = condition;
    usedConditions(plan.conditions, used);
  }

  const event = trigger.type === "apoli:action_over_time" ? `every ${plural(plan.every ?? 5, "second")}` : plan.target !== null && trigger.filter !== null ? trigger.filter.event(effectName(plan.target)) : trigger.event;
  const from = trigger.damage && plan.from.length > 0 ? ` with ${sourceWords(plan.from)}` : "";
  const when = plan.conditions.length > 0 ? `, but only ${conditionWords(plan.conditions)}` : "";
  const cooldown = power.cooldown !== undefined ? ` (${plural(plan.cooldown!, "second")} cooldown)` : "";
  return finish(power, `${event}${from}${when}, ${said.join(" and ")}${cooldown}.`, tips, used);
}

// One damage condition for every source named: "fall damage and fire" is either of them.
function damageCondition(froms: readonly DamageFrom[], used: Used[]): Json {
  for (const from of froms) used.push({ id: String(DAMAGE_FROM[from].condition.type), kind: "damage_condition" });
  if (froms.length === 1) return DAMAGE_FROM[froms[0]!].condition;
  used.push({ id: "apoli:any_of", kind: "damage_condition" });
  return { type: "apoli:any_of", conditions: froms.map(from => DAMAGE_FROM[from].condition) };
}

const sourceWords = (froms: readonly DamageFrom[]) => listing(froms.map(from => DAMAGE_FROM[from].words));

function damageModifier(type: "apoli:modify_damage_taken" | "apoli:modify_damage_dealt", change: number, froms: readonly DamageFrom[], used: Used[], tips: Set<string>): Json {
  const power: Json = { type, modifier: { operation: "multiply_total_multiplicative", value: change } };
  tips.add('"multiply_total_multiplicative" multiplies the damage by 1 + "value": -0.5 halves it, 1 doubles it, -1 cancels it');
  used.push({ id: type, kind: "power" });
  if (froms.length > 0) power.damage_condition = damageCondition(froms, used);
  return power;
}

function passivePower(plan: Plan, kind: Passive, used: Used[], tips: Set<string>): { power: Json; does: string } | null {
  const simple = (type: string, does: string, fields: Json = {}) => {
    used.push({ id: type, kind: "power" });
    return { power: { type, ...fields }, does };
  };
  const pct = Math.max(1, Math.round(plan.percent ?? 50));
  const from = plan.from;
  const source = from.length === 0 ? "" : ` from ${sourceWords(from)}`;
  switch (kind) {
    case "burn_in_sun":
      return null;
    case "fly": return simple("apoli:creative_flight", "you can fly like in creative mode");
    case "glide": return simple("apoli:elytra_flight", "you can glide like you're wearing an elytra", { render_elytra: true });
    case "breathe_underwater": return simple("apoli:water_breathing", "you can breathe underwater");
    case "night_vision": return simple("apoli:night_vision", "you can see in the dark");
    case "walk_on_water": return simple("apoli:walk_on_fluid", "you can walk on water", { fluid: "minecraft:water" });
    case "walk_on_lava": return simple("apoli:walk_on_fluid", "you can walk on lava", { fluid: "minecraft:lava" });
    case "climb": return simple("apoli:climbing", "you can climb walls");
    case "invisible": return simple("apoli:invisibility", "you're invisible");
    case "glow": {
      if (plan.color === null) return simple("apoli:self_glow", "you glow for everyone");
      const [red, green, blue] = plan.color;
      return simple("apoli:self_glow", "you glow for everyone, in the colour you asked for", { use_teams: false, red, green, blue });
    }
    case "phase": return simple("apoli:phasing", "you can phase through blocks");
    case "effect_immunity": {
      const ids = plan.effects.map(effect => `minecraft:${effect}`);
      if (ids.length === 0) return null;
      return simple("apoli:effect_immunity", `${listing(plan.effects.map(effectName))} can't be put on you`, ids.length === 1 ? { effect: ids[0] } : { effects: ids });
    }
    case "less_damage":
      if (pct < 100) return { power: damageModifier("apoli:modify_damage_taken", -pct / 100, from, used, tips), does: `you take ${pct}% less damage${source}` };
      if (from.length === 0) return { power: damageModifier("apoli:modify_damage_taken", -1, from, used, tips), does: "you take no damage" };
      return simple("apoli:invulnerability", `you take no damage${source}`, { damage_condition: damageCondition(from, used) });
    case "more_damage_taken":
      return { power: damageModifier("apoli:modify_damage_taken", pct / 100, from, used, tips), does: `you take ${pct}% more damage${source}` };
    case "more_damage_dealt":
      return { power: damageModifier("apoli:modify_damage_dealt", pct / 100, from, used, tips), does: `you deal ${pct}% more damage${source.replace(" from ", " with ")}` };
    case "less_damage_dealt": {
      const less = Math.min(pct, 100);
      return { power: damageModifier("apoli:modify_damage_dealt", -less / 100, from, used, tips), does: `you deal ${less}% less damage${source.replace(" from ", " with ")}` };
    }
    case "faster":
    case "slower": {
      const change = Math.min(Math.max(1, Math.round(plan.percent ?? 30)), kind === "slower" ? 90 : 500);
      const value = (kind === "faster" ? change : -change) / 100;
      return simple("apoli:attribute", `you move ${change}% ${kind === "faster" ? "faster" : "slower"}`, { modifier: { attribute: "minecraft:generic.movement_speed", operation: "add_multiplied_base", value } });
    }
    case "jump_higher":
      tips.add('a bigger "value" jumps higher');
      return simple("apoli:modify_jump", "you jump about twice as high", { modifier: { operation: "add_value", value: 0.2 } });
    case "permanent_effect": {
      if (plan.effects.length === 0) return null;
      // Night vision flickers for its last 10 seconds, so the power is the steady way.
      if (plan.effects.length === 1 && plan.effects[0] === "night_vision") return simple("apoli:night_vision", "you can see in the dark");
      const levelOf = (effect: string) => level(plan.levels[effect] ?? plan.level);
      const instances = plan.effects.map(effect => ({ effect: `minecraft:${effect}`, duration: 40, amplifier: levelOf(effect) - 1, show_particles: false }));
      used.push({ id: "apoli:apply_effect", kind: "entity_action" });
      tips.add('the effect is given again every second ("interval": 20) and lasts 2 seconds ("duration": 40), so it never runs out');
      return simple("apoli:action_over_time", `you always have ${listing(plan.effects.map(effect => `${effectName(effect)}${levelOf(effect) > 1 ? ` ${levelOf(effect)}` : ""}`))}`, {
        interval: 20,
        entity_action: { type: "apoli:apply_effect", ...(instances.length === 1 ? { effect: instances[0] } : { effects: instances }) },
      });
    }
    case "more_health":
    case "less_health": {
      const hearts = Math.max(0.5, plan.hearts ?? 2);
      tips.add('"value" is in health points: 2 = one heart');
      return simple("apoli:attribute", `you have ${hearts} ${kind === "more_health" ? "more" : "fewer"} ${hearts === 1 ? "heart" : "hearts"} of max health`, {
        modifier: { attribute: "minecraft:generic.max_health", operation: "add_value", value: kind === "more_health" ? hp(hearts) : -hp(hearts) },
      });
    }
    case "bigger":
    case "smaller": {
      const factor = plan.factor ?? (kind === "bigger" ? 1.5 : 0.5);
      return simple("apoli:scale", `you're ${factor}x your normal size`, { scale_types: "apoli:base", scale: factor });
    }
  }
}

// One always-on ability as a power, or null. Its conditions are added by the caller.
function onePassive(plan: Plan, kind: Passive, used: Used[], tips: Set<string>): { power: Json; does: string } | null {
  if (kind !== "burn_in_sun") return passivePower(plan, kind, used, tips);
  used.push({ id: "apoli:action_over_time", kind: "power" }, { id: "apoli:set_on_fire", kind: "entity_action" }, { id: "apoli:exposed_to_sun", kind: "entity_condition" });
  return { power: { type: "apoli:action_over_time", interval: 20, entity_action: { type: "apoli:set_on_fire", duration: 2 }, condition: CONDITIONS.sunlight.condition }, does: "you catch fire in sunlight" };
}

// The always-on abilities: one is the power itself, several are sub-powers of one apoli:multiple.
function passive(plan: Plan, used: Used[], tips: Set<string>): Built | null {
  const conditions = plan.conditions.filter(name => !(name === "sunlight" && plan.passives.includes("burn_in_sun")));
  const parts: Array<{ key: string; power: Json; does: string }> = [];
  for (const kind of plan.passives) {
    const made = onePassive(plan, kind, used, tips);
    if (made === null) return null;
    const own = made.power.condition as Json | undefined;
    const condition = conditionOf(conditions, own === undefined ? [] : [own]);
    if (condition !== null) made.power.condition = condition;
    parts.push({ key: kind, ...made });
  }
  if (parts.length === 0) return null;
  usedConditions(conditions, used);
  const power: Json = parts.length === 1 ? parts[0]!.power : { type: "apoli:multiple", ...Object.fromEntries(parts.map(part => [part.key, part.power])) };
  if (parts.length > 1) used.push({ id: "apoli:multiple", kind: "power" });
  const when = conditions.length > 0 ? `, but only ${conditionWords(conditions)}` : "";
  return finish(power, `${listing(parts.map(part => part.does))}${when}.`, tips, used);
}

function finish(power: Json, does: string, tips: Set<string>, used: Used[]): Built {
  const unique = new Map(used.map(entry => [`${entry.kind} ${entry.id}`, entry]));
  // The fields counted in ticks go in one tip.
  const ticks = [...tips].filter(tip => tip.startsWith("ticks:")).map(tip => tip.slice("ticks:".length));
  const rest = [...tips].filter(tip => !tip.startsWith("ticks:"));
  const said = [...(ticks.length > 0 ? [`${listing(ticks)} ${ticks.length > 1 ? "are" : "is"} in ticks (20 ticks = 1 second)`] : []), ...rest];
  return { power, json: JSON.stringify(power, null, 2), does, tips: said, used: [...unique.values()] };
}

// The power for a plan, or null when the plan asks for something the pieces can't
// put together (the other entity on a key press, a summon of nothing).
export function compose(plan: Plan): Built | null {
  const used: Used[] = [];
  const tips = new Set<string>();
  const built = plan.when === "passive" ? passive(plan, used, tips) : plan.actions.length === 0 ? null : triggered(plan, TRIGGERS[plan.when], used, tips);
  return built === null || !plan.toggle ? built : toggled(built);
}

// The power, switched on and off by a toggle in the same file: the toggle is a
// sub-power, and "*:*_toggle" names it from the other one.
function toggled(built: Built): Built {
  const on: Json = { type: "apoli:power_active", power: "*:*_toggle" };
  const own = built.power.condition as Json | undefined;
  const ability: Json = { ...built.power, condition: own === undefined ? on : { type: "apoli:all_of", conditions: [on, own] } };
  const power: Json = { type: "apoli:multiple", toggle: { type: "apoli:toggle", active_by_default: false }, ability };
  const used: Used[] = [{ id: "apoli:multiple", kind: "power" }, { id: "apoli:toggle", kind: "power" }, { id: "apoli:power_active", kind: "entity_condition" }, ...built.used];
  if (own !== undefined) used.push({ id: "apoli:all_of", kind: "entity_condition" });
  const tips = ['it starts off ("active_by_default": false) and uses your primary ability key', ...built.tips];
  return { power, json: JSON.stringify(power, null, 2), does: `press your ability key to turn it on and off. while it's on, ${built.does}`, tips, used };
}
