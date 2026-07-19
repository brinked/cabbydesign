import type { ApplianceCat, CatalogItem, DoorStyle, FinishOption, KitchenType, ProductLine } from './types';
import { NEWAGE_CATALOG, NEWAGE_FINISHES } from './newage';

export const BASE_H = 34.5;
/** Bar-height feature: the raised back tier steps up this many inches above the
 *  main body and adds this much depth (its own stone bar top). The bar top
 *  overhangs the back (seating) side by BAR_OVERHANG — an island feature. */
export const BAR_RISE = 6;
export const BAR_DEPTH = 4.5;
export const BAR_OVERHANG = 10;
/** Bar top nose past the step, toward the working counter. */
export const BAR_NOSE = 1;
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
  { id: 'indigo', name: 'Indigo Blue', body: '#273b58', panel: '#273b58', inner: '#1e2f47', counter: '#e3e0da' },
  { id: 'charcoal', name: 'Charcoal Gray', body: '#4a4d53', panel: '#4a4d53', inner: '#3b3e43', counter: '#e3e0da' },
  { id: 'slate', name: 'Slate Gray', body: '#7a7173', panel: '#7a7173', inner: '#665e60', counter: '#e3e0da' },
  { id: 'dolphin', name: 'Dolphin Gray', body: '#c7c4c8', panel: '#c7c4c8', inner: '#b0adb2', counter: '#3b3f44' },
  { id: 'sanshade', name: 'Sanshade', body: '#e9ddc2', panel: '#e9ddc2', inner: '#d5c7a7', counter: '#3b3f44' },
  { id: 'seafoam', name: 'Seafoam', body: '#f2ecdb', panel: '#f2ecdb', inner: '#ded6bf', counter: '#3b3f44' },
  { id: 'white', name: 'White/White', body: '#f7f6f3', panel: '#f7f6f3', inner: '#e5e3de', counter: '#3b3f44' },
];

// Indoor cabinet colors & finishes: painted + wood-stained (satin lacquer).
// inner = the recessed door-panel shade (slightly darker than the face).
export const INDOOR_FINISHES: FinishOption[] = [
  { id: 'in-white', name: 'White', group: 'Painted', body: '#f6f5f1', panel: '#f6f5f1', inner: '#e6e4de', counter: '#3b3f44' },
  { id: 'in-cream', name: 'Cream', group: 'Painted', body: '#efe7d6', panel: '#efe7d6', inner: '#ded4bf', counter: '#3b3f44' },
  { id: 'in-lightgray', name: 'Light Gray', group: 'Painted', body: '#d3d6da', panel: '#d3d6da', inner: '#c1c5ca', counter: '#3b3f44' },
  { id: 'in-gray', name: 'Storm Gray', group: 'Painted', body: '#9aa0a7', panel: '#9aa0a7', inner: '#878d95', counter: '#e3e0da' },
  { id: 'in-charcoal', name: 'Charcoal', group: 'Painted', body: '#4a4e54', panel: '#4a4e54', inner: '#3c4046', counter: '#e3e0da' },
  { id: 'in-navy', name: 'Navy Blue', group: 'Painted', body: '#2c3a54', panel: '#2c3a54', inner: '#232f45', counter: '#e3e0da' },
  { id: 'in-sage', name: 'Sage Green', group: 'Painted', body: '#97a48b', panel: '#97a48b', inner: '#849178', counter: '#e3e0da' },
  { id: 'in-forest', name: 'Forest Green', group: 'Painted', body: '#3e4f42', panel: '#3e4f42', inner: '#324136', counter: '#e3e0da' },
  { id: 'in-black', name: 'Matte Black', group: 'Painted', body: '#25272b', panel: '#25272b', inner: '#191b1e', counter: '#e3e0da' },
  { id: 'in-whiteoak', name: 'White Oak', group: 'Wood Stains', body: '#d8c5a3', panel: '#d8c5a3', inner: '#c6b28d', counter: '#3b3f44', wood: true },
  { id: 'in-oak', name: 'Natural Oak', group: 'Wood Stains', body: '#c8a577', panel: '#c8a577', inner: '#b49164', counter: '#3b3f44', wood: true },
  { id: 'in-maple', name: 'Honey Maple', group: 'Wood Stains', body: '#d6af78', panel: '#d6af78', inner: '#c39a62', counter: '#3b3f44', wood: true },
  { id: 'in-cherry', name: 'Cherry', group: 'Wood Stains', body: '#8e4a30', panel: '#8e4a30', inner: '#7a3c26', counter: '#e3e0da', wood: true },
  { id: 'in-walnut', name: 'Walnut', group: 'Wood Stains', body: '#5e4632', panel: '#5e4632', inner: '#4d3928', counter: '#e3e0da', wood: true },
  { id: 'in-espresso', name: 'Espresso', group: 'Wood Stains', body: '#392c23', panel: '#392c23', inner: '#2c211a', counter: '#e3e0da', wood: true },
];

/** Every finish across all product lines (EXT HDPE + indoor + NewAge lines). */
export const ALL_FINISHES: FinishOption[] = [...FINISHES, ...INDOOR_FINISHES, ...NEWAGE_FINISHES];

/** Finishes offered for a product line (+ kitchen type: indoor EXT kitchens
 *  use the painted/wood palette; outdoor keeps the Starboard HDPE colors). */
export function finishesForLine(line: ProductLine | undefined, kitchenType?: KitchenType): FinishOption[] {
  const l = line ?? 'ext';
  if (l === 'ext') return kitchenType === 'indoor' ? INDOOR_FINISHES : FINISHES;
  return NEWAGE_FINISHES.filter((f) => f.line === l);
}

/** Door styles offered per kitchen type, with display labels. The routed
 *  groove "shaker" is the outdoor HDPE construction; indoor wood cabinets get
 *  real 5-piece styles. */
export const DOOR_STYLE_LABELS: Record<DoorStyle, string> = {
  'shaker': 'Shaker (groove)',
  'flat': 'Slab / Euro Flat',
  'shaker-inset': 'Shaker',
  'shaker-skinny': 'Skinny Shaker',
  'raised': 'Raised Panel',
  'beadboard': 'Beadboard',
};

export function doorStylesFor(kitchenType: KitchenType | undefined): DoorStyle[] {
  return (kitchenType ?? 'outdoor') === 'indoor'
    ? ['shaker-inset', 'shaker-skinny', 'raised', 'beadboard', 'flat']
    : ['shaker', 'flat'];
}

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

const BASE_CATALOG: CatalogItem[] = [
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
  { id: 'base-cooktop', name: 'Cooktop Base', category: 'base', front: 'cooktop', lane: 'floor', w: 33, d: 24, h: BASE_H, minW: 24, maxW: 42, stepW: 3, counter: true, topGearH: 1, formula: BOX, note: 'False front + doors, built to carry a drop-in cooktop. Cooktop should be narrower than the cabinet.' },
  { id: 'base-corner', name: 'Diagonal Corner Base', category: 'base', front: 'corner', lane: 'floor', w: 36, d: 36, h: BASE_H, minW: 33, maxW: 39, stepW: 3, minD: 33, maxD: 39, counter: true, formula: BOX },
  { id: 'base-susan', name: 'Lazy Susan (L-Shape)', category: 'base', front: 'susan', lane: 'floor', w: 36, d: 36, h: BASE_H, minW: 33, maxW: 39, stepW: 3, minD: 33, maxD: 39, counter: true, formula: BOX },
  { id: 'base-blindl', name: 'Left Blind Corner Base', category: 'base', front: 'blindl', lane: 'floor', w: 42, d: 24, h: BASE_H, minW: 39, maxW: 48, stepW: 3, counter: true, formula: BOX },
  { id: 'base-blindr', name: 'Right Blind Corner Base', category: 'base', front: 'blindr', lane: 'floor', w: 42, d: 24, h: BASE_H, minW: 39, maxW: 48, stepW: 3, counter: true, formula: BOX },
  { id: 'base-open', name: 'Open Shelf Base', category: 'base', front: 'open', lane: 'floor', w: 30, d: 24, h: BASE_H, minW: 18, maxW: 42, stepW: 3, counter: true, formula: BOX },
  { id: 'base-pedestal', name: 'Pedestal Cabinet', category: 'base', front: 'door2', lane: 'floor', w: 30, d: 24, h: 20, minW: 18, maxW: 42, stepW: 3, minH: 18, maxH: 34.5, counter: true, formula: WALLBOX, note: 'Short riser base — 20" tall by default (min 18").' },
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
  // + apron + doors); the countertop does not run over them. Only the 2-door
  // versions appear in the Add picker — widening one past 41" auto-converts it
  // to the 4-door version (and back). See store.autoFourDoor / FOUR_DOOR_AT.
  { id: 'out-grill', name: 'Grill Cabinet', category: 'outdoor', front: 'grill', lane: 'floor', w: 36, d: 27, h: BASE_H, minW: 30, maxW: 48, stepW: 2, counter: true, topGearH: 12, formula: BOX, applianceCat: 'grill', note: 'Over 41″ wide it becomes the 4-door version automatically.' },
  { id: 'out-grill4', name: 'Large Grill Cabinet (4-Door)', category: 'outdoor', front: 'grill4', lane: 'floor', w: 48, d: 30, h: BASE_H, minW: 40, maxW: 60, stepW: 2, counter: true, topGearH: 12, formula: GRILL4, applianceCat: 'grill', hideFromAdd: true, note: 'At 41″ or under it becomes the 2-door version automatically.' },
  { id: 'out-griddle', name: 'Griddle Cabinet', category: 'outdoor', front: 'griddle', lane: 'floor', w: 36, d: 27, h: BASE_H, minW: 30, maxW: 48, stepW: 2, counter: true, topGearH: 6, formula: BOX, applianceCat: 'griddle', note: 'Over 41″ wide it becomes the 4-door version automatically.' },
  { id: 'out-griddle4', name: 'Large Griddle Cabinet (4-Door)', category: 'outdoor', front: 'griddle4', lane: 'floor', w: 48, d: 27, h: BASE_H, minW: 40, maxW: 60, stepW: 2, counter: true, topGearH: 6, formula: GRILL4, applianceCat: 'griddle', hideFromAdd: true, note: 'At 41″ or under it becomes the 2-door version automatically.' },
  { id: 'out-burner', name: 'Side Burner Cabinet', category: 'outdoor', front: 'burner', lane: 'floor', w: 18, d: 27, h: BASE_H, minW: 15, maxW: 24, stepW: 3, counter: true, topGearH: 6, formula: BOX, applianceCat: 'sideburner' },
  { id: 'out-power', name: 'Power Burner Cabinet', category: 'outdoor', front: 'burner', lane: 'floor', w: 24, d: 27, h: BASE_H, minW: 18, maxW: 30, stepW: 3, counter: true, topGearH: 6, formula: BOX, applianceCat: 'powerburner' },
  { id: 'out-propane', name: 'Propane Pull-Out', category: 'outdoor', front: 'propane', lane: 'floor', w: 18, d: 24, h: BASE_H, minW: 15, maxW: 24, stepW: 3, counter: true, formula: BOX },
  { id: 'out-propanedrawer', name: 'Propane Pull-Out + Drawer', category: 'outdoor', front: 'propanedrawer', lane: 'floor', w: 18, d: 24, h: BASE_H, minW: 15, maxW: 24, stepW: 3, counter: true, formula: DRAWER1 },
  // Fridge / ice-maker "openings" are just spaces sized to the appliance — no
  // cabinet box charge (formula '0'); only the selected appliance is priced.
  { id: 'out-fridge', displayCategory: 'appliance', name: 'Refrigerator (1-Door)', category: 'outdoor', front: 'fridge', lane: 'floor', w: 24, d: 27, h: BASE_H, minW: 12, maxW: 48, stepW: 1, counter: true, formula: '0', applianceCat: 'fridge' },
  { id: 'out-fridge2', displayCategory: 'appliance', name: 'Refrigerator (2-Drawer)', category: 'outdoor', front: 'fridge2', lane: 'floor', w: 24, d: 27, h: BASE_H, minW: 12, maxW: 48, stepW: 1, counter: true, formula: '0', applianceCat: 'fridge' },
  { id: 'out-fridgep', displayCategory: 'appliance', name: 'Panel-Ready Refrigerator (1-Door)', category: 'outdoor', front: 'fridgep', lane: 'floor', w: 24, d: 27, h: BASE_H, minW: 12, maxW: 48, stepW: 1, counter: true, formula: '0', applianceCat: 'fridge' },
  { id: 'out-fridgep2', displayCategory: 'appliance', name: 'Panel-Ready Refrigerator (2-Drawer)', category: 'outdoor', front: 'fridgep2', lane: 'floor', w: 24, d: 27, h: BASE_H, minW: 12, maxW: 48, stepW: 1, counter: true, formula: '0', applianceCat: 'fridge' },
  { id: 'out-kamado', name: 'Kamado Cabinet', category: 'outdoor', front: 'kamado', lane: 'floor', w: 36, d: 30, h: BASE_H, minW: 30, maxW: 42, stepW: 2, counter: true, topGearH: 26, formula: BOX, applianceCat: 'kamado' },
  { id: 'out-kamado-builtin', name: 'Built-In Kamado Cabinet', category: 'outdoor', front: 'kamadoinsert', lane: 'floor', w: 36, d: 30, h: BASE_H, minW: 30, maxW: 42, stepW: 2, counter: true, topGearH: 13, formula: BOX, applianceCat: 'kamado', note: 'Open 12" top compartment the kamado drops into. The counter runs across with a cut-out over the opening.' },
  { id: 'out-icemaker', name: 'Ice Maker', category: 'outdoor', front: 'icemaker', lane: 'floor', w: 15, d: 24, h: BASE_H, minW: 12, maxW: 30, stepW: 1, counter: true, formula: '0', applianceCat: 'icemaker' },
  { id: 'out-sink', name: 'Outdoor Sink Cabinet', category: 'outdoor', front: 'sink', lane: 'floor', w: 30, d: 24, h: BASE_H, minW: 24, maxW: 36, stepW: 3, counter: true, formula: BOX, note: SINK_NOTE },
  { id: 'out-hood', displayCategory: 'appliance', name: 'Range Hood', category: 'outdoor', front: 'hood', lane: 'upper', w: 48, d: 24, h: 24, minW: 24, maxW: 72, stepW: 1, minD: 18, maxD: 30, minH: 12, maxH: 48, counter: false, formula: '0', mount: 66, applianceCat: 'hood', note: 'Wall-mounted vent hood — pick a hood model to size it automatically.' },

  // ---------- Fillers & trim ----------
  // Fillers are shallow (4" deep) and auto-outset to align flush with the
  // adjacent cabinet's front face (see store.alignFillers).
  { id: 'trim-basefiller', name: 'Base Filler', category: 'trim', front: 'filler', lane: 'floor', w: 3, d: 4, h: BASE_H, minW: 1, maxW: 8, stepW: 1, minD: 2, maxD: 6, counter: true, formula: '0', perInch: 10 },
  { id: 'trim-wallfiller', name: 'Wall Filler', category: 'trim', front: 'filler', lane: 'upper', w: 3, d: 4, h: 30, minW: 1, maxW: 8, stepW: 1, minD: 2, maxD: 6, counter: false, formula: '0', perInch: 10, mount: 54 },
  { id: 'trim-endcap', name: 'End-Cap Support Cabinet', category: 'trim', front: 'endcap', lane: 'floor', w: 6, d: 24, h: BASE_H, minW: 3, maxW: 12, stepW: 1, counter: true, formula: BOX },

  // ---------- Freestanding appliances (visual) ----------
  { id: 'app-cartgrill', name: 'Freestanding Grill', category: 'appliance', front: 'cartgrill', lane: 'floor', w: 52, d: 26, h: 48, minW: 42, maxW: 64, stepW: 2, counter: false, formula: '0', hideFromAdd: true },
  { id: 'app-dishwasher', name: 'Dishwasher', category: 'appliance', front: 'dishwasher', lane: 'floor', w: 24, d: 24, h: BASE_H, minW: 18, maxW: 24, stepW: 3, counter: false, formula: '0', hideFromAdd: true },
  { id: 'app-range', name: 'Range / Stove with Oven', category: 'appliance', front: 'range', lane: 'floor', w: 30, d: 27, h: 36, minW: 30, maxW: 36, stepW: 6, counter: false, topGearH: 1, formula: '0', note: 'Freestanding range — cooktop up top, oven below.' },
  { id: 'app-kamado', name: 'Kamado on Cart', category: 'appliance', front: 'kamado', lane: 'floor', w: 32, d: 30, h: 48, minW: 28, maxW: 36, stepW: 2, counter: false, formula: '0', hideFromAdd: true },
  { id: 'app-pizza', name: 'Pizza Oven Cart', category: 'appliance', front: 'pizza', lane: 'floor', w: 36, d: 30, h: 64, minW: 30, maxW: 42, stepW: 2, counter: false, formula: '0', hideFromAdd: true },

  // ---------- NewAge Products modular lines (fixed factory sizes) ----------
  ...NEWAGE_CATALOG,
];

// Fronts that get an auto-generated bar-height variant: plain floor cabinets
// (doors/drawers/sink/trash/open). Corners, blinds, lazy-susans, fillers and the
// drop-in appliance cabinets (grill/griddle/burner/kamado/fridge) are excluded —
// their carcass or counter geometry doesn't fit the simple raised-bar tier.
const BAR_FRONTS = new Set([
  'door1', 'door2', 'doordrawer', 'door2drawer', 'drawers3', 'drawers4',
  'sink', 'sink2', 'sink1', 'sink1f', 'open', 'trash', 'trashdrawer',
  'propane', 'propanedrawer',
]);

/** A bar-height twin of a floor cabinet: +BAR_DEPTH deep, its own 'bar' section. */
function barVariant(c: CatalogItem): CatalogItem {
  return {
    ...c,
    id: `${c.id}-bar`,
    name: `${c.name} — Bar`,
    displayCategory: 'bar',
    d: c.d + BAR_DEPTH,
    barHeight: true,
    hideFromAdd: false,
    note: 'Bar height: raised bar back (+6″) with a 10″ seating overhang. Islands only.',
  };
}

export const CATALOG: CatalogItem[] = [
  ...BASE_CATALOG,
  ...BASE_CATALOG.filter(
    // No bar twins for NewAge modular units — factory-fixed sizes can't grow the bar tier.
    (c) => c.lane === 'floor' && (c.category === 'base' || c.category === 'outdoor') && !c.hideFromAdd && !c.barHeight && !c.line && !c.fixed && BAR_FRONTS.has(c.front),
  ).map(barVariant),
];

export const CATEGORY_LABELS: Record<string, string> = {
  base: 'Base Cabinets',
  wall: 'Wall Cabinets',
  tall: 'Tall Cabinets',
  outdoor: 'Outdoor Kitchen',
  bar: 'Bar Height',
  trim: 'Fillers & Trim',
  appliance: 'Appliances',
};

/** Category tab labels for the NewAge lines (their catalog is smaller). */
export const NEWAGE_CATEGORY_LABELS: Record<string, string> = {
  base: 'Cabinets',
  outdoor: 'Grill, Corner & Specialty',
  wall: 'Wall Cabinets',
};

/** Freestanding EXT appliance carts that only make sense outdoors. */
const OUTDOOR_ONLY_APPLIANCES = new Set(['app-cartgrill', 'app-kamado', 'app-pizza']);
/** Indoor-kitchen items hidden from outdoor designs. */
const INDOOR_ONLY = new Set(['base-cooktop', 'app-range']);

/**
 * The catalog offered for a design: its product line's items, and for indoor
 * EXT kitchens the outdoor-only categories/carts are hidden (and vice versa).
 */
export function catalogForDesign(line: ProductLine | undefined, kitchenType: KitchenType | undefined): CatalogItem[] {
  const l = line ?? 'ext';
  if (l !== 'ext') return CATALOG.filter((c) => c.line === l);
  const items = CATALOG.filter((c) => !c.line);
  if ((kitchenType ?? 'outdoor') === 'indoor') {
    // The vent hood is the one 'outdoor' item indoor kitchens also need (over a range/cooktop).
    return items.filter((c) => (c.category !== 'outdoor' || c.id === 'out-hood') && !OUTDOOR_ONLY_APPLIANCES.has(c.id));
  }
  return items.filter((c) => !INDOOR_ONLY.has(c.id));
}

/** Category tab labels applicable to a product line. */
export function categoryLabelsForLine(line: ProductLine | undefined): Record<string, string> {
  return (line ?? 'ext') === 'ext' ? CATEGORY_LABELS : NEWAGE_CATEGORY_LABELS;
}

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
const APPLIANCE_OPENING_CATS: ApplianceCat[] = ['fridge', 'icemaker', 'hood'];

/** True when a continuous countertop covers this unit: counter cabinets, plus
 *  under-counter appliances (a dishwasher) the counter bridges over. */
export function bridgesCounter(cat: CatalogItem): boolean {
  return cat.counter || cat.underCounter === true;
}

/** Whether an item can take applied end panels. Appliances (e.g. freestanding
 *  grill, dishwasher) and appliance openings (fridges, ice makers) cannot;
 *  real cabinets — including grill/griddle/burner/kamado cabinets — can. */
export function takesAppliedEnds(cat: CatalogItem): boolean {
  if (cat.category === 'appliance') return false;
  if (cat.line) return false; // NewAge metal units are factory-finished on all sides
  if (cat.applianceCat && APPLIANCE_OPENING_CATS.includes(cat.applianceCat)) return false;
  return true;
}

/** Whether an item can take a waterfall counter edge: counter-topped floor
 *  cabinets, excluding appliance openings (fridges, ice makers) — a waterfall
 *  needs a real cabinet side to wrap. */
export function takesWaterfall(cat: CatalogItem): boolean {
  // Bar-height cabinets step up at the back, so a waterfall edge doesn't apply.
  return cat.counter && cat.lane === 'floor' && !cat.barHeight && takesAppliedEnds(cat);
}

/** How many door/drawer pulls (handles) a cabinet front needs. Open shelving,
 *  fillers, false fronts and appliance openings have none. Two-door fronts use
 *  a single door under 24″ wide. Used for the report hardware count. */
export function handleCount(cat: CatalogItem, w: number): number {
  if (cat.line) return 0; // NewAge units ship with integrated handles
  const doublable = w >= 24 ? 2 : 1; // wide cabinets get a pair of doors
  switch (cat.front) {
    case 'door1':
      return 1;
    case 'door2':
    case 'kamado':
    case 'kamadoinsert':
    case 'burner':
    case 'cooktop': // false front carries no pull
      return doublable;
    case 'grill':
    case 'griddle':
      return doublable;
    case 'grill4':
    case 'griddle4':
      return 4;
    case 'drawers3':
      return 3;
    case 'drawers4':
      return 4;
    case 'doordrawer':
      return 2;
    case 'door2drawer':
      return doublable + 1;
    case 'applianceoven':
      return doublable + 1;
    case 'sink':
    case 'sink2':
      return 2; // false front carries no pull
    case 'sink1':
    case 'sink1f':
    case 'fridgep':
    case 'propane':
    case 'trash':
    case 'flipup':
    case 'corner':
    case 'susan':
    case 'blind':
    case 'blindl':
    case 'blindr':
      return 1;
    case 'fridgetall':
    case 'fridgep2':
    case 'trashdrawer':
    case 'propanedrawer':
      return 2;
    default:
      // open, endcap, filler, fridge, fridge2, icemaker, pizza, cartgrill, dishwasher
      return 0;
  }
}
