import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ApplianceBrands, ApplianceItem, Design, DimOverride, HandleItem, KitchenType, LayoutKind, Measurement, ModelAligns, Opening, OpeningKind, PanelRates, PlacedItem, ProductLine, RoughIn, RoughInKind, Wall } from '../model/types';
import { BAR_DEPTH, BAR_NOSE, BAR_OVERHANG, BAR_RISE, BASE_H, CATALOG, COUNTER_OVERHANG, COUNTER_T, DEFAULT_RATES, TOEKICK_H, bridgesCounter, catalogById, doorStylesFor, finishesForLine, takesAppliedEnds, takesWaterfall } from '../model/catalog';
import { LINER_CABINET_CLEARANCE } from '../model/appliances';
import { NEWAGE_ID_MIGRATE, itemFinishId, naVariantFor } from '../model/newage';
import { DEFAULT_COUNTERTOP } from '../model/countertops';
import { tryFormula } from '../model/pricing';
import { CORNER_EPS, cornerBlocksRun, cornerCounterExtend, cornerGapFor, cornerNeedsFlip, cornerReserves, isBlindFront, isCornerFront, isReserveExempt, presetPlacements, wallEndpoints } from '../model/geometry';

/** Applied panels (ends + island backs) bill at this rate per square foot.
 *  Default only — the admin-managed rates live in store.panelRates. */
export const PANEL_RATE_PER_SQFT = 36;
/** Finished ends (the side itself in finished material) cost a bit more. */
export const FINISHED_END_RATE_PER_SQFT = 45;
export const DEFAULT_PANEL_RATES: PanelRates = { applied: PANEL_RATE_PER_SQFT, finished: FINISHED_END_RATE_PER_SQFT };

/** The current admin-managed panel rates (synced from the server at login). */
export function panelRates(): PanelRates {
  return useStore.getState().panelRates ?? DEFAULT_PANEL_RATES;
}

/** Catalog ids that were renamed/removed — remap (or drop) on load. */
const CATALOG_MIGRATE: Record<string, string> = {
  'base-doordrawer': 'base-1door1drawer',
  'base-blind': 'base-blindr',
  'app-icemaker': 'out-icemaker',
  ...NEWAGE_ID_MIGRATE,
};
const VALID_IDS = new Set(CATALOG.map((c) => c.id));

/** Width above which a grill/griddle cabinet auto-converts to its 4-door version. */
export const FOUR_DOOR_AT = 41;
const FOUR_DOOR_UP: Record<string, string> = { 'out-grill': 'out-grill4', 'out-griddle': 'out-griddle4' };
const FOUR_DOOR_DOWN: Record<string, string> = { 'out-grill4': 'out-grill', 'out-griddle4': 'out-griddle' };

/** Grill/griddle cabinets over FOUR_DOOR_AT wide become the 4-door version;
 *  at or under it they revert to the 2-door version. Everything else passes. */
function autoFourDoor(it: PlacedItem): PlacedItem {
  const up = FOUR_DOOR_UP[it.catalogId];
  if (up && it.w > FOUR_DOOR_AT) return { ...it, catalogId: up };
  const down = FOUR_DOOR_DOWN[it.catalogId];
  if (down && it.w <= FOUR_DOOR_AT) return { ...it, catalogId: down };
  return it;
}

/** Effective allowed size range for a cabinet, with user Settings overrides. */
export function effectiveDims(
  catId: string,
  dims: Record<string, DimOverride>
): { minW: number; maxW: number; minD: number; maxD: number } {
  const cat = catalogById(catId);
  // Factory-fixed sizes (NewAge modular) — no overrides apply.
  if (cat.fixed) return { minW: cat.w, maxW: cat.w, minD: cat.d, maxD: cat.d };
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

/** Per-line defaults when starting a design. */
export function lineDefaults(line: ProductLine, kitchenType?: KitchenType): { finishId: string; counterId: string; doorStyle: Design['doorStyle'] } {
  if (line === 'newage') return { finishId: 'na-ss-steel', counterId: 'na-stainless', doorStyle: 'flat' };
  // Indoor EXT kitchens: painted/wood palette + real inset-panel shaker.
  if (kitchenType === 'indoor') return { finishId: 'in-white', counterId: DEFAULT_COUNTERTOP, doorStyle: 'shaker-inset' };
  return { finishId: 'indigo', counterId: DEFAULT_COUNTERTOP, doorStyle: 'shaker' };
}

function defaultDesign(kitchenType: KitchenType = 'outdoor', line: ProductLine = 'ext'): Design {
  const d = lineDefaults(line, kitchenType);
  return {
    name: kitchenType === 'indoor' ? 'My Kitchen' : 'My Outdoor Kitchen',
    client: '',
    layout: 'linear',
    kitchenType,
    line,
    finishId: d.finishId,
    doorStyle: d.doorStyle,
    counterThickness: COUNTER_T,
    counterId: d.counterId,
    backsplashHeight: 0,
    dimFrom: 'left',
    walls: [{ id: uid('wall'), name: 'Front Wall', length: 110, height: 96, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
    items: [],
    roughIns: [],
    openings: [],
    measurements: [],
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
      // applied ends or waterfalls — strip stale flags so they don't render
      // or bill.
      const noEnds = !takesAppliedEnds(catalogById(it.catalogId));
      const noWf = !takesWaterfall(catalogById(it.catalogId));
      const next = autoFourDoor({
        ...it,
        hinge: it.hinge ?? 'left',
        endL: noEnds ? false : it.endL ?? false,
        endR: noEnds ? false : it.endR ?? false,
        finL: noEnds ? false : it.finL ?? false,
        finR: noEnds ? false : it.finR ?? false,
        trays: it.trays ?? 0,
        waterfallL: noWf ? false : it.waterfallL ?? false,
        waterfallR: noWf ? false : it.waterfallR ?? false,
      });
      // One end treatment per side: applied end wins over finished end, which
      // wins over a waterfall edge (they'd occupy the same face).
      if (next.endL) next.finL = false;
      if (next.endR) next.finR = false;
      if (next.endL || next.finL) next.waterfallL = false;
      if (next.endR || next.finR) next.waterfallR = false;
      return next;
    });
  // Product line: map legacy per-material lines to the merged NewAge line and
  // infer from placed items for pre-line saves; keep the finish within the
  // line's palette.
  const rawLine = raw.line as string | undefined;
  const line: ProductLine =
    rawLine === 'newage' || rawLine === 'newage-ss' || rawLine === 'newage-alu'
      ? 'newage'
      : rawLine === 'ext'
        ? 'ext'
        : items.some((it) => catalogById(it.catalogId).line)
          ? 'newage'
          : 'ext';
  const kitchenType: KitchenType = raw.kitchenType ?? 'outdoor';
  let finishId = FINISH_MIGRATE[raw.finishId] ?? raw.finishId;
  const lineFins = finishesForLine(line, kitchenType);
  if (!lineFins.some((f) => f.id === finishId)) finishId = lineFins[0].id;
  // door style must be one this kitchen type offers (pre-indoor saves keep working)
  const styles = doorStylesFor(kitchenType);
  const doorStyle = raw.doorStyle && styles.includes(raw.doorStyle) ? raw.doorStyle : styles[0];
  const wallIds = new Set(walls.map((w) => w.id));
  const roughIns = (raw.roughIns ?? []).filter((r) => wallIds.has(r.wallId));
  const openings = (raw.openings ?? []).filter((o) => wallIds.has(o.wallId));
  const counterThickness = raw.counterThickness && raw.counterThickness > 0 ? Math.min(5, raw.counterThickness) : COUNTER_T;
  const counterId = raw.counterId ?? DEFAULT_COUNTERTOP;
  const backsplashHeight = raw.backsplashHeight && raw.backsplashHeight > 0 ? raw.backsplashHeight : 0;
  const result = { ...defaultDesign(), ...raw, kitchenType, line, finishId, doorStyle, counterThickness, counterId, backsplashHeight, dimFrom: raw.dimFrom ?? 'left', walls, items, roughIns, openings };
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
  /** Consumer "request a quote" dialog (rendered on the Report tab). */
  quoteOpen: boolean;
  retailPricingOpen: boolean;
  settingsOpen: boolean;
  appliancesOpen: boolean;
  /** Dealer's own appliance-inventory modal. */
  myAppliancesOpen: boolean;
  /** Admin handle/hardware inventory modal. */
  handlesOpen: boolean;
  /** Admin-managed handle (cabinet pull) inventory. */
  handles: HandleItem[];
  /** Admin appliance-model aligner modal. */
  alignerOpen: boolean;
  /** Admin-tuned per-model 3D placement overrides (modelKey -> nudge). */
  modelAligns: ModelAligns;
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
  /** Admin-managed clearance (inches) a grill/griddle/burner cabinet must be
   *  wider than its insulated liner's cutout. Synced from the server. */
  linerClearance: number;
  /** Admin-managed $/sqft rates for applied/finished end panels. */
  panelRates: PanelRates;
  /** Bumped as each real 3D appliance model (glb) loads — re-renders views. */
  modelsReady: number;
  snapshot3d: string | null;

  setTab: (tab: Tab) => void;
  setSettingsOpen: (open: boolean) => void;
  setAppliancesOpen: (open: boolean) => void;
  setMyAppliancesOpen: (open: boolean) => void;
  setAppliances: (appliances: ApplianceItem[]) => void;
  setApplianceBrands: (brands: ApplianceBrands) => void;
  setLinerClearance: (linerClearance: number) => void;
  setPanelRates: (panelRates: PanelRates) => void;
  setHandlesOpen: (open: boolean) => void;
  setHandles: (handles: HandleItem[]) => void;
  setAlignerOpen: (open: boolean) => void;
  setModelAligns: (modelAligns: ModelAligns) => void;
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
  /** Adjust or remove an auto corner filler (key `${wallId}:start|end`); null resets to the standard 3″. */
  setCornerOverride: (key: string, o: { w?: number; off?: boolean } | null) => void;
  addRoughIn: (wallId: string, kind: RoughInKind) => void;
  updateRoughIn: (id: string, patch: Partial<Omit<RoughIn, 'id' | 'wallId'>>) => void;
  removeRoughIn: (id: string) => void;
  openRoughIn: (id: string | null) => void;
  addOpening: (wallId: string, kind: OpeningKind) => void;
  updateOpening: (id: string, patch: Partial<Omit<Opening, 'id' | 'wallId'>>) => void;
  removeOpening: (id: string) => void;
  openOpening: (id: string | null) => void;
  addMeasurement: (m: Measurement) => void;
  updateMeasurement: (id: string, patch: Partial<Omit<Measurement, 'id'>>) => void;
  removeMeasurement: (id: string) => void;
  select: (id: string | null) => void;
  openEditor: (id: string | null) => void;
  openAdd: (wallId: string | null) => void;
  setPricingOpen: (open: boolean) => void;
  setQuoteOpen: (open: boolean) => void;
  setFormula: (catalogId: string, formula: string | null) => void;
  setRetailPricingOpen: (open: boolean) => void;
  setRetailFormula: (catalogId: string, formula: string | null) => void;
  setSnapshot: (dataUrl: string | null) => void;
  newDesign: (kitchenType?: KitchenType, line?: ProductLine) => void;
  /** Switch the design's cabinet line in place. Walls/openings stay; placed
   *  cabinets from another line are removed (their catalogs don't overlap). */
  setLine: (line: ProductLine) => void;
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

/** Finished ends (side built in finished material, no added width). */
export function finishedEnds(it: PlacedItem): { l: boolean; r: boolean } {
  if (!takesAppliedEnds(catalogById(it.catalogId))) return { l: false, r: false };
  return { l: !!it.finL, r: !!it.finR };
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

/**
 * The height a counter run passes over this item at. Undercounter appliance
 * openings (fridges, ice makers) auto-size to the unit, which is usually
 * shorter than counter height — the counter still runs across at the standard
 * BASE_H with the gap showing underneath, instead of stepping down to the
 * appliance (or breaking the neighbouring run).
 */
export function counterHeightFor(it: PlacedItem): number {
  const cat = catalogById(it.catalogId);
  const opening = cat.applianceCat === 'fridge' || cat.applianceCat === 'icemaker';
  return opening && it.h <= BASE_H + 0.01 ? BASE_H : it.h;
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
  // NewAge modular units: fixed retail price for the cabinet's series/finish
  // (its own override, else the design default) — no trays, panels or formulas.
  if (cat.naPricing) {
    const nv = naVariantFor(cat, itemFinishId(design, it, cat));
    const p = round2(nv?.price ?? 0);
    return { ...ZERO_PRICE, cabinet: p, total: p };
  }
  // fillers: priced per inch of width only
  if (cat.perInch) {
    const c = round2(cat.perInch * it.w);
    return { ...ZERO_PRICE, cabinet: c, total: c };
  }
  const formula = pricing[cat.id] ?? cat.formula;
  const { price, error } = tryFormula(formula, { W: it.w, D: it.d, H: it.h });
  if (error) return { ...ZERO_PRICE, error };
  const hasKick = cat.lane === 'floor';
  // bar-height cabinets: end/back panels wrap the raised bar column too
  const panelH = Math.max(0, it.h + (cat.barHeight ? BAR_RISE : 0) - (hasKick ? TOEKICK_H : 0));
  const sqft = (wIn: number) => (wIn * panelH) / 144;
  const trays = (it.trays ?? 0) * DEFAULT_RATES.tray;
  const rates = panelRates();
  const e = appliedEnds(it);
  const nEnds = (e.l ? 1 : 0) + (e.r ? 1 : 0);
  const f = finishedEnds(it);
  const nFin = (f.l ? 1 : 0) + (f.r ? 1 : 0);
  const ends = nEnds * sqft(it.d) * rates.applied + nFin * sqft(it.d) * rates.finished;
  const back = itemOnIsland(design, it) ? sqft(it.w) * rates.applied : 0;
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
  return cornerReserves(design.walls, design.items, catalogById, design.cornerOverrides);
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
  if (cat.front === 'corner' || cat.front === 'susan' || cat.front === 'blind' || cat.front === 'blindl' || cat.front === 'blindr') {
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
  const reserves = cornerReserves(design.walls, design.items, catalogById, design.cornerOverrides);
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
  const reserves = reservesFor(design);
  for (const wall of design.walls) {
    const floor = laneItems(design.items, wall.id, 'floor');
    const ext = cornerCounterExtend(wall, design.walls, design.items, design.cornerOverrides);
    const wr = reserves.get(wall.id) ?? { start: 0, end: 0 };
    // corner & susan units carry their own L-shaped top (≈ their footprint)
    for (const it of floor) {
      const c = catalogById(it.catalogId);
      if (c.counter && (c.front === 'corner' || c.front === 'susan')) sqin += it.w * (it.d + it.outset);
    }
    // straight continuous runs of counter-bearing cabinets
    const tops = floor
      .filter((it) => {
        const c = catalogById(it.catalogId);
        return bridgesCounter(c) && !c.barHeight && c.front !== 'corner' && c.front !== 'susan';
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
    for (const r of runs) {
      // owned dead corners: the run extends to the wall corner (matches 3D)
      const x1 = ext.start && r.x1 <= wr.start + 1 ? 0 : r.x1;
      const x2 = ext.end && r.x2 >= wall.length - wr.end - 1 ? wall.length : r.x2;
      sqin += (x2 - x1) * (r.d + COUNTER_OVERHANG);
    }
    // bar-height cabinets carry their stone as three pieces (built in 3D, so
    // excluded from the runs above): the main working counter, the raised bar
    // top with its big seating overhang, and the vertical bar backsplash.
    for (const it of floor) {
      const c = catalogById(it.catalogId);
      if (!c.barHeight) continue;
      const w = footprintW(it);
      const frontD = Math.max(6, it.d - BAR_DEPTH);
      sqin += w * (frontD + COUNTER_OVERHANG); // main counter (front body + nose)
      sqin += w * (BAR_DEPTH + BAR_OVERHANG + BAR_NOSE); // bar top + seating overhang
      sqin += w * BAR_RISE; // vertical backsplash band
    }
    // connecting bar risers: the bar top + step splash also run across a
    // fridge bridged between two bar cabinets.
    for (const it of floor) {
      if (!barRiserFor(design, it)) continue;
      const w = footprintW(it);
      sqin += w * (BAR_DEPTH + BAR_OVERHANG + BAR_NOSE); // bar top over the opening
      sqin += w * BAR_RISE; // step splash band
    }
    // stone backsplash band above the counters (real walls only) — same stone,
    // so it counts toward the countertop square footage.
    const bsH = design.backsplashHeight ?? 0;
    if (bsH > 0 && !wall.ghost) {
      for (const s of backsplashSpans(floor, wall.length, wr)) sqin += (s.x2 - s.x1) * bsH;
    }
    // waterfall edges: a side slab dropping from the counter top to the floor
    const cT = design.counterThickness ?? COUNTER_T;
    for (const it of floor) {
      if (!catalogById(it.catalogId).counter) continue;
      const drop = counterHeightFor(it) + cT;
      const depth = it.d + it.outset + COUNTER_OVERHANG;
      if (it.waterfallL) sqin += drop * depth;
      if (it.waterfallR) sqin += drop * depth;
    }
  }
  return Math.round((sqin / 144) * 10) / 10;
}

/**
 * Auto-place a 3″ base filler on each wall at an inside corner where a plain
 * (non-corner) floor cabinet meets either a plain floor cabinet OR a blind
 * corner cabinet on the adjoining wall — closing the dead-corner gap (you
 * can't butt a cabinet right against a blind cabinet's blind face) so the
 * user doesn't have to add fillers by hand. These carry `auto: true`, are
 * re-derived on every pack, and are not editable.
 */
function autoCornerFillers(design: Design): void {
  // re-derive from scratch — drop any previously auto-placed fillers
  design.items = design.items.filter((it) => !it.auto);
  const fillerCat = catalogById('trim-basefiller');
  const ep = (w: Wall) => wallEndpoints(w);
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  // nearest non-filler floor cabinet to a wall end + its edge gap and corner-ness
  const nearest = (wall: Wall, atEnd: 'start' | 'end') => {
    let best: { it: PlacedItem; edge: number; corner: boolean; blind: boolean } | null = null;
    for (const it of laneItems(design.items, wall.id, 'floor')) {
      const c = catalogById(it.catalogId);
      if (c.front === 'filler') continue;
      const fw = footprintW(it);
      const edge = atEnd === 'start' ? it.x : wall.length - (it.x + fw);
      if (!best || edge < best.edge) best = { it, edge, corner: isCornerFront(c), blind: isBlindFront(c) };
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
          // W's own cabinet must be plain (a corner unit fills the corner itself).
          if (!nW || nW.corner) continue;
          // NewAge modular kitchens don't use HDPE fillers — their corner
          // cabinets close the corner instead.
          if (catalogById(nW.it.catalogId).line || (nO && catalogById(nO.it.catalogId).line)) continue;
          // per-corner override: custom filler width, or removed entirely
          const gap = cornerGapFor(design.cornerOverrides, W.id, eW);
          if (gap <= 0) continue;
          // A filler is needed when W's run borders the corner and either:
          //  - the other wall has a plain OR blind cabinet there (dead corner), or
          //  - the other wall has NO run but its returning wall blocks W's cabinet
          //    (an L corner). A diagonal/susan corner cabinet butts flush → none.
          let borders: boolean;
          if (nO && !(nO.corner && !nO.blind)) {
            borders = nW.edge <= nO.it.d + nO.it.outset + gap + 1;
          } else if (!nO) {
            borders = cornerBlocksRun(W, O, eO) && nW.edge <= gap + 1;
          } else {
            borders = false;
          }
          if (!borders) continue;
          const id = `cf-${W.id}-${eW}`;
          if (seen.has(id)) continue;
          seen.add(id);
          const x = eW === 'start' ? nW.it.x - gap : nW.it.x + footprintW(nW.it);
          add.push({
            id,
            wallId: W.id,
            catalogId: 'trim-basefiller',
            x: Math.max(0, Math.min(x, W.length - gap)),
            w: gap,
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

/** True when a cabinet's given side is exposed (open) — no neighbouring floor
 *  item abuts it, and (on a real wall) it isn't tucked into the wall's corner. */
export function sideExposed(design: Design, it: PlacedItem, side: 'left' | 'right'): boolean {
  const cat = catalogById(it.catalogId);
  if (!takesAppliedEnds(cat)) return false;
  const wall = design.walls.find((w) => w.id === it.wallId);
  if (!wall) return false;
  const edge = side === 'left' ? it.x : it.x + footprintW(it);
  // A neighbour within 6" hides this side: a panel makes no sense across a
  // small gap, and while dragging it keeps the footprint stable so cabinets
  // snap flush instead of fighting an auto-added 0.75" panel.
  const attached = design.items.some((o) => {
    if (o.id === it.id || o.wallId !== it.wallId) return false;
    if (catalogById(o.catalogId).lane !== 'floor') return false;
    const oEdge = side === 'left' ? o.x + footprintW(o) : o.x;
    return Math.abs(oEdge - edge) < 6;
  });
  if (attached) return false;
  // On a real wall, an end flush in the wall's corner is hidden, not exposed.
  if (!wall.ghost) {
    if (side === 'left' && it.x < 1) return false;
    if (side === 'right' && it.x + footprintW(it) > wall.length - 1) return false;
  }
  return true;
}

/**
 * Connecting bar riser: a fridge/ice-maker opening sitting flush between two
 * bar-height cabinets gets the raised bar back bridged across it, so the bar
 * stone top and step splash run continuously and the back reads as one finished
 * face. Its stone counts toward the countertop square footage.
 * Returns the flanking bars' body height, or null when it doesn't apply.
 */
export function barRiserFor(design: Design, it: PlacedItem): { topH: number } | null {
  const cat = catalogById(it.catalogId);
  if (cat.applianceCat !== 'fridge' && cat.applianceCat !== 'icemaker') return null;
  const fpw = footprintW(it);
  const barAt = (edge: number, side: 'L' | 'R'): PlacedItem | null => {
    for (const o of design.items) {
      if (o.id === it.id || o.wallId !== it.wallId) continue;
      const oc = catalogById(o.catalogId);
      if (!oc.barHeight || oc.lane !== 'floor') continue;
      const oEdge = side === 'L' ? o.x + footprintW(o) : o.x;
      if (Math.abs(oEdge - edge) < 0.75) return o;
    }
    return null;
  };
  const left = barAt(it.x, 'L');
  const right = barAt(it.x + fpw, 'R');
  if (!left || !right) return null;
  return { topH: Math.max(left.h, right.h) };
}

/** Auto-manage applied ends: a finished end auto-applies on exposed run-end
 *  sides; any end treatment is cleared on sides that abut a neighbour (useless
 *  there). Items the user hand-set (endsAuto === false) keep their exposed-side
 *  choice. Run on the packed layout, then re-pack so the ends seat correctly. */
function autoEnds(design: Design): void {
  const marks = design.items.map((it) => {
    if (it.auto) return null;
    if (!takesAppliedEnds(catalogById(it.catalogId))) return null;
    return { it, left: sideExposed(design, it, 'left'), right: sideExposed(design, it, 'right') };
  });
  for (const m of marks) {
    if (!m) continue;
    const { it, left, right } = m;
    // Applied ends + waterfalls need an exposed side; clear them where a
    // neighbour abuts. Finished ends are always allowed, so leave them be.
    if (!left) { it.endL = false; it.waterfallL = false; }
    if (!right) { it.endR = false; it.waterfallR = false; }
    if (it.endsAuto !== false) {
      if (left && !it.finL && !it.waterfallL) it.endL = true;
      if (right && !it.finR && !it.waterfallR) it.endR = true;
    }
  }
}

function withPack(design: Design): Design {
  // pack real items first (auto-fillers are exempt trim and re-derived after)
  const next = { ...design, items: design.items.filter((it) => !it.auto).map((it) => ({ ...it })) };
  packAll(next);
  autoEnds(next); // apply/clear ends from the packed layout…
  packAll(next); // …then re-pack so applied ends seat correctly
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
      quoteOpen: false,
      retailPricingOpen: false,
      settingsOpen: false,
      appliancesOpen: false,
      myAppliancesOpen: false,
      handlesOpen: false,
      handles: [],
      alignerOpen: false,
      modelAligns: {},
      pricing: {},
      retailPricing: {},
      dims: {},
      appliances: [],
      applianceBrands: {},
      linerClearance: LINER_CABINET_CLEARANCE,
      panelRates: DEFAULT_PANEL_RATES,
      modelsReady: 0,
      snapshot3d: null,

      setTab: (tab) => set({ tab }),
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      setAppliancesOpen: (open) => set({ appliancesOpen: open }),
      setMyAppliancesOpen: (open) => set({ myAppliancesOpen: open }),
      setAppliances: (appliances) => set({ appliances }),
      setApplianceBrands: (applianceBrands) => set({ applianceBrands }),
      setLinerClearance: (linerClearance) => set({ linerClearance }),
      setPanelRates: (panelRates) => set({ panelRates }),
      setHandlesOpen: (open) => set({ handlesOpen: open }),
      setHandles: (handles) => set({ handles }),
      setAlignerOpen: (open) => set({ alignerOpen: open }),
      setModelAligns: (modelAligns) => set({ modelAligns }),
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
        // Bar-height cabinets need the open seating overhang, so they're island only.
        if (cat.barHeight && !wall.ghost) return false;
        const { minW } = effectiveDims(catalogId, s.dims);
        // find the largest opening (handles gaps next to pinned corner cabinets)
        const slot = openingFor(s.design, wallId, cat);
        if (slot.w < minW - 0.001) return false;
        // use the default width, or shrink to the largest that fits (≥ min)
        const w = Math.max(minW, Math.min(cat.w, Math.floor(slot.w * 4) / 4));
        // corner cabinets at the wall's far end chamfer toward the other side
        const isCornerCab = isCornerFront(cat);
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
          const items = s.design.items.map((it) => (it.id === id ? autoFourDoor({ ...it, ...patch }) : it));
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

      setCornerOverride: (key, o) =>
        set((s) => {
          const cur = { ...(s.design.cornerOverrides ?? {}) };
          if (o == null) delete cur[key];
          else cur[key] = o;
          return { design: withPack({ ...s.design, cornerOverrides: cur }) };
        }),

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

      addMeasurement: (m) => set((s) => ({ design: { ...s.design, measurements: [...(s.design.measurements ?? []), m] } })),
      updateMeasurement: (id, patch) =>
        set((s) => ({ design: { ...s.design, measurements: (s.design.measurements ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)) } })),
      removeMeasurement: (id) =>
        set((s) => ({ design: { ...s.design, measurements: (s.design.measurements ?? []).filter((m) => m.id !== id) } })),

      select: (id) => set({ selectedId: id }),
      openEditor: (id) => set({ editingId: id, selectedId: id }),
      openAdd: (wallId) => set({ addToWallId: wallId }),
      setPricingOpen: (open) => set({ pricingOpen: open }),
      setQuoteOpen: (open) => set({ quoteOpen: open }),
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
      newDesign: (kitchenType, line) =>
        set({ design: defaultDesign(kitchenType, line), selectedId: null, editingId: null, editingRoughInId: null, editingOpeningId: null, snapshot3d: null }),

      setLine: (line) =>
        set((s) => {
          if ((s.design.line ?? 'ext') === line) return s;
          // NewAge modular lines are outdoor products
          const kitchenType = line === 'ext' ? s.design.kitchenType : 'outdoor';
          const d = lineDefaults(line, kitchenType);
          // keep walls, openings & rough-ins; drop cabinets from the old line
          const items = s.design.items.filter((it) => !it.auto && (catalogById(it.catalogId).line ?? 'ext') === line);
          return {
            design: withPack({ ...s.design, line, kitchenType, finishId: d.finishId, counterId: d.counterId, doorStyle: d.doorStyle, items }),
            selectedId: null,
            editingId: null,
          };
        }),
      loadDesign: (design) =>
        set({ design: normalizeDesign(design), selectedId: null, editingId: null, editingRoughInId: null, editingOpeningId: null, snapshot3d: null }),
    }),
    {
      name: 'cabdesign-v1',
      // v3: NewAge lines merged into one ('newage') with per-item finish;
      // legacy na-ss-*/na-alu-* catalog ids remap in normalizeDesign.
      // v4: grill cabinets merged (out-grill4 → out-grill, doors from width).
      version: 4,
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
          // backfill fields added since the save (product line, kitchen type)
          if (!state.design.line) state.design.line = 'ext';
          if (!state.design.kitchenType) state.design.kitchenType = 'outdoor';
          state.design = withPack(state.design);
        }
      },
    }
  )
);
