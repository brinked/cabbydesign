// Brand registry: one record per cabinet product line. Everything that differs
// between brands — finishes, catalog, defaults, how units are built, drawn and
// priced — is read from here. To add a brand: write its module (see newage.ts),
// add its id to ProductLine in types.ts and register it below.
import type { Brand, CatalogItem, Design, FinishOption, PlacedItem, ProductLine, SkuVariant } from './types';
import { NEWAGE_BRAND } from './newage';

/** EXT Cabinets: made-to-size HDPE (outdoor) and wood (indoor) cabinets priced
 *  by formula. Its finishes and catalog live in catalog.ts (they depend on the
 *  kitchen type), so both are empty here. */
const EXT_BRAND: Brand = {
  id: 'ext',
  label: 'EXT Cabinets — Custom HDPE',
  shortLabel: 'EXT',
  startLabel: 'Outdoor Kitchen Cabinets',
  startSub: 'Weatherproof HDPE cabinets made to size around your grill and appliances.',
  modular: false,
  outdoorOnly: false,
  finishes: [],
  catalog: [],
  factoryFinished: false,
  integratedHandles: false,
  cornerFillers: true,
  hasDoorStyles: true,
  companyFinishes: true,
  render: { barPulls: false, openCorner: false, integratedSinkTop: false },
  baseHeight: 34.5,
  defaultAppliances: [],
  idMigrate: {},
  legacyLineIds: [],
};

export const BRANDS: Record<ProductLine, Brand> = {
  ext: EXT_BRAND,
  newage: NEWAGE_BRAND,
};

/** Brands in the order they are offered. */
export const BRAND_LIST: Brand[] = [BRANDS.ext, BRANDS.newage];
/** Every brand other than EXT (the ones with their own catalog + finishes). */
export const MODULAR_BRANDS: Brand[] = BRAND_LIST.filter((b) => b.id !== 'ext');

/** The brand for a product line; undefined/unknown lines are EXT. */
export function brandOf(line: ProductLine | string | undefined | null): Brand {
  return (line && (BRANDS as Record<string, Brand>)[line]) || EXT_BRAND;
}

/** The brand a saved Design.line value means (including older ids), or null
 *  when it names none. */
export function brandForSavedLine(raw: string | undefined): Brand | null {
  if (!raw) return null;
  return BRAND_LIST.find((b) => b.id === raw || b.legacyLineIds.includes(raw)) ?? null;
}

/** Display names for the product lines. */
export const LINE_LABELS: Record<string, string> = Object.fromEntries(BRAND_LIST.map((b) => [b.id, b.label]));

/** Every catalog id rename across all brands. */
export const BRAND_ID_MIGRATE: Record<string, string> = Object.assign({}, ...BRAND_LIST.map((b) => b.idMigrate));

/** The kitchens a new design can start as (start screen + New design). */
export const START_OPTIONS: Array<{ kitchenType: 'indoor' | 'outdoor'; line: ProductLine; label: string; sub: string }> = [
  { kitchenType: 'indoor', line: 'ext', label: 'Indoor Kitchen Cabinets', sub: 'Made-to-size cabinets — any width, 12 colors, shaker or flat doors.' },
  ...BRAND_LIST.map((b) => ({ kitchenType: 'outdoor' as const, line: b.id, label: b.startLabel, sub: b.startSub })),
];

// ---- Finishes & SKU variants of modular units ----

/** The finishes of the brand a catalog item belongs to. */
function finishesOf(cat: CatalogItem): FinishOption[] {
  return brandOf(cat.line).finishes;
}

/** The finishes a modular unit is actually offered in. */
export function unitFinishes(cat: CatalogItem): FinishOption[] {
  return cat.skuPricing ? finishesOf(cat).filter((f) => cat.skuPricing![f.id]) : [];
}

/** The finish a unit is actually made in, closest to the one requested: the
 *  requested finish when offered, else another finish in the SAME series
 *  (e.g. Louvered White → Grove for the Grove-only 16″ units), else the first
 *  offered. Keeps previews/pricing honest for units with fewer finishes. */
export function closestFinish(cat: CatalogItem, finishId: string): string {
  if (!cat.skuPricing) return finishId;
  if (cat.skuPricing[finishId]) return finishId;
  const fins = finishesOf(cat);
  const group = fins.find((f) => f.id === finishId)?.group;
  const sameSeries = fins.find((f) => f.group === group && cat.skuPricing![f.id]);
  return sameSeries?.id ?? Object.keys(cat.skuPricing)[0];
}

/** The effective finish id a placed item renders/prices in: its own override
 *  when the unit is offered in it, else the given default — mapped to the
 *  closest finish the unit is actually made in. */
export function resolveItemFinish(defaultFinishId: string, it: Pick<PlacedItem, 'finish'>, cat: CatalogItem): string {
  if (!cat.skuPricing) return it.finish ?? defaultFinishId;
  const want = it.finish && cat.skuPricing[it.finish] ? it.finish : defaultFinishId;
  return closestFinish(cat, want);
}

/** resolveItemFinish against the design's default finish. */
export function itemFinishId(design: Design, it: PlacedItem, cat: CatalogItem): string {
  return resolveItemFinish(design.finishId, it, cat);
}

/** The variant (SKU + price) for a modular unit in the given finish, falling
 *  back to the closest offered finish. */
export function skuVariantFor(cat: CatalogItem, finishId: string): SkuVariant | null {
  if (!cat.skuPricing) return null;
  return cat.skuPricing[closestFinish(cat, finishId)] ?? null;
}

/** Whether the item is offered in the given finish. */
export function hasFinish(cat: CatalogItem, finishId: string): boolean {
  return !cat.skuPricing || !!cat.skuPricing[finishId];
}
