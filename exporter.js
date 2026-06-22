/**
 * exporter.js
 * 1. Login to EVO portal
 * 2. Navigate to trade list for target date
 * 3. Click "Select All" toggle
 * 4. Click dropdown arrow next to "Export All"
 * 5. Click "Export Excel" using real mouse coordinates
 * 6. Auto-handle Save As dialog with PowerShell
 * 7. Move file to downloads folder
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
require('dotenv').config();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getTodayString() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}

async function runExport(dateStr) {
  if (!dateStr) dateStr = getTodayString();

  const downloadDir = process.env.DOWNLOAD_DIR || 'D:\\project\\node js\\scheduler-export-excel\\downloads';
  if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

  const todayStr = dateStr.replace(/-/g, '');
  const targetName = `TransDetails_${todayStr}-${todayStr}.xlsx`;
  const targetPath = path.join(downloadDir, targetName);

  console.log(`[exporter] Starting export for: ${dateStr}`);
  console.log(`[exporter] Download dir: ${downloadDir}`);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });

  try {
    // ── Login ────────────────────────────────────────────────────────────────
    console.log('[exporter] Logging in...');
    await page.goto('https://bkk-portal.everonet.com/passport/login', { waitUntil: 'domcontentloaded', timeout: 0 });
    await page.waitForSelector('input[type="password"]', { timeout: 0 });
    await sleep(1000);

    const allInputs = await page.$$('input');
    await allInputs[0].click({ clickCount: 3 });
    await allInputs[0].type(process.env.PORTAL_USERNAME || 'Vietxiong', { delay: 80 });
    const pwInput = await page.$('input[type="password"]');
    await pwInput.click({ clickCount: 3 });
    await pwInput.type(process.env.PASSWORD || '', { delay: 80 });
    const allBtns = await page.$$('button');
    await allBtns[allBtns.length - 1].click();
    await page.waitForFunction(() => !window.location.href.includes('/passport/login'), { timeout: 0, polling: 500 });
    await sleep(2000);
    console.log('[exporter] Logged in.');

    // ── Trade list ───────────────────────────────────────────────────────────
    const start = encodeURIComponent(`${dateStr}T00:00:00+07:00`);
    const end   = encodeURIComponent(`${dateStr}T23:59:59+07:00`);
    const url   = `https://bkk-portal.everonet.com/trades/trade/list?startTime=${start}&endTime=${end}&utcOffsetName=420&utcOffset=420&page=1&size=10&tradeMode=Standard`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 });
    await sleep(4000);

    // ── Select All ───────────────────────────────────────────────────────────
    console.log('[exporter] Clicking Select All...');
    await page.waitForFunction(() => !!document.querySelector('button[role="switch"]'), { timeout: 15000 });
    await page.evaluate(() => document.querySelector('button[role="switch"]').click());
    await sleep(2000);

    // ── Open Export dropdown ─────────────────────────────────────────────────
    console.log('[exporter] Opening Export dropdown...');
    const arrowBtn = await page.$('#Trade_list_export_all_button');
    if (arrowBtn) {
      await arrowBtn.click();
    } else {
      await page.evaluate(() => {
        const arrows = [...document.querySelectorAll('button')].filter(b =>
          b.querySelector('.anticon-down') || b.classList.contains('ant-dropdown-trigger')
        );
        if (arrows.length > 0) arrows[0].click();
      });
    }
    await sleep(1500);

    // ── Get Export Excel coordinates ─────────────────────────────────────────
    console.log('[exporter] Finding Export Excel item...');
    await page.waitForFunction(() =>
      [...document.querySelectorAll('li, [role="menuitem"]')]
        .some(el => /export excel/i.test(el.textContent) && el.offsetParent !== null),
    { timeout: 10000 });

    const coords = await page.evaluate(() => {
      const el = [...document.querySelectorAll('li, [role="menuitem"]')]
        .find(el => /export excel/i.test(el.textContent.trim()) && el.offsetParent !== null);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });

    if (!coords) throw new Error('Export Excel menu item not found');

    // ── Launch PowerShell to handle Save As dialog ───────────────────────────
    const savePath = `${downloadDir}\\${targetName}`;
    const psContent = [
      'Start-Sleep -Seconds 4',
      '$wsh = New-Object -ComObject WScript.Shell',
      '$wsh.AppActivate("Save As")',
      'Start-Sleep -Milliseconds 1000',
      `$wsh.SendKeys("${savePath}")`,
      'Start-Sleep -Milliseconds 500',
      '$wsh.SendKeys("{ENTER}")',
      'Start-Sleep -Milliseconds 500',
      '$wsh.SendKeys("{ENTER}")',
    ].join('\n');
    fs.writeFileSync('C:\\temp\\saveas.ps1', psContent);
    exec('powershell -ExecutionPolicy Bypass -File C:\\temp\\saveas.ps1');
    console.log('[exporter] PowerShell launched to handle Save As dialog...');

    // ── Click Export Excel ───────────────────────────────────────────────────
    await page.mouse.click(coords.x, coords.y);
    console.log('[exporter] Clicked Export Excel.');

    // ── Wait for file ────────────────────────────────────────────────────────
    console.log('[exporter] Waiting for download...');
    const winDownloads = os.homedir() + '\\Downloads';
    const startTime = Date.now();
    const deadline = Date.now() + 120000;
    let finalFile = null;

    while (Date.now() < deadline) {
      await sleep(2000);

      // Check project downloads folder
      const projFiles = fs.readdirSync(downloadDir)
        .filter(f => !f.endsWith('.crdownload') && !f.endsWith('.tmp') &&
          (f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.csv')));
      if (projFiles.length > 0) {
        finalFile = { src: path.join(downloadDir, projFiles[0]), fromWin: false };
        break;
      }

      // Check Windows Downloads folder
      const winFiles = fs.readdirSync(winDownloads)
        .filter(f => !f.endsWith('.crdownload') && !f.endsWith('.tmp') &&
          (f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.csv')))
        .map(f => ({ name: f, time: fs.statSync(path.join(winDownloads, f)).mtimeMs }))
        .filter(f => f.time >= startTime)
        .sort((a, b) => b.time - a.time);
      if (winFiles.length > 0) {
        finalFile = { src: path.join(winDownloads, winFiles[0].name), fromWin: true };
        break;
      }
    }

    if (!finalFile) throw new Error('Download timed out - file not found after 2 minutes');

    // Move/rename to target path
    if (finalFile.src !== targetPath) {
      fs.copyFileSync(finalFile.src, targetPath);
      if (finalFile.fromWin) fs.unlinkSync(finalFile.src);
    }
    console.log(`[exporter] ✅ Saved as: ${targetPath}`);
    return targetPath;

  } finally {
    await browser.close();
    console.log('[exporter] Browser closed.');
  }
}

module.exports = { runExport };