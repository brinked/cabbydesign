// Check the report shows markup + sales tax. Logs the totals + screenshots them.
import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:5173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new', args: ['--window-size=1300,1000', '--no-sandbox'],
  defaultViewport: { width: 1300, height: 1000 },
});
const page = await browser.newPage();
await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.waitForSelector('.login-field input[type=email]');
await page.type('.login-field input[type=email]', 'extcabinets@gmail.com');
await page.type('.login-field input[type=password]', 'ChangeMe123');
await page.click('.login-btn');
await wait(1200);
// ensure marked-up percent + not exempt for the admin
await page.evaluate(() =>
  fetch('/api/profile/prefs', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ marginPct: 35, flatAmount: 0, markupMode: 'percent', showPricing: true, priceMode: 'marked_up' }) }));
await page.evaluate(() => {
  const wallId = 'w1';
  const it = (id, catalogId, x, w) => ({ id, wallId, catalogId, x, w, d: 24, h: 34.5, outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0 });
  const design = { name: 'Tax Test', client: 'Jane', layout: 'linear', finishId: 'indigo', doorStyle: 'shaker',
    walls: [{ id: wallId, name: 'Front Wall', length: 90, height: 96, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
    items: [it('a', 'base-2door', 0, 30), it('b', 'base-drawer3', 30, 18)], roughIns: [] };
  localStorage.setItem('cabdesign-v1', JSON.stringify({ state: { design, pricing: {}, dims: {} }, version: 2 }));
});
await page.goto(BASE, { waitUntil: 'networkidle0' });
await wait(800);
await page.evaluate(() => [...document.querySelectorAll('.tabs:not(.screen-nav) .tab')].find((b) => b.textContent.trim() === 'Report')?.click());
await wait(900);
const totals = await page.$$eval('.schedule tfoot td', (tds) => tds.map((t) => t.textContent.trim()));
console.log('totals rows:', totals.join(' | '));
const hasTax = totals.some((t) => /Sales tax/i.test(t));
console.log('shows sales tax line:', hasTax);
await browser.close();
