// Screenshot helper for visual verification during development.
// Usage: node scripts/shot.mjs [walls|plan|3d] [out.png]
import puppeteer from 'puppeteer-core';

const tab = process.argv[2] ?? 'walls';
const out = process.argv[3] ?? `shot-${tab}.png`;

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--window-size=1500,950', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  defaultViewport: { width: 1500, height: 950 },
});
const page = await browser.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console.error]', m.text());
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5180/', { waitUntil: 'networkidle0', timeout: 30000 });

// seed a demo design so views have content
await page.evaluate(() => localStorage.removeItem('cabdesign-v1'));
await page.reload({ waitUntil: 'networkidle0' });
await page.evaluate(() => {
  // add a few cabinets via the store exposed on window in dev? Not exposed — use UI clicks instead.
});

// add cabinets through the UI: open Add modal on first wall, click some cards
async function addFromCatalog(catTab, cardIndex) {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.btn-dark')];
    btns[0]?.click();
  });
  await new Promise((r) => setTimeout(r, 250));
  if (catTab) {
    await page.evaluate((t) => {
      const tabs = [...document.querySelectorAll('.cat-tab')];
      tabs.find((b) => b.textContent.includes(t))?.click();
    }, catTab);
    await new Promise((r) => setTimeout(r, 350));
  }
  await page.evaluate((i) => {
    const cards = [...document.querySelectorAll('.cat-card')];
    cards[i]?.click();
  }, cardIndex);
  await new Promise((r) => setTimeout(r, 250));
  // close modal if still open
  await page.evaluate(() => {
    document.querySelector('.modal-head .btn-ghost')?.click();
  });
  await new Promise((r) => setTimeout(r, 150));
}

// match the user's library renders: navy finish
await page.select('.select', 'navy');
await new Promise((r) => setTimeout(r, 300));

if (tab === 'catalog') {
  await page.evaluate(() => [...document.querySelectorAll('.btn-dark')][0]?.click());
  await new Promise((r) => setTimeout(r, 800));
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.cat-tab')];
    tabs.find((b) => b.textContent.includes('Outdoor'))?.click();
  });
  await new Promise((r) => setTimeout(r, 3500));
  await page.screenshot({ path: out });
  await browser.close();
  console.log('saved', out);
  process.exit(0);
}

await addFromCatalog(null, 1); // 2-door base
await addFromCatalog('Outdoor', 0); // grill cabinet
await addFromCatalog(null, 2); // 3-drawer base

if (tab !== 'walls') {
  await page.evaluate((t) => {
    const tabs = [...document.querySelectorAll('.tab')];
    const label = t === 'plan' ? 'Top View' : t.startsWith('3d') ? '3D' : 'Walls';
    tabs.find((b) => b.textContent.trim() === label)?.click();
  }, tab);
  await new Promise((r) => setTimeout(r, tab.startsWith('3d') ? 2500 : 600));
}

if (tab === 'plan-sel') {
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.tab')];
    tabs.find((b) => b.textContent.trim() === 'Top View')?.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  await page.evaluate(() => {
    const rect = document.querySelector('.plan-card svg g rect');
    rect?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 600));
}

if (tab === '3d-photo') {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    btns.find((b) => b.textContent.includes('Photo render'))?.click();
  });
  await new Promise((r) => setTimeout(r, 25000));
}

await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
