// Seed a guest design with plumbing/electrical/gas rough-ins, open the Report
// tab, and screenshot the new Rough-In Schedule page.
import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:5173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new', args: ['--window-size=1300,1400', '--no-sandbox'],
  defaultViewport: { width: 1300, height: 1400 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.evaluate(() => {
  const wallId = 'w1';
  const it = (id, catalogId, x, w) => ({ id, wallId, catalogId, x, w, d: 24, h: 34.5, outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0 });
  const design = {
    name: 'Rough-In Test', client: 'Sam', layout: 'linear', finishId: 'sage', doorStyle: 'shaker',
    kitchenType: 'indoor', line: 'ext', counterThickness: 1.25, counterId: 'classic-white', backsplashHeight: 0,
    walls: [{ id: wallId, name: 'Sink Wall', length: 90, height: 42, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
    items: [it('a', 'base-2door', 6, 36), it('b', 'base-drawer3', 42, 18)],
    roughIns: [
      { id: 'p1', wallId, kind: 'plumbing', x: 24, y: 14, w: 10, h: 8 },
      { id: 'e1', wallId, kind: 'electrical', x: 51, y: 44, w: 4.5, h: 4.5 },
      { id: 'g1', wallId, kind: 'gas', x: 70, y: 12, w: 5, h: 5 },
    ],
    openings: [],
  };
  localStorage.setItem('cabdesign-guest', '1');
  localStorage.setItem('cabdesign-v1', JSON.stringify({ state: { design, pricing: {}, dims: {} }, version: 4 }));
});
await page.goto(BASE, { waitUntil: 'networkidle0' });
await wait(1200);
// switch to the Report tab
await page.evaluate(() => [...document.querySelectorAll('.tabs:not(.screen-nav) .tab')].find((b) => b.textContent.trim() === 'Report')?.click());
await wait(1000);

const heads = await page.$$eval('.report .report-page h2', (hs) => hs.map((h) => h.textContent.trim()));
console.log('report pages:', heads.join(' | '));
const roughRows = await page.$$eval('.report .report-page', (secs) => {
  const sec = secs.find((s) => (s.querySelector('h2')?.textContent || '').includes('Rough-In'));
  if (!sec) return null;
  return {
    diagrams: sec.querySelectorAll('.report-figure svg').length,
    rows: [...sec.querySelectorAll('table.schedule tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())),
  };
});
console.log('rough-in section:', JSON.stringify(roughRows, null, 2));

// scroll the rough-in page into view and screenshot the whole report region
const sec = await page.evaluateHandle(() => [...document.querySelectorAll('.report .report-page')].find((s) => (s.querySelector('h2')?.textContent || '').includes('Rough-In')));
if (sec) {
  await sec.asElement()?.scrollIntoView();
  await wait(300);
  await sec.asElement()?.screenshot({ path: 'shot-roughin-report.png' });
  console.log('saved shot-roughin-report.png');
}
await browser.close();
