import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitMessage, voice } from "../../src/grove/voice.ts";

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

  it("keeps one emoji, custom or not", () => {
    assert.equal(say("yay <:grove:1> <:grove_heart:2>"), "yay <:grove:1>");
    assert.equal(say("oops! let me fix that 🧪🔍"), "oops! let me fix that 🧪");
    assert.equal(say("hi <:grove:1> 🌿"), "hi <:grove:1>");
  });

  it("sends code exactly as written: indentation, brackets and semicolons", () => {
    const json = "```json\n{\n    \"type\": \"apoli:action_on_hit\",\n    \"cooldown\": 20\n}\n```";
    const java = "```java\nvar codec = ShaderPower.codec();\nif (a  &&  b) run();\n```";
    assert.equal(say(`Here:\n\n${json}\n\nAnd Java:\n\n${java}`), `here:\n\n${json}\n\nand java:\n\n${java}`);
    assert.equal(say("call `ShaderPower.codec()` first; then reload"), "call `ShaderPower.codec()` first. then reload");
    assert.equal(say("see (https://evil.example.com) ok"), "see ok");
  });

  it("drops a code block written a second time", () => {
    const block = "```json\n{ \"type\": \"apoli:heal\" }\n```";
    assert.equal(say(`${block}\nwait, let me fix it:\n${block}`), `${block}\nwait, let me fix it:`);
  });

  it("cuts long replies at a sentence and closes code blocks", () => {
    const out = say(`First sentence. ${"word ".repeat(50)}\`\`\`json\n${"{} ".repeat(100)}`, 200) ?? "";
    assert.ok(out.length <= 210);
    assert.equal((out.match(/```/g) ?? []).length % 2, 0);
  });
});

describe("splitting a reply into Discord messages", () => {
  it("keeps short replies whole", () => {
    assert.deepEqual(splitMessage("hi!"), ["hi!"]);
  });

  it("splits between paragraphs and never inside a code block that fits", () => {
    const block = `\`\`\`json\n${'{ "a": 1 },\n'.repeat(30)}\`\`\``;
    const text = `${"intro words here. ".repeat(20)}\n\n${block}\n\nthat's it!`;
    const parts = splitMessage(text, 400);
    assert.ok(parts.length >= 2);
    assert.ok(parts.every(part => part.length <= 400), parts.map(part => part.length).join(","));
    assert.ok(parts.some(part => part === block || part.startsWith(block)), "the block stays in one message");
    assert.equal(parts.join("\n\n").replace(/\s+/g, " "), text.replace(/\s+/g, " "));
  });

  it("closes and reopens a code block too long for one message", () => {
    const block = `\`\`\`json\n${'{ "type": "apoli:heal", "amount": 1 },\n'.repeat(40)}\`\`\``;
    const parts = splitMessage(block, 500);
    assert.ok(parts.length >= 3);
    for (const part of parts) {
      assert.ok(part.length <= 500);
      assert.match(part, /^```json\n/);
      assert.match(part, /```$/);
    }
  });
});
