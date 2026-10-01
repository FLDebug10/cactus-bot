// help command

import { Message, PermissionFlagsBits, ChannelType } from "discord.js";
import { ALLOWED_ROLE_IDS, CLAIMED_TAG_ID, client, CLOSED_TAG_ID, DATABASE, MODMAIL_FORUM_ID, PENDING_REVIEW_TAG_ID } from "./index.ts"

export async function helpCommand(message: any) {
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

export async function rbrCommand(message: Message) {
    await message.reply(`Please use <#1533408856682663956> to report any bugs you encounter.

This helps keep bug reports organized and makes it easier to track and address issues without cluttering the main discussion channels.`)
}


// handbook command

export async function handbookCommand(message: Message) {
  await message.reply(
    "📘 **Overgrown Handbook**\nhttps://0vergrown.github.io/Handbook/docs/datapack/introduction/overview/"
  );
}


// format command

export async function formatCommand(message: Message) {
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

export async function escapeCommand(message: any) {
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

export async function killDrizzoCommand(message: any) {
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

export async function killFLDCommand(message: any) {
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

export async function claimCommand(message: any, claimedPosts: Map<string, string>) {
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

export async function closeCommand(message: any, claimedPosts: Map<string, string>) {
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

export async function closeMailCommand(message: any, modmailThreads: Map<string, string>, modmailUsers: Map<string, string>) {
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