// execute(interaction) — /dndcommands [all]: list all bot commands with one-line descriptions
//   ephemeral by default; pass all:True to post publicly
//   paginated at PAGE_SIZE commands per page; Prev/Next buttons update the embed in place
// handleComponent(interaction) — handles dc:PAGE button interactions

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const PAGE_SIZE = 25;

const COMMANDS = [
  { name: '/link <username> [password]',            desc: 'Link your Discord account to your web app user' },
  { name: '/roll <expression>',                     desc: 'Roll dice — e.g. `d20`, `2d6+3`, `1d8-1`; space-separate for multiple rolls' },
  { name: '/char create',                           desc: 'Step-by-step wizard to create a new character sheet' },
  { name: '/char select [number]',                  desc: 'List your characters, or set your active sheet by number' },
  { name: '/char view',                             desc: 'Show your full character sheet' },
  { name: '/char hp <amount>',                      desc: 'Heal (+) or damage (–) your active character\'s HP' },
  { name: '/char slots <level> <use|recover>',      desc: 'Expend or recover a spell slot on your active sheet' },
  { name: '/cond add <char> <name> <duration>',     desc: 'Add a condition to a party character' },
  { name: '/cond remove <char> <name>',             desc: 'Remove a condition from a party character' },
  { name: '/cond get [character]',                  desc: 'Show conditions for one character, or all party if omitted' },
  { name: '/cond tick',                             desc: 'Tick down all condition durations by 1, removing expired ones' },
  { name: '/loot view',                             desc: 'Show party money and item list' },
  { name: '/loot add <name> <tag>',                 desc: 'Add a loot item to the party stash' },
  { name: '/loot remove <name>',                    desc: 'Remove a loot item (partial name match)' },
  { name: '/loot money <add|subtract> <coin> <amt>', desc: 'Adjust party money' },
  { name: '/party',                                 desc: 'Show all linked members\' HP bars and active conditions' },
  { name: '/lookup spell <name>',                   desc: '5e spell reference with autocomplete' },
  { name: '/lookup feat <name>',                    desc: '5e feat reference with autocomplete' },
  { name: '/lookup feature <name>',                 desc: '5e class feature reference with autocomplete' },
  { name: '/res rage use [amount]',                 desc: 'Spend rage uses (default 1)' },
  { name: '/res rage recover [amount]',             desc: 'Recover rage uses (default 1)' },
  { name: '/res rage set <amount>',                 desc: 'Set rage uses to an exact value' },
  { name: '/res sd use [amount]',                   desc: 'Spend superiority dice (default 1)' },
  { name: '/res sd recover [amount]',               desc: 'Recover superiority dice (default 1)' },
  { name: '/res sd set <amount>',                   desc: 'Set superiority dice to an exact value' },
  { name: '/dndcommands [all]',                     desc: 'Show this command list (add `all:True` to post publicly)' },
];

/** Build the embed + optional button row for the given page (0-indexed). */
function buildPage(page) {
  const totalPages = Math.ceil(COMMANDS.length / PAGE_SIZE);
  const slice = COMMANDS.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setTitle('🎲 DnD Manager — Bot Commands')
    .setColor(0x5865F2)
    .setDescription(slice.map(c => `\`${c.name}\` — ${c.desc}`).join('\n'))
    .setFooter({ text: `Page ${page + 1} of ${totalPages}` });

  const components = [];
  if (totalPages > 1) {
    const row = new ActionRowBuilder();
    if (page > 0) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`dc:${page - 1}`)
          .setLabel('◀ Prev')
          .setStyle(ButtonStyle.Secondary),
      );
    }
    if (page < totalPages - 1) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`dc:${page + 1}`)
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary),
      );
    }
    if (row.components.length) components.push(row);
  }

  return { embed, components };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dndcommands')
    .setDescription('List all available bot commands')
    .addBooleanOption(opt =>
      opt.setName('all')
        .setDescription('Post to the channel so everyone can see (default: only visible to you)')
        .setRequired(false)),

  customIdPrefix: 'dc',

  async execute(interaction) {
    const sendAll = interaction.options.getBoolean('all') ?? false;
    const { embed, components } = buildPage(0);
    return interaction.reply({ embeds: [embed], components, ephemeral: !sendAll });
  },

  async handleComponent(interaction) {
    const page = parseInt(interaction.customId.split(':')[1], 10);
    const { embed, components } = buildPage(page);
    return interaction.update({ embeds: [embed], components });
  },
};
