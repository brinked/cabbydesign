// Convert DB rows into the JSON shapes the client consumes (camelCase, no secrets).
import { db, type DealerPrefsRow, type JobRow, type Role, type UserRow } from './db.ts';

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  companyName: string;
  companySlogan: string;
  address: string;
  phone: string;
  active: boolean;
  emailVerified: boolean;
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
    emailVerified: !!u.email_verified,
    createdAt: u.created_at,
    logo,
  };
}

/** Cabinet-company catalog customization: catalog ids / handle ids / finish ids
 *  the company has hidden from their designers' pickers. */
export interface ApiCatalogPrefs {
  hiddenCabinets: string[];
  hiddenHandles: string[];
  hiddenFinishes: string[];
}

export function catalogPrefsFor(u: Pick<UserRow, 'catalog_prefs'>): ApiCatalogPrefs {
  try {
    const v = u.catalog_prefs ? JSON.parse(u.catalog_prefs) : {};
    const arr = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []);
    return { hiddenCabinets: arr(v.hiddenCabinets), hiddenHandles: arr(v.hiddenHandles), hiddenFinishes: arr(v.hiddenFinishes) };
  } catch {
    return { hiddenCabinets: [], hiddenHandles: [], hiddenFinishes: [] };
  }
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
  /** Contractor accounts: how their pricing is derived. */
  contractorMode: 'retail_discount' | 'own';
  /** Contractor 'retail_discount' mode: percent off the admin retail price. */
  retailDiscountPct: number;
  /** Contractor 'own' mode: their own per-cabinet formulas (catalogId -> formula). */
  ownPricing: Record<string, string>;
  /** Appliance brands this dealer has hidden from their own offering. */
  hiddenBrands: string[];
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
  let ownPricing: Record<string, string> = {};
  try {
    ownPricing = row.own_pricing ? JSON.parse(row.own_pricing) : {};
  } catch {
    ownPricing = {};
  }
  return {
    marginPct: row.margin_pct,
    showPricing: !!row.show_pricing,
    priceMode: row.price_mode,
    markupMode: row.markup_mode,
    flatAmount: row.flat_amount,
    taxExempt: !!row.tax_exempt,
    contractorMode: row.contractor_mode,
    retailDiscountPct: row.retail_discount_pct,
    ownPricing,
    hiddenBrands: hiddenBrandsFor(userId),
  };
}

/** Parse a JSON string column to an array, tolerating empty/invalid values. */
function parseArray(s: string | undefined): unknown[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** A dealer's own appliance/liner inventory (added on top of the admin global). */
export function ownAppliancesFor(userId: number): unknown[] {
  const row = getPrefs.get(userId) as DealerPrefsRow | undefined;
  return parseArray(row?.own_appliances);
}

/** Brands a dealer has chosen to hide from their offering. */
export function hiddenBrandsFor(userId: number): string[] {
  const row = getPrefs.get(userId) as DealerPrefsRow | undefined;
  return parseArray(row?.hidden_brands).filter((b): b is string => typeof b === 'string');
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
