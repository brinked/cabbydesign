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
