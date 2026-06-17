// Verify selecting a 27" fridge auto-sizes the opening to 27" (no width error).
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
await page.evaluate(async () => {
  const appliances = [{ id: 'cb-cf27', category: 'fridge', brand: 'CoolBrand', model: 'CF27', name: '27" Fridge', msrp: 2200, cutoutW: 27, cutoutD: 24, cutoutH: 33, active: true }];
  await fetch('/api/settings/appliances', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appliances }) });
});
// fridge opening 24" wide on a roomy wall, no appliance yet
await page.evaluate(() => {
  const wallId = 'w1';
  const design = { name: 'Autofit', client: '', layout: 'linear', finishId: 'indigo', doorStyle: 'shaker',
    walls: [{ id: wallId, name: 'Front Wall', length: 90, height: 96, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
    items: [{ id: 'f1', wallId, catalogId: 'out-fridge', x: 4, w: 24, d: 27, h: 34.5, outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0 }],
    roughIns: [] };
  localStorage.setItem('cabdesign-v1', JSON.stringify({ state: { design, pricing: {}, dims: {} }, version: 2 }));
});
await page.goto(BASE, { waitUntil: 'networkidle0' });
await wait(900);
// open editor: click the fridge's rendered sprite element directly
const img = await page.$('.elevation-svg image');
await img.click();
await wait(600);
const modalOpen = await page.$('.appliance-section');
console.log('editor modal open:', !!modalOpen);
// switch Refrigeration to "From inventory", then pick the model
await page.evaluate(() => [...document.querySelectorAll('.appliance-section .seg-btn')].find((b) => b.textContent.includes('From inventory'))?.click());
await wait(400);
await page.waitForSelector('.appliance-select', { timeout: 4000 });
await page.select('.appliance-select', 'cb-cf27');
await wait(600);
const width = await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('cabdesign-v1')).state.design;
  return d.items[0].w;
});
const warnText = await page.$$eval('.appliance-section .warn', (els) => els.map((e) => e.textContent).join(' '));
console.log('fridge opening width after selecting 27" model:', width);
console.log('warning shown:', warnText || '(none)');
await page.screenshot({ path: 'smoke-autofit.png' });
await browser.close();
