import type { Command } from "./command.ts";

export const TOOL_COMMANDS: readonly Command[] = [
  {
    name: "ping",
    description: "Checks that I'm awake",
    hidden: true,
    run: ({ message }) => message.reply("pong!"),
  },
  {
    name: "format",
    description: "Reply to a message containing JSON to format it",
    run: async ({ message }) => {
      const targetId = message.reference?.messageId;
      if (targetId === undefined) return message.reply("❌ Reply to a message containing JSON, then use !format.");

      const target = await message.channel.messages.fetch(targetId).catch(() => null);
      if (target === null) return message.reply("❌ I couldn't find that message.");

      let content = target.content.trim();
      if (content.startsWith("```") && content.endsWith("```")) {
        content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      }

      let formatted: string;
      try {
        formatted = JSON.stringify(JSON.parse(content), null, 2);
      } catch {
        return message.reply("❌ That message does not contain valid JSON.");
      }
      if (formatted.length > 1900) return message.reply("❌ The formatted JSON is too long to send in one Discord message.");
      return message.reply(`\`\`\`json\n${formatted}\n\`\`\``);
    },
  },
  {
    name: "escape",
    usage: "!escape [command]",
    description: "Escapes a Minecraft command for use inside a JSON string",
    run: ({ message, args }) => {
      if (args.length === 0) return message.reply("❌ Put a command after `!escape`.");
      const escaped = args.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      if (escaped.length > 1900) return message.reply("❌ The escaped command is too long to send in one Discord message.");
      return message.reply(`\`\`\`\n${escaped}\n\`\`\``);
    },
  },
];
