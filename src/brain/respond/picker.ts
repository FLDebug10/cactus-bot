import type { Random } from "../types.ts";

// Picks a line from a pool without repeating itself, and expands inline
// choices: "hi{!|!!| :D}" becomes "hi!", "hi!!" or "hi :D".
export class Picker {
  private readonly recent = new Map<string, string[]>();
  private readonly random: Random;

  constructor(random: Random) {
    this.random = random;
  }

  pick(key: string, lines: readonly string[]): string {
    if (lines.length === 0) return "";
    const used = this.recent.get(key) ?? [];
    const memory = Math.min(Math.floor(lines.length / 2), 8);
    const fresh = lines.filter(line => !used.slice(-memory).includes(line));
    const pool = fresh.length > 0 ? fresh : lines;
    const chosen = pool[Math.floor(this.random() * pool.length)]!;

    used.push(chosen);
    if (used.length > 16) used.shift();
    this.recent.set(key, used);
    return expand(chosen, this.random);
  }

  chance(probability: number): boolean {
    return this.random() < probability;
  }

  one<T>(items: readonly T[]): T {
    return items[Math.floor(this.random() * items.length)]!;
  }

  // A whole number from min to max, both included.
  int(min: number, max: number): number {
    return min + Math.floor(this.random() * (max - min + 1));
  }
}

export function expand(template: string, random: Random): string {
  return template.replace(/\{([^{}]*\|[^{}]*)\}/g, (_, body: string) => {
    const options = body.split("|");
    return options[Math.floor(random() * options.length)] ?? "";
  });
}
