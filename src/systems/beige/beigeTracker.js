// ============================================================
// src/systems/beige/beigeTracker.js
// Fixed: proper handling of alliance_id vs nation_id queries
// ============================================================

const { pwQuery } = require('../../utils/pwApi');
const { query, run, queryOne } = require('../../utils/database');
const logger = require('../../utils/logger');

const HOURS_PER_TURN = 2;

async function getBeigeTargets(guildId) {
  try {
    const watchedAlliances = query(
      `SELECT alliance_id, alliance_name FROM alliance_watchlist
       WHERE guild_id = ? AND watchlist_type = 'enemy'`,
      [guildId]
    ).rows;

    const watchedNations = query(
      `SELECT nation_id FROM nation_watchlist WHERE guild_id = ?`,
      [guildId]
    ).rows;

    if (watchedAlliances.length === 0 && watchedNations.length === 0) {
      logger.debug(`Beige: no watchlist entries for guild ${guildId}`);
      return [];
    }

    const allianceIds = watchedAlliances.map(a => a.alliance_id);
    const nationIds   = watchedNations.map(n => n.nation_id);

    logger.debug(`Beige: querying ${allianceIds.length} alliances and ${nationIds.length} individual nations`);

    // Query alliances and individual nations separately to avoid empty array issues
    let nations = [];

    if (allianceIds.length > 0) {
      const allianceData = await pwQuery(`
        query GetBeigeFromAlliances($allianceIds: [Int]) {
          nations(alliance_id: $allianceIds, vmode: false, first: 500) {
            data {
              id nation_name leader_name alliance_id alliance_position
              alliance { name }
              score num_cities beige_turns vacation_mode_turns
              soldiers tanks aircraft ships missiles nukes
              offensive_wars_count defensive_wars_count last_active
            }
          }
        }
      `, { allianceIds });
      nations = nations.concat(allianceData?.nations?.data || []);
    }

    if (nationIds.length > 0) {
      const nationData = await pwQuery(`
        query GetBeigeFromNations($nationIds: [Int]) {
          nations(id: $nationIds, vmode: false, first: 100) {
            data {
              id nation_name leader_name alliance_id alliance_position
              alliance { name }
              score num_cities beige_turns vacation_mode_turns
              soldiers tanks aircraft ships missiles nukes
              offensive_wars_count defensive_wars_count last_active
            }
          }
        }
      `, { nationIds });
      nations = nations.concat(nationData?.nations?.data || []);
    }

    // Deduplicate by nation ID
    const seen = new Set();
    nations = nations.filter(n => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });

    const beigeNations = nations.filter(n => (n.beige_turns || 0) > 0);
    logger.debug(`Beige: found ${nations.length} total nations, ${beigeNations.length} in beige`);

    return beigeNations.map(n => enrichBeigeData(n));

  } catch (error) {
    logger.error('Error fetching beige targets:', error.message);
    return [];
  }
}

function enrichBeigeData(nation) {
  const hoursRemaining   = (nation.beige_turns || 0) * HOURS_PER_TURN;
  const minutesRemaining = hoursRemaining * 60;
  const expiryDate       = new Date(Date.now() + minutesRemaining * 60 * 1000);
  return {
    ...nation,
    hoursRemaining,
    minutesRemaining,
    expiryDate,
    expiryTimestamp: Math.floor(expiryDate.getTime() / 1000),
    allianceName: nation.alliance?.name || 'None',
  };
}

async function getEligibleAttackers(guildId, targetScore) {
  try {
    const guildRow = queryOne('SELECT alliance_id FROM guilds WHERE guild_id = ?', [guildId]);
    if (!guildRow?.alliance_id) return [];

    const { getAllianceMembers } = require('../../utils/pwApi');
    const members = await getAllianceMembers(guildRow.alliance_id);

    const minAttackerScore = targetScore / 1.75;
    const maxAttackerScore = targetScore / 0.75;

    return members.filter(m =>
      m.score >= minAttackerScore &&
      m.score <= maxAttackerScore &&
      (m.vacation_mode_turns || 0) === 0 &&
      (m.offensive_wars_count || 0) < 5
    ).map(m => ({ ...m, openSlots: 5 - (m.offensive_wars_count || 0) }));

  } catch (error) {
    logger.error('Error finding eligible attackers:', error.message);
    return [];
  }
}

function getAlertsDue(nation, configuredIntervals) {
  // Return all intervals where time remaining has dropped AT or BELOW that interval
  return configuredIntervals.filter(interval => nation.minutesRemaining <= interval);
}

function wasAlertSent(guildId, nationId, interval) {
  const row = queryOne(
    'SELECT id FROM beige_alerts_sent WHERE guild_id = ? AND nation_id = ? AND alert_interval = ?',
    [guildId, nationId, interval]
  );
  return !!row;
}

function markAlertSent(guildId, nationId, interval) {
  run(
    `INSERT OR IGNORE INTO beige_alerts_sent (guild_id, nation_id, alert_interval) VALUES (?, ?, ?)`,
    [guildId, nationId, interval]
  );
}

function cleanOldAlerts(guildId, activeNationIds) {
  if (activeNationIds.length === 0) {
    run('DELETE FROM beige_alerts_sent WHERE guild_id = ?', [guildId]);
    return;
  }
  const placeholders = activeNationIds.map(() => '?').join(',');
  run(
    `DELETE FROM beige_alerts_sent WHERE guild_id = ? AND nation_id NOT IN (${placeholders})`,
    [guildId, ...activeNationIds]
  );
}

function formatTimeRemaining(minutes) {
  if (minutes < 1) return 'Less than 1 minute';
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

module.exports = {
  getBeigeTargets,
  getEligibleAttackers,
  getAlertsDue,
  wasAlertSent,
  markAlertSent,
  cleanOldAlerts,
  formatTimeRemaining,
  enrichBeigeData,
};
