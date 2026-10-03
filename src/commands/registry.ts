import type { Message } from "discord.js";
import { COMMAND_PREFIX, EMOJI } from "../config.ts";
import { isStaff } from "../discord/members.ts";
import { logger } from "../logger.ts";
import type { Command, Services } from "./command.ts";
import { INFO_COMMANDS } from "./info.ts";
import { SILLY_COMMANDS } from "./silly.ts";
import { STAFF_COMMANDS } from "./staff.ts";
import { TOOL_COMMANDS } from "./tools.ts";

const log = logger("commands");

const help: Command = {
  name: "help",
  description: "Shows this list",
  hidden: true,
  run: ({ message, services }) => message.reply({ content: helpText(services).slice(0, 2000), allowedMentions: { parse: [] } }),
};

const COMMANDS: readonly Command[] = [help, ...INFO_COMMANDS, ...TOOL_COMMANDS, ...STAFF_COMMANDS, ...SILLY_COMMANDS];

const BY_NAME = new Map<string, Command>();
for (const command of COMMANDS) {
  for (const name of [command.name, ...(command.aliases ?? [])]) {
    if (BY_NAME.has(name)) throw new Error(`two commands claim the name !${name}`);
    BY_NAME.set(name, command);
  }
}

function label(command: Command): string {
  if (command.usage !== undefined) return `\`${command.usage}\``;
  return [command.name, ...(command.aliases ?? [])].map(name => `\`${COMMAND_PREFIX}${name}\``).join(" / ");
}

// The !help list. Grove also sends it when someone asks what commands it has.
export function helpText(services: Services): string {
  const everyone = COMMANDS.filter(command => !command.hidden && !command.staffOnly);
  const staff = COMMANDS.filter(command => !command.hidden && command.staffOnly);
  const custom = services.customCommands.all();

  const lines = [
    `${EMOJI.grove} **List of Commands:**`,
    "",
    ...everyone.map(command => `- ${label(command)}: ${command.description}`),
    ...custom.map(command => `- \`${command.cmd}\`: ${command.help}`),
    "",
    "🌱 **Not a command?** Say my name, mention me, or reply to one of my messages and we can chat! Bugs, datapacks, addons, jams, the mods, or just how my day is going are all fair game.",
    "",
    "🔒 **Contributor / Staff Commands**",
    ...staff.map(command => `- ${label(command)}: ${command.description}`),
  ];
  return lines.join("\n");
}

// Parses "!name rest" and runs the matching command. Returns true when the
// message was a command (known or not), so the chat brain leaves it alone.
export async function runCommand(message: Message, services: Services): Promise<boolean> {
  const content = message.content.trim();
  if (!content.startsWith(COMMAND_PREFIX)) return false;

  const match = /^!([a-z0-9_-]+)(?:\s+([\s\S]*))?$/i.exec(content);
  if (match === null) return true;
  const name = match[1]!.toLowerCase();
  const args = (match[2] ?? "").trim();

  const command = BY_NAME.get(name);
  try {
    if (command !== undefined) {
      if (command.staffOnly && !isStaff(message.member)) {
        if (command.denied !== undefined) await message.reply(command.denied);
        return true;
      }
      await command.run({ message, args, services });
      return true;
    }

    const custom = services.customCommands.get(`${COMMAND_PREFIX}${name}`);
    if (custom !== undefined) {
      // Staff wrote these outputs, so their mentions work like a person typed them.
      await message.reply({ content: custom.out, allowedMentions: { parse: ["users", "roles", "everyone"] } });
    }
  } catch (error) {
    log.error(`!${name} failed`, error);
  }
  return true;
}
