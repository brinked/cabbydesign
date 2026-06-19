// Centralized server configuration, all overridable via environment variables.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT ?? 4000),
  // SQLite database file. Defaults to server/data/cabdesign.db (gitignored).
  dbPath: process.env.DB_PATH ?? path.join(here, 'data', 'cabdesign.db'),
  // Secret for signing session JWTs. MUST be set in production.
  jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me',
  // Session lifetime.
  sessionDays: Number(process.env.SESSION_DAYS ?? 30),
  // Cookie is sent over https only when NODE_ENV=production.
  isProd: process.env.NODE_ENV === 'production',
  // Allowed CORS origin for the SPA in dev (Vite). In prod the SPA is same-origin.
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  // Public base URL of the app (used in emailed links, e.g. password reset).
  appUrl: process.env.APP_URL ?? 'http://localhost:5173',
  // Outbound email (Google Workspace SMTP). Configure these env vars to enable
  // order notifications + password-reset emails. Unset = email is disabled.
  smtp: {
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 465),
    user: process.env.SMTP_USER ?? '', // e.g. info@extcabinets.com
    pass: process.env.SMTP_PASS ?? '', // a Google Workspace App Password
    from: process.env.EMAIL_FROM ?? 'EXT Cabinets <info@extcabinets.com>',
    // Where order-submission notifications are sent.
    orderInbox: process.env.EMAIL_TO ?? 'extcabinets@gmail.com',
  },
};

export const COOKIE_NAME = 'cabdesign_session';
