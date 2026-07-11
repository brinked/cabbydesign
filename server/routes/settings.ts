// Global app settings. Currently the admin-controlled cabinet dimension limits.
// Stored as a single JSON blob under app_settings('cabinetDims').
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { requireAdmin } from '../auth.ts';
import { hiddenBrandsFor, ownAppliancesFor } from '../shape.ts';

export const settingsRouter = Router();

const CABINET_DIMS_KEY = 'cabinetDims';
const PRICING_KEY = 'pricing';
const RETAIL_PRICING_KEY = 'retailPricing';
const TAX_RATE_KEY = 'taxRate';
const LINER_CLEARANCE_KEY = 'linerClearance';
const APPLIANCES_KEY = 'appliances';
const APPLIANCE_BRANDS_KEY = 'applianceBrands';
const RESTRICTED_BRANDS_KEY = 'restrictedBrands';
const HANDLES_KEY = 'handles';
const MODEL_ALIGNS_KEY = 'modelAligns';
const DEFAULT_TAX_RATE = 6.5; // Florida
/** Grill/griddle/burner cabinet must be this much wider than its liner cutout (inches). */
const DEFAULT_LINER_CLEARANCE = 4;

const getSetting = db.prepare('SELECT value FROM app_settings WHERE key = ?');
const upsertSetting = db.prepare(
  'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);

function readJson(key: string): Record<string, unknown> {
  const row = getSetting.get(key) as { value: string } | undefined;
  if (!row) return {};
  try {
    return JSON.parse(row.value);
  } catch {
    return {};
  }
}

// catalogId -> partial override. Values are numbers (inches); blanks are omitted.
const dimOverride = z
  .object({
    minW: z.number().positive().optional(),
    maxW: z.number().positive().optional(),
    minD: z.number().positive().optional(),
    maxD: z.number().positive().optional(),
  })
  .strict();

const dimsSchema = z.record(z.string(), dimOverride);

// Anyone logged in can READ the dim limits (the designer needs them).
settingsRouter.get('/cabinet-dims', (_req, res) => {
  res.json({ dims: readJson(CABINET_DIMS_KEY) });
});

// Only admins can WRITE them.
settingsRouter.put('/cabinet-dims', requireAdmin, (req, res) => {
  const parsed = dimsSchema.safeParse(req.body?.dims ?? req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid dimension overrides' });
    return;
  }
  // Drop empty override objects so the blob stays tidy.
  const clean: Record<string, unknown> = {};
  for (const [id, ov] of Object.entries(parsed.data)) {
    if (ov && Object.keys(ov).length > 0) clean[id] = ov;
  }
  upsertSetting.run(CABINET_DIMS_KEY, JSON.stringify(clean));
  res.json({ dims: clean });
});

// Admin-controlled base box pricing formulas (catalogId -> formula string).
// This is the dealer's COST basis; dealers mark it up with their margin.
const pricingSchema = z.record(z.string(), z.string().max(200));

settingsRouter.get('/pricing', (_req, res) => {
  res.json({ pricing: readJson(PRICING_KEY) });
});

settingsRouter.put('/pricing', requireAdmin, (req, res) => {
  const parsed = pricingSchema.safeParse(req.body?.pricing ?? req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid pricing formulas' });
    return;
  }
  const clean: Record<string, string> = {};
  for (const [id, f] of Object.entries(parsed.data)) {
    if (f && f.trim()) clean[id] = f.trim();
  }
  upsertSetting.run(PRICING_KEY, JSON.stringify(clean));
  res.json({ pricing: clean });
});

// ---- Retail price formulas (the basis for contractor "% off retail"). ----
settingsRouter.get('/retail-pricing', (_req, res) => {
  res.json({ retailPricing: readJson(RETAIL_PRICING_KEY) });
});

settingsRouter.put('/retail-pricing', requireAdmin, (req, res) => {
  const parsed = pricingSchema.safeParse(req.body?.retailPricing ?? req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid retail pricing formulas' });
    return;
  }
  const clean: Record<string, string> = {};
  for (const [id, f] of Object.entries(parsed.data)) {
    if (f && f.trim()) clean[id] = f.trim();
  }
  upsertSetting.run(RETAIL_PRICING_KEY, JSON.stringify(clean));
  res.json({ retailPricing: clean });
});

// ---- Global sales-tax rate (percent). Readable by all; admin-writable. ----
function readTaxRate(): number {
  const row = getSetting.get(TAX_RATE_KEY) as { value: string } | undefined;
  if (!row) return DEFAULT_TAX_RATE;
  const n = Number(row.value);
  return Number.isFinite(n) ? n : DEFAULT_TAX_RATE;
}

settingsRouter.get('/tax', (_req, res) => {
  res.json({ rate: readTaxRate() });
});

settingsRouter.put('/tax', requireAdmin, (req, res) => {
  const parsed = z.object({ rate: z.number().min(0).max(100) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Tax rate must be between 0 and 100' });
    return;
  }
  upsertSetting.run(TAX_RATE_KEY, String(parsed.data.rate));
  res.json({ rate: parsed.data.rate });
});

// ---- Liner clearance: minimum extra cabinet width over the insulated-liner
// cutout (inches). Readable by all logged-in users; admin-writable. ----
function readLinerClearance(): number {
  const row = getSetting.get(LINER_CLEARANCE_KEY) as { value: string } | undefined;
  if (!row) return DEFAULT_LINER_CLEARANCE;
  const n = Number(row.value);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LINER_CLEARANCE;
}

settingsRouter.get('/liner-clearance', (_req, res) => {
  res.json({ clearance: readLinerClearance() });
});

settingsRouter.put('/liner-clearance', requireAdmin, (req, res) => {
  const parsed = z.object({ clearance: z.number().min(0).max(24) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Liner clearance must be between 0 and 24 inches' });
    return;
  }
  upsertSetting.run(LINER_CLEARANCE_KEY, String(parsed.data.clearance));
  res.json({ clearance: parsed.data.clearance });
});

// ---- Panel rates: $/sqft for applied end / island back panels and finished
// ends. Readable by all logged-in users; admin-writable. ----
const PANEL_RATES_KEY = 'panelRates';
const DEFAULT_PANEL_RATES = { applied: 36, finished: 45 };
const panelRatesSchema = z.object({
  applied: z.number().min(0).max(10_000),
  finished: z.number().min(0).max(10_000),
});

function readPanelRates(): { applied: number; finished: number } {
  const row = getSetting.get(PANEL_RATES_KEY) as { value: string } | undefined;
  if (!row) return DEFAULT_PANEL_RATES;
  try {
    const parsed = panelRatesSchema.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : DEFAULT_PANEL_RATES;
  } catch {
    return DEFAULT_PANEL_RATES;
  }
}

settingsRouter.get('/panel-rates', (_req, res) => {
  res.json({ rates: readPanelRates() });
});

settingsRouter.put('/panel-rates', requireAdmin, (req, res) => {
  const parsed = panelRatesSchema.safeParse(req.body?.rates ?? req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Panel rates must be numbers ≥ 0' });
    return;
  }
  upsertSetting.run(PANEL_RATES_KEY, JSON.stringify(parsed.data));
  res.json({ rates: parsed.data });
});

// ---- Appliance inventory (admin-managed; readable by all logged-in users) ----
function readArray(key: string): unknown[] {
  const row = getSetting.get(key) as { value: string } | undefined;
  if (!row) return [];
  try {
    const v = JSON.parse(row.value);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

const applianceSchema = z.object({
  id: z.string().min(1).max(120),
  category: z.enum(['grill', 'griddle', 'sideburner', 'powerburner', 'kamado', 'fridge', 'icemaker', 'liner']),
  brand: z.string().min(1).max(120),
  model: z.string().min(1).max(120),
  name: z.string().max(200).default(''),
  msrp: z.number().min(0).max(1_000_000),
  linerId: z.string().max(120).optional(),
  cutoutW: z.number().min(0).max(200).optional(),
  cutoutD: z.number().min(0).max(200).optional(),
  cutoutH: z.number().min(0).max(200).optional(),
  panelCharge: z.number().min(0).max(1_000_000).optional(),
  active: z.boolean().optional(),
});
// Exported so the dealer profile route can validate a dealer's own inventory.
export const appliancesSchema = z.array(applianceSchema).max(5000);

// A brand can be restricted to specific accounts (brand -> allowed user ids).
// An unrestricted brand (absent / empty list) is visible to everyone.
function readRestrictedBrands(): Record<string, number[]> {
  const raw = readJson(RESTRICTED_BRANDS_KEY);
  const out: Record<string, number[]> = {};
  for (const [b, ids] of Object.entries(raw)) if (Array.isArray(ids)) out[b] = ids as number[];
  return out;
}

settingsRouter.get('/appliances', (req, res) => {
  const all = readArray(APPLIANCES_KEY) as Array<{ id?: string; brand?: string }>;
  // Admins (and the inventory editor) see only the shared global inventory.
  if (req.user?.role === 'admin') {
    res.json({ appliances: all });
    return;
  }
  const restricted = readRestrictedBrands();
  const uid = req.user?.id;
  // Global items minus brands restricted away from this account.
  const merged = all.filter((a) => {
    const allow = restricted[a.brand ?? ''];
    return !allow || allow.length === 0 || (uid !== undefined && allow.includes(uid));
  });
  // Add the dealer's own appliances (own id overrides a same-id global).
  if (uid !== undefined) {
    const own = ownAppliancesFor(uid) as Array<{ id?: string; brand?: string }>;
    for (const a of own) {
      const i = merged.findIndex((x) => x.id === a.id);
      if (i >= 0) merged[i] = a;
      else merged.push(a);
    }
    // Drop brands the dealer has hidden.
    const hidden = new Set(hiddenBrandsFor(uid));
    if (hidden.size) {
      res.json({ appliances: merged.filter((a) => !hidden.has(a.brand ?? '')) });
      return;
    }
  }
  res.json({ appliances: merged });
});

settingsRouter.put('/appliances', requireAdmin, (req, res) => {
  const parsed = appliancesSchema.safeParse(req.body?.appliances ?? req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid appliance inventory' });
    return;
  }
  upsertSetting.run(APPLIANCES_KEY, JSON.stringify(parsed.data));
  res.json({ appliances: parsed.data });
});

// Per-brand manufacturer discount (the dealer automatically gets half).
const brandsSchema = z.record(z.string(), z.object({ discountPct: z.number().min(0).max(100) }));

settingsRouter.get('/appliance-brands', (_req, res) => {
  res.json({ brands: readJson(APPLIANCE_BRANDS_KEY) });
});

settingsRouter.put('/appliance-brands', requireAdmin, (req, res) => {
  const parsed = brandsSchema.safeParse(req.body?.brands ?? req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid brand discounts' });
    return;
  }
  upsertSetting.run(APPLIANCE_BRANDS_KEY, JSON.stringify(parsed.data));
  res.json({ brands: parsed.data });
});

// Cabinet handle / hardware inventory (admin-managed, visible to everyone).
const handleSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().max(200).default(''),
  photo: z.string().max(3_000_000).optional(),
  retail: z.number().min(0).max(1_000_000),
  dealer: z.number().min(0).max(1_000_000),
  active: z.boolean().optional(),
});
const handlesSchema = z.array(handleSchema).max(2000);

settingsRouter.get('/handles', (_req, res) => {
  res.json({ handles: readArray(HANDLES_KEY) });
});

settingsRouter.put('/handles', requireAdmin, (req, res) => {
  const parsed = handlesSchema.safeParse(req.body?.handles ?? req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid handle inventory' });
    return;
  }
  upsertSetting.run(HANDLES_KEY, JSON.stringify(parsed.data));
  res.json({ handles: parsed.data });
});

// Per-model 3D placement overrides (admin aligner). Map of modelKey -> nudge.
const modelAlignSchema = z.object({
  yaw: z.number().min(-360).max(360).optional(),
  pitch: z.number().min(-360).max(360).optional(),
  roll: z.number().min(-360).max(360).optional(),
  dx: z.number().min(-60).max(60).optional(),
  dy: z.number().min(-60).max(60).optional(),
  dz: z.number().min(-60).max(60).optional(),
  scale: z.number().min(0.2).max(3).optional(),
});
const modelAlignsSchema = z.record(z.string().min(1).max(120), modelAlignSchema);

settingsRouter.get('/model-aligns', (_req, res) => {
  res.json({ modelAligns: readJson(MODEL_ALIGNS_KEY) });
});

settingsRouter.put('/model-aligns', requireAdmin, (req, res) => {
  const parsed = modelAlignsSchema.safeParse(req.body?.modelAligns ?? req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid model alignments' });
    return;
  }
  upsertSetting.run(MODEL_ALIGNS_KEY, JSON.stringify(parsed.data));
  res.json({ modelAligns: parsed.data });
});

// Per-brand visibility: brand -> allowed account (user) ids. Admin-only; the
// designer never reads this directly (the appliance list is filtered server-side).
const restrictedBrandsSchema = z.record(z.string(), z.array(z.number().int().positive()));

settingsRouter.get('/restricted-brands', requireAdmin, (_req, res) => {
  res.json({ restrictedBrands: readRestrictedBrands() });
});

settingsRouter.put('/restricted-brands', requireAdmin, (req, res) => {
  const parsed = restrictedBrandsSchema.safeParse(req.body?.restrictedBrands ?? req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid brand visibility' });
    return;
  }
  // Drop empty lists so an unrestricted brand isn't stored at all.
  const clean: Record<string, number[]> = {};
  for (const [b, ids] of Object.entries(parsed.data)) {
    const uniq = [...new Set(ids)];
    if (uniq.length) clean[b] = uniq;
  }
  upsertSetting.run(RESTRICTED_BRANDS_KEY, JSON.stringify(clean));
  res.json({ restrictedBrands: clean });
});
