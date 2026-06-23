// Render plumbing/electrical/gas rough-ins behind a cabinet to verify glyphs.
import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:5173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new', args: ['--window-size=1400,800', '--no-sandbox'],
  defaultViewport: { width: 1400, height: 800 },
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
  const design = { name: 'RoughIns', client: '', layout: 'linear', finishId: 'sage', doorStyle: 'shaker',
    counterThickness: 1.25, counterId: 'classic-white', backsplashHeight: 0,
    walls: [{ id: wallId, name: 'Front Wall', length: 60, height: 42, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
    items: [{ id: 'b1', wallId, catalogId: 'base-2door', x: 4, w: 42, d: 24, h: 34.5, outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0 }],
    roughIns: [
      { id: 'p1', wallId, kind: 'plumbing',   x: 14, y: 12, w: 10,  h: 8 },
      { id: 'e1', wallId, kind: 'electrical', x: 26, y: 24, w: 4.5, h: 4.5 },
      { id: 'g1', wallId, kind: 'gas',        x: 37, y: 14, w: 5,   h: 5 },
    ] };
  localStorage.setItem('cabdesign-v1', JSON.stringify({ state: { design, pricing: {}, dims: {} }, version: 2 }));
});
await page.goto(BASE, { waitUntil: 'networkidle0' });
await wait(1500);
// open the rough-in dropdown to capture it too
await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Rough-in')); if(b) b.click(); });
await wait(400);
await page.screenshot({ path: 'shot-roughins.png' });
await browser.close();
console.log('saved shot-roughins.png');
