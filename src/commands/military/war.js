// ============================================================
// src/commands/military/war.js
// Fixed: removed alliance_position filter that broke war display
// alliance_position is not available in nested war objects
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { queryOne } = require('../../utils/database');
const { pwQuery, resolveNation } = require('../../utils/pwApi');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

function safeName(n) { return n || 'Unknown'; }
function safeScore(s) { return s ? Number(s).toLocaleString() : '?'; }
function safeMil(m)   { return m || 0; }

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function generateWarCSV(wars, isDefensive) {
  const headers = isDefensive
    ? ['Our Member', 'Member ID', 'Our Score', 'Attacker', 'Attacker ID', 'Attacker Alliance', 'Attacker Score', 'Aircraft', 'Tanks', 'Missiles', 'Nukes', 'War Link']
    : ['Our Attacker', 'Attacker ID', 'Our Score', 'Target', 'Target ID', 'Target Alliance', 'Target Score', 'Aircraft', 'Tanks', 'Turns Left', 'War Link'];

  const rows = wars.map(w => isDefensive ? [
    safeName(w.defender?.nation_name), w.defender?.id || '', w.defender?.score || '',
    safeName(w.attacker?.nation_name), w.attacker?.id || '',
    safeName(w.attacker?.alliance?.name), w.attacker?.score || '',
    safeMil(w.attacker?.aircraft), safeMil(w.attacker?.tanks),
    safeMil(w.attacker?.missiles), safeMil(w.attacker?.nukes),
    `https://politicsandwar.com/nation/war/timeline/war=${w.id}`,
  ] : [
    safeName(w.attacker?.nation_name), w.attacker?.id || '', w.attacker?.score || '',
    safeName(w.defender?.nation_name), w.defender?.id || '',
    safeName(w.defender?.alliance?.name), w.defender?.score || '',
    safeMil(w.defender?.aircraft), safeMil(w.defender?.tanks),
    w.turnsleft || '',
    `https://politicsandwar.com/nation/war/timeline/war=${w.id}`,
  ]);

  return [headers, ...rows]
    .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('war')
    .setDescription('View and manage active wars involving your alliance')
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Overview of all active wars (summary)')
    )
    .addSubcommand(sub =>
      sub.setName('defensive')
        .setDescription('Full list of all defensive wars as a downloadable file')
    )
    .addSubcommand(sub =>
      sub.setName('offensive')
        .setDescription('Full list of all offensive wars as a downloadable file')
    )
    .addSubcommand(sub =>
      sub.setName('check')
        .setDescription('Check the war status of a specific nation')
        .addStringOption(opt =>
          opt.setName('nation')
            .setDescription('Nation name, ID, or P&W link')
            .setRequired(true)
        )
    ),

  requiredRole: 'military',

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    const guildRow = queryOne('SELECT alliance_id FROM guilds WHERE guild_id = ?', [interaction.guildId]);
    if (!guildRow?.alliance_id) {
      return interaction.reply({ content: '❌ No alliance configured. Use `/config alliance` first.', flags: 64 });
    }

    // P&W returns alliance IDs as strings — compare as strings
    const allianceIdStr = String(guildRow.alliance_id);

    async function fetchAllianceWars() {
      const data = await pwQuery(`
        query GetAllianceWars($allianceId: [Int]) {
          wars(alliance_id: $allianceId, active: true, first: 100) {
            data {
              id
              att_alliance_id
              def_alliance_id
              attid
              defid
              attacker {
                id nation_name score
                soldiers tanks aircraft ships missiles nukes
                alliance { name }
              }
              defender {
                id nation_name score
                soldiers tanks aircraft ships missiles nukes
                alliance { name }
              }
              turnsleft
            }
          }
        }
      `, { allianceId: [parseInt(guildRow.alliance_id)] });
      return data?.wars?.data || [];
    }

    // ── STATUS ───────────────────────────────────────────────
    if (sub === 'status') {
      await interaction.deferReply();
      await interaction.editReply('⏳ Fetching war data from P&W...');

      const allWars = await fetchAllianceWars();
      const offWars = allWars.filter(w => String(w.att_alliance_id) === allianceIdStr);
      const defWars = allWars.filter(w => String(w.def_alliance_id) === allianceIdStr);

      function shortList(wars, isOff) {
        if (wars.length === 0) return '✅ None';
        return wars.slice(0, 5).map(w => isOff
          ? `• [${safeName(w.attacker?.nation_name)}](https://politicsandwar.com/nation/id=${w.attacker?.id}) → [${safeName(w.defender?.nation_name)}](https://politicsandwar.com/nation/id=${w.defender?.id})`
          : `• [${safeName(w.defender?.nation_name)}](https://politicsandwar.com/nation/id=${w.defender?.id}) ← [${safeName(w.attacker?.nation_name)}](https://politicsandwar.com/nation/id=${w.attacker?.id})`
        ).join('\n') + (wars.length > 5 ? `\n_+${wars.length - 5} more — use /war ${isOff ? 'offensive' : 'defensive'} for full list_` : '');
      }

      const embed = new EmbedBuilder()
        .setTitle('⚔️ Alliance War Status')
        .setColor(0xe74c3c)
        .addFields(
          { name: `⚔️ Offensive Wars — ${offWars.length}`, value: shortList(offWars, true) || '✅ None' },
          { name: `🛡️ Defensive Wars — ${defWars.length}`, value: shortList(defWars, false) || '✅ None' },
          { name: '📊 Summary', value: `Total: **${allWars.length}** | Attacking: **${offWars.length}** | Defending: **${defWars.length}**` },
        )
        .setFooter({ text: 'Use /war defensive or /war offensive for full downloadable list' })
        .setTimestamp();

      return interaction.editReply({ content: '', embeds: [embed] });
    }

    // ── DEFENSIVE ────────────────────────────────────────────
    if (sub === 'defensive') {
      await interaction.deferReply();
      await interaction.editReply('⏳ Fetching defensive war data...');

      const allWars = await fetchAllianceWars();
      const defWars = allWars.filter(w => String(w.def_alliance_id) === allianceIdStr);

      if (defWars.length === 0) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setTitle('🛡️ Defensive Wars').setColor(0x2ecc71).setDescription('✅ No members currently under attack.').setTimestamp()]
        });
      }

      const attackerAlliances = [...new Set(defWars.map(w => w.attacker?.alliance?.name || 'None'))];
      const withMissiles = defWars.filter(w => (w.attacker?.missiles || 0) > 0).length;
      const withNukes    = defWars.filter(w => (w.attacker?.nukes    || 0) > 0).length;

      const summaryEmbed = new EmbedBuilder()
        .setTitle(`🛡️ Defensive Wars — ${defWars.length} active`)
        .setColor(0xe74c3c)
        .addFields(
          { name: '⚔️ Attacking Alliances', value: attackerAlliances.slice(0, 10).join(', ') || 'None', inline: false },
          { name: '🚀 Wars with Missiles',  value: `${withMissiles}`, inline: true },
          { name: '☢️ Wars with Nukes',     value: `${withNukes}`,    inline: true },
          { name: '📄 Full Report',         value: 'A CSV file is attached below. Open in Excel or Google Sheets.', inline: false },
        )
        .setTimestamp();

      const csv      = generateWarCSV(defWars, true);
      const tmpFile  = path.join(os.tmpdir(), `defensive_wars_${Date.now()}.csv`);
      fs.writeFileSync(tmpFile, csv, 'utf8');
      const attachment = new AttachmentBuilder(tmpFile, { name: 'defensive_wars.csv' });

      await interaction.editReply({ content: '', embeds: [summaryEmbed], files: [attachment] });
      setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch {} }, 10000);
    }

    // ── OFFENSIVE ────────────────────────────────────────────
    if (sub === 'offensive') {
      await interaction.deferReply();
      await interaction.editReply('⏳ Fetching offensive war data...');

      const allWars = await fetchAllianceWars();
      const offWars = allWars.filter(w => String(w.att_alliance_id) === allianceIdStr);

      if (offWars.length === 0) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setTitle('⚔️ Offensive Wars').setColor(0x2ecc71).setDescription('No active offensive wars right now.').setTimestamp()]
        });
      }

      const targetAlliances = [...new Set(offWars.map(w => w.defender?.alliance?.name || 'None'))];

      const summaryEmbed = new EmbedBuilder()
        .setTitle(`⚔️ Offensive Wars — ${offWars.length} active`)
        .setColor(0x3498db)
        .addFields(
          { name: '🏛️ Alliances Being Hit', value: targetAlliances.slice(0, 10).join(', ') || 'None', inline: false },
          { name: '📄 Full Report',         value: 'A CSV file is attached below. Open in Excel or Google Sheets.', inline: false },
        )
        .setTimestamp();

      const csv      = generateWarCSV(offWars, false);
      const tmpFile  = path.join(os.tmpdir(), `offensive_wars_${Date.now()}.csv`);
      fs.writeFileSync(tmpFile, csv, 'utf8');
      const attachment = new AttachmentBuilder(tmpFile, { name: 'offensive_wars.csv' });

      await interaction.editReply({ content: '', embeds: [summaryEmbed], files: [attachment] });
      setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch {} }, 10000);
    }

    // ── CHECK ─────────────────────────────────────────────────
    if (sub === 'check') {
      await interaction.deferReply();
      const input = interaction.options.getString('nation');
      await interaction.editReply(`🔍 Looking up **${input}**...`);

      const nation = await resolveNation(input);
      if (!nation) {
        return interaction.editReply(`❌ Could not find nation **"${input}"**. Try name, ID, or P&W link.`);
      }

      const data = await pwQuery(`
        query GetNationWars($id: [Int]) {
          wars(nation_id: $id, active: true, first: 10) {
            data {
              id attid defid
              attacker { id nation_name score alliance { name } }
              defender { id nation_name score alliance { name } }
              turnsleft
            }
          }
        }
      `, { id: [parseInt(nation.id)] });

      const wars = data?.wars?.data || [];

      if (wars.length === 0) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setTitle(`⚔️ War Status — ${safeName(nation.nation_name)}`).setColor(0x2ecc71).setDescription('✅ This nation has no active wars.').setTimestamp()]
        });
      }

      const nationIdStr = String(nation.id);
      const lines = wars.map(w => {
        const isAttacker = String(w.attid) === nationIdStr;
        const opponent   = isAttacker ? w.defender : w.attacker;
        const role       = isAttacker ? '⚔️ Attacking' : '🛡️ Defending';
        return (
          `${role} **[${safeName(opponent?.nation_name)}](https://politicsandwar.com/nation/id=${opponent?.id})**\n` +
          `└ Alliance: ${safeName(opponent?.alliance?.name)} | Score: ${safeScore(opponent?.score)}\n` +
          `└ Turns left: ${w.turnsleft || '?'} | [View War](https://politicsandwar.com/nation/war/timeline/war=${w.id})`
        );
      });

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ War Status — ${safeName(nation.nation_name)}`)
        .setColor(0xe74c3c)
        .setDescription(lines.join('\n\n').slice(0, 3900))
        .addFields({
          name: '🪖 Military',
          value: `✈️ ${safeMil(nation.aircraft)} | 🚗 ${safeMil(nation.tanks)} | 👮 ${nation.soldiers?.toLocaleString() || 0} | 🚢 ${safeMil(nation.ships)} | 🚀 ${safeMil(nation.missiles)} | ☢️ ${safeMil(nation.nukes)}`,
        })
        .setFooter({ text: `Nation ID: ${nation.id}` })
        .setTimestamp();

      return interaction.editReply({ content: '', embeds: [embed] });
    }
  },
};
