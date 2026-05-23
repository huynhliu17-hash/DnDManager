// execute(interaction) — /character: view · hp · spellslots · conditions add/remove/get

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { api } = require('../lib/api');
const { getWebAppUserId } = require('../lib/links');

const LEVEL_NAMES = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th'];

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
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('spellslots')
        .setDescription('Use or recover a spell slot')
        .addIntegerOption(opt =>
          opt.setName('level')
            .setDescription('Spell slot level (1–9)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(9))
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Use (expend) or recover a slot')
            .setRequired(true)
            .addChoices(
              { name: 'Use (expend)', value: 'use' },
              { name: 'Recover', value: 'recover' },
            )))
    .addSubcommandGroup(group =>
      group.setName('conditions')
        .setDescription('Manage active conditions')
        .addSubcommand(sub =>
          sub.setName('add')
            .setDescription('Add a condition')
            .addStringOption(opt =>
              opt.setName('name')
                .setDescription('Condition name (e.g. Poisoned, Stunned, Prone)')
                .setRequired(true))
            .addStringOption(opt =>
              opt.setName('duration')
                .setDescription('How long the condition lasts (e.g. 1 hour, 3 rounds, until save)')
                .setRequired(true)))
        .addSubcommand(sub =>
          sub.setName('remove')
            .setDescription('Remove a condition')
            .addStringOption(opt =>
              opt.setName('name')
                .setDescription('Condition name (partial match)')
                .setRequired(true)))
        .addSubcommand(sub =>
          sub.setName('get')
            .setDescription('Show all active conditions'))),

  async execute(interaction) {
    const userId = getWebAppUserId(interaction.user.id);
    if (!userId) {
      return interaction.reply({
        content: 'You have not linked your account yet. Use `/link <username>` first.',
        ephemeral: true,
      });
    }

    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    // ── conditions ───────────────────────────────────────────────
    if (group === 'conditions') {
      await interaction.deferReply({ ephemeral: sub !== 'get' });

      const sheets = await api(`/api/players/${userId}/characters`, {}, userId);
      if (!sheets.length) return interaction.editReply('No character found for your account.');
      const sheet = await api(`/api/players/${userId}/characters/${sheets[0].id}`, {}, userId);

      let conditions;
      try { conditions = JSON.parse(sheet.conditions || '[]'); } catch { conditions = []; }

      if (sub === 'add') {
        const name = interaction.options.getString('name');
        const duration = interaction.options.getString('duration');

        const idx = conditions.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
        if (idx !== -1) {
          conditions[idx] = { name, duration };
        } else {
          conditions.push({ name, duration });
        }

        await api(`/api/characters/${sheets[0].id}`, {
          method: 'PUT',
          body: JSON.stringify({ conditions: JSON.stringify(conditions) }),
        }, userId);

        return interaction.editReply(`Added condition **${name}** — ${duration}.`);
      }

      if (sub === 'remove') {
        const query = interaction.options.getString('name').toLowerCase();
        const matches = conditions.filter(c => c.name.toLowerCase().includes(query));

        if (!matches.length) return interaction.editReply(`No condition matching \`${query}\` found.`);
        if (matches.length > 1) {
          return interaction.editReply(`Multiple matches — be more specific:\n${matches.map(c => `• ${c.name}`).join('\n')}`);
        }

        conditions = conditions.filter(c => !c.name.toLowerCase().includes(query));
        await api(`/api/characters/${sheets[0].id}`, {
          method: 'PUT',
          body: JSON.stringify({ conditions: JSON.stringify(conditions) }),
        }, userId);

        return interaction.editReply(`Removed condition **${matches[0].name}**.`);
      }

      if (sub === 'get') {
        const embed = new EmbedBuilder()
          .setTitle(`${sheet.character_name || 'Unnamed Character'} — Conditions`)
          .setColor(conditions.length ? 0xED4245 : 0x57F287);

        if (conditions.length) {
          embed.addFields(conditions.map(c => ({
            name: c.name,
            value: c.duration || 'No duration set',
            inline: true,
          })));
        } else {
          embed.setDescription('No active conditions.');
        }

        return interaction.editReply({ embeds: [embed] });
      }
    }

    // ── spellslots ───────────────────────────────────────────────
    if (sub === 'spellslots') {
      const level = interaction.options.getInteger('level');
      const action = interaction.options.getString('action');
      await interaction.deferReply();

      const sheets = await api(`/api/players/${userId}/characters`, {}, userId);
      if (!sheets.length) return interaction.editReply('No character found for your account.');
      const sheet = await api(`/api/players/${userId}/characters/${sheets[0].id}`, {}, userId);

      let slots;
      try { slots = JSON.parse(sheet.spell_slots || '[]'); } catch { slots = []; }
      while (slots.length < 9) slots.push({ pips: Array(4).fill(false) });
      slots = slots.map(s => (s.pips ? s : { pips: Array(4).fill(false) }));

      const levelIdx = level - 1;
      const slot = slots[levelIdx];
      if (!slot.pips) slot.pips = Array(4).fill(false);

      const filled = slot.pips.filter(Boolean).length;
      const total = slot.pips.length;

      if (action === 'use') {
        if (filled >= total) {
          return interaction.editReply(`No ${LEVEL_NAMES[levelIdx]}-level spell slots remaining.`);
        }
        slot.pips = Array(total).fill(false).map((_, i) => i < filled + 1);
      } else {
        if (filled === 0) {
          return interaction.editReply(`All ${LEVEL_NAMES[levelIdx]}-level spell slots are already recovered.`);
        }
        slot.pips = Array(total).fill(false).map((_, i) => i < filled - 1);
      }

      await api(`/api/characters/${sheets[0].id}`, {
        method: 'PUT',
        body: JSON.stringify({ spell_slots: JSON.stringify(slots) }),
      }, userId);

      const newFilled = slot.pips.filter(Boolean).length;
      const pipsDisplay = slot.pips.map(p => p ? '●' : '○').join(' ');

      const embed = new EmbedBuilder()
        .setTitle(sheet.character_name || 'Unnamed Character')
        .setColor(action === 'use' ? 0xED4245 : 0x57F287)
        .addFields({
          name: `${LEVEL_NAMES[levelIdx]}-Level Spell Slots`,
          value: `${pipsDisplay}\n${total - newFilled} of ${total} remaining`,
        });

      return interaction.editReply({ embeds: [embed] });
    }

    // ── view ─────────────────────────────────────────────────────
    if (sub === 'view') {
      await interaction.deferReply();
      const sheets = await api(`/api/players/${userId}/characters`, {}, userId);
      if (!sheets.length) return interaction.editReply('No character found for your account.');
      const sheet = await api(`/api/players/${userId}/characters/${sheets[0].id}`, {}, userId);

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

    // ── hp ───────────────────────────────────────────────────────
    if (sub === 'hp') {
      const amount = interaction.options.getInteger('amount');
      await interaction.deferReply();

      const sheets = await api(`/api/players/${userId}/characters`, {}, userId);
      if (!sheets.length) return interaction.editReply('No character found for your account.');
      const sheet = await api(`/api/players/${userId}/characters/${sheets[0].id}`, {}, userId);

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
