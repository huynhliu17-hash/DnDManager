// hpBar(current, max) — render 8-char block HP bar (e.g. [████░░░░])
// execute(interaction) — /party: show all linked members' HP bar + active conditions

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { api } = require('../lib/api');
const { readLinks, getActiveSheetId } = require('../lib/links');

function hpBar(current, max) {
  if (!max) return '[────────]';
  const pct = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(pct * 8);
  return '[' + '█'.repeat(filled) + '░'.repeat(8 - filled) + ']';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('party')
    .setDescription("View all linked party members' HP and conditions"),

  async execute(interaction) {
    await interaction.deferReply();

    const links = readLinks();
    const entries = Object.entries(links);

    if (!entries.length) {
      return interaction.editReply('No party members have linked their accounts yet. Use `/link` to connect.');
    }

    const members = [];
    for (const [discordId, webAppUserId] of entries) {
      try {
        const sheets = await api(`/api/players/${webAppUserId}/characters`);
        if (!sheets.length) continue;
        const activeId = getActiveSheetId(discordId);
        const activeRef = (activeId && sheets.find(s => String(s.id) === String(activeId))) || sheets[0];
        const sheet = await api(`/api/players/${webAppUserId}/characters/${activeRef.id}`);

        let conditions;
        try { conditions = JSON.parse(sheet.conditions || '[]'); } catch { conditions = []; }

        members.push({
          name: sheet.character_name || 'Unnamed',
          classLevel: sheet.class_level || '—',
          currentHp: sheet.current_hp ?? 0,
          maxHp: sheet.max_hp ?? 0,
          tempHp: sheet.temp_hp ?? 0,
          conditions,
        });
      } catch {
        // skip users with no character or unreachable accounts
      }
    }

    if (!members.length) {
      return interaction.editReply('No party members have characters yet.');
    }

    const embed = new EmbedBuilder()
      .setTitle('Party Status')
      .setColor(0x5865F2);

    for (const m of members) {
      const bar = hpBar(m.currentHp, m.maxHp);
      const tempStr = m.tempHp ? ` (+${m.tempHp} temp)` : '';
      const condStr = m.conditions.length
        ? `\n⚠ ${m.conditions.map(c => `${c.name} (${c.duration})`).join(', ')}`
        : '';

      embed.addFields({
        name: `${m.name} — ${m.classLevel}`,
        value: `${bar} ${m.currentHp}/${m.maxHp}${tempStr}${condStr}`,
      });
    }

    return interaction.editReply({ embeds: [embed] });
  },
};
