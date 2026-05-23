const { SlashCommandBuilder } = require('discord.js');
const { setLink, verifyCredentials } = require('../lib/links');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Discord account to a DnD Manager web app user')
    .addStringOption(opt =>
      opt.setName('username')
        .setDescription('Your web app username')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('password')
        .setDescription('Your web app password (required if your account has one)')
        .setRequired(false)),

  async execute(interaction) {
    const username = interaction.options.getString('username');
    const password = interaction.options.getString('password');

    let result;
    try {
      result = await verifyCredentials(username, password);
    } catch (err) {
      if (err.message.includes('404')) {
        return interaction.reply({
          content: `No web app user found with username \`${username}\`. Check spelling and try again.`,
          ephemeral: true,
        });
      }
      throw err;
    }

    if (!result.valid) {
      const msg = result.requiresPassword && !password
        ? `The account \`${username}\` requires a password. Use \`/link username:${username} password:yourpassword\``
        : `Incorrect password for \`${username}\`.`;
      return interaction.reply({ content: msg, ephemeral: true });
    }

    setLink(interaction.user.id, result.userId);
    return interaction.reply({
      content: `Linked to **${result.username}** (id: ${result.userId}).`,
      ephemeral: true,
    });
  },
};
