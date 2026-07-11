// Render every per-appliance grill/griddle model (front elevation sprites +
// a 3D view) to PNGs for visual verification. Requires the dev stack
// (api on :4000, vite on :5173) and the seeded test appliance inventory.
import puppeteer from 'puppeteer-core';
const BASE = process.env.BASE ?? 'http://localhost:5199';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new', args: ['--window-size=1700,1000', '--no-sandbox', '--no-proxy-server'],
  defaultViewport: { width: 1700, height: 1000 },
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
await wait(1500);
await page.evaluate(() => {
  const appl = (id) => ({ mode: 'inventory', applianceId: id, withLiner: true });
  const grill = (id, wallId, x, w, appliance) => ({
    id, wallId, catalogId: 'out-grill', x, w, d: 27, h: 34.5, outset: 0, mount: 0,
    hinge: 'left', endL: false, endR: false, trays: 0, appliance,
  });
  const griddle = (id, wallId, x, w, appliance) => ({ ...grill(id, wallId, x, w, appliance), catalogId: 'out-griddle' });
  const design = {
    name: 'GrillModels', client: '', layout: 'galley', finishId: 'indigo', doorStyle: 'shaker',
    counterThickness: 1.5, counterId: 'classic-white', backsplashHeight: 0,
    walls: [
      { id: 'w1', name: 'Wall 1', length: 190, height: 60, x: 0, y: 0, angle: 0, thickness: 5, ghost: false },
      { id: 'w2', name: 'Wall 2', length: 190, height: 60, x: 0, y: 130, angle: 0, thickness: 5, ghost: false },
      { id: 'w3', name: 'Wall 3', length: 190, height: 60, x: 0, y: 260, angle: 0, thickness: 5, ghost: false },
    ],
    items: [
      grill('g1', 'w1', 2, 40, appl('blaze-blz-4lte2-lp-ng')), // Blaze LTE 32
      grill('g2', 'w1', 46, 46, appl('blaze-blz-5lte2-lp-ng')), // Blaze LTE 40
      grill('g3', 'w1', 96, 46, appl('blaze-blz-5ltepro-lp-ng')), // Blaze LTE Pro 40
      grill('g4', 'w1', 146, 40, undefined), // generic Broilmaster fallback
      grill('g5', 'w2', 2, 40, appl('napoleon-big32')),
      grill('g6', 'w2', 46, 46, appl('napoleon-big38')),
      grill('g7', 'w2', 96, 52, appl('napoleon-big44')),
      grill('g8', 'w3', 2, 40, appl('xo-32xlt')),
      grill('g9', 'w3', 46, 46, appl('xo-40xlt')),
      griddle('g10', 'w3', 96, 38, appl('lg-oml75')),
      griddle('g11', 'w3', 138, 48, appl('lg-oml105')),
    ],
    roughIns: [], openings: [], measurements: [],
  };
  localStorage.setItem('cabdesign-v1', JSON.stringify({ state: { design, pricing: {}, dims: {} }, version: 2 }));
});
await page.goto(BASE, { waitUntil: 'networkidle0' });
await wait(2500);
// walls (elevation) tab is default 'design'; wait for lazy models to load + sprites to re-render
await wait(9000);
const svgs = await page.$$('.elevation-svg');
console.log('elevation svgs:', svgs.length);
for (let i = 0; i < svgs.length; i++) {
  await svgs[i].screenshot({ path: `shot-models-wall${i + 1}.png` });
}
// 3D view
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  btns.find((b) => b.textContent.trim() === '3D')?.click();
});
await wait(6000);
const canvas = await page.$('canvas');
if (canvas) await canvas.screenshot({ path: 'shot-models-3d.png' });
await browser.close();
console.log('saved shot-models-wall*.png + shot-models-3d.png');
