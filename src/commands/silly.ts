import type { Message } from "discord.js";
import { logger } from "../logger.ts";
import type { Command } from "./command.ts";

const log = logger("silly");

async function protectedUser(message: Message, who: string): Promise<unknown> {
  if (!message.inGuild() || message.member === null) return message.reply("❌ This command can only be used inside the server.");
  await message.member.timeout(90_000, `Attempted to kill ${who}`).catch(error => log.warn(`could not time out ${message.author.tag}`, error));
  return message.reply(`${who} is a protected user. You CANNOT kill them. You are now muted for eternity.`);
}

export const SILLY_COMMANDS: readonly Command[] = [
  { name: "killdrizzo", description: "Don't.", hidden: true, run: ({ message }) => protectedUser(message, "Drizzo") },
  { name: "killfld", aliases: ["killfld10"], description: "Don't.", hidden: true, run: ({ message }) => protectedUser(message, "FLD10") },
];
