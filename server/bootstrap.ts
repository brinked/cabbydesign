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
