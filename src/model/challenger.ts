// Challenger Designs — "Custom Kitchens" modular outdoor line (all-aluminum,
// powder-coated, shipped assembled; Nappanee, Indiana).
//
// Source: the manufacturer's 2026 Outdoor Kitchen catalog (effective
// 2026-08-01) and website, challengerdesignsllc.com. The full research, with a
// source URL per row and the list of open questions, is in
// data/challenger-source.md. Rules followed here:
//
//   · Sizes are the catalog's: widths in fixed 3″ steps, 28″ deep, 35″ high on
//     the standard 4″ legs. Height/depth come from the SKU code
//     (ODB-243528 = 24 W × 35 H × 28 D), which the catalog confirms wherever it
//     prints full dimensions.
//   · PRICES ARE NOT PUBLISHED by the manufacturer (public catalogs have the
//     price column removed), so no cabinet here carries one — every line shows
//     as "quote" until a dealer price sheet is loaded. Nothing is estimated.
//   · Swatch colours are sampled from the manufacturer's swatch photos; they
//     publish no hex or RAL values.
//   · Units whose footprint or front is not published (angled inside corner,
//     outside angle base, vented base, peninsula, ADA sink, appliance-specific
//     Evo/Memphis bases, pizza oven) are left out rather than guessed — see
//     NOT_YET_MODELLED at the bottom.

import type { Brand, CatalogItem, Category, FinishOption, FrontKind } from './types';

const CH_H = 35;
const CH_D = 28;

const fin = (id: string, name: string, hex: string, inner = '#1f1f20'): FinishOption => ({
  id,
  name,
  line: 'challenger',
  group: 'Powder-coated aluminum',
  body: hex,
  panel: hex,
  inner,
  counter: '#b3b3b2',
  kick: '#8f9296', // stainless adjustable legs
});

/** Standard cabinet colours (custom RAL colours are a factory option). */
export const CHALLENGER_FINISHES: FinishOption[] = [
  fin('ch-anthracite', 'Anthracite', '#4E5A66'),
  fin('ch-cappuccino', 'Cappuccino', '#8A7D6C'),
  fin('ch-gray-glimmer', 'Textured Gray Glimmer', '#928E83'),
  fin('ch-speckled-walnut', 'Speckled Walnut', '#492E21'),
  fin('ch-white', 'Textured White', '#E4E4E4'),
  fin('ch-black', 'Textured Black', '#2C2C2D'),
  fin('ch-sandy-shore', 'Sandy Shore', '#EBE3D9'),
  fin('ch-graphite', 'Graphite', '#5B5A5B'),
];

/** every `step` inches from `from` to `to`, inclusive */
const range = (from: number, to: number, step = 3): number[] => {
  const out: number[] = [];
  for (let w = from; w <= to; w += step) out.push(w);
  return out;
};

interface Spec {
  id: string;
  name: string;
  /** SKU template: {W} {H} {D} are filled from the placed size. */
  sku: string;
  front: FrontKind;
  category: Category;
  widths: number[];
  /** default width */
  w: number;
  d?: number;
  h?: number;
  heights?: number[];
  lane?: 'floor' | 'upper';
  counter?: boolean;
  note?: string;
  extra?: Partial<CatalogItem>;
}

function unit(s: Spec): CatalogItem {
  const d = s.d ?? CH_D;
  const h = s.h ?? CH_H;
  const hs = s.heights ?? [h];
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    front: s.front,
    lane: s.lane ?? 'floor',
    line: 'challenger',
    w: s.w,
    d,
    h,
    minW: Math.min(...s.widths),
    maxW: Math.max(...s.widths),
    stepW: 3,
    widths: s.widths,
    heights: s.heights,
    minD: d,
    maxD: d,
    minH: Math.min(...hs),
    maxH: Math.max(...hs),
    counter: s.counter ?? true,
    formula: '0', // no published price — quoted by the dealer
    sku: s.sku,
    note: s.note,
    ...s.extra,
  };
}

const SECURE_NOTE = '12″ deep — must be secured to another cabinet or a wall.';
const CUT_NOTE = 'Built to your appliance: give the dealer the brand and model.';

export const CHALLENGER_CATALOG: CatalogItem[] = [
  // ---- Base cabinets (1 door to 24″, 2 doors from 27″) ----
  unit({ id: 'ch-door1', name: 'Door Base', sku: 'ODB-{W}{H}{D}', front: 'door1', category: 'base', widths: range(12, 24), w: 18 }),
  unit({ id: 'ch-door2', name: '2-Door Base', sku: 'ODB-{W}{H}{D}', front: 'door2', category: 'base', widths: [...range(27, 48), 54], w: 30 }),
  unit({ id: 'ch-door1-12', name: 'Door Base, 12″ Deep', sku: 'ODB-{W}{H}{D}', front: 'door1', category: 'base', widths: range(12, 24), w: 18, d: 12, note: SECURE_NOTE }),
  unit({ id: 'ch-door2-12', name: '2-Door Base, 12″ Deep', sku: 'ODB-{W}{H}{D}', front: 'door2', category: 'base', widths: [...range(27, 48), 54], w: 30, d: 12, note: SECURE_NOTE }),
  unit({ id: 'ch-drawerdoor1', name: 'Drawer/Door Base', sku: 'OSDDB-{W}{H}{D}', front: 'doordrawer', category: 'base', widths: range(15, 24), w: 18 }),
  unit({ id: 'ch-drawerdoor2', name: 'Drawer/2-Door Base', sku: 'OSDDB-{W}{H}{D}', front: 'door2drawer', category: 'base', widths: range(27, 48), w: 30, note: '36″ and wider have two top drawers.' }),
  unit({ id: 'ch-drawer3', name: '3 Drawer Base', sku: '3ODBC-{W}{H}{D}', front: 'drawers3', category: 'base', widths: range(15, 33), w: 18 }),
  unit({ id: 'ch-drawer4', name: '4 Drawer Base', sku: '4ODBC-{W}{H}{D}', front: 'drawers4', category: 'base', widths: range(15, 33), w: 18 }),
  unit({ id: 'ch-sink1', name: 'Sink Base', sku: 'OSB-{W}{H}{D}', front: 'sink1', category: 'base', widths: range(18, 24), w: 24, note: CUT_NOTE }),
  unit({ id: 'ch-sink2', name: '2-Door Sink Base', sku: 'OSB-{W}{H}{D}', front: 'sink2', category: 'base', widths: range(27, 48), w: 33, note: CUT_NOTE }),
  unit({ id: 'ch-apronsink', name: 'Apron Sink Base (Farmhouse)', sku: 'OASB-{W}{H}{D}', front: 'sink2', category: 'base', widths: [30, ...range(36, 48)], w: 36, note: CUT_NOTE }),
  unit({ id: 'ch-tray', name: 'Tray Base', sku: 'OTB-{W}{H}{D}', front: 'door1', category: 'base', widths: range(12, 18), w: 15 }),
  unit({ id: 'ch-slideout', name: 'Internal Slide-Out/Door Base', sku: 'OISDB-{W}{H}{D}', front: 'door1', category: 'base', widths: range(15, 24), w: 18, note: 'Door base with two internal slide-outs.' }),
  unit({ id: 'ch-waste', name: 'Waste Bin', sku: 'OWBC-{W}{H}{D}', front: 'trashdrawer', category: 'base', widths: range(15, 24), w: 18 }),
  unit({ id: 'ch-blindl', name: 'Left Blind Base', sku: 'OBBC-{W}{H}{D}', front: 'blindl', category: 'base', widths: [48], w: 48, note: 'A 3″ filler panel is recommended for door clearance.' }),
  unit({ id: 'ch-blindr', name: 'Right Blind Base', sku: 'OBBC-{W}{H}{D}', front: 'blindr', category: 'base', widths: [48], w: 48, note: 'A 3″ filler panel is recommended for door clearance.' }),
  unit({ id: 'ch-open', name: 'Open Storage', sku: 'OOCU-{W}{H}{D}', front: 'open', category: 'base', widths: [24], w: 24 }),
  unit({ id: 'ch-open3', name: 'Open 3 Shelf Storage', sku: 'OOSB-{W}{H}{D}', front: 'open', category: 'base', widths: [24, 30, 36], w: 30 }),

  // ---- Grill, burner, kamado & propane ----
  unit({ id: 'ch-grill', name: 'Gas Grill Base', sku: 'OGGB-{W}{H}{D}', front: 'grill', category: 'outdoor', widths: range(30, 48), w: 36, note: `${CUT_NOTE} 12″ appliance skirt; does not hold an LP tank.`, extra: { topGearH: 12, applianceCat: 'grill' } }),
  unit({ id: 'ch-grill-wide', name: 'Gas Grill Base, Wide', sku: 'OGGB-{W}{H}{D}', front: 'grill4', category: 'outdoor', widths: range(51, 66), w: 54, note: `${CUT_NOTE} 51–54″ have three doors, 57–66″ four.`, extra: { topGearH: 12, applianceCat: 'grill' } }),
  unit({ id: 'ch-grill-drawers', name: 'Grill Base w/Door & Drawers', sku: 'ODDGGB-{W}{H}{D}', front: 'grilldrawer', category: 'outdoor', widths: range(30, 48), w: 36, note: `${CUT_NOTE} One right-hand door and two drawers.`, extra: { topGearH: 12, applianceCat: 'grill' } }),
  unit({ id: 'ch-sideburner', name: 'Side Burner Base', sku: 'OGGB-{W}{H}{D}', front: 'burner', category: 'outdoor', widths: range(18, 27), w: 18, note: CUT_NOTE, extra: { topGearH: 6, applianceCat: 'sideburner' } }),
  unit({ id: 'ch-powerburner', name: 'Power Burner Base', sku: 'OPBB-{W}{H}{D}', front: 'burner', category: 'outdoor', widths: [24, 27, 30, 36], w: 24, note: `${CUT_NOTE} Covers are factory installed.`, extra: { topGearH: 6, applianceCat: 'powerburner' } }),
  unit({ id: 'ch-kamado', name: 'Ceramic Grill Base', sku: 'OCGC-{W}{H}{D}', front: 'kamadoinsert', category: 'outdoor', widths: [24, 30], w: 30, note: 'For a medium or large kamado. Shelf height is set to your grill — give the dealer the brand and model.', extra: { topGearH: 20, applianceCat: 'kamado' } }),
  unit({ id: 'ch-kamado30', name: 'Ceramic Grill Base, 30″ Deep', sku: 'OCGC-{W}{H}{D}', front: 'kamadoinsert', category: 'outdoor', widths: [24, 30, 33], w: 30, d: 30, note: 'For a large or XL kamado. Shelf height is set to your grill — give the dealer the brand and model.', extra: { topGearH: 20, applianceCat: 'kamado' } }),
  unit({ id: 'ch-propane-pullout', name: 'Pull Out Propane Base', sku: 'OPC-{W}{H}{D}', front: 'propanedrawer', category: 'outdoor', widths: [21], w: 21, note: 'Holds a 20 lb tank. Vented.' }),
  unit({ id: 'ch-propane', name: 'Drop-In Propane Base (Full Door)', sku: 'ODPFD-{W}{H}{D}', front: 'propane', category: 'outdoor', widths: [18, 21, 24], w: 18, note: 'Holds a 20 or 30 lb tank. Vented.' }),

  // ---- Overhead (wall) cabinets: 12″ deep, 18/24/30/36″ high ----
  unit({ id: 'ch-wall1', name: 'Overhead Cabinet', sku: 'KOC-{W}{H}{D}', front: 'door1', category: 'wall', lane: 'upper', widths: range(12, 24), w: 18, d: 12, h: 30, heights: [18, 24, 30, 36], counter: false, extra: { mount: 54 } }),
  unit({ id: 'ch-wall2', name: '2-Door Overhead Cabinet', sku: 'KOC-{W}{H}{D}', front: 'door2', category: 'wall', lane: 'upper', widths: range(27, 36), w: 30, d: 12, h: 30, heights: [18, 24, 30, 36], counter: false, extra: { mount: 54 } }),

  // ---- Tall lockers: 29.5″ deep ----
  unit({ id: 'ch-locker', name: 'Locker', sku: 'OCL-{W}{H}{D}', front: 'pantry', category: 'tall', widths: range(18, 30), w: 24, d: 29.5, h: 84, heights: [78, 84, 90], counter: false, note: 'Must be attached to a wall.' }),

  // ---- Trim ----
  unit({ id: 'ch-filler', name: 'Base Filler Panel', sku: 'FP-31"H', front: 'filler', category: 'trim', widths: [0.75, 1, 1.5, 2, 3, 4, 5, 6], w: 3, d: 4, note: 'Specify the width, 3/4″ up to 6″.' }),
];

/** Challenger Designs as a brand. */
export const CHALLENGER_BRAND: Brand = {
  id: 'challenger',
  label: 'Challenger Designs — Powder-Coated Aluminum',
  shortLabel: 'Challenger',
  startLabel: 'Challenger Designs Outdoor Kitchen Cabinets',
  startSub: 'All-aluminum powder-coated cabinets, built to order in 3″ width steps.',
  modular: true,
  outdoorOnly: true,
  finishes: CHALLENGER_FINISHES,
  catalog: CHALLENGER_CATALOG,
  categoryLabels: { base: 'Base Cabinets', outdoor: 'Grill, Burner & Propane', wall: 'Overhead', tall: 'Lockers', trim: 'Fillers' },
  defaults: { finishId: 'ch-anthracite', counterId: 'ch-stainless', doorStyle: 'flat' },
  // "All cabinets have finished back panels, and finished side panels (when
  // specified) at no additional cost" — nothing is applied or billed on top.
  factoryFinished: true,
  integratedHandles: true, // 9″ stainless bar pulls ship on the cabinet
  cornerFillers: false,
  hasDoorStyles: true,
  // The three catalog door styles, drawn with the nearest existing profile.
  doorStyles: [
    { id: 'flat', label: 'Pan (flat)' },
    { id: 'shaker-inset', label: 'Shaker' },
    { id: 'clove', label: 'Ribbed Shaker' },
  ],
  companyFinishes: false,
  render: { barPulls: true, openCorner: false, integratedSinkTop: false },
  baseHeight: CH_H,
  reportNote:
    'Challenger Designs cabinets are all-aluminum, powder coated and built to order, with finished backs and bar pulls included. The manufacturer does not publish list prices, so cabinet prices are by dealer quote. Grill, sink and appliance cabinets are cut to the specific appliance — supply the brand and model with the order.',
  defaultAppliances: [],
  idMigrate: {},
  legacyLineIds: [],
};

/** Catalog units deliberately not offered yet, and why — nothing here is
 *  guessed. See data/challenger-source.md for the source rows. */
export const NOT_YET_MODELLED: Array<{ sku: string; name: string; why: string }> = [
  { sku: 'OICCB-403528', name: 'Inside Corner Base (40″, angled front)', why: 'wall footprint and front angle are not published' },
  { sku: 'OICGC-403528', name: 'Corner Ceramic Grill Base', why: 'wall footprint and front angle are not published' },
  { sku: 'OAB-283528', name: 'Outside Angle Base', why: 'no dimensions or angle published' },
  { sku: 'OBBCRA-483528', name: 'Blind Base w/Rear Access', why: 'door layout is ambiguous in the catalog' },
  { sku: 'OPDB-…', name: 'Peninsula Base', why: 'doors on both faces — needs a two-sided front' },
  { sku: 'OVBC-…', name: 'Outdoor Vented Base', why: 'height (25″) rests on the SKU code alone' },
  { sku: 'OSB-…3228 ADA', name: 'ADA Sink Base (32″ high)', why: 'needs ADA-height counter handling' },
  { sku: 'BIAB-…', name: 'Built In Appliance Base', why: 'opening/front not published' },
  { sku: 'OGGBD-… / OGGB-…32', name: 'Deep Cut and 32″-deep grill bases', why: 'depth variants of the grill base — add once depth options are supported' },
  { sku: 'OGGWDB-… / OWDDB-363528', name: 'Warming drawer bases', why: 'door count not published' },
  { sku: 'OEGB-… / OMCB-183528L', name: 'Evo and Memphis grill bases', why: 'appliance-specific fronts' },
  { sku: 'ODPC-…', name: 'Drop-In Propane Base (door + drawer)', why: 'catalog text and image disagree on the front' },
  { sku: 'OPO-397832', name: 'Pizza Oven Cabinet', why: 'front not published' },
  { sku: 'OCGC-…32 / …36, OCGDB-…', name: '32″/36″-deep and Kamado Joe ceramic grill bases', why: 'depth variants — add once depth options are supported' },
  { sku: 'OCL-369029.5', name: '36″ wide 90″ Locker', why: 'only offered at 90″ high, with four doors' },
  { sku: 'KOIC-… / OOBC-…', name: 'Inside-corner and blind-corner overheads', why: 'corner overhead footprints not published' },
  { sku: 'Coastal / Cascade / Canyon', name: 'Pre-configured islands and masonry inserts', why: 'fixed whole-island products, not placeable cabinets' },
];
