// execute(interaction) — /roll: parse dice expr, POST /api/dice/roll, reply with results

const { SlashCommandBuilder } = require('discord.js');
const { api } = require('../lib/api');
const { parseDiceExpr } = require('../lib/dice');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll dice (e.g. 2d6+3, d20, 1d8-1)')
    .addStringOption(opt =>
      opt.setName('expression')
        .setDescription('Dice expression, e.g. 2d6+3')
        .setRequired(true)),

  async execute(interaction) {
    const expr = interaction.options.getString('expression');
    const parsed = parseDiceExpr(expr);
    if (!parsed) {
      return interaction.reply({
        content: `Invalid dice expression \`${expr}\`. Examples: \`d20\`, \`2d6+3\`, \`1d8-1\``,
        ephemeral: true,
      });
    }

    const { diceType, count, modifier } = parsed;
    const data = await api('/api/dice/roll', {
      method: 'POST',
      body: JSON.stringify({ diceType, count }),
    });

    const total = data.total + modifier;
    const diceStr = data.results.join(', ');
    const modStr = modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${Math.abs(modifier)}` : '';
    const exprDisplay = `${count}${diceType}${modStr ? modStr.replace(' ', '') : ''}`;

    return interaction.reply(
      `**${interaction.user.displayName}** rolled \`${exprDisplay}\`\n` +
      `Dice: [${diceStr}]${modStr}\n` +
      `**Total: ${total}**`
    );
  },
};
