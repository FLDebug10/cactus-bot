import { type Message, MessageReferenceType } from "discord.js";
import type { ChatMessage } from "../brain/types.ts";

// The brain only ever sees this neutral shape, never a discord.js object.
export function toChatMessage(message: Message, groveId: string | null): ChatMessage {
  const channel = message.channel;
  const isReply = message.reference !== null && message.reference.type !== MessageReferenceType.Forward;
  const repliedUserId = isReply ? message.mentions.repliedUser?.id ?? null : null;
  const written = groveId !== null ? new RegExp(`<@!?${groveId}>`) : null;

  return {
    id: message.id,
    channelId: message.channelId,
    parentId: channel.isThread() ? channel.parentId : null,
    authorId: message.author.id,
    authorName: message.member?.displayName ?? message.author.globalName ?? message.author.username,
    authorIsBot: message.author.bot || message.webhookId !== null || message.system,
    content: message.content,
    createdAt: message.createdTimestamp,
    replyToId: isReply ? message.reference?.messageId ?? null : null,
    replyToAuthorId: repliedUserId,
    // Written out in the text. A reply ping on its own is a reply, not a mention.
    mentionsGrove: written !== null && written.test(message.content),
    mentionedUserIds: [...message.mentions.users.keys()].filter(id => id !== groveId && id !== repliedUserId),
    hasMedia: message.attachments.size > 0 || message.stickers.size > 0,
  };
}
