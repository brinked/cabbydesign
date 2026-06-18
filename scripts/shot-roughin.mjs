// Verify rough-in colors: green when behind a cabinet OR in open space; red when
// a cabinet end intrudes.
import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:5173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new', args: ['--window-size=1500,950', '--no-sandbox'],
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
  const wallId = 'w1';
  const ri = (id, x) => ({ id, wallId, kind: 'electrical', x, y: 20, w: 4.5, h: 4.5 });
  const design = { name: 'Rough', client: '', layout: 'linear', finishId: 'indigo', doorStyle: 'shaker',
    walls: [{ id: wallId, name: 'Front Wall', length: 90, height: 40, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
    items: [{ id: 'c1', wallId, catalogId: 'base-2door', x: 0, w: 30, d: 24, h: 34.5, outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0 }],
    roughIns: [
      ri('green-behind', 15),   // behind the cabinet, centered -> GREEN
      ri('red-end', 30),        // at the cabinet's right end -> RED
      ri('green-open', 55),     // open space, no cabinet -> GREEN
    ] };
  localStorage.setItem('cabdesign-v1', JSON.stringify({ state: { design, pricing: {}, dims: {} }, version: 2 }));
});
await page.goto(BASE, { waitUntil: 'networkidle0' });
await wait(900);
const svg = await page.$('.elevation-svg');
await svg.screenshot({ path: 'shot-roughin.png' });
await browser.close();
console.log('saved shot-roughin.png');
