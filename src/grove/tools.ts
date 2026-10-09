// The tools Grove's brain may call while it thinks about a reply: look things
// up in the Handbook and the mods' source, do math (Grove can't count past
// seven in its head), and roll dice.

import type { Tool } from "ollama";
import { BUILDS, codeSourcesOf, MAIN_BUILD } from "../config.ts";
import { mathIn, solveMath, spokenValue } from "./arithmetic.ts";
import type { ToolBox } from "./brain.ts";
import { rollDice } from "./dice.ts";
import type { KnowledgeStore, SearchHit } from "./knowledge/store.ts";

const MAX_RESULT = 3_500;
const NOT_READY = "grove's library is still downloading (it syncs from github after a restart). answer from what you know, and say so if you're not sure.";

function tool(name: string, description: string, properties: Record<string, { type: string; description: string; enum?: string[] }>, required: string[]): Tool {
  return { type: "function", function: { name, description, parameters: { type: "object", properties, required } } };
}

export const TOOL_DEFINITIONS: Tool[] = [
  tool(
    "search_handbook",
    "Search the Handbook, the official Apoli and Origins documentation (power types, actions, conditions, data types, commands, Origins, addon/Java API). Use it for any question about how the mods work.",
    { query: { type: "string", description: "What to look for, e.g. \"action_on_key_press cooldown\" or \"how to make a resource bar\"" } },
    ["query"],
  ),
  tool(
    "read_handbook_page",
    "Read a whole Handbook page when a search result looks right but you need every field, default or the example.",
    { page: { type: "string", description: "The page link or title from search_handbook" } },
    ["page"],
  ),
  tool(
    "search_source",
    "Search the Apoli and Origins Java source code and the built-in Origins data (origins and their powers). Use it when the Handbook doesn't answer, or to check how something really behaves. It searches Fabric 1.21.1, the version the Handbook documents, unless you pick another version.",
    {
      query: { type: "string", description: "Class names, type ids or words, e.g. \"ShaderPower\" or \"merling water breathing\"" },
      mod: { type: "string", description: "Only search one mod", enum: ["apoli", "origins"] },
      version: { type: "string", description: `Which build's code (default ${MAIN_BUILD})`, enum: [...BUILDS] },
    },
    ["query"],
  ),
  tool(
    "read_source_file",
    "Read part of an Apoli or Origins source file found with search_source.",
    {
      path: { type: "string", description: "The file path or link from search_source" },
      line: { type: "number", description: "Line to center on" },
      version: { type: "string", description: `Which build's code (default ${MAIN_BUILD})`, enum: [...BUILDS] },
    },
    ["path"],
  ),
  tool(
    "calculate",
    "Work out a sum exactly: arithmetic, percentages, powers, roots, simple equations like 2x + 3 = 7.",
    { expression: { type: "string", description: "e.g. \"24 / 5\", \"15% of 80\", \"2x + 3 = 7\"" } },
    ["expression"],
  ),
  tool(
    "roll_dice",
    "Roll dice in D&D notation.",
    { dice: { type: "string", description: "e.g. \"d20\", \"2d6+3\"" } },
    ["dice"],
  ),
];

function clip(text: string, max = MAX_RESULT): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n…(cut)`;
}

function listHits(hits: readonly SearchHit[]): string {
  if (hits.length === 0) return "nothing found. try other words, or say you're not sure.";
  return hits
    .map((hit, index) => {
      const lines = hit.kind === "code" ? ` (lines ${hit.startLine}-${hit.endLine})` : "";
      return `${index + 1}. ${hit.title}${lines}\n${hit.url}\n${hit.snippet.replace(/\s+/g, " ").trim()}`;
    })
    .join("\n\n");
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

// Models write "1.20.1", "fabric 1.20.1" or "Neoforge" for a build; anything unclear means the main one.
function buildOf(value: unknown): string {
  const text = asString(value).toLowerCase();
  const exact = BUILDS.find(build => build === text);
  if (exact !== undefined) return exact;
  if (text.includes("neoforge") || text.includes("neo")) return "neoforge-1.21.1";
  if (text.includes("1.20")) return "fabric-1.20.1";
  return MAIN_BUILD;
}

export function calculate(expression: string): string {
  const problem = mathIn(/\b(what|solve|is)\b/i.test(expression) ? expression : `what is ${expression}`);
  if (problem === null) return "the calculator couldn't read that. write it as a plain sum like 24 / 5.";
  const answer = solveMath(problem);
  const shown = (value: number) => {
    const spoken = spokenValue(value);
    return spoken.exact ? spoken.text : `about ${spoken.text}`;
  };
  switch (answer.kind) {
    case "value":
      return answer.remainder === null ? `= ${shown(answer.value)}` : `= ${shown(answer.value)} (or ${answer.remainder[0]} remainder ${answer.remainder[1]})`;
    case "check":
      return `${answer.shown} = ${shown(answer.value)}, so the claimed ${shown(answer.claimed)} is ${answer.right ? "right" : "wrong"}`;
    case "solved":
      return `${answer.variable} = ${shown(answer.value)}`;
    case "every":
      return `every value of ${answer.variable} works`;
    case "none":
      return `no value of ${answer.variable} works`;
    case "huge":
      return "the result is too big to say";
    case "zero":
      return "that divides by zero";
    case "imaginary":
      return "that needs imaginary numbers";
    case "too_hard":
      return "too hard for the calculator";
  }
}

export function groveTools(knowledge: KnowledgeStore | null, random: () => number = Math.random): ToolBox {
  const ready = () => knowledge !== null && !knowledge.isEmpty();
  return {
    definitions: TOOL_DEFINITIONS,
    async run(name, args) {
      switch (name) {
        case "search_handbook": {
          if (!ready()) return NOT_READY;
          return listHits(knowledge!.search(asString(args["query"]), { kind: "docs", limit: 5 }));
        }
        case "read_handbook_page": {
          if (!ready()) return NOT_READY;
          const page = knowledge!.page(asString(args["page"]));
          return page === null ? "no page like that. search_handbook first." : clip(`${page.title}\n${page.url}\n\n${page.text}`);
        }
        case "search_source": {
          if (!ready()) return NOT_READY;
          const mod = asString(args["mod"]);
          const sources = codeSourcesOf(buildOf(args["version"]), mod === "apoli" || mod === "origins" ? mod : undefined);
          return listHits(knowledge!.search(asString(args["query"]), { kind: "code", limit: 5, source: sources }));
        }
        case "read_source_file": {
          if (!ready()) return NOT_READY;
          const file = knowledge!.findFile(asString(args["path"]), codeSourcesOf(buildOf(args["version"])));
          if (file === null) return "no file like that. search_source first.";
          const lines = file.text.replace(/\r?\n$/, "").split(/\r?\n/);
          const line = Number(args["line"]);
          const center = Number.isFinite(line) && line > 0 ? Math.min(lines.length, Math.floor(line)) : 1;
          const start = Math.max(1, center - 40);
          const end = Math.min(lines.length, start + 99);
          const numbered = lines.slice(start - 1, end).map((text, index) => `${start + index}: ${text}`).join("\n");
          return clip(`${file.title} (lines ${start}-${end} of ${lines.length})\n${file.url}\n\n${numbered}`);
        }
        case "calculate":
          return calculate(asString(args["expression"]));
        case "roll_dice": {
          const roll = rollDice(asString(args["dice"]), random);
          if (roll === null) return "that isn't dice notation. try d20 or 2d6+3.";
          const modifier = roll.modifier === 0 ? "" : ` ${roll.modifier > 0 ? "+" : "-"} ${Math.abs(roll.modifier)}`;
          return `${roll.notation}: [${roll.rolls.join(", ")}]${modifier} = ${roll.total}`;
        }
        default:
          return `there is no tool called ${name}.`;
      }
    },
  };
}
