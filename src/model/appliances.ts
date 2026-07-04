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
  icemaker: 'Ice Maker',
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
  'icemaker',
  'liner',
];

/** Categories whose models carry physical W×D×H dimensions (drive the gap). */
export const SIZED_CATS: ApplianceCat[] = ['fridge', 'icemaker', 'liner'];

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
  /** Panel-ready cabinet-matched door panel charge (flat; not discounted). */
  panelCharge: number;
  /** Sum at the requested price mode (MSRP for marked_up, net for cost), incl. panel. */
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
  panelCharge: 0,
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
  const panelCharge = item.panelCharge && item.panelCharge > 0 ? round2(item.panelCharge) : 0;
  const useMsrp = mode === 'marked_up';
  const total = round2((useMsrp ? applianceMsrp : applianceNet) + (useMsrp ? linerMsrp : linerNet) + panelCharge);

  return {
    item,
    liner,
    applianceMsrp,
    applianceNet,
    linerMsrp,
    linerNet,
    panelCharge,
    total,
    label: `${item.brand} ${item.model}${item.name ? ` — ${item.name}` : ''}`.trim(),
    byCustomer: false,
  };
}

/**
 * A grill/griddle/side-burner/power-burner cabinet must be at least this many
 * inches wider than its insulated liner's cutout width (clearance for the
 * cabinet frame around the jacket).
 */
export const LINER_CABINET_CLEARANCE = 4;

/**
 * Minimum housing-cabinet width for a placed cabinet's appliance selection: the
 * associated insulated liner's cutout width + LINER_CABINET_CLEARANCE. Applies
 * whether or not the customer keeps the liner (the grill's own cutout matches
 * its jacket). Returns 0 when there's no selection or no known liner cutout.
 */
export function requiredCabinetWidth(sel: ApplianceSelection | undefined, appliances: ApplianceItem[]): number {
  if (!sel || sel.mode !== 'inventory' || !sel.applianceId) return 0;
  const item = appliances.find((a) => a.id === sel.applianceId);
  if (!item) return 0;
  // Prefer the explicitly-chosen/associated liner; fall back to the item's own cutout.
  const liner = item.linerId ? appliances.find((a) => a.id === item.linerId) : undefined;
  const cutoutW = liner?.cutoutW ?? item.cutoutW;
  if (!cutoutW || cutoutW <= 0) return 0;
  return Math.round((cutoutW + LINER_CABINET_CLEARANCE) * 100) / 100;
}

/** The selected inventory appliance's overall height (cutoutH), or undefined. */
export function selectedApplianceHeight(
  sel: ApplianceSelection | undefined,
  appliances: ApplianceItem[]
): number | undefined {
  if (!sel || sel.mode !== 'inventory' || !sel.applianceId) return undefined;
  const item = appliances.find((a) => a.id === sel.applianceId);
  return item?.cutoutH;
}

/** The selected inventory appliance's width (cutoutW), or undefined. */
export function selectedApplianceWidth(
  sel: ApplianceSelection | undefined,
  appliances: ApplianceItem[]
): number | undefined {
  if (!sel || sel.mode !== 'inventory' || !sel.applianceId) return undefined;
  const item = appliances.find((a) => a.id === sel.applianceId);
  return item?.cutoutW;
}

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
  const s = raw.toLowerCase();
  if (s.includes('griddle')) return 'griddle';
  if (s.includes('power')) return 'powerburner';
  if (s.includes('side') && s.includes('burner')) return 'sideburner';
  if (s.includes('burner')) return 'sideburner';
  if (s.includes('grill')) return 'grill';
  if (s.includes('kamado')) return 'kamado';
  if (s.includes('ice')) return 'icemaker';
  if (s.includes('fridge') || s.includes('refrig')) return 'fridge';
  if (s.includes('liner') || s.includes('jacket')) return 'liner';
  return null;
}

/** Phrases that mean "no real value" in this dataset. */
function isBlankish(raw: string): boolean {
  const s = raw.toLowerCase();
  return (
    !s.trim() ||
    s.includes('not found') ||
    s.includes('not required') ||
    s.includes('no dedicated') ||
    s.includes('does not exist') ||
    s === 'n/a' ||
    s.includes('information not')
  );
}

const UNICODE_FRACTIONS: Record<string, number> = {
  '⅛': 0.125, '¼': 0.25, '⅜': 0.375, '½': 0.5, '⅝': 0.625, '¾': 0.75, '⅞': 0.875,
  '⅓': 1 / 3, '⅔': 2 / 3, '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 1 / 6, '⅚': 5 / 6,
};

/** Parse a single dimension token ("33⅛\" W", "40 3/8\"", "35.75") into inches. */
function parseInches(raw: string): number | undefined {
  if (!raw) return undefined;
  let s = raw.split('(')[0]; // drop parenthetical notes
  s = s.replace(/[”"″'']/g, ' ').replace(/[A-Za-z]/g, ' ');
  // unicode fractions → decimal, attaching to any preceding whole number
  s = s.replace(/(\d*)\s*([⅛¼⅜½⅝¾⅞⅓⅔⅕⅖⅗⅘⅙⅚])/g, (_m, whole: string, fr: string) =>
    String((whole ? parseInt(whole, 10) : 0) + UNICODE_FRACTIONS[fr])
  );
  s = s.trim();
  let m = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/); // mixed "33 1/8"
  if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / parseInt(m[3], 10);
  m = s.match(/^(\d+)\s*\/\s*(\d+)/); // bare fraction "5/8"
  if (m) return parseInt(m[1], 10) / parseInt(m[2], 10);
  m = s.match(/^(\d+(?:\.\d+)?)/); // decimal / integer
  return m ? parseFloat(m[1]) : undefined;
}

/** Parse "W x D x H" into [w, d, h] inches (missing parts → undefined). */
function parseDims(raw: string): [number?, number?, number?] {
  if (isBlankish(raw)) return [undefined, undefined, undefined];
  const parts = raw.split(/\s*[x×]\s*/i);
  return [parseInches(parts[0] ?? ''), parseInches(parts[1] ?? ''), parseInches(parts[2] ?? '')];
}

/** Parse the first dollar amount in a cell ("$4,299.00 (NG) / $4,099 (LP)" → 4299). */
function parseMoneyCell(raw: string): number | undefined {
  if (isBlankish(raw)) return undefined;
  const m = raw.match(/\$?\s*([\d,]+(?:\.\d+)?)/);
  if (!m) return undefined;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

/** A SKU-like token: no spaces, at least one digit, length ≥ 3. */
function isSkuLike(tok: string): boolean {
  const t = tok.replace(/[”"″'']/g, '').trim();
  return /^[A-Za-z0-9][A-Za-z0-9\-/]{2,}$/.test(t) && /\d/.test(t);
}

/** Pull a clean jacket model number out of a messy cell, or undefined. */
function cleanSku(raw: string): string | undefined {
  if (isBlankish(raw)) return undefined;
  const before = raw.split('(')[0].replace(/[”"″'']/g, '').trim();
  if (isSkuLike(before)) return before;
  // otherwise scan parenthesized tokens for the first SKU-like one
  for (const inside of raw.match(/\(([^)]*)\)/g) ?? []) {
    for (const tok of inside.replace(/[()]/g, '').split(/[\s,]+/)) {
      if (isSkuLike(tok)) return tok.replace(/[”"″'']/g, '');
    }
  }
  return undefined;
}

export interface CsvParseResult {
  items: ApplianceItem[];
  errors: string[];
}

/** Strip parenthetical notes from a model number, keeping the first variant. */
function cleanModel(raw: string): string {
  return raw.split('(')[0].trim();
}

/**
 * Parse the appliance inventory CSV. Auto-detects the BBQ source export (one row
 * per appliance with its matching insulated jacket inline) vs. the simpler
 * internal flat format. Produces appliance items plus deduped liner items
 * (carrying cutout dimensions), wires each appliance to its liner, and returns
 * human-readable notes for rows that were skipped or couldn't be fully resolved.
 */
export function parseAppliancesCsv(text: string): CsvParseResult {
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (rows.length === 0) return { items: [], errors: ['The file is empty.'] };

  const header = splitCsvLine(rows[0]).map((h) => h.toLowerCase());
  const isBbq = header.some((h) => h.includes('appliance type')) && header.some((h) => h.includes('jacket'));
  return isBbq ? parseBbqCsv(rows.slice(1)) : parseFlatCsv(rows, header);
}

/** The real BBQ database export: appliance + matching jacket per row. */
function parseBbqCsv(dataRows: string[]): CsvParseResult {
  const errors: string[] = [];
  const liners = new Map<string, ApplianceItem>();
  const appliances: ApplianceItem[] = [];
  const seen = new Set<string>();

  dataRows.forEach((line, n) => {
    const c = splitCsvLine(line);
    const brand = c[0] ?? '';
    const cat = normCat(c[1] ?? '');
    const modelName = c[2] ?? '';
    const modelNum = cleanModel(c[3] ?? '');
    const price = parseMoneyCell(c[4] ?? '');
    const jacketSku = cleanSku(c[5] ?? '');
    const jacketPrice = parseMoneyCell(c[6] ?? '');
    const [cw, cd, ch] = parseDims(c[8] ?? '');
    const where = `${brand} ${modelName}`.trim() || `row ${n + 1}`;

    // Build / merge the liner (jacket) first so the appliance can reference it.
    let linerId: string | undefined;
    if (brand && jacketSku) {
      linerId = applianceId(brand, jacketSku);
      const existing = liners.get(linerId);
      if (!existing) {
        liners.set(linerId, {
          id: linerId,
          category: 'liner',
          brand,
          model: jacketSku,
          name: 'Insulated liner',
          msrp: jacketPrice ?? 0,
          cutoutW: cw,
          cutoutD: cd,
          cutoutH: ch,
          active: true,
        });
      } else {
        // fill any gaps from a later row that has more detail
        if (!existing.msrp && jacketPrice) existing.msrp = jacketPrice;
        if (existing.cutoutW === undefined && cw !== undefined) existing.cutoutW = cw;
        if (existing.cutoutD === undefined && cd !== undefined) existing.cutoutD = cd;
        if (existing.cutoutH === undefined && ch !== undefined) existing.cutoutH = ch;
      }
    }

    if (!cat) {
      errors.push(`${where}: unrecognized appliance type "${c[1] ?? ''}" — skipped.`);
      return;
    }
    if (price === undefined || isBlankish(modelNum)) {
      errors.push(`${where}: no usable model/price — appliance skipped (liner kept if present).`);
      return;
    }
    const id = applianceId(brand, modelNum || modelName);
    if (seen.has(id)) return; // duplicate gas-type row (LP/NG)
    seen.add(id);
    appliances.push({ id, category: cat, brand, model: modelNum, name: modelName, msrp: price, linerId, active: true });
  });

  return { items: [...appliances, ...liners.values()], errors };
}

const FLAT_HEADERS = ['category', 'brand', 'model', 'name', 'msrp', 'liner_model', 'cutout_w', 'cutout_d', 'cutout_h', 'panel_charge'] as const;

/** The internal flat format (what appliancesToCsv writes). */
function parseFlatCsv(rows: string[], header: string[]): CsvParseResult {
  const errors: string[] = [];
  const norm = header.map((h) => h.replace(/[^a-z_]/g, ''));
  const hasHeader = FLAT_HEADERS.some((h) => norm.includes(h));
  const idx: Record<string, number> = {};
  FLAT_HEADERS.forEach((h, i) => (idx[h] = hasHeader ? norm.indexOf(h) : i));
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const pending: { item: ApplianceItem; linerModel: string }[] = [];
  dataRows.forEach((line, n) => {
    const cells = splitCsvLine(line);
    const get = (k: string) => (idx[k] >= 0 ? cells[idx[k]] ?? '' : '');
    const cat = normCat(get('category'));
    const brand = get('brand');
    const model = get('model');
    if (!cat) return errors.push(`Row ${n + 1}: unknown category "${get('category')}".`) as unknown as void;
    if (!brand || !model) return errors.push(`Row ${n + 1}: brand and model are required.`) as unknown as void;
    const msrp = parseMoneyCell(get('msrp')) ?? 0;
    const item: ApplianceItem = {
      id: applianceId(brand, model),
      category: cat,
      brand,
      model,
      name: get('name'),
      msrp,
      cutoutW: parseInches(get('cutout_w')),
      cutoutD: parseInches(get('cutout_d')),
      cutoutH: parseInches(get('cutout_h')),
      panelCharge: parseMoneyCell(get('panel_charge')),
      active: true,
    };
    pending.push({ item, linerModel: get('liner_model') });
  });

  const byModel = new Map(pending.map((p) => [p.item.model.toLowerCase(), p.item.id]));
  const items = pending.map(({ item, linerModel }) => {
    if (linerModel) {
      const linerId = byModel.get(linerModel.toLowerCase());
      if (linerId) item.linerId = linerId;
      else errors.push(`${item.brand} ${item.model}: liner model "${linerModel}" not found.`);
    }
    return item;
  });
  return { items, errors };
}

function csvCell(v: string | number | undefined): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize the inventory to the internal flat CSV (round-trips parseAppliancesCsv). */
export function appliancesToCsv(items: ApplianceItem[]): string {
  const byId = new Map(items.map((a) => [a.id, a]));
  const lines = [FLAT_HEADERS.join(',')];
  for (const a of items) {
    const linerModel = a.linerId ? byId.get(a.linerId)?.model ?? '' : '';
    lines.push(
      [a.category, a.brand, a.model, a.name, a.msrp, linerModel, a.cutoutW ?? '', a.cutoutD ?? '', a.cutoutH ?? '', a.panelCharge ?? '']
        .map(csvCell)
        .join(',')
    );
  }
  return lines.join('\n');
}
