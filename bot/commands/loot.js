const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { api } = require('../lib/api');

const COIN_NAMES = { pp: 'Platinum', gp: 'Gold', ep: 'Electrum', sp: 'Silver', cp: 'Copper' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loot')
    .setDescription('Manage party loot and money')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View party money and items'))
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a loot item')
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('Item name')
            .setRequired(true))
        .addStringOption(opt =>
          opt.setName('tag')
            .setDescription('Item tag')
            .setRequired(true)
            .addChoices(
              { name: 'Weapon', value: 'Weapon' },
              { name: 'Armor', value: 'Armor' },
              { name: 'Potion', value: 'Potion' },
              { name: 'Scroll', value: 'Scroll' },
              { name: 'Gem', value: 'Gem' },
              { name: 'Art', value: 'Art' },
              { name: 'Misc', value: 'Misc' },
            )))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a loot item by name')
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('Item name (partial match)')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('money')
        .setDescription('Update party money')
        .addStringOption(opt =>
          opt.setName('coin')
            .setDescription('Coin type')
            .setRequired(true)
            .addChoices(
              { name: 'Platinum (pp)', value: 'pp' },
              { name: 'Gold (gp)', value: 'gp' },
              { name: 'Electrum (ep)', value: 'ep' },
              { name: 'Silver (sp)', value: 'sp' },
              { name: 'Copper (cp)', value: 'cp' },
            ))
        .addIntegerOption(opt =>
          opt.setName('amount')
            .setDescription('New amount (replaces current value)')
            .setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      await interaction.deferReply();
      const [money, items] = await Promise.all([
        api('/api/loot/money'),
        api('/api/loot'),
      ]);

      const moneyLine = ['pp', 'gp', 'ep', 'sp', 'cp']
        .filter(c => money[c])
        .map(c => `${money[c]} ${c}`)
        .join(' · ') || '(none)';

      let itemLines = '';
      if (items.length) {
        itemLines = items.map(i => {
          const qty = i.quantity > 1 ? ` ×${i.quantity}` : '';
          const val = i.value ? ` (${i.value})` : '';
          const loc = i.location ? ` [${i.location}]` : '';
          return `• ${i.name}${qty}${val}${loc}`;
        }).join('\n');
      } else {
        itemLines = '(none)';
      }

      const embed = new EmbedBuilder()
        .setTitle('Party Loot')
        .setColor(0xFEE75C)
        .addFields(
          { name: 'Money', value: moneyLine },
          { name: `Items (${items.length})`, value: itemLines.slice(0, 1024) },
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'add') {
      const name = interaction.options.getString('name');
      const tag = interaction.options.getString('tag');
      await interaction.deferReply({ ephemeral: true });

      const created = await api('/api/loot', { method: 'POST' });
      await api(`/api/loot/${created.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, tag }),
      });

      return interaction.editReply(`Added **${name}** (${tag}) to loot.`);
    }

    if (sub === 'remove') {
      const query = interaction.options.getString('name').toLowerCase();
      await interaction.deferReply({ ephemeral: true });

      const items = await api('/api/loot');
      const matches = items.filter(i => i.name.toLowerCase().includes(query));

      if (!matches.length) {
        return interaction.editReply(`No items matching \`${query}\` found.`);
      }
      if (matches.length > 1) {
        const list = matches.map(i => `• ${i.name}`).join('\n');
        return interaction.editReply(`Multiple matches — be more specific:\n${list}`);
      }

      await api(`/api/loot/${matches[0].id}`, { method: 'DELETE' });
      return interaction.editReply(`Removed **${matches[0].name}** from loot.`);
    }

    if (sub === 'money') {
      const coin = interaction.options.getString('coin');
      const amount = interaction.options.getInteger('amount');
      await interaction.deferReply({ ephemeral: true });

      const current = await api('/api/loot/money');
      const updated = { ...current, [coin]: amount };
      await api('/api/loot/money', {
        method: 'PUT',
        body: JSON.stringify(updated),
      });

      const coinName = COIN_NAMES[coin] || coin;
      return interaction.editReply(`Updated **${coinName}** to ${amount} ${coin}.`);
    }
  },
};
