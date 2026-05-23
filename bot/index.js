require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const commandsDir = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'))) {
  const cmd = require(path.join(commandsDir, file));
  client.commands.set(cmd.data.name, cmd);
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  // ── Autocomplete ──────────────────────────────────────────────
  if (interaction.isAutocomplete()) {
    const cmd = client.commands.get(interaction.commandName);
    if (cmd?.autocomplete) await cmd.autocomplete(interaction).catch(() => {});
    return;
  }

  // ── Buttons & Modals — route by customId prefix ───────────────
  if (interaction.isButton() || interaction.isModalSubmit()) {
    const prefix = interaction.customId.split(':')[0];
    for (const cmd of client.commands.values()) {
      if (cmd.customIdPrefix === prefix && cmd.handleComponent) {
        try {
          await cmd.handleComponent(interaction);
        } catch (err) {
          console.error(`Error in component handler (${prefix}):`, err);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'An error occurred. Check bot logs.', ephemeral: true }).catch(() => {});
          }
        }
        return;
      }
    }
    return;
  }

  // ── Slash commands ────────────────────────────────────────────
  if (!interaction.isChatInputCommand()) return;
  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  try {
    await cmd.execute(interaction);
  } catch (err) {
    console.error(`Error in /${interaction.commandName}:`, err);
    const msg = { content: 'An error occurred. Check the bot logs.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
});

client.login(process.env.BOT_TOKEN);
