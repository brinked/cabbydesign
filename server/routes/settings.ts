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
