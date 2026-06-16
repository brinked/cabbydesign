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
ensureColumn('dealer_branding', 'resale_cert', "TEXT NOT NULL DEFAULT ''");
ensureColumn('dealer_branding', 'resale_cert_name', "TEXT NOT NULL DEFAULT ''");

// ---- Row types (shape returned from the DB) ----

export interface UserRow {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'dealer';
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
