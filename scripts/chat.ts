// Talk to Grove's brain in the terminal, no Discord needed:  npm run chat
//
//   hello grove              say something as "you"
//   > that's funny            reply to Grove's last message
//   @sam: grove are you ok    say something as someone else (they join the channel)
//   @sam:> lol                someone else replies to Grove's last message
//   /wait 30                  let 30 seconds pass
//   /quit                     leave
//
// "@grove" in a message counts as an @mention.

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Grove } from "../src/brain/grove.ts";
import { InMemoryMemory } from "../src/brain/state/memory.ts";
import type { ChatMessage } from "../src/brain/types.ts";

const GROVE_ID = "100000000000000001";
let now = Date.now();
let nextId = 1;
let lastGroveMessage: { id: string } | null = null;

const grove = new Grove({ memory: new InMemoryMemory(), timezone: process.env["GROVE_TIMEZONE"] ?? "America/New_York", clock: { now: () => now } });
grove.setIdentity(GROVE_ID);

const users = new Map<string, string>();
function userId(name: string): string {
  let id = users.get(name);
  if (id === undefined) {
    id = `2${String(users.size + 1).padStart(17, "0")}`;
    users.set(name, id);
  }
  return id;
}

function send(author: string, text: string, replyToGrove: boolean): void {
  now += 3_000;
  const content = text.replace(/@grove\b/gi, `<@${GROVE_ID}>`);
  const message: ChatMessage = {
    id: String(nextId++),
    channelId: "terminal",
    parentId: null,
    authorId: userId(author),
    authorName: author,
    authorIsBot: false,
    content,
    createdAt: now,
    replyToId: replyToGrove && lastGroveMessage !== null ? lastGroveMessage.id : null,
    replyToAuthorId: replyToGrove && lastGroveMessage !== null ? GROVE_ID : null,
    mentionsGrove: content.includes(`<@${GROVE_ID}>`),
    mentionedUserIds: [],
    hasMedia: false,
  };
  grove.observe(message);
  const decision = grove.consider(message);
  if (decision === null) {
    console.log("   (grove stays quiet)");
    return;
  }
  if (decision.waitForSilenceMs > 0) console.log(`   (grove waits ${decision.waitForSilenceMs / 1000}s to see if a person answers first)`);
  now += decision.waitForSilenceMs + decision.delayMs;

  let sentId: string | null = null;
  if (decision.text !== null) {
    sentId = String(nextId++);
    grove.observe({ ...message, id: sentId, authorId: GROVE_ID, authorName: "Grove", authorIsBot: true, content: decision.text, replyToId: message.id, replyToAuthorId: message.authorId, mentionsGrove: false, createdAt: now });
    lastGroveMessage = { id: sentId };
    console.log(`grove: ${decision.text}`);
  }
  if (decision.reactions.length > 0) console.log(`   (reacts ${decision.reactions.join(" ")})`);
  grove.didSay(decision, sentId, now);
  console.log(`   [${decision.meta.act}${decision.meta.topic ? `, ${decision.meta.topic}` : ""}]`);
}

const terminal = createInterface({ input: stdin, output: stdout, prompt: "you: " });
console.log("talk to grove! '>' replies to grove, '@name: text' speaks as someone else, /wait N, /quit");
terminal.prompt();
for await (const raw of terminal) {
  const line = raw.trim();
  if (line === "/quit" || line === "/exit") break;
  const wait = /^\/wait\s+(\d+)/.exec(line);
  const other = /^@([\w-]+):(>?)\s*(.+)$/.exec(line);
  if (wait !== null) now += Number(wait[1]) * 1000;
  else if (other !== null) send(other[1]!, other[3]!, other[2] === ">");
  else if (line.startsWith(">")) send("you", line.slice(1).trim(), true);
  else if (line.length > 0) send("you", line, false);
  terminal.prompt();
}
terminal.close();
