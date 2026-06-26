// Verify countertop follows a reduced-height cabinet (2D elevation + 3D).
import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:5173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new', args: ['--window-size=1400,820', '--no-sandbox'],
  defaultViewport: { width: 1400, height: 820 },
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
  const design = { name: 'CounterHeight', client: '', layout: 'linear', finishId: 'indigo', doorStyle: 'shaker',
    counterThickness: 1.25, counterId: 'absolute-black', backsplashHeight: 0, dimFrom: 'left',
    walls: [{ id: wallId, name: 'Front Wall', length: 100, height: 42, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
    items: [
      { id: 'c1', wallId, catalogId: 'base-2door', x: 2,  w: 30, d: 24, h: 34.5, outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0 },
      { id: 'c2', wallId, catalogId: 'base-drawer3', x: 32, w: 24, d: 24, h: 24,   outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0 },
      { id: 'c3', wallId, catalogId: 'base-2door', x: 56, w: 30, d: 24, h: 34.5, outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0 },
    ],
    roughIns: [], openings: [] };
  localStorage.setItem('cabdesign-v1', JSON.stringify({ state: { design, pricing: {}, dims: {} }, version: 2 }));
});
await page.goto(BASE, { waitUntil: 'networkidle0' });
await wait(1500);
const svg = await page.$('.elevation-svg');
await svg.screenshot({ path: 'shot-counterheight.png' });
await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='3D'); if(b) b.click(); });
await wait(2500);
const c = await page.$('canvas');
if (c) await c.screenshot({ path: 'shot-counterheight-3d.png' });
await browser.close();
console.log('saved shot-counterheight.png + 3d');
