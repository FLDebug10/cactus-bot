// Grove's way of typing, applied to everything the brain writes:
//   lowercase, like someone chatting (code, links, mentions, emoji and words
//   written in capitals on purpose are left alone)
//   no em or en dashes and no semicolons (nobody types those in chat)
//   at most one emoji
//   "#bug-reports" becomes a real channel link, @everyone/@here and user
//   mentions are dropped, and links only go to places Grove trusts
// Code blocks and `inline code` come out exactly as the brain wrote them: JSON
// indentation and Java's `()` and `;` are part of the answer.
// It also removes the bits a model sometimes leaks: <think> blocks, a
// "grove:" label in front, quotes around the whole reply.

import type { ChannelInfo } from "./types.ts";

export const SKIP = "[skip]";

const TRUSTED_HOSTS = [
  "0vergrown.github.io", "github.com", "modrinth.com", "curseforge.com", "jsonchecker.com", "minecraft.wiki",
  "fabricmc.net", "neoforged.net", "ollama.com", "discord.com",
];

const PROTECTED = /```[\s\S]*?(```|$)|`[^`\n]*`|<a?:\w+:\d+>|<[@#][!&]?\d+>|https?:\/\/[^\s<>()]+|:D\b|\bXD\b|\bxD\b|\bD:|:P\b|\bOwO\b|\bUwU\b|\b[A-Z]{2,}\b/g;
const CUSTOM_EMOJI = /^<a?:\w+:\d+>$/;
// One emoji, with its skin tone, variation selector and joined parts.
const EMOJI = /\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|️|‍\p{Extended_Pictographic})*/gu;
// Discord refuses longer messages.
export const MESSAGE_MAX = 1_900;

export interface VoiceOptions {
  channels: readonly ChannelInfo[];
  // The longest reply, across all the messages it is split into.
  maxLength?: number;
}

function trustedLink(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return TRUSTED_HOSTS.some(trusted => host === trusted || host.endsWith(`.${trusted}`));
  } catch {
    return false;
  }
}

// The same code block written again (a model "fixing" json it then repeats word for word).
function withoutRepeats(text: string): string {
  const seen = new Set<string>();
  return text.replace(/```[\s\S]*?```/g, block => {
    const key = block.replace(/\s+/g, " ");
    if (seen.has(key)) return "";
    seen.add(key);
    return block;
  });
}

function stripLeaks(raw: string): string {
  let text = withoutRepeats(raw.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*<\/think>/i, "")).trim();
  text = text.replace(/^(\*\*)?grove(\s*\(you\))?(\*\*)?\s*:\s*/i, "");
  if (/^"[^"]+"$/.test(text) || /^“[^”]+”$/.test(text)) text = text.slice(1, -1);
  return text.trim();
}

// Cuts at a line or sentence end, and never leaves a code block open.
function fit(text: string, max: number): string {
  if (text.length <= max) return text;
  let cut = text.slice(0, max);
  const lineEnd = cut.lastIndexOf("\n");
  const sentenceEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  const at = Math.max(lineEnd, sentenceEnd + 1);
  if (at > max * 0.5) cut = cut.slice(0, at);
  cut = cut.trimEnd();
  if ((cut.match(/```/g) ?? []).length % 2 === 1) cut += "\n```";
  return cut;
}

export function isSkip(raw: string): boolean {
  const text = stripLeaks(raw).toLowerCase();
  return text.length === 0 || text.startsWith(SKIP) || text === "skip";
}

// The reply as Grove would type it, or null when there is nothing to send.
export function voice(raw: string, options: VoiceOptions): string | null {
  if (isSkip(raw)) return null;
  const kept: string[] = [];
  let emoji = 0;
  // Code, links, mentions and emoji are set aside first, so the typing rules
  // below never touch them. What's dropped is dropped here.
  let body = stripLeaks(raw).replace(PROTECTED, match => {
    if (/^https?:\/\//.test(match) && !trustedLink(match)) return "";
    if (/^<@!?\d+>$|^<@&\d+>$/.test(match)) return "";
    if (CUSTOM_EMOJI.test(match) && ++emoji > 1) return "";
    kept.push(match);
    return `\u0000${kept.length - 1}\u0000`;
  });

  body = body
    .replace(EMOJI, match => (++emoji > 1 ? "" : match))
    .toLowerCase()
    .replace(/@(everyone|here)\b/g, "$1")
    .replace(/[ \t]*[—–][ \t]*/g, ", ")
    .replace(/[ \t]+--[ \t]+/g, ", ")
    .replace(/;/g, ".")
    .replace(/…/g, "...")
    .replace(/,[ \t]*,/g, ",")
    .replace(/,[ \t]*([.!?])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  for (const channel of options.channels) {
    const name = channel.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    body = body.replace(new RegExp(`(^|[^\\w<])#${name}(?![\\w-])`, "g"), `$1<#${channel.id}>`);
  }

  body = body.replace(/\u0000(\d+)\u0000/g, (_, index: string) => kept[Number(index)] ?? "").trim();
  if (body.length === 0) return null;
  return fit(body, options.maxLength ?? MESSAGE_MAX * 2);
}

// A reply as Discord messages: split between paragraphs, never inside a code
// block unless the block alone is too long (then it is closed and reopened).
export function splitMessage(text: string, max = MESSAGE_MAX): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim().length > 0) parts.push(current.trim());
    current = "";
  };
  for (const piece of text.split(/(```[\s\S]*?```)/)) {
    const units = piece.startsWith("```") ? [piece] : piece.split(/(?<=\n\n)/);
    for (const unit of units) {
      if (current.length + unit.length <= max) {
        current += unit;
        continue;
      }
      flush();
      if (unit.length <= max) {
        current = unit;
        continue;
      }
      const fence = /^```(\w*)\n/.exec(unit);
      const lines = unit.split("\n").flatMap(line => line.match(new RegExp(`[^]{1,${max - 10}}`, "g")) ?? [""]);
      let chunk = "";
      for (const line of lines) {
        if (chunk.length + line.length + 5 > max) {
          parts.push(fence !== null && !chunk.trimEnd().endsWith("```") ? `${chunk.trimEnd()}\n\`\`\`` : chunk.trimEnd());
          chunk = fence !== null ? `\`\`\`${fence[1]}\n` : "";
        }
        chunk += `${line}\n`;
      }
      current = chunk;
    }
  }
  flush();
  return parts;
}
