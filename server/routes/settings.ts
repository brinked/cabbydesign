// Global app settings. Currently the admin-controlled cabinet dimension limits.
// Stored as a single JSON blob under app_settings('cabinetDims').
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { requireAdmin } from '../auth.ts';

export const settingsRouter = Router();

const CABINET_DIMS_KEY = 'cabinetDims';
const PRICING_KEY = 'pricing';
const TAX_RATE_KEY = 'taxRate';
const APPLIANCES_KEY = 'appliances';
const APPLIANCE_BRANDS_KEY = 'applianceBrands';
const DEFAULT_TAX_RATE = 6.5; // Florida

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
const appliancesSchema = z.array(applianceSchema).max(5000);

settingsRouter.get('/appliances', (_req, res) => {
  res.json({ appliances: readArray(APPLIANCES_KEY) });
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
