// Admin CRUD over dealer accounts.
import { Router } from 'express';
import { z } from 'zod';
import { db, type UserRow } from '../db.ts';
import { DEFAULT_DEALER_PASSWORD, hashPassword, requireAdmin } from '../auth.ts';
import { certDataFor, certInfoFor, prefsFor, shapeUser } from '../shape.ts';

/** Apply the admin-only tax_exempt flag to a dealer's prefs row. */
const ensurePrefsRow = db.prepare('INSERT OR IGNORE INTO dealer_prefs (user_id) VALUES (?)');
const setTaxExempt = db.prepare("UPDATE dealer_prefs SET tax_exempt = ?, updated_at = datetime('now') WHERE user_id = ?");
function applyTaxExempt(userId: number, exempt: boolean): void {
  ensurePrefsRow.run(userId);
  setTaxExempt.run(exempt ? 1 : 0, userId);
}

/** Full admin view of a dealer: account + prefs + certificate status. */
function dealerView(u: UserRow) {
  return { ...shapeUser(u), prefs: prefsFor(u.id), cert: certInfoFor(u.id) };
}

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
  res.json({ dealers: rows.map(dealerView) });
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
  taxExempt: z.boolean().default(false),
});

// Password optional on create — blank means start with the default password.
const createSchema = upsertSchema.extend({
  password: z.string().min(8).or(z.literal('')).optional(),
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
    password_hash: hashPassword(d.password || DEFAULT_DEALER_PASSWORD),
    active: d.active ? 1 : 0,
  });
  const id = Number(info.lastInsertRowid);
  applyTaxExempt(id, d.taxExempt);
  res.status(201).json({ dealer: dealerView(getUser.get(id) as UserRow) });
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
  applyTaxExempt(id, d.taxExempt);
  res.json({ dealer: dealerView(getUser.get(id) as UserRow) });
});

// Reset a dealer's password. Blank/omitted resets to the default password.
const resetPwSchema = z.object({ password: z.string().min(8).or(z.literal('')).optional() });

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
  const pw = parsed.data.password || DEFAULT_DEALER_PASSWORD;
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hashPassword(pw), id);
  res.json({ ok: true, defaultUsed: !parsed.data.password });
});

// Admin: view/download a dealer's uploaded resale certificate.
dealersRouter.get('/:id/cert', (req, res) => {
  const id = Number(req.params.id);
  if (!getUser.get(id)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const data = certDataFor(id);
  if (!data) {
    res.status(404).json({ error: 'No certificate uploaded' });
    return;
  }
  res.json({ cert: data, ...certInfoFor(id) });
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
