import { ChannelType, type Client, type Message, type ThreadChannel } from "discord.js";
import { CHANNELS } from "../config.ts";
import type { ModmailLinks } from "../db/threadLinks.ts";
import { logger } from "../logger.ts";

const log = logger("modmail");

// DMs to Grove become a private thread in the modmail forum, and staff replies
// in that thread are sent back to the person. Grove is the go-between.
export class Modmail {
  private readonly client: Client;
  private readonly links: ModmailLinks;

  constructor(client: Client, links: ModmailLinks) {
    this.client = client;
    this.links = links;
  }

  isModmailThread(message: Message): boolean {
    return message.channel.isThread() && message.channel.parentId === CHANNELS.modmail;
  }

  // Someone DMed Grove.
  async fromUser(message: Message): Promise<void> {
    try {
      const thread = await this.threadFor(message);
      if (thread === null) return;

      let forwarded = `📨 **${message.author.tag}:**\n${message.content || "*No text content*"}`;
      if (message.attachments.size > 0) forwarded += `\n\n${message.attachments.map(attachment => attachment.url).join("\n")}`;

      await thread.send({ content: forwarded.slice(0, 2000), allowedMentions: { parse: [] } });
      await message.reply("📬 your message has been sent to the staff team!");
    } catch (error) {
      log.error("could not forward a DM", error);
      await message.reply("❌ i couldn't send your modmail message, sorry! please try again in a bit.").catch(() => undefined);
    }
  }

  // Staff wrote in a modmail thread.
  async fromStaff(message: Message): Promise<void> {
    const userId = this.links.userOf(message.channelId);
    if (userId === undefined) return;

    try {
      const user = await this.client.users.fetch(userId);
      let reply = `🛡️ **Staff:**\n${message.content || "*No text content*"}`;
      if (message.attachments.size > 0) reply += `\n\n${message.attachments.map(attachment => attachment.url).join("\n")}`;
      await user.send(reply.slice(0, 2000));
    } catch (error) {
      log.error("could not DM a staff reply", error);
      await message.reply("❌ I couldn't DM this user.").catch(() => undefined);
    }
  }

  async close(message: Message): Promise<void> {
    const thread = message.channel;
    if (!thread.isThread() || thread.parentId !== CHANNELS.modmail) {
      await message.reply("❌ This command only works inside a Modmail post.");
      return;
    }
    const userId = this.links.userOf(thread.id);
    if (userId === undefined) {
      await message.reply("❌ I couldn't find the user attached to this Modmail conversation.");
      return;
    }

    try {
      const user = await this.client.users.fetch(userId).catch(() => null);
      await user?.send("📪 Your Modmail conversation has been closed by the staff team.").catch(() => undefined);
      this.links.close(userId);
      await message.reply("📪 Modmail conversation closed.");

      const reason = `Modmail closed by ${message.author.tag}`;
      if (thread.name.startsWith("[OPEN] ")) await thread.setName(thread.name.replace("[OPEN] ", "[CLOSED] "), reason);
      await thread.setLocked(true, reason);
      await thread.setArchived(true, reason);
    } catch (error) {
      log.error("could not close modmail", error);
      await message.reply("❌ I couldn't close this Modmail conversation.").catch(() => undefined);
    }
  }

  private async threadFor(message: Message): Promise<ThreadChannel | null> {
    const existingId = this.links.threadOf(message.author.id);
    if (existingId !== undefined) {
      const existing = await this.client.channels.fetch(existingId).catch(() => null);
      if (existing !== null && existing.isThread()) return existing;
    }

    const forum = await this.client.channels.fetch(CHANNELS.modmail).catch(() => null);
    if (forum === null || forum.type !== ChannelType.GuildForum) {
      log.error("the modmail forum was not found");
      return null;
    }

    const safeName = message.author.username.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 70);
    const thread = await forum.threads.create({
      name: `[OPEN] ${safeName}`,
      message: {
        content:
          `📬 **New Modmail Conversation**\n` +
          `**User:** <@${message.author.id}>\n` +
          `**Username:** ${message.author.tag}\n` +
          `**User ID:** \`${message.author.id}\`\n\n` +
          `Reply normally in this thread to message the user.`,
        allowedMentions: { parse: [] },
      },
    });
    this.links.open(message.author.id, thread.id);
    return thread;
  }
}
