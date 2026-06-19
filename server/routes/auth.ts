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
import { esc, sendMail } from '../email.ts';
import { certInfoFor, logoFor, prefsFor, shapeUser } from '../shape.ts';

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
  setSessionCookie(res, signSession({ id: user.id, role: user.role }));
  res.json({ user: shapeUser(user, logoFor(user.id)), prefs: prefsFor(user.id), cert: certInfoFor(user.id) });
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
  res.json({ user: shapeUser(req.user, logoFor(req.user.id)), prefs: prefsFor(req.user.id), cert: certInfoFor(req.user.id) });
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
