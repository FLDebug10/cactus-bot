import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import type { KnowledgeSource } from "../../src/config.ts";
import { handbookUrl, identifierWords, prepare } from "../../src/grove/knowledge/chunk.ts";
import { ftsQuery, KnowledgeStore } from "../../src/grove/knowledge/store.ts";
import { KnowledgeSync } from "../../src/grove/knowledge/sync.ts";
import { readTar } from "../../src/grove/knowledge/tar.ts";
import { groveTools } from "../../src/grove/tools.ts";
import type { Logger } from "../../src/logger.ts";

const quiet: Logger = { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined };

// A minimal ustar archive, long names split into prefix + name like GitHub's.
function tar(files: Record<string, string>): Buffer {
  const blocks: Buffer[] = [];
  for (const [path, content] of Object.entries(files)) {
    const data = Buffer.from(content, "utf8");
    const header = Buffer.alloc(512);
    let name = path;
    let prefix = "";
    if (path.length > 100) {
      const cut = path.lastIndexOf("/");
      prefix = path.slice(0, cut);
      name = path.slice(cut + 1);
    }
    header.write(name, 0, 100, "utf8");
    header.write("0000644\0", 100);
    header.write("0000000\0", 108);
    header.write("0000000\0", 116);
    header.write(`${data.length.toString(8).padStart(11, "0")}\0`, 124);
    header.write("00000000000\0", 136);
    header.write("        ", 148);
    header.write("0", 156);
    header.write("ustar\0", 257);
    header.write("00", 263);
    header.write(prefix, 345, 155, "utf8");
    let sum = 0;
    for (const byte of header) sum += byte;
    header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
    blocks.push(header, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

const RESOURCE_PAGE = `---
title: "Resource (Power Type)"
description: "Stores a number between a minimum and a maximum."
navigation_title: "Resource"
---

Stores a number.

Type ID: \`apoli:resource\`

## Fields

Field | Type | Default | Description
------|------|---------|-------------
\`min\` | Integer | **required** | The lowest value.
\`max\` | Integer | **required** | The highest value.

## Examples

\`\`\`json
{ "type": "apoli:resource", "min": 0, "max": 10 }
\`\`\`
`;

const SHADER_JAVA = `package dev.overgrown.apoli.power.builtin;

public final class ShaderPower extends PowerType<ShaderPower.Config> {
    public record Config(ResourceLocation shader, boolean toggleable, int priority) {}
}
`;

describe("tar reader", () => {
  it("reads the files it is asked for, long names included", async () => {
    const longPath = `Repo-main/${"deep/".repeat(25)}file.md`;
    const archive = tar({ "Repo-main/a.md": "alpha", "Repo-main/skip.png": "binary", [longPath]: "beta" });
    const seen: Record<string, string> = {};
    for await (const entry of readTar(Readable.from([archive.subarray(0, 700), archive.subarray(700)]), path => path.endsWith(".md"))) {
      seen[entry.path] = entry.data.toString("utf8");
    }
    assert.deepEqual(seen, { "Repo-main/a.md": "alpha", [longPath]: "beta" });
  });
});

describe("knowledge", () => {
  it("maps handbook files to their links", () => {
    assert.equal(handbookUrl("src/content/docs/datapack/02-powers/resource.md", null), "https://0vergrown.github.io/Handbook/docs/datapack/powers/resource/");
    assert.equal(handbookUrl("src/content/docs/datapack/18-origins/05-badge-types/badge_sprite.md", null), "https://0vergrown.github.io/Handbook/docs/datapack/origins/badge_sprite/");
    assert.equal(handbookUrl("src/content/blog/2026-10-08-close-menus.md", null), "https://0vergrown.github.io/Handbook/blog/close-menus/");
  });

  it("keeps a page's legacy ids under its Type ID, since the frontmatter isn't kept", () => {
    const handbook: KnowledgeSource = { name: "handbook", repo: "0vergrown/Handbook", branch: "main", kind: "docs" };
    const page = `---\ntitle: "Action On Key Press (Power Type)"\naliases: ["active_self", "sync:action_on_key_sequence"]\n---\n\nRuns an action on a key.\n\n**Type ID:** \`apoli:action_on_key_press\`\n\n## Fields\n`;
    const prepared = prepare(handbook, "src/content/docs/datapack/02-powers/action_on_key_press.md", page);
    assert.match(prepared?.file.text ?? "", /^\*\*Type ID:\*\* `apoli:action_on_key_press`\n\nAlso answers to: `apoli:active_self`, `sync:action_on_key_sequence`\n/m);
    assert.match(prepared?.chunks[0]?.keywords ?? "", /active_self/);
    const plain = prepare(handbook, "src/content/docs/datapack/02-powers/heal.md", "---\ntitle: \"Heal\"\n---\n\nType ID: `apoli:heal`\n");
    assert.doesNotMatch(plain?.file.text ?? "", /Also answers to/);
  });

  it("splits code identifiers into words people search for", () => {
    assert.match(identifierWords("ShaderPowerState action_on_key_press"), /shader power state action key press/);
    assert.equal(ftsQuery("how does apoli:action_on_key_press work?"), '"apoli action key press" OR "apoli" OR "action" OR "key" OR "press"');
    assert.equal(ftsQuery("?? !!"), null);
  });

  it("syncs from github and finds pages and code", async () => {
    const sha = "a".repeat(40);
    const archives: Record<string, Buffer> = {
      "0vergrown/Handbook": gzipSync(tar({ "Handbook-main/src/content/docs/datapack/02-powers/resource.md": RESOURCE_PAGE, "Handbook-main/static/logo.png": "png" })),
      "0vergrown/Apoli": gzipSync(tar({ "Apoli-x/src/main/java/dev/overgrown/apoli/power/builtin/ShaderPower.java": SHADER_JAVA })),
    };
    let downloads = 0;
    const fakeFetch: typeof fetch = async input => {
      const url = String(input);
      if (url.startsWith("https://api.github.com/")) return new Response(sha);
      const repo = Object.keys(archives).find(name => url.includes(name));
      downloads++;
      return repo === undefined ? new Response("missing", { status: 404 }) : new Response(archives[repo]!);
    };
    const sources: KnowledgeSource[] = [
      { name: "handbook", repo: "0vergrown/Handbook", branch: "main", kind: "docs" },
      { name: "apoli", repo: "0vergrown/Apoli", branch: "Fabric-1.21.1", kind: "code" },
    ];
    const store = new KnowledgeStore(":memory:");
    const sync = new KnowledgeSync(store, sources, { fetch: fakeFetch, log: quiet });

    const first = await sync.syncAll();
    assert.deepEqual(first.map(result => result.status), ["updated", "updated"]);
    const again = await sync.syncAll();
    assert.deepEqual(again.map(result => result.status), ["unchanged", "unchanged"]);
    assert.equal(downloads, 2);

    const docs = store.search("what fields does a resource have, min max?", { kind: "docs" });
    assert.equal(docs[0]?.url, "https://0vergrown.github.io/Handbook/docs/datapack/powers/resource/");
    const code = store.search("shader power toggleable", { kind: "code" });
    assert.match(code[0]?.url ?? "", /github\.com\/0vergrown\/Apoli\/blob\/Fabric-1\.21\.1\/src\/main\/java\/.+ShaderPower\.java#L1-L5/);
    assert.equal(store.page("powers/resource")?.title, "Resource (Power Type)");
    assert.equal(store.page("https://0vergrown.github.io/Handbook/docs/datapack/powers/resource")?.title, "Resource (Power Type)");

    const tools = groveTools(store);
    assert.match(await tools.run("search_handbook", { query: "resource max" }), /Resource \(Power Type\)/);
    assert.match(await tools.run("read_source_file", { path: "ShaderPower.java", line: 3 }), /3: public final class ShaderPower/);
    assert.equal(await tools.run("calculate", { expression: "24 / 5" }), "= 4.8 (or 4 remainder 4)");
    assert.match(await tools.run("roll_dice", { dice: "2d6+3" }), /^2d6\+3: \[\d, \d\] \+ 3 = \d+$/);
    store.close();
  });
});
