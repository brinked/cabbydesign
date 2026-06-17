// Verify: selecting a fridge auto-fits width+depth, and the 3D view shows the
// height gap (fridge renders at the model's height).
import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:5173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new', args: ['--window-size=1500,950', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
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
await page.evaluate(async () => {
  const appliances = [{ id: 'cb-cf24', category: 'fridge', brand: 'CoolBrand', model: 'CF24', name: '24" Fridge', msrp: 2200, cutoutW: 24, cutoutD: 22, cutoutH: 30, active: true }];
  await fetch('/api/settings/appliances', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appliances }) });
});
await page.evaluate(() => {
  const wallId = 'w1';
  const design = { name: 'Fridge2', client: '', layout: 'linear', finishId: 'indigo', doorStyle: 'shaker',
    walls: [{ id: wallId, name: 'Front Wall', length: 80, height: 60, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
    items: [{ id: 'f1', wallId, catalogId: 'out-fridge', x: 4, w: 30, d: 27, h: 34.5, outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0 }],
    roughIns: [] };
  localStorage.setItem('cabdesign-v1', JSON.stringify({ state: { design, pricing: {}, dims: {} }, version: 2 }));
});
await page.goto(BASE, { waitUntil: 'networkidle0' });
await wait(900);
// open editor, select the model
const img = await page.$('.elevation-svg image');
await img.click();
await wait(500);
await page.evaluate(() => [...document.querySelectorAll('.appliance-section .seg-btn')].find((b) => b.textContent.includes('From inventory'))?.click());
await wait(300);
await page.waitForSelector('.appliance-select', { timeout: 4000 });
await page.select('.appliance-select', 'cb-cf24');
await wait(700);
const dims = await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('cabdesign-v1')).state.design;
  return { w: d.items[0].w, d: d.items[0].d, h: d.items[0].h };
});
console.log('after select -> w,d,h:', JSON.stringify(dims), '(expect w=24, d=22, h=34.5)');
// close editor
await page.evaluate(() => document.querySelector('.modal-actions .btn-primary')?.click());
await wait(400);
const svg = await page.$('.elevation-svg');
await svg.screenshot({ path: 'smoke-fridge2-elev.png' });
// 3D view
await page.evaluate(() => [...document.querySelectorAll('.tabs:not(.screen-nav) .tab')].find((b) => b.textContent.trim() === '3D')?.click());
await wait(2500);
await page.screenshot({ path: 'smoke-fridge2-3d.png' });
await browser.close();
console.log('saved screenshots');
