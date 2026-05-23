const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { api } = require('../lib/api');
const { getWebAppUserId } = require('../lib/links');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('character')
    .setDescription('View or update your character')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View your character sheet'))
    .addSubcommand(sub =>
      sub.setName('hp')
        .setDescription('Apply HP change (+heal / -damage)')
        .addIntegerOption(opt =>
          opt.setName('amount')
            .setDescription('Amount to heal (+) or damage (-)')
            .setRequired(true))),

  async execute(interaction) {
    const userId = getWebAppUserId(interaction.user.id);
    if (!userId) {
      return interaction.reply({
        content: 'You have not linked your account yet. Use `/link <username>` first.',
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      await interaction.deferReply();
      const sheets = await api(`/api/party/${userId}/characters`, {}, userId);
      if (!sheets.length) {
        return interaction.editReply('No character found for your account.');
      }
      const sheet = await api(`/api/party/${userId}/characters/${sheets[0].id}`, {}, userId);

      const embed = new EmbedBuilder()
        .setTitle(sheet.character_name || 'Unnamed Character')
        .setColor(0x5865F2)
        .addFields(
          { name: 'Race / Class', value: `${sheet.race || '—'} / ${sheet.class_level || '—'}`, inline: true },
          { name: 'AC', value: String(sheet.armor_class ?? '—'), inline: true },
          { name: 'HP', value: `${sheet.current_hp ?? 0} / ${sheet.max_hp ?? 0}${sheet.temp_hp ? ` (+${sheet.temp_hp} temp)` : ''}`, inline: true },
          { name: 'STR', value: String(sheet.strength ?? '—'), inline: true },
          { name: 'DEX', value: String(sheet.dexterity ?? '—'), inline: true },
          { name: 'CON', value: String(sheet.constitution ?? '—'), inline: true },
          { name: 'INT', value: String(sheet.intelligence ?? '—'), inline: true },
          { name: 'WIS', value: String(sheet.wisdom ?? '—'), inline: true },
          { name: 'CHA', value: String(sheet.charisma ?? '—'), inline: true },
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'hp') {
      const amount = interaction.options.getInteger('amount');
      await interaction.deferReply();

      const sheets = await api(`/api/party/${userId}/characters`, {}, userId);
      if (!sheets.length) {
        return interaction.editReply('No character found for your account.');
      }
      const sheet = await api(`/api/party/${userId}/characters/${sheets[0].id}`, {}, userId);

      const oldHp = sheet.current_hp ?? 0;
      const maxHp = sheet.max_hp ?? 0;
      const newHp = Math.min(maxHp, Math.max(0, oldHp + amount));

      await api(`/api/characters/${sheets[0].id}`, {
        method: 'PUT',
        body: JSON.stringify({ current_hp: newHp }),
      }, userId);

      const sign = amount >= 0 ? `+${amount}` : String(amount);
      const embed = new EmbedBuilder()
        .setTitle(sheet.character_name || 'Unnamed Character')
        .setColor(amount >= 0 ? 0x57F287 : 0xED4245)
        .addFields(
          { name: 'HP Change', value: sign, inline: true },
          { name: 'Old HP', value: `${oldHp} / ${maxHp}`, inline: true },
          { name: 'New HP', value: `${newHp} / ${maxHp}`, inline: true },
        );

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
