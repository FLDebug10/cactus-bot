import { config } from "dotenv";
import { data, getSuggestions, getModMail, getCommands } from "./db.ts";
import type { Command } from "./db.ts";
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  Partials,
  ActivityType,
  Message,
  Routes,
  REST,
  SlashCommandBuilder,
  SlashCommandStringOption,
  type Interaction,
  PermissionFlagsBits
} from "discord.js";
import { badgesCommand, barsCommand, claimCommand, closeCommand, closeMailCommand, compCommand, escapeCommand, formatCommand, handbookCommand, helpCommand, killDrizzoCommand, killFLDCommand, mediaCommand, parserCommand, rbrCommand, rdsCommand, registerModal, registerSlashCommand } from "./commands.ts"

config()

const TOKEN = process.env.TOKEN;

if (TOKEN == null) {
  console.error("Didn't find token!")
  process.exit(1);
}

export const DATABASE = await data();

export const CLOSED_TAG_ID = "1553708235582869604";
export const CLAIMED_TAG_ID = "1553708304860057620";
export const PENDING_REVIEW_TAG_ID = "1553812865071186000";

export const SUGGESTIONS_FORUM_ID = "1533408806833229834";
export const MODMAIL_FORUM_ID = "1554472572647768064";

export const ALLOWED_ROLE_IDS = [
  "1531431940178317385",
  "1547964808912048299",
  "1548817360247332874",
  "1554994395449917581",
  "1547961618980274226"
];

const EMOJIS = [
  "<:grove:1554976275729223740>",
  "<:grove_orb:1555207821291683950>"
]

const REPLYS = [
  "yeah?",
  "hello!",
  "yup, thats me!",
  "need something?"
]


const claimedPosts = new Map<string, string>();

const modmailUsers = new Map<string, string>();

const modmailThreads = new Map<string, string>();

const commands = new Map<string, Command>();
let cmdArray: Command[] = []

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],

  partials: [
    Partials.Channel,
  ],
});

async function deployCommands() {
  const rest = new REST({ version: '10' })
    .setToken(TOKEN!!);

  await rest.put(
    Routes.applicationCommands(client.user?.id!!),
    { body: [(new SlashCommandBuilder().setName("register").addStringOption(new SlashCommandStringOption().setRequired(false).setDescription("Name of the Command, excluding \`!\`: \`example\` results in !example").setName("command").setMinLength(2).setMaxLength(32)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)).toJSON()] }
  );

  console.log('Registered Slash Commands');
}


client.once("clientReady", async () => {
  let sug = await getSuggestions(DATABASE)
  let modMail = await getModMail(DATABASE)
  cmdArray = await getCommands(DATABASE)

  for (let thread of sug) {
    claimedPosts.set(thread.thread, thread.user)
  }

  for (let thread of modMail) {
    modmailThreads.set(thread.thread, thread.user)
    modmailUsers.set(thread.user, thread.thread)
  }

  for (let cmd of cmdArray) {
    commands.set(cmd.cmd, cmd)
  }

  client.user?.setActivity("Overgrown's Origins", {
    type: ActivityType.Playing,
  });

  await deployCommands()

  console.log(`Bot online as ${client.user?.tag}`);
});

// automatically tag new suggestion posts

client.on("threadCreate", async (thread: any) => {
  if (thread.parentId !== SUGGESTIONS_FORUM_ID) return;

  try {
    const tags = [...thread.appliedTags];

    if (!tags.includes(PENDING_REVIEW_TAG_ID)) {
      tags.push(PENDING_REVIEW_TAG_ID);
    }

    await thread.setAppliedTags(
      tags,
      "Automatically applied Pending Review tag"
    );

    console.log(
      `Applied Pending Review tag to: ${thread.name}`
    );

  } catch (error) {
    console.error(
      `Failed to automatically tag ${thread.name}:`,
      error
    );
  }
});

client.on("interactionCreate", async (interaction: Interaction) => {
  if (interaction.isChatInputCommand()) {
    await registerSlashCommand(interaction)
  }

  if (interaction.isModalSubmit()) {
    await registerModal(interaction, commands, DATABASE, cmdArray)
  }
})

client.on("messageCreate", async (message: Message) => {
  if (message.author.bot) return;


  // MODMAIL — USER DMS BOT

  if (message.channel.type === ChannelType.DM) {
    try {
      const forum = await client.channels.fetch(MODMAIL_FORUM_ID);

      if (!forum || forum.type !== ChannelType.GuildForum) {
        console.error("Modmail forum was not found.");
        return;
      }

      let threadId = modmailUsers.get(message.author.id);
      let thread: any = null;

      if (threadId) {
        try {
          thread = await client.channels.fetch(threadId);
        } catch {
          thread = null;
        }
      }

      if (!thread) {
        const safeName = message.author.username
          .replace(/[^a-zA-Z0-9-_]/g, "-")
          .slice(0, 70);

        thread = await forum.threads.create({
          name: `[OPEN] ${safeName}`,
          message: {
            content:
              `📬 **New Modmail Conversation**\n` +
              `**User:** ${message.author}\n` +
              `**Username:** ${message.author.tag}\n` +
              `**User ID:** \`${message.author.id}\`\n\n` +
              `Reply normally in this thread to message the user.`
          }
        });

        try {
          DATABASE.prepare(`
            INSERT INTO modMail (thread, user) VALUES (?, ?)
          `).run(thread.id, message.author.id)

          modmailUsers.set(
            message.author.id,
            thread.id
          );

          modmailThreads.set(
            thread.id,
            message.author.id
          );
        } catch (error) {
          console.error(error)
        }
      }

      let forwardedMessage =
        `📨 **${message.author.tag}:**\n${message.content || "*No text content*"}`;

      if (message.attachments.size > 0) {
        forwardedMessage +=
          "\n\n" +
          message.attachments
            .map((attachment: any) => attachment.url)
            .join("\n");
      }

      await thread.send(forwardedMessage);

      await message.reply(
        "📬 Your message has been sent to the staff team."
      );

    } catch (error) {
      console.error(
        "Modmail DM error:",
        error
      );

      try {
        await message.reply(
          "❌ I couldn't send your Modmail message."
        );
      } catch {}
    }

    return;
  }


  // MODMAIL — STAFF REPLY

  if (
    message.channel.isThread() &&
    message.channel.parentId === MODMAIL_FORUM_ID
  ) {
    const command = message.content
      .trim()
      .toLowerCase();

    if (command === "!closemail") {
      return closeMailCommand(message, modmailThreads, modmailUsers);
    }

    const userId = modmailThreads.get(message.channel.id);

    if (!userId) {
      return;
    }

    try {
      const user = await client.users.fetch(userId);

      let reply =
        `🛡️ **Staff:**\n${message.content || "*No text content*"}`;

      if (message.attachments.size > 0) {
        reply +=
          "\n\n" +
          message.attachments
            .map((attachment: any) => attachment.url)
            .join("\n");
      }

      await user.send(reply);

    } catch (error) {
      console.error(
        "Failed to send staff Modmail reply:",
        error
      );

      await message.reply(
        "❌ I couldn't DM this user."
      );
    }

    return;
  }


  // NORMAL COMMANDS

  const command = message.content
    .trim()
    .toLowerCase();

  const groveRegex = /(?:^|\s)grove(?:\s|$)/i;

  if (groveRegex.test(message.content)) {
    try {
      const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      await message.react(emoji);
    } catch (error) {
      console.error("Error while reacting to message: ", error);
    }
  }

  if (client.user != null ? message.mentions.has(client.user.id) : false) {
    try {
      let reply = REPLYS[Math.floor(Math.random() * REPLYS.length)]
      await message.reply(reply)
    } catch (error) {
      console.error("Error while responding to message: ", error)
    }
  }

  if (command === "!bars") {
    return await barsCommand(message)
  }

  if (command === "!comp-rules") {
    return await compCommand(message)
  }

  if (command === "!rbr") {
    return await rbrCommand(message)
  }

  if (command === "!rds") {
    return await rdsCommand(message)
  }

  if (command === "!media") {
    return await mediaCommand(message)
  }

  if (command === "!parser") {
    return await parserCommand(message)
  }

  if (command === "!badges") {
    return await badgesCommand(message)
  }

  if (command === "!ping") {
    try {
      return await message.reply("pong!")
    } catch (error) {
      console.error("Error while responding to message: ", error)
    }
  }

  if (command === "!help") {
    return helpCommand(message, cmdArray);
  }

  if (command === "!handbook" || command === "!wiki") {
    return handbookCommand(message);
  }

  if (command === "!killdrizzo") {
    return killDrizzoCommand(message);
  }

  if (command === "!killfld" || command === "!killfld10") {
    return killFLDCommand(message)
  }

  if (command === "!format") {
    return formatCommand(message);
  }

  if (command === "!claim") {
    return claimCommand(message, claimedPosts);
  }

  if (command === "!close") {
    return closeCommand(message, claimedPosts);
  }

  if (command === "!escape" || command.startsWith("!escape ")) {
    return escapeCommand(message);
  }

  if (commands.has(command)) {
    var cmd = commands.get(command)!!
    
    return message.reply(cmd.out)
  }
});


client.login(TOKEN);
