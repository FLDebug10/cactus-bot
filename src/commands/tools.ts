import type { Command } from "./command.ts";
import { ChannelType } from "discord.js";

const BUG_REPORT_FORUM_ID = "1533408856682663956";

const REPORT_TAG_IDS = {
  apoli: "1536514203924434984",
  origins: "1536514187767976056",
  wiki: "1536514156771942562",
};

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
      if (targetId === undefined) {
        return message.reply(
          "❌ Reply to a message containing JSON, then use !format."
        );
      }

      const target = await message.channel.messages
        .fetch(targetId)
        .catch(() => null);

      if (target === null) {
        return message.reply("❌ I couldn't find that message.");
      }

      let content = target.content.trim();

      if (content.startsWith("```") && content.endsWith("```")) {
        content = content
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/, "")
          .trim();
      }

      let formatted: string;

      try {
        formatted = JSON.stringify(JSON.parse(content), null, 2);
      } catch {
        return message.reply(
          "❌ That message does not contain valid JSON."
        );
      }

      if (formatted.length > 1900) {
        return message.reply(
          "❌ The formatted JSON is too long to send in one Discord message."
        );
      }

      return message.reply(
        `\`\`\`json\n${formatted}\n\`\`\``
      );
    },
  },
  {
    name: "escape",
    usage: "!escape [command]",
    description: "Escapes a Minecraft command for use inside a JSON string",
    run: ({ message, args }) => {
      if (args.length === 0) {
        return message.reply(
          "❌ Put a command after `!escape`."
        );
      }

      const escaped = args
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');

      if (escaped.length > 1900) {
        return message.reply(
          "❌ The escaped command is too long to send in one Discord message."
        );
      }

      return message.reply(
        `\`\`\`\n${escaped}\n\`\`\``
      );
    },
  },
  {
    name: "report",
    usage: "!report [Thread name] [Message] [Apoli/Origins/Wiki] [Image link if needed]",
    description: "Creates a bug report",
    run: async ({ message, args }) => {
      const match = args.match(
        /^\[(.+?)\]\s+\[(.+?)\]\s+\[(Apoli|Origins|Wiki)\](?:\s+\[(.+?)\])?$/i
      );

      if (match === null) {
        return message.reply(
          "❌ Use: `!report [Thread name] [Message] [Apoli/Origins/Wiki] [Image link if needed]`"
        );
      }

      const threadName = match[1].trim();
      const reportMessage = match[2].trim();
      const tag = match[3].toLowerCase() as keyof typeof REPORT_TAG_IDS;
      const imageLink = match[4]?.trim();

      if (threadName.length > 100) {
        return message.reply(
          "❌ The thread name must be 100 characters or fewer."
        );
      }

      const selectedTagId = REPORT_TAG_IDS[tag];

      const forum = await message.client.channels
        .fetch(BUG_REPORT_FORUM_ID)
        .catch(() => null);

      if (forum === null || forum.type !== ChannelType.GuildForum) {
        return message.reply(
          "❌ I couldn't find the bug report forum."
        );
      }

      try {
        let content =
          `🐛 **Bug Report**\n\n` +
          `**Reported by:** ${message.author}\n\n` +
          `**Description:**\n${reportMessage}`;

        if (imageLink !== undefined) {
          content += `\n\n**Image:**\n${imageLink}`;
        }

        const thread = await forum.threads.create({
          name: threadName,
          appliedTags: [selectedTagId],
          message: {
            content,
          },
        });

        return message.reply(
          `✅ Bug report created: ${thread}`
        );
      } catch (error) {
        console.error(
          "Error creating bug report:",
          error
        );

        return message.reply(
          "❌ I couldn't create the bug report."
        );
      }
    },
  },
];
