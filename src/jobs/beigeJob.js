// ============================================================
// src/jobs/beigeJob.js
// Fixed: alerts now fire correctly even if bot starts after
// a nation is already in beige. Old "sent" records are cleared
// when a nation exits beige so alerts fire again next time.
// ============================================================

const { query } = require('../utils/database');
const {
  getBeigeTargets,
  getAlertsDue,
  wasAlertSent,
  markAlertSent,
  cleanOldAlerts,
} = require('../systems/beige/beigeTracker');
const { sendBeigeAlert, getAlertIntervals } = require('../systems/beige/beigeAlerts');
const logger = require('../utils/logger');

async function checkBeigeExits(client) {
  logger.debug('Running beige exit check...');

  try {
    const guilds = query(
      'SELECT guild_id, alliance_id FROM guilds WHERE alliance_id IS NOT NULL', []
    ).rows;

    for (const guild of guilds) {
      await processGuildBeige(client, guild.guild_id);
    }
  } catch (error) {
    logger.error('Beige job error:', error);
  }
}

async function processGuildBeige(client, guildId) {
  try {
    const beigeNations = await getBeigeTargets(guildId);

    if (beigeNations.length === 0) {
      cleanOldAlerts(guildId, []);
      return;
    }

    const activeNationIds = beigeNations.map(n => n.id);
    cleanOldAlerts(guildId, activeNationIds);

    const intervals = getAlertIntervals(guildId);

    logger.debug(`Beige check for guild ${guildId}: ${beigeNations.length} nations in beige, intervals: ${intervals.join(',')}`);

    for (const nation of beigeNations) {
      logger.debug(`  Nation ${nation.nation_name}: ${Math.round(nation.minutesRemaining)}min remaining`);

      // Find the SMALLEST interval that applies right now
      // e.g. if 8 minutes left and intervals=[60,30,15,5], applicable=[5]
      // We only send the most urgent alert not yet sent
      const alertsDue = getAlertsDue(nation, intervals);

      if (alertsDue.length === 0) {
        logger.debug(`    No alerts due yet (${Math.round(nation.minutesRemaining)}min remaining)`);
        continue;
      }

      for (const interval of alertsDue) {
        if (wasAlertSent(guildId, nation.id, interval)) {
          logger.debug(`    Alert for ${interval}min already sent, skipping`);
          continue;
        }

        logger.debug(`    Sending ${interval}min alert for ${nation.nation_name}`);
        await sendBeigeAlert(client, guildId, nation, interval);
        markAlertSent(guildId, nation.id, interval);
      }
    }

  } catch (error) {
    logger.error(`Error processing beige for guild ${guildId}: ${error.message}`);
  }
}

module.exports = { checkBeigeExits };
