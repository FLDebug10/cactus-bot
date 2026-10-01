import { config } from "dotenv";
import { data, getSuggestions, getModMail } from "./db.ts";
import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
  Partials,
  ActivityType,
  Message
} from "discord.js";
import Database from "better-sqlite3";

config()

const TOKEN = process.env.TOKEN;

const DATABASE = await data();

const CLOSED_TAG_ID = "1553708235582869604";
const CLAIMED_TAG_ID = "1553708304860057620";
const PENDING_REVIEW_TAG_ID = "1553812865071186000";

const SUGGESTIONS_FORUM_ID = "1533408806833229834";
const MODMAIL_FORUM_ID = "1554472572647768064";

const ALLOWED_ROLE_IDS = [
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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],

  partials: [
    Partials.Channel,
  ],
});


client.once("clientReady", async () => {
  let sug = await getSuggestions(DATABASE)
  let modMail = await getModMail(DATABASE)

  for (let thread of sug) {
    claimedPosts.set(thread.thread, thread.user)
  }

  for (let thread of modMail) {
    modmailThreads.set(thread.thread, thread.user)
    modmailUsers.set(thread.user, thread.thread)
  }

  client.user?.setActivity("Overgrown's Origins", {
    type: ActivityType.Playing,
  });

  console.log(`Bot online as ${client.user?.tag}`);
});


// help command

async function helpCommand(message: any) {
  return message.reply(
`<:grove:1554976275729223740> **List of Commands:**

- \`!rbr\` — Redirect Bug Reports
- \`!rds\` — Redirect Datapack Support
- \`!bars\` — Explains the new \`sprite_location\`
- \`!media\` — Explains media channel rules
- \`!parser\` — Drops a JSON validator link
- \`!format\` — Reply to a person's message containing JSON to format it correctly
- \`!escape [command]\` — Escapes a Minecraft command JSON string
- \`!badges\` — Sends an image showing how to use badges with an explanation
- \`!handbook\` / \`!wiki\` — Sends the Overgrown Handbook link
- \`!claim\` — Claims a suggestion post and marks it as being handled
- \`!close\` — Closes a <#1533408806833229834> post, locks it and adds the \`Implemented\` tag
- \`!closemail\` — Closes the current Modmail conversation

🔒 **Contributor / Staff Commands**
\`!claim\`, \`!close\`, and \`!closemail\` are restricted to Contributors and staff.`
  );
}


// handbook command

async function handbookCommand(message: {
  reply: (arg0: string) => any;
}) {
  await message.reply(
    "📘 **Overgrown Handbook**\nhttps://0vergrown.github.io/Handbook/docs/datapack/introduction/overview/"
  );
}


// format command

async function formatCommand(message: Message) {
  if (!message.reference?.messageId) {
    return message.reply(
      "❌ Reply to a message containing JSON, then use !format."
    );
  }

  try {
    const repliedMessage = await message.channel.messages.fetch(
      message.reference.messageId
    );

    let content = repliedMessage.content.trim();

    if (content.startsWith("```") && content.endsWith("```")) {
      content = content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
    }

    const parsed = JSON.parse(content);
    const formatted = JSON.stringify(parsed, null, 2);

    if (formatted.length > 1900) {
      return message.reply(
        "❌ The formatted JSON is too long to send in one Discord message."
      );
    }

    return message.reply(
      `\`\`\`json\n${formatted}\n\`\`\``
    );

  } catch (error) {
    return message.reply(
      "❌ That message does not contain valid JSON."
    );
  }
}


// escape command

async function escapeCommand(message: any) {
  const content = message.content.trim();

  const commandText = content.slice("!escape".length).trim();

  if (!commandText) {
    return message.reply(
      "❌ Put a command after `!escape`."
    );
  }

  const escaped = commandText
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
}


// kill Drizzo command

async function killDrizzoCommand(message: any) {
  if (!message.guild || !message.member) {
    return message.reply(
      "❌ This command can only be used inside the server."
    );
  }

  try {
    await message.member.timeout(
      90_000,
      "Attempted to kill Drizzo"
    );

    return message.reply(
      "Drizzo is a protected user. You CANNOT kill them. You are now muted for eternity."
    );

  } catch (error) {
    console.error(
      "Error timing out user for !killdrizzo:",
      error
    );

    return message.reply(
      "Drizzo is a protected user. You CANNOT kill them. You are now muted for eternity."
    );
  }
}

async function killFLDCommand(message: any) {
  if (!message.guild || !message.member) {
    return message.reply(
      "❌ This command can only be used inside the server."
    );
  }

  try {
    await message.member.timeout(
      90_000,
      "Attempted to kill FLD10"
    );

    return message.reply(
      "FLD10 is a protected user. You CANNOT kill them. You are now muted for eternity."
    );

  } catch (error) {
    console.error(
      "Error timing out user for !killfld:",
      error
    );

    return message.reply(
      "FLD10 is a protected user. You CANNOT kill them. You are now muted for eternity."
    );
  }
}

// claim command

async function claimCommand(message: any) {
  const hasAllowedRole = ALLOWED_ROLE_IDS.some(roleId =>
    message.member.roles.cache.has(roleId)
  );

  const isModerator = message.member.permissions.has(
    PermissionFlagsBits.ManageThreads
  );

  if (!isModerator && !hasAllowedRole) {
    return message.reply(
      "❌ You do not have permission to claim posts."
    );
  }

  const thread = message.channel;

  if (!thread.isThread()) {
    return message.reply(
      "❌ This command can only be used inside a forum post."
    );
  }

  if (!thread.parent || thread.parent.type !== ChannelType.GuildForum) {
    return message.reply(
      "❌ This command can only be used inside a forum post."
    );
  }

  if (claimedPosts.has(thread.id)) {
    const userId = claimedPosts.get(thread.id);

    return message.reply(
      `❌ This post is already claimed by <@${userId}>.`
    );
  }

  try {
    let tags = [...thread.appliedTags];

    tags = tags.filter(
      tagId => tagId !== PENDING_REVIEW_TAG_ID
    );

    if (!tags.includes(CLAIMED_TAG_ID)) {
      tags.push(CLAIMED_TAG_ID);
    }

    await thread.setAppliedTags(
      tags,
      `Claimed by ${message.author.tag}`
    );

    if (!thread.name.startsWith("[CLAIMED] ")) {
      await thread.setName(
        `[CLAIMED] ${thread.name}`,
        `Claimed by ${message.author.tag}`
      );
    }

    claimedPosts.set(
      thread.id,
      message.author.id
    );

    DATABASE.prepare(`
      INSERT INTO suggestions (thread, user) VALUES ('${thread.id}', '${message.author.id}')
    `).run()

    return message.reply(
      `🛠️ This post has been claimed by ${message.author}.`
    );

  } catch (error) {
    console.error(
      "Error claiming forum post:",
      error
    );

    return message.reply(
      "❌ I couldn't claim this forum post."
    );
  }
}


// close command

async function closeCommand(message: any) {
  const hasAllowedRole = ALLOWED_ROLE_IDS.some(roleId =>
    message.member.roles.cache.has(roleId)
  );

  const isModerator = message.member.permissions.has(
    PermissionFlagsBits.ManageThreads
  );

  if (!isModerator && !hasAllowedRole) {
    return message.reply(
      "❌ You do not have permission to close forum posts."
    );
  }

  const thread = message.channel;

  if (!thread.isThread()) {
    return message.reply(
      "❌ This command can only be used inside a forum post."
    );
  }

  if (!thread.parent || thread.parent.type !== ChannelType.GuildForum) {
    return message.reply(
      "❌ This command can only be used inside a forum post."
    );
  }

  try {
    let tags = [...thread.appliedTags];

    tags = tags.filter(
      tagId =>
        tagId !== PENDING_REVIEW_TAG_ID &&
        tagId !== CLAIMED_TAG_ID
    );

    if (!tags.includes(CLOSED_TAG_ID)) {
      tags.push(CLOSED_TAG_ID);
    }

    await thread.setAppliedTags(
      tags,
      `Closed by ${message.author.tag}`
    );

    if (thread.name.startsWith("[CLAIMED] ")) {
      await thread.setName(
        thread.name.replace("[CLAIMED] ", ""),
        `Closed by ${message.author.tag}`
      );
    }

    claimedPosts.delete(thread.id);

    DATABASE.prepare(`
      DELETE FROM suggestions
      WHERE thread = ${thread.id}
    `).run()

    await message.reply(
      "🔒 This post has been closed."
    );

    await thread.setLocked(
      true,
      `Closed by ${message.author.tag}`
    );

    await thread.setArchived(
      true,
      `Closed by ${message.author.tag}`
    );

    console.log(
      `${message.author.tag} closed forum post: ${thread.name}`
    );

  } catch (error) {
    console.error(
      "Error closing forum post:",
      error
    );

    try {
      await message.reply(
        "❌ I couldn't close this forum post. Check my permissions and the forum tags."
      );
    } catch {}
  }
}


// close modmail command

async function closeMailCommand(message: any) {
  const thread = message.channel;

  if (!thread.isThread()) {
    return message.reply(
      "❌ This command can only be used inside a Modmail post."
    );
  }

  if (thread.parentId !== MODMAIL_FORUM_ID) {
    return message.reply(
      "❌ This is not a Modmail post."
    );
  }

  const userId = modmailThreads.get(thread.id);

  if (!userId) {
    return message.reply(
      "❌ I couldn't find the user attached to this Modmail conversation."
    );
  }

  try {
    const user = await client.users.fetch(userId);

    try {
      await user.send(
        "📪 Your Modmail conversation has been closed by the staff team."
      );
    } catch {}

    modmailThreads.delete(thread.id);
    modmailUsers.delete(userId);

    DATABASE.prepare(`
      DELETE FROM modMail 
      WHERE user = ${userId}
    `).run()

    await message.reply(
      "📪 Modmail conversation closed."
    );

    // Change [OPEN] to [CLOSED]
    if (thread.name.startsWith("[OPEN] ")) {
      await thread.setName(
        thread.name.replace("[OPEN] ", "[CLOSED] "),
        `Modmail closed by ${message.author.tag}`
      );
    }

    await thread.setLocked(
      true,
      `Modmail closed by ${message.author.tag}`
    );

    await thread.setArchived(
      true,
      `Modmail closed by ${message.author.tag}`
    );

  } catch (error) {
    console.error(
      "Error closing Modmail:",
      error
    );

    return message.reply(
      "❌ I couldn't close this Modmail conversation."
    );
  }
}


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

        modmailUsers.set(
          message.author.id,
          thread.id
        );

        modmailThreads.set(
          thread.id,
          message.author.id
        );

        DATABASE.prepare(`
          INSERT INTO modMail (thread, user) VALUES ('${thread.id}', '${message.author.id}')
        `).run()
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
      return closeMailCommand(message);
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
    let reply = REPLYS[Math.floor(Math.random() * REPLYS.length)]
    await message.reply(reply)
  }

  if (command === "!help") {
    return helpCommand(message);
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
    return claimCommand(message);
  }

  if (command === "!close") {
    return closeCommand(message);
  }

  if (command === "!escape" || command.startsWith("!escape ")) {
    return escapeCommand(message);
  }
});


client.login(TOKEN);
