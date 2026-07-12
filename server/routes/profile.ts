// A dealer's own profile: margin % + report pricing preferences.
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { requireAuth } from '../auth.ts';
import { catalogPrefsFor, certInfoFor, logoFor, ownAppliancesFor, prefsFor } from '../shape.ts';
import { appliancesSchema } from './settings.ts';

export const profileRouter = Router();
profileRouter.use(requireAuth);

// ---- Cabinet-company catalog customization (role 'company' only) ----
const catalogPrefsSchema = z.object({
  hiddenCabinets: z.array(z.string().max(120)).max(1000).default([]),
  hiddenHandles: z.array(z.string().max(120)).max(1000).default([]),
  hiddenFinishes: z.array(z.string().max(120)).max(1000).default([]),
  customFinishes: z
    .array(z.object({ id: z.string().min(1).max(120), name: z.string().min(1).max(120), body: z.string().regex(/^#[0-9a-fA-F]{6}$/) }))
    .max(200)
    .default([]),
  customHandles: z
    .array(z.object({ id: z.string().min(1).max(120), name: z.string().min(1).max(200), price: z.number().min(0).max(100000) }))
    .max(200)
    .default([]),
});

profileRouter.get('/catalog-prefs', (req, res) => {
  res.json({ catalogPrefs: catalogPrefsFor(req.user!) });
});

profileRouter.put('/catalog-prefs', (req, res) => {
  if (req.user!.role !== 'company' && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Only cabinet company accounts can customize the catalog' });
    return;
  }
  const parsed = catalogPrefsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid catalog preferences' });
    return;
  }
  db.prepare("UPDATE users SET catalog_prefs = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(parsed.data), req.user!.id);
  res.json({ catalogPrefs: parsed.data });
});

const prefsSchema = z.object({
  marginPct: z.number().min(0).max(1000),
  showPricing: z.boolean(),
  priceMode: z.enum(['cost', 'marked_up']),
  markupMode: z.enum(['percent', 'flat']),
  flatAmount: z.number().min(0).max(100000),
  // brands the dealer hides from their own offering
  hiddenBrands: z.array(z.string().max(120)).max(2000).optional(),
  // taxExempt is intentionally NOT accepted here — only an admin can set it.
});

// Ensure a prefs row exists, then update it (tax_exempt left untouched).
const ensurePrefs = db.prepare('INSERT OR IGNORE INTO dealer_prefs (user_id) VALUES (?)');
const updatePrefs = db.prepare(`
  UPDATE dealer_prefs SET margin_pct = @marginPct, show_pricing = @showPricing,
    price_mode = @priceMode, markup_mode = @markupMode, flat_amount = @flatAmount,
    hidden_brands = @hiddenBrands, updated_at = datetime('now') WHERE user_id = @userId
`);

profileRouter.get('/prefs', (req, res) => {
  res.json({ prefs: prefsFor(req.user!.id) });
});

profileRouter.put('/prefs', (req, res) => {
  const parsed = prefsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid preferences' });
    return;
  }
  const userId = req.user!.id;
  ensurePrefs.run(userId);
  const hidden = [...new Set(parsed.data.hiddenBrands ?? [])];
  updatePrefs.run({
    userId,
    marginPct: parsed.data.marginPct,
    showPricing: parsed.data.showPricing ? 1 : 0,
    priceMode: parsed.data.priceMode,
    markupMode: parsed.data.markupMode,
    flatAmount: parsed.data.flatAmount,
    hiddenBrands: JSON.stringify(hidden),
  });
  res.json({ prefs: prefsFor(userId) });
});

// ---- Dealer's own appliance/liner inventory (added on top of admin global) ----
const updateOwnAppliances = db.prepare(`
  UPDATE dealer_prefs SET own_appliances = @json, updated_at = datetime('now') WHERE user_id = @userId
`);

profileRouter.get('/appliances', (req, res) => {
  res.json({ appliances: ownAppliancesFor(req.user!.id) });
});

profileRouter.put('/appliances', (req, res) => {
  const parsed = appliancesSchema.safeParse(req.body?.appliances ?? req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid appliance inventory' });
    return;
  }
  const userId = req.user!.id;
  ensurePrefs.run(userId);
  updateOwnAppliances.run({ userId, json: JSON.stringify(parsed.data) });
  res.json({ appliances: parsed.data });
});

// ---- Resale tax certificate (image or PDF data URL, ~3 MB cap) ----
const MAX_CERT_CHARS = 4_200_000; // ~3 MB
const certSchema = z.object({
  cert: z
    .string()
    .max(MAX_CERT_CHARS, 'File is too large — please use one under 3 MB.')
    .refine((s) => s === '' || /^data:(image\/(png|jpe?g|gif|webp)|application\/pdf);base64,/.test(s), 'Must be a PDF or image.'),
  name: z.string().max(200).default(''),
});

const upsertCert = db.prepare(`
  INSERT INTO dealer_branding (user_id, resale_cert, resale_cert_name) VALUES (@userId, @cert, @name)
  ON CONFLICT(user_id) DO UPDATE SET resale_cert = excluded.resale_cert,
    resale_cert_name = excluded.resale_cert_name, updated_at = datetime('now')
`);
const getCertData = db.prepare('SELECT resale_cert, resale_cert_name FROM dealer_branding WHERE user_id = ?');

profileRouter.put('/cert', (req, res) => {
  const parsed = certSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid certificate' });
    return;
  }
  upsertCert.run({ userId: req.user!.id, cert: parsed.data.cert, name: parsed.data.cert ? parsed.data.name : '' });
  res.json({ cert: certInfoFor(req.user!.id) });
});

// Download/preview the signed-in dealer's own certificate.
profileRouter.get('/cert', (req, res) => {
  const row = getCertData.get(req.user!.id) as { resale_cert: string; resale_cert_name: string } | undefined;
  if (!row?.resale_cert) {
    res.status(404).json({ error: 'No certificate uploaded' });
    return;
  }
  res.json({ cert: row.resale_cert, name: row.resale_cert_name });
});

// ---- Company logo (shown on the dealer's customer reports) ----
// Stored as a data URL. ~1 MB cap keeps the DB and report payloads sane.
const MAX_LOGO_CHARS = 1_400_000; // ~1 MB once base64-encoded
const logoSchema = z.object({
  // empty string clears the logo; otherwise must be an image data URL
  logo: z
    .string()
    .max(MAX_LOGO_CHARS, 'Logo is too large — please use an image under 1 MB.')
    .refine((s) => s === '' || /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/.test(s), 'Must be a PNG, JPG, GIF, WEBP, or SVG image.'),
});

const upsertLogo = db.prepare(`
  INSERT INTO dealer_branding (user_id, logo) VALUES (@userId, @logo)
  ON CONFLICT(user_id) DO UPDATE SET logo = excluded.logo, updated_at = datetime('now')
`);

profileRouter.put('/logo', (req, res) => {
  const parsed = logoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid logo' });
    return;
  }
  upsertLogo.run({ userId: req.user!.id, logo: parsed.data.logo });
  res.json({ logo: logoFor(req.user!.id) });
});
