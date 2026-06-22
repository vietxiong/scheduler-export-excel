/**
 * scheduler.js  (main entry point)
 *
 * Usage:
 *   node scheduler.js            → starts cron scheduler
 *   node scheduler.js --now      → runs immediately (today's date)
 *   node scheduler.js --date 2026-03-12  → runs for specific date
 */

const cron = require('node-cron');
const path = require('path');
const fs   = require('fs');
require('dotenv').config();

const { runExport } = require('./exporter');

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTodayString() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function cleanDownloads() {
  const downloadDir = path.resolve(process.env.DOWNLOAD_DIR || './downloads');
  if (fs.existsSync(downloadDir)) {
    const files = fs.readdirSync(downloadDir);
    for (const f of files) {
      fs.unlinkSync(path.join(downloadDir, f));
    }
    console.log(`[scheduler] Cleaned ${files.length} file(s) from downloads dir.`);
  }
}

// ─── Core Job ────────────────────────────────────────────────────────────────

async function runJob(dateStr) {
  console.log('\n' + '═'.repeat(60));
  console.log(`[scheduler] Job started  →  date: ${dateStr}`);
  console.log('═'.repeat(60));

  // Clean previous downloads
  cleanDownloads();

  let downloadedFile;

  try {
    // Export Excel via browser automation
    downloadedFile = await runExport(dateStr);
    console.log(`[scheduler] ✅ Done: ${downloadedFile}`);

  } catch (err) {
    console.error('\n[scheduler] ❌ Job failed:', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  }

  return downloadedFile;
}

// ─── CLI / Scheduler Entry ───────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // --now flag: run immediately with today's date
  if (args.includes('--now')) {
    const dateStr = getTodayString();
    console.log(`[scheduler] Running immediately for today: ${dateStr}`);
    await runJob(dateStr);
    return;
  }

  // --date YYYY-MM-DD flag: run immediately for specific date
  const dateIdx = args.indexOf('--date');
  if (dateIdx !== -1 && args[dateIdx + 1]) {
    const dateStr = args[dateIdx + 1];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      console.error('[scheduler] Invalid date format. Use YYYY-MM-DD');
      process.exit(1);
    }
    console.log(`[scheduler] Running immediately for date: ${dateStr}`);
    await runJob(dateStr);
    return;
  }

  // Default: start cron scheduler
  const schedule = process.env.CRON_SCHEDULE || '0 1 * * *';
  console.log(`[scheduler] Starting cron scheduler with schedule: "${schedule}"`);
  console.log('[scheduler] Press Ctrl+C to stop.\n');

  if (!cron.validate(schedule)) {
    console.error(`[scheduler] Invalid cron expression: "${schedule}"`);
    process.exit(1);
  }

  cron.schedule(schedule, async () => {
    const useDynamic = process.env.DYNAMIC_DATE !== 'false';
    const dateStr = useDynamic ? getTodayString() : (process.env.MANUAL_DATE || getTodayString());
    await runJob(dateStr);
  });

  console.log('[scheduler] Scheduler is running. Waiting for next trigger...');
  console.log(`[scheduler] Next run at cron: "${schedule}"\n`);
}

main().catch(err => {
  console.error('[scheduler] Fatal error:', err);
  process.exit(1);
});