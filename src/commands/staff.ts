import { ChannelType, type Message } from "discord.js";
import { CHANNELS, FORUM_TAGS } from "../config.ts";
import { logger } from "../logger.ts";
import type { Command } from "./command.ts";

const log = logger("staff");

function forumPost(message: Message) {
  const thread = message.channel;
  if (!thread.isThread() || thread.parent === null || thread.parent.type !== ChannelType.GuildForum) return null;
  return thread;
}

export const STAFF_COMMANDS: readonly Command[] = [
  {
    name: "say",
    usage: "!say [text]",
    description: "Makes me say something (reply to a message to answer it)",
    staffOnly: true,
    run: async ({ message, args }) => {
      if (args.length === 0) return;
      // Staff-written, so mentions behave like a person typed them.
      const allowedMentions = { parse: ["users", "roles", "everyone"] as ("users" | "roles" | "everyone")[] };
      const targetId = message.reference?.messageId;
      const target = targetId !== undefined ? await message.channel.messages.fetch(targetId).catch(() => null) : null;
      if (target !== null) await target.reply({ content: args, allowedMentions });
      else if (message.channel.isSendable()) await message.channel.send({ content: args, allowedMentions });
      await message.delete().catch(() => undefined);
    },
  },
  {
    name: "claim",
    description: "Claims a suggestion post and marks it as being handled",
    staffOnly: true,
    denied: "❌ You do not have permission to claim posts.",
    run: async ({ message, services }) => {
      const thread = forumPost(message);
      if (thread === null) return message.reply("❌ This command can only be used inside a forum post.");

      const claimant = services.claims.claimant(thread.id);
      if (claimant !== undefined) return message.reply({ content: `❌ This post is already claimed by <@${claimant}>.` });

      try {
        const tags = thread.appliedTags.filter(tag => tag !== FORUM_TAGS.pendingReview);
        if (!tags.includes(FORUM_TAGS.claimed)) tags.push(FORUM_TAGS.claimed);
        await thread.setAppliedTags(tags, `Claimed by ${message.author.tag}`);
        if (!thread.name.startsWith("[CLAIMED] ")) await thread.setName(`[CLAIMED] ${thread.name}`, `Claimed by ${message.author.tag}`);
        services.claims.claim(thread.id, message.author.id);
        return message.reply(`🛠️ This post has been claimed by <@${message.author.id}>.`);
      } catch (error) {
        log.error("could not claim a forum post", error);
        return message.reply("❌ I couldn't claim this forum post.");
      }
    },
  },
  {
    name: "close",
    description: `Closes a <#${CHANNELS.suggestions}> post, locks it and marks it closed`,
    staffOnly: true,
    denied: "❌ You do not have permission to close forum posts.",
    run: async ({ message, services }) => {
      const thread = forumPost(message);
      if (thread === null) return message.reply("❌ This command can only be used inside a forum post.");

      try {
        const reason = `Closed by ${message.author.tag}`;
        const tags = thread.appliedTags.filter(tag => tag !== FORUM_TAGS.pendingReview && tag !== FORUM_TAGS.claimed);
        if (!tags.includes(FORUM_TAGS.closed)) tags.push(FORUM_TAGS.closed);
        await thread.setAppliedTags(tags, reason);
        if (thread.name.startsWith("[CLAIMED] ")) await thread.setName(thread.name.replace("[CLAIMED] ", ""), reason);
        services.claims.release(thread.id);
        await message.reply("🔒 This post has been closed.");
        await thread.setLocked(true, reason);
        await thread.setArchived(true, reason);
        log.info(`${message.author.tag} closed forum post: ${thread.name}`);
      } catch (error) {
        log.error("could not close a forum post", error);
        await message.reply("❌ I couldn't close this forum post. Check my permissions and the forum tags.").catch(() => undefined);
      }
    },
  },
  {
    name: "closemail",
    description: "Closes the current Modmail conversation",
    staffOnly: true,
    run: ({ message, services }) => services.modmail.close(message),
  },
  {
    name: "hush",
    usage: "!hush [minutes]",
    description: "Keeps me quiet in this channel for a while (default 30 minutes). I still answer @mentions",
    staffOnly: true,
    run: ({ message, args, services }) => {
      const minutes = Math.min(24 * 60, Math.max(1, Number.parseInt(args, 10) || 30));
      services.grove.hush(message.channelId, minutes);
      return message.reply(`okay! i'll stay quiet in here for ${minutes} minute${minutes === 1 ? "" : "s"} 🤐`);
    },
  },
  {
    name: "unhush",
    description: "Lets me chat in this channel again",
    staffOnly: true,
    run: ({ message, services }) => {
      services.grove.hush(message.channelId, 0);
      return message.reply("yay, i can talk again!");
    },
  },
  {
    name: "misses",
    description: "Lists recent things people said to me that I didn't understand",
    staffOnly: true,
    run: ({ message, services }) => {
      const misses = services.grove.misses(10);
      if (misses.length === 0) return message.reply("i understood everything lately! (or nobody talked to me)");
      const lines = misses.map(miss => `<t:${Math.floor(miss.at / 1000)}:R> ${miss.text.replace(/<@[!&]?\d+>/g, "@…").replace(/\s+/g, " ").slice(0, 150)}`);
      return message.reply({ content: `**Things i didn't understand**\n${lines.join("\n")}`.slice(0, 2000), allowedMentions: { parse: [] } });
    },
  },
];
