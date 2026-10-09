// Grove's library from the command line:
//   npm run knowledge -- sync             download/refresh everything from GitHub
//   npm run knowledge -- docs <words>     search the Handbook
//   npm run knowledge -- code <words>     search the Apoli/Origins source
//   npm run knowledge -- page <link|slug> print a Handbook page

import { KNOWLEDGE } from "../src/config.ts";
import { KnowledgeStore } from "../src/grove/knowledge/store.ts";
import { KnowledgeSync } from "../src/grove/knowledge/sync.ts";
import { logger } from "../src/logger.ts";

const [command, ...rest] = process.argv.slice(2);
const query = rest.join(" ");
const store = new KnowledgeStore(KNOWLEDGE.path);

try {
  switch (command) {
    case "sync": {
      const results = await new KnowledgeSync(store, KNOWLEDGE.sources, { log: logger("knowledge") }).syncAll(true);
      for (const result of results) console.log(`${result.source}: ${result.status}${result.files !== undefined ? ` (${result.files} files, ${result.chunks} chunks)` : ""}${result.error !== undefined ? ` ${result.error}` : ""}`);
      break;
    }
    case "docs":
    case "code":
      for (const hit of store.search(query, { kind: command, limit: 8 })) console.log(`${hit.title}\n  ${hit.url}\n  ${hit.snippet.replace(/\s+/g, " ")}\n`);
      break;
    case "page": {
      const page = store.page(query);
      console.log(page === null ? "no such page" : `${page.title}\n${page.url}\n\n${page.text}`);
      break;
    }
    default:
      console.log("usage: npm run knowledge -- sync | docs <words> | code <words> | page <link or slug>");
      for (const source of store.sources()) console.log(`  ${source.name}: ${source.files} files, ${source.chunks} chunks, ${source.sha.slice(0, 7)}, ${new Date(source.syncedAt).toISOString()}`);
  }
} finally {
  store.close();
}
