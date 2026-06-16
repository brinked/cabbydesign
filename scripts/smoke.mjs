// End-to-end smoke test of the dealer portal: login → admin → profile → jobs.
// Usage: node scripts/smoke.mjs
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:5173';
const EMAIL = process.env.SMOKE_EMAIL ?? 'extcabinets@gmail.com';
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'Test1234!';

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--window-size=1500,950', '--no-sandbox'],
  defaultViewport: { width: 1500, height: 950 },
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await wait(400);

// 1. Login screen present
const hasLogin = await page.$('.login-card');
log('login screen:', !!hasLogin);

// 2. Sign in
await page.type('.login-field input[type=email]', EMAIL);
await page.type('.login-field input[type=password]', PASSWORD);
await page.click('.login-btn');
await wait(1200);
const loggedIn = await page.$('.toolbar-user');
log('logged in (toolbar visible):', !!loggedIn);
const userName = await page.$eval('.user-name', (e) => e.textContent).catch(() => null);
log('user name:', userName);
await page.screenshot({ path: 'smoke-1-designer.png' });

// 3. Admin nav visible + dealer table
const navLabels = await page.$$eval('.screen-nav .tab', (els) => els.map((e) => e.textContent));
log('nav items:', navLabels.join(', '));
await page.evaluate(() => {
  [...document.querySelectorAll('.screen-nav .tab')].find((b) => b.textContent === 'Admin')?.click();
});
await wait(800);
const dealerRows = await page.$$eval('.data-table tbody tr', (rows) => rows.length).catch(() => 0);
log('dealer rows:', dealerRows);
await page.screenshot({ path: 'smoke-2-admin.png' });

// 4. Profile screen
await page.evaluate(() => {
  [...document.querySelectorAll('.screen-nav .tab')].find((b) => b.textContent === 'Profile')?.click();
});
await wait(600);
const hasMargin = await page.$eval('.suffix-input input', (e) => e.value).catch(() => null);
log('profile margin field value:', hasMargin);
await page.screenshot({ path: 'smoke-3-profile.png' });

// 5. Jobs screen
await page.evaluate(() => {
  [...document.querySelectorAll('.screen-nav .tab')].find((b) => b.textContent === 'My Jobs')?.click();
});
await wait(600);
const jobsHead = await page.$eval('.screen h1', (e) => e.textContent).catch(() => null);
log('jobs screen heading:', jobsHead);
await page.screenshot({ path: 'smoke-4-jobs.png' });

log('console errors:', errors.length ? errors : 'none');
await browser.close();
log('DONE');
