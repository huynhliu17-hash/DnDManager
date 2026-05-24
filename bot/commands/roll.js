// execute(interaction) — /roll: parse one or more dice exprs, POST /api/dice/roll for each, reply with results

const { SlashCommandBuilder } = require('discord.js');
const { api } = require('../lib/api');
const { parseDiceExpr } = require('../lib/dice');
const { getWebAppUserId, getActiveSheetId } = require('../lib/links');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll one or more dice expressions (e.g. 2d6+3, d20 1d8-1, 2d12+3+5)')
    .addStringOption(opt =>
      opt.setName('expression')
        .setDescription('One or more dice expressions separated by spaces, e.g. 2d6+3 1d8+2')
        .setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('use_sd')
        .setDescription('Number of superiority dice to expend (decrements your sheet)')
        .setMinValue(1)
        .setRequired(false)),

  async execute(interaction) {
    const input  = interaction.options.getString('expression');
    const useSd  = interaction.options.getInteger('use_sd');
    const exprs  = input.trim().split(/\s+/);

    // Parse all expressions upfront — reject on first invalid
    const parsed = [];
    for (const expr of exprs) {
      const p = parseDiceExpr(expr);
      if (!p) {
        return interaction.reply({
          content: `Invalid dice expression \`${expr}\`. Examples: \`d20\`, \`2d6+3\`, \`1d8-1\`, \`2d12+3+5\``,
          ephemeral: true,
        });
      }
      parsed.push({ expr, ...p });
    }

    // Roll all in parallel
    const rolls = await Promise.all(
      parsed.map(({ diceType, count }) =>
        api('/api/dice/roll', {
          method: 'POST',
          body: JSON.stringify({ diceType, count }),
        })
      )
    );

    // Build canonical label for each expression (e.g. "2d12+15" from "2d12+3+5+7")
    const labels = parsed.map(({ count, diceType, modifier }) => {
      const modStr = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : '';
      return `${count}${diceType}${modStr}`;
    });

    const lines = [];
    lines.push(`**${interaction.user.displayName}** rolled ${labels.map(l => `\`${l}\``).join(' ')}`);

    let grandTotal = 0;

    for (let i = 0; i < parsed.length; i++) {
      const { modifier } = parsed[i];
      const data = rolls[i];
      const total = data.total + modifier;
      grandTotal += total;

      const diceStr = data.results.join(', ');
      const modStr = modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${Math.abs(modifier)}` : '';

      if (parsed.length === 1) {
        // Single-expression: original compact layout
        lines.push(`Dice: [${diceStr}]${modStr}`);
        lines.push(`**Total: ${total}**`);
      } else {
        // Multi-expression: one line per roll
        lines.push(`\`${labels[i]}\` → [${diceStr}]${modStr} = **${total}**`);
      }
    }

    if (parsed.length > 1) {
      lines.push(`**Grand Total: ${grandTotal}**`);
    }

    // Superiority dice expenditure
    if (useSd) {
      const sdLine = await spendSuperiorityDice(interaction, useSd);
      lines.push(sdLine);
    }

    return interaction.reply(lines.join('\n'));
  },
};

// ── Helpers ───────────────────────────────────────────────────────

async function spendSuperiorityDice(interaction, spend) {
  const userId = getWebAppUserId(interaction.user.id);
  if (!userId) return '🎲 SD: *(account not linked — dice not decremented)*';

  try {
    const sheets = await api(`/api/players/${userId}/characters`, {}, userId);
    if (!sheets || !sheets.length) return '🎲 SD: *(no character found — dice not decremented)*';

    const activeId = getActiveSheetId(interaction.user.id);
    const active   = (activeId && sheets.find(s => String(s.id) === String(activeId))) || sheets[0];
    const sheet    = await api(`/api/players/${userId}/characters/${active.id}`, {}, userId);

    const oldVal = sheet.superiority_dice ?? 0;
    const newVal = Math.max(0, oldVal - spend);
    const spent  = oldVal - newVal; // may be less than `spend` if we hit 0

    await api(`/api/characters/${active.id}`, {
      method: 'PUT',
      body: JSON.stringify({ superiority_dice: newVal }),
    }, userId);

    const note = spent < spend ? ` *(only ${spent} remaining)*` : '';
    return `🎲 Superiority Dice: ${oldVal} → **${newVal}**${note}`;
  } catch {
    return '🎲 SD: *(error updating sheet)*';
  }
}
