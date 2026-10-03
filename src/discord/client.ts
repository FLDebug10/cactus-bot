import { Client, GatewayIntentBits, Partials } from "discord.js";

export function createClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    // DM channels arrive uncached; without this the first DM of a session is dropped.
    partials: [Partials.Channel],
    // Nothing Grove sends pings anyone unless a feature asks for it explicitly.
    allowedMentions: { parse: [], repliedUser: false },
  });
}
