// Outbound email via Google Workspace SMTP (nodemailer). Configured through the
// SMTP_* env vars (see config.ts). When unconfigured, sending is a graceful
// no-op that logs a warning — so dev and unconfigured deploys never crash.
import nodemailer from 'nodemailer';
import { config } from './config.ts';

const { host, port, user, pass, from } = config.smtp;

export const emailEnabled = !!(user && pass);

const transporter = emailEnabled
  ? nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
      auth: { user, pass },
    })
  : null;

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: { filename: string; content: string; contentType?: string }[];
}

/** Send an email. Returns { sent } — false (not thrown) when email is disabled. */
export async function sendMail(m: MailInput): Promise<{ sent: boolean; error?: string }> {
  if (!transporter) {
    console.warn(`[email] SMTP not configured — skipping "${m.subject}" to ${m.to}`);
    return { sent: false, error: 'Email is not configured on the server.' };
  }
  try {
    await transporter.sendMail({
      from,
      to: m.to,
      subject: m.subject,
      html: m.html,
      text: m.text,
      replyTo: m.replyTo,
      attachments: m.attachments,
    });
    return { sent: true };
  } catch (err) {
    console.error('[email] send failed:', err);
    return { sent: false, error: (err as Error).message };
  }
}

/** Minimal HTML escape for interpolating user-supplied strings into emails. */
export function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
