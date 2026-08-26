// ============================================================
// src/jobs/scheduler.js
// Spy detection removed — too many false positives from war losses
// ============================================================

const cron = require('node-cron');
const logger = require('../utils/logger');
const { checkBeigeExits } = require('./beigeJob');
const { generateDailyReport } = require('./reportJob');
const { checkMilitaryChanges } = require('../systems/intelligence/militaryMonitor');
const { checkAllianceDefense } = require('../systems/defense/warMonitor');
const { checkVacationChanges, checkWarExpiry } = require('../systems/intelligence/vacationTracker');
const { checkDnrViolations } = require('../systems/intelligence/dnrMonitor');
const { runAutoBackup } = require('./backupJob');

async function startAllJobs(client) {
  logger.info('Starting background job scheduler...');

  setTimeout(async () => {
    logger.info('Running startup checks...');
    await checkBeigeExits(client);
    await checkAllianceDefense(client);
    await checkDnrViolations(client);
  }, 10000);

  // Defense check every 60 seconds
  cron.schedule('* * * * *', async () => {
    await checkAllianceDefense(client);
  });

  // DNR check every 3 minutes
  cron.schedule('*/3 * * * *', async () => {
    logger.debug('🚫 Checking DNR violations...');
    await checkDnrViolations(client);
  });

  // Beige check every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    logger.debug('⏰ Running beige check...');
    await checkBeigeExits(client);
  });

  // Military change alerts every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    logger.debug('🔍 Checking military changes...');
    await checkMilitaryChanges(client);
  });

  // Vacation mode changes every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    logger.debug('🏖️ Checking vacation mode changes...');
    await checkVacationChanges(client);
  });

  // War expiry alerts every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    logger.debug('⏰ Checking war expiry...');
    await checkWarExpiry(client);
  });

  // Auto backup every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    logger.info('💾 Running auto backup...');
    await runAutoBackup(client);
  });

  // Daily report at 08:00 UTC
  cron.schedule('0 8 * * *', async () => {
    logger.info('📅 Sending daily reports...');
    await generateDailyReport(client);
  });

  logger.info('✅ Scheduler — defense 60s | DNR 3min | beige 5min | military/vacation 15min | expiry 30min | backup 6h | daily 08:00 UTC');
}

module.exports = { startAllJobs };