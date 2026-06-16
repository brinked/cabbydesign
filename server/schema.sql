-- CabDesign backend schema (SQLite).
-- All tables use INTEGER PRIMARY KEY (rowid) ids except where a stable string id is needed.

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  email           TEXT    NOT NULL UNIQUE,
  role            TEXT    NOT NULL DEFAULT 'dealer' CHECK (role IN ('admin', 'dealer')),
  company_name    TEXT    NOT NULL DEFAULT '',
  company_slogan  TEXT    NOT NULL DEFAULT '',
  address         TEXT    NOT NULL DEFAULT '',
  phone           TEXT    NOT NULL DEFAULT '',
  password_hash   TEXT    NOT NULL,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Per-dealer preferences (margin + report pricing controls). One row per user.
CREATE TABLE IF NOT EXISTS dealer_prefs (
  user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  margin_pct   REAL    NOT NULL DEFAULT 0,
  show_pricing INTEGER NOT NULL DEFAULT 1,
  -- 'cost'      = show the dealer's own (cost) pricing
  -- 'marked_up' = show cost marked up by the markup below
  price_mode   TEXT    NOT NULL DEFAULT 'marked_up' CHECK (price_mode IN ('cost', 'marked_up')),
  -- 'percent' = margin_pct over cost; 'flat' = flat_amount added per cabinet
  markup_mode  TEXT    NOT NULL DEFAULT 'percent' CHECK (markup_mode IN ('percent', 'flat')),
  flat_amount  REAL    NOT NULL DEFAULT 0,
  -- admin-controlled: exempt from sales tax (dealer has a resale certificate)
  tax_exempt   INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Saved jobs/designs, each owned by a dealer and tagged with customer info.
CREATE TABLE IF NOT EXISTS jobs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL DEFAULT 'Untitled Design',
  customer_name    TEXT    NOT NULL DEFAULT '',
  customer_email   TEXT    NOT NULL DEFAULT '',
  customer_address TEXT    NOT NULL DEFAULT '',
  design_json      TEXT    NOT NULL,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id, updated_at DESC);

-- Per-dealer branding (logo shown on their customer reports). Kept in its own
-- table so the (base64) logo isn't loaded with every dealer list.
CREATE TABLE IF NOT EXISTS dealer_branding (
  user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  logo         TEXT NOT NULL DEFAULT '',
  -- resale tax certificate the dealer uploads (data URL: image or PDF)
  resale_cert      TEXT NOT NULL DEFAULT '',
  resale_cert_name TEXT NOT NULL DEFAULT '',
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Global app settings (admin-controlled). Currently holds the cabinet
-- min/max width/depth limits under key 'cabinetDims'. value is JSON text.
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
