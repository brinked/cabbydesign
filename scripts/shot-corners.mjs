// Verify corner-cabinet applied ends + waterfalls (diagonal corner + lazy susan).
import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:5173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
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
  // a diagonal corner with both applied ends + both waterfalls, and a lazy susan likewise
  const design = { name: 'Corners', client: '', layout: 'linear', finishId: 'indigo', doorStyle: 'shaker',
    counterThickness: 1.25, counterId: 'absolute-black', backsplashHeight: 0, dimFrom: 'left',
    walls: [{ id: wallId, name: 'Front Wall', length: 120, height: 50, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
    items: [
      { id: 'c1', wallId, catalogId: 'base-corner', x: 6,  w: 36, d: 36, h: 34.5, outset: 0, mount: 0, hinge: 'left', endL: true, endR: true, trays: 0, waterfallL: true, waterfallR: true },
      { id: 's1', wallId, catalogId: 'base-susan',  x: 60, w: 36, d: 36, h: 34.5, outset: 0, mount: 0, hinge: 'left', endL: true, endR: true, trays: 0, waterfallL: true, waterfallR: true },
    ],
    roughIns: [], openings: [] };
  localStorage.setItem('cabdesign-v1', JSON.stringify({ state: { design, pricing: {}, dims: {} }, version: 2 }));
});
await page.goto(BASE, { waitUntil: 'networkidle0' });
await wait(1500);
const svg = await page.$('.elevation-svg');
await svg.screenshot({ path: 'shot-corners-elev.png' });
await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='3D'); if(b) b.click(); });
await wait(2600);
const c = await page.$('canvas');
if (c) await c.screenshot({ path: 'shot-corners-3d.png' });
await browser.close();
console.log('saved corner shots');
