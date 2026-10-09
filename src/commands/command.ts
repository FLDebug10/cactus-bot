import type { Client, Message, MessageReplyOptions } from "discord.js";
import type { CustomCommandStore } from "../db/customCommands.ts";
import type { ModmailLinks, SuggestionClaims } from "../db/threadLinks.ts";
import type { GroveChat } from "../features/chat.ts";
import type { Modmail } from "../features/modmail.ts";
import type { BrainChain } from "../grove/brain.ts";
import type { KnowledgeStore } from "../grove/knowledge/store.ts";
import type { KnowledgeSync } from "../grove/knowledge/sync.ts";

export interface Services {
  client: Client;
  customCommands: CustomCommandStore;
  claims: SuggestionClaims;
  modmailLinks: ModmailLinks;
  modmail: Modmail;
  chat: GroveChat;
  brain: BrainChain;
  knowledge: KnowledgeStore | null;
  knowledgeSync: KnowledgeSync | null;
}

export interface CommandContext {
  message: Message;
  // Everything after the command name.
  args: string;
  services: Services;
}

export interface Command {
  name: string;
  aliases?: readonly string[];
  usage?: string;
  description: string;
  staffOnly?: boolean;
  // Told to non-staff who try a staff command. Without it they are ignored.
  denied?: string;
  // Left out of !help.
  hidden?: boolean;
  run(context: CommandContext): Promise<unknown>;
}

// Redirect-style commands answer the person who needs it: when staff use a
// command as a reply to someone's message, Grove replies to that message.
export async function answer(context: CommandContext, payload: string | MessageReplyOptions): Promise<void> {
  const { message } = context;
  const options: MessageReplyOptions = typeof payload === "string" ? { content: payload } : payload;
  const targetId = message.reference?.messageId;
  if (targetId !== undefined) {
    const target = await message.channel.messages.fetch(targetId).catch(() => null);
    if (target !== null) {
      await target.reply({ ...options, allowedMentions: { parse: [], repliedUser: true }, failIfNotExists: false });
      return;
    }
  }
  await message.reply({ ...options, failIfNotExists: false });
}
