// Cabinet-company personalization helpers: turn the company's custom colors
// and priced handles (stored in CatalogPrefs) into the app's standard
// FinishOption / HandleItem shapes so every picker, renderer and price line
// treats them like built-ins.
import type { CatalogPrefs } from '../api/client';
import type { FinishOption, HandleItem } from './types';

/** Darken a #rrggbb color by a factor (0..1) — used for recessed panels. */
function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  if (Number.isNaN(n)) return hex;
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  const r = ch((n >> 16) & 0xff);
  const g = ch((n >> 8) & 0xff);
  const b = ch(n & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Whether a body color is light (drives the default counter contrast). */
function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

/** The company's custom colors as regular finish options ("My Colors"). */
export function companyFinishes(prefs: CatalogPrefs | null | undefined): FinishOption[] {
  return (prefs?.customFinishes ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    body: f.body,
    panel: f.body,
    inner: shade(f.body, 0.82),
    counter: isLight(f.body) ? '#3b3f44' : '#e3e0da',
    group: 'My Colors',
  }));
}

/** The company's custom handles as regular handle items (retail = dealer). */
export function companyHandles(prefs: CatalogPrefs | null | undefined): HandleItem[] {
  return (prefs?.customHandles ?? []).map((h) => ({ id: h.id, name: h.name, retail: h.price, dealer: h.price }));
}

/** Admin handles the company hasn't hidden + the company's own handles. */
export function mergedHandles(handles: HandleItem[], prefs: CatalogPrefs | null | undefined): HandleItem[] {
  const hidden = new Set(prefs?.hiddenHandles ?? []);
  return [...handles.filter((h) => h.active !== false && !hidden.has(h.id)), ...companyHandles(prefs)];
}

/** Resolve a finish id that may belong to the company palette. */
export function companyFinishById(prefs: CatalogPrefs | null | undefined, id: string): FinishOption | undefined {
  return companyFinishes(prefs).find((f) => f.id === id);
}
