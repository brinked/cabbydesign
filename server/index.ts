// CabDesign API server. Express + SQLite. Serves the JSON API under /api and,
// in production, the built SPA from dist/.
import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.ts';
import { loadSession } from './auth.ts';
import { rateLimit } from './rateLimit.ts';
import './db.ts'; // ensure schema is applied at boot
import { bootstrapAdmin, bootstrapAppliances, bootstrapDealers } from './bootstrap.ts';
import { authRouter } from './routes/auth.ts';
import { dealersRouter } from './routes/dealers.ts';
import { settingsRouter } from './routes/settings.ts';
import { profileRouter } from './routes/profile.ts';
import { jobsRouter } from './routes/jobs.ts';
import { ordersRouter } from './routes/orders.ts';
import { quotesRouter } from './routes/quotes.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
// Behind the host's proxy (Render) every request arrives from the proxy's
// address; trust its X-Forwarded-For so req.ip is the real visitor and the
// rate limits apply per visitor rather than to the whole site at once.
app.set('trust proxy', 1);

// Quote/order submissions carry a design + a report PDF, so they alone get the
// large body limit; everything else is small JSON.
const bigJson = express.json({ limit: '25mb' });
const smallJson = express.json({ limit: '2mb' });
const BIG_BODY = ['/api/quotes', '/api/orders', '/api/jobs', '/api/profile', '/api/settings'];
app.use((req, res, next) => (BIG_BODY.some((p) => req.path.startsWith(p)) ? bigJson : smallJson)(req, res, next));
app.use(cookieParser());

// Dev: allow the Vite origin to send/receive the session cookie. (In prod the
// SPA is served same-origin, so CORS is a no-op.)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin === config.corsOrigin || !config.isProd)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(loadSession);

// Slow down password guessing and signup/reset-email flooding: 30 write
// requests per visitor per 15 minutes across the auth endpoints.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const authRateLimit: express.RequestHandler = (req, res, next) => {
  if (req.method !== 'POST' || req.path === '/logout') return next();
  if (authLimiter(req.ip ?? 'unknown')) {
    res.status(429).json({ error: 'Too many attempts — please wait a few minutes and try again.' });
    return;
  }
  next();
};

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRateLimit, authRouter);
app.use('/api/dealers', dealersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/quotes', quotesRouter);

// Production: serve the built SPA and fall back to index.html for client routes.
const distDir = path.join(here, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback (Express 5 has no bare '*' route — use a catch-all middleware).
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// JSON error fallback.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

bootstrapDealers();
bootstrapAdmin();
bootstrapAppliances();

app.listen(config.port, () => {
  console.log(`CabDesign API listening on http://localhost:${config.port}`);
});
