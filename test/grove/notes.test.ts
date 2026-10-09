import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import Database from "better-sqlite3";
import type { KnowledgeSource } from "../../src/config.ts";
import { type ChunkRecord, type FileRecord, prepare } from "../../src/grove/knowledge/chunk.ts";
import { conceptHints, conceptPages } from "../../src/grove/knowledge/concepts.ts";
import { ftsQuery, KnowledgeStore } from "../../src/grove/knowledge/store.ts";
import { codeOnly, colorHints, compactTables, condensePage, gatherNotes, isModQuestion, mainTypeOf, notesQuery } from "../../src/grove/notes.ts";
import type { ChatLine } from "../../src/grove/types.ts";

const HANDBOOK: KnowledgeSource = { name: "handbook", repo: "0vergrown/Handbook", branch: "main", kind: "docs" };
const APOLI: KnowledgeSource = { name: "apoli", repo: "0vergrown/Apoli", branch: "Fabric-1.21.1", kind: "code", mod: "apoli", build: "fabric-1.21.1" };
const APOLI_OLD: KnowledgeSource = { name: "apoli-fabric-1.20.1", repo: "0vergrown/Apoli", branch: "Fabric-1.20.1", kind: "code", mod: "apoli", build: "fabric-1.20.1" };

const FOG_PAGE = `---
title: "Modify Fog (Power Type)"
description: "Changes where the holder's fog starts and ends, and what colour it is."
---

Changes the fog the holder sees. Every field is optional.

Type ID: \`apoli:modify_fog\`

## Fields

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| \`s\` | [Float](/docs/datapack/data-types/float) | _optional_ | Fog **start** distance in blocks. |
| \`v\` | [Float](/docs/datapack/data-types/float) | _optional_ | Fog **end** distance in blocks. |

## How several powers combine

This section is long and not needed to write the power.

## Examples

Near-blindness:

\`\`\`json
{ "type": "apoli:modify_fog", "s": 0, "v": 4 }
\`\`\`

A second example nobody needs.

\`\`\`json
{ "type": "apoli:modify_fog", "r": 1 }
\`\`\`
`;

const scalePage = (title: string, kind: string) => `---
title: "${title}"
description: "Resizes the entity, its hitbox and its model."
---

Resizes the entity.

Type ID: \`apoli:scale\`

## Fields

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| \`scale\` | Float | _optional_ | ${kind} multiplier. |
`;

const OVERLAY_PAGE = `---
title: "Overlay (Power Type)"
description: "Draws a picture over the screen."
---

Draws a picture.

Type ID: \`apoli:overlay\`

## Locking the GUI scale

The GUI scale decides the size. GUI scale GUI scale GUI scale, scale scale scale, a player can pick any scale. Smaller scale, bigger scale.
`;

const BLOG_POST = `---
title: "Scales that actually show up"
description: "Everyone can see a scale now."
---

Scale scale scale. A player's scale, the scale system, scale types, smaller players, scale again.

## Everyone can see it

Scale scale scale scale scale scale.
`;

const FOG_POWER = `package dev.overgrown.apoli.power.builtin;

import com.mojang.serialization.Codec;
import dev.overgrown.apoli.power.PowerType;

public final class ModifyFogPower extends PowerType<ModifyFogPower.Config> {
    public record Config(Optional<Expression> s, Optional<Expression> v) {}
}
`;

const SCALE_POWER = `package dev.overgrown.apoli.power.builtin;

public final class ScalePower extends PowerType<ScalePower.Config> {
    public record Config(Expression scale) {}
}
`;

const FOG_MIXIN = `package dev.overgrown.apoli.mixin.power;

@Mixin(FogRenderer.class)
public class FogRendererModifyFogMixin {
    // fog fog fog fog modify fog power power
}
`;

function file(source: KnowledgeSource, path: string, text: string): { file: FileRecord; chunks: ChunkRecord[] } {
  const prepared = prepare(source, path, text);
  assert.ok(prepared, `${path} should be indexable`);
  return prepared;
}

function indexed(): KnowledgeStore {
  const store = new KnowledgeStore(":memory:");
  const docs = [
    file(HANDBOOK, "src/content/docs/datapack/02-powers/modify_fog.md", FOG_PAGE),
    file(HANDBOOK, "src/content/docs/datapack/02-powers/scale.md", scalePage("Scale (Power Type)", "A power's")),
    file(HANDBOOK, "src/content/docs/datapack/03-entity-actions/scale.md", scalePage("Scale (Entity Action Type)", "An action's")),
    file(HANDBOOK, "src/content/docs/datapack/02-powers/overlay.md", OVERLAY_PAGE),
    file(HANDBOOK, "src/content/blog/2026-09-18-scales-that-actually-show-up.md", BLOG_POST),
  ];
  store.replaceSource("handbook", "h".repeat(40), docs.map(doc => doc.file), docs.flatMap(doc => doc.chunks), 1);
  const code = [
    file(APOLI, "src/main/java/dev/overgrown/apoli/power/builtin/ModifyFogPower.java", FOG_POWER),
    file(APOLI, "src/main/java/dev/overgrown/apoli/power/builtin/ScalePower.java", SCALE_POWER),
    file(APOLI, "src/main/java/dev/overgrown/apoli/mixin/power/FogRendererModifyFogMixin.java", FOG_MIXIN),
  ];
  store.replaceSource("apoli", "a".repeat(40), code.map(doc => doc.file), code.flatMap(doc => doc.chunks), 1);
  const old = [file(APOLI_OLD, "src/main/java/dev/overgrown/apoli/power/builtin/ModifyFogPower.java", FOG_POWER.replace("Optional<Expression> s", "float start"))];
  store.replaceSource("apoli-fabric-1.20.1", "b".repeat(40), old.map(doc => doc.file), old.flatMap(doc => doc.chunks), 1);
  return store;
}

const line = (id: string, author: string, content: string, isGrove = false): ChatLine => ({ id, channelId: "c", authorId: isGrove ? "grove" : author, authorName: author, isGrove, isBot: isGrove, content, at: Number(id), replyToId: null });

describe("what Grove reads before answering", () => {
  it("tells questions about the mods from chat", () => {
    for (const yes of ["can you make me a power that gives fog?", "how do i make a player smaller", "what does apoli:modify_fog do", "how does action_on_key_press work", "what does ModifyFogPower do", "my datapack crashes", "make me fly when i press a key"]) {
      assert.equal(isModQuestion(yes), true, yes);
    }
    for (const no of ["grove what is your favorite color", "i love flying in minecraft", "good morning!", "lol that was a great mic drop", "what's your favorite food"]) {
      assert.equal(isModQuestion(no), false, no);
    }
  });

  it("adds what the same person just said to a short follow-up, but never Grove's own lines", () => {
    const earlier = [line("1", "fld", "can you make a power that gives fog?"), line("2", "grove", "do you want shader or something", true), line("3", "sam", "unrelated chatter")];
    const short = notesQuery(line("4", "fld", "players actually, and make it purple"), null, earlier);
    assert.match(short, /players actually/);
    assert.match(short, /gives fog/);
    assert.doesNotMatch(short, /shader|unrelated/);
    const long = notesQuery(line("5", "fld", "how do i write a resource bar that fills up slowly while the player stands still in a lit area for a while"), null, earlier);
    assert.doesNotMatch(long, /gives fog/);
    assert.match(notesQuery(line("6", "fld", "what is this"), line("7", "sam", "my cooldown power is broken"), []), /cooldown power is broken/);
  });

  it("keeps a page's fields, one line each, and its first example, and drops the rest and the link markup", () => {
    const body = condensePage(FOG_PAGE.replace(/^---[\s\S]*?---\n/, ""), 2_600);
    assert.match(body, /Type ID: `apoli:modify_fog`/);
    assert.match(body, /^- `s` \(Float, optional\): Fog start distance in blocks\.$/m);
    assert.match(body, /Example: Near-blindness\n```json\n\{ "type": "apoli:modify_fog", "s": 0, "v": 4 \}\n```/);
    assert.doesNotMatch(body, /How several powers combine|not needed|"r": 1|\]\(|\| --- \|/);
    assert.match(condensePage(FOG_PAGE.replace(/^---[\s\S]*?---\n/, ""), 2_600, 2), /"r": 1/, "more examples when asked for");
    assert.ok(condensePage("x".repeat(5_000), 600).length <= 610);
  });

  it("turns padded tables into lines, and leaves code alone", () => {
    const table = "| Field    | Type  | Default    | Description   |\n| -------- | ----- | ---------- | ------------- |\n| `amount` | Float | _optional_ | How much.     |\n| `id`     | Identifier | — | Which one. |\n| `key` | Key | **required** | The key. |\n| `cooldown` | Integer | `1` | Ticks between, for `entity_action` and _all_ others. |";
    assert.equal(compactTables(table), "- `amount` (Float, optional): How much.\n- `id` (Identifier): Which one.\n- `key` (Key, required): The key.\n- `cooldown` (Integer, default `1`): Ticks between, for `entity_action` and all others.");
    assert.equal(compactTables("```json\n{ \"a\": \"x | y\" }\n```"), "```json\n{ \"a\": \"x | y\" }\n```");
    assert.equal(compactTables("| Legacy ID | Runs on |\n|---|---|\n| `apoli:x` | the actor |"), "- `apoli:x` · the actor");
  });

  it("strips package and import lines from Java", () => {
    const text = codeOnly(FOG_POWER, 1_000);
    assert.doesNotMatch(text, /^package|^import/m);
    assert.match(text, /^public final class ModifyFogPower/);
  });

  it("converts the hex colors in a message", () => {
    const note = colorHints("make the fog #8f0f99 please");
    assert.ok(note);
    assert.match(note.body, /#8f0f99 = rgb\(143, 15, 153\) = 0\.561, 0\.059, 0\.6 as 0 to 1 channels = 9375641/);
    assert.equal(colorHints("no colors, just #fff and 12345"), null);
    assert.match(colorHints("0xFF0000")?.body ?? "", /rgb\(255, 0, 0\) = 1, 0, 0 /);
  });

  it("finds the power page for a request, and leaves the Java out unless they ask about code", () => {
    const store = indexed();
    const notes = gatherNotes(store, "can you make me a power that gives a 8, 24 block fog to the entity?");
    assert.ok(notes);
    assert.equal(notes[0]?.title, "Modify Fog (Power Type)");
    assert.equal(notes[0]?.url, "https://0vergrown.github.io/Handbook/docs/datapack/powers/modify_fog/");
    assert.ok(!notes.some(note => note.body.startsWith("```java")), notes.map(note => note.title).join(" | "));
    assert.equal(mainTypeOf(notes), "apoli:modify_fog");
    store.close();
  });

  it("finds the scale power for words the docs never use, ahead of pages that only mention scale", () => {
    const store = indexed();
    const notes = gatherNotes(store, "how do i make a player smaller");
    assert.ok(notes);
    assert.equal(notes[0]?.title, "Scale (Power Type)");
    const titles = notes.map(note => note.title);
    assert.ok(titles.indexOf("Scale (Entity Action Type)") > 0, "the action page comes after the power");
    assert.ok(!titles.some(title => /Overlay|Scales that actually/.test(title)), titles.join(" | "));
    assert.ok(gatherNotes(store, "what changed about scale in the new update")?.some(note => /Scales that actually/.test(note.title)), "news questions get the news");
    store.close();
  });

  it("reads the pages of what a question describes and names, before what a search finds", () => {
    const store = indexed();
    const named = gatherNotes(store, "how does apoli:modify_fog compare to a scale power", { schema: store.schema(["apoli"]) });
    assert.equal(named?.[0]?.title, "Modify Fog (Power Type)", "an id they wrote comes first");
    assert.deepEqual(conceptPages("make a power that heals me 1 heart every 5 seconds while i'm in water"), ["powers/action_over_time", "entity-actions/heal", "entity-conditions/submerged_in", "entity-conditions/fluid_height"]);
    assert.deepEqual(conceptPages("can i make a power that only works at night?"), ["entity-conditions/daytime", "entity-conditions/time_of_day"]);
    assert.deepEqual(conceptPages("make me a power that sets mobs on fire when i hit them"), ["powers/action_on_hit", "entity-actions/set_on_fire"]);
    assert.deepEqual(conceptPages("how do i make my own origin?"), ["origins/overview", "origins/layers"]);
    assert.deepEqual(conceptPages("grove what is your favorite color"), []);
    assert.deepEqual(conceptHints("can i make a power that only works at night?"), ['Only at night: give the power "condition": { "type": "apoli:daytime", "inverted": true }. Every power can take a "condition".']);
    assert.match(conceptHints("heal me every 5 seconds").join("\n"), /20 ticks = 1 second, so every 5 seconds is "interval": 100[^]*2 = one heart/);
    assert.equal(gatherNotes(store, "make a power that only works at night")?.[0]?.title, "How this is usually done");
    store.close();
  });

  it("asks for the action page when the question is about actions", () => {
    const store = indexed();
    assert.equal(gatherNotes(store, "what does the scale action do")?.[0]?.title, "Scale (Entity Action Type)");
    store.close();
  });

  it("adds source matches when the question is about the code, and keeps mixins behind the real class", () => {
    const store = indexed();
    const notes = gatherNotes(store, "how does the fog power work in the java code?", { codeSources: ["apoli"] });
    assert.ok(notes);
    const code = notes.filter(note => note.body.startsWith("```java"));
    assert.ok(code.length >= 2);
    assert.match(code[0]?.url ?? "", /ModifyFogPower\.java/);
    store.close();
  });

  it("searches only the build it is asked to", () => {
    const store = indexed();
    const old = store.search("modify fog power", { kind: "code", source: ["apoli-fabric-1.20.1"] });
    assert.ok(old.length > 0);
    assert.ok(old.every(hit => hit.source === "apoli-fabric-1.20.1" && hit.url.includes("Fabric-1.20.1")));
    const main = store.search("modify fog power", { kind: "code", source: ["apoli"] });
    assert.ok(main.every(hit => hit.source === "apoli"));
    assert.match(store.findFile(old[0]!.url)?.text ?? "", /float start/);
    assert.match(store.findFile("ModifyFogPower", ["apoli"])?.text ?? "", /Optional<Expression> s/);
    assert.match(store.classFile("apoli", "ModifyFogPower")?.url ?? "", /Fabric-1\.21\.1/);
    assert.equal(store.classFile("apoli", "Fog"), null);
    store.close();
  });

  it("says nothing for chat, and an empty list when the library has nothing", () => {
    const store = indexed();
    assert.equal(gatherNotes(store, "grove what is your favorite color"), null);
    assert.deepEqual(gatherNotes(store, "what is zzz:qqqq"), []);
    store.close();
  });

  it("matches word endings and adds the docs' words for what people say", () => {
    assert.equal(ftsQuery("make me smaller"), '"scale"');
    assert.match(ftsQuery("i want to fly") ?? "", /"flight"/);
    assert.match(ftsQuery("a size change") ?? "", /"size" OR .*"scale"/);
    const store = indexed();
    assert.equal(store.search("entities scales", { kind: "docs", limit: 1 }).length, 1);
    store.close();
  });

  it("rebuilds an index that was made without word endings", () => {
    const dir = mkdtempSync(join(tmpdir(), "grove-index-"));
    try {
      const path = join(dir, "knowledge.db");
      const old = new Database(path);
      old.exec(`
        CREATE VIRTUAL TABLE chunks USING fts5(title, keywords, body, source UNINDEXED, kind UNINDEXED, path UNINDEXED, url UNINDEXED, start_line UNINDEXED, end_line UNINDEXED, tokenize = 'unicode61 remove_diacritics 2');
        CREATE TABLE files (source TEXT NOT NULL, path TEXT NOT NULL, title TEXT NOT NULL, url TEXT NOT NULL, text TEXT NOT NULL, PRIMARY KEY (source, path));
        CREATE TABLE sources (name TEXT PRIMARY KEY, sha TEXT NOT NULL, synced_at INTEGER NOT NULL, files INTEGER NOT NULL, chunks INTEGER NOT NULL);
        INSERT INTO sources VALUES ('handbook', 'x', 1, 1, 1);
      `);
      old.close();
      const store = new KnowledgeStore(path);
      assert.equal(store.isEmpty(), true, "the next sync downloads everything again");
      const docs = [file(HANDBOOK, "src/content/docs/datapack/02-powers/scale.md", scalePage("Scale (Power Type)", "A power's"))];
      store.replaceSource("handbook", "h".repeat(40), docs.map(doc => doc.file), docs.flatMap(doc => doc.chunks), 1);
      assert.equal(store.search("scales", { kind: "docs" }).length > 0, true);
      store.close();
      const again = new KnowledgeStore(path);
      assert.equal(again.isEmpty(), false, "an up to date index is kept");
      again.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
