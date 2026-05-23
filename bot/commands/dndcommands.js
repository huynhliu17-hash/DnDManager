// execute(interaction) — /dndcommands: list all bot commands with one-line descriptions

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const COMMANDS = [
  { name: '/link <username> [password]',            desc: 'Link your Discord account to your web app user' },
  { name: '/roll <expression>',                     desc: 'Roll dice — e.g. `d20`, `2d6+3`, `1d8-1`' },
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
  { name: '/loot money <add|subtract> <coin> <amt>','desc': 'Adjust party money' },
  { name: '/party',                                 desc: 'Show all linked members\' HP bars and active conditions' },
  { name: '/lookup spell <name>',                   desc: '5e spell reference with autocomplete' },
  { name: '/lookup feat <name>',                    desc: '5e feat reference with autocomplete' },
  { name: '/lookup feature <name>',                 desc: '5e class feature reference with autocomplete' },
  { name: '/dndcommands',                           desc: 'Show this command list' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dndcommands')
    .setDescription('List all available bot commands'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🎲 DnD Manager — Bot Commands')
      .setColor(0x5865F2)
      .setDescription(
        COMMANDS.map(c => `\`${c.name}\` — ${c.desc}`).join('\n')
      );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
