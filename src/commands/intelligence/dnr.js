// ============================================================
// src/commands/intelligence/dnr.js
// /dnr — Do Not Raid list management
// Alliances on this list must not be attacked by our members
// ============================================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { query, run, queryOne } = require('../../utils/database');
const { resolveAlliance } = require('../../utils/pwApi');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dnr')
    .setDescription('Manage the Do Not Raid (DNR) list')

    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add an alliance to the DNR list')
        .addStringOption(opt =>
          opt.setName('alliance')
            .setDescription('Alliance name, ID, or P&W link')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('reason')
            .setDescription('Why this alliance is on the DNR list (e.g. "Treaty partner", "Protected")')
        )
    )

    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove an alliance from the DNR list')
        .addStringOption(opt =>
          opt.setName('alliance')
            .setDescription('Alliance name, ID, or P&W link')
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Show the full DNR list')
    )

    .addSubcommand(sub =>
      sub.setName('check')
        .setDescription('Check if a specific alliance or nation is on the DNR list')
        .addStringOption(opt =>
          opt.setName('alliance')
            .setDescription('Alliance name, ID, or P&W link')
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub.setName('settings')
        .setDescription('Configure DNR enforcement settings')
        .addStringOption(opt =>
          opt.setName('ingame_message')
            .setDescription('Custom in-game message sent to the member who violated DNR')
        )
        .addStringOption(opt =>
          opt.setName('dm_message')
            .setDescription('Custom Discord DM message sent to the violating member')
        )
    ),

  requiredRole: 'government',

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ── ADD ─────────────────────────────────────────────────
    if (sub === 'add') {
      await interaction.deferReply({ flags: 64 });
      const input  = interaction.options.getString('alliance');
      const reason = interaction.options.getString('reason') || 'No reason specified';

      await interaction.editReply(`🔍 Looking up **${input}**...`);

      const alliance = await resolveAlliance(input);
      if (!alliance) {
        return interaction.editReply(`❌ Could not find alliance **"${input}"**. Try name, ID, or P&W link.`);
      }

      const existing = queryOne(
        'SELECT id FROM dnr_list WHERE guild_id = ? AND alliance_id = ?',
        [interaction.guildId, alliance.id]
      );

      if (existing) {
        run(
          'UPDATE dnr_list SET reason = ?, updated_at = datetime(\'now\') WHERE guild_id = ? AND alliance_id = ?',
          [reason, interaction.guildId, alliance.id]
        );
        return interaction.editReply(`✅ Updated **${alliance.name}** on the DNR list.\nReason: _${reason}_`);
      }

      run(
        `INSERT INTO dnr_list (guild_id, alliance_id, alliance_name, reason, added_by)
         VALUES (?, ?, ?, ?, ?)`,
        [interaction.guildId, alliance.id, alliance.name, reason, interaction.user.id]
      );

      return interaction.editReply(
        `✅ Added **${alliance.name}** (ID: ${alliance.id}) to the DNR list.\n` +
        `Reason: _${reason}_\n\n` +
        `The bot will now monitor for any wars declared against their members and alert immediately.`
      );
    }

    // ── REMOVE ───────────────────────────────────────────────
    if (sub === 'remove') {
      await interaction.deferReply({ flags: 64 });
      const input = interaction.options.getString('alliance');

      // Try local DB first
      let entry = queryOne(
        'SELECT * FROM dnr_list WHERE guild_id = ? AND LOWER(alliance_name) = LOWER(?)',
        [interaction.guildId, input.trim()]
      );

      if (!entry && /^\d+$/.test(input.trim())) {
        entry = queryOne(
          'SELECT * FROM dnr_list WHERE guild_id = ? AND alliance_id = ?',
          [interaction.guildId, parseInt(input)]
        );
      }

      if (!entry) {
        await interaction.editReply(`🔍 Looking up **${input}**...`);
        const alliance = await resolveAlliance(input);
        if (alliance) {
          entry = queryOne(
            'SELECT * FROM dnr_list WHERE guild_id = ? AND alliance_id = ?',
            [interaction.guildId, alliance.id]
          );
        }
      }

      if (!entry) {
        return interaction.editReply(`❌ **"${input}"** is not on the DNR list.`);
      }

      run('DELETE FROM dnr_list WHERE guild_id = ? AND alliance_id = ?',
        [interaction.guildId, entry.alliance_id]);

      return interaction.editReply(`✅ Removed **${entry.alliance_name}** from the DNR list.`);
    }

    // ── LIST ─────────────────────────────────────────────────
    if (sub === 'list') {
      const entries = query(
        'SELECT * FROM dnr_list WHERE guild_id = ? ORDER BY alliance_name ASC',
        [interaction.guildId]
      ).rows;

      if (entries.length === 0) {
        return interaction.reply({
          content: '📋 The DNR list is empty. Use `/dnr add` to add alliances.',
          flags: 64,
        });
      }

      const lines = entries.map((e, i) =>
        `**${i + 1}.** **[${e.alliance_name}](https://politicsandwar.com/alliance/id=${e.alliance_id})** (ID: \`${e.alliance_id}\`)\n` +
        `└ Reason: _${e.reason || 'None specified'}_`
      );

      const embed = new EmbedBuilder()
        .setTitle(`🚫 Do Not Raid List — ${entries.length} alliance(s)`)
        .setColor(0xe74c3c)
        .setDescription(
          '⚠️ Members must **NOT** declare war on nations in these alliances.\n' +
          'Violations will trigger an immediate alert and peace request.\n\n' +
          lines.join('\n\n')
        )
        .setFooter({ text: 'Use /dnr add or /dnr remove to manage this list' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    // ── CHECK ────────────────────────────────────────────────
    if (sub === 'check') {
      await interaction.deferReply({ flags: 64 });
      const input = interaction.options.getString('alliance');

      await interaction.editReply(`🔍 Looking up **${input}**...`);
      const alliance = await resolveAlliance(input);
      if (!alliance) {
        return interaction.editReply(`❌ Could not find alliance **"${input}"**.`);
      }

      const entry = queryOne(
        'SELECT * FROM dnr_list WHERE guild_id = ? AND alliance_id = ?',
        [interaction.guildId, alliance.id]
      );

      if (entry) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('🚫 DNR — Alliance Found on List')
              .setColor(0xe74c3c)
              .addFields(
                { name: '🏛️ Alliance', value: `[${alliance.name}](https://politicsandwar.com/alliance/id=${alliance.id})`, inline: true },
                { name: '⚠️ Status', value: '**ON DNR LIST** — Do Not Attack', inline: true },
                { name: '📝 Reason', value: entry.reason || 'None specified', inline: false },
              )
              .setTimestamp(),
          ],
        });
      } else {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ DNR — Alliance Not on List')
              .setColor(0x2ecc71)
              .setDescription(`**${alliance.name}** is NOT on the DNR list.`)
              .setTimestamp(),
          ],
        });
      }
    }

    // ── SETTINGS ─────────────────────────────────────────────
    if (sub === 'settings') {
      const ingameMsg = interaction.options.getString('ingame_message');
      const dmMsg     = interaction.options.getString('dm_message');

      if (!ingameMsg && !dmMsg) {
        // Show current settings
        const igRow = queryOne(
          `SELECT setting_value FROM alert_settings WHERE guild_id = ? AND alert_type = 'dnr' AND setting_key = 'ingame_message'`,
          [interaction.guildId]
        );
        const dmRow = queryOne(
          `SELECT setting_value FROM alert_settings WHERE guild_id = ? AND alert_type = 'dnr' AND setting_key = 'dm_message'`,
          [interaction.guildId]
        );

        const defaultIngame = 'URGENT: You have declared war on a DNR alliance. Please offer peace IMMEDIATELY to avoid diplomatic consequences.';
        const defaultDm     = 'You have declared war on a nation in our DNR list. Please log into Politics & War and offer peace immediately.';

        const embed = new EmbedBuilder()
          .setTitle('⚙️ DNR Settings')
          .setColor(0x3498db)
          .addFields(
            {
              name: '📨 In-Game Message (sent to violating member)',
              value: igRow?.setting_value || `_Default:_ ${defaultIngame}`,
            },
            {
              name: '💬 Discord DM Message',
              value: dmRow?.setting_value || `_Default:_ ${defaultDm}`,
            },
          )
          .setFooter({ text: 'Use /dnr settings ingame_message:[text] to change' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], flags: 64 });
      }

      if (ingameMsg) {
        run(
          `INSERT INTO alert_settings (guild_id, alert_type, setting_key, setting_value)
           VALUES (?, 'dnr', 'ingame_message', ?)
           ON CONFLICT(guild_id, alert_type, setting_key) DO UPDATE SET setting_value = excluded.setting_value`,
          [interaction.guildId, ingameMsg]
        );
      }
      if (dmMsg) {
        run(
          `INSERT INTO alert_settings (guild_id, alert_type, setting_key, setting_value)
           VALUES (?, 'dnr', 'dm_message', ?)
           ON CONFLICT(guild_id, alert_type, setting_key) DO UPDATE SET setting_value = excluded.setting_value`,
          [interaction.guildId, dmMsg]
        );
      }

      return interaction.reply({
        content: `✅ DNR message settings updated.`,
        flags: 64,
      });
    }
  },
};
