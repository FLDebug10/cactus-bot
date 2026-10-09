import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mathIn, prettyExpression, solveMath, spokenValue } from "../src/grove/arithmetic.ts";

function answer(text: string) {
  const problem = mathIn(text);
  assert.notEqual(problem, null, `no sum found in ${JSON.stringify(text)}`);
  return solveMath(problem!);
}

function valueOf(text: string): number {
  const result = answer(text);
  assert.equal(result.kind, "value", `${text} -> ${JSON.stringify(result)}`);
  return (result as { value: number }).value;
}

describe("finding sums in messages", () => {
  it("reads the sums from the bug report", () => {
    assert.equal(valueOf("grove whats 24 divided by 5"), 4.8);
    assert.equal(valueOf("grove what is 20 time 30"), 600);
    assert.equal(valueOf("whats 50*(12+8)"), 1000);
    assert.equal(valueOf("grove what is 20 times 30"), 600);
  });

  it("reads words, symbols, percentages, powers and roots", () => {
    assert.equal(valueOf("what's two plus two"), 4);
    assert.equal(valueOf("what is a hundred divided by four"), 25);
    assert.equal(valueOf("what's two hundred and fifty plus seventy five"), 325);
    assert.equal(valueOf("grove what's 15% of 80"), 12);
    assert.equal(valueOf("what's 3/4 of 100"), 75);
    assert.equal(valueOf("what is half of 50"), 25);
    assert.equal(valueOf("what's the square root of 144"), 12);
    assert.equal(valueOf("5 squared"), 25);
    assert.equal(valueOf("2 to the power of 10"), 1024);
    assert.equal(valueOf("grove whats 3 + 4 times 2"), 11);
    assert.equal(valueOf("what is 6 x 7"), 42);
    assert.equal(valueOf("√16"), 4);
    assert.equal(valueOf("subtract 3 from 10"), 7);
    assert.equal(valueOf("multiply 4 by 6"), 24);
  });

  it("finds a sum asked mid-sentence or with a reason attached", () => {
    assert.equal(valueOf("grove whats 24 divided by 5 i need it for homework"), 4.8);
    assert.equal(valueOf("grove i have 3 dogs, what's 2+2"), 4);
    assert.equal(valueOf("grove 2+2 :)"), 4);
  });

  it("never mistakes ratings, ranges, dates or versions for sums", () => {
    for (const text of [
      "i rate it 10/10", "grove what's 2-3 weeks", "my birthday is 10/03/2026", "grove is apoli on 1.20.1", "grove 1v1 me",
      "grove 2x faster", "grove give me 5-10 ideas", "grove what time is it", "grove i got 9/10 on my test", "call 555-123-4567",
      "grove i'm 12 (almost 13)", "is it 1.21.1 or 1.20.1", "i have one dog and two cats", "it's 24/7 lol", "grove whats 5:30",
      "roll 1d20+5",
    ]) {
      assert.equal(mathIn(text), null, text);
    }
  });
});

describe("working sums out", () => {
  it("gives remainders for whole number division", () => {
    assert.deepEqual(answer("what is 24 / 5"), { kind: "value", value: 4.8, remainder: [4, 4] });
    assert.deepEqual(answer("what is 25 / 5"), { kind: "value", value: 5, remainder: null });
  });

  it("solves simple equations and checks answers", () => {
    assert.deepEqual(answer("solve 2x + 3 = 7"), { kind: "solved", variable: "x", value: 2 });
    assert.deepEqual(answer("what is x if 3x = 12"), { kind: "solved", variable: "x", value: 4 });
    assert.deepEqual(answer("solve for y: 4y - 2 = 10"), { kind: "solved", variable: "y", value: 3 });
    assert.equal(answer("x + 1 = x + 2").kind, "none");
    assert.equal(answer("is 7 x 8 56").kind, "check");
    assert.equal((answer("2+2=5?") as { right: boolean }).right, false);
    assert.equal((answer("does 2+2 equal 4") as { right: boolean }).right, true);
  });

  it("knows what can't be done", () => {
    assert.equal(answer("what is 100 / 0").kind, "zero");
    assert.equal(answer("what is the square root of -4").kind, "imaginary");
    assert.equal(answer("what is 2^100").kind, "huge");
    assert.equal(answer("solve x^2 = 4").kind, "too_hard");
  });

  it("writes numbers the way people read them", () => {
    assert.deepEqual(spokenValue(0.1 + 0.2), { text: "0.3", exact: true });
    assert.deepEqual(spokenValue(10 / 3), { text: "3.3333", exact: false });
    assert.equal(spokenValue(7_006_652).text, "7,006,652");
    assert.equal(spokenValue(-0).text, "0");
    assert.equal(prettyExpression("50 * ( 12 + 8 ) / 2"), "50 × (12 + 8) ÷ 2");
  });
});
