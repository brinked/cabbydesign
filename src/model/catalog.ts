import type { ApplianceCat, CatalogItem, FinishOption } from './types';

export const BASE_H = 34.5;
/** Default countertop slab thickness (inches) — 3cm. Per-job override lives on
 *  Design.counterThickness; this is the fallback for older saves & 2D defaults. */
export const COUNTER_T = 1.25;
export const COUNTER_OVERHANG = 1;
export const TOEKICK_H = 4;

// Starboard ST color line. body = door color, panel = door color (one-piece
// HDPE), inner = groove/recess shade, counter = default countertop.
export const FINISHES: FinishOption[] = [
  { id: 'black', name: 'Black', body: '#131416', panel: '#131416', inner: '#060708', counter: '#e3e0da' },
  { id: 'mocha', name: 'Mocha Brown', body: '#40291c', panel: '#40291c', inner: '#311f15', counter: '#e3e0da' },
  { id: 'nutmeg', name: 'Nutmeg', body: '#8a7261', panel: '#8a7261', inner: '#735e4f', counter: '#e3e0da' },
  { id: 'tuscan', name: 'Tuscan', body: '#aa9d8d', panel: '#aa9d8d', inner: '#928574', counter: '#e3e0da' },
  { id: 'basil', name: 'Basil', body: '#5d6a5c', panel: '#5d6a5c', inner: '#4c584b', counter: '#e3e0da' },
  { id: 'indigo', name: 'Indigo', body: '#273b58', panel: '#273b58', inner: '#1e2f47', counter: '#e3e0da' },
  { id: 'charcoal', name: 'Charcoal Gray', body: '#4a4d53', panel: '#4a4d53', inner: '#3b3e43', counter: '#e3e0da' },
  { id: 'slate', name: 'Slate Gray', body: '#7a7173', panel: '#7a7173', inner: '#665e60', counter: '#e3e0da' },
  { id: 'dolphin', name: 'Dolphin Gray', body: '#c7c4c8', panel: '#c7c4c8', inner: '#b0adb2', counter: '#3b3f44' },
  { id: 'sanshade', name: 'Sanshade', body: '#e9ddc2', panel: '#e9ddc2', inner: '#d5c7a7', counter: '#3b3f44' },
  { id: 'seafoam', name: 'Seafoam', body: '#f2ecdb', panel: '#f2ecdb', inner: '#ded6bf', counter: '#3b3f44' },
  { id: 'white', name: 'White/White', body: '#f7f6f3', panel: '#f7f6f3', inner: '#e5e3de', counter: '#3b3f44' },
];

// Box formulas: width × depth + a fixed amount. The fixed amount is $500 for a
// plain box, plus $150 per top drawer and $200 per larger drawer baked in. So a
// 1-drawer cabinet = W*D + 650, a 3-drawer = W*D + 500+150+200+200 = W*D + 1050.
// Trays, applied panels and fillers price on top in code (see store.itemPrice).
const BOX = 'W*D + 500';
const DRAWER1 = 'W*D + 650'; // +1 top drawer
const DRAWER3 = 'W*D + 1050'; // top + 2 larger
const DRAWER4 = 'W*D + 1250'; // top + 3 larger
const GRILL4 = 'W*D + 600'; // box + $100 large-grill add-on
// Wall cabinets & the pedestal come in varying heights, so their box price
// scales with height off a 34" reference (price = (W*D + 900) * H/34).
const WALLBOX = '((W*D*1) + 900) * (H/34)';

/** Shown on every sink cabinet so the box is sized correctly for the basin. */
const SINK_NOTE = 'Sink cabinet should be 3" wider than the sink.';

export const CATALOG: CatalogItem[] = [
  // ---------- Standard base cabinets ----------
  { id: 'base-1door', name: '1-Door Base', category: 'base', front: 'door1', lane: 'floor', w: 18, d: 24, h: BASE_H, minW: 9, maxW: 24, stepW: 3, counter: true, formula: BOX, maxTrays: 2 },
  { id: 'base-2door', name: '2-Door Base', category: 'base', front: 'door2', lane: 'floor', w: 30, d: 24, h: BASE_H, minW: 24, maxW: 42, stepW: 3, counter: true, formula: BOX, maxTrays: 2 },
  { id: 'base-1door1drawer', name: '1-Door 1-Drawer Base', category: 'base', front: 'doordrawer', lane: 'floor', w: 18, d: 24, h: BASE_H, minW: 12, maxW: 24, stepW: 3, counter: true, formula: DRAWER1, maxTrays: 2 },
  { id: 'base-2door1drawer', name: '2-Door 1-Drawer Base', category: 'base', front: 'door2drawer', lane: 'floor', w: 30, d: 24, h: BASE_H, minW: 24, maxW: 42, stepW: 3, counter: true, formula: DRAWER1, maxTrays: 2 },
  { id: 'base-drawer3', name: '3-Drawer Base', category: 'base', front: 'drawers3', lane: 'floor', w: 18, d: 24, h: BASE_H, minW: 12, maxW: 36, stepW: 3, counter: true, formula: DRAWER3 },
  { id: 'base-drawer4', name: '4-Drawer Base', category: 'base', front: 'drawers4', lane: 'floor', w: 18, d: 24, h: BASE_H, minW: 12, maxW: 30, stepW: 3, counter: true, formula: DRAWER4 },
  { id: 'base-sink', name: '2-Door Sink Base (False Front)', category: 'base', front: 'sink', lane: 'floor', w: 33, d: 24, h: BASE_H, minW: 24, maxW: 42, stepW: 3, counter: true, formula: BOX, note: SINK_NOTE },
  { id: 'base-sink2', name: '2-Door Sink Base', category: 'base', front: 'sink2', lane: 'floor', w: 33, d: 24, h: BASE_H, minW: 24, maxW: 42, stepW: 3, counter: true, formula: BOX, note: SINK_NOTE },
  { id: 'base-sink1', name: '1-Door Sink Base', category: 'base', front: 'sink1', lane: 'floor', w: 18, d: 24, h: BASE_H, minW: 15, maxW: 24, stepW: 3, counter: true, formula: BOX, note: SINK_NOTE },
  { id: 'base-sink1f', name: '1-Door Sink Base (False Front)', category: 'base', front: 'sink1f', lane: 'floor', w: 18, d: 24, h: BASE_H, minW: 15, maxW: 24, stepW: 3, counter: true, formula: BOX, note: SINK_NOTE },
  { id: 'base-corner', name: 'Diagonal Corner Base', category: 'base', front: 'corner', lane: 'floor', w: 36, d: 36, h: BASE_H, minW: 33, maxW: 39, stepW: 3, minD: 33, maxD: 39, counter: true, formula: BOX },
  { id: 'base-susan', name: 'Lazy Susan (L-Shape)', category: 'base', front: 'susan', lane: 'floor', w: 36, d: 36, h: BASE_H, minW: 33, maxW: 39, stepW: 3, minD: 33, maxD: 39, counter: true, formula: BOX },
  { id: 'base-blindl', name: 'Left Blind Corner Base', category: 'base', front: 'blindl', lane: 'floor', w: 42, d: 24, h: BASE_H, minW: 39, maxW: 48, stepW: 3, counter: true, formula: BOX },
  { id: 'base-blindr', name: 'Right Blind Corner Base', category: 'base', front: 'blindr', lane: 'floor', w: 42, d: 24, h: BASE_H, minW: 39, maxW: 48, stepW: 3, counter: true, formula: BOX },
  { id: 'base-open', name: 'Open Shelf Base', category: 'base', front: 'open', lane: 'floor', w: 30, d: 24, h: BASE_H, minW: 18, maxW: 42, stepW: 3, counter: true, formula: BOX },
  { id: 'base-pedestal', name: 'Pedestal Cabinet', category: 'base', front: 'door2', lane: 'floor', w: 30, d: 24, h: 20, minW: 18, maxW: 42, stepW: 3, minH: 18, maxH: 34.5, counter: false, formula: WALLBOX, note: 'Short riser base — 20" tall by default (min 18").' },
  { id: 'base-trash', name: 'Trash Pull-Out', category: 'base', front: 'trash', lane: 'floor', w: 15, d: 24, h: BASE_H, minW: 15, maxW: 18, stepW: 3, counter: true, formula: BOX },
  { id: 'base-trashdrawer', name: 'Trash Pull-Out + Drawer', category: 'base', front: 'trashdrawer', lane: 'floor', w: 18, d: 24, h: BASE_H, minW: 15, maxW: 21, stepW: 3, counter: true, formula: DRAWER1 },

  // ---------- Wall cabinets ----------
  { id: 'wall-1door', name: '1-Door Wall', category: 'wall', front: 'door1', lane: 'upper', w: 15, d: 12, h: 30, minW: 9, maxW: 24, stepW: 3, counter: false, formula: WALLBOX, mount: 54 },
  { id: 'wall-2door', name: '2-Door Wall', category: 'wall', front: 'door2', lane: 'upper', w: 30, d: 12, h: 30, minW: 24, maxW: 42, stepW: 3, counter: false, formula: WALLBOX, mount: 54 },
  { id: 'wall-open', name: 'Open Shelf Wall', category: 'wall', front: 'open', lane: 'upper', w: 30, d: 12, h: 30, minW: 18, maxW: 36, stepW: 3, counter: false, formula: WALLBOX, mount: 54 },
  { id: 'wall-corner', name: 'Diagonal Corner Wall', category: 'wall', front: 'corner', lane: 'upper', w: 24, d: 24, h: 30, minW: 24, maxW: 30, stepW: 3, minD: 21, maxD: 27, counter: false, formula: WALLBOX, mount: 54 },
  { id: 'wall-susan', name: 'Lazy Susan Wall (L-Shape)', category: 'wall', front: 'susan', lane: 'upper', w: 24, d: 24, h: 30, minW: 24, maxW: 30, stepW: 3, minD: 21, maxD: 27, counter: false, formula: WALLBOX, mount: 54 },

  // ---------- Tall cabinets ----------
  { id: 'tall-pantry', name: 'Pantry', category: 'tall', front: 'pantry', lane: 'floor', w: 24, d: 24, h: 84, minW: 18, maxW: 36, stepW: 3, counter: false, formula: BOX },
  { id: 'tall-2door', name: '2-Door Tall', category: 'tall', front: 'door2', lane: 'floor', w: 30, d: 24, h: 84, minW: 24, maxW: 36, stepW: 3, counter: false, formula: BOX },
  { id: 'tall-broom', name: 'Utility / Broom', category: 'tall', front: 'door1', lane: 'floor', w: 18, d: 12, h: 84, minW: 18, maxW: 24, stepW: 3, counter: false, formula: BOX },
  { id: 'tall-appliance', name: 'Built-In Oven/Microwave Cabinet', category: 'tall', front: 'applianceoven', lane: 'floor', w: 33, d: 24, h: 84, minW: 30, maxW: 36, stepW: 3, minH: 78, maxH: 96, counter: false, formula: BOX, note: 'Bottom drawer, oven/microwave opening, top doors.' },
  { id: 'tall-fridge', name: 'Built-In Refrigerator Cabinet', category: 'tall', front: 'fridgetall', lane: 'floor', w: 36, d: 24, h: 84, minW: 30, maxW: 48, stepW: 3, minH: 78, maxH: 96, counter: false, formula: BOX, note: '2 doors over a built-in refrigerator opening.' },

  // ---------- Outdoor kitchen cabinets ----------
  // Grill/griddle cabinets: the appliance sets INTO the cabinet (recessed face
  // + apron + doors); the countertop does not run over them.
  { id: 'out-grill', name: 'Grill Cabinet', category: 'outdoor', front: 'grill', lane: 'floor', w: 36, d: 27, h: BASE_H, minW: 30, maxW: 48, stepW: 2, counter: false, topGearH: 12, formula: BOX, applianceCat: 'grill' },
  { id: 'out-grill4', name: 'Large Grill Cabinet (4-Door)', category: 'outdoor', front: 'grill4', lane: 'floor', w: 48, d: 30, h: BASE_H, minW: 40, maxW: 60, stepW: 2, counter: false, topGearH: 12, formula: GRILL4, applianceCat: 'grill' },
  { id: 'out-griddle', name: 'Griddle Cabinet', category: 'outdoor', front: 'griddle', lane: 'floor', w: 36, d: 27, h: BASE_H, minW: 30, maxW: 48, stepW: 2, counter: false, topGearH: 6, formula: BOX, applianceCat: 'griddle' },
  { id: 'out-burner', name: 'Side Burner Cabinet', category: 'outdoor', front: 'burner', lane: 'floor', w: 18, d: 27, h: BASE_H, minW: 15, maxW: 24, stepW: 3, counter: false, topGearH: 6, formula: BOX, applianceCat: 'sideburner' },
  { id: 'out-power', name: 'Power Burner Cabinet', category: 'outdoor', front: 'burner', lane: 'floor', w: 24, d: 27, h: BASE_H, minW: 18, maxW: 30, stepW: 3, counter: false, topGearH: 6, formula: BOX, applianceCat: 'powerburner' },
  { id: 'out-propane', name: 'Propane Pull-Out', category: 'outdoor', front: 'propane', lane: 'floor', w: 18, d: 24, h: BASE_H, minW: 15, maxW: 24, stepW: 3, counter: true, formula: BOX },
  { id: 'out-propanedrawer', name: 'Propane Pull-Out + Drawer', category: 'outdoor', front: 'propanedrawer', lane: 'floor', w: 18, d: 24, h: BASE_H, minW: 15, maxW: 24, stepW: 3, counter: true, formula: DRAWER1 },
  // Fridge / ice-maker "openings" are just spaces sized to the appliance — no
  // cabinet box charge (formula '0'); only the selected appliance is priced.
  { id: 'out-fridge', name: 'Refrigerator (1-Door)', category: 'outdoor', front: 'fridge', lane: 'floor', w: 24, d: 27, h: BASE_H, minW: 12, maxW: 48, stepW: 1, counter: true, formula: '0', applianceCat: 'fridge' },
  { id: 'out-fridge2', name: 'Refrigerator (2-Drawer)', category: 'outdoor', front: 'fridge2', lane: 'floor', w: 24, d: 27, h: BASE_H, minW: 12, maxW: 48, stepW: 1, counter: true, formula: '0', applianceCat: 'fridge' },
  { id: 'out-fridgep', name: 'Panel-Ready Refrigerator (1-Door)', category: 'outdoor', front: 'fridgep', lane: 'floor', w: 24, d: 27, h: BASE_H, minW: 12, maxW: 48, stepW: 1, counter: true, formula: '0', applianceCat: 'fridge' },
  { id: 'out-fridgep2', name: 'Panel-Ready Refrigerator (2-Drawer)', category: 'outdoor', front: 'fridgep2', lane: 'floor', w: 24, d: 27, h: BASE_H, minW: 12, maxW: 48, stepW: 1, counter: true, formula: '0', applianceCat: 'fridge' },
  { id: 'out-kamado', name: 'Kamado Cabinet', category: 'outdoor', front: 'kamado', lane: 'floor', w: 36, d: 30, h: BASE_H, minW: 30, maxW: 42, stepW: 2, counter: true, topGearH: 26, formula: BOX, applianceCat: 'kamado' },
  { id: 'out-kamado-builtin', name: 'Built-In Kamado Cabinet', category: 'outdoor', front: 'kamadoinsert', lane: 'floor', w: 36, d: 30, h: BASE_H, minW: 30, maxW: 42, stepW: 2, counter: false, topGearH: 13, formula: BOX, applianceCat: 'kamado', note: 'Open 12" top compartment the kamado drops into.' },
  { id: 'out-icemaker', name: 'Ice Maker', category: 'outdoor', front: 'icemaker', lane: 'floor', w: 15, d: 24, h: BASE_H, minW: 12, maxW: 30, stepW: 1, counter: true, formula: '0', applianceCat: 'icemaker' },
  { id: 'out-sink', name: 'Outdoor Sink Cabinet', category: 'outdoor', front: 'sink', lane: 'floor', w: 30, d: 24, h: BASE_H, minW: 24, maxW: 36, stepW: 3, counter: true, formula: BOX, note: SINK_NOTE },

  // ---------- Fillers & trim ----------
  // Fillers are shallow (4" deep) and auto-outset to align flush with the
  // adjacent cabinet's front face (see store.alignFillers).
  { id: 'trim-basefiller', name: 'Base Filler', category: 'trim', front: 'filler', lane: 'floor', w: 3, d: 4, h: BASE_H, minW: 1, maxW: 8, stepW: 1, minD: 2, maxD: 6, counter: true, formula: '0', perInch: 10 },
  { id: 'trim-wallfiller', name: 'Wall Filler', category: 'trim', front: 'filler', lane: 'upper', w: 3, d: 4, h: 30, minW: 1, maxW: 8, stepW: 1, minD: 2, maxD: 6, counter: false, formula: '0', perInch: 10, mount: 54 },
  { id: 'trim-endcap', name: 'End-Cap Support Cabinet', category: 'trim', front: 'endcap', lane: 'floor', w: 6, d: 24, h: BASE_H, minW: 3, maxW: 12, stepW: 1, counter: true, formula: BOX },

  // ---------- Freestanding appliances (visual) ----------
  { id: 'app-cartgrill', name: 'Freestanding Grill', category: 'appliance', front: 'cartgrill', lane: 'floor', w: 52, d: 26, h: 48, minW: 42, maxW: 64, stepW: 2, counter: false, formula: '0' },
  { id: 'app-dishwasher', name: 'Dishwasher', category: 'appliance', front: 'dishwasher', lane: 'floor', w: 24, d: 24, h: BASE_H, minW: 18, maxW: 24, stepW: 3, counter: false, formula: '0' },
  { id: 'app-kamado', name: 'Kamado on Cart', category: 'appliance', front: 'kamado', lane: 'floor', w: 32, d: 30, h: 48, minW: 28, maxW: 36, stepW: 2, counter: false, formula: '0' },
  { id: 'app-pizza', name: 'Pizza Oven Cart', category: 'appliance', front: 'pizza', lane: 'floor', w: 36, d: 30, h: 64, minW: 30, maxW: 42, stepW: 2, counter: false, formula: '0' },
];

export const CATEGORY_LABELS: Record<string, string> = {
  base: 'Base Cabinets',
  wall: 'Wall Cabinets',
  tall: 'Tall Cabinets',
  outdoor: 'Outdoor Kitchen',
  trim: 'Fillers & Trim',
  appliance: 'Appliances',
};

/** Per-item option costs. (Drawer costs are baked into the box formulas.) */
export const DEFAULT_RATES = {
  tray: 159,
};

export function catalogById(id: string): CatalogItem {
  const c = CATALOG.find((c) => c.id === id);
  if (!c) throw new Error(`Unknown catalog id ${id}`);
  return c;
}

/** Appliance openings — fridges and ice makers are appliances (spaces sized to
 *  the unit), not cabinets, so they can't take applied end panels. */
const APPLIANCE_OPENING_CATS: ApplianceCat[] = ['fridge', 'icemaker'];

/** Whether an item can take applied end panels. Appliances (e.g. freestanding
 *  grill, dishwasher) and appliance openings (fridges, ice makers) cannot;
 *  real cabinets — including grill/griddle/burner/kamado cabinets — can. */
export function takesAppliedEnds(cat: CatalogItem): boolean {
  if (cat.category === 'appliance') return false;
  if (cat.applianceCat && APPLIANCE_OPENING_CATS.includes(cat.applianceCat)) return false;
  return true;
}
