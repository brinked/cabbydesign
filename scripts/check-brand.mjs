// Visual check of one brand's kitchen: seeds a guest design made of the given
// catalog ids, then screenshots the Walls, Top View, 3D and Report tabs.
//
//   node scripts/check-brand.mjs <line> <finishId> <catalogId,catalogId,...> [baseUrl]
//   node scripts/check-brand.mjs newage na-ss-steel na-2door,na-sink,na-grill36,na-3drawer,na-fridge24
//
// Needs the web app running (npm run dev:web) and Edge or Chrome installed
// (override the path with BROWSER_PATH). Screenshots land in scripts/ as
// shot-<line>-*.png (gitignored). Exits 1 on any page error.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [line = 'newage', finishId = 'na-ss-steel', idList = 'na-2door,na-sink,na-grill36,na-3drawer,na-fridge24', base = 'http://localhost:5173'] = process.argv.slice(2);
const ids = idList.split(',').filter(Boolean);
const outDir = path.dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const candidates = [
  process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const executablePath = candidates.find((p) => fs.existsSync(p));
if (!executablePath) {
  console.error('No browser found — set BROWSER_PATH.');
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath,
  // own profile dir: otherwise an already-open Edge swallows the launch
  userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'cabby-check-')),
  headless: 'new',
  args: ['--window-size=1500,950', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  defaultViewport: { width: 1500, height: 950 },
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => {
  // the API server may not be running — failed /api fetches are expected
  if (m.type() === 'error' && !/Failed to load resource|\/api\//.test(m.text())) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

// Seed a guest session with an empty design of this line, then add the
// cabinets through the real store so packing/validation runs as in the app.
// (Seeded before the app's own scripts run: the app autosaves on page hide, so
// seeding a live page and reloading would be overwritten.)
await page.evaluateOnNewDocument(
  (line, finishId) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.clear();
    localStorage.setItem('cabdesign-guest', '1');
    const design = {
      name: `${line} check`,
      client: '',
      layout: 'linear',
      kitchenType: 'outdoor',
      line,
      finishId,
      walls: [{ id: 'w1', name: 'Front Wall', length: 220, height: 96, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
      items: [],
      roughIns: [],
      openings: [],
    };
    localStorage.setItem('cabbydesign-v1', JSON.stringify({ state: { design, pricing: {}, dims: {} }, version: 4 }));
  },
  line,
  finishId
);
await page.goto(base, { waitUntil: 'networkidle0', timeout: 30000 });
await sleep(800);

const placed = [];
const closeModals = async () => {
  for (let n = 0; n < 3; n++) {
    const open = await page.evaluate(() => {
      const b = document.querySelector('.modal-backdrop');
      if (!b) return false;
      b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    });
    if (!open) break;
    await sleep(150);
  }
};
const clickCard = (id) =>
  page.evaluate((id) => {
    const card = document.querySelector(`.cat-card[data-catalog-id="${id}"]`);
    card?.click();
    return !!card;
  }, id);
for (const id of ids) {
  await closeModals();
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Add Cabinet/i.test(b.textContent))?.click());
  await sleep(350);
  let ok = await clickCard(id);
  const tabCount = await page.evaluate(() => document.querySelectorAll('.cat-tabs .cat-tab').length);
  for (let t = 0; !ok && t < tabCount; t++) {
    await page.evaluate((t) => document.querySelectorAll('.cat-tabs .cat-tab')[t]?.click(), t);
    await sleep(200);
    ok = await clickCard(id);
  }
  placed.push(`${id}:${ok ? 'ok' : 'NOT FOUND'}`);
  await sleep(350);
}
await closeModals();
console.log('placed:', placed.join('  '));

const shot = async (name) => {
  await sleep(1800);
  const file = path.join(outDir, `shot-${line}-${name}.png`);
  await page.screenshot({ path: file });
  console.log('saved', file);
};
const tab = (label) => page.evaluate((label) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label)?.click(), label);

await shot('walls');
await tab('Top View');
await shot('plan');
await tab('3D');
await sleep(2500);
await shot('3d');
await tab('Report');
await shot('report');

await browser.close();
if (errors.length) {
  console.error('PAGE ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('no page errors');
