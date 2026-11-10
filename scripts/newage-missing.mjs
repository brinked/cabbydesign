// Reverse of refresh-newage-prices.mjs: lists every LIVE NewAge outdoor-kitchen
// SKU that is NOT in src/model/newage.ts, so missing cabinets can be added.
// Read-only — prints a report and (with --json <file>) saves the raw rows.
//
// Usage: node scripts/newage-missing.mjs [--json out.json] [--all]
import { readFileSync, writeFileSync } from 'node:fs';

const COLLECTIONS = [
  { id: '0ZGOG00000005yz4AA', name: 'outdoor-kitchen-stainless-steel' },
  { id: '0ZGOG00000004rd4AA', name: 'outdoor-kitchen-aluminum' },
];
const UA = { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' };
const args = process.argv.slice(2);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const showAll = args.includes('--all');

const tokenRes = await fetch('https://newageproducts.com/api/sfcc/getToken/', { method: 'POST', headers: UA });
const { token } = await tokenRes.json();
if (!token) throw new Error('could not get storefront token');

const params = Buffer.from(
  JSON.stringify([
    { nameOrId: 'hidden_from_store__c', type: 'DistinctValue', attributeType: 'Custom', values: ['false'] },
    { nameOrId: 'store__c', type: 'DistinctValue', attributeType: 'Custom', values: ['US'] },
  ])
).toString('base64');

const known = new Set([...readFileSync(new URL('../src/model/newage.ts', import.meta.url), 'utf8').matchAll(/'(\d{5})'/g)].map((m) => m[1]));

/** sku → row */
const rows = new Map();
let sampleShown = false;
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
      if (!sampleShown && args.includes('--sample')) {
        sampleShown = true;
        console.log('SAMPLE PRODUCT KEYS:', Object.keys(p), '\nFIELDS:', Object.keys(p.fields ?? {}));
      }
      const raw = p.fields?.variant_data__c?.value;
      if (!raw) continue;
      let vd;
      try {
        vd = JSON.parse(raw.replaceAll('&quot;', '"'));
      } catch {
        continue;
      }
      for (const v of vd.variants ?? []) {
        if (!v.sku || !v.isSKUActive) continue;
        const price = Number(v.main_price);
        if (!(price > 0)) continue;
        const { sku, main_price, compare_price, isSKUActive, ...rest } = v;
        rows.set(String(sku), {
          sku: String(sku),
          product: p.name ?? p.fields?.Name?.value ?? '',
          collection: coll.name,
          price,
          msrp: Math.max(price, Number(compare_price) || price),
          variant: rest,
          dims: {
            w: p.fields?.Width__c?.value ?? p.fields?.width__c?.value,
            d: p.fields?.Depth__c?.value ?? p.fields?.depth__c?.value,
            h: p.fields?.Height__c?.value ?? p.fields?.height__c?.value,
          },
        });
      }
    }
    if (products.length < 24) break;
  }
}

const list = [...rows.values()].filter((r) => showAll || !known.has(r.sku));
const byProduct = new Map();
for (const r of list) byProduct.set(r.product, [...(byProduct.get(r.product) ?? []), r]);
console.log(`${rows.size} live SKUs, ${known.size} SKU-like ids in newage.ts, ${list.length} live SKUs not in the catalog:\n`);
for (const [name, rs] of [...byProduct.entries()].sort()) {
  console.log(name);
  for (const r of rs) console.log(`   ${r.sku}  $${r.price} (msrp $${r.msrp})  ${JSON.stringify(r.variant)}`);
}
if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify(list, null, 2));
  console.log(`\nwrote ${jsonOut}`);
}
