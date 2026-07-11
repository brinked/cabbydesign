// Cloud first-login helper. If ADMIN_EMAIL + ADMIN_PASSWORD are set in the
// environment, ensure that admin exists with that password on every boot. This
// guarantees you can sign in to a fresh server (e.g. on Render) without shell
// access. Remove the env vars once you've set a real password from the UI.
import { db, type UserRow } from './db.ts';
import { hashPassword } from './auth.ts';
import { importDealers } from './seed.ts';

/**
 * Seed dealers from importdealers.txt on startup (idempotent — existing emails
 * are skipped). Runs in the live process against the real database, so it works
 * reliably on hosts where the persistent disk only mounts at runtime.
 * Set SKIP_DEALER_IMPORT=1 to disable.
 */
export function bootstrapDealers(): void {
  if (process.env.SKIP_DEALER_IMPORT === '1') return;
  const result = importDealers();
  if (result && result.added > 0) {
    console.log(`[bootstrap] imported ${result.added} dealer(s) (${result.skipped} already present).`);
  }
}

/** Built-in grill/griddle inventory (imported from the original tool) — the
 *  units the app carries brand-accurate 3D models for. Seeded only when the
 *  appliances setting is missing/empty; the admin panel owns it afterwards. */
const DEFAULT_APPLIANCES = [
  { id: 'blz32', category: 'grill', brand: 'Blaze', model: 'BLZ-4-LTE2', name: 'LTE 32', msrp: 2000 },
  { id: 'blz40', category: 'grill', brand: 'Blaze', model: 'BLZ-5-LTE2', name: 'LTE 40"', msrp: 2200 },
  { id: 'blzpro', category: 'grill', brand: 'Blaze', model: 'BLZ-5-LTE-PRO', name: 'LTE Pro 40"', msrp: 2600 },
  { id: 'nap32', category: 'grill', brand: 'Napoleon', model: 'BIG32', name: '700 BIG32', msrp: 3000 },
  { id: 'nap38', category: 'grill', brand: 'Napoleon', model: 'BIG38', name: '700 BIG38', msrp: 3400 },
  { id: 'nap44', category: 'grill', brand: 'Napoleon', model: 'BIG44', name: '700 BIG44', msrp: 3800 },
  { id: 'xo32', category: 'grill', brand: 'XO', model: 'XLT32', name: 'XLT 32', msrp: 2500 },
  { id: 'xo40', category: 'grill', brand: 'XO', model: 'XLT40', name: 'XLT 40"', msrp: 2700 },
  { id: 'lg75', category: 'griddle', brand: 'Le Griddle', model: 'OML75', name: 'Commercial 75', msrp: 1800 },
  { id: 'lg105', category: 'griddle', brand: 'Le Griddle', model: 'OML105', name: 'Commercial 105', msrp: 2100 },
];

export function bootstrapAppliances(): void {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'appliances'").get() as { value: string } | undefined;
  const existing = row ? (JSON.parse(row.value) as unknown[]) : [];
  if (Array.isArray(existing) && existing.length > 0) return;
  db.prepare(
    "INSERT INTO app_settings (key, value) VALUES ('appliances', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(JSON.stringify(DEFAULT_APPLIANCES));
  console.log(`[bootstrap] seeded ${DEFAULT_APPLIANCES.length} default grill/griddle appliances.`);
}

export function bootstrapAdmin(): void {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  if (password.length < 8) {
    console.warn('[bootstrap] ADMIN_PASSWORD must be at least 8 characters — skipping.');
    return;
  }
  const existing = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email) as UserRow | undefined;
  if (existing) {
    db.prepare("UPDATE users SET password_hash = ?, role = 'admin', active = 1, updated_at = datetime('now') WHERE id = ?").run(
      hashPassword(password),
      existing.id
    );
    console.log(`[bootstrap] ensured admin + reset password for ${email}`);
  } else {
    db.prepare("INSERT INTO users (name, email, role, password_hash, active) VALUES (?, ?, 'admin', ?, 1)").run(
      'Administrator',
      email,
      hashPassword(password)
    );
    console.log(`[bootstrap] created admin ${email}`);
  }
}
