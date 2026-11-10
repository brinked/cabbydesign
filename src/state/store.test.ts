import { beforeEach, describe, expect, it } from 'vitest';
import type { Design, PlacedItem } from '../model/types';
import { computeQuote } from '../model/quote';
import { anyWallOverfull, DESIGN_SCHEMA_VERSION, DEFAULT_PANEL_RATES, footprintW, itemPrice, normalizeDesign, panelHeight, useStore } from './store';

const store = () => useStore.getState();
const wallId = () => store().design.walls[0].id;

function item(over: Partial<PlacedItem>): PlacedItem {
  return { id: 'i1', wallId: 'w1', catalogId: 'base-2door', x: 0, w: 30, d: 24, h: 34.5, outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0, ...over };
}

function design(over: Partial<Design> = {}): Design {
  return normalizeDesign({
    name: 'Test',
    client: '',
    layout: 'linear',
    kitchenType: 'outdoor',
    line: 'ext',
    finishId: 'indigo',
    doorStyle: 'shaker',
    counterThickness: 1.25,
    counterId: 'x',
    backsplashHeight: 0,
    walls: [{ id: 'w1', name: 'Front', length: 120, height: 96, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
    items: [],
    roughIns: [],
    openings: [],
    ...over,
  } as Design);
}

beforeEach(() => {
  store().newDesign('outdoor', 'ext');
  useStore.setState({ pricing: {}, retailPricing: {}, panelRates: DEFAULT_PANEL_RATES });
});

describe('normalizeDesign', () => {
  it('stamps the schema version', () => {
    expect(design().schemaVersion).toBe(DESIGN_SCHEMA_VERSION);
  });

  it('drops retired catalog ids instead of throwing', () => {
    const d = design({ items: [item({ id: 'a' }), item({ id: 'b', catalogId: 'no-such-cabinet' })] });
    expect(d.items.map((i) => i.id)).toEqual(['a']);
  });

  it('remaps renamed catalog ids', () => {
    const d = design({ items: [item({ catalogId: 'base-doordrawer', w: 18 })] });
    expect(d.items[0].catalogId).toBe('base-1door1drawer');
  });

  it('drops cabinets, rough-ins and openings left on a missing wall', () => {
    const d = design({
      items: [item({ wallId: 'gone' })],
      roughIns: [{ id: 'r', wallId: 'gone', kind: 'gas', x: 10, y: 10, w: 5, h: 5 }],
      openings: [{ id: 'o', wallId: 'gone', kind: 'window', x: 10, y: 36, w: 36, h: 36 }],
    });
    expect(d.items).toHaveLength(0);
    expect(d.roughIns).toHaveLength(0);
    expect(d.openings).toHaveLength(0);
  });

  it('survives missing arrays and rejects non-designs', () => {
    const d = normalizeDesign({ name: 'Bare' } as Design);
    expect(d.walls).toEqual([]);
    expect(d.items).toEqual([]);
    expect(() => normalizeDesign(null as unknown as Design)).toThrow();
    expect(() => normalizeDesign([] as unknown as Design)).toThrow();
  });
});

describe('itemPrice', () => {
  it('prices a box from its formula', () => {
    const d = design({ items: [item({})] });
    expect(itemPrice(d, d.items[0], {})).toMatchObject({ cabinet: 1220, trays: 0, ends: 0, back: 0, total: 1220 });
  });

  it('uses an admin formula override', () => {
    const d = design({ items: [item({})] });
    expect(itemPrice(d, d.items[0], { 'base-2door': 'W*10' }).cabinet).toBe(300);
  });

  it('includes the woodgrain upcharge in the cabinet price', () => {
    useStore.setState({ panelRates: { ...DEFAULT_PANEL_RATES, woodgrainPerCab: 100 } });
    const d = design({ finishId: 'sb-mocha', items: [item({})] });
    const p = itemPrice(d, d.items[0], {});
    expect(p.cabinet).toBe(1320);
    expect(p.total).toBe(1320);
  });

  it('bills applied ends by panel area, less the toe kick', () => {
    const d = design({ items: [item({ endL: true, endsAuto: false })] });
    const it0 = d.items[0];
    expect(panelHeight(d, it0)).toBe(30.5);
    const expected = Math.round(((24 * 30.5) / 144) * DEFAULT_PANEL_RATES.applied * 100) / 100;
    expect(itemPrice(d, it0, {}).ends).toBe(expected);
  });

  it('runs panels to the floor when the wall says so', () => {
    const d = design({ items: [item({})] });
    d.walls[0].panelsToFloor = true;
    expect(panelHeight(d, d.items[0])).toBe(34.5);
  });
});

describe('computeQuote', () => {
  const quote = (d: Design) =>
    computeQuote({
      design: d,
      pricing: {},
      retailPricing: {},
      appliances: [],
      applianceBrands: {},
      handles: [],
      pergolaRates: {},
      panelRates: useStore.getState().panelRates,
      catalogPrefs: null,
      prefs: { marginPct: 0, showPricing: true, priceMode: 'cost', markupMode: 'percent', flatAmount: 0, taxExempt: false, contractorMode: 'retail_discount', retailDiscountPct: 0, ownPricing: {}, hiddenBrands: [] },
      role: 'dealer',
      isConsumer: false,
      taxRate: 0,
    });

  it('totals match the per-item prices (woodgrain and panels included)', () => {
    useStore.setState({ panelRates: { ...DEFAULT_PANEL_RATES, woodgrainPerCab: 100 } });
    const d = design({ finishId: 'sb-mocha', items: [item({ id: 'a', endL: true, endsAuto: false }), item({ id: 'b', x: 40, catalogId: 'base-drawer3', w: 18 })] });
    const sum = d.items.reduce((s, it0) => s + itemPrice(d, it0, {}).total, 0);
    expect(quote(d).grandTotal).toBeCloseTo(sum, 2);
  });

  it('prices end panels with the same height as the editor when panels run to the floor', () => {
    const d = design({ items: [item({ endL: true, endsAuto: false })] });
    d.walls[0].panelsToFloor = true;
    expect(quote(d).endSubtotal).toBeCloseTo(itemPrice(d, d.items[0], {}).ends, 2);
  });

  it('never shows prices to consumers', () => {
    const d = design({ items: [item({})] });
    const q = computeQuote({ design: d, pricing: {}, retailPricing: {}, appliances: [], applianceBrands: {}, handles: [], pergolaRates: {}, panelRates: DEFAULT_PANEL_RATES, catalogPrefs: null, prefs: null, role: undefined, isConsumer: true, taxRate: 0 });
    expect(q.showPricing).toBe(false);
  });
});

describe('placing cabinets', () => {
  it('packs added cabinets side by side without overlap', () => {
    expect(store().addItem(wallId(), 'base-2door')).toBe(true);
    expect(store().addItem(wallId(), 'base-drawer3')).toBe(true);
    const items = [...store().design.items].filter((i) => !i.auto).sort((a, b) => a.x - b.x);
    expect(items).toHaveLength(2);
    expect(items[1].x).toBeGreaterThanOrEqual(items[0].x + footprintW(items[0]) - 0.001);
    const wall = store().design.walls[0];
    expect(items[1].x + footprintW(items[1])).toBeLessThanOrEqual(wall.length + 0.001);
  });

  it('refuses a cabinet that cannot fit', () => {
    store().updateWall(wallId(), { length: 20 });
    expect(store().addItem(wallId(), 'base-2door')).toBe(false);
    expect(store().design.items).toHaveLength(0);
  });
});

describe('history', () => {
  it('opening a design clears undo, so Undo cannot swap designs under a job', async () => {
    store().addItem(wallId(), 'base-2door');
    await new Promise((r) => setTimeout(r, 450)); // let the edit burst commit
    expect(store().undoStack.length).toBeGreaterThan(0);
    const other = design({ name: 'Opened job' });
    store().loadDesign(other);
    await new Promise((r) => setTimeout(r, 450));
    expect(store().undoStack).toHaveLength(0);
    store().undo();
    expect(store().design.name).toBe('Opened job');
  });

  it('a damaged design is rejected without touching the current one', () => {
    store().setDesignMeta({ name: 'Keep me' });
    expect(() => store().loadDesign('nope' as unknown as Design)).toThrow();
    expect(store().design.name).toBe('Keep me');
  });
});

describe('guided start', () => {
  const noOverlap = () => {
    const d = store().design;
    for (const w of d.walls) {
      const run = d.items.filter((i) => i.wallId === w.id).sort((a, b) => a.x - b.x);
      for (let i = 1; i < run.length; i++) expect(run[i].x).toBeGreaterThanOrEqual(run[i - 1].x + footprintW(run[i - 1]) - 0.01);
      for (const it0 of run) expect(it0.x + footprintW(it0)).toBeLessThanOrEqual(w.length + 0.01);
    }
  };

  it.each([
    ['ext', 'outdoor', 'out-grill'],
    ['ext', 'indoor', 'base-cooktop'],
    ['newage', 'outdoor', 'na-grill36'],
    ['challenger', 'outdoor', 'ch-grill'],
  ] as const)('lays out a %s %s starter that fits its wall', (line, kitchenType, cooking) => {
    store().startDesign({ kitchenType, line, shape: 'straight', lengths: [168], starter: true });
    const d = store().design;
    expect(d.line).toBe(line);
    expect(d.walls).toHaveLength(1);
    expect(d.walls[0].length).toBe(168);
    expect(d.items.some((i) => i.catalogId === cooking)).toBe(true);
    expect(d.items.filter((i) => !i.auto).length).toBeGreaterThanOrEqual(4);
    noOverlap();
    expect(store().undoStack).toHaveLength(0);
  });

  it('builds joined L and U shapes and a freestanding island', () => {
    store().startDesign({ kitchenType: 'outdoor', line: 'ext', shape: 'u', lengths: [96, 144, 96], starter: true });
    expect(store().design.walls.map((w) => w.length)).toEqual([96, 144, 96]);
    expect(store().design.layout).toBe('u');
    // the cooking run goes on the back wall; one grill only
    for (const w of store().design.walls) expect(store().design.items.some((i) => i.wallId === w.id && !i.auto), w.name).toBe(true);
    const grills = store().design.items.filter((i) => i.catalogId === 'out-grill');
    expect(grills).toHaveLength(1);
    expect(grills[0].wallId).toBe(store().design.walls[1].id);
    noOverlap();

    store().startDesign({ kitchenType: 'outdoor', line: 'challenger', shape: 'island', lengths: [120], starter: false });
    expect(store().design.walls[0].ghost).toBe(true);
    expect(store().design.items).toHaveLength(0);
  });

  it.each(['ext', 'newage', 'challenger'] as const)('never overfills an L or U kitchen (%s)', (line) => {
    for (const [shape, lengths] of [['l', [144, 96]], ['l', [84, 60]], ['u', [96, 144, 96]], ['u', [60, 72, 60]]] as const) {
      store().startDesign({ kitchenType: 'outdoor', line, shape, lengths: [...lengths], starter: true });
      expect(anyWallOverfull(store().design), `${line} ${shape} ${lengths}`).toBe(false);
      // filling again on every wall must not break a wall that is already full
      for (const w of store().design.walls) store().fillWall(w.id);
      expect(anyWallOverfull(store().design), `${line} ${shape} ${lengths} refill`).toBe(false);
    }
  });

  it('clamps silly sizes and fills only free space on demand', () => {
    store().startDesign({ kitchenType: 'outdoor', line: 'newage', shape: 'straight', lengths: [5], starter: false });
    expect(store().design.walls[0].length).toBe(36);
    store().startDesign({ kitchenType: 'outdoor', line: 'newage', shape: 'straight', lengths: [200], starter: false });
    const wall = store().design.walls[0].id;
    const first = store().fillWall(wall);
    expect(first).toBeGreaterThan(0);
    expect(store().fillWall(wall)).toBe(0); // already full
    noOverlap();
  });
});
