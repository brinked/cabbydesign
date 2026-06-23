// Render the built-in oven/microwave + fridge tall cabinets (elevation) for review.
import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:5174';
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
  const design = { name: 'Tall', client: '', layout: 'linear', finishId: 'mocha', doorStyle: 'shaker',
    counterThickness: 1.25, counterId: 'classic-white', backsplashHeight: 0,
    walls: [{ id: wallId, name: 'Front Wall', length: 84, height: 92, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
    items: [
      { id: 'a1', wallId, catalogId: 'tall-appliance', x: 4, w: 33, d: 24, h: 84, outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0 },
      { id: 'f1', wallId, catalogId: 'tall-fridge', x: 42, w: 36, d: 24, h: 84, outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0 },
    ],
    roughIns: [] };
  localStorage.setItem('cabdesign-v1', JSON.stringify({ state: { design, pricing: {}, dims: {} }, version: 2 }));
});
await page.goto(BASE, { waitUntil: 'networkidle0' });
await wait(1500);
const svg = await page.$('.elevation-svg');
await svg.screenshot({ path: 'shot-tallappliance.png' });
// also grab the 3D view
await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='3D'); if(b) b.click(); });
await wait(2500);
const c = await page.$('canvas');
if (c) await c.screenshot({ path: 'shot-tallappliance-3d.png' });
await browser.close();
console.log('saved shot-tallappliance.png + 3d');
