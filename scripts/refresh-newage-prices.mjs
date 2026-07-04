// Sync src/model/newage.ts pricing with newageproducts.com's LIVE prices.
//
// Pulls the current stainless + aluminum collection listings from NewAge's
// storefront API, builds a SKU → {price, msrp} map from the live variant
// data, and rewrites every `v('SKU', price, msrp)` call (and countertop
// `sku/price/msrp` rows) in src/model/newage.ts. SKUs no longer on the site
// are reported so discontinued units can be removed by hand.
//
// Usage: node scripts/refresh-newage-prices.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const COLLECTIONS = [
  { id: '0ZGOG00000005yz4AA', name: 'outdoor-kitchen-stainless-steel' },
  { id: '0ZGOG00000004rd4AA', name: 'outdoor-kitchen-aluminum' },
];
const UA = { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' };

const tokenRes = await fetch('https://newageproducts.com/api/sfcc/getToken/', { method: 'POST', headers: UA });
const { token } = await tokenRes.json();
if (!token) throw new Error('could not get storefront token');

const params = Buffer.from(
  JSON.stringify([
    { nameOrId: 'hidden_from_store__c', type: 'DistinctValue', attributeType: 'Custom', values: ['false'] },
    { nameOrId: 'store__c', type: 'DistinctValue', attributeType: 'Custom', values: ['US'] },
  ])
).toString('base64');

/** live SKU → { price, msrp } */
const live = new Map();
for (const coll of COLLECTIONS) {
  for (let page = 0; page < 15; page++) {
    const res = await fetch('https://newageproducts.com/api/sfcc/get-category-products/', {
      method: 'POST',
      headers: { ...UA, Cookie: `token=${token}` },
      body: JSON.stringify({ categoryId: coll.id, page, store: 'US', q: '', params, sort: '' }),
    });
    const data = await res.json();
    const products = data?.productsPage?.products ?? [];
    for (const p of products) {
      const raw = p.fields?.variant_data__c?.value;
      if (!raw) continue;
      try {
        const vd = JSON.parse(raw.replaceAll('&quot;', '"'));
        for (const v of vd.variants ?? []) {
          if (!v.sku || !v.isSKUActive) continue;
          const price = Number(v.main_price);
          const msrp = Number(v.compare_price) || price;
          if (price > 0) live.set(String(v.sku), { price, msrp: Math.max(price, msrp) });
        }
      } catch {
        /* skip malformed variant data */
      }
    }
    if (products.length < 24) break;
  }
  console.log(`${coll.name}: ${live.size} SKUs collected so far`);
}
if (live.size < 40) throw new Error(`only ${live.size} live SKUs — refusing to rewrite (API change?)`);

const FILE = new URL('../src/model/newage.ts', import.meta.url);
let src = readFileSync(FILE, 'utf8');
let changed = 0;
const missing = new Set();

// v('SKU', price, msrp) entries
src = src.replace(/v\('(\d+)',\s*([\d.]+),\s*([\d.]+)\)/g, (m, sku, oldP, oldM) => {
  const l = live.get(sku);
  if (!l) {
    missing.add(sku);
    return m;
  }
  if (Number(oldP) !== l.price || Number(oldM) !== l.msrp) changed++;
  return `v('${sku}', ${l.price}, ${l.msrp})`;
});

// countertop rows: sku: 'NNNNN', price: X, msrp: Y
src = src.replace(/sku: '(\d+)', price: ([\d.]+), msrp: ([\d.]+)/g, (m, sku, oldP, oldM) => {
  const l = live.get(sku);
  if (!l) {
    missing.add(sku);
    return m;
  }
  if (Number(oldP) !== l.price || Number(oldM) !== l.msrp) changed++;
  return `sku: '${sku}', price: ${l.price}, msrp: ${l.msrp}`;
});

writeFileSync(FILE, src);
console.log(`updated ${changed} SKU price(s) in src/model/newage.ts`);
if (missing.size) {
  console.log(`⚠ ${missing.size} SKU(s) in the catalog were NOT found live (possibly discontinued or set-only):`);
  console.log('  ' + [...missing].join(', '));
}
