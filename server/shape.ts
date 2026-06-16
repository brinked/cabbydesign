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
  /** Data-URL logo for the dealer's reports ('' if none). Only populated for
   *  the signed-in user (me/login/profile), not the admin dealer list. */
  logo: string;
}

export function shapeUser(u: UserRow, logo = ''): ApiUser {
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
    logo,
  };
}

const getLogo = db.prepare('SELECT logo FROM dealer_branding WHERE user_id = ?');

/** The dealer's logo data URL, or '' if none set. */
export function logoFor(userId: number): string {
  const row = getLogo.get(userId) as { logo: string } | undefined;
  return row?.logo ?? '';
}

export interface ApiPrefs {
  marginPct: number;
  showPricing: boolean;
  priceMode: 'cost' | 'marked_up';
  markupMode: 'percent' | 'flat';
  flatAmount: number;
  /** Admin-controlled; the dealer cannot change this. */
  taxExempt: boolean;
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
    markupMode: row.markup_mode,
    flatAmount: row.flat_amount,
    taxExempt: !!row.tax_exempt,
  };
}

export interface ApiCertInfo {
  name: string;
  present: boolean;
}

const getCert = db.prepare('SELECT resale_cert, resale_cert_name FROM dealer_branding WHERE user_id = ?');

/** Resale-certificate status (name + whether one is uploaded). */
export function certInfoFor(userId: number): ApiCertInfo {
  const row = getCert.get(userId) as { resale_cert: string; resale_cert_name: string } | undefined;
  return { name: row?.resale_cert_name ?? '', present: !!row?.resale_cert };
}

/** The raw resale-certificate data URL ('' if none). */
export function certDataFor(userId: number): string {
  const row = getCert.get(userId) as { resale_cert: string } | undefined;
  return row?.resale_cert ?? '';
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
