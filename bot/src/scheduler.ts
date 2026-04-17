// bot/src/scheduler.ts — Cron scheduler for the H1 Claims Bot
// Runs on the HP EliteDesk mini PC at the hospital

import * as cron from 'node-cron';
import { config } from 'dotenv';
import { runBotCycle, listAvailableTPAs, loadTPAConfig } from './engine';
import { logger } from './logger';

config(); // Load .env

const CENTRE_ID = process.env.CENTRE_ID || 'c0000001-0000-0000-0000-000000000001'; // Shilaj default

// ═══ Schedule Configuration ═══
// Adjust intervals based on TPA SLAs and volume

const SCHEDULE = {
  // Status polling: every 30 minutes during business hours (8 AM - 8 PM IST)
  status_poll: '*/30 8-20 * * 1-6',     // Mon-Sat, every 30 min

  // Pre-auth submission: every 15 minutes during business hours
  preauth_submit: '*/15 8-20 * * 1-6',  // Mon-Sat, every 15 min

  // Letter download: twice daily
  letter_download: '0 10,16 * * 1-6',   // Mon-Sat, 10 AM and 4 PM

  // Health check: every 5 minutes (just logs)
  health_check: '*/5 * * * *',
};

// ═══ Main ═══

async function main() {
  logger.info('═══ H1 Claims Bot Scheduler Starting ═══');
  logger.info({ centreId: CENTRE_ID }, 'Centre ID');

  const tpas = listAvailableTPAs();
  logger.info({ tpas, count: tpas.length }, 'Available TPA configs');

  // ─── Status Polling (every 30 min) ───
  cron.schedule(SCHEDULE.status_poll, async () => {
    logger.info('─── Status Poll Cycle ───');
    for (const tpa of tpas) {
      try {
        await runBotCycle(tpa, 'check_status', CENTRE_ID);
      } catch (e: any) {
        logger.error({ tpa, error: e.message }, 'Status poll failed');
      }
    }
  }, { timezone: 'Asia/Kolkata' });

  // ─── Pre-Auth Submission (every 15 min) ───
  cron.schedule(SCHEDULE.preauth_submit, async () => {
    logger.info('─── Pre-Auth Submit Cycle ───');
    for (const tpa of tpas) {
      try {
        const config = loadTPAConfig(tpa);
        if (config.flows.submit_preauth) {
          await runBotCycle(tpa, 'submit_preauth', CENTRE_ID);
        }
      } catch (e: any) {
        logger.error({ tpa, error: e.message }, 'Pre-auth submit failed');
      }
    }
  }, { timezone: 'Asia/Kolkata' });

  // ─── Letter Download (twice daily) ───
  cron.schedule(SCHEDULE.letter_download, async () => {
    logger.info('─── Letter Download Cycle ───');
    for (const tpa of tpas) {
      try {
        const config = loadTPAConfig(tpa);
        if (config.flows.download_letter) {
          await runBotCycle(tpa, 'download_letter', CENTRE_ID);
        }
      } catch (e: any) {
        logger.error({ tpa, error: e.message }, 'Letter download failed');
      }
    }
  }, { timezone: 'Asia/Kolkata' });

  // ─── Health Check ───
  cron.schedule(SCHEDULE.health_check, () => {
    logger.debug({ uptime: process.uptime(), memory: process.memoryUsage().heapUsed }, 'Health check');
  });

  logger.info({
    schedules: {
      status_poll: SCHEDULE.status_poll,
      preauth_submit: SCHEDULE.preauth_submit,
      letter_download: SCHEDULE.letter_download,
    }
  }, 'Cron jobs scheduled');

  // Keep process alive
  process.on('SIGINT', () => {
    logger.info('Shutting down gracefully...');
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    logger.info('Shutting down gracefully...');
    process.exit(0);
  });
}

// ─── CLI Mode ───
// Run: node dist/scheduler.js --once --tpa=hdfc_ergo --action=check_status
const args = process.argv.slice(2);
if (args.includes('--once')) {
  const tpa = args.find(a => a.startsWith('--tpa='))?.split('=')[1];
  const action = (args.find(a => a.startsWith('--action='))?.split('=')[1] || 'check_status') as any;
  if (tpa) {
    logger.info({ tpa, action }, 'Running single bot cycle');
    runBotCycle(tpa, action, CENTRE_ID)
      .then(() => { logger.info('Done'); process.exit(0); })
      .catch(e => { logger.error(e); process.exit(1); });
  } else {
    logger.error('--tpa= required for --once mode');
    process.exit(1);
  }
} else {
  main();
}
