import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { voice } from "../../src/grove/voice.ts";

const channels = [{ key: "bugReports", id: "123", name: "bug-reports", purpose: "bugs" }];
const say = (raw: string, maxLength?: number) => voice(raw, { channels, ...(maxLength !== undefined ? { maxLength } : {}) });

describe("grove's voice", () => {
  it("types in lowercase without dashes or semicolons", () => {
    assert.equal(say("Hello Sam — I love Moss; it's SO soft!"), "hello sam, i love moss. it's SO soft!");
  });

  it("leaves code, links and capital words alone", () => {
    const out = say("Use `PowerType` like this:\n```json\n{\"Type\": \"apoli:attribute\"}\n```\nSee https://0vergrown.github.io/Handbook/docs/ for JSON help");
    assert.equal(out, "use `PowerType` like this:\n```json\n{\"Type\": \"apoli:attribute\"}\n```\nsee https://0vergrown.github.io/Handbook/docs/ for JSON help");
  });

  it("drops untrusted links, pings and leaked labels", () => {
    assert.equal(say("Grove: check https://evil.example.com now"), "check now");
    assert.equal(say("hi @everyone and <@123456789>"), "hi everyone and");
    assert.equal(say("<think>planning stuff</think>Hi there"), "hi there");
  });

  it("turns channel names into links", () => {
    assert.equal(say("post it in #bug-reports please"), "post it in <#123> please");
  });

  it("stays quiet on [skip]", () => {
    assert.equal(say("[skip]"), null);
    assert.equal(say("   "), null);
  });

  it("keeps one custom emoji", () => {
    assert.equal(say("yay <:grove:1> <:grove_heart:2>"), "yay <:grove:1>");
  });

  it("cuts long replies at a sentence and closes code blocks", () => {
    const out = say(`First sentence. ${"word ".repeat(50)}\`\`\`json\n${"{} ".repeat(100)}`, 200) ?? "";
    assert.ok(out.length <= 210);
    assert.equal((out.match(/```/g) ?? []).length % 2, 0);
  });
});
