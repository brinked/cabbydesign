// Consumer quote requests (lead capture). PUBLIC — the end-user app has no
// accounts. Emails the lead's contact details + design to the order inbox
// (EMAIL_TO, default extcabinets@gmail.com) with the design file attached.
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.ts';
import { emailEnabled, esc, sendMail } from '../email.ts';

export const quotesRouter = Router();

// Light in-memory rate limit so the public endpoint can't be used to flood the
// inbox: max 5 quote requests per IP per 15 minutes.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(ip, hits);
    return true;
  }
  hits.push(now);
  recent.set(ip, hits);
  // opportunistic cleanup so the map doesn't grow forever
  if (recent.size > 5000) {
    for (const [k, v] of recent) if (v.every((t) => now - t >= WINDOW_MS)) recent.delete(k);
  }
  return false;
}

const lineSchema = z.object({
  n: z.union([z.number(), z.string()]).optional(),
  name: z.string().max(200),
  location: z.string().max(200).default(''),
  size: z.string().max(120).default(''),
  price: z.string().max(40).default(''), // pre-formatted ('' = hidden)
});

const quoteSchema = z.object({
  projectName: z.string().max(200).default('Untitled Design'),
  contact: z.object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    email: z.string().trim().email('A valid email is required').max(200),
    phone: z.string().trim().min(7, 'A valid phone number is required').max(40),
    address: z.string().trim().min(1, 'Address is required').max(400),
  }),
  notes: z.string().max(4000).default(''),
  total: z.string().max(40).default(''),
  lines: z.array(lineSchema).max(2000).default([]),
  // the full design blob, attached so EXT can open it in the tool
  design: z.object({}).passthrough(),
});

quotesRouter.post('/submit', async (req, res) => {
  const ip = req.ip ?? 'unknown';
  if (rateLimited(ip)) {
    res.status(429).json({ error: 'Too many quote requests — please try again in a few minutes.' });
    return;
  }
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid quote request' });
    return;
  }
  const q = parsed.data;

  const rows = q.lines
    .map(
      (l) =>
        `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee">${esc(String(l.n ?? ''))}</td>` +
        `<td style="padding:4px 8px;border-bottom:1px solid #eee">${esc(l.name)}</td>` +
        `<td style="padding:4px 8px;border-bottom:1px solid #eee">${esc(l.location)}</td>` +
        `<td style="padding:4px 8px;border-bottom:1px solid #eee">${esc(l.size)}</td>` +
        `<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${esc(l.price)}</td></tr>`
    )
    .join('');

  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;color:#1f2430">
      <h2>🔥 New quote request — ${esc(q.projectName)}</h2>
      <table style="font-size:14px;margin:8px 0">
        <tr><td style="padding:2px 12px 2px 0"><b>Name</b></td><td>${esc(q.contact.name)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0"><b>Email</b></td><td><a href="mailto:${esc(q.contact.email)}">${esc(q.contact.email)}</a></td></tr>
        <tr><td style="padding:2px 12px 2px 0"><b>Phone</b></td><td>${esc(q.contact.phone)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0"><b>Address</b></td><td>${esc(q.contact.address)}</td></tr>
      </table>
      ${q.notes ? `<p><b>Notes:</b><br/>${esc(q.notes).replace(/\n/g, '<br/>')}</p>` : ''}
      <table style="border-collapse:collapse;font-size:13px;margin-top:8px">
        <thead><tr style="text-align:left;background:#f5f6f8">
          <th style="padding:4px 8px">#</th><th style="padding:4px 8px">Item</th>
          <th style="padding:4px 8px">Location</th><th style="padding:4px 8px">Size</th>
          <th style="padding:4px 8px;text-align:right">Est. price</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="5" style="padding:8px">No items.</td></tr>'}</tbody>
      </table>
      ${q.total ? `<p style="margin-top:8px"><b>Estimated total: ${esc(q.total)}</b></p>` : ''}
      <p style="color:#888;font-size:12px;margin-top:16px">Sent from the CabDesign consumer designer. The full design is attached as a .cabdesign.json file.</p>
    </div>`;

  const safeName = (q.projectName || 'design').replace(/[^\w-]+/g, '_');
  const result = await sendMail({
    to: config.smtp.orderInbox,
    subject: `Quote request: ${q.projectName} — ${q.contact.name}`,
    html,
    replyTo: q.contact.email,
    attachments: [
      { filename: `${safeName}.cabdesign.json`, content: JSON.stringify(q.design, null, 2), contentType: 'application/json' },
    ],
  });

  if (!result.sent) {
    res.status(emailEnabled ? 502 : 503).json({
      error: emailEnabled
        ? 'Could not send your request right now — please try again in a few minutes.'
        : 'Quote requests are not available right now — please email extcabinets@gmail.com directly.',
    });
    return;
  }
  res.json({ ok: true });
});
