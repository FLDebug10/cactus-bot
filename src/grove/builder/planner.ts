// The model's part of building a power: for each thing the power does, who it
// happens to and what happens, or which always-on ability a passive power is.
// It answers in a fixed form (Ollama's structured output), so it can only pick
// building blocks that exist, and a few worked examples show it how. What the
// words say plainly (the trigger, conditions, effects, numbers) comes from
// reading.ts and wins: the model is only trusted where the patterns can't decide,
// and an action it picks has to be backed by the request's own words.

import type { Message } from "ollama";
import { type BrainChain, BrainUnavailable } from "../brain.ts";
import { EFFECTS, type Passive, PASSIVE_LABELS, type Plan, type PlannedAction, SUMMONS, TRIGGERS, type What, WHAT_LABELS, WHO_LABELS, type When } from "./blocks.ts";
import { type NumberField, objectsIn, OTHERS, readRequest, type Signals, withDigits } from "./reading.ts";

const NONE = "none";

const FORM = {
  type: "object",
  properties: {
    actions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          who: { enum: Object.keys(WHO_LABELS) },
          what: { enum: Object.keys(WHAT_LABELS) },
          effect: { enum: [NONE, ...EFFECTS] },
          entity: { enum: [NONE, ...SUMMONS] },
        },
        required: ["who", "what", "effect", "entity"],
      },
    },
    passive: { enum: [NONE, ...Object.keys(PASSIVE_LABELS)] },
    passive_effect: { enum: [NONE, ...EFFECTS] },
  },
  required: ["actions", "passive", "passive_effect"],
};

const SYSTEM = `You read a request for a Minecraft power (the Apoli and Origins mods) and fill in what the power does. The person asking owns the power: "I", "me" and "my" are the owner.

actions: what happens each time the power goes off, one entry per thing that happens. Empty when the power just works all the time (a passive ability).
  who: who it happens to. "me" is the owner. "the one I hit" is whatever the owner attacks. "the one who hurt me" is whatever attacks the owner. "the one I killed" is what the owner killed. "the one who killed me" is the owner's killer. "everything near me" is every entity around the owner.
  what: what happens to them.
  effect: the status effect for "give a status effect" or "remove status effects", otherwise "none".
  entity: what appears for "summon an entity", otherwise "none".
passive: what a passive power lets the owner do all the time, otherwise "none".
passive_effect: the status effect for "have a status effect" or "be immune to a status effect", otherwise "none".

The line in brackets says what sets the power off, read from the request.`;

export interface Form {
  actions: Array<{ who: string; what: string; effect: string; entity: string }>;
  passive: string;
  passive_effect: string;
}

const goesOff = (when: When | null) => (when === null || when === "passive" ? "(no trigger in the words: probably a passive ability)" : `(it goes off: ${TRIGGERS[when].label})`);
const ask = (request: string, when: When | null) => `${request}\n${goesOff(when)}`;
const act = (who: string, what: string, extra: { effect?: string; entity?: string } = {}) => ({ who, what, effect: extra.effect ?? NONE, entity: extra.entity ?? NONE });
const passiveForm = (passive: string, effect = NONE): Form => ({ actions: [], passive, passive_effect: effect });
const actionForm = (...actions: Form["actions"]): Form => ({ actions, passive: NONE, passive_effect: NONE });

// Worked examples, worded unlike the requests the eval uses so they teach the form, not the answers.
const EXAMPLES: ReadonlyArray<[string, When | null, Form]> = [
  ["make a power that blinds whatever i punch for 3 seconds", "hit", actionForm(act("the one I hit", "give a status effect", { effect: "blindness" }))],
  ["i want mobs that attack me to get knocked back", "hurt", actionForm(act("the one who hurt me", "knock away from me"))],
  ["an ability where pressing a key heals me 3 hearts, 20 sec cooldown", "key", actionForm(act("me", "heal"))],
  ["power that sets all entities around me on fire when i use my ability", "key", actionForm(act("everything near me", "set on fire"))],
  ["make me invisible when i'm crouching", null, passiveForm("be invisible")],
  ["power so i take 25% less damage from explosions", null, passiveForm("take less damage")],
  ["give me permanent haste 2", null, passiveForm("have a status effect", "haste")],
  ["i want to never get the hunger effect", null, passiveForm("be immune to a status effect", "hunger")],
  ["feed me every 10 seconds when it's daytime", "time", actionForm(act("me", "restore hunger"))],
  ["when i kill a mob, it explodes", "kill", actionForm(act("the one I killed", "make an explosion"))],
  ["zombies spawn next to whatever i hit and i heal a heart", "hit", actionForm(act("the one I hit", "summon an entity", { entity: "zombie" }), act("me", "heal"))],
  ["when i die everyone around me gets wither", "death", actionForm(act("everything near me", "give a status effect", { effect: "wither" }))],
  ["let me walk on lava", null, passiveForm("walk on lava")],
  ["keybind that teleports me 10 blocks ahead", "key", actionForm(act("me", "teleport forward"))],
  ["whenever i hit a mob i get absorption", "hit", actionForm(act("me", "give a status effect", { effect: "absorption" }))],
  ["a toggleable ability for creative flight", null, passiveForm("fly like in creative mode")],
  ["killing something should feed me", "kill", actionForm(act("me", "restore hunger"))],
];

const SHOTS: Message[] = EXAMPLES.flatMap(([request, when, form]) => [
  { role: "user", content: ask(request, when) },
  { role: "assistant", content: JSON.stringify(form) },
]);

function parseForm(text: string): Form | null {
  try {
    const value = JSON.parse(text) as Partial<Form>;
    if (!Array.isArray(value.actions) || typeof value.passive !== "string" || typeof value.passive_effect !== "string") return null;
    return value as Form;
  } catch {
    return null;
  }
}

const DAMAGE_PASSIVES: ReadonlySet<Passive> = new Set(["less_damage", "more_damage_taken", "more_damage_dealt", "less_damage_dealt"]);

// A "when", "if" or "after" that no condition read from the words accounts for.
function unexplainedWhen(request: string, signals: Signals): boolean {
  const clauses = withDigits(request).match(/\b(?:when|whenever|if|after|every time|each time|once)\b/g)?.length ?? 0;
  return clauses > signals.conditions.length;
}

// The effect each ability stands for: "night vision and water breathing" named
// two effects, and the two abilities account for them.
const IMPLIES: Partial<Record<Passive, string>> = {
  night_vision: "night_vision",
  breathe_underwater: "water_breathing",
  invisible: "invisibility",
  glow: "glowing",
  jump_higher: "jump_boost",
  faster: "speed",
  slower: "slowness",
};

function passivesOf(signals: Signals, form: Form | null): Passive[] {
  const chosen = form === null ? undefined : PASSIVE_LABELS[form.passive];
  // The words name the abilities, the model only orders them. "permanent" only marks the effects.
  const named: Passive[] = signals.passives.filter(passive => passive !== "permanent_effect");
  const leftover = signals.effects.filter(effect => !named.some(passive => IMPLIES[passive] === effect));
  const passives: Passive[] = chosen !== undefined && named.includes(chosen) ? [chosen, ...named.filter(passive => passive !== chosen)] : [...named];
  // Effects no ability stands for: "immune to poison", or an effect you always have.
  if (leftover.length > 0 && !passives.includes("effect_immunity")) {
    const always = signals.passives.includes("permanent_effect") || chosen === "permanent_effect" || named.length === 0;
    if (always) passives.push("permanent_effect");
  }
  return passives;
}

// What sets the power off. On a toggle, "press a key" is the toggle's own key.
export function triggersOf(signals: Signals): When[] {
  return signals.toggle ? signals.triggers.filter(when => when !== "key") : signals.triggers;
}

// Everything the words ask for is in the plan: every effect, every number and every
// damage source. A power that leaves part of the request out is wrong, and the
// normal answer can still help with the rest.
function covers(plan: Plan, signals: Signals): boolean {
  const effects = new Set([
    ...plan.actions.flatMap(action => (action.effect === null ? [] : [action.effect])),
    ...plan.effects,
    ...plan.passives.flatMap(passive => (IMPLIES[passive] === undefined ? [] : [IMPLIES[passive]!])),
  ]);
  if (signals.effects.some(effect => !effects.has(effect))) return false;

  const used: string[] = [];
  const take = (field: NumberField) => {
    const raw = signals.raw[field];
    if (raw !== undefined) used.push(raw);
  };
  const actions = plan.actions;
  if (actions.some(action => action.what === "effect" || action.what === "fire")) take("seconds");
  if (actions.some(action => action.what === "heal" || action.what === "damage") || plan.passives.some(passive => passive === "more_health" || passive === "less_health")) take("hearts");
  if (actions.some(action => action.what === "teleport_forward") || (plan.radius !== null && actions.some(action => action.who === "near"))) take("blocks");
  if (plan.when === "time") take("every");
  if (plan.when !== "passive" && TRIGGERS[plan.when].cooldown) take("cooldown");
  if (plan.passives.some(passive => DAMAGE_PASSIVES.has(passive) || passive === "faster" || passive === "slower")) take("percent");
  if (plan.passives.some(passive => passive === "bigger" || passive === "smaller")) take("factor");
  for (const effect of effects) {
    const raw = signals.rawLevels[effect];
    if (raw !== undefined) used.push(raw);
    else take("level");
  }
  const left = [...signals.numbers];
  for (const raw of used) {
    const at = left.findIndex(number => Number(number) === Number(raw) || number === raw);
    if (at !== -1) left.splice(at, 1);
  }
  if (left.length > 0) return false;

  const damage = plan.passives.some(passive => DAMAGE_PASSIVES.has(passive)) || (plan.when !== "passive" && TRIGGERS[plan.when].damage);
  if (signals.froms.length > 0 && !damage) return false;
  if (signals.color !== null && !plan.passives.includes("glow")) return false;
  return true;
}

// The plan: the trigger, conditions, effects and numbers as the words say them,
// who and what from the model where the words back it up. null when they don't
// add up to a power the building blocks can make, or would leave part of it out.
export function reconcile(signals: Signals, form: Form | null, objects: ReturnType<typeof objectsIn> = {}, request = ""): Plan | null {
  const triggers = triggersOf(signals);
  if (signals.unsupported !== null || triggers.length > 1) return null;
  const when: When = triggers[0] ?? "passive";
  const plan: Plan = {
    when,
    actions: [],
    passives: [],
    effects: [],
    level: signals.level,
    levels: signals.levels,
    color: signals.color,
    target: null,
    percent: signals.percent,
    factor: signals.factor,
    hearts: signals.hearts,
    from: signals.froms,
    conditions: signals.conditions,
    cooldown: signals.cooldown,
    every: signals.every,
    radius: signals.near ? signals.blocks : null,
    toggle: signals.toggle,
  };

  if (when === "passive") {
    // A mob named in an always-on power: nothing here can be about one.
    if (signals.entity !== null) return null;
    const passives = passivesOf(signals, form);
    if (passives.length === 0) return null;
    // "sets attackers on fire and gives me speed": an action no ability does means the trigger was missed.
    const extra = signals.whats.filter(what => what !== "effect" && !(what === "damage" && passives.some(passive => DAMAGE_PASSIVES.has(passive))));
    if (extra.length > 0) return null;
    plan.passives = passives;
    if (passives.includes("effect_immunity") || passives.includes("permanent_effect")) {
      // Every effect they named that no ability stands for, the model's pick first.
      const leftover = signals.effects.filter(effect => !passives.some(passive => IMPLIES[passive] === effect));
      const chosen = form?.passive_effect;
      plan.effects = chosen !== undefined && leftover.includes(chosen) ? [chosen, ...leftover.filter(effect => effect !== chosen)] : leftover;
      if (plan.effects.length === 0) return null;
      // "gives me strength whenever i'm angry": a "when" the words don't explain isn't an effect you always have.
      if (passives.includes("permanent_effect") && !signals.passives.includes("permanent_effect") && unexplainedWhen(request, signals)) return null;
    }
    return covers(plan, signals) ? plan : null;
  }

  if (form === null) return null;
  const trigger = TRIGGERS[when];
  const levelOf = (effect: string | null) => (effect === null ? signals.level : signals.levels[effect] ?? signals.level);
  const unused = (effect: string) => !plan.actions.some(other => other.effect === effect);
  for (const entry of form.actions) {
    let what = WHAT_LABELS[entry.what];
    let who = WHO_LABELS[entry.who];
    if (what === "summon" && signals.entity === null && signals.whats.includes("lightning")) what = "lightning";
    if (what === undefined || who === undefined) continue;
    let backed = signals.whats.includes(what) || (what === "effect" && signals.effects.length > 0) || (what === "summon" && signals.entity !== null);
    // "gives me regeneration" picked as "heal" with the effect filled in: the effect is what they named.
    if (!backed && signals.effects.includes(entry.effect)) {
      what = "effect";
      backed = true;
    }
    if (!backed) continue;
    const object = objects[what];
    if (object === "me") who = "me";
    else if (object === "other" && who === "me") who = "other";
    // "every mob near me" means the ones around you, and so do mobs on a trigger with nobody
    // else in it (a key press). Without other entities named, it was the owner all along.
    if (who === "other" && (signals.near || trigger.other === null)) who = signals.near || OTHERS.test(withDigits(request)) ? "near" : "me";
    let effect: string | null = null;
    if (what === "effect" || what === "clear_effects") {
      // The model's pick if they named it, otherwise the next effect they named that isn't used yet.
      effect = signals.effects.includes(entry.effect) && unused(entry.effect) ? entry.effect : signals.effects.find(unused) ?? null;
      if (effect === null && what === "effect") continue;
    }
    const action: PlannedAction = {
      who,
      what,
      effect,
      seconds: signals.seconds,
      level: what === "effect" ? levelOf(effect) : null,
      hearts: signals.hearts ?? (what === "heal" ? 1 : null),
      entity: what === "summon" ? signals.entity : null,
      command: what === "command" ? signals.command : null,
      blocks: what === "teleport_forward" ? signals.blocks : null,
    };
    if (plan.actions.some(other => other.who === action.who && other.what === action.what && other.effect === action.effect)) continue;
    plan.actions.push(action);
  }
  // "makes everything near me levitate" picked as an explosion, "the player i hit gets launched"
  // as a push: none of its picks were backed, but the words name one thing to do, so
  // that's what happens, to whoever the model meant.
  const first = form.actions[0];
  const named = signals.whats.filter(what => what !== "effect");
  const only: What | null = named.length === 1 ? named[0]! : named.length === 0 && signals.effects.length > 0 ? "effect" : null;
  if (plan.actions.length === 0 && first !== undefined && only !== null && only !== "summon" && only !== "command") {
    let who = WHO_LABELS[first.who] ?? "me";
    const object = objects[only];
    if (object === "me") who = "me";
    else if (object === "other" && who === "me") who = "other";
    if (who === "other" && (signals.near || trigger.other === null)) who = signals.near || OTHERS.test(withDigits(request)) ? "near" : "me";
    const effect = only === "effect" || only === "clear_effects" ? signals.effects[0] ?? null : null;
    if (only !== "effect" || effect !== null) {
      plan.actions.push({ who, what: only, effect, seconds: signals.seconds, level: only === "effect" ? levelOf(effect) : null, hearts: signals.hearts ?? (only === "heal" ? 1 : null), entity: null, command: null, blocks: only === "teleport_forward" ? signals.blocks : null });
    }
  }
  // A mob named but not summoned is the one it's about: "creepers i hit".
  if (signals.entity !== null && !plan.actions.some(action => action.what === "summon")) plan.target = signals.entity;
  if (plan.actions.length === 0) return null;
  return covers(plan, signals) ? plan : null;
}

// The model's answers for a request, or null when it gave none.
export async function planForm(brain: Pick<BrainChain, "reply">, request: string, when: When | null): Promise<Form | null> {
  try {
    const reply = await brain.reply({
      system: SYSTEM,
      messages: [...SHOTS, { role: "user", content: ask(request, when) }],
      format: FORM,
      temperature: 0,
      presencePenalty: 0,
      maxTokens: 300,
    });
    return parseForm(reply.text);
  } catch (error) {
    if (!(error instanceof BrainUnavailable)) throw error;
    return null;
  }
}

// The plan for a request, or null when it isn't one the building blocks can make.
export async function planPower(brain: Pick<BrainChain, "reply">, request: string): Promise<Plan | null> {
  const signals = readRequest(request);
  const triggers = triggersOf(signals);
  if (signals.unsupported !== null || triggers.length > 1) return null;
  return reconcile(signals, await planForm(brain, request, triggers[0] ?? null), objectsIn(request), request);
}
