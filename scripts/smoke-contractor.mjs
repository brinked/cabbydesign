// Verify a contractor (20% off retail) sees retail x 0.8 on the report.
import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:5173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new', args: ['--window-size=1400,1000', '--no-sandbox'],
  defaultViewport: { width: 1400, height: 1000 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
const login = async (email, pw) => {
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {}));
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.login-field input[type=email]');
  await page.type('.login-field input[type=email]', email);
  await page.type('.login-field input[type=password]', pw);
  await page.click('.login-btn');
  await wait(1300);
};
const EMAIL = 'contractor_smoke@example.com';
// admin sets up retail pricing + a contractor account
await login('extcabinets@gmail.com', 'ChangeMe123');
await page.evaluate(async (em) => {
  await fetch('/api/settings/retail-pricing', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ retailPricing: { 'base-2door': 'W*D + 800' } }) });
  // create or update the contractor
  const list = await (await fetch('/api/dealers', { credentials: 'include' })).json();
  const existing = list.dealers.find((d) => d.email === em);
  const body = { name: 'Smoke Contractor', email: em, role: 'contractor', companyName: '', companySlogan: '', address: '', phone: '', active: true, taxExempt: false, contractorMode: 'retail_discount', retailDiscountPct: 20, ownPricing: {} };
  if (existing) await fetch(`/api/dealers/${existing.id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  else await fetch('/api/dealers', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, password: 'ChangeMe123' }) });
}, EMAIL);

// log in as the contractor, drop a 2-door base, view the report
await login(EMAIL, 'ChangeMe123');
await page.evaluate(() => {
  const wallId = 'w1';
  const design = { name: 'C', client: '', layout: 'linear', finishId: 'indigo', doorStyle: 'shaker',
    walls: [{ id: wallId, name: 'Front Wall', length: 90, height: 96, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
    items: [{ id: 'a', wallId, catalogId: 'base-2door', x: 0, w: 30, d: 24, h: 34.5, outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0 }],
    roughIns: [] };
  localStorage.setItem('cabdesign-v1', JSON.stringify({ state: { design, pricing: {}, retailPricing: {}, dims: {} }, version: 2 }));
});
await page.goto(BASE, { waitUntil: 'networkidle0' });
await wait(800);
await page.evaluate(() => [...document.querySelectorAll('.tabs:not(.screen-nav) .tab')].find((b) => b.textContent.trim() === 'Report')?.click());
await wait(900);
const cells = await page.$$eval('.schedule tbody td.num', (tds) => tds.map((t) => t.textContent.trim()));
const totals = await page.$$eval('.schedule tfoot td', (tds) => tds.map((t) => t.textContent.trim()));
console.log('cabinet line price:', cells[0], '(expect $1,216.00 = (30*24+800)*0.8)');
console.log('totals:', totals.join(' | '));
await browser.close();
