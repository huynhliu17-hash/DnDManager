// resolvePartyCharacter(nameQuery) — search all linked members for active character matching nameQuery
// execute(interaction) — /cond: add · remove · get · tick on any party character
// autocomplete(interaction) — suggests D&D 5e conditions for add; active conditions for remove

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { api } = require('../lib/api');
const { readLinks, getActiveSheetId } = require('../lib/links');

const D5E_CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened',
  'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified',
  'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious',
];

async function resolvePartyCharacter(nameQuery) {
  const links = readLinks();
  const query = nameQuery.toLowerCase();
  const matches = [];

  for (const [discordId, webAppUserId] of Object.entries(links)) {
    try {
      const sheets = await api(`/api/players/${webAppUserId}/characters`);
      if (!sheets.length) continue;
      const activeId = getActiveSheetId(discordId);
      const sheetRef = (activeId && sheets.find(s => String(s.id) === String(activeId))) || sheets[0];
      if (sheetRef.character_name && sheetRef.character_name.toLowerCase().includes(query)) {
        matches.push({ webAppUserId, sheetRef });
      }
    } catch {
      // skip unreachable users
    }
  }

  return matches;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cond')
    .setDescription('Manage conditions for any party character')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a condition to a character')
        .addStringOption(opt =>
          opt.setName('character')
            .setDescription('Character name (partial match)')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('Condition name (e.g. Poisoned, Stunned)')
            .setRequired(true)
            .setAutocomplete(true))
        .addStringOption(opt =>
          opt.setName('duration')
            .setDescription('How long the condition lasts (e.g. 3 rounds, until save)')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a condition from a character')
        .addStringOption(opt =>
          opt.setName('character')
            .setDescription('Character name (partial match)')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('Condition name (partial match)')
            .setRequired(true)
            .setAutocomplete(true)))
    .addSubcommand(sub =>
      sub.setName('get')
        .setDescription('Show active conditions for a character or the whole party')
        .addStringOption(opt =>
          opt.setName('character')
            .setDescription('Character name (partial match; omit to show all party conditions)')
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('tick')
        .setDescription('Advance all conditions by 1 on all party characters; removes any that expire')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      await interaction.deferReply({ ephemeral: true });
      const charQuery = interaction.options.getString('character');
      const condName = interaction.options.getString('name');
      const duration = interaction.options.getString('duration');

      const matches = await resolvePartyCharacter(charQuery);
      if (!matches.length) return interaction.editReply(`No party character matching \`${charQuery}\` found.`);
      if (matches.length > 1) {
        return interaction.editReply(`Multiple characters match — be more specific:\n${matches.map(m => `• ${m.sheetRef.character_name}`).join('\n')}`);
      }

      const { webAppUserId, sheetRef } = matches[0];
      const sheet = await api(`/api/players/${webAppUserId}/characters/${sheetRef.id}`, {}, webAppUserId);
      let conditions;
      try { conditions = JSON.parse(sheet.conditions || '[]'); } catch { conditions = []; }

      const idx = conditions.findIndex(c => c.name.toLowerCase() === condName.toLowerCase());
      if (idx !== -1) {
        conditions[idx] = { name: condName, duration };
      } else {
        conditions.push({ name: condName, duration });
      }

      await api(`/api/characters/${sheetRef.id}`, {
        method: 'PUT',
        body: JSON.stringify({ conditions: JSON.stringify(conditions) }),
      }, webAppUserId);

      return interaction.editReply(`Added condition **${condName}** (${duration}) to **${sheet.character_name}**.`);
    }

    if (sub === 'remove') {
      await interaction.deferReply({ ephemeral: true });
      const charQuery = interaction.options.getString('character');
      const condQuery = interaction.options.getString('name').toLowerCase();

      const matches = await resolvePartyCharacter(charQuery);
      if (!matches.length) return interaction.editReply(`No party character matching \`${charQuery}\` found.`);
      if (matches.length > 1) {
        return interaction.editReply(`Multiple characters match — be more specific:\n${matches.map(m => `• ${m.sheetRef.character_name}`).join('\n')}`);
      }

      const { webAppUserId, sheetRef } = matches[0];
      const sheet = await api(`/api/players/${webAppUserId}/characters/${sheetRef.id}`, {}, webAppUserId);
      let conditions;
      try { conditions = JSON.parse(sheet.conditions || '[]'); } catch { conditions = []; }

      const condMatches = conditions.filter(c => c.name.toLowerCase().includes(condQuery));
      if (!condMatches.length) return interaction.editReply(`No condition matching \`${condQuery}\` on **${sheet.character_name}**.`);
      if (condMatches.length > 1) {
        return interaction.editReply(`Multiple conditions match — be more specific:\n${condMatches.map(c => `• ${c.name}`).join('\n')}`);
      }

      conditions = conditions.filter(c => !c.name.toLowerCase().includes(condQuery));
      await api(`/api/characters/${sheetRef.id}`, {
        method: 'PUT',
        body: JSON.stringify({ conditions: JSON.stringify(conditions) }),
      }, webAppUserId);

      return interaction.editReply(`Removed **${condMatches[0].name}** from **${sheet.character_name}**.`);
    }

    if (sub === 'get') {
      await interaction.deferReply();
      const charQuery = interaction.options.getString('character');

      if (charQuery) {
        const matches = await resolvePartyCharacter(charQuery);
        if (!matches.length) return interaction.editReply(`No party character matching \`${charQuery}\` found.`);
        if (matches.length > 1) {
          return interaction.editReply(`Multiple characters match — be more specific:\n${matches.map(m => `• ${m.sheetRef.character_name}`).join('\n')}`);
        }

        const { webAppUserId, sheetRef } = matches[0];
        const sheet = await api(`/api/players/${webAppUserId}/characters/${sheetRef.id}`, {}, webAppUserId);
        let conditions;
        try { conditions = JSON.parse(sheet.conditions || '[]'); } catch { conditions = []; }

        const embed = new EmbedBuilder()
          .setTitle(`${sheet.character_name || 'Unnamed'} — Conditions`)
          .setColor(conditions.length ? 0xED4245 : 0x57F287);

        if (conditions.length) {
          embed.addFields(conditions.map(c => ({ name: c.name, value: c.duration || 'No duration', inline: true })));
        } else {
          embed.setDescription('No active conditions.');
        }

        return interaction.editReply({ embeds: [embed] });
      }

      // All party
      const links = readLinks();
      const entries = Object.entries(links);
      if (!entries.length) return interaction.editReply('No party members linked yet.');

      const embed = new EmbedBuilder().setTitle('Party Conditions').setColor(0x5865F2);
      let anyConditions = false;

      for (const [discordId, webAppUserId] of entries) {
        try {
          const sheets = await api(`/api/players/${webAppUserId}/characters`);
          if (!sheets.length) continue;
          const activeId = getActiveSheetId(discordId);
          const sheetRef = (activeId && sheets.find(s => String(s.id) === String(activeId))) || sheets[0];
          const sheet = await api(`/api/players/${webAppUserId}/characters/${sheetRef.id}`, {}, webAppUserId);
          let conditions;
          try { conditions = JSON.parse(sheet.conditions || '[]'); } catch { conditions = []; }
          if (!conditions.length) continue;
          anyConditions = true;
          embed.addFields({
            name: sheet.character_name || 'Unnamed',
            value: conditions.map(c => `**${c.name}** — ${c.duration}`).join('\n'),
          });
        } catch {
          // skip
        }
      }

      if (!anyConditions) embed.setDescription('No active conditions in the party.');
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'tick') {
      await interaction.deferReply();
      const links = readLinks();
      const entries = Object.entries(links);
      if (!entries.length) return interaction.editReply('No party members linked yet.');

      const lines = [];

      for (const [discordId, webAppUserId] of entries) {
        try {
          const sheets = await api(`/api/players/${webAppUserId}/characters`);
          if (!sheets.length) continue;
          const activeId = getActiveSheetId(discordId);
          const sheetRef = (activeId && sheets.find(s => String(s.id) === String(activeId))) || sheets[0];
          const sheet = await api(`/api/players/${webAppUserId}/characters/${sheetRef.id}`, {}, webAppUserId);
          let conditions;
          try { conditions = JSON.parse(sheet.conditions || '[]'); } catch { conditions = []; }
          if (!conditions.length) continue;

          const expired = [];
          const remaining = [];
          const skipped = [];

          conditions = conditions.filter(c => {
            const match = c.duration.match(/^(\d+)(\s*.*)$/);
            if (!match) { skipped.push(c.name); return true; }
            const newNum = parseInt(match[1], 10) - 1;
            if (newNum <= 0) { expired.push(c.name); return false; }
            c.duration = `${newNum}${match[2]}`;
            remaining.push(`${c.name} — ${c.duration}`);
            return true;
          });

          await api(`/api/characters/${sheetRef.id}`, {
            method: 'PUT',
            body: JSON.stringify({ conditions: JSON.stringify(conditions) }),
          }, webAppUserId);

          const charName = sheet.character_name || 'Unnamed';
          const parts = [];
          if (expired.length) parts.push(`expired: ${expired.join(', ')}`);
          if (remaining.length) parts.push(`remaining: ${remaining.join(', ')}`);
          if (skipped.length) parts.push(`skipped (no numeric duration): ${skipped.join(', ')}`);
          if (parts.length) lines.push(`**${charName}** — ${parts.join(' | ')}`);
        } catch {
          // skip
        }
      }

      if (!lines.length) return interaction.editReply('No conditions to tick.');
      return interaction.editReply(lines.join('\n'));
    }
  },

  async autocomplete(interaction) {
    const sub = interaction.options.getSubcommand();
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'name') return interaction.respond([]);

    if (sub === 'add') {
      const query = focused.value.toLowerCase();
      const choices = D5E_CONDITIONS
        .filter(c => c.toLowerCase().startsWith(query))
        .slice(0, 25)
        .map(c => ({ name: c, value: c }));
      return interaction.respond(choices);
    }

    if (sub === 'remove') {
      const charQuery = interaction.options.getString('character') || '';
      if (!charQuery) return interaction.respond([]);
      const matches = await resolvePartyCharacter(charQuery);
      if (matches.length !== 1) return interaction.respond([]);
      const { webAppUserId, sheetRef } = matches[0];
      try {
        const sheet = await api(`/api/players/${webAppUserId}/characters/${sheetRef.id}`, {}, webAppUserId);
        let conditions;
        try { conditions = JSON.parse(sheet.conditions || '[]'); } catch { conditions = []; }
        const query = focused.value.toLowerCase();
        const choices = conditions
          .filter(c => c.name.toLowerCase().includes(query))
          .slice(0, 25)
          .map(c => ({ name: `${c.name} (${c.duration})`, value: c.name }));
        return interaction.respond(choices);
      } catch {
        return interaction.respond([]);
      }
    }

    return interaction.respond([]);
  },
};
