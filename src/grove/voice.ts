// Grove's way of typing, applied to everything the brain writes:
//   lowercase, like someone chatting (code, links, mentions, emoji and words
//   written in capitals on purpose are left alone)
//   no em or en dashes and no semicolons (nobody types those in chat)
//   at most one custom emoji
//   "#bug-reports" becomes a real channel link, @everyone/@here and user
//   mentions are dropped, and links only go to places Grove trusts
// It also removes the bits a model sometimes leaks: <think> blocks, a
// "grove:" label in front, quotes around the whole reply.

import type { ChannelInfo } from "./types.ts";

export const SKIP = "[skip]";

const TRUSTED_HOSTS = [
  "0vergrown.github.io", "github.com", "modrinth.com", "curseforge.com", "jsonchecker.com", "minecraft.wiki",
  "fabricmc.net", "neoforged.net", "ollama.com", "discord.com",
];

const PROTECTED = /```[\s\S]*?(```|$)|`[^`\n]*`|<a?:\w+:\d+>|<[@#][!&]?\d+>|https?:\/\/[^\s<>()]+|:D\b|\bXD\b|\bxD\b|\bD:|:P\b|\bOwO\b|\bUwU\b|\b[A-Z]{2,}\b/g;
const CUSTOM_EMOJI = /<a?:\w+:\d+>/g;

export interface VoiceOptions {
  channels: readonly ChannelInfo[];
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

function stripLeaks(raw: string): string {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*<\/think>/i, "").trim();
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
  let body = stripLeaks(raw).replace(PROTECTED, match => {
    let keep = match;
    if (/^https?:\/\//.test(match) && !trustedLink(match)) keep = "";
    if (/^<@!?\d+>$|^<@&\d+>$/.test(match)) keep = "";
    kept.push(keep);
    return `\u0000${kept.length - 1}\u0000`;
  });

  body = body
    .toLowerCase()
    .replace(/@(everyone|here)\b/g, "$1")
    .replace(/[ \t]*[—–][ \t]*/g, ", ")
    .replace(/[ \t]+--[ \t]+/g, ", ")
    .replace(/;/g, ".")
    .replace(/…/g, "...")
    .replace(/,[ \t]*,/g, ",")
    .replace(/,[ \t]*([.!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  for (const channel of options.channels) {
    const name = channel.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    body = body.replace(new RegExp(`(^|[^\\w<])#${name}(?![\\w-])`, "g"), `$1<#${channel.id}>`);
  }

  let emoji = 0;
  body = body
    .replace(/\u0000(\d+)\u0000/g, (_, index: string) => kept[Number(index)] ?? "")
    .replace(CUSTOM_EMOJI, match => (++emoji > 1 ? "" : match))
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (body.length === 0) return null;
  return fit(body, options.maxLength ?? 1_900);
}
