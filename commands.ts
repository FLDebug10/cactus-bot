// help command

import { Message, PermissionFlagsBits, ChannelType, MessagePayload, EmbedBuilder, AttachmentBuilder, Interaction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRow, ActionRowBuilder, LabelBuilder, ModalSubmitInteraction, MessageFlags } from "discord.js";
import { ALLOWED_ROLE_IDS, CLAIMED_TAG_ID, client, CLOSED_TAG_ID, DATABASE, MODMAIL_FORUM_ID, PENDING_REVIEW_TAG_ID } from "./index.ts"
import Database from "better-sqlite3";
import type { Command } from "./db.ts";

export async function registerSlashCommand(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  const modal = new ModalBuilder().setCustomId("register").setTitle("Register Command")
  const out = new TextInputBuilder().setCustomId("out").setRequired(true).setStyle(TextInputStyle.Paragraph).setPlaceholder("Example Output...")
  const help = new TextInputBuilder().setCustomId("help").setRequired(true).setStyle(TextInputStyle.Paragraph).setPlaceholder("Helpful Description...")

  const command_default = interaction.options.getString("command") ?? ""
  
  const command = new TextInputBuilder().setCustomId("cmd").setStyle(TextInputStyle.Short).setValue(command_default).setPlaceholder("!command").setRequired(true).setMinLength(2).setMaxLength(32)

  modal.addLabelComponents(new LabelBuilder().setLabel("Command").setTextInputComponent(command), new LabelBuilder().setLabel("Command Output").setTextInputComponent(out), new LabelBuilder().setLabel("Help Description").setTextInputComponent(help))

  return await interaction.showModal(modal)
}

export async function registerModal(interaction: Interaction, commands: Map<string, Command>, db: any, cmdArray: Command[]) {
  if (!(db instanceof Database)) return
  if (!interaction.isModalSubmit()) return

  if (interaction.customId === "register") {
    const out = interaction.fields.getTextInputValue("out")
    const help = interaction.fields.getTextInputValue("help")
    const cmd = "!" + interaction.fields.getTextInputValue("cmd").trim().toLowerCase().replace(/^!+/, "")

    if (!(/^![a-z0-9_-]+$/.test(cmd))) {
      return await interaction.reply({
        content: "Command name isn't valid. (May only include letters, numbers, `_` and `-`)",
        flags: MessageFlags.Ephemeral,
      })
    }

    try {
      db.prepare(`
        INSERT INTO commands (cmd, help, out) VALUES (?, ?, ?)
      `).run(cmd, help,out)

      commands.set(cmd, {
        cmd: cmd,
        help: help,
        out: out
      })

      cmdArray.push({
        cmd: cmd,
        help: help,
        out: out
      })
    } catch (error) {
      console.error(error)
      return
    }

    return await interaction.reply({
      content: `Registered Command ${cmd}`,
      flags: MessageFlags.Ephemeral
    })
  }
}

export async function helpCommand(message: any, commands: Command[]) {
  var dyn = commands.map(cmd => `- \`${cmd.cmd}\` — ${cmd.help}`).join("\n")

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
${dyn}

🔒 **Contributor / Staff Commands**
\`!claim\`, \`!close\`, and \`!closemail\` are restricted to Contributors and staff.`
  );
}

export async function compCommand(message: Message) {
  const hasAllowedRole = ALLOWED_ROLE_IDS.some(roleId =>
    message.member?.roles.cache.has(roleId)
  );

  const isModerator = message.member?.permissions.has(
    PermissionFlagsBits.ManageThreads
  );

  if (!isModerator && !hasAllowedRole) {
    return;
  }

  await message.reply(`**Competitive Jam Rules**

This jam will include an optional competition alongside the usual jam submissions.

To enter your submission into the competition, tag it with \`Comp Submission\` when submitting it.

If you do not use the \`Comp Submission\` tag, your entry will still count as a normal jam submission and you will still receive the jam participant role. The competition is completely optional.

**How judging works**
Once submissions close, the finalists will be chosen in two ways:
- The moderation team will select 2–3 submissions to move forward.
- The community will also choose 1 submission to move forward.
Once the finalists have been selected, a community poll will be held to decide the overall 1st place winner.

The winner will receive a custom Discord emoji dedicated to them and their winning submission, which will be added to the server.

**Competitive conduct**
Please keep the competition friendly.

The purpose of the jam is still to create something, have fun, and see what everyone comes up with. Do not turn the jam-discussion channel into arguments, rivalry, campaigning, putting down other submissions, or overly competitive behaviour.

You are welcome to be excited about your entry and discuss the competition, but keep it respectful toward everyone taking part.

If the competitive format causes repeated scuffles or creates a negative atmosphere, we will stop running competitive jams in the future.

Winning is a bonus. The jam itself comes first.`)
}

export async function parserCommand(message: Message) {
    await message.reply(`Having trouble finding an error in your JSON?

Use JSON Checker to quickly validate your code and spot syntax mistakes:

🔗 https://jsonchecker.com/

> Helpful for catching missing commas, brackets, quotation marks, and other JSON formatting errors.`)
}

export async function mediaCommand(message: Message) {
    await message.reply(`## The Media Gallery

This is a **no-talk zone** for sharing clips and screenshots of what you're working on.

Want to comment? **Start a thread on the post** and discuss it there.

📸 **Post your work.**
💬 **Discuss in threads.**
🚫 **No standalone messages.**`)
}

export async function rbrCommand(message: Message) {
    await message.reply(`Please use <#1533408856682663956> to report any bugs you encounter.

This helps keep bug reports organized and makes it easier to track and address issues without cluttering the main discussion channels.`)
}

export async function rdsCommand(message: Message) {
    await message.reply(`Please use <#1533211757407895634> for help with making powers and datapacking.

This helps avoid clutter in channels used for discussion and chatting with others.`)
}

export async function barsCommand(message: Message) {
    const msgString = `The sprite location for resource bars has changed slightly when moving from **Apace's Origins** to **Overgrown's Origins**.

The new location is:
\`"sprite_location": "origins:textures/gui/sprites/hud_render/<artist_name>/resource_bar_#.png"\``

    const msgEmbed = new EmbedBuilder().setImage("attachment://bars.png")
    const msgAttachment = new AttachmentBuilder("./bars.png")

    await message.reply({
      content: msgString,
      embeds: [msgEmbed],
      files: [msgAttachment]
    })
}

export async function badgesCommand(message: Message) {
    const msgString = ``

    const msgEmbed = new EmbedBuilder().setImage("attachment://badges.png")
    const msgAttachment = new AttachmentBuilder("./badges.png")

    await message.reply({
      content: msgString,
      embeds: [msgEmbed],
      files: [msgAttachment]
    })
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
      INSERT INTO suggestions (thread, user) VALUES (?, ?)
    `).run(thread.id, message.author.id)

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
      WHERE thread = ?
    `).run(thread.id)

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

    try {
      DATABASE.prepare(`
        DELETE FROM modMail 
        WHERE user = ?
      `).run(userId)

      modmailThreads.delete(thread.id);
      modmailUsers.delete(userId);
    } catch (error) {
      console.error(error)
    }

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