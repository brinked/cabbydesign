// Verify the logo flow: login → Profile → upload logo → preview appears →
// report cover shows the logo. Assumes `npm run dev` is up.
import puppeteer from 'puppeteer-core';
import path from 'node:path';

const BASE = 'http://localhost:5173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--window-size=1500,950', '--no-sandbox'],
  defaultViewport: { width: 1500, height: 950 },
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && !m.text().includes('favicon') && errors.push(m.text()));
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

const clickNav = (label) =>
  page.evaluate((l) => [...document.querySelectorAll('.screen-nav .tab')].find((b) => b.textContent === l)?.click(), label);
const clickByText = (sel, text) =>
  page.evaluate((s, t) => [...document.querySelectorAll(s)].find((b) => b.textContent.trim() === t)?.click(), sel, text);

await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.waitForSelector('.login-field input[type=email]');
await page.type('.login-field input[type=email]', 'extcabinets@gmail.com');
await page.type('.login-field input[type=password]', 'ChangeMe123');
await page.click('.login-btn');
await wait(1200);

// Clear any existing logo via API first for a clean test
await page.evaluate(() =>
  fetch('/api/profile/logo', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logo: '' }),
  })
);

await clickNav('Profile');
await wait(600);
const hasLogoCard = await page.$$eval('.card h2', (hs) => hs.some((h) => h.textContent.includes('Company logo')));
log('logo card present:', hasLogoCard);

// Upload the test logo through the hidden file input
const input = await page.$('.logo-actions input[type=file]');
await input.uploadFile(path.resolve('testlogo.png'));
await wait(1500);
const previewSrc = await page.$eval('.logo-preview img', (i) => i.src).catch(() => null);
log('preview shows uploaded image:', previewSrc ? previewSrc.slice(0, 30) + '…' : 'NONE');
await page.screenshot({ path: 'smoke-logo-profile.png' });

// Now check the report cover
await clickNav('Designer');
await wait(400);
await clickByText('.tabs:not(.screen-nav) .tab', 'Report');
await wait(900);
const coverLogo = await page.$eval('.cover-logo', (i) => i.src).catch(() => null);
log('report cover logo present:', !!coverLogo);
await page.screenshot({ path: 'smoke-logo-report.png' });

log('console errors:', errors.length ? errors : 'none');
await browser.close();
log('DONE');
