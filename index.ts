require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");

const TOKEN = process.env.TOKEN;

const CLOSED_TAG_ID = "1553708235582869604";
const PENDING_REVIEW_TAG_ID = "1553812865071186000";

const SUGGESTIONS_FORUM_ID = "1533408806833229834";

const ALLOWED_ROLE_IDS = [
  "1531431940178317385",
  "1547964808912048299",
  "1548817360247332874"
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("clientReady", () => {
  console.log(Bot online as ${client.user.tag});
});


// handbook command

async function handbookCommand(message) {
  await message.reply(
    "📘 **Overgrown Handbook**\nhttps://0vergrown.github.io/Handbook/"
  );
}


// format command

async function formatCommand(message) {
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


// close command

async function closeCommand(message) {
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
      tagId => tagId !== PENDING_REVIEW_TAG_ID
    );

    if (!tags.includes(CLOSED_TAG_ID)) {
      tags.push(CLOSED_TAG_ID);
    }

    await thread.setAppliedTags(
      tags,
      Closed by ${message.author.tag}
    );

    await message.reply(
      "🔒 This post has been closed."
    );

    await thread.setLocked(
      true,
      Closed by ${message.author.tag}
    );

    await thread.setArchived(
      true,
      Closed by ${message.author.tag}
    );

    console.log(
      ${message.author.tag} closed forum post: ${thread.name}
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

// apply pending review

client.on("threadCreate", async thread => {
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
      Applied Pending Review tag to: ${thread.name}
    );

  } catch (error) {
    console.error(
      Failed to automatically tag ${thread.name}:,
      error
    );
  }
});


client.on("messageCreate", async message => {
  if (message.author.bot) return;

  const command = message.content
    .trim()
    .toLowerCase();

  if (command === "!handbook") {
    return handbookCommand(message);
  }

  if (command === "!format") {
    return formatCommand(message);
  }

  if (command === "!close") {
    return closeCommand(message);
  }
});


client.login(TOKEN);
