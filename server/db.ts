// SQLite connection + schema bootstrap. Isolated here so the rest of the
// server talks to a small typed surface and the store could be swapped later.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply schema (idempotent — every statement is IF NOT EXISTS).
const schema = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
db.exec(schema);

// ---- Lightweight migrations: add columns to existing tables if missing ----
// (CREATE TABLE IF NOT EXISTS won't alter an existing table's columns.)
function ensureColumn(table: string, column: string, def: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  }
}
ensureColumn('dealer_prefs', 'markup_mode', "TEXT NOT NULL DEFAULT 'percent'");
ensureColumn('dealer_prefs', 'flat_amount', 'REAL NOT NULL DEFAULT 0');
ensureColumn('dealer_prefs', 'tax_exempt', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('dealer_prefs', 'contractor_mode', "TEXT NOT NULL DEFAULT 'retail_discount'");
ensureColumn('dealer_prefs', 'retail_discount_pct', 'REAL NOT NULL DEFAULT 0');
ensureColumn('dealer_prefs', 'own_pricing', "TEXT NOT NULL DEFAULT ''");
ensureColumn('dealer_branding', 'resale_cert', "TEXT NOT NULL DEFAULT ''");
ensureColumn('dealer_branding', 'resale_cert_name', "TEXT NOT NULL DEFAULT ''");

// The users.role CHECK originally allowed only ('admin','dealer'). Rebuild the
// table to allow 'contractor' too if the existing CHECK doesn't include it.
// (SQLite can't ALTER a CHECK; the table must be recreated. FKs are preserved
// because we rename the new table to the old name with foreign_keys off.)
const usersSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as { sql: string } | undefined)?.sql ?? '';
if (usersSql && !usersSql.includes('contractor')) {
  db.pragma('foreign_keys = OFF');
  db.exec(`
    BEGIN;
    CREATE TABLE users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'dealer' CHECK (role IN ('admin', 'dealer', 'contractor')),
      company_name TEXT NOT NULL DEFAULT '',
      company_slogan TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO users_new SELECT id, name, email, role, company_name, company_slogan, address, phone, password_hash, active, created_at, updated_at FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
    COMMIT;
  `);
  db.pragma('foreign_keys = ON');
}

// ---- Row types (shape returned from the DB) ----

export type Role = 'admin' | 'dealer' | 'contractor';

export interface UserRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  company_name: string;
  company_slogan: string;
  address: string;
  phone: string;
  password_hash: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface DealerPrefsRow {
  user_id: number;
  margin_pct: number;
  show_pricing: number;
  price_mode: 'cost' | 'marked_up';
  markup_mode: 'percent' | 'flat';
  flat_amount: number;
  tax_exempt: number;
  contractor_mode: 'retail_discount' | 'own';
  retail_discount_pct: number;
  own_pricing: string;
  updated_at: string;
}

export interface JobRow {
  id: number;
  user_id: number;
  name: string;
  customer_name: string;
  customer_email: string;
  customer_address: string;
  design_json: string;
  created_at: string;
  updated_at: string;
}
