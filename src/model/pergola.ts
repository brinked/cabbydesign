// The Pergola Collection — models placed over a kitchen design in Top View and
// rendered in 3D. Pricing is $/sq-ft of footprint plus a per-column charge;
// the admin sets those rates and every user builds against them.
import type { Pergola, PergolaAttach } from './types';

export interface PergolaModelInfo {
  id: string;
  name: string;
  /** Short roof description shown in pickers. */
  desc: string;
  /** Default $/sq-ft when no admin/dealer rate is configured. */
  rate: number;
  /** Default $ per column when no admin/dealer rate is configured. */
  columnPrice: number;
  /** How far a side can span (feet) before an intermediate column is needed. */
  maxSpanFt: number;
  /** Columns sit flush at the corners (modern look) rather than inset. */
  edgeColumns?: boolean;
}

export const PERGOLA_MODELS: PergolaModelInfo[] = [
  { id: 'aria', name: 'Aria', desc: 'open lattice', rate: 80, columnPrice: 0, maxSpanFt: 20 },
  { id: 'fresco', name: 'Fresco', desc: 'translucent roof', rate: 90, columnPrice: 0, maxSpanFt: 20 },
  { id: 'moderno', name: 'Moderno', desc: 'solid roof', rate: 100, columnPrice: 0, maxSpanFt: 20 },
  { id: 'contempo', name: 'Contempo', desc: 'solid + truss ends', rate: 120, columnPrice: 0, maxSpanFt: 20 },
  { id: 'classico', name: 'Classico', desc: 'exposed trusses', rate: 130, columnPrice: 0, maxSpanFt: 20 },
  { id: 'sole', name: 'Sole', desc: 'motorized louvers', rate: 170, columnPrice: 0, maxSpanFt: 20 },
  // Corner-column louvered pergola: posts flush at the corners for a clean
  // modern line, and a 25 ft clear span before a third column is needed.
  { id: 'modern', name: 'Modern', desc: 'solid roof, squared corner columns', rate: 150, columnPrice: 450, maxSpanFt: 25, edgeColumns: true },
];

/** Suffix marking a per-COLUMN price inside the flat pergola rate map (the
 *  map is keyed by model id for $/sq-ft; this keeps both in one setting). */
export const COLUMN_RATE_SUFFIX = '__col';

export const PERGOLA_COLORS: Array<{ id: string; name: string; hex: string }> = [
  { id: 'bronze', name: 'Bronze', hex: '#41372b' },
  { id: 'white', name: 'White', hex: '#f4f3ef' },
  { id: 'sand', name: 'Sand', hex: '#cbbfa5' },
];

export function pergolaModelInfo(id: string): PergolaModelInfo {
  return PERGOLA_MODELS.find((m) => m.id === id) ?? PERGOLA_MODELS[0];
}

export function pergolaColorHex(id: string): string {
  return PERGOLA_COLORS.find((c) => c.id === id)?.hex ?? PERGOLA_COLORS[0].hex;
}

/** Footprint area in square feet. */
export function pergolaAreaSqft(p: Pergola): number {
  return Math.round(((p.w * p.l) / 144) * 10) / 10;
}

/** The $/sq-ft a design bills at: the admin's rate, else the built-in default. */
export function pergolaRateFor(model: string, rates: Record<string, number>): number {
  return rates[model] ?? pergolaModelInfo(model).rate;
}

/** The $ per column a design bills at: the admin's rate, else the default. */
export function pergolaColumnRateFor(model: string, rates: Record<string, number>): number {
  return rates[model + COLUMN_RATE_SUFFIX] ?? pergolaModelInfo(model).columnPrice;
}

/**
 * Column layout for a pergola. Columns form a grid: a side needs an extra
 * column every `maxSpanFt`, so a run under the limit is just the two corners.
 * A side set against a wall/house drops that row entirely — the structure
 * mounts to the building instead.
 */
export function pergolaColumns(p: Pergola): { nx: number; ny: number; total: number } {
  const info = pergolaModelInfo(p.model);
  const maxSpan = Math.max(12, info.maxSpanFt * 12); // inches
  const nx = Math.ceil(Math.max(1, p.w) / maxSpan) + 1;
  const ny = Math.ceil(Math.max(1, p.l) / maxSpan) + 1;
  let total = nx * ny;
  // an attached side is carried by the wall, so its whole row of posts goes
  if (p.attach === 'back' || p.attach === 'front') total -= nx;
  else if (p.attach === 'left' || p.attach === 'right') total -= ny;
  return { nx, ny, total: Math.max(0, total) };
}

/**
 * Snap a dragged pergola flush against a nearby wall and mark that side as
 * attached (its columns then drop). Works at any rotation: each side's outward
 * normal is rotated into plan space, and a wall qualifies when it runs roughly
 * parallel to that side, sits within `threshold`, and actually overlaps it.
 * Returns null when nothing is close enough.
 */
export function snapPergolaToWalls(
  p: Pergola,
  walls: Array<{ p0: { x: number; y: number }; p1: { x: number; y: number } }>,
  threshold = 18
): { x: number; y: number; attach: PergolaAttach } | null {
  const a = ((p.angle ?? 0) * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const sides: Array<{ attach: PergolaAttach; nx: number; ny: number; half: number; halfAlong: number }> = [
    { attach: 'left', nx: -1, ny: 0, half: p.w / 2, halfAlong: p.l / 2 },
    { attach: 'right', nx: 1, ny: 0, half: p.w / 2, halfAlong: p.l / 2 },
    { attach: 'back', nx: 0, ny: -1, half: p.l / 2, halfAlong: p.w / 2 },
    { attach: 'front', nx: 0, ny: 1, half: p.l / 2, halfAlong: p.w / 2 },
  ];
  let best: { x: number; y: number; attach: PergolaAttach; d: number } | null = null;
  for (const s of sides) {
    // side normal + centre, rotated into plan space
    const nx = s.nx * cos - s.ny * sin;
    const ny = s.nx * sin + s.ny * cos;
    const cx = p.x + nx * s.half;
    const cy = p.y + ny * s.half;
    for (const w of walls) {
      const dx = w.p1.x - w.p0.x;
      const dy = w.p1.y - w.p0.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) continue;
      const ux = dx / len;
      const uy = dy / len;
      // the wall must run parallel to this side (normal perpendicular to it)
      if (Math.abs(nx * ux + ny * uy) > 0.26) continue; // ~15° tolerance
      // signed distance from the side centre to the wall line, along the normal
      const gap = (w.p0.x - cx) * nx + (w.p0.y - cy) * ny;
      if (Math.abs(gap) > threshold) continue;
      // and the side has to actually sit alongside the wall, not past its end
      const t = (cx - w.p0.x) * ux + (cy - w.p0.y) * uy;
      if (t < -s.halfAlong || t > len + s.halfAlong) continue;
      if (!best || Math.abs(gap) < Math.abs(best.d)) {
        best = { x: Math.round(p.x + nx * gap), y: Math.round(p.y + ny * gap), attach: s.attach, d: gap };
      }
    }
  }
  return best ? { x: best.x, y: best.y, attach: best.attach } : null;
}

/** A new pergola centred over the plan point, at a common starter size. */
export function defaultPergola(x: number, y: number): Pergola {
  return { x: Math.round(x), y: Math.round(y), w: 192, l: 144, angle: 0, model: 'aria', color: 'bronze', postH: 96 };
}
