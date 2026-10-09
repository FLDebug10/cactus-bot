// "2d6+3", "d20", "4d8-1": D&D dice, for Grove's favorite hobby.

export interface DiceRoll {
  notation: string;
  rolls: number[];
  modifier: number;
  total: number;
}

const NOTATION = /^\s*(\d{0,2})\s*d\s*(\d{1,4})\s*(?:([+-])\s*(\d{1,4}))?\s*$/i;

export function rollDice(notation: string, random: () => number = Math.random): DiceRoll | null {
  const match = NOTATION.exec(notation);
  if (match === null) return null;
  const count = match[1] === "" || match[1] === undefined ? 1 : Number(match[1]);
  const sides = Number(match[2]);
  if (count < 1 || count > 50 || sides < 2 || sides > 1000) return null;
  const modifier = match[4] === undefined ? 0 : Number(match[4]) * (match[3] === "-" ? -1 : 1);
  const rolls = Array.from({ length: count }, () => 1 + Math.floor(random() * sides));
  const total = rolls.reduce((sum, value) => sum + value, 0) + modifier;
  const shown = `${count}d${sides}${modifier === 0 ? "" : modifier > 0 ? `+${modifier}` : `${modifier}`}`;
  return { notation: shown, rolls, modifier, total };
}
