const { SlashCommandBuilder } = require('discord.js');
const { setLink, resolveUsername } = require('../lib/links');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account to a DnD Manager web app user')
    .addStringOption(opt =>
      opt.setName('username')
        .setDescription('Your web app username')
        .setRequired(true)),

  async execute(interaction) {
    const username = interaction.options.getString('username');
    const player = await resolveUsername(username);
    if (!player) {
      return interaction.reply({
        content: `No web app user found with username \`${username}\`. Check spelling and try again.`,
        ephemeral: true,
      });
    }

    setLink(interaction.user.id, player.id);
    return interaction.reply({
      content: `Linked to **${player.username}** (id: ${player.id}).`,
      ephemeral: true,
    });
  },
};
