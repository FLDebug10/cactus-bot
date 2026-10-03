// Typo repair in the SymSpell style: every target word is indexed under the
// strings you get by deleting one or two of its letters, so finding the words
// within edit distance 2 of a typo is a handful of map lookups, not a scan.

export class Speller {
  private readonly known: ReadonlySet<string>;
  private readonly deletes = new Map<string, string[]>();
  private readonly cache = new Map<string, string>();

  constructor(known: ReadonlySet<string>, targets: Iterable<string>) {
    this.known = known;
    for (const target of targets) {
      if (target.length < 4) continue;
      for (const variant of deletionVariants(target, maxDistance(target.length))) {
        const bucket = this.deletes.get(variant);
        if (bucket === undefined) this.deletes.set(variant, [target]);
        else if (!bucket.includes(target)) bucket.push(target);
      }
    }
  }

  // Returns the corrected word, or the word itself when nothing is close enough.
  correct(word: string): string {
    if (word.length < 4 || this.known.has(word) || /\d/.test(word)) return word;

    const cached = this.cache.get(word);
    if (cached !== undefined) return cached;

    const limit = maxDistance(word.length);
    let best = word;
    let bestDistance = limit + 1;
    let bestLengthGap = Number.POSITIVE_INFINITY;

    for (const variant of deletionVariants(word, limit)) {
      const candidates = this.deletes.get(variant);
      if (candidates === undefined) continue;
      for (const candidate of candidates) {
        const distance = editDistance(word, candidate, limit);
        if (distance > limit) continue;
        if (distance > 1 && candidate[0] !== word[0]) continue;
        const lengthGap = Math.abs(candidate.length - word.length);
        if (distance < bestDistance || (distance === bestDistance && (lengthGap < bestLengthGap || (lengthGap === bestLengthGap && candidate < best)))) {
          best = candidate;
          bestDistance = distance;
          bestLengthGap = lengthGap;
        }
      }
    }

    if (this.cache.size > 5000) this.cache.clear();
    this.cache.set(word, best);
    return best;
  }
}

// One slip for ordinary words, two only for long ones: most real typos are a
// single missing, extra, wrong or swapped letter, and allowing two on short
// words starts turning real words into other real words ("contact" -> "contest").
function maxDistance(length: number): number {
  return length <= 7 ? 1 : 2;
}

function deletionVariants(word: string, depth: number): Set<string> {
  const out = new Set<string>([word]);
  let frontier = [word];
  for (let level = 0; level < depth; level++) {
    const next: string[] = [];
    for (const current of frontier) {
      for (let i = 0; i < current.length; i++) {
        const variant = current.slice(0, i) + current.slice(i + 1);
        if (!out.has(variant)) {
          out.add(variant);
          next.push(variant);
        }
      }
    }
    frontier = next;
  }
  return out;
}

// Optimal string alignment distance: insertions, deletions, substitutions and
// swapped neighbours ("gril" -> "girl") all cost one.
export function editDistance(a: string, b: string, limit = Number.POSITIVE_INFINITY): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;

  const rows = a.length + 1;
  const cols = b.length + 1;
  let twoBack = new Array<number>(cols).fill(0);
  let previous = Array.from({ length: cols }, (_, j) => j);
  let current = new Array<number>(cols).fill(0);

  for (let i = 1; i < rows; i++) {
    current[0] = i;
    let rowMinimum = current[0];
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, twoBack[j - 2]! + 1);
      }
      current[j] = value;
      if (value < rowMinimum) rowMinimum = value;
    }
    if (rowMinimum > limit) return limit + 1;
    [twoBack, previous, current] = [previous, current, twoBack];
  }

  return previous[cols - 1]!;
}
