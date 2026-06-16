// Convert DB rows into the JSON shapes the client consumes (camelCase, no secrets).
import { db, type DealerPrefsRow, type JobRow, type UserRow } from './db.ts';

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'dealer';
  companyName: string;
  companySlogan: string;
  address: string;
  phone: string;
  active: boolean;
  createdAt: string;
}

export function shapeUser(u: UserRow): ApiUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    companyName: u.company_name,
    companySlogan: u.company_slogan,
    address: u.address,
    phone: u.phone,
    active: !!u.active,
    createdAt: u.created_at,
  };
}

export interface ApiPrefs {
  marginPct: number;
  showPricing: boolean;
  priceMode: 'cost' | 'marked_up';
}

const getPrefs = db.prepare('SELECT * FROM dealer_prefs WHERE user_id = ?');
const insertPrefs = db.prepare('INSERT INTO dealer_prefs (user_id) VALUES (?)');

/** Read a dealer's prefs, creating the default row on first access. */
export function prefsFor(userId: number): ApiPrefs {
  let row = getPrefs.get(userId) as DealerPrefsRow | undefined;
  if (!row) {
    insertPrefs.run(userId);
    row = getPrefs.get(userId) as DealerPrefsRow;
  }
  return {
    marginPct: row.margin_pct,
    showPricing: !!row.show_pricing,
    priceMode: row.price_mode,
  };
}

export interface ApiJobSummary {
  id: number;
  name: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  createdAt: string;
  updatedAt: string;
}

export function shapeJobSummary(j: JobRow): ApiJobSummary {
  return {
    id: j.id,
    name: j.name,
    customerName: j.customer_name,
    customerEmail: j.customer_email,
    customerAddress: j.customer_address,
    createdAt: j.created_at,
    updatedAt: j.updated_at,
  };
}

export function shapeJobFull(j: JobRow): ApiJobSummary & { design: unknown } {
  return { ...shapeJobSummary(j), design: JSON.parse(j.design_json) };
}
