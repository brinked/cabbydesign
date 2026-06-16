// A dealer's own profile: margin % + report pricing preferences.
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { requireAuth } from '../auth.ts';
import { prefsFor } from '../shape.ts';

export const profileRouter = Router();
profileRouter.use(requireAuth);

const prefsSchema = z.object({
  marginPct: z.number().min(0).max(1000),
  showPricing: z.boolean(),
  priceMode: z.enum(['cost', 'marked_up']),
});

// Ensure a prefs row exists, then update it.
const ensurePrefs = db.prepare('INSERT OR IGNORE INTO dealer_prefs (user_id) VALUES (?)');
const updatePrefs = db.prepare(`
  UPDATE dealer_prefs SET margin_pct = @marginPct, show_pricing = @showPricing,
    price_mode = @priceMode, updated_at = datetime('now') WHERE user_id = @userId
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
  updatePrefs.run({
    userId,
    marginPct: parsed.data.marginPct,
    showPricing: parsed.data.showPricing ? 1 : 0,
    priceMode: parsed.data.priceMode,
  });
  res.json({ prefs: prefsFor(userId) });
});
