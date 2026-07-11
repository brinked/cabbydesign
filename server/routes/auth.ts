// Login / current-user / logout / change-password / forgot + reset password.
import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { db, type UserRow } from '../db.ts';
import {
  clearSessionCookie,
  hashPassword,
  requireAuth,
  setSessionCookie,
  signSession,
  verifyPassword,
} from '../auth.ts';
import { config } from '../config.ts';
import { emailEnabled, esc, sendMail } from '../email.ts';
import { catalogPrefsFor, certInfoFor, logoFor, prefsFor, shapeUser } from '../shape.ts';

export const authRouter = Router();

const getByEmail = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)');
const setPassword = db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?");

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }
  const user = getByEmail.get(parsed.data.email) as UserRow | undefined;
  if (!user || !verifyPassword(parsed.data.password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  if (!user.active) {
    res.status(403).json({ error: 'This account has been deactivated' });
    return;
  }
  if (!user.email_verified) {
    res.status(403).json({ error: 'Please verify your email first — check your inbox for the verification link.', code: 'unverified' });
    return;
  }
  setSessionCookie(res, signSession({ id: user.id, role: user.role }));
  res.json({ user: shapeUser(user, logoFor(user.id)), prefs: prefsFor(user.id), cert: certInfoFor(user.id), catalogPrefs: catalogPrefsFor(user) });
});

// ---- Consumer account creation (homeowner / cabinet company) ----

const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().email('A valid email is required').max(200),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  accountType: z.enum(['homeowner', 'company']),
  companyName: z.string().trim().max(200).default(''),
});

async function sendVerifyEmail(email: string, name: string, token: string): Promise<{ sent: boolean }> {
  const link = `${config.appUrl}/?verify=${token}`;
  return sendMail({
    to: email,
    subject: 'Verify your CabDesign email',
    html: `<div style="font-family:system-ui,Arial,sans-serif;color:#1f2430">
      <p>Hi ${esc(name)},</p>
      <p>Welcome to CabDesign! Click below to verify your email and activate your account — this link expires in 24 hours.</p>
      <p><a href="${link}" style="background:#5b5bd6;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Verify my email</a></p>
      <p style="color:#888;font-size:12px">If you didn't create this account, you can ignore this email. Link: ${esc(link)}</p>
    </div>`,
    text: `Verify your CabDesign email (expires in 24 hours): ${link}`,
  });
}

authRouter.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid signup' });
    return;
  }
  const s = parsed.data;
  if (s.accountType === 'company' && !s.companyName) {
    res.status(400).json({ error: 'Company name is required for a cabinet company account' });
    return;
  }
  const existing = getByEmail.get(s.email) as UserRow | undefined;
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists. Sign in instead (or use “Forgot password”).' });
    return;
  }
  // When SMTP isn't configured (local dev) there is no email to click — mark
  // the account verified immediately and sign it in.
  const token = crypto.randomBytes(32).toString('hex');
  const verified = emailEnabled ? 0 : 1;
  const info = db
    .prepare(
      `INSERT INTO users (name, email, role, company_name, password_hash, active, email_verified, verify_token, verify_expires)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, datetime('now', '+24 hours'))`
    )
    .run(s.name, s.email, s.accountType, s.companyName, hashPassword(s.password), verified, verified ? '' : sha256(token));
  if (!verified) {
    await sendVerifyEmail(s.email, s.name, token);
    res.json({ ok: true, needsVerify: true });
    return;
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as UserRow;
  setSessionCookie(res, signSession({ id: user.id, role: user.role }));
  res.json({ ok: true, needsVerify: false, user: shapeUser(user), prefs: prefsFor(user.id), cert: certInfoFor(user.id), catalogPrefs: catalogPrefsFor(user) });
});

// Clicked from the verification email (?verify=token). Marks the account
// verified and signs the user straight in.
authRouter.post('/verify-email', (req, res) => {
  const parsed = z.object({ token: z.string().min(10) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid verification link' });
    return;
  }
  const user = db.prepare('SELECT * FROM users WHERE verify_token = ?').get(sha256(parsed.data.token)) as UserRow | undefined;
  if (!user || !user.verify_expires || new Date(user.verify_expires.replace(' ', 'T') + 'Z') < new Date()) {
    res.status(400).json({ error: 'This verification link is invalid or has expired. Sign in to request a new one.' });
    return;
  }
  db.prepare("UPDATE users SET email_verified = 1, verify_token = '', verify_expires = '', updated_at = datetime('now') WHERE id = ?").run(user.id);
  setSessionCookie(res, signSession({ id: user.id, role: user.role }));
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as UserRow;
  res.json({ ok: true, user: shapeUser(fresh, logoFor(user.id)), prefs: prefsFor(user.id), cert: certInfoFor(user.id), catalogPrefs: catalogPrefsFor(fresh) });
});

// Re-send the verification email. Always returns ok (never reveals accounts).
authRouter.post('/resend-verify', async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (parsed.success) {
    const user = getByEmail.get(parsed.data.email) as UserRow | undefined;
    if (user && user.active && !user.email_verified) {
      const token = crypto.randomBytes(32).toString('hex');
      db.prepare("UPDATE users SET verify_token = ?, verify_expires = datetime('now', '+24 hours') WHERE id = ?").run(sha256(token), user.id);
      await sendVerifyEmail(user.email, user.name, token);
    }
  }
  res.json({ ok: true });
});

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// Current session. Returns null user when logged out (200, not 401) so the SPA
// can boot without throwing.
authRouter.get('/me', (req, res) => {
  if (!req.user) {
    res.json({ user: null });
    return;
  }
  res.json({
    user: shapeUser(req.user, logoFor(req.user.id)),
    prefs: prefsFor(req.user.id),
    cert: certInfoFor(req.user.id),
    catalogPrefs: catalogPrefsFor(req.user),
  });
});

const changePwSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

authRouter.post('/change-password', requireAuth, (req, res) => {
  const parsed = changePwSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'New password must be at least 8 characters' });
    return;
  }
  const user = req.user!;
  if (!verifyPassword(parsed.data.currentPassword, user.password_hash)) {
    res.status(400).json({ error: 'Current password is incorrect' });
    return;
  }
  setPassword.run(hashPassword(parsed.data.newPassword), user.id);
  res.json({ ok: true });
});

// ---- Forgot / reset password (emailed one-time token) ----
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

// Always returns ok (never reveals whether an email exists). When the account
// exists and is active, emails a one-time reset link valid for 1 hour.
authRouter.post('/forgot', async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    res.json({ ok: true });
    return;
  }
  const user = getByEmail.get(parsed.data.email) as UserRow | undefined;
  if (user && user.active) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id);
    db.prepare("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+1 hour'))").run(
      sha256(token),
      user.id
    );
    const link = `${config.appUrl}/?reset=${token}`;
    await sendMail({
      to: user.email,
      subject: 'Reset your CabDesign password',
      html: `<div style="font-family:system-ui,Arial,sans-serif;color:#1f2430">
        <p>Hi ${esc(user.name)},</p>
        <p>We received a request to reset your CabDesign password. Click below to set a new one — this link expires in 1 hour.</p>
        <p><a href="${link}" style="background:#5b5bd6;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Reset password</a></p>
        <p style="color:#888;font-size:12px">If you didn't request this, you can ignore this email. Link: ${esc(link)}</p>
      </div>`,
      text: `Reset your CabDesign password (expires in 1 hour): ${link}`,
    });
  }
  res.json({ ok: true });
});

const resetSchema = z.object({ token: z.string().min(10), newPassword: z.string().min(8) });

authRouter.post('/reset', (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'New password must be at least 8 characters' });
    return;
  }
  const row = db
    .prepare("SELECT user_id, expires_at FROM password_resets WHERE token_hash = ?")
    .get(sha256(parsed.data.token)) as { user_id: number; expires_at: string } | undefined;
  if (!row || new Date(row.expires_at.replace(' ', 'T') + 'Z') < new Date()) {
    res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' });
    return;
  }
  setPassword.run(hashPassword(parsed.data.newPassword), row.user_id);
  db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(row.user_id);
  res.json({ ok: true });
});
