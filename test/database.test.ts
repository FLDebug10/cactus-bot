import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import Database from "better-sqlite3";
import { CustomCommandStore } from "../src/db/customCommands.ts";
import { openDatabase } from "../src/db/database.ts";
import { StrikeStore } from "../src/db/strikes.ts";
import { ModmailLinks, SuggestionClaims } from "../src/db/threadLinks.ts";

describe("database", () => {
  it("upgrades a database made by the old bot without losing anything", () => {
    const dir = mkdtempSync(join(tmpdir(), "grove-db-"));
    const path = join(dir, "database.db");
    try {
      const legacy = new Database(path);
      legacy.exec(`
        CREATE TABLE suggestions (thread TEXT PRIMARY KEY, user TEXT);
        CREATE TABLE modMail (user TEXT PRIMARY KEY, thread TEXT);
        CREATE TABLE commands (cmd TEXT PRIMARY KEY, help TEXT, out TEXT);
        INSERT INTO commands VALUES ('!rules', 'Server rules', 'Be nice!');
        INSERT INTO suggestions VALUES ('t1', 'u1');
        INSERT INTO modMail VALUES ('u2', 't2');
      `);
      legacy.close();

      const db = openDatabase(path);
      assert.equal(new CustomCommandStore(db).get("!rules")?.out, "Be nice!");
      assert.equal(new SuggestionClaims(db).claimant("t1"), "u1");
      assert.equal(new ModmailLinks(db).userOf("t2"), "u2");
      assert.equal(db.pragma("user_version", { simple: true }), 2);
      db.close();

      const reopened = openDatabase(path);
      assert.equal(new CustomCommandStore(reopened).all().length, 1);
      reopened.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stores custom commands, claims and modmail links", () => {
    const db = openDatabase(":memory:");
    const commands = new CustomCommandStore(db);
    commands.save({ cmd: "!hi", help: "says hi", out: "hello" });
    commands.save({ cmd: "!hi", help: "says hi", out: "hello again" });
    assert.equal(new CustomCommandStore(db).get("!hi")?.out, "hello again");
    assert.equal(commands.remove("!hi"), true);
    assert.equal(commands.remove("!hi"), false);

    const links = new ModmailLinks(db);
    links.open("user", "thread-a");
    links.open("user", "thread-b");
    assert.equal(links.userOf("thread-a"), undefined);
    assert.equal(new ModmailLinks(db).threadOf("user"), "thread-b");
    links.close("user");
    assert.equal(new ModmailLinks(db).threadOf("user"), undefined);
  });

  it("counts strikes inside their window only", () => {
    const strikes = new StrikeStore(openDatabase(":memory:"));
    const day = 24 * 60 * 60_000;
    assert.equal(strikes.add("u", 1_000, "explicit", "first", day), 1);
    assert.equal(strikes.add("u", 2_000, "explicit", "second", day), 2);
    assert.equal(strikes.add("other", 2_500, "explicit", "someone else", day), 1);
    assert.equal(strikes.add("u", 2_000 + 2 * day, "explicit", "much later", day), 1);
  });
});
