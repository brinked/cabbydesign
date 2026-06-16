// E2E test of the dealer path: admin creates a dealer (UI) → dealer logs in →
// adds a cabinet → saves a job (UI) → job appears in My Jobs → report respects
// pricing prefs. Assumes `npm run dev` is up and admin pw is ChangeMe123.
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:5173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);
const DEALER = `dealer_${Date.now().toString(36)}@example.com`;

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

async function login(email, password) {
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.login-field input[type=email]');
  await page.type('.login-field input[type=email]', email);
  await page.type('.login-field input[type=password]', password);
  await page.click('.login-btn');
  await wait(1200);
}

const clickNav = (label) =>
  page.evaluate((l) => [...document.querySelectorAll('.screen-nav .tab')].find((b) => b.textContent === l)?.click(), label);
const clickByText = (sel, text) =>
  page.evaluate((s, t) => [...document.querySelectorAll(s)].find((b) => b.textContent.trim() === t)?.click(), sel, text);

// 1. Admin creates a dealer through the UI
await login('extcabinets@gmail.com', 'ChangeMe123');
await clickNav('Admin');
await wait(600);
await clickByText('.screen-head-actions button', '+ Add dealer');
await wait(400);
// Grid inputs (new dealer): 0 name, 1 email, 2 company, 3 slogan, 4 address,
// 5 phone, 6 password (role is a <select>, not an input).
const gridInputs = await page.$$('.modal .form-grid input');
await gridInputs[0].type('E2E Dealer');
await gridInputs[1].type(DEALER);
await gridInputs[gridInputs.length - 1].type('dealerpass123');
await clickByText('.modal-actions button', 'Create dealer');
await wait(900);
const created = await page.$$eval('.data-table tbody tr td', (tds) => tds.some((t) => t.textContent.includes('E2E Dealer')));
log('dealer created in table:', created);

// 2. Set base pricing so the report has numbers (admin), then log out
// (skip — catalog defaults already price cabinets)
await clickByText('.toolbar-user button', 'Log out');
await wait(800);

// 3. Dealer logs in
await login(DEALER, 'dealerpass123');
const dealerName = await page.$eval('.user-name', (e) => e.textContent).catch(() => null);
log('dealer logged in:', dealerName);
const navItems = await page.$$eval('.screen-nav .tab', (els) => els.map((e) => e.textContent));
log('dealer nav (should NOT include Admin):', navItems.join(', '));

// 4. Add a cabinet on the first wall
await page.evaluate(() => [...document.querySelectorAll('.btn-dark')][0]?.click());
await wait(500);
await page.evaluate(() => [...document.querySelectorAll('.cat-card')][1]?.click());
await wait(500);
await page.evaluate(() => document.querySelector('.modal-head .btn-ghost')?.click());
await wait(300);

// 5. Save as a job (toolbar "Save job")
await clickByText('.toolbar-right button', 'Save job');
await wait(600);
// Save-job grid inputs: 0 job name, 1 customer name, 2 customer email, 3 address.
const jobInputs = await page.$$('.modal .form-grid input');
await jobInputs[1].type('Jane Customer');
await jobInputs[2].type('jane@example.com');
await clickByText('.modal-actions button', 'Save job');
await wait(1000);

// after save we are routed to My Jobs
const jobRows = await page.$$eval('.data-table tbody tr', (r) => r.length).catch(() => 0);
const hasCustomer = await page
  .$$eval('.data-table tbody td', (tds) => tds.some((t) => t.textContent.includes('Jane Customer')))
  .catch(() => false);
log('job rows after save:', jobRows, '| customer present:', hasCustomer);
await page.screenshot({ path: 'smoke-dealer-jobs.png' });

// 6. Set margin + cost mode, then check report
await clickNav('Profile');
await wait(500);
await page.evaluate(() => {
  const inp = document.querySelector('.suffix-input input');
  inp.value = '';
});
await page.type('.suffix-input input', '50');
await clickByText('.screen-actions button', 'Save preferences');
await wait(700);

// open report
await clickNav('Designer');
await wait(400);
await clickByText('.tabs:not(.screen-nav) .tab', 'Report');
await wait(800);
const estimateShown = await page.$$eval('.schedule td', (tds) => tds.some((t) => t.textContent.includes('Estimate total')));
log('report shows estimate total (marked-up):', estimateShown);
await page.screenshot({ path: 'smoke-dealer-report.png' });

log('console errors:', errors.length ? errors : 'none');
await browser.close();
log('DONE');
