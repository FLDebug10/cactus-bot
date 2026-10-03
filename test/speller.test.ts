import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { read } from "../src/brain/text/reader.ts";
import { editDistance } from "../src/brain/text/speller.ts";

const require = createRequire(import.meta.url);
let english: string[] | null = null;
try {
  english = require("an-array-of-english-words") as string[];
} catch {
  english = null;
}

describe("speller", () => {
  it("measures typos the way people make them", () => {
    assert.equal(editDistance("gril", "girl"), 1);
    assert.equal(editDistance("datpack", "datapack"), 1);
    assert.equal(editDistance("contact", "contest"), 2);
  });

  it("never turns a real English word into a different word", { skip: english === null ? "dev word list not installed" : false }, () => {
    const changed: string[] = [];
    for (const word of english ?? []) {
      if (!/^[a-z]+$/.test(word)) continue;
      const fixes = read(word, null).corrections;
      if (fixes.length > 0) changed.push(`${word} -> ${fixes[0]![1]}`);
    }
    assert.deepEqual(changed.slice(0, 20), [], `run "npm run speller" to protect these words (${changed.length} in total)`);
  });
});
