import {
  type ChatInputCommandInteraction,
  type Interaction,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  type ModalSubmitInteraction,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { CustomCommandStore } from "../db/customCommands.ts";
import { logger } from "../logger.ts";

const log = logger("slash");

const REGISTER_MODAL = "register";

const DEFINITIONS = [
  new SlashCommandBuilder()
    .setName("register")
    .setDescription("Register Custom Commands")
    .addStringOption(option => option.setName("command").setDescription("Name of the Command").setRequired(false).setMinLength(2).setMaxLength(32))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName("unregister")
    .setDescription("Unregister Custom Commands")
    .addStringOption(option => option.setName("command").setDescription("Name of the Command").setRequired(true).setMinLength(2).setMaxLength(32))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
];

export async function deploySlashCommands(token: string, applicationId: string): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationCommands(applicationId), { body: DEFINITIONS.map(definition => definition.toJSON()) });
  log.info("registered slash commands");
}

// "!Foo", "foo" and "!!foo" all mean the command "!foo".
function commandName(raw: string): string {
  return `!${raw.trim().toLowerCase().replace(/^!+/, "")}`;
}

async function showRegisterModal(interaction: ChatInputCommandInteraction): Promise<void> {
  const name = new TextInputBuilder().setCustomId("cmd").setStyle(TextInputStyle.Short).setPlaceholder("!command").setRequired(true).setMinLength(2).setMaxLength(32)
    .setValue(interaction.options.getString("command") ?? "");
  const output = new TextInputBuilder().setCustomId("out").setStyle(TextInputStyle.Paragraph).setPlaceholder("Example Output...").setRequired(true);
  const help = new TextInputBuilder().setCustomId("help").setStyle(TextInputStyle.Paragraph).setPlaceholder("Helpful Description...").setRequired(true);

  const modal = new ModalBuilder().setCustomId(REGISTER_MODAL).setTitle("Register Command").addLabelComponents(
    new LabelBuilder().setLabel("Command").setTextInputComponent(name),
    new LabelBuilder().setLabel("Command Output").setTextInputComponent(output),
    new LabelBuilder().setLabel("Help Description").setTextInputComponent(help),
  );
  await interaction.showModal(modal);
}

async function saveRegistration(interaction: ModalSubmitInteraction, store: CustomCommandStore): Promise<void> {
  const cmd = commandName(interaction.fields.getTextInputValue("cmd"));
  if (!/^![a-z0-9_-]+$/.test(cmd)) {
    await interaction.reply({ content: "Command name isn't valid. (May only include letters, numbers, `_` and `-`)", flags: MessageFlags.Ephemeral });
    return;
  }
  store.save({ cmd, help: interaction.fields.getTextInputValue("help"), out: interaction.fields.getTextInputValue("out") });
  await interaction.reply({ content: `Registered Command ${cmd}`, flags: MessageFlags.Ephemeral });
}

async function unregister(interaction: ChatInputCommandInteraction, store: CustomCommandStore): Promise<void> {
  const cmd = commandName(interaction.options.getString("command", true));
  const removed = store.remove(cmd);
  await interaction.reply({ content: removed ? `Unregistered Command ${cmd}` : `There was no command called ${cmd}`, flags: MessageFlags.Ephemeral });
}

export async function handleInteraction(interaction: Interaction, store: CustomCommandStore): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "register") await showRegisterModal(interaction);
      else if (interaction.commandName === "unregister") await unregister(interaction, store);
    } else if (interaction.isModalSubmit() && interaction.customId === REGISTER_MODAL) {
      await saveRegistration(interaction, store);
    }
  } catch (error) {
    log.error("interaction failed", error);
  }
}
