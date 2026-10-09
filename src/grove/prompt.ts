// Puts one reply's prompt together: Grove's persona, the moment, the notes
// (Handbook pages and source), then the recent conversation as chat turns (Grove's own lines as its
// turns, everyone else's as "name: text"), ending with the message to answer.
// Each part has a budget so the whole thing fits the model's context.

import type { Message } from "ollama";
import { type Note, wantsSource } from "./notes.ts";
import type { ChatLine, TextAttachment } from "./types.ts";

export interface PromptInput {
  persona: string;
  moment: string;
  // null: the message isn't about the mods. []: it is, but the library had nothing.
  notes: readonly Note[] | null;
  transcript: readonly ChatLine[];
  target: ChatLine;
  // The message the target replies to, when it isn't in the transcript.
  replyTo: ChatLine | null;
  attachments: readonly TextAttachment[];
  // Characters for the conversation, the notes and attached files.
  budget?: { transcript?: number; notes?: number; attachments?: number };
  // A follow-up may be for someone else, so it isn't told to answer.
  followup?: boolean;
}

export interface Prompt {
  system: string;
  messages: Message[];
  // How to sample the reply. Answers about the mods are written cooler and without
  // the model's presence penalty, which pushes it away from repeating "type" and
  // "apoli:", the very tokens JSON is made of. Chat keeps the livelier defaults.
  sampling: { temperature?: number; presencePenalty?: number };
}

const HELP_SAMPLING = { temperature: 0.5, presencePenalty: 0 } as const;

const LINE_MAX = 600;
const NOTE_MAX = 2_800;

function squash(text: string, max: number): string {
  const flat = text.trim();
  return flat.length <= max ? flat : `${flat.slice(0, max)}…`;
}

function label(line: ChatLine, byId: ReadonlyMap<string, ChatLine>): string {
  if (line.replyToId === null) return line.authorName;
  const parent = byId.get(line.replyToId);
  if (parent === undefined) return line.authorName;
  return `${line.authorName} (replying to ${parent.isGrove ? "you" : parent.authorName})`;
}

function notesBlock(notes: readonly Note[] | null, budget: number): string {
  if (notes === null) return "";
  if (notes.length === 0) {
    return "\n\nREFERENCE NOTES\nNothing in the library matched this message. If they're asking how something in Apoli or Origins works, call search_handbook or search_source before you answer, and say you're not sure if you still find nothing.";
  }
  const parts: string[] = [];
  let used = 0;
  for (const note of notes) {
    const room = budget - used;
    if (room < 300) break;
    const body = squash(note.body, Math.min(room - 150, NOTE_MAX));
    const part = `${note.url.length > 0 ? `[${note.title}](${note.url})` : note.title}\n${body}`;
    parts.push(part);
    used += part.length;
  }
  return `\n\nREFERENCE NOTES (already looked up for their message: the real Handbook pages, and code where it helps. Answer from them now. Copy type ids and field names exactly, build json from a page's example, and never use a type or field that isn't here. If they don't cover the question, call search_handbook or search_source before you answer)\n\n${parts.join("\n\n---\n\n")}`;
}

const WANTS_JSON = /\b(?:examples?|json|make|create|write|build|give me|power that|how (?:do|would|can|could) (?:i|you|we)|how to)\b/i;

// Said on their message, where a small model looks hardest: the looking up is done, answer.
function answerNote(notes: readonly Note[] | null, question: string, followup: boolean): string {
  if (notes === null || notes.length === 0) return "";
  const when = followup ? "if this is for you, " : "";
  if (wantsSource(question)) return `\n\n[note to grove: ${when}your REFERENCE NOTES already have the code for this. answer it now from them, name the java file and link it.]`;
  const json = WANTS_JSON.test(question) ? ", with json built from the page's example" : "";
  return `\n\n[note to grove: ${when}your REFERENCE NOTES already have the handbook pages for this. answer it now from them${json}, and link the page you used.]`;
}

function attachmentBlock(attachments: readonly TextAttachment[], budget: number): string {
  let room = budget;
  const parts: string[] = [];
  for (const file of attachments) {
    if (room < 200) break;
    const text = squash(file.text, room - 100);
    const fence = /\.(json|mcmeta)$/i.test(file.name) ? "json" : /\.java$/i.test(file.name) ? "java" : "";
    parts.push(`[attached file ${file.name}]\n\`\`\`${fence}\n${text}\n\`\`\``);
    room -= text.length + 100;
  }
  return parts.length === 0 ? "" : `\n\n${parts.join("\n\n")}`;
}

export function buildPrompt(input: PromptInput): Prompt {
  const budget = { transcript: 4_000, notes: 6_500, attachments: 5_000, ...input.budget };
  const system = `${input.persona}\n\n${input.moment}${notesBlock(input.notes, budget.notes)}`;

  const known = new Map<string, ChatLine>();
  for (const line of input.transcript) known.set(line.id, line);
  if (input.replyTo !== null) known.set(input.replyTo.id, input.replyTo);

  // Newest first until the budget runs out, then back into reading order.
  const kept: ChatLine[] = [];
  let used = 0;
  for (let index = input.transcript.length - 1; index >= 0; index--) {
    const line = input.transcript[index]!;
    const size = Math.min(line.content.length, LINE_MAX) + line.authorName.length + 4;
    if (used + size > budget.transcript) break;
    kept.unshift(line);
    used += size;
  }

  const messages: Message[] = [];
  let pending: string[] = [];
  const flush = () => {
    if (pending.length > 0) messages.push({ role: "user", content: pending.join("\n") });
    pending = [];
  };

  if (input.replyTo !== null && !kept.some(line => line.id === input.replyTo!.id)) {
    const parent = input.replyTo;
    pending.push(`(earlier) ${parent.isGrove ? "you" : parent.authorName}: ${squash(parent.content, LINE_MAX)}`);
  }
  for (const line of kept) {
    if (line.isGrove) {
      flush();
      messages.push({ role: "assistant", content: squash(line.content, LINE_MAX) });
    } else {
      pending.push(`${label(line, known)}: ${squash(line.content, LINE_MAX)}`);
    }
  }
  flush();
  // Chat templates expect the conversation to open with someone other than Grove.
  if (messages[0]?.role === "assistant") messages.unshift({ role: "user", content: "(earlier in the channel)" });

  const target = input.target;
  const content = target.content.trim().length === 0 ? "(no text)" : squash(target.content, 2_000);
  messages.push({
    role: "user",
    content: `${label(target, known)}: ${content}${attachmentBlock(input.attachments, budget.attachments)}${answerNote(input.notes, target.content, input.followup === true)}`,
  });
  return { system, messages, sampling: input.notes !== null ? HELP_SAMPLING : {} };
}
