// spellEmbed(d) — build EmbedBuilder for a spell detail object
// featEmbed(d) — build EmbedBuilder for a feat detail object
// featureEmbed(d) — build EmbedBuilder for a class feature detail object
// execute(interaction) — /lookup spell|feat|feature <name>
// autocomplete(interaction) — fuzzy-matches name against cached dnd5e-index.json

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fuzzySearch, fetchDetail } = require('../lib/dnd5e');

const COLORS = { spell: 0x9B59B6, feat: 0xE67E22, feature: 0x2ECC71 };

function trunc(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function spellEmbed(d) {
  const level = d.level === 0 ? 'Cantrip' : `Level ${d.level}`;
  const comps = (d.components || []).join(', ') || '—';
  const material = d.material ? ` (${d.material})` : '';
  const desc = trunc((d.desc || []).join('\n\n'), 4096);

  const embed = new EmbedBuilder()
    .setTitle(d.name)
    .setColor(COLORS.spell)
    .setDescription(desc)
    .addFields(
      { name: 'Level / School', value: `${level} — ${d.school?.name || '—'}`, inline: true },
      { name: 'Casting Time', value: d.casting_time || '—', inline: true },
      { name: 'Range', value: d.range || '—', inline: true },
      { name: 'Components', value: comps + material, inline: true },
      { name: 'Duration', value: d.duration || '—', inline: true },
      { name: 'Concentration', value: d.concentration ? 'Yes' : 'No', inline: true },
    );

  if (d.higher_level?.length) {
    embed.addFields({ name: 'At Higher Levels', value: trunc(d.higher_level.join('\n'), 1024) });
  }
  if (d.classes?.length) {
    embed.addFields({ name: 'Classes', value: d.classes.map(c => c.name).join(', ') });
  }
  return embed;
}

function featEmbed(d) {
  // Open5e: desc is a string; dnd5eapi: desc is an array
  const rawDesc = Array.isArray(d.desc) ? d.desc.join('\n\n') : (d.desc || '');
  const desc = trunc(rawDesc, 4096);

  // Open5e: prerequisite is a string; dnd5eapi: prerequisites is an array
  let prereqs = 'None';
  if (d.prerequisite) {
    prereqs = d.prerequisite;
  } else if (d.prerequisites?.length) {
    prereqs = d.prerequisites.map(p => {
      if (p.type === 'ability-score') return `${p.ability_score?.name || 'Ability'} ${p.minimum_score}+`;
      return p.proficiency?.name || p.spell?.name || p.type || '—';
    }).join(', ');
  }

  const embed = new EmbedBuilder()
    .setTitle(d.name)
    .setColor(COLORS.feat)
    .setDescription(desc || '—')
    .addFields({ name: 'Prerequisites', value: prereqs });

  if (d.document__title) embed.setFooter({ text: d.document__title });

  return embed;
}

function featureEmbed(d) {
  const desc = trunc((d.desc || []).join('\n\n'), 4096);
  const subclass = d.subclass?.name ? ` (${d.subclass.name})` : '';

  return new EmbedBuilder()
    .setTitle(d.name)
    .setColor(COLORS.feature)
    .setDescription(desc)
    .addFields(
      { name: 'Class', value: `${d.class?.name || '—'}${subclass}`, inline: true },
      { name: 'Level', value: String(d.level ?? '—'), inline: true },
    );
}

// Subcommand name → index type key in dnd5e-index.json
const TYPE_MAP = { spell: 'spells', feat: 'feats', feature: 'features' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lookup')
    .setDescription('Look up D&D 5e rules reference')
    .addSubcommand(sub =>
      sub.setName('spell')
        .setDescription('Look up a spell')
        .addStringOption(opt =>
          opt.setName('name').setDescription('Spell name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(sub =>
      sub.setName('feat')
        .setDescription('Look up a feat')
        .addStringOption(opt =>
          opt.setName('name').setDescription('Feat name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(sub =>
      sub.setName('feature')
        .setDescription('Look up a class feature')
        .addStringOption(opt =>
          opt.setName('name').setDescription('Feature name').setRequired(true).setAutocomplete(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const nameVal = interaction.options.getString('name');
    await interaction.deferReply();

    // Autocomplete selections pass the URL as the value (starts with /); plain text needs a lookup
    let url;
    if (nameVal.startsWith('/')) {
      url = nameVal;
    } else {
      let results;
      try {
        results = fuzzySearch(TYPE_MAP[sub], nameVal);
      } catch {
        return interaction.editReply('Lookup index unavailable. Run `node scripts/seed-dnd-index.js` in the bot directory to build it.');
      }
      if (!results.length) return interaction.editReply(`No ${sub} found matching \`${nameVal}\`.`);
      url = results[0].url;
    }

    try {
      const detail = await fetchDetail(url);
      let embed;
      if (sub === 'spell') embed = spellEmbed(detail);
      else if (sub === 'feat') embed = featEmbed(detail);
      else embed = featureEmbed(detail);
      return interaction.editReply({ embeds: [embed] });
    } catch {
      return interaction.editReply(`Could not fetch ${sub} data — the 5e API may be unavailable. Try again shortly.`);
    }
  },

  async autocomplete(interaction) {
    const sub = interaction.options.getSubcommand();
    const query = interaction.options.getFocused();
    try {
      const results = fuzzySearch(TYPE_MAP[sub], query);
      return interaction.respond(results.map(r => ({ name: r.name, value: r.url })));
    } catch {
      return interaction.respond([]);
    }
  },
};
