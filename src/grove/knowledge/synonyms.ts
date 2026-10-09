// Words people use that the docs never do, mapped to the words the docs use:
// nobody searches for "scale" when they want to be smaller. The docs' word is
// added to a search, and where the person's own word only matches by accident
// ("smaller" matches a blog heading "Smaller changes") it is dropped. The table
// stays short and covers only obvious gaps. Plurals and endings don't need
// entries: the index stems words, so "blind" already finds "blindness".

interface Synonym {
  pattern: RegExp;
  // What the docs call it.
  term: string;
  // The matched words never help a search, so they are removed from it.
  drop?: boolean;
}

const SYNONYMS: readonly Synonym[] = [
  { pattern: /\b(?:smaller|bigger|larger|shrink\w*|grow\w*|tiny|giant|huge|taller|shorter|resiz\w*)\b/gi, term: "scale", drop: true },
  { pattern: /\b(?:sizes?|height|width|hitbox\w*)\b/gi, term: "scale" },
  { pattern: /\b(?:fly|flies|flying|glide|gliding|hover\w*)\b/gi, term: "flight" },
  { pattern: /\b(?:hearts?|hp|hitpoints?|max ?health)\b/gi, term: "health" },
  { pattern: /\b(?:hotkeys?|keybinds?|key ?binds?)\b/gi, term: "key press" },
  { pattern: /\b(?:recharge\w*|timers?)\b/gi, term: "cooldown" },
  { pattern: /\b(?:blink|warp\w*|tp)\b/gi, term: "teleport" },
  { pattern: /\b(?:shoots?|shooting|fireballs?|arrows?|throw\w*|launch\w*)\b/gi, term: "projectile" },
  { pattern: /\b(?:potions?|buffs?|debuffs?)\b/gi, term: "status effect" },
  { pattern: /\b(?:skins?|textures?|appearance|outfits?|looks? like)\b/gi, term: "model" },
  { pattern: /\b(?:faster|slower|sprint\w*)\b/gi, term: "attribute speed", drop: true },
  { pattern: /\b(?:see in the dark|see at night)\b/gi, term: "night vision" },
  { pattern: /\b(?:underwater|breath\w*|drown\w*)\b/gi, term: "water breathing" },
  { pattern: /\b(?:haze|mist|view distance|render distance)\b/gi, term: "fog" },
  { pattern: /\b(?:phase|ghost|noclip|through walls?)\b/gi, term: "phasing" },
  { pattern: /\b(?:mana|stamina|energy|meters?)\b/gi, term: "resource" },
];

// The search words for a message after the docs' own words are added (at most
// `limit` of them) and the words that only match by accident are dropped.
export function applySynonyms(text: string, terms: readonly string[], limit = 4): string[] {
  const out = [...terms];
  const added: string[] = [];
  for (const { pattern, term, drop } of SYNONYMS) {
    const matches = text.match(pattern);
    if (matches === null) continue;
    if (drop === true) for (const word of matches) removeAll(out, word.toLowerCase());
    if (added.length < limit && !out.includes(term) && !added.includes(term)) added.push(term);
  }
  return [...out, ...added];
}

function removeAll(list: string[], word: string): void {
  for (let at = list.indexOf(word); at !== -1; at = list.indexOf(word)) list.splice(at, 1);
}
