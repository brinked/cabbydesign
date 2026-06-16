// Appliance inventory: the grills, griddles, burners, kamados, fridges and
// insulated grill liners that drop into outdoor-kitchen cabinets. The list and
// the per-brand discounts are admin-managed globals (stored as JSON blobs in
// app_settings, mirrored to the client store on login). A placed cabinet
// records its choice in PlacedItem.appliance.
import type { ApplianceBrands, ApplianceCat, ApplianceItem, ApplianceSelection } from './types';

export const APPLIANCE_CAT_LABELS: Record<ApplianceCat, string> = {
  grill: 'Grill',
  griddle: 'Griddle',
  sideburner: 'Side Burner',
  powerburner: 'Power Burner',
  kamado: 'Kamado',
  fridge: 'Refrigeration',
  liner: 'Insulated Liner',
};

/** Order categories appear in the admin inventory editor. */
export const APPLIANCE_CATS: ApplianceCat[] = [
  'grill',
  'griddle',
  'sideburner',
  'powerburner',
  'kamado',
  'fridge',
  'liner',
];

/**
 * The dealer's discount off MSRP, as a fraction (0..1). The admin enters the
 * manufacturer discount they receive for the brand; the dealer gets half of it.
 * e.g. brand discount 30% → dealer discount 0.15.
 */
export function dealerDiscount(brandPct: number | undefined): number {
  if (!brandPct || brandPct <= 0) return 0;
  return Math.min(1, brandPct / 100 / 2);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Net (dealer cost) price for a single MSRP given a brand. */
export function netPrice(msrp: number, brand: string, brands: ApplianceBrands): number {
  return round2(msrp * (1 - dealerDiscount(brands[brand]?.discountPct)));
}

export interface AppliancePrice {
  /** The resolved grill/fridge/etc. item ('own' or unresolved → undefined). */
  item?: ApplianceItem;
  /** The included liner item, when withLiner and one is wired. */
  liner?: ApplianceItem;
  applianceMsrp: number;
  applianceNet: number;
  linerMsrp: number;
  linerNet: number;
  /** Sum at the requested price mode (MSRP for marked_up, net for cost). */
  total: number;
  /** Human label: "Brand Model" or the customer's free text. */
  label: string;
  /** True when the customer is supplying their own appliance (no price). */
  byCustomer: boolean;
}

const EMPTY: AppliancePrice = {
  applianceMsrp: 0,
  applianceNet: 0,
  linerMsrp: 0,
  linerNet: 0,
  total: 0,
  label: '',
  byCustomer: false,
};

/**
 * Resolve a placed cabinet's appliance selection into prices + a label. `mode`
 * picks which price the `total` uses: 'marked_up' bills the customer at MSRP,
 * 'cost' shows the dealer's net cost (MSRP minus the dealer's brand discount).
 */
export function appliancePrice(
  sel: ApplianceSelection | undefined,
  appliances: ApplianceItem[],
  brands: ApplianceBrands,
  mode: 'cost' | 'marked_up'
): AppliancePrice {
  if (!sel) return EMPTY;
  if (sel.mode === 'own') {
    const text = sel.ownText?.trim();
    if (!text) return EMPTY;
    return { ...EMPTY, label: text, byCustomer: true };
  }
  const item = appliances.find((a) => a.id === sel.applianceId);
  if (!item) return EMPTY;
  const liner = sel.withLiner && item.linerId ? appliances.find((a) => a.id === item.linerId) : undefined;

  const applianceMsrp = item.msrp;
  const applianceNet = netPrice(item.msrp, item.brand, brands);
  const linerMsrp = liner?.msrp ?? 0;
  const linerNet = liner ? netPrice(liner.msrp, liner.brand, brands) : 0;
  const useMsrp = mode === 'marked_up';
  const total = round2((useMsrp ? applianceMsrp : applianceNet) + (useMsrp ? linerMsrp : linerNet));

  return {
    item,
    liner,
    applianceMsrp,
    applianceNet,
    linerMsrp,
    linerNet,
    total,
    label: `${item.brand} ${item.model}`.trim(),
    byCustomer: false,
  };
}

// ---------------------------------------------------------------------------
// CSV import / export for the admin inventory editor.
//
// Columns (header row, case-insensitive): category, brand, model, name, msrp,
// liner_model. `liner_model` is optional and only meaningful for grills — it
// matches another row's `model` (a 'liner' row) to wire the recommended liner.
// The exact column set can be adjusted here when the real CSV arrives.
// ---------------------------------------------------------------------------

const CSV_HEADERS = ['category', 'brand', 'model', 'name', 'msrp', 'liner_model'] as const;

/** Slug a brand+model into a stable id. */
export function applianceId(brand: string, model: string): string {
  const base = `${brand}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'appliance';
}

/** Parse one CSV line, honoring double-quoted fields with embedded commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normCat(raw: string): ApplianceCat | null {
  const s = raw.toLowerCase().replace(/[^a-z]/g, '');
  const map: Record<string, ApplianceCat> = {
    grill: 'grill',
    griddle: 'griddle',
    sideburner: 'sideburner',
    burner: 'sideburner',
    powerburner: 'powerburner',
    kamado: 'kamado',
    fridge: 'fridge',
    refrigerator: 'fridge',
    refrigeration: 'fridge',
    liner: 'liner',
    insulatedliner: 'liner',
  };
  return map[s] ?? null;
}

export interface CsvParseResult {
  items: ApplianceItem[];
  errors: string[];
}

/**
 * Parse the inventory CSV into ApplianceItems. Resolves `liner_model` to a
 * linerId by matching a liner row's model. Skips blank/garbage rows and
 * collects human-readable errors (returned alongside the good rows).
 */
export function parseAppliancesCsv(text: string): CsvParseResult {
  const errors: string[] = [];
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (rows.length === 0) return { items: [], errors: ['The file is empty.'] };

  // Map header names to column indexes (defaults to canonical order if no header).
  const first = splitCsvLine(rows[0]).map((h) => h.toLowerCase().replace(/[^a-z_]/g, ''));
  const hasHeader = CSV_HEADERS.some((h) => first.includes(h));
  const idx: Record<string, number> = {};
  if (hasHeader) {
    CSV_HEADERS.forEach((h) => (idx[h] = first.indexOf(h)));
  } else {
    CSV_HEADERS.forEach((h, i) => (idx[h] = i));
  }

  const items: ApplianceItem[] = [];
  const dataRows = hasHeader ? rows.slice(1) : rows;
  // First pass: build items (linerId resolved in a second pass by model).
  const pending: { item: ApplianceItem; linerModel: string }[] = [];
  dataRows.forEach((line, n) => {
    const cells = splitCsvLine(line);
    const get = (k: string) => (idx[k] >= 0 ? cells[idx[k]] ?? '' : '');
    const cat = normCat(get('category'));
    const brand = get('brand');
    const model = get('model');
    if (!cat) {
      errors.push(`Row ${n + 1}: unknown category "${get('category')}".`);
      return;
    }
    if (!brand || !model) {
      errors.push(`Row ${n + 1}: brand and model are required.`);
      return;
    }
    const msrp = Number(get('msrp').replace(/[$,]/g, ''));
    if (!Number.isFinite(msrp) || msrp < 0) {
      errors.push(`Row ${n + 1}: invalid price "${get('msrp')}".`);
      return;
    }
    const item: ApplianceItem = {
      id: applianceId(brand, model),
      category: cat,
      brand,
      model,
      name: get('name'),
      msrp,
      active: true,
    };
    pending.push({ item, linerModel: get('liner_model') });
  });

  const byModel = new Map(pending.map((p) => [p.item.model.toLowerCase(), p.item.id]));
  for (const { item, linerModel } of pending) {
    if (linerModel) {
      const linerId = byModel.get(linerModel.toLowerCase());
      if (linerId) item.linerId = linerId;
      else errors.push(`${item.brand} ${item.model}: liner model "${linerModel}" not found in the file.`);
    }
    items.push(item);
  }
  return { items, errors };
}

function csvCell(v: string | number): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize the inventory back to CSV (round-trips parseAppliancesCsv). */
export function appliancesToCsv(items: ApplianceItem[]): string {
  const byId = new Map(items.map((a) => [a.id, a]));
  const lines = [CSV_HEADERS.join(',')];
  for (const a of items) {
    const linerModel = a.linerId ? byId.get(a.linerId)?.model ?? '' : '';
    lines.push([a.category, a.brand, a.model, a.name, a.msrp, linerModel].map(csvCell).join(','));
  }
  return lines.join('\n');
}
