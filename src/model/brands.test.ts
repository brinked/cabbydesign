import { describe, expect, it } from 'vitest';
import type { Design, PlacedItem } from './types';
import { BRAND_LIST, BRANDS, brandForSavedLine, brandOf, closestFinish, skuVariantFor, unitFinishes } from './brands';
import { CATALOG, catalogById, catalogForDesign, categoryLabelsForLine, finishesForLine, handleCount, takesAppliedEnds } from './catalog';
import { counterHeightFor, itemPrice, lineDefaults, normalizeDesign } from '../state/store';

function naItem(over: Partial<PlacedItem>): PlacedItem {
  const cat = catalogById(over.catalogId ?? 'na-2door');
  return { id: 'i1', wallId: 'w1', catalogId: cat.id, x: 0, w: cat.w, d: cat.d, h: cat.h, outset: 0, mount: cat.mount ?? 0, hinge: 'left', endL: false, endR: false, trays: 0, ...over };
}

function design(over: Partial<Design>): Design {
  return normalizeDesign({
    name: 'T',
    client: '',
    layout: 'linear',
    walls: [{ id: 'w1', name: 'Front', length: 160, height: 96, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
    items: [],
    roughIns: [],
    openings: [],
    ...over,
  } as Design);
}

describe('brand registry', () => {
  it('has a record for every catalog line, and every branded item belongs to its brand', () => {
    for (const c of CATALOG) {
      if (!c.line) continue;
      expect(BRANDS[c.line], `brand for ${c.id}`).toBeTruthy();
      expect(BRANDS[c.line].catalog).toContain(c);
    }
  });

  it('every modular unit is priced in at least one of its brand finishes', () => {
    for (const b of BRAND_LIST) {
      const ids = new Set(b.finishes.map((f) => f.id));
      for (const c of b.catalog) {
        if (!c.skuPricing) continue;
        const priced = Object.keys(c.skuPricing);
        expect(priced.length, c.id).toBeGreaterThan(0);
        for (const fid of priced) expect(ids.has(fid), `${c.id} → ${fid}`).toBe(true);
        expect(unitFinishes(c).length, c.id).toBe(priced.length);
      }
    }
  });

  it('brand defaults point at real finishes', () => {
    for (const b of BRAND_LIST) {
      const d = lineDefaults(b.id, 'outdoor');
      expect(finishesForLine(b.id, 'outdoor').some((f) => f.id === d.finishId), b.id).toBe(true);
    }
  });

  it('unknown or missing lines fall back to EXT', () => {
    expect(brandOf(undefined).id).toBe('ext');
    expect(brandOf('nope').id).toBe('ext');
    expect(brandForSavedLine('nope')).toBeNull();
  });
});

describe('NewAge behaves as before', () => {
  it('offers only its own catalog, tabs and finishes', () => {
    const cats = catalogForDesign('newage', 'outdoor');
    expect(cats.length).toBeGreaterThanOrEqual(20);
    expect(cats.every((c) => c.line === 'newage')).toBe(true);
    expect(categoryLabelsForLine('newage')).toEqual({ base: 'Cabinets', outdoor: 'Grill, Corner & Specialty', wall: 'Wall Cabinets' });
    expect(finishesForLine('newage').map((f) => f.id)).toContain('na-ss-steel');
    expect(lineDefaults('newage')).toEqual({ finishId: 'na-ss-steel', counterId: 'na-stainless', doorStyle: 'flat' });
  });

  it('prices by SKU for the chosen finish, with no panels or handles', () => {
    const d = design({ line: 'newage', finishId: 'na-ss-steel', items: [naItem({})] });
    const cat = catalogById('na-2door');
    expect(itemPrice(d, d.items[0], {}).total).toBe(999.99);
    expect(skuVariantFor(cat, 'na-ss-steel')?.sku).toBe('70001');
    expect(handleCount(cat, cat.w)).toBe(0);
    expect(takesAppliedEnds(cat)).toBe(false);
  });

  it('substitutes the closest finish a unit is made in', () => {
    const cat = catalogById('na-1door16'); // not made in Louvered White
    expect(cat.skuPricing!['na-ss-white']).toBeUndefined();
    expect(closestFinish(cat, 'na-ss-white')).toBe('na-ss-grove');
  });

  it('recognises saved lines, legacy ids and line-less saves', () => {
    expect(design({ line: 'newage', finishId: 'na-ss-black' }).line).toBe('newage');
    expect(design({ line: 'newage-alu' as never }).line).toBe('newage');
    expect(design({ items: [naItem({})] }).line).toBe('newage');
    expect(design({}).line).toBe('ext');
  });

  it('runs the counter over a fridge bracket at the NewAge base height', () => {
    const d = design({ line: 'newage', finishId: 'na-ss-steel', items: [naItem({ catalogId: 'na-fridge24' })] });
    expect(counterHeightFor(d.items[0])).toBe(34.25);
  });

  it('EXT fridge openings still sit under a 34.5″ counter', () => {
    const d = design({ items: [naItem({ catalogId: 'out-fridge', h: 32 })] });
    expect(counterHeightFor(d.items[0])).toBe(34.5);
  });
});
