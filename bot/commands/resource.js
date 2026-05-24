// Function index:
// resolveSheet(sheets, discordId)  — pick active sheet from list
// buildSubcommands(group)          — add use/recover/set subcommands to a subcommand group
// execute(interaction)             — /res slash command handler

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { api } = require('../lib/api');
const { getWebAppUserId, getActiveSheetId } = require('../lib/links');

// ── Config ────────────────────────────────────────────────────────

const RESOURCE_MAP = {
  rage: { field: 'rage_uses',        label: 'Rage Uses',        emoji: '🔥' },
  sd:   { field: 'superiority_dice', label: 'Superiority Dice', emoji: '🎲' },
};

// ── Helpers ───────────────────────────────────────────────────────

function resolveSheet(sheets, discordId) {
  const activeId = getActiveSheetId(discordId);
  if (activeId) {
    const found = sheets.find(s => String(s.id) === String(activeId));
    if (found) return found;
  }
  return sheets[0];
}

function buildSubcommands(group) {
  return group
    .addSubcommand(sub =>
      sub.setName('use')
        .setDescription('Spend (decrement by amount, default 1)')
        .addIntegerOption(opt =>
          opt.setName('amount').setDescription('How many to spend (default 1)').setMinValue(1)))
    .addSubcommand(sub =>
      sub.setName('recover')
        .setDescription('Gain back (increment by amount, default 1)')
        .addIntegerOption(opt =>
          opt.setName('amount').setDescription('How many to recover (default 1)').setMinValue(1)))
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set to an exact value')
        .addIntegerOption(opt =>
          opt.setName('amount').setDescription('Value to set').setRequired(true).setMinValue(0)));
}

// ── Slash command ─────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('res')
    .setDescription('Adjust rage uses or superiority dice')
    .addSubcommandGroup(group =>
      buildSubcommands(
        group.setName('rage').setDescription('Rage uses')
      ))
    .addSubcommandGroup(group =>
      buildSubcommands(
        group.setName('sd').setDescription('Superiority dice')
      )),

  async execute(interaction) {
    const userId = getWebAppUserId(interaction.user.id);
    if (!userId) {
      return interaction.reply({
        content: 'You have not linked your account yet. Use `/link <username>` first.',
        ephemeral: true,
      });
    }

    const type   = interaction.options.getSubcommandGroup(); // 'rage' | 'sd'
    const action = interaction.options.getSubcommand();      // 'use' | 'recover' | 'set'
    const amount = interaction.options.getInteger('amount'); // null if omitted

    await interaction.deferReply();

    const sheets = await api(`/api/players/${userId}/characters`, {}, userId);
    if (!sheets.length) return interaction.editReply('No character found for your account.');
    const active = resolveSheet(sheets, interaction.user.id);
    const sheet  = await api(`/api/players/${userId}/characters/${active.id}`, {}, userId);

    const { field, label, emoji } = RESOURCE_MAP[type];
    const oldVal = sheet[field] ?? 0;

    let newVal, actionLabel;

    if (action === 'set') {
      newVal = amount;
      actionLabel = `Set to ${amount}`;
    } else if (action === 'use') {
      const spend = amount ?? 1;
      newVal = Math.max(0, oldVal - spend);
      actionLabel = `−${spend}`;
    } else {
      // recover
      const gain = amount ?? 1;
      newVal = oldVal + gain;
      actionLabel = `+${gain}`;
    }

    await api(`/api/characters/${active.id}`, {
      method: 'PUT',
      body: JSON.stringify({ [field]: newVal }),
    }, userId);

    const color =
      action === 'recover' ? 0x57F287 :  // green
      action === 'use'     ? 0xED4245 :  // red
                             0x5865F2;   // blue (set)

    const embed = new EmbedBuilder()
      .setTitle(sheet.character_name || 'Unnamed Character')
      .setColor(color)
      .addFields(
        { name: `${emoji} ${label}`, value: actionLabel,    inline: true },
        { name: 'Before',            value: String(oldVal), inline: true },
        { name: 'After',             value: String(newVal), inline: true },
      );

    return interaction.editReply({ embeds: [embed] });
  },
};
