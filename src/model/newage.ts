// NewAge Products — Classic Series modular outdoor kitchen line.
//
// Data sourced from newageproducts.com (July 2026): every individual modular
// unit with factory-fixed dimensions and per-variant SKU + retail pricing
// (price = everyday price, msrp = compare-at). Dimensions are NOT editable —
// these are set products, identical across series.
//
// Like NewAge's own product pages, each cabinet is ONE catalog entry; the
// SERIES + DOOR FINISH are options chosen per cabinet (or inherited from the
// design default):
//   · Classic (304 Stainless)  — Stainless Steel / Matte Black doors
//   · Louvered (304 Stainless) — Grove / White louvered doors
//   · Aluminum                 — Slate Gray / Black tempered-glass doors
// A finish missing from an item's pricing map means NewAge doesn't make that
// unit in that series/finish.

import type { ApplianceItem, CatalogItem, Design, FinishOption, NaVariant, PlacedItem } from './types';

/** NewAge series + door-finish options. `group` is the series label.
 *  Matching the real products: the cabinet BODY is 304 stainless (or
 *  powder-coated aluminum); only the DOOR carries the finish. Louvered doors
 *  are horizontal slats (Grove = teak wood-look, White = painted); aluminum
 *  doors are tinted tempered glass in the body-colored frame. Bases are black
 *  with adjustable levelers. */
export const NEWAGE_FINISHES: FinishOption[] = [
  // ---- Classic series (304 stainless steel, flat metal doors) ----
  { id: 'na-ss-steel', name: 'Stainless Steel', group: 'Classic · 304 Stainless', line: 'newage', metal: 'stainless', naDoor: 'flat', kick: '#17181a', body: '#c9ccd0', panel: '#cdd0d4', inner: '#b2b6bb', counter: '#cfd2d5' },
  { id: 'na-ss-black', name: 'Matte Black', group: 'Classic · 304 Stainless', line: 'newage', metal: 'stainless', naDoor: 'flat', kick: '#121314', body: '#2b2d2f', panel: '#28292b', inner: '#1e1f21', counter: '#cfd2d5' },
  // ---- Louvered series (304 stainless body, louvered slat doors) ----
  { id: 'na-ss-grove', name: 'Grove', group: 'Louvered · 304 Stainless', line: 'newage', metal: 'stainless', naDoor: 'louvered', kick: '#17181a', body: '#c9ccd0', panel: '#8a684c', inner: '#6e5138', counter: '#cfd2d5' },
  { id: 'na-ss-white', name: 'Louvered White', group: 'Louvered · 304 Stainless', line: 'newage', metal: 'stainless', naDoor: 'louvered', kick: '#17181a', body: '#c9ccd0', panel: '#edefeb', inner: '#cfd2cd', counter: '#cfd2d5' },
  // ---- Aluminum series (tempered-glass doors in the body-colored frame) ----
  { id: 'na-alu-slate', name: 'Slate Gray', group: 'Aluminum · Tempered Glass', line: 'newage', metal: 'aluminum', naDoor: 'glass', kick: '#141516', body: '#6f7379', panel: '#33373c', inner: '#2b2e33', counter: '#cfd2d5' },
  { id: 'na-alu-black', name: 'Black', group: 'Aluminum · Tempered Glass', line: 'newage', metal: 'aluminum', naDoor: 'glass', kick: '#101112', body: '#26282a', panel: '#26292d', inner: '#1e2124', counter: '#cfd2d5' },
];

// Shorthand builder for the per-finish pricing maps.
const v = (sku: string, price: number, msrp: number): NaVariant => ({ sku, price, msrp });

/** Estimated retail $/sq ft for NewAge stainless countertops (derived from
 *  their fixed-size tops, e.g. 32″ top $329.99 / 5.33 sq ft). Used for the
 *  report estimate — final order uses NewAge's fixed-size top SKUs. */
export const NA_COUNTER_RATE_PER_SQFT = 58;

/** NewAge stainless countertop SKUs (Size / Overhang → SKU + price) — kept for
 *  reference and future order-building. Standard tops are 25.5″ deep. */
export const NA_COUNTERTOP_SKUS: Array<{ size: string; overhang: string; sku: string; price: number; msrp: number }> = [
  { size: '16 in.', overhang: 'Standard', sku: '89038', price: 219.99, msrp: 269.99 },
  { size: '32 in.', overhang: 'Standard', sku: '65800', price: 329.99, msrp: 419.99 },
  { size: '56 in.', overhang: 'Standard', sku: '65801', price: 469.99, msrp: 589.99 },
  { size: '64 in.', overhang: 'Standard', sku: '65802', price: 579.99, msrp: 719.99 },
  { size: '96 in.', overhang: 'Standard', sku: '65804', price: 879.99, msrp: 1099.99 },
  { size: '18 in.', overhang: 'Standard', sku: '66070', price: 139.99, msrp: 149.99 },
  { size: '18 in.', overhang: '1-Sided Extended', sku: '66071', price: 139.99, msrp: 149.99 },
  { size: '18 in.', overhang: '2-Sided Extended', sku: '66072', price: 139.99, msrp: 149.99 },
  { size: '36 in.', overhang: 'Standard', sku: '66073', price: 239.99, msrp: 259.99 },
  { size: '36 in.', overhang: '1-Sided Extended', sku: '66074', price: 239.99, msrp: 259.99 },
  { size: '36 in.', overhang: '2-Sided Extended', sku: '66075', price: 239.99, msrp: 259.99 },
  { size: '48 in.', overhang: 'Standard', sku: '89039', price: 402.99, msrp: 539.99 },
  { size: '54 in.', overhang: 'Standard', sku: '66076', price: 339.99, msrp: 369.99 },
  { size: '54 in.', overhang: '1-Sided Extended', sku: '66077', price: 339.99, msrp: 369.99 },
  { size: '54 in.', overhang: '2-Sided Extended', sku: '66078', price: 339.99, msrp: 369.99 },
  { size: '60 in.', overhang: 'Standard', sku: '66081', price: 379.99, msrp: 419.99 },
  { size: '60 in.', overhang: '1-Sided Extended', sku: '66082', price: 379.99, msrp: 419.99 },
  { size: '72 in.', overhang: 'Standard', sku: '66083', price: 489.99, msrp: 539.99 },
  { size: '72 in.', overhang: '1-Sided Extended', sku: '66084', price: 489.99, msrp: 539.99 },
  { size: '72 in.', overhang: '2-Sided Extended', sku: '66085', price: 489.99, msrp: 539.99 },
  { size: '45 Degree Corner', overhang: 'Standard', sku: '66089', price: 219.99, msrp: 239.99 },
  { size: '90 Degree Corner', overhang: 'Standard', sku: '66088', price: 239.99, msrp: 259.99 },
];

// NewAge Classic Series heights: base cabinets are 34.25″ and take the 1.25″
// countertop (→ 35.5″ surface); grill/sink/corner/kamado units stand at the
// finished 35.5″ (their tops are integrated or open) so nothing runs over them.
const NA_BASE_H = 34.25;
const NA_TALL_H = 35.5;

/** Every NewAge modular unit — one entry per cabinet; series/finish per unit
 *  via naPricing (finish id → SKU + price). Dimensions identical across series. */
export const NEWAGE_CATALOG: CatalogItem[] = [
  {
    id: 'na-1door16', name: '16″ 1-Door Cabinet', category: 'base', front: 'door1', lane: 'floor', line: 'newage', fixed: true,
    w: 16, d: 23, h: NA_BASE_H, minW: 16, maxW: 16, stepW: 0, minD: 23, maxD: 23, minH: NA_BASE_H, maxH: NA_BASE_H, counter: true, formula: '0',
    note: 'Adjustable-height shelf, soft-close hinges.',
    naPricing: {
      'na-ss-steel': v('65621', 659.99, 729.99), 'na-ss-black': v('65811', 759.99, 839.99), 'na-ss-grove': v('65624', 779.99, 859.99),
      'na-alu-slate': v('65627', 459.99, 669.99), 'na-alu-black': v('65592', 459.99, 759.99),
    },
  },
  {
    id: 'na-3drawer16', name: '16″ 3-Drawer Cabinet', category: 'base', front: 'drawers3', lane: 'floor', line: 'newage', fixed: true,
    w: 16, d: 23, h: NA_BASE_H, minW: 16, maxW: 16, stepW: 0, minD: 23, maxD: 23, minH: NA_BASE_H, maxH: NA_BASE_H, counter: true, formula: '0',
    note: 'Full-extension soft-close drawers.',
    naPricing: {
      'na-ss-steel': v('65623', 949.99, 1059.99), 'na-ss-black': v('65812', 1089.99, 1199.99), 'na-ss-grove': v('65626', 1039.99, 1149.99),
      'na-alu-slate': v('65629', 639.99, 939.99), 'na-alu-black': v('65593', 639.99, 1069.99),
    },
  },
  {
    id: 'na-sink16', name: '16″ Sink Cabinet', category: 'base', front: 'sink1', lane: 'floor', line: 'newage', fixed: true,
    w: 16, d: 24, h: NA_TALL_H, minW: 16, maxW: 16, stepW: 0, minD: 24, maxD: 24, minH: NA_TALL_H, maxH: NA_TALL_H, counter: false, formula: '0',
    note: 'Integrated stainless top with bar sink & faucet included — 35.5″ finished height.',
    naPricing: {
      'na-ss-steel': v('65622', 1189.99, 1319.99), 'na-ss-black': v('65813', 1369.99, 1519.99), 'na-ss-grove': v('65625', 1249.99, 1389.99),
      'na-alu-slate': v('65628', 799.99, 1179.99), 'na-alu-black': v('65594', 799.99, 1329.99),
    },
  },
  {
    id: 'na-2door', name: '32″ 2-Door Cabinet', category: 'base', front: 'door2', lane: 'floor', line: 'newage', fixed: true,
    w: 32, d: 23, h: NA_BASE_H, minW: 32, maxW: 32, stepW: 0, minD: 23, maxD: 23, minH: NA_BASE_H, maxH: NA_BASE_H, counter: true, formula: '0',
    note: 'Adjustable-height shelf, soft-close hinges.',
    naPricing: {
      'na-ss-steel': v('70001', 999.99, 1109.99), 'na-ss-black': v('70305', 1139.99, 1269.99), 'na-ss-grove': v('70101', 1109.99, 1239.99), 'na-ss-white': v('70405', 1109.99, 1239.99),
      'na-alu-slate': v('70201', 629.99, 939.99), 'na-alu-black': v('70505', 639.99, 1069.99),
    },
  },
  {
    id: 'na-3drawer', name: '32″ 3-Drawer Cabinet', category: 'base', front: 'drawers3', lane: 'floor', line: 'newage', fixed: true,
    w: 32, d: 23, h: NA_BASE_H, minW: 32, maxW: 32, stepW: 0, minD: 23, maxD: 23, minH: NA_BASE_H, maxH: NA_BASE_H, counter: true, formula: '0',
    note: 'Full-extension soft-close drawers.',
    naPricing: {
      'na-ss-steel': v('70003', 1359.99, 1519.99), 'na-ss-black': v('70307', 1559.99, 1729.99), 'na-ss-grove': v('70103', 1499.99, 1669.99), 'na-ss-white': v('70407', 1499.99, 1669.99),
      'na-alu-slate': v('70203', 869.99, 1299.99), 'na-alu-black': v('70507', 899.99, 1459.99),
    },
  },
  {
    id: 'na-2door1drawer', name: '32″ 2-Door + Drawer Cabinet', category: 'base', front: 'door2drawer', lane: 'floor', line: 'newage', fixed: true,
    w: 32, d: 23, h: NA_BASE_H, minW: 32, maxW: 32, stepW: 0, minD: 23, maxD: 23, minH: NA_BASE_H, maxH: NA_BASE_H, counter: true, formula: '0',
    note: 'Top drawer over a 2-door compartment. 304 stainless series only.',
    naPricing: {
      'na-ss-steel': v('70004', 1169.99, 1299.99), 'na-ss-black': v('70308', 1359.99, 1509.99), 'na-ss-grove': v('70104', 1269.99, 1409.99), 'na-ss-white': v('70408', 1269.99, 1409.99),
    },
  },
  {
    id: 'na-bar', name: '32″ Bar Cabinet', category: 'base', front: 'door2drawer', lane: 'floor', line: 'newage', fixed: true,
    w: 32, d: 23, h: NA_BASE_H, minW: 32, maxW: 32, stepW: 0, minD: 23, maxD: 23, minH: NA_BASE_H, maxH: NA_BASE_H, counter: true, formula: '0',
    note: 'Bar prep station — bottle wells, condiment tray & towel bar.',
    naPricing: {
      'na-ss-steel': v('70005', 1359.99, 1519.99), 'na-ss-black': v('70309', 1559.99, 1729.99), 'na-ss-grove': v('70105', 1499.99, 1669.99), 'na-ss-white': v('70409', 1499.99, 1669.99),
      'na-alu-slate': v('70204', 869.99, 1299.99), 'na-alu-black': v('70508', 899.99, 1459.99),
    },
  },
  {
    id: 'na-sink', name: '32″ Sink Cabinet', category: 'base', front: 'sink2', lane: 'floor', line: 'newage', fixed: true,
    w: 32, d: 24, h: NA_TALL_H, minW: 32, maxW: 32, stepW: 0, minD: 24, maxD: 24, minH: NA_TALL_H, maxH: NA_TALL_H, counter: false, formula: '0',
    note: 'Integrated stainless top with sink & faucet included — 35.5″ finished height.',
    naPricing: {
      'na-ss-steel': v('70002', 1499.99, 1889.99), 'na-ss-black': v('70306', 1699.99, 2169.99), 'na-ss-grove': v('70102', 1769.99, 1979.99), 'na-ss-white': v('70406', 1769.99, 1979.99),
      'na-alu-slate': v('70202', 1119.99, 1669.99), 'na-alu-black': v('70506', 1139.99, 1899.99),
    },
  },
  {
    id: 'na-corner45', name: '45° Corner Cabinet', category: 'outdoor', front: 'door1', lane: 'floor', line: 'newage', fixed: true,
    w: 22.25, d: 24.125, h: NA_TALL_H, minW: 22.25, maxW: 22.25, stepW: 0, minD: 24.125, maxD: 24.125, minH: NA_TALL_H, maxH: NA_TALL_H, counter: false, formula: '0',
    note: 'Wedge unit joining two runs at a 45° angle — integrated top, 35.5″ finished height.',
    naPricing: {
      'na-ss-steel': v('65005', 1229.99, 1369.99), 'na-ss-black': v('70302', 1419.99, 1579.99), 'na-ss-grove': v('65605', 1349.99, 1519.99), 'na-ss-white': v('70402', 1349.99, 1519.99),
      'na-alu-slate': v('65205', 779.99, 1169.99), 'na-alu-black': v('70502', 799.99, 1319.99),
    },
  },
  {
    id: 'na-corner90', name: '90° Corner Cabinet', category: 'outdoor', front: 'corner', lane: 'floor', line: 'newage', fixed: true,
    w: 32.5, d: 32.5, h: NA_TALL_H, minW: 32.5, maxW: 32.5, stepW: 0, minD: 32.5, maxD: 32.5, minH: NA_TALL_H, maxH: NA_TALL_H, counter: false, formula: '0',
    note: 'Open corner shelving unit — integrated top, 35.5″ finished height.',
    naPricing: {
      'na-ss-steel': v('65006', 795.99, 879.99), 'na-ss-black': v('70301', 899.99, 999.99), 'na-ss-grove': v('65606', 849.99, 939.99),
      'na-alu-slate': v('65206', 539.99, 809.99),
    },
  },
  {
    id: 'na-grill33', name: '33″ Gas Grill Cabinet', category: 'outdoor', front: 'grill', lane: 'floor', line: 'newage', fixed: true,
    w: 33, d: 23, h: NA_TALL_H, minW: 33, maxW: 33, stepW: 0, minD: 23, maxD: 23, minH: NA_TALL_H, maxH: NA_TALL_H, counter: false, topGearH: 12, formula: '0', applianceCat: 'grill',
    note: 'Fits insert grills 28–33″ wide. Pull-out propane tray, rear gas ports.',
    naPricing: {
      'na-ss-steel': v('70007', 999.99, 1109.99), 'na-ss-black': v('70311', 1139.99, 1269.99), 'na-ss-grove': v('70108', 1109.99, 1239.99), 'na-ss-white': v('70412', 1109.99, 1239.99),
      'na-alu-slate': v('70208', 589.99, 879.99), 'na-alu-black': v('70512', 599.99, 999.99),
    },
  },
  {
    id: 'na-grill36', name: '36″ Gas Grill Cabinet', category: 'outdoor', front: 'grill', lane: 'floor', line: 'newage', fixed: true,
    w: 36, d: 23, h: NA_TALL_H, minW: 36, maxW: 36, stepW: 0, minD: 23, maxD: 23, minH: NA_TALL_H, maxH: NA_TALL_H, counter: false, topGearH: 12, formula: '0', applianceCat: 'grill',
    note: 'Fits insert grills 31–36″ wide. Pull-out propane tray, rear gas ports.',
    naPricing: {
      'na-ss-steel': v('70008', 1069.99, 1179.99), 'na-ss-black': v('70312', 1229.99, 1369.99), 'na-ss-grove': v('70107', 1209.99, 1349.99), 'na-ss-white': v('70411', 1209.99, 1349.99),
      'na-alu-slate': v('70206', 659.99, 969.99), 'na-alu-black': v('70510', 679.99, 1109.99),
    },
  },
  {
    id: 'na-grill40', name: '40″ Gas Grill Cabinet', category: 'outdoor', front: 'grill', lane: 'floor', line: 'newage', fixed: true,
    w: 40, d: 23, h: NA_TALL_H, minW: 40, maxW: 40, stepW: 0, minD: 23, maxD: 23, minH: NA_TALL_H, maxH: NA_TALL_H, counter: false, topGearH: 12, formula: '0', applianceCat: 'grill',
    note: 'Fits insert grills 34.5–40″ wide. Pull-out propane tray, rear gas ports.',
    naPricing: {
      'na-ss-steel': v('70009', 1169.99, 1299.99), 'na-ss-black': v('70313', 1349.99, 1499.99), 'na-ss-grove': v('70109', 1299.99, 1449.99), 'na-ss-white': v('70413', 1299.99, 1449.99),
      'na-alu-slate': v('70207', 739.99, 1089.99), 'na-alu-black': v('70511', 759.99, 1269.99),
    },
  },
  {
    id: 'na-kamado', name: 'Kamado Cabinet', category: 'outdoor', front: 'kamadoinsert', lane: 'floor', line: 'newage', fixed: true,
    w: 28, d: 24, h: 34.9, minW: 28, maxW: 28, stepW: 0, minD: 24, maxD: 24, minH: 34.9, maxH: 34.9, counter: false, topGearH: 14, formula: '0', applianceCat: 'kamado',
    note: 'The kamado (sold separately) drops into the top cutout — open storage shelf below.',
    naPricing: {
      'na-ss-steel': v('70006', 1359.99, 1519.99), 'na-ss-black': v('70310', 1559.99, 1729.99), 'na-ss-grove': v('70106', 1499.99, 1669.99), 'na-ss-white': v('70410', 1499.99, 1669.99),
      'na-alu-slate': v('70205', 869.99, 1299.99), 'na-alu-black': v('70509', 899.99, 1459.99),
    },
  },
  {
    id: 'na-wall', name: 'Wall Cabinet', category: 'wall', front: 'flipup', lane: 'upper', line: 'newage', fixed: true,
    w: 32, d: 14.75, h: 20, minW: 32, maxW: 32, stepW: 0, minD: 14.75, maxD: 14.75, minH: 20, maxH: 20, counter: false, formula: '0', mount: 54,
    note: 'Gas-assist flip-up door — weather-sealed upper storage.',
    naPricing: {
      'na-ss-steel': v('65013', 929.99, 1039.99), 'na-ss-black': v('70303', 1059.99, 1169.99), 'na-ss-grove': v('65613', 1039.99, 1169.99), 'na-ss-white': v('70403', 1039.99, 1169.99),
      'na-alu-slate': v('65213', 589.99, 879.99), 'na-alu-black': v('70503', 599.99, 1009.99),
    },
  },
  {
    id: 'na-fridge24', name: '24″ Fridge Bracket', category: 'outdoor', front: 'fridge', lane: 'floor', line: 'newage', fixed: true,
    w: 24, d: 23, h: NA_BASE_H, minW: 24, maxW: 24, stepW: 0, minD: 23, maxD: 23, minH: NA_BASE_H, maxH: NA_BASE_H, counter: true, formula: '0', applianceCat: 'fridge',
    note: 'Back panel + front bracket kit for a 24″ outdoor fridge (fridge sold separately).',
    naPricing: {
      'na-ss-steel': v('67702', 109.99, 129.99), 'na-ss-black': v('70539', 129.99, 149.99), 'na-ss-grove': v('67701', 109.99, 129.99),
      'na-alu-slate': v('67703', 99.99, 119.99),
    },
  },
  {
    id: 'na-grillcart33', name: '33″ Grill Cart', category: 'outdoor', front: 'cartgrill', lane: 'floor', line: 'newage', fixed: true,
    w: 60.56, d: 25.26, h: 35.44, minW: 60.56, maxW: 60.56, stepW: 0, minD: 25.26, maxD: 25.26, minH: 35.44, maxH: 35.44, counter: false, formula: '0',
    note: 'Freestanding cart for a 33″ insert grill — side shelves & casters. Classic stainless only.',
    naPricing: { 'na-ss-steel': v('66958', 749.99, 1039.99) },
  },
  {
    id: 'na-grillcart36', name: '36″ Grill Cart', category: 'outdoor', front: 'cartgrill', lane: 'floor', line: 'newage', fixed: true,
    w: 63.56, d: 25.26, h: 35.44, minW: 63.56, maxW: 63.56, stepW: 0, minD: 25.26, maxD: 25.26, minH: 35.44, maxH: 35.44, counter: false, formula: '0',
    note: 'Freestanding cart for a 36″ insert grill — side shelves & casters. Classic stainless only.',
    naPricing: { 'na-ss-steel': v('66959', 799.99, 1089.99) },
  },
  {
    id: 'na-grillcart40', name: '40″ Grill Cart', category: 'outdoor', front: 'cartgrill', lane: 'floor', line: 'newage', fixed: true,
    w: 67.56, d: 25.26, h: 35.44, minW: 67.56, maxW: 67.56, stepW: 0, minD: 25.26, maxD: 25.26, minH: 35.44, maxH: 35.44, counter: false, formula: '0',
    note: 'Freestanding cart for a 40″ insert grill — side shelves & casters. Classic stainless only.',
    naPricing: { 'na-ss-steel': v('66960', 849.99, 1129.99) },
  },
  {
    id: 'na-burnercart', name: 'Side Burner Cart', category: 'outdoor', front: 'burner', lane: 'floor', line: 'newage', fixed: true,
    w: 16, d: 23.82, h: 34.19, minW: 16, maxW: 16, stepW: 0, minD: 23.82, maxD: 23.82, minH: 34.19, maxH: 34.19, counter: false, topGearH: 6, formula: '0', applianceCat: 'sideburner',
    note: 'Freestanding cart for a drop-in side burner. Classic stainless only.',
    naPricing: { 'na-ss-steel': v('66961', 449.99, 669.99) },
  },
];

/** NewAge insert grills offered for the grill cabinets — seeded as the default
 *  appliance inventory in consumer/guest mode (an admin-managed inventory from
 *  the server replaces this when available). Prices are NewAge retail. */
export const NEWAGE_DEFAULT_APPLIANCES: ApplianceItem[] = [
  { id: 'na-perf-grill-33-ng', category: 'grill', brand: 'NewAge', model: '66980', name: 'Performance Grill 33″ (Natural Gas)', msrp: 1399.99, cutoutW: 33, cutoutD: 25.02, cutoutH: 23.04 },
  { id: 'na-perf-grill-33-lp', category: 'grill', brand: 'NewAge', model: '66990', name: 'Performance Grill 33″ (Liquid Propane)', msrp: 1399.99, cutoutW: 33, cutoutD: 25.02, cutoutH: 23.04 },
  { id: 'na-perf-grill-36-ng', category: 'grill', brand: 'NewAge', model: '66981', name: 'Performance Grill 36″ (Natural Gas)', msrp: 1549.99, cutoutW: 36, cutoutD: 25.02, cutoutH: 23.04 },
  { id: 'na-perf-grill-36-lp', category: 'grill', brand: 'NewAge', model: '66991', name: 'Performance Grill 36″ (Liquid Propane)', msrp: 1549.99, cutoutW: 36, cutoutD: 25.02, cutoutH: 23.04 },
  { id: 'na-perf-grill-40-ng', category: 'grill', brand: 'NewAge', model: '66982', name: 'Performance Grill 40″ (Natural Gas)', msrp: 1699.99, cutoutW: 40, cutoutD: 25.02, cutoutH: 23.04 },
  { id: 'na-perf-grill-40-lp', category: 'grill', brand: 'NewAge', model: '66992', name: 'Performance Grill 40″ (Liquid Propane)', msrp: 1699.99, cutoutW: 40, cutoutD: 25.02, cutoutH: 23.04 },
];

/** Display names for the product lines. */
export const LINE_LABELS: Record<string, string> = {
  ext: 'EXT Cabinets — Custom HDPE',
  newage: 'NewAge Products — Modular Outdoor',
};

/** Legacy catalog-id / line migrations (pre-merge saves used per-line ids). */
export const NEWAGE_ID_MIGRATE: Record<string, string> = {
  'na-ss-1door16': 'na-1door16', 'na-alu-1door16': 'na-1door16',
  'na-ss-3drawer16': 'na-3drawer16', 'na-alu-3drawer16': 'na-3drawer16',
  'na-ss-sink16': 'na-sink16', 'na-alu-sink16': 'na-sink16',
  'na-ss-2door': 'na-2door', 'na-alu-2door': 'na-2door',
  'na-ss-3drawer': 'na-3drawer', 'na-alu-3drawer': 'na-3drawer',
  'na-ss-2door1drawer': 'na-2door1drawer',
  'na-ss-bar': 'na-bar', 'na-alu-bar': 'na-bar',
  'na-ss-sink': 'na-sink', 'na-alu-sink': 'na-sink',
  'na-ss-corner45': 'na-corner45', 'na-alu-corner45': 'na-corner45',
  'na-ss-corner90': 'na-corner90', 'na-alu-corner90': 'na-corner90',
  'na-ss-grill33': 'na-grill33', 'na-alu-grill33': 'na-grill33',
  'na-ss-grill36': 'na-grill36', 'na-alu-grill36': 'na-grill36',
  'na-ss-grill40': 'na-grill40', 'na-alu-grill40': 'na-grill40',
  'na-ss-kamado': 'na-kamado', 'na-alu-kamado': 'na-kamado',
  'na-ss-wall': 'na-wall', 'na-alu-wall': 'na-wall',
  'na-ss-fridge24': 'na-fridge24', 'na-alu-fridge24': 'na-fridge24',
  'na-ss-grillcart33': 'na-grillcart33', 'na-ss-grillcart36': 'na-grillcart36', 'na-ss-grillcart40': 'na-grillcart40',
  'na-ss-burnercart': 'na-burnercart',
};

/** The finish a unit is actually made in, closest to the one requested: the
 *  requested finish when offered, else another finish in the SAME series
 *  (e.g. Louvered White → Grove for the Grove-only 16″ units), else the first
 *  offered. Keeps previews/pricing honest for units with fewer finishes. */
export function naClosestFinish(cat: CatalogItem, finishId: string): string {
  if (!cat.naPricing) return finishId;
  if (cat.naPricing[finishId]) return finishId;
  const group = NEWAGE_FINISHES.find((f) => f.id === finishId)?.group;
  const sameSeries = NEWAGE_FINISHES.find((f) => f.group === group && cat.naPricing![f.id]);
  return sameSeries?.id ?? Object.keys(cat.naPricing)[0];
}

/** The effective finish id a placed item renders/prices in: its own override
 *  when the unit is offered in it, else the given default — mapped to the
 *  closest finish the unit is actually made in. */
export function resolveItemFinish(defaultFinishId: string, it: Pick<PlacedItem, 'finish'>, cat: CatalogItem): string {
  if (!cat.naPricing) return it.finish ?? defaultFinishId;
  const want = it.finish && cat.naPricing[it.finish] ? it.finish : defaultFinishId;
  return naClosestFinish(cat, want);
}

/** resolveItemFinish against the design's default finish. */
export function itemFinishId(design: Design, it: PlacedItem, cat: CatalogItem): string {
  return resolveItemFinish(design.finishId, it, cat);
}

/** The NewAge variant (SKU + price) for an item in the given finish, falling
 *  back to the closest offered finish. */
export function naVariantFor(cat: CatalogItem, finishId: string): NaVariant | null {
  if (!cat.naPricing) return null;
  return cat.naPricing[naClosestFinish(cat, finishId)] ?? null;
}

/** Whether the item is offered in the given finish. */
export function naHasFinish(cat: CatalogItem, finishId: string): boolean {
  return !cat.naPricing || !!cat.naPricing[finishId];
}
