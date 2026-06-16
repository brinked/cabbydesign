// Render the new catalog items (pedestal, dishwasher, ice maker) in elevation.
import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:5173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--window-size=1500,950', '--no-sandbox'],
  defaultViewport: { width: 1500, height: 950 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.waitForSelector('.login-field input[type=email]');
await page.type('.login-field input[type=email]', 'extcabinets@gmail.com');
await page.type('.login-field input[type=password]', 'ChangeMe123');
await page.click('.login-btn');
await wait(1200);
await page.evaluate(() => {
  const wallId = 'wall-demo';
  const it = (id, catalogId, x, w, h) => ({ id, wallId, catalogId, x, w, d: 24, h, outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0 });
  const design = {
    name: 'Appliances', client: '', layout: 'linear', finishId: 'indigo', doorStyle: 'shaker',
    walls: [{ id: wallId, name: 'Front Wall', length: 84, height: 56, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
    items: [
      it('p1', 'base-pedestal', 2, 30, 20),
      it('p2', 'app-dishwasher', 34, 24, 34.5),
      it('p3', 'app-icemaker', 60, 15, 34.5),
    ],
    roughIns: [],
  };
  localStorage.setItem('cabdesign-v1', JSON.stringify({ state: { design, pricing: {}, dims: {} }, version: 2 }));
});
await page.goto(BASE, { waitUntil: 'networkidle0' });
await wait(1000);
const svg = await page.$('.elevation-svg');
await svg.screenshot({ path: 'shot-appliances.png' });
await browser.close();
console.log('saved shot-appliances.png');
