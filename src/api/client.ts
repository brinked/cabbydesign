// Typed client for the CabDesign API. All requests are same-origin (the Vite
// dev server proxies /api to the Express backend), so the session cookie rides
// along automatically with credentials: 'include'.
import type { Design } from '../model/types';

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
  /** Data-URL logo for reports ('' if none). Populated only for the signed-in user. */
  logo: string;
}

export interface DealerPrefs {
  marginPct: number;
  showPricing: boolean;
  priceMode: 'cost' | 'marked_up';
}

export type DealerWithPrefs = ApiUser & { prefs: DealerPrefs };

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

export interface DealerInput {
  name: string;
  email: string;
  role: 'admin' | 'dealer';
  companyName: string;
  companySlogan: string;
  address: string;
  phone: string;
  active: boolean;
  password?: string;
}

export interface JobInput {
  name: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  design: Design;
}

export const api = {
  // ---- auth ----
  me: () => request<{ user: ApiUser | null; prefs?: DealerPrefs }>('GET', '/auth/me'),
  login: (email: string, password: string) =>
    request<{ user: ApiUser; prefs: DealerPrefs }>('POST', '/auth/login', { email, password }),
  logout: () => request<{ ok: true }>('POST', '/auth/logout'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('POST', '/auth/change-password', { currentPassword, newPassword }),

  // ---- admin: dealers ----
  listDealers: () => request<{ dealers: DealerWithPrefs[] }>('GET', '/dealers'),
  createDealer: (input: DealerInput) => request<{ dealer: DealerWithPrefs }>('POST', '/dealers', input),
  updateDealer: (id: number, input: DealerInput) =>
    request<{ dealer: DealerWithPrefs }>('PUT', `/dealers/${id}`, input),
  resetDealerPassword: (id: number, password: string) =>
    request<{ ok: true }>('POST', `/dealers/${id}/reset-password`, { password }),
  deleteDealer: (id: number) => request<{ ok: true }>('DELETE', `/dealers/${id}`),

  // ---- admin: global cabinet dimension limits + base pricing formulas ----
  getCabinetDims: () => request<{ dims: CabinetDims }>('GET', '/settings/cabinet-dims'),
  setCabinetDims: (dims: CabinetDims) => request<{ dims: CabinetDims }>('PUT', '/settings/cabinet-dims', { dims }),
  getPricing: () => request<{ pricing: Record<string, string> }>('GET', '/settings/pricing'),
  setPricing: (pricing: Record<string, string>) =>
    request<{ pricing: Record<string, string> }>('PUT', '/settings/pricing', { pricing }),

  // ---- dealer profile ----
  getPrefs: () => request<{ prefs: DealerPrefs }>('GET', '/profile/prefs'),
  setPrefs: (prefs: DealerPrefs) => request<{ prefs: DealerPrefs }>('PUT', '/profile/prefs', prefs),
  setLogo: (logo: string) => request<{ logo: string }>('PUT', '/profile/logo', { logo }),

  // ---- jobs ----
  listJobs: () => request<{ jobs: JobSummary[] }>('GET', '/jobs'),
  getJob: (id: number) => request<{ job: JobFull }>('GET', `/jobs/${id}`),
  createJob: (input: JobInput) => request<{ job: JobFull }>('POST', '/jobs', input),
  updateJob: (id: number, input: JobInput) => request<{ job: JobFull }>('PUT', `/jobs/${id}`, input),
  deleteJob: (id: number) => request<{ ok: true }>('DELETE', `/jobs/${id}`),
};
