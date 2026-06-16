// Verify rough-in dragging: add a cabinet + plumbing stub, drag it, confirm it
// moves, shows live dimensions, and stays within the cabinet clearance band.
import puppeteer from 'puppeteer-core';

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

await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.waitForSelector('.login-field input[type=email]');
await page.type('.login-field input[type=email]', 'extcabinets@gmail.com');
await page.type('.login-field input[type=password]', 'ChangeMe123');
await page.click('.login-btn');
await wait(1200);

// add a wide 2-door base cabinet so the stub has a host
await page.evaluate(() => [...document.querySelectorAll('.btn-dark')][0]?.click());
await wait(500);
await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.cat-card')];
  cards.find((c) => c.textContent.includes('2-Door Base'))?.click();
});
await wait(500);
await page.evaluate(() => document.querySelector('.modal-head .btn-ghost')?.click());
await wait(300);

// add a plumbing rough-in, close its editor
await page.evaluate(() => [...document.querySelectorAll('.btn-soft')].find((b) => b.textContent.includes('Plumbing'))?.click());
await wait(400);
await page.evaluate(() => document.querySelector('.modal-head .btn-ghost')?.click());
await wait(400);

const readTransform = () => page.$eval('[data-roughin]', (g) => g.getAttribute('transform'));
const before = await readTransform();
log('rough-in transform before:', before);

// drag the stub: press on it, move right+up in steps, screenshot mid-drag, release
const box = await page.$eval('[data-roughin]', (g) => {
  const r = g.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.move(box.x, box.y);
await page.mouse.down();
for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + i * 18, box.y - i * 8);
await wait(150);
const dimsVisible = await page.$$eval('.rough-dims', (g) => g.length > 0);
const dimText = await page.$$eval('.rough-dims text', (ts) => ts.map((t) => t.textContent));
await page.screenshot({ path: 'smoke-roughin-drag.png' });
await page.mouse.up();
await wait(300);

const after = await readTransform();
log('rough-in transform after: ', after);
log('moved:', before !== after);
log('live dims visible during drag:', dimsVisible, '| labels:', dimText.join('  '));

// drag far right to test clearance clamping (should NOT exceed cabinet right end - 1in)
await page.mouse.move(box.x, box.y);
await page.mouse.down();
for (let i = 1; i <= 20; i++) await page.mouse.move(box.x + i * 40, box.y);
await page.mouse.up();
await wait(300);
// open editor to read the committed center-from-left value
await page.evaluate(() => document.querySelector('[data-roughin]')?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
const afterFar = await readTransform();
log('transform after far-right drag (clamped):', afterFar);

log('console errors:', errors.length ? errors : 'none');
await browser.close();
log('DONE');
