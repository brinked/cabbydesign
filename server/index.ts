// CabDesign API server. Express + SQLite. Serves the JSON API under /api and,
// in production, the built SPA from dist/.
import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.ts';
import { loadSession } from './auth.ts';
import './db.ts'; // ensure schema is applied at boot
import { bootstrapAdmin, bootstrapDealers } from './bootstrap.ts';
import { authRouter } from './routes/auth.ts';
import { dealersRouter } from './routes/dealers.ts';
import { settingsRouter } from './routes/settings.ts';
import { profileRouter } from './routes/profile.ts';
import { jobsRouter } from './routes/jobs.ts';
import { ordersRouter } from './routes/orders.ts';
import { quotesRouter } from './routes/quotes.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '25mb' })); // designs + quote report PDFs can be large
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

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
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

app.listen(config.port, () => {
  console.log(`CabDesign API listening on http://localhost:${config.port}`);
});
