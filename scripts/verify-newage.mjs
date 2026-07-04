// End-to-end verification of the NewAge product-line + consumer conversion.
// Drives the real UI at localhost:5173 with puppeteer-core + Edge.
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.dirname(fileURLToPath(import.meta.url));
const shot = (name) => path.join(outDir, name);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--window-size=1500,950', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  defaultViewport: { width: 1500, height: 950 },
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

const log = (...a) => console.log('•', ...a);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 30000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
await sleep(500);

// ---- 1. Login screen shows consumer guest entry ----
const loginText = await page.evaluate(() => document.body.innerText);
log('login shows guest CTA:', loginText.includes('Start designing — no account needed'));
await page.screenshot({ path: shot('v1-login.png') });

// ---- 2. Continue as guest ----
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Start designing'))?.click();
});
await sleep(1200);
const appVisible = await page.evaluate(() => !!document.querySelector('.toolbar'));
log('guest entered app (toolbar visible):', appVisible);
const userLabel = await page.evaluate(() => document.querySelector('.user-name')?.textContent);
log('user label:', userLabel);
const hasJobsTab = await page.evaluate(() => [...document.querySelectorAll('.screen-nav .tab')].map((t) => t.textContent.trim()).join(','));
log('nav tabs:', hasJobsTab);

// ---- 3. New design → Outdoor + NewAge Stainless ----
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'New')?.click();
});
await sleep(400);
await page.screenshot({ path: shot('v2-newdesign.png') });
const modalText = await page.evaluate(() => document.querySelector('.modal')?.innerText ?? 'NO MODAL');
log('new-design modal shows lines:', modalText.includes('NewAge — 304 Stainless Steel') && modalText.includes('NewAge — Aluminum'));
await page.evaluate(() => {
  [...document.querySelectorAll('.cat-card')].find((c) => c.textContent.includes('304 Stainless Steel'))?.click();
});
await sleep(200);
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Start designing')?.click();
});
await sleep(600);

// ---- 4. Add NewAge units from the catalog ----
async function openAdd() {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('+ Add cabinet') || b.textContent.trim() === '+ Add' || b.className.includes('btn-dark'));
    btn?.click();
  });
  await sleep(400);
}
await openAdd();
const catText = await page.evaluate(() => document.querySelector('.modal')?.innerText ?? 'NO MODAL');
log('catalog tabs (NA):', await page.evaluate(() => [...document.querySelectorAll('.cat-tab')].map((t) => t.textContent).join(' | ')));
log('catalog shows fixed sizes + prices:', catText.includes('set size') && catText.includes('$'));
log('catalog has 32″ 2-Door:', catText.includes('32″ 2-Door Cabinet'));
await page.screenshot({ path: shot('v3-catalog-ss.png') });

// add 2-door cabinet
await page.evaluate(() => {
  [...document.querySelectorAll('.cat-card')].find((c) => c.textContent.includes('32″ 2-Door Cabinet'))?.click();
});
await sleep(400);
// add grill cabinet (36")
await openAdd();
await page.evaluate(() => {
  [...document.querySelectorAll('.cat-tab')].find((t) => t.textContent.includes('Grill'))?.click();
});
await sleep(300);
await page.screenshot({ path: shot('v4-catalog-grill.png') });
await page.evaluate(() => {
  [...document.querySelectorAll('.cat-card')].find((c) => c.textContent.includes('36″ Gas Grill Cabinet'))?.click();
});
await sleep(400);
// add 3-drawer
await openAdd();
await page.evaluate(() => {
  [...document.querySelectorAll('.cat-card')].find((c) => c.textContent.includes('32″ 3-Drawer Cabinet'))?.click();
});
await sleep(400);
const itemCount = await page.evaluate(() => JSON.parse(localStorage.getItem('cabdesign-v1')).state.design.items.length);
log('items placed:', itemCount);
await page.screenshot({ path: shot('v5-walls-ss.png') });

// ---- 5. Edit modal: fixed size, SKU price ----
await page.evaluate(() => {
  // open editor for first placed item by double-clicking its rect in elevation
  const g = document.querySelector('.wall-card svg g[data-item], .wall-card svg g');
  g?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
});
await sleep(500);
let editText = await page.evaluate(() => document.querySelector('.modal')?.innerText ?? 'NO MODAL');
if (editText === 'NO MODAL') {
  // fallback: click item then press pencil/edit — try single click then check selected editor
  await page.evaluate(() => {
    const rects = [...document.querySelectorAll('.wall-card svg rect')];
    rects[2]?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  });
  await sleep(500);
  editText = await page.evaluate(() => document.querySelector('.modal')?.innerText ?? 'NO MODAL');
}
log('edit modal fixed-size text:', editText.includes('set by the manufacturer'));
log('edit modal SKU line:', /SKU \d+/.test(editText));
await page.screenshot({ path: shot('v6-edit-fixed.png') });
await page.evaluate(() => { [...document.querySelectorAll('.modal button')].find((b) => b.textContent.trim() === 'Save')?.click(); });
await sleep(300);

// ---- 6. Finish picker shows NA door/finish groups; switch to Matte Black ----
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Settings'))?.click(); });
await sleep(400);
const menuText = await page.evaluate(() => document.querySelector('.settings-menu')?.innerText ?? 'NO MENU');
log('settings shows line label:', menuText.includes('NewAge — 304 Stainless Steel'));
log('settings hides door style for NA:', !menuText.includes('Shaker'));
const finishOpts = await page.evaluate(() => {
  const sel = [...document.querySelectorAll('.settings-menu select')].find((s) => [...s.options].some((o) => o.value.startsWith('na-')));
  return sel ? [...sel.options].map((o) => `${o.closest('optgroup')?.label ?? ''}:${o.textContent}`).join(' | ') : 'NO SELECT';
});
log('finish options:', finishOpts);
await page.screenshot({ path: shot('v7-settings.png') });
await page.evaluate(() => {
  const sel = [...document.querySelectorAll('.settings-menu select')].find((s) => [...s.options].some((o) => o.value.startsWith('na-')));
  if (sel) { sel.value = 'na-ss-black'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
});
await sleep(400);
await page.keyboard.press('Escape');
await sleep(300);

// ---- 7. 3D view with metal materials ----
await page.evaluate(() => { [...document.querySelectorAll('.tab')].find((t) => t.textContent.trim() === '3D')?.click(); });
await sleep(3000);
await page.screenshot({ path: shot('v8-3d-black.png') });
log('3D rendered');

// ---- 8. Report: SKUs, prices, countertop estimate, totals ----
await page.evaluate(() => { [...document.querySelectorAll('.tab')].find((t) => t.textContent.trim() === 'Report')?.click(); });
await sleep(1200);
const reportText = await page.evaluate(() => document.body.innerText);
log('report SKU lines:', /SKU \d{5}/.test(reportText));
log('report line label:', reportText.includes('NewAge — 304 Stainless Steel'));
log('report counter estimate:', reportText.includes('stainless steel countertops (estimate'));
log('report hides submit-order for guest:', !reportText.includes('Submit order for review'));
log('report grand total present:', /Total/.test(reportText));
await page.screenshot({ path: shot('v9-report.png'), fullPage: false });

// ---- 9. Probe: New design → Indoor (EXT only, no outdoor tab) ----
await page.evaluate(() => { [...document.querySelectorAll('.tab')].find((t) => t.textContent.trim() === 'Walls')?.click(); });
await sleep(300);
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'New')?.click(); });
await sleep(300);
await page.evaluate(() => { [...document.querySelectorAll('.seg-btn')].find((b) => b.textContent.trim() === 'Indoor')?.click(); });
await sleep(200);
const indoorModal = await page.evaluate(() => document.querySelector('.modal')?.innerText ?? '');
log('indoor hides NewAge lines:', !indoorModal.includes('NewAge'));
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Start designing')?.click(); });
await sleep(500);
await openAdd();
const indoorTabs = await page.evaluate(() => [...document.querySelectorAll('.cat-tab')].map((t) => t.textContent).join(' | '));
log('indoor catalog tabs (no Outdoor):', indoorTabs);
await page.screenshot({ path: shot('v10-indoor-catalog.png') });
await page.evaluate(() => { document.querySelector('.modal-head .btn-ghost')?.click(); });
await sleep(200);

// ---- 10. Probe: Aluminum line — slate default, 90° corner slate-only ----
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'New')?.click(); });
await sleep(300);
await page.evaluate(() => { [...document.querySelectorAll('.cat-card')].find((c) => c.textContent.includes('Aluminum'))?.click(); });
await sleep(200);
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Start designing')?.click(); });
await sleep(500);
await openAdd();
await page.evaluate(() => { [...document.querySelectorAll('.cat-tab')].find((t) => t.textContent.includes('Grill'))?.click(); });
await sleep(300);
const aluText = await page.evaluate(() => document.querySelector('.modal')?.innerText ?? '');
log('ALU grill 33 price $659.99:', aluText.includes('659.99'));
log('ALU 90° corner present:', aluText.includes('90° Corner'));
await page.screenshot({ path: shot('v11-catalog-alu.png') });
// add the alu grill + check finish switch to Black changes price to 749.99
await page.evaluate(() => { [...document.querySelectorAll('.cat-card')].find((c) => c.textContent.includes('33″ Gas Grill Cabinet'))?.click(); });
await sleep(400);
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Settings'))?.click(); });
await sleep(300);
await page.evaluate(() => {
  const sel = [...document.querySelectorAll('.settings-menu select')].find((s) => [...s.options].some((o) => o.value.startsWith('na-')));
  if (sel) { sel.value = 'na-alu-black'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
});
await sleep(300);
await page.keyboard.press('Escape');
await sleep(200);
await page.evaluate(() => { [...document.querySelectorAll('.tab')].find((t) => t.textContent.trim() === 'Report')?.click(); });
await sleep(800);
const aluReport = await page.evaluate(() => document.body.innerText);
log('ALU black grill priced 749.99 in report:', aluReport.includes('749.99'));
await page.screenshot({ path: shot('v12-report-alu-black.png') });

console.log('\nconsole errors:', errors.length ? errors.slice(0, 8) : 'none');
await browser.close();
