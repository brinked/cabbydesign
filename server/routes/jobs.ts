// Per-dealer saved jobs (designs + customer info). All scoped to req.user.
import { Router } from 'express';
import { z } from 'zod';
import { db, type JobRow } from '../db.ts';
import { requireAdmin, requireAuth } from '../auth.ts';
import { shapeJobFull, shapeJobSummary } from '../shape.ts';

export const jobsRouter = Router();
jobsRouter.use(requireAuth);

const listJobs = db.prepare('SELECT * FROM jobs WHERE user_id = ? ORDER BY updated_at DESC');
const getJob = db.prepare('SELECT * FROM jobs WHERE id = ? AND user_id = ?');
const getAnyJob = db.prepare('SELECT * FROM jobs WHERE id = ?');
// Admin: every dealer's job with its owner's name/company/email.
const listAllJobs = db.prepare(`
  SELECT j.*, u.name AS owner_name, u.company_name AS owner_company, u.email AS owner_email
  FROM jobs j JOIN users u ON u.id = j.user_id
  ORDER BY j.updated_at DESC
`);

type JobWithOwner = JobRow & { owner_name: string; owner_company: string; owner_email: string };

// Admin-only: list saved designs across all dealers. Declared before '/:id' so
// the literal path isn't captured as an id.
jobsRouter.get('/all', requireAdmin, (_req, res) => {
  const rows = listAllJobs.all() as JobWithOwner[];
  res.json({
    jobs: rows.map((r) => ({
      ...shapeJobSummary(r),
      ownerId: r.user_id,
      ownerName: r.owner_name,
      ownerCompany: r.owner_company,
      ownerEmail: r.owner_email,
    })),
  });
});

const jobSchema = z.object({
  name: z.string().min(1).max(200),
  customerName: z.string().max(200).default(''),
  customerEmail: z.string().max(200).default(''),
  customerAddress: z.string().max(400).default(''),
  // The full design blob — validated loosely here; the client owns its shape.
  design: z.object({}).passthrough(),
  // Admin only: file the new job under this account (dealer/contractor)
  // instead of the admin's own. Ignored when it matches the caller.
  userId: z.number().int().positive().optional(),
});

const getUserById = db.prepare('SELECT id FROM users WHERE id = ?');

jobsRouter.get('/', (req, res) => {
  const rows = listJobs.all(req.user!.id) as JobRow[];
  res.json({ jobs: rows.map(shapeJobSummary) });
});

jobsRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  // Admins may open any dealer's design (read-only viewing); others only their own.
  const row = (req.user!.role === 'admin' ? getAnyJob.get(id) : getJob.get(id, req.user!.id)) as JobRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json({ job: shapeJobFull(row) });
});

jobsRouter.post('/', (req, res) => {
  const parsed = jobSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid job' });
    return;
  }
  const d = parsed.data;
  // Admins may save the design straight into a dealer's/contractor's account.
  let ownerId = req.user!.id;
  if (d.userId != null && d.userId !== req.user!.id) {
    if (req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can save to another account' });
      return;
    }
    if (!getUserById.get(d.userId)) {
      res.status(404).json({ error: 'Target account not found' });
      return;
    }
    ownerId = d.userId;
  }
  const info = db
    .prepare(`
      INSERT INTO jobs (user_id, name, customer_name, customer_email, customer_address, design_json)
      VALUES (@userId, @name, @customerName, @customerEmail, @customerAddress, @design)
    `)
    .run({
      userId: ownerId,
      name: d.name,
      customerName: d.customerName,
      customerEmail: d.customerEmail,
      customerAddress: d.customerAddress,
      design: JSON.stringify(d.design),
    });
  const row = getAnyJob.get(info.lastInsertRowid) as JobRow;
  res.status(201).json({ job: shapeJobFull(row) });
});

jobsRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = getJob.get(id, req.user!.id) as JobRow | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  const parsed = jobSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid job' });
    return;
  }
  const d = parsed.data;
  db.prepare(`
    UPDATE jobs SET name=@name, customer_name=@customerName, customer_email=@customerEmail,
      customer_address=@customerAddress, design_json=@design, updated_at=datetime('now')
    WHERE id=@id AND user_id=@userId
  `).run({
    id,
    userId: req.user!.id,
    name: d.name,
    customerName: d.customerName,
    customerEmail: d.customerEmail,
    customerAddress: d.customerAddress,
    design: JSON.stringify(d.design),
  });
  const row = getJob.get(id, req.user!.id) as JobRow;
  res.json({ job: shapeJobFull(row) });
});

jobsRouter.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM jobs WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user!.id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json({ ok: true });
});
