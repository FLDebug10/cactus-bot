import { type Attachment, type Embed, type Message, MessageType } from "discord.js";
import { CHANNELS } from "../config.ts";
import { canManageMessages, isStaff } from "../discord/members.ts";
import { logger } from "../logger.ts";

const log = logger("media-gallery");

const MEDIA_FILE = /\.(png|jpe?g|gif|webp|bmp|avif|heic|tiff?|mp4|mov|webm|mkv|avi|m4v)(\?|$)/i;
// Reaction GIFs are chatter, not something you made.
const REACTION_GIF_HOST = /(^|\.)(tenor\.com|giphy\.com)$/i;
// Discord builds link previews a moment after the message arrives.
const PREVIEW_WAIT_MS = 3_500;
const NOTICE_LIFETIME_MS = 20_000;
const NOTICE_COOLDOWN_MS = 2 * 60_000;

export function attachmentIsMedia(attachment: Pick<Attachment, "contentType" | "name" | "url">): boolean {
  const type = attachment.contentType ?? "";
  if (type.startsWith("image/") || type.startsWith("video/")) return true;
  return MEDIA_FILE.test(attachment.name ?? "") || MEDIA_FILE.test(attachment.url);
}

export function embedIsMedia(embed: Pick<Embed, "url" | "image" | "video" | "thumbnail">): boolean {
  if (embed.url !== null) {
    try {
      if (REACTION_GIF_HOST.test(new URL(embed.url).hostname)) return false;
    } catch {
      return false;
    }
  }
  return embed.image !== null || embed.video !== null || embed.thumbnail !== null;
}

function showsMedia(message: Message): boolean {
  return message.attachments.some(attachmentIsMedia) || message.embeds.some(embedIsMedia);
}

// The media gallery is a no-talk zone: posts are screenshots and videos, and
// conversations happen in threads on those posts. Text-only messages are
// removed, the author gets a copy of what they wrote, and a short note explains why.
export class MediaGallery {
  private readonly lastNotice = new Map<string, number>();

  async check(message: Message): Promise<boolean> {
    if (message.channelId !== CHANNELS.mediaGallery) return false;
    if (message.author.bot || message.webhookId !== null || message.system) return false;
    if (message.type !== MessageType.Default && message.type !== MessageType.Reply) return false;
    if (isStaff(message.member) || canManageMessages(message.member)) return false;
    if (showsMedia(message)) return false;

    if (/https?:\/\//i.test(message.content)) {
      await sleep(PREVIEW_WAIT_MS);
      const fresh = await message.fetch().catch(() => null);
      if (fresh === null) return true;
      if (showsMedia(fresh)) return false;
    }

    try {
      await message.delete();
    } catch (error) {
      log.warn("could not remove a text post from the media gallery (missing Manage Messages?)", error);
      return false;
    }

    const saved = await this.sendCopy(message);
    await this.explain(message, saved);
    return true;
  }

  private async sendCopy(message: Message): Promise<boolean> {
    const text = message.content.trim();
    if (text.length === 0) return false;
    const quoted = text.slice(0, 1700).split("\n").map(line => `> ${line}`).join("\n");
    try {
      await message.author.send(
        `hi! i took your message out of the media gallery, since that channel is only for pictures and videos. ` +
        `if you wanted to talk about a post, start a thread on it! here's what you wrote, so you don't lose it:\n${quoted}`,
      );
      return true;
    } catch {
      return false;
    }
  }

  private async explain(message: Message, saved: boolean): Promise<void> {
    const now = Date.now();
    if (now - (this.lastNotice.get(message.author.id) ?? 0) < NOTICE_COOLDOWN_MS) return;
    this.lastNotice.set(message.author.id, now);
    if (!message.channel.isSendable()) return;

    try {
      const notice = await message.channel.send({
        content:
          `hey <@${message.author.id}>! the media gallery is only for pictures and videos 📸 ` +
          `if you want to talk about a post, start a thread on it 💬${saved ? " (i sent you a copy of your message)" : ""}`,
        allowedMentions: { users: [message.author.id] },
      });
      setTimeout(() => {
        notice.delete().catch(() => undefined);
      }, NOTICE_LIFETIME_MS).unref?.();
    } catch (error) {
      log.warn("could not post the media gallery notice", error);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
