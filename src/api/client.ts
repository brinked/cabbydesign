// Typed client for the CabDesign API. All requests are same-origin (the Vite
// dev server proxies /api to the Express backend), so the session cookie rides
// along automatically with credentials: 'include'.
import type { ApplianceBrands, ApplianceItem, Design, HandleItem, ModelAligns, PanelRates } from '../model/types';

export type Role = 'admin' | 'dealer' | 'contractor' | 'homeowner' | 'company';

/** Consumer account types offered at signup. */
export type AccountType = 'homeowner' | 'company';

/** A company-defined cabinet color/finish (shown as "My Colors"). */
export interface CompanyFinish {
  id: string;
  name: string;
  /** Door/body color (hex). */
  body: string;
}

/** A company-defined handle with its own retail price. */
export interface CompanyHandle {
  id: string;
  name: string;
  price: number;
}

/** Cabinet-company catalog customization: ids hidden from the pickers plus
 *  the company's own colors/finishes and priced handles. */
export interface CatalogPrefs {
  hiddenCabinets: string[];
  hiddenHandles: string[];
  hiddenFinishes: string[];
  customFinishes?: CompanyFinish[];
  customHandles?: CompanyHandle[];
}

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
  /** Data-URL logo for reports ('' if none). Populated only for the signed-in user. */
  logo: string;
}

export interface DealerPrefs {
  marginPct: number;
  showPricing: boolean;
  priceMode: 'cost' | 'marked_up';
  markupMode: 'percent' | 'flat';
  flatAmount: number;
  /** Admin-controlled; dealers see it read-only. */
  taxExempt: boolean;
  /** Contractor accounts: pricing derivation (admin-controlled). */
  contractorMode: 'retail_discount' | 'own';
  retailDiscountPct: number;
  ownPricing: Record<string, string>;
  /** Appliance brands the dealer has hidden from their own offering. */
  hiddenBrands: string[];
}

export interface CertInfo {
  name: string;
  present: boolean;
}

export type DealerWithPrefs = ApiUser & { prefs: DealerPrefs; cert: CertInfo };

export interface JobSummary {
  id: number;
  name: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  createdAt: string;
  updatedAt: string;
}

export type JobFull = JobSummary & { design: Design };

/** A saved design plus its owning dealer — admin-only listing. */
export type AdminJobSummary = JobSummary & {
  ownerId: number;
  ownerName: string;
  ownerCompany: string;
  ownerEmail: string;
};

/** A failed request carries the server's human-readable message + status. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export interface DimOverridePayload {
  minW?: number;
  maxW?: number;
  minD?: number;
  maxD?: number;
}
export type CabinetDims = Record<string, DimOverridePayload>;

/** Appliance brand -> account (user) ids allowed to use it. Empty = everyone. */
export type RestrictedBrands = Record<string, number[]>;

export interface DealerInput {
  name: string;
  email: string;
  role: Role;
  companyName: string;
  companySlogan: string;
  address: string;
  phone: string;
  active: boolean;
  taxExempt: boolean;
  contractorMode: 'retail_discount' | 'own';
  retailDiscountPct: number;
  ownPricing: Record<string, string>;
  password?: string;
}

export interface JobInput {
  name: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  design: Design;
  /** Admin only: save the job under this account instead of your own. */
  userId?: number;
}

export interface OrderLine {
  n?: number | string;
  name: string;
  location: string;
  size: string;
  price: string;
}
export interface OrderInput {
  projectName: string;
  notes: string;
  customer: { name: string; email: string; address: string };
  showPricing: boolean;
  total: string;
  lines: OrderLine[];
  design: Design;
}

/** Consumer quote request (lead capture) — no account required. */
export interface QuoteInput {
  projectName: string;
  contact: { name: string; email: string; phone: string; address: string };
  notes: string;
  total: string;
  lines: OrderLine[];
  design: Design;
  /** Report PDF (base64, no data: prefix) — attached to the lead email. */
  pdf?: string;
  /** Also email the design PDF to the contact (the "download" flow). */
  sendCopy?: boolean;
  /** Contact opted in to receive a proposal & estimate. */
  wantsProposal?: boolean;
}

export const api = {
  // ---- auth ----
  me: () => request<{ user: ApiUser | null; prefs?: DealerPrefs; cert?: CertInfo; catalogPrefs?: CatalogPrefs }>('GET', '/auth/me'),
  login: (email: string, password: string) =>
    request<{ user: ApiUser; prefs: DealerPrefs; cert: CertInfo; catalogPrefs?: CatalogPrefs }>('POST', '/auth/login', { email, password }),
  signup: (input: { name: string; email: string; password: string; accountType: AccountType; companyName?: string }) =>
    request<{ ok: true; needsVerify: boolean; user?: ApiUser; prefs?: DealerPrefs; cert?: CertInfo; catalogPrefs?: CatalogPrefs }>('POST', '/auth/signup', input),
  verifyEmail: (token: string) =>
    request<{ ok: true; user: ApiUser; prefs: DealerPrefs; cert: CertInfo; catalogPrefs?: CatalogPrefs }>('POST', '/auth/verify-email', { token }),
  resendVerify: (email: string) => request<{ ok: true }>('POST', '/auth/resend-verify', { email }),
  changeEmail: (password: string, newEmail: string) =>
    request<{ ok: true; needsVerify: boolean; user: ApiUser }>('POST', '/auth/change-email', { password, newEmail }),
  updateAccount: (input: { name: string; companyName?: string; phone?: string; address?: string }) =>
    request<{ user: ApiUser }>('PUT', '/profile/account', input),
  getCatalogPrefs: () => request<{ catalogPrefs: CatalogPrefs }>('GET', '/profile/catalog-prefs'),
  setCatalogPrefs: (catalogPrefs: CatalogPrefs) => request<{ catalogPrefs: CatalogPrefs }>('PUT', '/profile/catalog-prefs', catalogPrefs),
  logout: () => request<{ ok: true }>('POST', '/auth/logout'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('POST', '/auth/change-password', { currentPassword, newPassword }),
  forgotPassword: (email: string) => request<{ ok: true }>('POST', '/auth/forgot', { email }),
  resetPassword: (token: string, newPassword: string) =>
    request<{ ok: true }>('POST', '/auth/reset', { token, newPassword }),

  // ---- orders (submit a project to EXT for review) ----
  submitOrder: (input: OrderInput) => request<{ ok: true }>('POST', '/orders/submit', input),

  // ---- quotes (consumer lead capture — public) ----
  requestQuote: (input: QuoteInput) => request<{ ok: true; copySent?: boolean }>('POST', '/quotes/submit', input),

  // ---- admin: dealers ----
  listDealers: () => request<{ dealers: DealerWithPrefs[] }>('GET', '/dealers'),
  createDealer: (input: DealerInput) => request<{ dealer: DealerWithPrefs }>('POST', '/dealers', input),
  updateDealer: (id: number, input: DealerInput) =>
    request<{ dealer: DealerWithPrefs }>('PUT', `/dealers/${id}`, input),
  // password '' resets to the default password (ChangeMe123)
  resetDealerPassword: (id: number, password: string) =>
    request<{ ok: true; defaultUsed: boolean }>('POST', `/dealers/${id}/reset-password`, { password }),
  deleteDealer: (id: number) => request<{ ok: true }>('DELETE', `/dealers/${id}`),
  getDealerCert: (id: number) => request<{ cert: string; name: string; present: boolean }>('GET', `/dealers/${id}/cert`),

  // ---- admin: global cabinet dimension limits + base pricing formulas ----
  getCabinetDims: () => request<{ dims: CabinetDims }>('GET', '/settings/cabinet-dims'),
  setCabinetDims: (dims: CabinetDims) => request<{ dims: CabinetDims }>('PUT', '/settings/cabinet-dims', { dims }),
  getPricing: () => request<{ pricing: Record<string, string> }>('GET', '/settings/pricing'),
  setPricing: (pricing: Record<string, string>) =>
    request<{ pricing: Record<string, string> }>('PUT', '/settings/pricing', { pricing }),
  getRetailPricing: () => request<{ retailPricing: Record<string, string> }>('GET', '/settings/retail-pricing'),
  setRetailPricing: (retailPricing: Record<string, string>) =>
    request<{ retailPricing: Record<string, string> }>('PUT', '/settings/retail-pricing', { retailPricing }),
  getTaxRate: () => request<{ rate: number }>('GET', '/settings/tax'),
  setTaxRate: (rate: number) => request<{ rate: number }>('PUT', '/settings/tax', { rate }),
  // clearance (inches) a grill/griddle/burner cabinet must be wider than its liner cutout
  getLinerClearance: () => request<{ clearance: number }>('GET', '/settings/liner-clearance'),
  setLinerClearance: (clearance: number) => request<{ clearance: number }>('PUT', '/settings/liner-clearance', { clearance }),
  // $/sqft rates for applied end / island back panels and finished ends
  getPanelRates: () => request<{ rates: PanelRates }>('GET', '/settings/panel-rates'),
  setPanelRates: (rates: PanelRates) => request<{ rates: PanelRates }>('PUT', '/settings/panel-rates', { rates }),

  // ---- admin: appliance inventory + per-brand discounts ----
  getAppliances: () => request<{ appliances: ApplianceItem[] }>('GET', '/settings/appliances'),
  setAppliances: (appliances: ApplianceItem[]) =>
    request<{ appliances: ApplianceItem[] }>('PUT', '/settings/appliances', { appliances }),
  getApplianceBrands: () => request<{ brands: ApplianceBrands }>('GET', '/settings/appliance-brands'),
  setApplianceBrands: (brands: ApplianceBrands) =>
    request<{ brands: ApplianceBrands }>('PUT', '/settings/appliance-brands', { brands }),
  // brand -> allowed account ids (admin-only; empty/absent = visible to everyone)
  getRestrictedBrands: () => request<{ restrictedBrands: RestrictedBrands }>('GET', '/settings/restricted-brands'),
  setRestrictedBrands: (restrictedBrands: RestrictedBrands) =>
    request<{ restrictedBrands: RestrictedBrands }>('PUT', '/settings/restricted-brands', { restrictedBrands }),

  // ---- admin: cabinet handle/hardware inventory ----
  getHandles: () => request<{ handles: HandleItem[] }>('GET', '/settings/handles'),
  setHandles: (handles: HandleItem[]) => request<{ handles: HandleItem[] }>('PUT', '/settings/handles', { handles }),

  // ---- admin: per-model 3D placement overrides (appliance aligner) ----
  getModelAligns: () => request<{ modelAligns: ModelAligns }>('GET', '/settings/model-aligns'),
  setModelAligns: (modelAligns: ModelAligns) => request<{ modelAligns: ModelAligns }>('PUT', '/settings/model-aligns', { modelAligns }),

  // ---- dealer profile ----
  getPrefs: () => request<{ prefs: DealerPrefs }>('GET', '/profile/prefs'),
  setPrefs: (prefs: DealerPrefs) => request<{ prefs: DealerPrefs }>('PUT', '/profile/prefs', prefs),
  setLogo: (logo: string) => request<{ logo: string }>('PUT', '/profile/logo', { logo }),
  setCert: (cert: string, name: string) => request<{ cert: CertInfo }>('PUT', '/profile/cert', { cert, name }),
  getCert: () => request<{ cert: string; name: string }>('GET', '/profile/cert'),
  // dealer's own appliance/liner inventory (added on top of the admin global)
  getOwnAppliances: () => request<{ appliances: ApplianceItem[] }>('GET', '/profile/appliances'),
  setOwnAppliances: (appliances: ApplianceItem[]) =>
    request<{ appliances: ApplianceItem[] }>('PUT', '/profile/appliances', { appliances }),

  // ---- jobs ----
  listJobs: () => request<{ jobs: JobSummary[] }>('GET', '/jobs'),
  // admin: every dealer's saved designs
  listAllJobs: () => request<{ jobs: AdminJobSummary[] }>('GET', '/jobs/all'),
  getJob: (id: number) => request<{ job: JobFull }>('GET', `/jobs/${id}`),
  createJob: (input: JobInput) => request<{ job: JobFull }>('POST', '/jobs', input),
  updateJob: (id: number, input: JobInput) => request<{ job: JobFull }>('PUT', `/jobs/${id}`, input),
  deleteJob: (id: number) => request<{ ok: true }>('DELETE', `/jobs/${id}`),
};
