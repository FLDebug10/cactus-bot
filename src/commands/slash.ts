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
import {
  handleEndJamButton, handleStartJamButton,
  handleSubmissionButton,
  handleSubmissionModal, handleVoteButton,
  handleVoteCommand,
  handleVoteModal, handleVoteSubmissionModal,
  VoteSystem
} from "../features/jam.ts";

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
  new SlashCommandBuilder()
      .setName("vote")
      .setDescription("Starts a Vote in this Channel")
      .addIntegerOption(option => option.setName("submissions").setDescription("Amount of submissions").setRequired(true).setMinValue(2))
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
  const command = interaction.options.getString("command")
  if (command) name.setValue(command);
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

export async function handleInteraction(interaction: Interaction, store: CustomCommandStore, voteSystem: VoteSystem): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "register") await showRegisterModal(interaction);
      else if (interaction.commandName === "unregister") await unregister(interaction, store);
      else if (interaction.commandName === "vote") await handleVoteCommand(interaction)
    } else if (interaction.isModalSubmit()) {
      if(interaction.customId === REGISTER_MODAL) await saveRegistration(interaction, store);
      else if(interaction.customId === "vote") await handleVoteModal(interaction, voteSystem)
      else if(interaction.customId === "submission") await handleSubmissionModal(interaction, voteSystem)
      else if(interaction.customId === "submission_vote") await handleVoteSubmissionModal(interaction, voteSystem)
    } else if (interaction.isButton()) {
      if (interaction.customId === "add_submission") await handleSubmissionButton(interaction)
      else if(interaction.customId === "end_vote") await handleEndJamButton(interaction, voteSystem, false)
      else if(interaction.customId === "cancel_vote") await handleEndJamButton(interaction, voteSystem, true)
      else if(interaction.customId === "start_vote") await handleStartJamButton(interaction, voteSystem)
      else if(interaction.customId === "submission_vote") await handleVoteButton(interaction, voteSystem, false)
      else if(interaction.customId === "submission_vote_change") await handleVoteButton(interaction, voteSystem, true)
    }
  } catch (error) {
    log.error("interaction failed", error);
  }
}
