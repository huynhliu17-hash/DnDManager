// Function index:
// resolveSheet(sheets, discordId)                               — pick active sheet from list
// buildProgressEmbed(data, completed, stepIdx, finished)        — wizard progress embed
// buildStepRow(step, userId)                                    — Fill in + Skip + Cancel buttons
// buildFinishRow(userId)                                        — Create Character + Cancel buttons
// buildModal(step, userId)                                      — Discord modal for a wizard step
// advanceState(state, stepId, collected)                        — update state after fill/skip
// handleComponent(interaction)                                  — dispatched by index.js for cc: customIds
// execute(interaction)                                          — /char slash command handler

const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { api } = require('../lib/api');
const { getWebAppUserId, getActiveSheetId, setActiveSheetId } = require('../lib/links');

// ── Shared helpers ────────────────────────────────────────────────

function resolveSheet(sheets, discordId) {
  const activeId = getActiveSheetId(discordId);
  if (activeId) {
    const found = sheets.find(s => String(s.id) === String(activeId));
    if (found) return found;
  }
  return sheets[0];
}

const LEVEL_NAMES = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th'];

// ── Creation Wizard ───────────────────────────────────────────────
// customId format: cc:<action>:<extra>:<userId>
//   cc:begin:<userId>          — welcome → step 0
//   cc:fill:<stepId>:<userId>  — open modal for this step
//   cc:skip:<stepId>:<userId>  — skip step, advance
//   cc:modal:<stepId>:<userId> — modal submitted
//   cc:done:<userId>           — finalize & save
//   cc:cancel:<userId>         — abort

/** In-memory wizard sessions: discordId → { step, data, completed } */
const CREATION_STATES = new Map();

const STEPS = [
  {
    id: 'identity',
    title: 'Identity',
    emoji: '🧝',
    inputs: [
      { id: 'character_name', label: 'Character Name', placeholder: 'Erevan Brightwood', short: true },
      { id: 'class_level',    label: 'Class & Level',  placeholder: 'Fighter 5',          short: true },
      { id: 'race',           label: 'Race',            placeholder: 'Human',              short: true },
      { id: 'background',     label: 'Background',      placeholder: 'Soldier',            short: true },
      { id: 'alignment',      label: 'Alignment',       placeholder: 'Chaotic Good',       short: true },
    ],
  },
  {
    id: 'player',
    title: 'Player Details',
    emoji: '📋',
    inputs: [
      { id: 'player_name',       label: 'Player Name',          placeholder: 'Your real name', short: true },
      { id: 'hit_dice',          label: 'Hit Dice',              placeholder: '5d10',           short: true },
      { id: 'experience_points', label: 'Experience Points',     placeholder: '0',              short: true, int: true },
      { id: 'proficiency_bonus', label: 'Proficiency Bonus',     placeholder: '2',              short: true, int: true },
      { id: 'inspiration',       label: 'Inspiration (0 or 1)', placeholder: '0',              short: true, int: true },
    ],
  },
  {
    id: 'ability_scores',
    title: 'Ability Scores',
    emoji: '💪',
    inputs: [
      {
        id: 'scores',
        label: 'STR DEX CON INT WIS CHA (space-separated)',
        placeholder: '15 14 13 12 10 8',
        short: true,
        parse(val) {
          const nums = val.trim().split(/[\s,]+/).map(Number);
          if (nums.length !== 6 || nums.some(n => isNaN(n))) return null;
          const [strength, dexterity, constitution, intelligence, wisdom, charisma] = nums;
          return { strength, dexterity, constitution, intelligence, wisdom, charisma };
        },
      },
    ],
  },
  {
    id: 'combat',
    title: 'Combat Stats',
    emoji: '⚔️',
    inputs: [
      { id: 'armor_class', label: 'Armor Class',        placeholder: '16', short: true, int: true },
      { id: 'max_hp',      label: 'Max HP',              placeholder: '45', short: true, int: true },
      { id: 'current_hp',  label: 'Current HP',          placeholder: '45', short: true, int: true },
      { id: 'speed',       label: 'Speed (ft)',          placeholder: '30', short: true, int: true },
      { id: 'initiative',  label: 'Initiative Modifier', placeholder: '2',  short: true, int: true },
    ],
  },
  {
    id: 'personality',
    title: 'Personality',
    emoji: '🎭',
    inputs: [
      { id: 'personality_traits', label: 'Personality Traits', placeholder: 'I am always calm...', short: false },
      { id: 'ideals',             label: 'Ideals',             placeholder: 'Greater Good',          short: false },
      { id: 'bonds',              label: 'Bonds',              placeholder: 'My village...',          short: false },
      { id: 'flaws',              label: 'Flaws',              placeholder: 'I struggle with trust.', short: false },
    ],
  },
  {
    id: 'features',
    title: 'Features & Equipment',
    emoji: '✨',
    inputs: [
      { id: 'features_traits', label: 'Features & Traits', placeholder: 'Second Wind, Action Surge...', short: false },
      { id: 'equipment',       label: 'Equipment',          placeholder: 'Longsword, Shield, Chain Mail...', short: false },
    ],
  },
  {
    id: 'lore',
    title: 'Backstory & Lore',
    emoji: '📖',
    inputs: [
      { id: 'backstory',            label: 'Backstory',              placeholder: 'Born in a small village...', short: false },
      { id: 'allies_organizations', label: 'Allies & Organizations', placeholder: 'The Harpers...',             short: false },
      { id: 'additional_features',  label: 'Additional Features',    placeholder: 'Darkvision 60 ft...',        short: false },
      { id: 'treasure',             label: 'Treasure',               placeholder: 'Ring of Protection +1...',   short: false },
    ],
  },
  {
    id: 'money',
    title: 'Starting Money',
    emoji: '💰',
    inputs: [
      { id: 'cp', label: 'Copper Pieces (CP)',   placeholder: '0', short: true, int: true },
      { id: 'sp', label: 'Silver Pieces (SP)',   placeholder: '0', short: true, int: true },
      { id: 'ep', label: 'Electrum Pieces (EP)', placeholder: '0', short: true, int: true },
      { id: 'gp', label: 'Gold Pieces (GP)',     placeholder: '0', short: true, int: true },
      { id: 'pp', label: 'Platinum Pieces (PP)', placeholder: '0', short: true, int: true },
    ],
  },
];

function buildProgressEmbed(data, completed, stepIdx, finished = false) {
  const stepLines = STEPS.map((s, i) => {
    if (completed.includes(s.id)) return `✅ ${s.emoji} ${s.title}`;
    if (i === stepIdx && !finished)  return `▶️ ${s.emoji} ${s.title}`;
    return `⬜ ${s.emoji} ${s.title}`;
  });

  const preview = [];
  if (data.character_name || data.class_level || data.race) {
    const parts = [data.class_level, data.race].filter(Boolean).join(' · ');
    preview.push(`**${data.character_name || 'Unnamed'}**${parts ? `  —  ${parts}` : ''}`);
  }
  if (data.strength != null) {
    preview.push(
      `STR ${data.strength}  DEX ${data.dexterity}  CON ${data.constitution}` +
      `  INT ${data.intelligence}  WIS ${data.wisdom}  CHA ${data.charisma}`
    );
  }
  if (data.max_hp != null) {
    preview.push(`HP ${data.current_hp ?? data.max_hp}/${data.max_hp}  AC ${data.armor_class ?? '—'}  Speed ${data.speed ?? '—'} ft`);
  }

  const embed = new EmbedBuilder()
    .setColor(finished ? 0x57F287 : 0x5865F2)
    .setTitle(finished ? '✅ Character Created!' : '🧙 Character Creation Wizard');

  if (finished) {
    embed.setDescription(
      `Your character **${data.character_name || 'Unnamed'}** has been saved.\n` +
      `Use \`/char view\` to see it, or open the website to fill in remaining details.`
    );
  } else if (stepIdx < STEPS.length) {
    const step = STEPS[stepIdx];
    embed.setDescription(
      `**${step.emoji} ${step.title}**\n` +
      step.inputs.map(i => `• ${i.label}`).join('\n') +
      '\n\nClick **Fill in** to open the form, or **Skip** to leave this step blank.'
    );
  } else {
    embed.setDescription('All steps done! Click **Create Character** to save, or **Cancel** to discard.');
  }

  embed.addFields({ name: 'Progress', value: stepLines.join('\n') });
  if (preview.length) embed.addFields({ name: 'Preview', value: preview.join('\n') });

  return embed;
}

function buildStepRow(step, userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cc:fill:${step.id}:${userId}`)
      .setLabel(`Fill in ${step.title}`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`cc:skip:${step.id}:${userId}`)
      .setLabel('Skip')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`cc:cancel:${userId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger),
  );
}

function buildFinishRow(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cc:done:${userId}`)
      .setLabel('✅ Create Character')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`cc:cancel:${userId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger),
  );
}

function buildModal(step, userId) {
  const modal = new ModalBuilder()
    .setCustomId(`cc:modal:${step.id}:${userId}`)
    .setTitle(`${step.emoji} ${step.title}`);

  for (const inp of step.inputs) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(inp.id)
          .setLabel(inp.label)
          .setStyle(inp.short ? TextInputStyle.Short : TextInputStyle.Paragraph)
          .setPlaceholder(inp.placeholder)
          .setRequired(false),
      ),
    );
  }
  return modal;
}

/** Advance state.step past stepId; merge collected fields into state.data if provided. */
function advanceState(state, stepId, collected) {
  const idx = STEPS.findIndex(s => s.id === stepId);
  if (collected && Object.keys(collected).length > 0) {
    Object.assign(state.data, collected);
    if (!state.completed.includes(stepId)) state.completed.push(stepId);
  }
  state.step = idx + 1;
}

async function handleComponent(interaction) {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const discordId = interaction.user.id;

  // Validate session ownership encoded in customId
  const ownerId = (action === 'fill' || action === 'skip' || action === 'modal') ? parts[3] : parts[2];
  if (ownerId !== discordId) {
    return interaction.reply({ content: "This isn't your character creation session.", ephemeral: true });
  }

  // ── cancel ────────────────────────────────────────────────────
  if (action === 'cancel') {
    CREATION_STATES.delete(discordId);
    return interaction.update({ content: '❌ Character creation cancelled.', embeds: [], components: [] });
  }

  // ── begin ─────────────────────────────────────────────────────
  if (action === 'begin') {
    const state = { step: 0, data: {}, completed: [] };
    CREATION_STATES.set(discordId, state);
    return interaction.update({
      embeds: [buildProgressEmbed(state.data, state.completed, 0)],
      components: [buildStepRow(STEPS[0], discordId)],
    });
  }

  // ── fill — show modal ─────────────────────────────────────────
  if (action === 'fill') {
    const step = STEPS.find(s => s.id === parts[2]);
    if (!step) return;
    // Recover gracefully if state was lost (bot restart mid-wizard)
    if (!CREATION_STATES.has(discordId)) {
      CREATION_STATES.set(discordId, { step: STEPS.indexOf(step), data: {}, completed: [] });
    }
    return interaction.showModal(buildModal(step, discordId));
  }

  // ── skip ──────────────────────────────────────────────────────
  if (action === 'skip') {
    const state = CREATION_STATES.get(discordId);
    if (!state) {
      return interaction.update({ content: '⚠️ Session expired — run `/char create` again.', embeds: [], components: [] });
    }
    advanceState(state, parts[2], null);

    const components = state.step >= STEPS.length
      ? [buildFinishRow(discordId)]
      : [buildStepRow(STEPS[state.step], discordId)];

    return interaction.update({
      embeds: [buildProgressEmbed(state.data, state.completed, state.step)],
      components,
    });
  }

  // ── modal submitted ───────────────────────────────────────────
  if (action === 'modal') {
    const step = STEPS.find(s => s.id === parts[2]);
    if (!step) return;

    const state = CREATION_STATES.get(discordId) || { step: 0, data: {}, completed: [] };
    const collected = {};
    let parseWarning = null;

    for (const inp of step.inputs) {
      let val;
      try { val = interaction.fields.getTextInputValue(inp.id); } catch { val = ''; }
      if (!val?.trim()) continue;

      if (inp.parse) {
        const parsed = inp.parse(val.trim());
        if (parsed) {
          Object.assign(collected, parsed);
        } else {
          parseWarning = `⚠️ Couldn't parse ability scores — expected 6 numbers like \`15 14 13 12 10 8\`. Step skipped.`;
        }
      } else if (inp.int) {
        const n = parseInt(val, 10);
        if (!isNaN(n)) collected[inp.id] = n;
      } else {
        collected[inp.id] = val.trim();
      }
    }

    advanceState(state, step.id, collected);
    CREATION_STATES.set(discordId, state);

    const components = state.step >= STEPS.length
      ? [buildFinishRow(discordId)]
      : [buildStepRow(STEPS[state.step], discordId)];

    const embed = buildProgressEmbed(state.data, state.completed, state.step);
    if (parseWarning) embed.setFooter({ text: parseWarning });

    return interaction.update({ embeds: [embed], components });
  }

  // ── done — persist character ──────────────────────────────────
  if (action === 'done') {
    const state = CREATION_STATES.get(discordId);
    if (!state) {
      return interaction.update({ content: '⚠️ Session expired — run `/char create` again.', embeds: [], components: [] });
    }

    const webUserId = getWebAppUserId(discordId);
    if (!webUserId) {
      return interaction.update({ content: 'You are not linked. Use `/link <username>` first.', embeds: [], components: [] });
    }

    await interaction.deferUpdate();

    try {
      // Create an empty sheet, then patch with all collected data
      const sheet = await api('/api/characters', { method: 'POST', body: '{}' }, webUserId);

      if (Object.keys(state.data).length > 0) {
        await api(`/api/characters/${sheet.id}`, {
          method: 'PUT',
          body: JSON.stringify(state.data),
        }, webUserId);
      }

      setActiveSheetId(discordId, sheet.id);
      CREATION_STATES.delete(discordId);

      return interaction.editReply({
        embeds: [buildProgressEmbed(state.data, state.completed, STEPS.length, true)],
        components: [],
      });
    } catch (err) {
      console.error('char create error:', err);
      return interaction.editReply({
        content: '❌ Failed to create character. Check bot logs.',
        embeds: [],
        components: [],
      });
    }
  }
}

// ── Slash command ─────────────────────────────────────────────────

module.exports = {
  customIdPrefix: 'cc',
  handleComponent,

  data: new SlashCommandBuilder()
    .setName('char')
    .setDescription('View or update your character')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new character sheet step-by-step'))
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View your character sheet'))
    .addSubcommand(sub =>
      sub.setName('select')
        .setDescription('Set your active character sheet')
        .addIntegerOption(opt =>
          opt.setName('number')
            .setDescription('Character number from the list (omit to list all)')
            .setRequired(false)
            .setMinValue(1)))
    .addSubcommand(sub =>
      sub.setName('hp')
        .setDescription('Apply HP change (+heal / -damage)')
        .addIntegerOption(opt =>
          opt.setName('amount')
            .setDescription('Amount to heal (+) or damage (-)')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('slots')
        .setDescription('Use or recover a spell slot')
        .addIntegerOption(opt =>
          opt.setName('level')
            .setDescription('Spell slot level (1–9)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(9))
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Use (expend) or recover a slot')
            .setRequired(true)
            .addChoices(
              { name: 'Use (expend)', value: 'use' },
              { name: 'Recover', value: 'recover' },
            ))),

  async execute(interaction) {
    const userId = getWebAppUserId(interaction.user.id);
    if (!userId) {
      return interaction.reply({
        content: 'You have not linked your account yet. Use `/link <username>` first.',
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();

    // ── create ───────────────────────────────────────────────────
    if (sub === 'create') {
      const welcomeEmbed = new EmbedBuilder()
        .setTitle('🧙 Character Creation Wizard')
        .setColor(0x5865F2)
        .setDescription(
          'This wizard will guide you through creating a new character sheet.\n\n' +
          '**Steps:**\n' +
          STEPS.map(s => `${s.emoji} **${s.title}**`).join('  ·  ') +
          '\n\nYou can **skip** any step and fill it in later on the website.\n\n' +
          'Click **Begin** when you\'re ready!'
        );

      return interaction.reply({
        embeds: [welcomeEmbed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`cc:begin:${interaction.user.id}`)
              .setLabel('▶️ Begin')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`cc:cancel:${interaction.user.id}`)
              .setLabel('Cancel')
              .setStyle(ButtonStyle.Danger),
          ),
        ],
        ephemeral: true,
      });
    }

    // ── select ───────────────────────────────────────────────────
    if (sub === 'select') {
      await interaction.deferReply({ ephemeral: true });
      const sheets = await api(`/api/players/${userId}/characters`, {}, userId);
      if (!sheets.length) return interaction.editReply('No characters found for your account.');

      const number = interaction.options.getInteger('number');

      if (number === null) {
        const activeId = getActiveSheetId(interaction.user.id);
        const list = sheets.map((s, i) => {
          const active = String(s.id) === String(activeId) ? ' ✓' : '';
          return `**${i + 1}.** ${s.character_name || 'Unnamed Character'}${active}`;
        }).join('\n');
        return interaction.editReply(`Your characters:\n${list}\n\nUse \`/char select <number>\` to switch.`);
      }

      if (number > sheets.length) {
        return interaction.editReply(`Invalid number. You have ${sheets.length} character(s).`);
      }

      const chosen = sheets[number - 1];
      setActiveSheetId(interaction.user.id, chosen.id);
      return interaction.editReply(`Active character set to **${chosen.character_name || 'Unnamed Character'}**.`);
    }

    // ── slots ────────────────────────────────────────────────────
    if (sub === 'slots') {
      const level = interaction.options.getInteger('level');
      const action = interaction.options.getString('action');
      await interaction.deferReply();

      const sheets = await api(`/api/players/${userId}/characters`, {}, userId);
      if (!sheets.length) return interaction.editReply('No character found for your account.');
      const active = resolveSheet(sheets, interaction.user.id);
      const sheet = await api(`/api/players/${userId}/characters/${active.id}`, {}, userId);

      let slots;
      try { slots = JSON.parse(sheet.spell_slots || '[]'); } catch { slots = []; }
      while (slots.length < 9) slots.push({ pips: Array(4).fill(false) });
      slots = slots.map(s => (s.pips ? s : { pips: Array(4).fill(false) }));

      const levelIdx = level - 1;
      const slot = slots[levelIdx];
      if (!slot.pips) slot.pips = Array(4).fill(false);

      const filled = slot.pips.filter(Boolean).length;
      const total = slot.pips.length;

      if (action === 'use') {
        if (filled >= total) {
          return interaction.editReply(`No ${LEVEL_NAMES[levelIdx]}-level spell slots remaining.`);
        }
        slot.pips = Array(total).fill(false).map((_, i) => i < filled + 1);
      } else {
        if (filled === 0) {
          return interaction.editReply(`All ${LEVEL_NAMES[levelIdx]}-level spell slots are already recovered.`);
        }
        slot.pips = Array(total).fill(false).map((_, i) => i < filled - 1);
      }

      await api(`/api/characters/${active.id}`, {
        method: 'PUT',
        body: JSON.stringify({ spell_slots: JSON.stringify(slots) }),
      }, userId);

      const newFilled = slot.pips.filter(Boolean).length;
      const pipsDisplay = slot.pips.map(p => p ? '●' : '○').join(' ');

      const embed = new EmbedBuilder()
        .setTitle(sheet.character_name || 'Unnamed Character')
        .setColor(action === 'use' ? 0xED4245 : 0x57F287)
        .addFields({
          name: `${LEVEL_NAMES[levelIdx]}-Level Spell Slots`,
          value: `${pipsDisplay}\n${total - newFilled} of ${total} remaining`,
        });

      return interaction.editReply({ embeds: [embed] });
    }

    // ── view ─────────────────────────────────────────────────────
    if (sub === 'view') {
      await interaction.deferReply();
      const sheets = await api(`/api/players/${userId}/characters`, {}, userId);
      if (!sheets.length) return interaction.editReply('No character found for your account.');
      const active = resolveSheet(sheets, interaction.user.id);
      const sheet = await api(`/api/players/${userId}/characters/${active.id}`, {}, userId);

      const viewFields = [
        { name: 'Race / Class', value: `${sheet.race || '—'} / ${sheet.class_level || '—'}`, inline: true },
        { name: 'AC', value: String(sheet.armor_class ?? '—'), inline: true },
        { name: 'HP', value: `${sheet.current_hp ?? 0} / ${sheet.max_hp ?? 0}${sheet.temp_hp ? ` (+${sheet.temp_hp} temp)` : ''}`, inline: true },
        { name: 'STR', value: String(sheet.strength ?? '—'), inline: true },
        { name: 'DEX', value: String(sheet.dexterity ?? '—'), inline: true },
        { name: 'CON', value: String(sheet.constitution ?? '—'), inline: true },
        { name: 'INT', value: String(sheet.intelligence ?? '—'), inline: true },
        { name: 'WIS', value: String(sheet.wisdom ?? '—'), inline: true },
        { name: 'CHA', value: String(sheet.charisma ?? '—'), inline: true },
      ];
      if (sheet.rage_uses > 0) {
        viewFields.push({ name: 'Rage Uses', value: String(sheet.rage_uses), inline: true });
      }
      if (sheet.superiority_dice > 0) {
        viewFields.push({ name: 'Superiority Dice', value: String(sheet.superiority_dice), inline: true });
      }

      const embed = new EmbedBuilder()
        .setTitle(sheet.character_name || 'Unnamed Character')
        .setColor(0x5865F2)
        .addFields(...viewFields);

      return interaction.editReply({ embeds: [embed] });
    }

    // ── hp ───────────────────────────────────────────────────────
    if (sub === 'hp') {
      const amount = interaction.options.getInteger('amount');
      await interaction.deferReply();

      const sheets = await api(`/api/players/${userId}/characters`, {}, userId);
      if (!sheets.length) return interaction.editReply('No character found for your account.');
      const active = resolveSheet(sheets, interaction.user.id);
      const sheet = await api(`/api/players/${userId}/characters/${active.id}`, {}, userId);

      const oldHp = sheet.current_hp ?? 0;
      const maxHp = sheet.max_hp ?? 0;
      const newHp = Math.min(maxHp, Math.max(0, oldHp + amount));

      await api(`/api/characters/${active.id}`, {
        method: 'PUT',
        body: JSON.stringify({ current_hp: newHp }),
      }, userId);

      const sign = amount >= 0 ? `+${amount}` : String(amount);
      const embed = new EmbedBuilder()
        .setTitle(sheet.character_name || 'Unnamed Character')
        .setColor(amount >= 0 ? 0x57F287 : 0xED4245)
        .addFields(
          { name: 'HP Change', value: sign, inline: true },
          { name: 'Old HP', value: `${oldHp} / ${maxHp}`, inline: true },
          { name: 'New HP', value: `${newHp} / ${maxHp}`, inline: true },
        );

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
