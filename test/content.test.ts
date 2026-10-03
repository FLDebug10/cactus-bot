import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLASS_ADVICE, DND_ABOUT, DND_CLASSES, DND_FAVORITES, DND_MONSTERS, DND_SPECIES, DND_TERMS, FANTASY_SLIMES } from "../src/brain/content/fantasy.ts";
import { DUMB_QUESTION_MEANING, DUMB_QUESTIONS, MY_DUMB_QUESTIONS, ORANGE_FACTS } from "../src/brain/content/silly.ts";
import { SLANG, slangIn } from "../src/brain/content/slang.ts";
import { read } from "../src/brain/text/reader.ts";

// Every line Grove can say from these tables, so the voice rules can be checked once.
function allLines(): string[] {
  return [
    ...SLANG.flatMap(term => [term.meaning, ...term.say, ...(term.ask ?? []), ...(term.perform ?? []), ...(term.you ?? []), ...(term.me ?? [])]),
    ...DUMB_QUESTIONS.flatMap(question => [question.ask, ...question.answers]),
    ...DUMB_QUESTION_MEANING, ...MY_DUMB_QUESTIONS, ...ORANGE_FACTS,
    ...DND_ABOUT, ...CLASS_ADVICE, ...Object.values(DND_CLASSES), ...Object.values(DND_SPECIES), ...Object.values(DND_FAVORITES),
    ...DND_MONSTERS.map(entry => entry.text), ...DND_TERMS.map(entry => entry.text), ...FANTASY_SLIMES.map(entry => entry.text),
  ];
}

describe("grove's knowledge tables", () => {
  it("are written in grove's voice: no em or en dashes, no semicolons", () => {
    for (const line of allLines()) assert.doesNotMatch(line, /[—–;]/, line);
  });

  it("give every slang term a meaning and a fallback line", () => {
    const ids = new Set<string>();
    for (const term of SLANG) {
      assert.ok(term.meaning.length > 0 && term.say.length > 0, term.id);
      assert.equal(ids.has(term.id), false, `two terms called ${term.id}`);
      ids.add(term.id);
    }
  });

  it("never explains the rude slang", () => {
    for (const term of SLANG.filter(entry => entry.tone === "rude")) {
      assert.match(term.meaning, /shouldn't ask/, term.id);
      assert.equal(term.ask ?? term.perform ?? term.you ?? term.me, undefined, term.id);
    }
  });

  it("finds phrases before the words inside them", () => {
    assert.equal(slangIn("no cap")?.id, "no cap");
    assert.equal(slangIn("are you aura farming")?.id, "aura farming");
    assert.equal(slangIn("you got mogged")?.id, "mogged");
    assert.equal(slangIn("are you cooked")?.id, "cooked");
    assert.equal(slangIn("let him cook")?.id, "let him cook");
  });

  it("matches each classic dumb question with its own pattern", () => {
    for (const question of DUMB_QUESTIONS) {
      const asked = read(question.ask, null).text;
      assert.ok(DUMB_QUESTIONS.find(candidate => candidate.match.test(asked)) === question, question.ask);
    }
  });
});
