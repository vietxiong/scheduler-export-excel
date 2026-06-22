const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
require('dotenv').config();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function debug() {
  const downloadDir = 'D:\\project\\node js\\scheduler-export-excel\\downloads';
  if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });

  // ── Login ──────────────────────────────────────────────────────────────────
  console.log('[debug] Logging in...');
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
  console.log('[debug] Logged in!');

  // ── Trade list ─────────────────────────────────────────────────────────────
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const startday = yesterday.toISOString().slice(0, 10);
  const endday = new Date().toISOString().slice(0, 10);
  const start = encodeURIComponent(`${startday}T00:00:00+07:00`);
  const end   = encodeURIComponent(`${endday}T23:59:59+07:00`);

   console.log({ startday, endday, start, end });
  const url   = `https://bkk-portal.everonet.com/trades/trade/list?startTime=${start}&endTime=${end}&utcOffsetName=420&utcOffset=420&page=1&size=10&tradeMode=Standard`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 });
  await sleep(4000);

  // ── Select All ─────────────────────────────────────────────────────────────
  console.log('[debug] Clicking Select All...');
  await page.waitForFunction(() => !!document.querySelector('button[role="switch"]'), { timeout: 15000 });
  await page.evaluate(() => document.querySelector('button[role="switch"]').click());
  await sleep(2000);

  // ── Click dropdown arrow to open Export menu ───────────────────────────────
  console.log('[debug] Opening Export dropdown...');
  const arrowBtn = await page.$('#Trade_list_export_all_button');
  if (arrowBtn) {
    await arrowBtn.click();
    console.log('[debug] Clicked dropdown arrow by ID.');
  } else {
    await page.evaluate(() => {
      const arrows = [...document.querySelectorAll('button')].filter(b =>
        b.querySelector('.anticon-down') || b.classList.contains('ant-dropdown-trigger')
      );
      if (arrows.length > 0) arrows[0].click();
    });
    console.log('[debug] Clicked dropdown arrow by class.');
  }
  await sleep(1500);

  // ── Click Export Excel using real mouse coordinates ────────────────────────
  console.log('[debug] Finding Export Excel menu item...');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('li, [role="menuitem"]')]
      .some(el => /export excel/i.test(el.textContent) && el.offsetParent !== null),
  { timeout: 10000 });

  const coords = await page.evaluate(() => {
    const el = [...document.querySelectorAll('li, [role="menuitem"]')]
      .find(el => /export excel/i.test(el.textContent.trim()) && el.offsetParent !== null);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: el.textContent.trim() };
  });
  console.log('[debug] Export Excel coords:', coords);

  if (coords) {
    // Launch PowerShell BEFORE clicking (will wait 4s then handle dialog)
    const startdateStr = startday.replace(/-/g, '');
    const enddateStr = endday.replace(/-/g, '');
    const savePath = `D:\\project\\node js\\scheduler-export-excel\\downloads\\TransDetails_${startdateStr}-${enddateStr}.xlsx`;
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
    console.log('[debug] PowerShell launched (will handle dialog in 4s)...');

    // Real mouse click on Export Excel
    await page.mouse.click(coords.x, coords.y);
    console.log('[debug] Mouse clicked Export Excel!');
  }

  // ── Wait for file ──────────────────────────────────────────────────────────
  console.log('[debug] Waiting for download...');
  const startdateStr = startday.replace(/-/g, '');
  const enddateStr = endday.replace(/-/g, '');
  const targetPath = path.join(downloadDir, `TransDetails_${startdateStr}-${enddateStr}.xlsx`);
  const winDownloads = os.homedir() + '\\Downloads';
  const startTime = Date.now();
  const deadline = Date.now() + 120000;
  let finalFile = null;

  while (Date.now() < deadline) {
    await sleep(2000);
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    const projFiles = fs.readdirSync(downloadDir)
      .filter(f => !f.endsWith('.crdownload') && !f.endsWith('.tmp') &&
        (f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.csv')));
    if (projFiles.length > 0) {
      finalFile = { src: path.join(downloadDir, projFiles[0]), fromWin: false };
      console.log('[debug] Found in project folder:', projFiles[0]);
      break;
    }

    const winFiles = fs.readdirSync(winDownloads)
      .filter(f => !f.endsWith('.crdownload') && !f.endsWith('.tmp') &&
        (f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.csv')))
      .map(f => ({ name: f, time: fs.statSync(path.join(winDownloads, f)).mtimeMs }))
      .filter(f => f.time >= startTime)
      .sort((a, b) => b.time - a.time);
    if (winFiles.length > 0) {
      finalFile = { src: path.join(winDownloads, winFiles[0].name), fromWin: true };
      console.log('[debug] Found in Windows Downloads:', winFiles[0].name);
      break;
    }

    console.log(`[debug] Waiting... ${elapsed}s`);
  }

  if (finalFile) {
    if (finalFile.src !== targetPath) {
      fs.copyFileSync(finalFile.src, targetPath);
      if (finalFile.fromWin) fs.unlinkSync(finalFile.src);
    }
    console.log('[debug] ✅ Saved as:', targetPath);
  } else {
    console.log('[debug] ❌ File not found after 2 minutes.');
  }

  await browser.close();
}

debug().catch(err => {
  console.error('[debug] Error:', err.message);
  process.exit(1);
});