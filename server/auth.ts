// Password hashing + JWT session helpers + route guards.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { config, COOKIE_NAME } from './config.ts';
import { db, type UserRow } from './db.ts';

export interface SessionUser {
  id: number;
  role: 'admin' | 'dealer';
}

// bcryptjs verifies legacy PHP `$2y$` hashes too (it normalizes the prefix).
export function verifyPassword(plain: string, hash: string): boolean {
  // Normalize $2y$ (PHP) to $2a$ which bcryptjs understands identically.
  const normalized = hash.startsWith('$2y$') ? '$2a$' + hash.slice(4) : hash;
  return bcrypt.compareSync(plain, normalized);
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function signSession(user: SessionUser): string {
  return jwt.sign(user, config.jwtSecret, { expiresIn: `${config.sessionDays}d` });
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME);
}

// Augment Express Request with the resolved user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

const getUser = db.prepare('SELECT * FROM users WHERE id = ?');

/** Resolve the session cookie into req.user (or leave undefined). */
export function loadSession(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret) as SessionUser;
      const row = getUser.get(payload.id) as UserRow | undefined;
      if (row && row.active) req.user = row;
    } catch {
      // invalid/expired token — treat as logged out
    }
  }
  next();
}

/** Require any authenticated, active user. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  next();
}

/** Require an admin user. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  next();
}
