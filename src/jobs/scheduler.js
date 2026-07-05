// ============================================================
// src/jobs/scheduler.js
// ============================================================

const cron = require('node-cron');
const logger = require('../utils/logger');
const { checkBeigeExits } = require('./beigeJob');
const { generateDailyReport } = require('./reportJob');
const { checkMilitaryChanges } = require('../systems/intelligence/militaryMonitor');
const { checkAllianceDefense } = require('../systems/defense/warMonitor');
const { checkVacationChanges, checkWarExpiry } = require('../systems/intelligence/vacationTracker');
const { checkForSpyAttacks } = require('../systems/intelligence/spyDetector');
const { checkDnrViolations } = require('../systems/intelligence/dnrMonitor');

async function startAllJobs(client) {
  logger.info('Starting background job scheduler...');

  // Startup checks after 10 seconds
  setTimeout(async () => {
    logger.info('Running startup checks...');
    await checkBeigeExits(client);
    await checkAllianceDefense(client);
    await checkDnrViolations(client);
  }, 10000);

  // Defense check every 60 seconds — near-instant attack alerts
  cron.schedule('* * * * *', async () => {
    await checkAllianceDefense(client);
  });

  // DNR violation check every 3 minutes
  // (frequent enough to catch violations quickly)
  cron.schedule('*/3 * * * *', async () => {
    logger.debug('🚫 Checking DNR violations...');
    await checkDnrViolations(client);
  });

  // Beige check every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    logger.debug('⏰ Running beige check...');
    await checkBeigeExits(client);
  });

  // Military changes + spy detection every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    logger.debug('🔍 Checking military changes + spy attacks...');
    await checkMilitaryChanges(client);
    await checkForSpyAttacks(client);
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

  // Daily report at 08:00 UTC
  cron.schedule('0 8 * * *', async () => {
    logger.info('📅 Sending daily reports...');
    await generateDailyReport(client);
  });

  logger.info('✅ Scheduler — defense 60s | DNR 3min | beige 5min | military/spy/vacation 15min | expiry 30min | daily 08:00 UTC');
}

module.exports = { startAllJobs };
