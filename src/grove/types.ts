// Shapes Grove's brain works with. Nothing in src/grove imports discord.js:
// the Discord adapter (src/features/chat.ts) turns messages into these, which
// keeps the brain runnable from tests and from `npm run chat`.

// One message as Grove remembers it, already turned into plain text: mentions
// read as "@name", channels as "#name", custom emoji as ":name:".
export interface ChatLine {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  isGrove: boolean;
  isBot: boolean;
  content: string;
  at: number;
  replyToId: string | null;
}

// Why Grove thinks a message is for it.
//   direct    it was @mentioned, or someone replied to one of its messages
//   named     its name is in the message ("hey grove", "grove, how do i...")
//   followup  no name, but the person was talking with Grove a moment ago
export type Addressing = "direct" | "named" | "followup";

export interface Speaker {
  id: string;
  name: string;
  // "drizzo", "fld10" or "overgrown" when one of Grove's makers is talking.
  crew: string | null;
  staff: boolean;
}

// A channel Grove can point people to, by the name people see.
export interface ChannelInfo {
  key: string;
  id: string;
  name: string;
  purpose: string;
}

// A file someone attached, already read as text (logs, json, mcfunction...).
export interface TextAttachment {
  name: string;
  text: string;
}
