/**
 * debug-login.js - Run this to debug the login page
 * node debug-login.js
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
require('dotenv').config();

async function debug() {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false, // VISIBLE so you can see what happens
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('[debug] Opening login page...');
  await page.goto('https://bkk-portal.everonet.com/passport/login', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  await new Promise(r => setTimeout(r, 3000));

  // Save screenshot
  await page.screenshot({ path: './debug-login.png', fullPage: true });
  console.log('[debug] Screenshot saved: debug-login.png');

  // Print all inputs
  const inputs = await page.evaluate(() =>
    [...document.querySelectorAll('input')].map(el => ({
      type: el.type, name: el.name, id: el.id,
      placeholder: el.placeholder, className: el.className.substring(0, 60),
    }))
  );
  console.log('\n[debug] ALL INPUTS:');
  inputs.forEach((inp, i) => console.log(`  [${i}]`, JSON.stringify(inp)));

  // Print all buttons
  const buttons = await page.evaluate(() =>
    [...document.querySelectorAll('button')].map(el => ({
      type: el.type, text: el.textContent.trim().substring(0, 50),
      id: el.id, className: el.className.substring(0, 60),
    }))
  );
  console.log('\n[debug] ALL BUTTONS:');
  buttons.forEach((btn, i) => console.log(`  [${i}]`, JSON.stringify(btn)));

  // Now try to fill and submit
  console.log('\n[debug] Attempting login...');
  const allInputs = await page.$$('input');
  for (const inp of allInputs) {
    const type = await inp.evaluate(el => el.type);
    const placeholder = await inp.evaluate(el => el.placeholder);
    console.log(`  Input type="${type}" placeholder="${placeholder}"`);
  }

  // Fill username (first non-password input)
  if (allInputs.length > 0) {
    await allInputs[0].click({ clickCount: 3 });
    await allInputs[0].type('Vietxiong', { delay: 80 });
    console.log('[debug] Typed username into input[0]');
  }

  // Fill password
  const pwInput = await page.$('input[type="password"]');
  if (pwInput) {
    await pwInput.click({ clickCount: 3 });
    await pwInput.type(process.env.PASSWORD || '', { delay: 80 });
    console.log('[debug] Typed password');
  }

  await page.screenshot({ path: './debug-filled.png', fullPage: true });
  console.log('[debug] Screenshot after fill saved: debug-filled.png');

  // Try clicking last button
  const allBtns = await page.$$('button');
  if (allBtns.length > 0) {
    const lastBtn = allBtns[allBtns.length - 1];
    const btnText = await lastBtn.evaluate(el => el.textContent.trim());
    console.log(`[debug] Clicking last button: "${btnText}"`);
    await lastBtn.click();
  }

  await new Promise(r => setTimeout(r, 5000));
  await page.screenshot({ path: './debug-after-login.png', fullPage: true });
  console.log('[debug] Screenshot after login attempt: debug-after-login.png');
  console.log('[debug] Current URL:', page.url());

  await browser.close();
}

debug().catch(err => {
  console.error('[debug] Error:', err.message);
  process.exit(1);
});