// Render trash pull-out + trash-and-drawer cabinets to verify top handle.
import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:5173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new', args: ['--window-size=1200,760', '--no-sandbox'],
  defaultViewport: { width: 1200, height: 760 },
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
  const design = { name: 'Trash', client: '', layout: 'linear', finishId: 'indigo', doorStyle: 'shaker',
    counterThickness: 1.25, counterId: 'classic-white', backsplashHeight: 0,
    walls: [{ id: wallId, name: 'Front Wall', length: 50, height: 42, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
    items: [
      { id: 't1', wallId, catalogId: 'base-trash',      x: 3,  w: 15, d: 24, h: 34.5, outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0 },
      { id: 't2', wallId, catalogId: 'base-trashdrawer', x: 22, w: 18, d: 24, h: 34.5, outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0 },
    ],
    roughIns: [] };
  localStorage.setItem('cabdesign-v1', JSON.stringify({ state: { design, pricing: {}, dims: {} }, version: 2 }));
});
await page.goto(BASE, { waitUntil: 'networkidle0' });
await wait(1500);
const svg = await page.$('.elevation-svg');
await svg.screenshot({ path: 'shot-trash.png' });
await browser.close();
console.log('saved shot-trash.png');
