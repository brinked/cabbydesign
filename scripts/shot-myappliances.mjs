// Verify the dealer "My appliances & brands" modal renders.
import puppeteer from 'puppeteer-core';
const BASE = 'http://localhost:5173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new', args: ['--window-size=1280,860', '--no-sandbox'],
  defaultViewport: { width: 1280, height: 860 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
const login = async (email, pw) => {
  await page.waitForSelector('.login-field input[type=email]');
  await page.type('.login-field input[type=email]', email);
  await page.type('.login-field input[type=password]', pw);
  await page.click('.login-btn');
  await wait(1200);
};
await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.goto(BASE, { waitUntil: 'networkidle0' });
await login('extcabinets@gmail.com', 'ChangeMe123');
// create a test dealer + seed an own appliance via the API, then log out
await page.evaluate(async () => {
  await fetch('/api/dealers', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'UI Dealer', email: 'ui-dealer@example.com', role: 'dealer', companyName: 'UID', companySlogan: '', address: '', phone: '', active: true, taxExempt: false, contractorMode: 'retail_discount', retailDiscountPct: 0, ownPricing: {}, password: 'ChangeMe123' }) });
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
});
await page.goto(BASE, { waitUntil: 'networkidle0' });
await login('ui-dealer@example.com', 'ChangeMe123');
// seed one own appliance so the table isn't empty
await page.evaluate(async () => {
  await fetch('/api/profile/appliances', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appliances: [{ id: 'mine-ui-1', category: 'grill', brand: 'MyBrand', model: 'MB-42', name: '42in Grill', msrp: 2499, active: true }] }) });
});
await page.reload({ waitUntil: 'networkidle0' });
await wait(1000);
// open Settings dropdown, click My appliances
await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Settings')); if(b) b.click(); });
await wait(400);
await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('My appliances')); if(b) b.click(); });
await wait(800);
await page.screenshot({ path: 'shot-myappliances.png' });
// cleanup: delete the test dealer as admin
await page.evaluate(async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); });
await browser.close();
console.log('saved shot-myappliances.png');
