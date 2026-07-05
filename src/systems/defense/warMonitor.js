// ============================================================
// src/systems/defense/warMonitor.js
// Instant war detection — polls every 60 seconds
// Shows defender military + top 5 eligible counters
// ============================================================

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { query, run, queryOne } = require('../../utils/database');
const { pwQuery, getAllianceMembers, MEMBER_POSITIONS } = require('../../utils/pwApi');
const { getLinkedDiscordUser, buildNationToDiscordMap } = require('../../utils/nationLink');
const { calculateNationReadiness, getReadinessWeights } = require('../../utils/mmrCalculator');
const logger = require('../../utils/logger');

const checking = new Set();

async function checkAllianceDefense(client) {
  const guilds = query(
    'SELECT guild_id, alliance_id FROM guilds WHERE alliance_id IS NOT NULL', []
  ).rows;
  for (const guild of guilds) {
    if (checking.has(guild.guild_id)) continue;
    checking.add(guild.guild_id);
    try {
      await processGuildDefense(client, guild.guild_id, guild.alliance_id);
    } finally {
      checking.delete(guild.guild_id);
    }
  }
}

async function processGuildDefense(client, guildId, allianceId) {
  try {
    const channelRow =
      queryOne(`SELECT discord_channel_id FROM guild_channels WHERE guild_id = ? AND channel_type = 'wars'`, [guildId]) ||
      queryOne(`SELECT discord_channel_id FROM guild_channels WHERE guild_id = ? AND channel_type = 'intel'`, [guildId]);
    if (!channelRow) return;

    const channel = client.channels.cache.get(channelRow.discord_channel_id);
    if (!channel) return;

    const data = await pwQuery(`
      query GetAllianceWars($allianceId: [Int]) {
        wars(alliance_id: $allianceId, active: true, first: 100) {
          data {
            id
            att_alliance_id
            def_alliance_id
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
    `, { allianceId: [parseInt(allianceId)] });

    const allWars      = data?.wars?.data || [];
    const allianceIdStr = String(allianceId);
    const defWars      = allWars.filter(w =>
      String(w.def_alliance_id) === allianceIdStr &&
      // Exclude applicants — only alert for real members
      MEMBER_POSITIONS.includes((w.defender?.alliance_position || '').toUpperCase())
    );

    if (defWars.length === 0) return;

    const newWars = [];
    for (const war of defWars) {
      const seen = queryOne(
        'SELECT id FROM defense_alerts_sent WHERE guild_id = ? AND war_id = ?',
        [guildId, String(war.id)]
      );
      if (!seen) {
        newWars.push(war);
        run('INSERT OR IGNORE INTO defense_alerts_sent (guild_id, war_id) VALUES (?, ?)',
          [guildId, String(war.id)]);
      }
    }
    if (newWars.length === 0) return;

    // Fetch our alliance members once for counter suggestions
    let ourMembers = [];
    try {
      ourMembers = await getAllianceMembers(allianceId);
    } catch { /* skip counter suggestions if fetch fails */ }

    const discordMap = buildNationToDiscordMap(guildId);

    const roleRow = queryOne(
      `SELECT discord_role_id FROM guild_roles WHERE guild_id = ? AND role_type = 'military'`,
      [guildId]
    );
    const ping = roleRow ? `<@&${roleRow.discord_role_id}>` : '';

    if (newWars.length >= 3) {
      await sendMassAttackAlert(channel, ping, newWars, discordMap);
    } else {
      for (const war of newWars) {
        await sendDefenseAlert(channel, ping, war, ourMembers, discordMap, guildId);
      }
    }
  } catch (err) {
    logger.error(`Defense monitor error for guild ${guildId}: ${err.message}`);
  }
}

// ============================================================
// FIND TOP ELIGIBLE COUNTERS FOR AN ATTACKER
// ============================================================
function findEligibleCounters(attacker, ourMembers, discordMap, limit = 5) {
  if (!attacker || !ourMembers.length) return [];

  const minScore = (attacker.score || 0) * 0.75;
  const maxScore = (attacker.score || 0) * 1.75;

  return ourMembers
    .filter(m =>
      m.score >= minScore &&
      m.score <= maxScore &&
      m.vacation_mode_turns === 0 &&
      (m.offensive_wars_count || 0) < 5
    )
    .map(m => ({
      ...m,
      openSlots:  5 - (m.offensive_wars_count || 0),
      discordId:  discordMap.get(m.id) || discordMap.get(String(m.id)),
    }))
    .sort((a, b) => {
      // Prioritise by open slots then aircraft fill rate
      if (b.openSlots !== a.openSlots) return b.openSlots - a.openSlots;
      const aPct = (a.aircraft || 0) / Math.max((a.num_cities || 1) * 75, 1);
      const bPct = (b.aircraft || 0) / Math.max((b.num_cities || 1) * 75, 1);
      return bPct - aPct;
    })
    .slice(0, limit);
}

// ============================================================
// SINGLE DEFENSE ALERT
// ============================================================
async function sendDefenseAlert(channel, ping, war, ourMembers, discordMap, guildId) {
  try {
    const attacker = war.attacker;
    const defender = war.defender;

    // Discord mention for the attacked member
    const defenderLink    = getLinkedDiscordUser(guildId, defender?.id);
    const defenderMention = defenderLink ? `<@${defenderLink.discord_user_id}> ` : '';

    // Find top 5 eligible counters
    const counters = findEligibleCounters(attacker, ourMembers, discordMap, 5);

    const counterLines = counters.length > 0
      ? counters.map(m => {
          const mention = m.discordId ? `<@${m.discordId}>` : `**${m.nation_name}**`;
          return `• ${mention} — Score: ${Math.round(m.score).toLocaleString()} | ✈️ ${m.aircraft || 0} | ${m.openSlots} slot(s)`;
        }).join('\n')
      : '❌ No members currently in war range with open slots';

    const embed = new EmbedBuilder()
      .setTitle('🆘 Member Under Attack!')
      .setColor(0xe74c3c)
      .addFields(
        // ── OUR MEMBER ────────────────────────────────────────
        {
          name: '🛡️ Our Member (Defender)',
          value:
            `**[${defender?.nation_name || 'Unknown'}](https://politicsandwar.com/nation/id=${defender?.id})**\n` +
            `Score: ${defender?.score?.toLocaleString() || '?'}`,
          inline: true,
        },
        {
          name: '🪖 Our Member\'s Military',
          value:
            `👮 ${(defender?.soldiers || 0).toLocaleString()}\n` +
            `🚗 ${(defender?.tanks    || 0).toLocaleString()}\n` +
            `✈️ ${defender?.aircraft  || 0}\n` +
            `🚢 ${defender?.ships     || 0}\n` +
            `🚀 ${defender?.missiles  || 0} | ☢️ ${defender?.nukes || 0}`,
          inline: true,
        },
        { name: '\u200b', value: '\u200b', inline: false }, // spacer
        // ── ENEMY ─────────────────────────────────────────────
        {
          name: '⚔️ Attacker (Enemy)',
          value:
            `**[${attacker?.nation_name || 'Unknown'}](https://politicsandwar.com/nation/id=${attacker?.id})**\n` +
            `Alliance: **${attacker?.alliance?.name || 'None'}**\n` +
            `Score: ${attacker?.score?.toLocaleString() || '?'}`,
          inline: true,
        },
        {
          name: '🪖 Enemy Military',
          value:
            `👮 ${(attacker?.soldiers || 0).toLocaleString()}\n` +
            `🚗 ${(attacker?.tanks    || 0).toLocaleString()}\n` +
            `✈️ ${attacker?.aircraft  || 0}\n` +
            `🚢 ${attacker?.ships     || 0}\n` +
            `🚀 ${attacker?.missiles  || 0} | ☢️ ${attacker?.nukes || 0}`,
          inline: true,
        },
        { name: '\u200b', value: '\u200b', inline: false }, // spacer
        // ── COUNTERS ──────────────────────────────────────────
        {
          name: `✅ Top ${counters.length} Eligible Counters`,
          value: counterLines,
          inline: false,
        },
      )
      .setFooter({ text: `War ID: ${war.id} | Use /counter find ${attacker?.nation_name} for full list` })
      .setTimestamp();

    // Quick action buttons
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('View War')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://politicsandwar.com/nation/war/timeline/war=${war.id}`),
      new ButtonBuilder()
        .setLabel('View Attacker')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://politicsandwar.com/nation/id=${attacker?.id}`),
    );

    const content = [
      ping,
      defenderMention,
      `🆘 **${defender?.nation_name || 'A member'} is under attack!**`,
    ].filter(Boolean).join(' ');

    await channel.send({ content, embeds: [embed], components: [row] });
    logger.info(`Defense alert sent for war ${war.id}`);

  } catch (err) {
    logger.error(`Failed to send defense alert for war ${war.id}: ${err.message}`);
  }
}

// ============================================================
// MASS ATTACK ALERT
// ============================================================
async function sendMassAttackAlert(channel, ping, wars, discordMap) {
  try {
    const attackerAlliances = [...new Set(wars.map(w => w.attacker?.alliance?.name || 'Unknown'))];
    const memberLines = wars.slice(0, 10).map(w => {
      const defLink   = discordMap.get(w.defender?.id) || discordMap.get(String(w.defender?.id));
      const defMention = defLink ? `<@${defLink}>` : `[${w.defender?.nation_name || 'Unknown'}](https://politicsandwar.com/nation/id=${w.defender?.id})`;
      return `• ${defMention} ← **[${w.attacker?.nation_name || 'Unknown'}](https://politicsandwar.com/nation/id=${w.attacker?.id})** (${w.attacker?.alliance?.name || 'None'})`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`🚨 MASS ATTACK — ${wars.length} Members Hit!`)
      .setColor(0xff0000)
      .setDescription(
        `**${wars.length} members attacked simultaneously!**\n` +
        `Attacking: **${attackerAlliances.join(', ')}**`
      )
      .addFields(
        {
          name: '🛡️ Members Under Attack',
          value: memberLines.join('\n') + (wars.length > 10 ? `\n_...and ${wars.length - 10} more_` : ''),
        },
        {
          name: '⚡ Immediate Actions',
          value:
            '`/counter check` — all members under attack\n' +
            '`/counter find [attacker]` — find counter options\n' +
            '`/war defensive` — full defensive war details',
        },
      )
      .setFooter({ text: 'PW Defense Bot • Emergency Defense Alert' })
      .setTimestamp();

    await channel.send({
      content: ping ? `${ping} 🚨 **EMERGENCY — MASS ATTACK!**` : '🚨 **EMERGENCY — MASS ATTACK!**',
      embeds: [embed],
    });
    logger.warn(`Mass attack alert sent — ${wars.length} wars`);
  } catch (err) {
    logger.error(`Failed to send mass attack alert: ${err.message}`);
  }
}

module.exports = { checkAllianceDefense };
