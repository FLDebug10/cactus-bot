// Grove's feelings. Two numbers, like a real creature's: how good it feels
// (valence) and how much energy it has (energy). Everything people do nudges
// them, and they drift back toward Grove's bubbly baseline over time, so an
// insult stings for a while and then fades, the way it would for anyone.

export type MoodEvent =
  | "compliment" | "insult" | "love" | "hate" | "thanks" | "apology" | "affection" | "aggression"
  | "chat" | "laugh" | "joke_landed" | "sad_news" | "good_news";

const EFFECTS: Readonly<Record<MoodEvent, { valence: number; energy: number }>> = {
  compliment: { valence: 0.25, energy: 0.1 },
  insult: { valence: -0.3, energy: -0.05 },
  love: { valence: 0.35, energy: 0.15 },
  hate: { valence: -0.45, energy: -0.1 },
  thanks: { valence: 0.15, energy: 0.05 },
  apology: { valence: 0.2, energy: 0 },
  affection: { valence: 0.25, energy: 0.1 },
  aggression: { valence: -0.15, energy: 0.05 },
  chat: { valence: 0.03, energy: 0.04 },
  laugh: { valence: 0.1, energy: 0.08 },
  joke_landed: { valence: 0.12, energy: 0.08 },
  sad_news: { valence: -0.08, energy: -0.02 },
  good_news: { valence: 0.1, energy: 0.06 },
};

const HALF_LIFE_MS = 20 * 60 * 1000;
const BASE_VALENCE = 0.55;

export type MoodLabel = "joyful" | "happy" | "okay" | "sad" | "hurt" | "sleepy";

export interface MoodCause {
  event: MoodEvent;
  who: string;
  at: number;
}

export interface MoodSnapshot {
  valence: number;
  energy: number;
  label: MoodLabel;
  cause: MoodCause | null;
}

export class Mood {
  private valence = BASE_VALENCE;
  private energy = 0.6;
  private updatedAt: number;
  private cause: MoodCause | null = null;
  private readonly hourOf: (at: number) => number;

  constructor(now: number, hourOf: (at: number) => number) {
    this.updatedAt = now;
    this.hourOf = hourOf;
  }

  // Energy follows a daily rhythm: perky by day, sleepy in the small hours.
  private baseEnergy(at: number): number {
    const hour = this.hourOf(at);
    if (hour >= 1 && hour < 7) return 0.2;
    if (hour >= 22 || hour < 1) return 0.4;
    if (hour >= 7 && hour < 10) return 0.55;
    return 0.7;
  }

  private settle(now: number): void {
    const elapsed = Math.max(0, now - this.updatedAt);
    if (elapsed === 0) return;
    const keep = Math.pow(0.5, elapsed / HALF_LIFE_MS);
    this.valence = BASE_VALENCE + (this.valence - BASE_VALENCE) * keep;
    const base = this.baseEnergy(now);
    this.energy = base + (this.energy - base) * keep;
    this.updatedAt = now;
    if (this.cause !== null && now - this.cause.at > 3 * HALF_LIFE_MS) this.cause = null;
  }

  feel(event: MoodEvent, who: string, now: number): void {
    this.settle(now);
    const effect = EFFECTS[event];
    this.valence = clamp(this.valence + effect.valence, -1, 1);
    this.energy = clamp(this.energy + effect.energy, 0, 1);
    if (Math.abs(effect.valence) >= 0.2) this.cause = { event, who, at: now };
  }

  snapshot(now: number): MoodSnapshot {
    this.settle(now);
    return { valence: this.valence, energy: this.energy, label: labelFor(this.valence, this.energy), cause: this.cause };
  }

  restore(valence: number, energy: number, at: number): void {
    this.valence = clamp(valence, -1, 1);
    this.energy = clamp(energy, 0, 1);
    this.updatedAt = at;
  }
}

function labelFor(valence: number, energy: number): MoodLabel {
  if (valence < -0.25) return "hurt";
  if (valence < 0.15) return "sad";
  if (energy < 0.3) return "sleepy";
  if (valence > 0.8) return "joyful";
  if (valence > 0.4) return "happy";
  return "okay";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
