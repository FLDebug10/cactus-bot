// Puts one reply's prompt together: Grove's persona, the moment, the notes
// (Handbook pages and source), then the recent conversation as chat turns (Grove's own lines as its
// turns, everyone else's as "name: text"), ending with the message to answer.
// Each part has a budget so the whole thing fits the model's context.

import type { Message } from "ollama";
import type { Note } from "./notes.ts";
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
}

export interface Prompt {
  system: string;
  messages: Message[];
}

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
  return `\n\nREFERENCE NOTES (the real Handbook pages and Apoli/Origins source that match their message. Build your answer from them: copy type ids and field names exactly, and never invent one that isn't here. If they don't cover the question, call search_handbook or search_source yourself instead of guessing)\n\n${parts.join("\n\n---\n\n")}`;
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
    content: `${label(target, known)}: ${content}${attachmentBlock(input.attachments, budget.attachments)}`,
  });
  return { system, messages };
}
