// Verify fridge/ice-maker appliance selection + height-gap rendering.
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

// Seed appliance inventory (fridge 32"H, panel-ready fridge 34"H w/ $250 panel, ice maker 30"H)
await page.evaluate(async () => {
  const appliances = [
    { id: 'sub-fridge32', category: 'fridge', brand: 'CoolBrand', model: 'CF32', name: '1-Door 32" Fridge', msrp: 2000, cutoutW: 24, cutoutD: 24, cutoutH: 32, active: true },
    { id: 'sub-fridgep', category: 'fridge', brand: 'CoolBrand', model: 'CFP34', name: 'Panel-Ready 34" Fridge', msrp: 2400, cutoutW: 24, cutoutD: 24, cutoutH: 34, panelCharge: 250, active: true },
    { id: 'ice-15', category: 'icemaker', brand: 'CoolBrand', model: 'IM15', name: '15" Ice Maker', msrp: 1500, cutoutW: 15, cutoutD: 24, cutoutH: 30, active: true },
  ];
  await fetch('/api/settings/appliances', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appliances }) });
  await fetch('/api/settings/appliance-brands', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brands: { CoolBrand: { discountPct: 30 } } }) });
});

// Inject a design: fridge cabinet (32" fridge), fridge cabinet (full-height), ice maker cabinet
await page.evaluate(() => {
  const wallId = 'w1';
  const cab = (id, catalogId, x, w, appliance) => ({ id, wallId, catalogId, x, w, d: 27, h: 34.5, outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0, appliance });
  const design = { name: 'Fridge Test', client: 'Jane', layout: 'linear', finishId: 'indigo', doorStyle: 'shaker',
    walls: [{ id: wallId, name: 'Front Wall', length: 84, height: 56, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
    items: [
      cab('a', 'out-fridge', 2, 24, { mode: 'inventory', applianceId: 'sub-fridge32', withLiner: false }),
      cab('b', 'out-fridgep', 28, 24, { mode: 'inventory', applianceId: 'sub-fridgep', withLiner: false }),
      { id: 'c', wallId, catalogId: 'out-icemaker', x: 54, w: 15, d: 24, h: 34.5, outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0, appliance: { mode: 'inventory', applianceId: 'ice-15', withLiner: false } },
    ], roughIns: [] };
  localStorage.setItem('cabdesign-v1', JSON.stringify({ state: { design, pricing: {}, dims: {} }, version: 2 }));
});
await page.goto(BASE, { waitUntil: 'networkidle0' });
await wait(1500);
const svg = await page.$('.elevation-svg');
await svg.screenshot({ path: 'shot-fridge.png' });

// check report appliance + panel lines
await page.evaluate(() => [...document.querySelectorAll('.tabs:not(.screen-nav) .tab')].find((b) => b.textContent.trim() === 'Report')?.click());
await wait(1000);
const approws = await page.$$eval('.schedule td', (tds) => tds.map((t) => t.textContent.trim()));
console.log('report has panel line:', approws.some((t) => /panel-ready|cabinet-matched panel/i.test(t)));
console.log('report appliance labels present:', approws.some((t) => /CF32|CFP34|IM15/.test(t)));
await browser.close();
console.log('saved shot-fridge.png');
