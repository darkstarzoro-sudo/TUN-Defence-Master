// ============================================================
// src/systems/beige/beigeAlerts.js
// Fixed: properly checks channel config before sending
// ============================================================

const { EmbedBuilder } = require('discord.js');
const { query, queryOne } = require('../../utils/database');
const { getEligibleAttackers, formatTimeRemaining } = require('./beigeTracker');
const logger = require('../../utils/logger');

const DEFAULT_INTERVALS = [60, 30, 15, 5];

function getAlertIntervals(guildId) {
  const rows = query(
    `SELECT setting_value FROM alert_settings
     WHERE guild_id = ? AND alert_type = 'beige' AND setting_key = 'intervals'`,
    [guildId]
  ).rows;

  if (rows.length > 0) {
    try { return JSON.parse(rows[0].setting_value); } catch { return DEFAULT_INTERVALS; }
  }
  return DEFAULT_INTERVALS;
}

function getBeigeChannel(client, guildId) {
  const row = queryOne(
    `SELECT discord_channel_id FROM guild_channels WHERE guild_id = ? AND channel_type = 'beige'`,
    [guildId]
  );
  if (!row) {
    logger.warn(`No beige channel configured for guild ${guildId} — use /config channel beige`);
    return null;
  }
  const channel = client.channels.cache.get(row.discord_channel_id);
  if (!channel) {
    logger.warn(`Beige channel ${row.discord_channel_id} not found in cache for guild ${guildId}`);
  }
  return channel || null;
}

function getMilitaryRole(guildId) {
  const row = queryOne(
    `SELECT discord_role_id FROM guild_roles WHERE guild_id = ? AND role_type = 'military'`,
    [guildId]
  );
  return row?.discord_role_id || null;
}

async function sendBeigeAlert(client, guildId, nation, interval) {
  try {
    const channel = getBeigeChannel(client, guildId);
    if (!channel) {
      logger.warn(`Skipping beige alert for ${nation.nation_name} — no channel configured`);
      return;
    }

    const eligibleAttackers = await getEligibleAttackers(guildId, nation.score);
    const timeLeft = formatTimeRemaining(nation.minutesRemaining);
    const isUrgent   = nation.minutesRemaining <= 15;
    const isExpiring = nation.minutesRemaining <= 5;

    const color = isExpiring ? 0xff0000 : isUrgent ? 0xff9900 : 0xf1c40f;

    const embed = new EmbedBuilder()
      .setTitle(`${isExpiring ? '🚨' : isUrgent ? '⚠️' : '🟡'} Beige Exit Alert — ${nation.nation_name}`)
      .setColor(color)
      .setDescription(
        interval === 0
          ? '**This nation has exited beige and is now attackable!**'
          : `This nation exits beige in approximately **${timeLeft}**`
      )
      .addFields(
        { name: '🏴 Nation',    value: `[${nation.nation_name}](https://politicsandwar.com/nation/id=${nation.id})`, inline: true },
        { name: '🏛️ Alliance', value: nation.allianceName || 'None', inline: true },
        { name: '⭐ Score',    value: nation.score?.toLocaleString() || '?', inline: true },
        { name: '🏙️ Cities',  value: `${nation.num_cities}`, inline: true },
        { name: '⚔️ Wars',    value: `${nation.offensive_wars_count} off / ${nation.defensive_wars_count} def`, inline: true },
        { name: '⏰ Expires', value: `<t:${nation.expiryTimestamp}:R> (<t:${nation.expiryTimestamp}:f>)`, inline: false },
        {
          name: '🪖 Military',
          value: `👮 ${(nation.soldiers||0).toLocaleString()} | 🚗 ${(nation.tanks||0).toLocaleString()} | ✈️ ${nation.aircraft||0} | 🚢 ${nation.ships||0} | 🚀 ${nation.missiles||0} | ☢️ ${nation.nukes||0}`,
          inline: false,
        },
      )
      .setFooter({ text: `Nation ID: ${nation.id} • PW Defense Bot` })
      .setTimestamp();

    if (eligibleAttackers.length > 0) {
      const lines = eligibleAttackers.slice(0, 8).map(a =>
        `• **${a.nation_name}** — Score: ${Math.round(a.score).toLocaleString()} | ${a.openSlots} slot(s)`
      );
      embed.addFields({
        name: `✅ Eligible Attackers (${eligibleAttackers.length})`,
        value: lines.join('\n') + (eligibleAttackers.length > 8 ? `\n_...and ${eligibleAttackers.length - 8} more_` : ''),
      });
    } else {
      embed.addFields({ name: '❌ Eligible Attackers', value: 'No members currently in range with open slots.' });
    }

    const militaryRoleId = getMilitaryRole(guildId);
    const ping = militaryRoleId ? `<@&${militaryRoleId}>` : '';
    const intervalLabel = interval === 0
      ? '**BEIGE EXPIRED**'
      : `**${formatTimeRemaining(interval * 60)} warning**`;

    await channel.send({
      content: ping ? `${ping} — ${intervalLabel}` : intervalLabel,
      embeds: [embed],
    });

    logger.info(`✅ Beige alert sent for ${nation.nation_name} (${interval}min interval) in guild ${guildId}`);

  } catch (error) {
    logger.error(`Failed to send beige alert for ${nation.nation_name}: ${error.message}`);
  }
}

module.exports = { sendBeigeAlert, getAlertIntervals, getBeigeChannel };
