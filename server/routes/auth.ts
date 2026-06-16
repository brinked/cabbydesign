// Login / current-user / logout / change-password.
import { Router } from 'express';
import { z } from 'zod';
import { db, type UserRow } from '../db.ts';
import {
  clearSessionCookie,
  hashPassword,
  requireAuth,
  setSessionCookie,
  signSession,
  verifyPassword,
} from '../auth.ts';
import { logoFor, prefsFor, shapeUser } from '../shape.ts';

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
  res.json({ user: shapeUser(user, logoFor(user.id)), prefs: prefsFor(user.id) });
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
  res.json({ user: shapeUser(req.user, logoFor(req.user.id)), prefs: prefsFor(req.user.id) });
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
