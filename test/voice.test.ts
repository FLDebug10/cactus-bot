import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { speak } from "../src/brain/respond/voice.ts";
import type { MoodSnapshot } from "../src/brain/state/mood.ts";

const calm: MoodSnapshot = { valence: 0.5, energy: 0.6, label: "okay", cause: null };

describe("voice", () => {
  it("types in lowercase without dashes or semicolons", () => {
    const said = speak("Hello There — This Is Fine; Really – Okay", calm, () => 0.99);
    assert.equal(said, "hello there, this is fine. really, okay");
  });

  it("leaves links, channels, mentions and custom emoji exactly as written", () => {
    const said = speak("See <#1533408856682663956> and <https://Example.com/Path> <:Grove:123>", calm, () => 0.99);
    assert.equal(said, "see <#1533408856682663956> and <https://Example.com/Path> <:Grove:123>");
  });

  it("keeps emoticon faces intact", () => {
    assert.equal(speak("YAY :D", calm, () => 0.99), "yay :D");
  });

  it("uses at most one custom emoji", () => {
    assert.equal(speak("hi <:a:1> <:b:2>", calm, () => 0.99), "hi <:a:1>");
  });
});
