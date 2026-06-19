// Dealer submits a project to EXT Cabinets for review — emails the order to the
// order inbox with the design attached.
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.ts';
import { config } from '../config.ts';
import { emailEnabled, esc, sendMail } from '../email.ts';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

const lineSchema = z.object({
  n: z.union([z.number(), z.string()]).optional(),
  name: z.string().max(200),
  location: z.string().max(200).default(''),
  size: z.string().max(120).default(''),
  qty: z.number().optional(),
  price: z.string().max(40).default(''), // pre-formatted ('' = hidden)
});

const orderSchema = z.object({
  projectName: z.string().max(200).default('Untitled Design'),
  notes: z.string().max(4000).default(''),
  customer: z
    .object({
      name: z.string().max(200).default(''),
      email: z.string().max(200).default(''),
      address: z.string().max(400).default(''),
    })
    .default({ name: '', email: '', address: '' }),
  showPricing: z.boolean().default(true),
  total: z.string().max(40).default(''),
  lines: z.array(lineSchema).max(2000).default([]),
  // the full design blob, attached so EXT can open it in the tool
  design: z.object({}).passthrough(),
});

ordersRouter.post('/submit', async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid order' });
    return;
  }
  const o = parsed.data;
  const u = req.user!;

  const rows = o.lines
    .map(
      (l) =>
        `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee">${esc(String(l.n ?? ''))}</td>` +
        `<td style="padding:4px 8px;border-bottom:1px solid #eee">${esc(l.name)}</td>` +
        `<td style="padding:4px 8px;border-bottom:1px solid #eee">${esc(l.location)}</td>` +
        `<td style="padding:4px 8px;border-bottom:1px solid #eee">${esc(l.size)}</td>` +
        (o.showPricing ? `<td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${esc(l.price)}</td>` : '') +
        `</tr>`
    )
    .join('');

  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;color:#1f2430">
      <h2>New order for review — ${esc(o.projectName)}</h2>
      <p><b>Submitted by:</b> ${esc(u.name)}${u.company_name ? ` (${esc(u.company_name)})` : ''} &lt;${esc(u.email)}&gt; · role: ${esc(u.role)}</p>
      <p><b>Customer:</b> ${esc(o.customer.name) || '—'}${o.customer.email ? ` &lt;${esc(o.customer.email)}&gt;` : ''}<br/>
      ${o.customer.address ? esc(o.customer.address) : ''}</p>
      ${o.notes ? `<p><b>Notes:</b><br/>${esc(o.notes).replace(/\n/g, '<br/>')}</p>` : ''}
      <table style="border-collapse:collapse;font-size:13px;margin-top:8px">
        <thead><tr style="text-align:left;background:#f5f6f8">
          <th style="padding:4px 8px">#</th><th style="padding:4px 8px">Item</th>
          <th style="padding:4px 8px">Location</th><th style="padding:4px 8px">Size</th>
          ${o.showPricing ? '<th style="padding:4px 8px;text-align:right">Price</th>' : ''}
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="5" style="padding:8px">No items.</td></tr>'}</tbody>
      </table>
      ${o.showPricing && o.total ? `<p style="margin-top:8px"><b>Total: ${esc(o.total)}</b></p>` : ''}
      <p style="color:#888;font-size:12px;margin-top:16px">The full design is attached as a .cabdesign.json file — open it via Import in the tool.</p>
    </div>`;

  const safeName = (o.projectName || 'design').replace(/[^\w-]+/g, '_');
  const result = await sendMail({
    to: config.smtp.orderInbox,
    subject: `New order: ${o.projectName} — ${u.company_name || u.name}`,
    html,
    replyTo: u.email,
    attachments: [
      { filename: `${safeName}.cabdesign.json`, content: JSON.stringify(o.design, null, 2), contentType: 'application/json' },
    ],
  });

  if (!result.sent) {
    res.status(emailEnabled ? 502 : 503).json({
      error: emailEnabled
        ? `Could not send the order email: ${result.error ?? 'unknown error'}`
        : 'Order email is not set up on the server yet. Contact your administrator.',
    });
    return;
  }
  res.json({ ok: true });
});
