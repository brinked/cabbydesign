// Per-dealer saved jobs (designs + customer info). All scoped to req.user.
import { Router } from 'express';
import { z } from 'zod';
import { db, type JobRow } from '../db.ts';
import { requireAuth } from '../auth.ts';
import { shapeJobFull, shapeJobSummary } from '../shape.ts';

export const jobsRouter = Router();
jobsRouter.use(requireAuth);

const listJobs = db.prepare('SELECT * FROM jobs WHERE user_id = ? ORDER BY updated_at DESC');
const getJob = db.prepare('SELECT * FROM jobs WHERE id = ? AND user_id = ?');

const jobSchema = z.object({
  name: z.string().min(1).max(200),
  customerName: z.string().max(200).default(''),
  customerEmail: z.string().max(200).default(''),
  customerAddress: z.string().max(400).default(''),
  // The full design blob — validated loosely here; the client owns its shape.
  design: z.object({}).passthrough(),
});

jobsRouter.get('/', (req, res) => {
  const rows = listJobs.all(req.user!.id) as JobRow[];
  res.json({ jobs: rows.map(shapeJobSummary) });
});

jobsRouter.get('/:id', (req, res) => {
  const row = getJob.get(Number(req.params.id), req.user!.id) as JobRow | undefined;
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
  const info = db
    .prepare(`
      INSERT INTO jobs (user_id, name, customer_name, customer_email, customer_address, design_json)
      VALUES (@userId, @name, @customerName, @customerEmail, @customerAddress, @design)
    `)
    .run({
      userId: req.user!.id,
      name: d.name,
      customerName: d.customerName,
      customerEmail: d.customerEmail,
      customerAddress: d.customerAddress,
      design: JSON.stringify(d.design),
    });
  const row = getJob.get(info.lastInsertRowid, req.user!.id) as JobRow;
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
