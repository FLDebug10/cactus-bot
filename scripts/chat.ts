// Talk to Grove's brain in the terminal, no Discord needed:  npm run chat
// It uses the same persona, notes, tools, reflexes and brains as the bot: the
// Ollama in GROVE_BRAIN_URL (default http://127.0.0.1:11434), plus Ollama's cloud
// when GROVE_CLOUD_API_KEY is set.
//
//   how do i make a resource bar     say something to Grove as "you"
//   @sam: grove are you a cactus     say something as someone else
//   /sync                            download the Handbook + source library (first run)
//   /notes                           show which Handbook notes the last reply got
//   /quit                            leave

import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { KNOWLEDGE, SETTINGS } from "../src/config.ts";
import { brainsFromConfig } from "../src/grove/brains.ts";
import { History } from "../src/grove/history.ts";
import { KnowledgeStore, type SearchHit } from "../src/grove/knowledge/store.ts";
import { KnowledgeSync } from "../src/grove/knowledge/sync.ts";
import { persona, rightNow } from "../src/grove/persona.ts";
import { buildPrompt } from "../src/grove/prompt.ts";
import { asksAboutExplosives, explicitMatch, explicitReply } from "../src/grove/reflexes.ts";
import { groveTools } from "../src/grove/tools.ts";
import type { ChannelInfo, ChatLine } from "../src/grove/types.ts";
import { voice } from "../src/grove/voice.ts";
import { logger } from "../src/logger.ts";

const CHANNEL = "terminal";
const channels: ChannelInfo[] = [
  { key: "bugReports", id: "1", name: "bug-reports", purpose: "report bugs in Apoli, Origins or the Handbook" },
  { key: "suggestions", id: "2", name: "suggestions", purpose: "ideas and feature requests" },
  { key: "datapackSupport", id: "3", name: "datapack-support", purpose: "help with making powers and datapacks" },
  { key: "addonSupport", id: "4", name: "addon-support", purpose: "help with Java addons" },
];

const knowledge = new KnowledgeStore(KNOWLEDGE.path);
const sync = new KnowledgeSync(knowledge, KNOWLEDGE.sources, { log: logger("knowledge") });
const brain = brainsFromConfig(logger("brain"));
const tools = groveTools(knowledge);
const history = new History();
const personaText = persona({ channels, commands: ["!help: lists every command", "!rbr: points to bug reports", "!report [title] [message] [Apoli/Origins/Wiki]: makes a bug report post"] });

let nextId = 1;
let strikes = 0;
let lastNotes: SearchHit[] = [];

function line(author: string, content: string, isGrove = false): ChatLine {
  return { id: String(nextId++), channelId: CHANNEL, authorId: isGrove ? "grove" : author, authorName: author, isGrove, isBot: isGrove, content, at: Date.now(), replyToId: null };
}

for (const status of await brain.check()) {
  console.log(`${status.name} brain ${status.online ? `online: ${status.model} (${status.capabilities.join(", ")})${status.credits !== null ? `, ${status.credits}` : ""}` : `offline: ${status.reason}`}`);
}
if (knowledge.isEmpty()) console.log("the library is empty, type /sync to download the handbook and source (about a minute)");
brain.stop();

const rl = createInterface({ input: stdin, output: stdout });
for (;;) {
  const input = (await rl.question("> ")).trim();
  if (input.length === 0) continue;
  if (input === "/quit") break;
  if (input === "/sync") {
    for (const result of await sync.syncAll(true)) console.log(`  ${result.source}: ${result.status}${result.files !== undefined ? ` (${result.files} files)` : ""}${result.error !== undefined ? ` ${result.error}` : ""}`);
    continue;
  }
  if (input === "/notes") {
    console.log(lastNotes.length === 0 ? "  (no notes)" : lastNotes.map(note => `  ${note.title} ${note.url}`).join("\n"));
    continue;
  }

  const other = /^@(\w+):\s*(.*)$/.exec(input);
  const author = other?.[1] ?? "you";
  const target = line(author, other?.[2] ?? input);
  const transcript = history.before(CHANNEL, target.id, 16, 45 * 60_000);
  history.add(target);

  if (explicitMatch(target.content) !== null) {
    strikes++;
    console.log(`grove: ${explicitReply(strikes, strikes >= 2 ? 10 : null)}  [explicit, strike ${strikes}]`);
    continue;
  }
  if (asksAboutExplosives(target.content)) {
    console.log("grove: here's the only bomb recipe i know! 5 gunpowder and 4 sand  [+ minecraft_tnt_crafting_recipe.png]");
    continue;
  }

  lastNotes = knowledge.isEmpty() ? [] : knowledge.search(target.content, { kind: "docs", limit: 3 });
  const prompt = buildPrompt({
    persona: personaText,
    moment: rightNow({ now: Date.now(), timezone: SETTINGS.timezone, channel: "general", thread: null, threadStarter: null, speaker: { id: author, name: author, crew: null, staff: false }, addressing: "direct", imageCount: 0 }),
    notes: lastNotes,
    transcript,
    target,
    replyTo: null,
    attachments: [],
  });
  try {
    await brain.check();
    const reply = await brain.reply({ system: prompt.system, messages: prompt.messages, tools, maxToolRounds: 3 });
    const text = voice(reply.text, { channels }) ?? "(stays quiet)";
    history.add(line("grove", text, true));
    console.log(`grove: ${text}`);
    console.log(`  [${reply.brain} ${reply.model}, ${reply.ms} ms, ${reply.promptTokens}+${reply.replyTokens} tokens${reply.toolCalls.length > 0 ? `, tools: ${reply.toolCalls.join(" ")}` : ""}]`);
  } catch (error) {
    console.log(`  (the brain didn't answer: ${error instanceof Error ? error.message : String(error)})`);
  } finally {
    brain.stop();
  }
}
rl.close();
knowledge.close();
