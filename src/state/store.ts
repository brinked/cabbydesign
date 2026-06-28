import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ApplianceBrands, ApplianceItem, Design, DimOverride, HandleItem, LayoutKind, Opening, OpeningKind, PlacedItem, RoughIn, RoughInKind, Wall } from '../model/types';
import { CATALOG, COUNTER_OVERHANG, COUNTER_T, DEFAULT_RATES, TOEKICK_H, catalogById, takesAppliedEnds } from '../model/catalog';
import { DEFAULT_COUNTERTOP } from '../model/countertops';
import { tryFormula } from '../model/pricing';
import { CORNER_EPS, CORNER_FILLER, cornerNeedsFlip, cornerReserves, isCornerFront, isReserveExempt, presetPlacements, wallEndpoints } from '../model/geometry';

/** Applied panels (ends + island backs) bill at this rate per square foot. */
export const PANEL_RATE_PER_SQFT = 36;

/** Catalog ids that were renamed/removed — remap (or drop) on load. */
const CATALOG_MIGRATE: Record<string, string> = { 'base-doordrawer': 'base-1door1drawer', 'base-blind': 'base-blindr', 'app-icemaker': 'out-icemaker' };
const VALID_IDS = new Set(CATALOG.map((c) => c.id));

/** Effective allowed size range for a cabinet, with user Settings overrides. */
export function effectiveDims(
  catId: string,
  dims: Record<string, DimOverride>
): { minW: number; maxW: number; minD: number; maxD: number } {
  const cat = catalogById(catId);
  const o = dims[catId] ?? {};
  return {
    minW: o.minW ?? cat.minW,
    maxW: o.maxW ?? cat.maxW,
    minD: o.minD ?? cat.minD ?? 12,
    maxD: o.maxD ?? cat.maxD ?? 36,
  };
}

export type Tab = 'design' | 'plan' | '3d' | 'report';

let counter = 0;
export function uid(prefix: string): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

function defaultDesign(): Design {
  return {
    name: 'My Outdoor Kitchen',
    client: '',
    layout: 'linear',
    finishId: 'indigo',
    doorStyle: 'shaker',
    counterThickness: COUNTER_T,
    counterId: DEFAULT_COUNTERTOP,
    backsplashHeight: 0,
    dimFrom: 'left',
    walls: [{ id: uid('wall'), name: 'Front Wall', length: 110, height: 96, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
    items: [],
    roughIns: [],
    openings: [],
  };
}

/** Default size of a freshly added rough-in (inches). */
const ROUGHIN_DEFAULTS: Record<RoughInKind, { w: number; h: number; y: number }> = {
  plumbing: { w: 10, h: 8, y: 12 },
  electrical: { w: 4.5, h: 4.5, y: 24 },
  gas: { w: 5, h: 5, y: 14 },
};

/** Default size of a freshly added opening (inches). Doors sit on the floor. */
const OPENING_DEFAULTS: Record<OpeningKind, { w: number; h: number; y: number }> = {
  window: { w: 36, h: 36, y: 36 },
  door: { w: 36, h: 80, y: 0 },
};

/** Minimum clearance a rough-in must keep from a cabinet end (inches). */
export const ROUGHIN_CLEAR = 1;
/** Larger clearance required when that end carries an applied end panel. */
export const ROUGHIN_CLEAR_PANEL = 2;

/**
 * The cabinet a rough-in sits behind — its full width must be contained within
 * one cabinet's footprint on the same wall (you can't drill into the gap
 * between two cabinets). Prefers a floor-lane (base) cabinet. Returns null when
 * the stub isn't fully behind any single cabinet.
 */
export function roughInHost(design: Design, r: RoughIn): PlacedItem | null {
  const x1 = r.x - r.w / 2;
  const x2 = r.x + r.w / 2;
  const contains = design.items.filter((it) => {
    if (it.wallId !== r.wallId) return false;
    if (catalogById(it.catalogId).front === 'filler') return false; // can't host a stub
    const fpw = footprintW(it);
    return it.x - 0.01 <= x1 && it.x + fpw + 0.01 >= x2;
  });
  return contains.find((it) => catalogById(it.catalogId).lane === 'floor') ?? contains[0] ?? null;
}

/**
 * Allowed horizontal range for a rough-in's center inside its host cabinet,
 * keeping it clear of each end by ROUGHIN_CLEAR (or ROUGHIN_CLEAR_PANEL when
 * that end has an applied end panel — so the finished panel is cleared too).
 */
export function roughInBand(host: PlacedItem, w: number): { lo: number; hi: number } {
  const fpw = footprintW(host);
  const he = appliedEnds(host);
  const leftClear = he.l ? ROUGHIN_CLEAR_PANEL : ROUGHIN_CLEAR;
  const rightClear = he.r ? ROUGHIN_CLEAR_PANEL : ROUGHIN_CLEAR;
  return { lo: host.x + leftClear + w / 2, hi: host.x + fpw - rightClear - w / 2 };
}

/**
 * A stub-out is "good" (no conflict) when nothing blocks drilling it: either it
 * sits fully behind a single cabinet with end clearance, OR there's no cabinet
 * in front of it at all (open space). It only conflicts when a cabinet END falls
 * within its span — i.e. it's partially behind a cabinet or straddles the gap
 * between two cabinets, where you couldn't cut a clean hole.
 */
export function roughInConflict(design: Design, r: RoughIn): boolean {
  const stubL = r.x - r.w / 2;
  const stubR = r.x + r.w / 2;
  const cabs = design.items.filter((it) => {
    if (it.wallId !== r.wallId) return false;
    const c = catalogById(it.catalogId);
    return c.lane === 'floor' && c.front !== 'filler';
  });
  // Good: fully behind one cabinet, clear of its ends (and applied panels).
  for (const it of cabs) {
    const e = appliedEnds(it);
    const lo = it.x + (e.l ? ROUGHIN_CLEAR_PANEL : ROUGHIN_CLEAR);
    const hi = it.x + footprintW(it) - (e.r ? ROUGHIN_CLEAR_PANEL : ROUGHIN_CLEAR);
    if (stubL >= lo - 0.01 && stubR <= hi + 0.01) return false;
  }
  // Good: nothing in front of it (no cabinet overlaps the stub's span).
  const blocked = cabs.some((it) => it.x < stubR - 0.01 && it.x + footprintW(it) > stubL + 0.01);
  if (!blocked) return false;
  // Otherwise a cabinet end intrudes on the stub → conflict.
  return true;
}

/** Renames from the pre-Starboard finish palette. */
const FINISH_MIGRATE: Record<string, string> = { gray: 'slate', navy: 'indigo', teak: 'nutmeg' };

/** Fill in fields added since older saves: wall placement, hinge, ends, door style. */
export function normalizeDesign(raw: Design): Design {
  const layout: LayoutKind = raw.layout ?? 'linear';
  let walls = raw.walls ?? [];
  if (walls.some((w) => typeof (w as Partial<Wall>).x !== 'number')) {
    const placements = presetPlacements(layout, walls);
    walls = walls.map((w, i) => ({ ...w, ...placements[i] }));
  }
  walls = walls.map((w) => ({ ...w, thickness: w.thickness ?? 5, ghost: w.ghost ?? false }));
  const items = (raw.items ?? [])
    .map((it) => ({ ...it, catalogId: CATALOG_MIGRATE[it.catalogId] ?? it.catalogId }))
    .filter((it) => VALID_IDS.has(it.catalogId))
    .map((it) => {
      // Appliances and appliance openings (fridges, ice makers) can't take
      // applied ends — strip any stale flags so they don't render or bill.
      const noEnds = !takesAppliedEnds(catalogById(it.catalogId));
      return {
        ...it,
        hinge: it.hinge ?? 'left',
        endL: noEnds ? false : it.endL ?? false,
        endR: noEnds ? false : it.endR ?? false,
        trays: it.trays ?? 0,
        waterfallL: it.waterfallL ?? false,
        waterfallR: it.waterfallR ?? false,
      };
    });
  const finishId = FINISH_MIGRATE[raw.finishId] ?? raw.finishId;
  const wallIds = new Set(walls.map((w) => w.id));
  const roughIns = (raw.roughIns ?? []).filter((r) => wallIds.has(r.wallId));
  const openings = (raw.openings ?? []).filter((o) => wallIds.has(o.wallId));
  const counterThickness = raw.counterThickness && raw.counterThickness > 0 ? raw.counterThickness : COUNTER_T;
  const counterId = raw.counterId ?? DEFAULT_COUNTERTOP;
  const backsplashHeight = raw.backsplashHeight && raw.backsplashHeight > 0 ? raw.backsplashHeight : 0;
  const result = { ...defaultDesign(), ...raw, finishId, doorStyle: raw.doorStyle ?? 'shaker', counterThickness, counterId, backsplashHeight, dimFrom: raw.dimFrom ?? 'left', walls, items, roughIns, openings };
  autoCornerFillers(result);
  alignFillers(result);
  return result;
}

interface AppState {
  design: Design;
  tab: Tab;
  selectedId: string | null;
  editingId: string | null;
  editingRoughInId: string | null;
  editingOpeningId: string | null;
  addToWallId: string | null;
  pricingOpen: boolean;
  retailPricingOpen: boolean;
  settingsOpen: boolean;
  appliancesOpen: boolean;
  /** Dealer's own appliance-inventory modal. */
  myAppliancesOpen: boolean;
  /** Admin handle/hardware inventory modal. */
  handlesOpen: boolean;
  /** Admin-managed handle (cabinet pull) inventory. */
  handles: HandleItem[];
  /** catalogId -> formula override (base / dealer cost) */
  pricing: Record<string, string>;
  /** catalogId -> retail price formula (basis for contractor "% off retail") */
  retailPricing: Record<string, string>;
  /** catalogId -> size-range override */
  dims: Record<string, DimOverride>;
  /** Admin-managed appliance inventory (grills, fridges, liners, …). */
  appliances: ApplianceItem[];
  /** Per-brand manufacturer discount (dealer gets half). */
  applianceBrands: ApplianceBrands;
  /** True once real 3D appliance models (glb) have loaded — re-renders views. */
  modelsReady: boolean;
  snapshot3d: string | null;

  setTab: (tab: Tab) => void;
  setSettingsOpen: (open: boolean) => void;
  setAppliancesOpen: (open: boolean) => void;
  setMyAppliancesOpen: (open: boolean) => void;
  setAppliances: (appliances: ApplianceItem[]) => void;
  setApplianceBrands: (brands: ApplianceBrands) => void;
  setHandlesOpen: (open: boolean) => void;
  setHandles: (handles: HandleItem[]) => void;
  setDim: (catalogId: string, patch: Partial<DimOverride>) => void;
  setDesignMeta: (patch: Partial<Pick<Design, 'name' | 'client' | 'finishId' | 'doorStyle' | 'gasType' | 'counterThickness' | 'counterId' | 'backsplashHeight' | 'dimFrom' | 'handleId'>>) => void;
  applyPreset: (layout: LayoutKind) => void;
  addWall: () => void;
  addWallAt: (placement: { x: number; y: number; angle: number; length: number }) => void;
  removeWall: (id: string) => void;
  updateWall: (id: string, patch: Partial<Omit<Wall, 'id'>>) => void;
  flipWall: (id: string) => void;
  rotateWall: (id: string, deltaDeg: number) => void;
  addItem: (wallId: string, catalogId: string) => boolean;
  updateItem: (id: string, patch: Partial<Omit<PlacedItem, 'id' | 'catalogId'>>) => void;
  removeItem: (id: string) => void;
  duplicateItem: (id: string) => void;
  moveItem: (id: string, x: number) => void;
  reflowAll: () => void;
  addRoughIn: (wallId: string, kind: RoughInKind) => void;
  updateRoughIn: (id: string, patch: Partial<Omit<RoughIn, 'id' | 'wallId'>>) => void;
  removeRoughIn: (id: string) => void;
  openRoughIn: (id: string | null) => void;
  addOpening: (wallId: string, kind: OpeningKind) => void;
  updateOpening: (id: string, patch: Partial<Omit<Opening, 'id' | 'wallId'>>) => void;
  removeOpening: (id: string) => void;
  openOpening: (id: string | null) => void;
  select: (id: string | null) => void;
  openEditor: (id: string | null) => void;
  openAdd: (wallId: string | null) => void;
  setPricingOpen: (open: boolean) => void;
  setFormula: (catalogId: string, formula: string | null) => void;
  setRetailPricingOpen: (open: boolean) => void;
  setRetailFormula: (catalogId: string, formula: string | null) => void;
  setSnapshot: (dataUrl: string | null) => void;
  newDesign: () => void;
  loadDesign: (design: Design) => void;
}

/** Items in the same lane on a wall, sorted by x. */
export function laneItems(items: PlacedItem[], wallId: string, lane: 'floor' | 'upper'): PlacedItem[] {
  return items
    .filter((it) => it.wallId === wallId && catalogById(it.catalogId).lane === lane)
    .sort((a, b) => a.x - b.x);
}

const END_PANEL_T = 0.75;

/** True when a window/door opening overlaps any cabinet on its wall (both
 *  horizontally and vertically) — i.e. a cabinet is in the way of the opening. */
export function openingClash(o: Opening, items: PlacedItem[], counterT: number): boolean {
  const ox1 = o.x - o.w / 2;
  const ox2 = o.x + o.w / 2;
  const oy1 = o.y;
  const oy2 = o.y + o.h;
  for (const it of items) {
    if (it.wallId !== o.wallId) continue;
    const cat = catalogById(it.catalogId);
    if (cat.front === 'filler') continue; // shallow trim doesn't block an opening
    const ix1 = it.x;
    const ix2 = it.x + footprintW(it);
    if (ox1 >= ix2 || ox2 <= ix1) continue; // no horizontal overlap
    const bottom = it.mount;
    const top = it.mount + it.h + (cat.counter ? counterT : 0) + (cat.topGearH ?? 0);
    if (oy1 >= top || oy2 <= bottom) continue; // no vertical overlap
    return true;
  }
  return false;
}

/** Effective applied-end panels for an item. Appliances and appliance openings
 *  (fridges, ice makers) never have them — regardless of stale stored flags. */
export function appliedEnds(it: PlacedItem): { l: boolean; r: boolean } {
  if (!takesAppliedEnds(catalogById(it.catalogId))) return { l: false, r: false };
  return { l: !!it.endL, r: !!it.endR };
}

/** Overall width an item occupies on the wall: cabinet + applied end panels. */
export function footprintW(it: PlacedItem): number {
  const e = appliedEnds(it);
  // Corner & lazy-susan cabinets have a leg on each wall, so one applied end
  // runs along the PERPENDICULAR wall and doesn't widen this wall — at most the
  // own-wall tip end counts here (the other shows on the adjoining wall).
  const cat = catalogById(it.catalogId);
  if (cat.front === 'corner' || cat.front === 'susan') {
    return it.w + (e.l || e.r ? END_PANEL_T : 0);
  }
  return it.w + (e.l ? END_PANEL_T : 0) + (e.r ? END_PANEL_T : 0);
}

/**
 * Continuous wall spans (along the wall, in inches) that receive a stone
 * backsplash: every counter-bearing floor cabinet's footprint, plus the corner
 * reserve zones where a neighbouring corner cabinet's leg occupies this wall.
 * Adjacent spans merge so the backsplash is unbroken around inside corners.
 * Shared by the 3D scene and the 2D elevation so both agree.
 */
export function backsplashSpans(
  floorItems: PlacedItem[],
  wallLength: number,
  reserve: { start: number; end: number }
): Array<{ x1: number; x2: number }> {
  const spans: Array<{ x1: number; x2: number }> = [];
  for (const it of floorItems) {
    if (!catalogById(it.catalogId).counter) continue; // only behind counters
    spans.push({ x1: it.x, x2: it.x + footprintW(it) });
  }
  if (reserve.start > 0) spans.push({ x1: 0, x2: reserve.start });
  if (reserve.end > 0) spans.push({ x1: wallLength - reserve.end, x2: wallLength });
  if (!spans.length) return [];
  spans.sort((a, b) => a.x1 - b.x1);
  const merged: Array<{ x1: number; x2: number }> = [{ ...spans[0] }];
  for (const s of spans.slice(1)) {
    const last = merged[merged.length - 1];
    if (s.x1 <= last.x2 + 1) last.x2 = Math.max(last.x2, s.x2); // 1" tolerance = touching
    else merged.push({ ...s });
  }
  return merged.map((s) => ({ x1: Math.max(0, s.x1), x2: Math.min(wallLength, s.x2) }));
}

/** True when the item's wall is an island (back is exposed → back panels). */
export function itemOnIsland(design: Design, it: PlacedItem): boolean {
  return design.walls.find((w) => w.id === it.wallId)?.ghost ?? false;
}

export interface ItemPrice {
  /** Box price from the formula (drawers/add-ons baked in) or filler per-inch. */
  cabinet: number;
  /** Pull-out tray cost. */
  trays: number;
  /** Applied end-panel cost (left/right). */
  ends: number;
  /** Applied back-panel cost (island only). */
  back: number;
  total: number;
  error?: string;
}

const ZERO_PRICE: ItemPrice = { cabinet: 0, trays: 0, ends: 0, back: 0, total: 0 };
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Full line price: box formula (W×D+$500 with drawers & flat add-ons baked into
 * the formula) + pull-out trays + applied panels. Fillers price per inch of
 * width. End/back panels bill at PANEL_RATE_PER_SQFT with panel height
 * excluding the 4" toe kick.
 */
export function itemPrice(design: Design, it: PlacedItem, pricing: Record<string, string>): ItemPrice {
  const cat = catalogById(it.catalogId);
  if (cat.category === 'appliance') return ZERO_PRICE;
  // fillers: priced per inch of width only
  if (cat.perInch) {
    const c = round2(cat.perInch * it.w);
    return { ...ZERO_PRICE, cabinet: c, total: c };
  }
  const formula = pricing[cat.id] ?? cat.formula;
  const { price, error } = tryFormula(formula, { W: it.w, D: it.d, H: it.h });
  if (error) return { ...ZERO_PRICE, error };
  const hasKick = cat.lane === 'floor';
  const panelH = Math.max(0, it.h - (hasKick ? TOEKICK_H : 0));
  const sqft = (wIn: number) => (wIn * panelH) / 144;
  const trays = (it.trays ?? 0) * DEFAULT_RATES.tray;
  const e = appliedEnds(it);
  const nEnds = (e.l ? 1 : 0) + (e.r ? 1 : 0);
  const ends = nEnds * sqft(it.d) * PANEL_RATE_PER_SQFT;
  const back = itemOnIsland(design, it) ? sqft(it.w) * PANEL_RATE_PER_SQFT : 0;
  const total = price + trays + ends + back;
  return {
    cabinet: round2(price),
    trays: round2(trays),
    ends: round2(ends),
    back: round2(back),
    total: round2(total),
  };
}

/** Stable callout numbers: by wall order, then lane (floor first), then x. */
export function itemNumbers(design: Design): Map<string, number> {
  const map = new Map<string, number>();
  let n = 1;
  for (const wall of design.walls) {
    for (const lane of ['floor', 'upper'] as const) {
      for (const it of laneItems(design.items, wall.id, lane)) {
        map.set(it.id, n++);
      }
    }
  }
  return map;
}

export function reservesFor(design: Design): Map<string, { start: number; end: number }> {
  return cornerReserves(design.walls, design.items, catalogById);
}

export function spaceLeft(design: Design, wallId: string, lane: 'floor' | 'upper'): number {
  const wall = design.walls.find((w) => w.id === wallId);
  if (!wall) return 0;
  const r = lane === 'floor' ? reservesFor(design).get(wallId) ?? { start: 0, end: 0 } : { start: 0, end: 0 };
  // auto corner fillers live inside the already-reserved dead corner — don't
  // double-count them against usable space.
  const used = laneItems(design.items, wallId, lane).reduce((s, it) => s + (it.auto ? 0 : footprintW(it)), 0);
  return wall.length - r.start - r.end - used;
}

/**
 * Largest contiguous opening (and its left edge) where a new cabinet could be
 * placed on a lane — accounting for corner reserves and any cabinets already
 * occupying space (including corner cabinets pinned to a wall end). This is the
 * width that actually matters for adding a cabinet, vs spaceLeft's running
 * total which can be split across gaps.
 */
export function largestOpening(design: Design, wallId: string, lane: 'floor' | 'upper'): { x: number; w: number } {
  const wall = design.walls.find((w) => w.id === wallId);
  if (!wall) return { x: 0, w: 0 };
  const r = lane === 'floor' ? reservesFor(design).get(wallId) ?? { start: 0, end: 0 } : { start: 0, end: 0 };
  const lo = r.start;
  const hi = wall.length - r.end;
  const occ = laneItems(design.items, wallId, lane)
    .map((it) => [it.x, it.x + footprintW(it)] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  let best = { x: lo, w: 0 };
  let cur = lo;
  const consider = (a: number, b: number) => {
    const wdt = b - a;
    if (wdt > best.w) best = { x: a, w: wdt };
  };
  for (const [a, b] of occ) {
    if (a > cur) consider(cur, Math.min(a, hi));
    cur = Math.max(cur, b);
    if (cur >= hi) break;
  }
  if (cur < hi) consider(cur, hi);
  return best;
}

/** Where (and how wide) a given catalog item can be added on a wall lane. */
export function openingFor(design: Design, wallId: string, cat: { front: string; lane: 'floor' | 'upper' }): { x: number; w: number } {
  // corner/blind cabinets drop into a reserved dead-corner zone (start or end)
  if (cat.front === 'corner' || cat.front === 'susan' || cat.front === 'blind') {
    const wall = design.walls.find((w) => w.id === wallId);
    if (!wall) return { x: 0, w: 0 };
    const r = reservesFor(design).get(wallId) ?? { start: 0, end: 0 };
    const lane = laneItems(design.items, wallId, cat.lane);
    const cornerAt = (atStart: boolean) =>
      lane.some((it) => {
        if (!isCornerFront(catalogById(it.catalogId))) return false;
        return atStart ? it.x <= 2 : it.x + footprintW(it) >= wall.length - 2;
      });
    // prefer an open reserved corner; the cabinet is exempt so it may fill it
    if (r.start > 0 && !cornerAt(true)) return { x: 0, w: wall.length };
    if (r.end > 0 && !cornerAt(false)) return { x: wall.length, w: wall.length };
    // no free corner zone → append at the trailing end
    const cursor = lane.reduce((m, it) => Math.max(m, it.x + footprintW(it)), 0);
    return { x: cursor, w: wall.length - cursor };
  }
  return largestOpening(design, wallId, cat.lane);
}

/**
 * Re-pack a lane: sort by center, then sweep so nothing overlaps, everything
 * stays on the wall, and non-corner cabinets stay out of reserved corner
 * zones. Order is preserved from x.
 */
function packLane(items: PlacedItem[], wallLength: number, lo: number, hi: number): void {
  const sorted = [...items].sort((a, b) => a.x + footprintW(a) / 2 - (b.x + footprintW(b) / 2));
  const exempt = (it: PlacedItem) => isReserveExempt(catalogById(it.catalogId));
  // Left-to-right sweep
  let cursor = 0;
  for (const it of sorted) {
    const itemLo = exempt(it) ? 0 : lo;
    it.x = Math.max(it.x, itemLo, cursor);
    cursor = it.x + footprintW(it);
  }
  // Right-to-left sweep: pull back inside the wall / reserve bounds
  let limit = Infinity;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const it = sorted[i];
    const itemHi = exempt(it) ? wallLength : hi;
    it.x = Math.max(0, Math.min(it.x, itemHi - footprintW(it), limit - footprintW(it)));
    limit = it.x;
  }
}

/** Re-pack every wall (corner reserves depend on neighbouring walls, so pack globally). */
function packAll(design: Design): void {
  const reserves = cornerReserves(design.walls, design.items, catalogById);
  for (const wall of design.walls) {
    const r = reserves.get(wall.id) ?? { start: 0, end: 0 };
    packLane(laneItems(design.items, wall.id, 'floor'), wall.length, r.start, wall.length - r.end);
    packLane(laneItems(design.items, wall.id, 'upper'), wall.length, 0, wall.length);
  }
}

/**
 * Fillers are shallow; pull each forward so its front face lines up flush with
 * the adjacent cabinet (outset = neighbour front depth − filler depth).
 */
function alignFillers(design: Design): void {
  for (const wall of design.walls) {
    for (const lane of ['floor', 'upper'] as const) {
      const items = laneItems(design.items, wall.id, lane);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (catalogById(it.catalogId).front !== 'filler') continue;
        let front = 0;
        for (const nb of [items[i - 1], items[i + 1]]) {
          if (!nb) continue;
          if (catalogById(nb.catalogId).front === 'filler') continue;
          front = Math.max(front, nb.outset + nb.d);
        }
        if (front === 0) front = lane === 'floor' ? 24 : 12; // standalone fallback
        it.outset = Math.max(0, Math.round((front - it.d) * 100) / 100);
      }
    }
  }
}

/** Total countertop area (square feet) across all walls — continuous runs plus
 *  each corner/lazy-susan's own shaped top. Front overhang is included; an
 *  estimate for the report. */
export function counterAreaSqft(design: Design): number {
  let sqin = 0;
  for (const wall of design.walls) {
    const floor = laneItems(design.items, wall.id, 'floor');
    // corner & susan units carry their own L-shaped top (≈ their footprint)
    for (const it of floor) {
      const c = catalogById(it.catalogId);
      if (c.counter && (c.front === 'corner' || c.front === 'susan')) sqin += it.w * (it.d + it.outset);
    }
    // straight continuous runs of counter-bearing cabinets
    const tops = floor
      .filter((it) => {
        const c = catalogById(it.catalogId);
        return c.counter && c.front !== 'corner' && c.front !== 'susan';
      })
      .sort((a, b) => a.x - b.x);
    const runs: Array<{ x1: number; x2: number; d: number }> = [];
    for (const it of tops) {
      const last = runs[runs.length - 1];
      if (last && it.x <= last.x2 + 0.2) {
        last.x2 = Math.max(last.x2, it.x + footprintW(it));
        last.d = Math.max(last.d, it.d + it.outset);
      } else runs.push({ x1: it.x, x2: it.x + footprintW(it), d: it.d + it.outset });
    }
    for (const r of runs) sqin += (r.x2 - r.x1) * (r.d + COUNTER_OVERHANG);
  }
  return Math.round((sqin / 144) * 10) / 10;
}

/**
 * Auto-place a 3″ base filler on each wall at an inside corner where a plain
 * (non-corner) floor cabinet meets a plain floor cabinet on the adjoining wall
 * — closing the dead-corner gap so the user doesn't have to add fillers by hand.
 * These carry `auto: true`, are re-derived on every pack, and are not editable.
 */
function autoCornerFillers(design: Design): void {
  // re-derive from scratch — drop any previously auto-placed fillers
  design.items = design.items.filter((it) => !it.auto);
  const fillerCat = catalogById('trim-basefiller');
  const ep = (w: Wall) => wallEndpoints(w);
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  // nearest non-filler floor cabinet to a wall end + its edge gap and corner-ness
  const nearest = (wall: Wall, atEnd: 'start' | 'end') => {
    let best: { it: PlacedItem; edge: number; corner: boolean } | null = null;
    for (const it of laneItems(design.items, wall.id, 'floor')) {
      const c = catalogById(it.catalogId);
      if (c.front === 'filler') continue;
      const fw = footprintW(it);
      const edge = atEnd === 'start' ? it.x : wall.length - (it.x + fw);
      if (!best || edge < best.edge) best = { it, edge, corner: isCornerFront(c) };
    }
    return best;
  };

  const add: PlacedItem[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < design.walls.length; i++) {
    for (let j = i + 1; j < design.walls.length; j++) {
      const A = design.walls[i];
      const B = design.walls[j];
      if (A.ghost || B.ghost) continue;
      const a = ep(A);
      const b = ep(B);
      const combos: Array<['start' | 'end', 'start' | 'end', number]> = [
        ['start', 'start', dist(a.p0, b.p0)],
        ['start', 'end', dist(a.p0, b.p1)],
        ['end', 'start', dist(a.p1, b.p0)],
        ['end', 'end', dist(a.p1, b.p1)],
      ];
      for (const [eA, eB, d] of combos) {
        if (d > CORNER_EPS) continue;
        for (const [W, eW, O, eO] of [
          [A, eA, B, eB],
          [B, eB, A, eA],
        ] as const) {
          const nW = nearest(W, eW);
          const nO = nearest(O, eO);
          // both walls need a plain cabinet; a corner unit fills the corner itself
          if (!nW || !nO || nW.corner || nO.corner) continue;
          // only fill when W's cabinet actually borders the dead-corner zone
          // (the other wall's depth + the 3″ clearance)
          if (nW.edge > nO.it.d + nO.it.outset + CORNER_FILLER + 1) continue;
          const id = `cf-${W.id}-${eW}`;
          if (seen.has(id)) continue;
          seen.add(id);
          const x = eW === 'start' ? nW.it.x - CORNER_FILLER : nW.it.x + footprintW(nW.it);
          add.push({
            id,
            wallId: W.id,
            catalogId: 'trim-basefiller',
            x: Math.max(0, Math.min(x, W.length - CORNER_FILLER)),
            w: CORNER_FILLER,
            d: fillerCat.d,
            // match the cabinet it abuts so it isn't a different height
            h: nW.it.h,
            outset: 0,
            mount: nW.it.mount,
            hinge: 'left',
            endL: false,
            endR: false,
            trays: 0,
            auto: true,
          });
        }
      }
    }
  }
  design.items.push(...add);
}

function withPack(design: Design): Design {
  // pack real items first (auto-fillers are exempt trim and re-derived after)
  const next = { ...design, items: design.items.filter((it) => !it.auto).map((it) => ({ ...it })) };
  packAll(next);
  autoCornerFillers(next);
  alignFillers(next);
  return next;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      design: defaultDesign(),
      tab: 'design',
      selectedId: null,
      editingId: null,
      editingRoughInId: null,
      editingOpeningId: null,
      addToWallId: null,
      pricingOpen: false,
      retailPricingOpen: false,
      settingsOpen: false,
      appliancesOpen: false,
      myAppliancesOpen: false,
      handlesOpen: false,
      handles: [],
      pricing: {},
      retailPricing: {},
      dims: {},
      appliances: [],
      applianceBrands: {},
      modelsReady: false,
      snapshot3d: null,

      setTab: (tab) => set({ tab }),
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      setAppliancesOpen: (open) => set({ appliancesOpen: open }),
      setMyAppliancesOpen: (open) => set({ myAppliancesOpen: open }),
      setAppliances: (appliances) => set({ appliances }),
      setApplianceBrands: (applianceBrands) => set({ applianceBrands }),
      setHandlesOpen: (open) => set({ handlesOpen: open }),
      setHandles: (handles) => set({ handles }),
      setDim: (catalogId, patch) =>
        set((s) => {
          const cur = s.dims[catalogId] ?? {};
          const next: DimOverride = { ...cur, ...patch };
          // drop keys that match the catalog default / are blank
          for (const k of Object.keys(next) as (keyof DimOverride)[]) {
            if (next[k] === undefined || Number.isNaN(next[k] as number)) delete next[k];
          }
          const dims = { ...s.dims };
          if (Object.keys(next).length === 0) delete dims[catalogId];
          else dims[catalogId] = next;
          return { dims };
        }),
      setDesignMeta: (patch) => set((s) => ({ design: { ...s.design, ...patch } })),

      applyPreset: (layout) =>
        set((s) => {
          const placements = presetPlacements(layout, s.design.walls);
          const walls = s.design.walls.map((w, i) => ({ ...w, ...placements[i] }));
          return { design: withPack({ ...s.design, walls, layout }) };
        }),

      addWall: () =>
        set((s) => {
          const n = s.design.walls.length + 1;
          const names = ['Front Wall', 'Left Wall', 'Right Wall', 'Back Wall'];
          let y = 0;
          for (const w of s.design.walls) {
            const { p0, p1 } = wallEndpoints(w);
            y = Math.max(y, p0.y, p1.y);
          }
          const wall: Wall = {
            id: uid('wall'),
            name: names[n - 1] ?? `Wall ${n}`,
            length: 96,
            height: s.design.walls[0]?.height ?? 96,
            x: 0,
            y: y + 130,
            angle: 0,
            thickness: 5,
            ghost: false,
          };
          return { design: { ...s.design, walls: [...s.design.walls, wall] } };
        }),

      addWallAt: ({ x, y, angle, length }) =>
        set((s) => {
          let wall: Wall = {
            id: uid('wall'),
            name: `Wall ${s.design.walls.length + 1}`,
            length: Math.round(length),
            height: s.design.walls[0]?.height ?? 96,
            x: Math.round(x * 4) / 4,
            y: Math.round(y * 4) / 4,
            angle: Math.round(angle),
            thickness: 5,
            ghost: false,
          };
          // Orient the new wall so any corner it forms closes properly.
          for (const other of s.design.walls) {
            if (cornerNeedsFlip(wall, other)) {
              const { p1 } = wallEndpoints(wall);
              wall = { ...wall, x: Math.round(p1.x * 4) / 4, y: Math.round(p1.y * 4) / 4, angle: (wall.angle + 180) % 360 };
              break;
            }
          }
          return { design: { ...s.design, walls: [...s.design.walls, wall] } };
        }),

      removeWall: (id) =>
        set((s) => {
          const walls = s.design.walls.filter((w) => w.id !== id);
          const items = s.design.items.filter((it) => it.wallId !== id);
          return { design: withPack({ ...s.design, walls, items }) };
        }),

      updateWall: (id, patch) =>
        set((s) => {
          const walls = s.design.walls.map((w) => {
            if (w.id !== id) return w;
            const next = { ...w, ...patch };
            // thickness 0 ⟹ island; un-islanding restores a default thickness
            if (patch.thickness !== undefined && patch.thickness <= 0) next.ghost = true;
            if (patch.ghost === false && (next.thickness ?? 0) <= 0) next.thickness = 5;
            if (patch.ghost === true) next.thickness = 0;
            return next;
          });
          return { design: withPack({ ...s.design, walls }) };
        }),

      rotateWall: (id, deltaDeg) =>
        set((s) => {
          const wall = s.design.walls.find((w) => w.id === id);
          if (!wall) return s;
          // rotate about the wall's center so it pivots in place
          const rad0 = (wall.angle * Math.PI) / 180;
          const cx = wall.x + (Math.cos(rad0) * wall.length) / 2;
          const cy = wall.y + (Math.sin(rad0) * wall.length) / 2;
          const angle = ((wall.angle + deltaDeg) % 360 + 360) % 360;
          const rad = (angle * Math.PI) / 180;
          const nx = cx - (Math.cos(rad) * wall.length) / 2;
          const ny = cy - (Math.sin(rad) * wall.length) / 2;
          const walls = s.design.walls.map((w) =>
            w.id === id ? { ...w, x: Math.round(nx * 4) / 4, y: Math.round(ny * 4) / 4, angle } : w
          );
          return { design: withPack({ ...s.design, walls }) };
        }),

      flipWall: (id) =>
        set((s) => {
          const wall = s.design.walls.find((w) => w.id === id);
          if (!wall) return s;
          const { p1 } = wallEndpoints(wall);
          const walls = s.design.walls.map((w) =>
            w.id === id
              ? { ...w, x: Math.round(p1.x * 4) / 4, y: Math.round(p1.y * 4) / 4, angle: (w.angle + 180) % 360 }
              : w
          );
          // Mirror item positions so cabinets stay at the same physical spot.
          const items = s.design.items.map((it) =>
            it.wallId === id ? { ...it, x: wall.length - it.x - it.w } : it
          );
          return { design: withPack({ ...s.design, walls, items }) };
        }),

      addItem: (wallId, catalogId) => {
        const s = get();
        const cat = catalogById(catalogId);
        const wall = s.design.walls.find((w) => w.id === wallId);
        if (!wall) return false;
        const { minW } = effectiveDims(catalogId, s.dims);
        // find the largest opening (handles gaps next to pinned corner cabinets)
        const slot = openingFor(s.design, wallId, cat);
        if (slot.w < minW - 0.001) return false;
        // use the default width, or shrink to the largest that fits (≥ min)
        const w = Math.max(minW, Math.min(cat.w, Math.floor(slot.w * 4) / 4));
        // corner cabinets at the wall's far end chamfer toward the other side
        const isCornerCab = cat.front === 'corner' || cat.front === 'susan' || cat.front === 'blind';
        const hinge: 'left' | 'right' = isCornerCab && slot.x > 1 ? 'right' : 'left';
        const item: PlacedItem = {
          id: uid('item'),
          wallId,
          catalogId,
          x: slot.x,
          w,
          d: cat.d,
          h: cat.h,
          outset: 0,
          mount: cat.mount ?? 0,
          hinge,
          endL: false,
          endR: false,
          trays: 0,
        };
        set({ design: withPack({ ...s.design, items: [...s.design.items, item] }), selectedId: item.id });
        return true;
      },

      updateItem: (id, patch) =>
        set((s) => {
          const items = s.design.items.map((it) => (it.id === id ? { ...it, ...patch } : it));
          return { design: withPack({ ...s.design, items }) };
        }),

      removeItem: (id) =>
        set((s) => ({
          design: withPack({ ...s.design, items: s.design.items.filter((it) => it.id !== id) }),
          selectedId: s.selectedId === id ? null : s.selectedId,
          editingId: s.editingId === id ? null : s.editingId,
        })),

      duplicateItem: (id) => {
        const s = get();
        const src = s.design.items.find((it) => it.id === id);
        if (!src) return;
        const cat = catalogById(src.catalogId);
        if (spaceLeft(s.design, src.wallId, cat.lane) < footprintW(src)) return;
        const copy: PlacedItem = { ...src, id: uid('item'), x: src.x + footprintW(src) };
        set({
          design: withPack({ ...s.design, items: [...s.design.items, copy] }),
          selectedId: copy.id,
          editingId: null,
        });
      },

      moveItem: (id, x) =>
        set((s) => ({
          design: {
            ...s.design,
            items: s.design.items.map((it) => (it.id === id ? { ...it, x } : it)),
          },
        })),

      reflowAll: () => set((s) => ({ design: withPack(s.design) })),

      addRoughIn: (wallId, kind) =>
        set((s) => {
          const wall = s.design.walls.find((w) => w.id === wallId);
          const def = ROUGHIN_DEFAULTS[kind];
          // Drop it centered behind the first base cabinet (within end clearance)
          // so it starts valid; fall back to wall center if there's none yet.
          let x = Math.round((wall?.length ?? 60) / 2);
          const host = laneItems(s.design.items, wallId, 'floor').find((it) => catalogById(it.catalogId).front !== 'filler');
          if (host) {
            const band = roughInBand(host, def.w);
            if (band.lo <= band.hi) x = Math.round(((band.lo + band.hi) / 2) * 8) / 8;
          }
          const r: RoughIn = { id: uid('rough'), wallId, kind, x, y: def.y, w: def.w, h: def.h };
          return { design: { ...s.design, roughIns: [...s.design.roughIns, r] }, editingRoughInId: r.id };
        }),
      updateRoughIn: (id, patch) =>
        set((s) => ({
          design: { ...s.design, roughIns: s.design.roughIns.map((r) => (r.id === id ? { ...r, ...patch } : r)) },
        })),
      removeRoughIn: (id) =>
        set((s) => ({
          design: { ...s.design, roughIns: s.design.roughIns.filter((r) => r.id !== id) },
          editingRoughInId: s.editingRoughInId === id ? null : s.editingRoughInId,
        })),
      openRoughIn: (id) => set({ editingRoughInId: id }),

      addOpening: (wallId, kind) =>
        set((s) => {
          const wall = s.design.walls.find((w) => w.id === wallId);
          const def = OPENING_DEFAULTS[kind];
          const x = Math.round((wall?.length ?? 60) / 2);
          const o: Opening = { id: uid('open'), wallId, kind, x, y: def.y, w: def.w, h: def.h };
          return { design: { ...s.design, openings: [...s.design.openings, o] }, editingOpeningId: o.id };
        }),
      updateOpening: (id, patch) =>
        set((s) => ({
          design: { ...s.design, openings: s.design.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)) },
        })),
      removeOpening: (id) =>
        set((s) => ({
          design: { ...s.design, openings: s.design.openings.filter((o) => o.id !== id) },
          editingOpeningId: s.editingOpeningId === id ? null : s.editingOpeningId,
        })),
      openOpening: (id) => set({ editingOpeningId: id }),

      select: (id) => set({ selectedId: id }),
      openEditor: (id) => set({ editingId: id, selectedId: id }),
      openAdd: (wallId) => set({ addToWallId: wallId }),
      setPricingOpen: (open) => set({ pricingOpen: open }),
      setFormula: (catalogId, formula) =>
        set((s) => {
          const pricing = { ...s.pricing };
          if (formula === null) delete pricing[catalogId];
          else pricing[catalogId] = formula;
          return { pricing };
        }),
      setRetailPricingOpen: (open) => set({ retailPricingOpen: open }),
      setRetailFormula: (catalogId, formula) =>
        set((s) => {
          const retailPricing = { ...s.retailPricing };
          if (formula === null) delete retailPricing[catalogId];
          else retailPricing[catalogId] = formula;
          return { retailPricing };
        }),
      setSnapshot: (dataUrl) => set({ snapshot3d: dataUrl }),
      newDesign: () => set({ design: defaultDesign(), selectedId: null, editingId: null, editingRoughInId: null, editingOpeningId: null, snapshot3d: null }),
      loadDesign: (design) =>
        set({ design: normalizeDesign(design), selectedId: null, editingId: null, editingRoughInId: null, editingOpeningId: null, snapshot3d: null }),
    }),
    {
      name: 'cabdesign-v1',
      version: 2,
      migrate: (state) => {
        const s = state as { design?: Design } | undefined;
        if (s?.design) return { ...s, design: normalizeDesign(s.design) };
        return state;
      },
      partialize: (s) => ({ design: s.design, pricing: s.pricing, dims: s.dims }),
      // after a same-version rehydrate (no migrate), backfill fields added since
      // the save (e.g. roughIns) and re-pack so derived layout (corner reserves,
      // filler auto-outset) reflects the loaded design.
      onRehydrateStorage: () => (state) => {
        if (state?.design) {
          if (!Array.isArray(state.design.roughIns)) state.design.roughIns = [];
          if (!Array.isArray(state.design.openings)) state.design.openings = [];
          state.design = withPack(state.design);
        }
      },
    }
  )
);
