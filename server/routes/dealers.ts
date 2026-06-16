// Admin CRUD over dealer accounts.
import { Router } from 'express';
import { z } from 'zod';
import { db, type UserRow } from '../db.ts';
import { hashPassword, requireAdmin } from '../auth.ts';
import { prefsFor, shapeUser } from '../shape.ts';

export const dealersRouter = Router();
dealersRouter.use(requireAdmin);

const listUsers = db.prepare("SELECT * FROM users ORDER BY role = 'admin' DESC, name COLLATE NOCASE");
const getUser = db.prepare('SELECT * FROM users WHERE id = ?');
const getByEmail = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)');

const insertUser = db.prepare(`
  INSERT INTO users (name, email, role, company_name, company_slogan, address, phone, password_hash, active)
  VALUES (@name, @email, @role, @company_name, @company_slogan, @address, @phone, @password_hash, @active)
`);

dealersRouter.get('/', (_req, res) => {
  const rows = listUsers.all() as UserRow[];
  res.json({ dealers: rows.map((u) => ({ ...shapeUser(u), prefs: prefsFor(u.id) })) });
});

const upsertSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  role: z.enum(['admin', 'dealer']).default('dealer'),
  companyName: z.string().max(160).default(''),
  companySlogan: z.string().max(160).default(''),
  address: z.string().max(300).default(''),
  phone: z.string().max(40).default(''),
  active: z.boolean().default(true),
});

const createSchema = upsertSchema.extend({
  password: z.string().min(8),
});

dealersRouter.post('/', (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    return;
  }
  const d = parsed.data;
  if (getByEmail.get(d.email)) {
    res.status(409).json({ error: 'A user with that email already exists' });
    return;
  }
  const info = insertUser.run({
    name: d.name,
    email: d.email,
    role: d.role,
    company_name: d.companyName,
    company_slogan: d.companySlogan,
    address: d.address,
    phone: d.phone,
    password_hash: hashPassword(d.password),
    active: d.active ? 1 : 0,
  });
  const row = getUser.get(info.lastInsertRowid) as UserRow;
  res.status(201).json({ dealer: { ...shapeUser(row), prefs: prefsFor(row.id) } });
});

dealersRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = getUser.get(id) as UserRow | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    return;
  }
  const d = parsed.data;
  const clash = getByEmail.get(d.email) as UserRow | undefined;
  if (clash && clash.id !== id) {
    res.status(409).json({ error: 'A user with that email already exists' });
    return;
  }
  // Guard against removing the last admin / locking yourself out.
  if (existing.role === 'admin' && (d.role !== 'admin' || !d.active)) {
    const admins = (db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'admin' AND active = 1").get() as { n: number }).n;
    if (admins <= 1) {
      res.status(400).json({ error: 'Cannot demote or deactivate the only active admin' });
      return;
    }
  }
  db.prepare(`
    UPDATE users SET name=@name, email=@email, role=@role, company_name=@company_name,
      company_slogan=@company_slogan, address=@address, phone=@phone, active=@active,
      updated_at=datetime('now') WHERE id=@id
  `).run({
    id,
    name: d.name,
    email: d.email,
    role: d.role,
    company_name: d.companyName,
    company_slogan: d.companySlogan,
    address: d.address,
    phone: d.phone,
    active: d.active ? 1 : 0,
  });
  const row = getUser.get(id) as UserRow;
  res.json({ dealer: { ...shapeUser(row), prefs: prefsFor(row.id) } });
});

const resetPwSchema = z.object({ password: z.string().min(8) });

dealersRouter.post('/:id/reset-password', (req, res) => {
  const id = Number(req.params.id);
  const existing = getUser.get(id) as UserRow | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const parsed = resetPwSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
    hashPassword(parsed.data.password),
    id
  );
  res.json({ ok: true });
});

dealersRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = getUser.get(id) as UserRow | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (existing.id === req.user!.id) {
    res.status(400).json({ error: 'You cannot delete your own account' });
    return;
  }
  if (existing.role === 'admin') {
    const admins = (db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'admin'").get() as { n: number }).n;
    if (admins <= 1) {
      res.status(400).json({ error: 'Cannot delete the only admin' });
      return;
    }
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});
