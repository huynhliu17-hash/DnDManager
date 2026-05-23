const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { api } = require('../lib/api');

const COIN_NAMES = { pp: 'Platinum', gp: 'Gold', ep: 'Electrum', sp: 'Silver', cp: 'Copper' };
const COIN_TO_CP = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };
const COIN_ORDER = ['cp', 'sp', 'ep', 'gp', 'pp'];

function applySubtract(current, currency, amount) {
  const costCP = amount * COIN_TO_CP[currency];
  const totalCP = COIN_ORDER.reduce((sum, c) => sum + current[c] * COIN_TO_CP[c], 0);
  if (costCP > totalCP) return null; // insufficient funds

  let remainCP = costCP;
  const fromSelected = Math.min(current[currency], Math.floor(remainCP / COIN_TO_CP[currency]));
  current[currency] -= fromSelected;
  remainCP -= fromSelected * COIN_TO_CP[currency];

  for (const coin of COIN_ORDER) {
    if (coin === currency || remainCP <= 0) continue;
    const take = Math.min(current[coin], Math.ceil(remainCP / COIN_TO_CP[coin]));
    current[coin] -= take;
    remainCP -= take * COIN_TO_CP[coin];
  }

  if (remainCP < 0) {
    let change = Math.abs(remainCP);
    for (let i = COIN_ORDER.length - 1; i >= 0; i--) {
      const coin = COIN_ORDER[i];
      const val = COIN_TO_CP[coin];
      const count = Math.floor(change / val);
      if (count > 0) { current[coin] += count; change -= count * val; }
    }
    if (change > 0) current.cp += change;
  }

  return current;
}

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
        .setDescription('Add or subtract party money')
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Add or subtract')
            .setRequired(true)
            .addChoices(
              { name: 'Add', value: 'add' },
              { name: 'Subtract', value: 'subtract' },
            ))
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
            .setDescription('Amount to add or subtract')
            .setRequired(true)
            .setMinValue(1))),

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
      const action = interaction.options.getString('action');
      const coin = interaction.options.getString('coin');
      const amount = interaction.options.getInteger('amount');
      await interaction.deferReply({ ephemeral: true });

      const current = await api('/api/loot/money');
      const coinName = COIN_NAMES[coin] || coin;
      let updated;

      if (action === 'add') {
        updated = { ...current, [coin]: (current[coin] || 0) + amount };
      } else {
        updated = applySubtract({ ...current }, coin, amount);
        if (!updated) {
          return interaction.editReply(`Insufficient funds — the party cannot cover ${amount} ${coin}.`);
        }
      }

      await api('/api/loot/money', {
        method: 'PUT',
        body: JSON.stringify(updated),
      });

      const totalLine = COIN_ORDER.filter(c => updated[c]).map(c => `${updated[c]} ${c}`).join(' · ') || '0 cp';
      const sign = action === 'add' ? '+' : '-';
      return interaction.editReply(`${sign}${amount} ${coin} (${coinName}). Party total: ${totalLine}`);
    }
  },
};
