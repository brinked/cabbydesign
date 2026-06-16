// Close-up render of the grill head for visual review. Injects a small design
// (one grill on a short wall) so the head fills the frame.
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

// inject a short wall with a single grill so the head is large in frame
await page.evaluate(() => {
  const wallId = 'wall-demo';
  const design = {
    name: 'Grill', client: '', layout: 'linear', finishId: 'indigo', doorStyle: 'shaker',
    walls: [{ id: wallId, name: 'Front Wall', length: 40, height: 56, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
    items: [
      { id: 'it-1', wallId, catalogId: 'out-grill', x: 2, w: 36, d: 27, h: 34.5, outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0 },
    ],
    roughIns: [],
  };
  localStorage.setItem('cabdesign-v1', JSON.stringify({ state: { design, pricing: {}, dims: {} }, version: 2 }));
});
await page.goto(BASE, { waitUntil: 'networkidle0' });
await wait(900);

const svg = await page.$('.elevation-svg');
await svg.screenshot({ path: 'shot-grill.png' });
await browser.close();
console.log('saved shot-grill.png');
