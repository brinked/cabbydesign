import type { CatalogItem, LayoutKind, PlacedItem, Wall } from './types';

/**
 * Plan-view placement of a wall: origin point, unit direction vector
 * (the direction cabinet x grows), and an inward unit normal (the direction
 * cabinet depth grows, into the room). Derived from wall.x/y/angle.
 */
export interface WallFrame {
  wall: Wall;
  ox: number;
  oy: number;
  dx: number;
  dy: number;
  nx: number;
  ny: number;
  angle: number;
}

export const WALL_T = 5; // drawn wall thickness in plan view, inches
const CORNER_EPS = 2; // endpoints closer than this (inches) form a corner

export function frameForWall(wall: Wall): WallFrame {
  const rad = (wall.angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  // Inward normal: direction rotated +90° in screen coords (y down).
  return { wall, ox: wall.x, oy: wall.y, dx, dy, nx: -dy, ny: dx, angle: wall.angle };
}

export function wallEndpoints(wall: Wall): { p0: { x: number; y: number }; p1: { x: number; y: number } } {
  const f = frameForWall(wall);
  return {
    p0: { x: f.ox, y: f.oy },
    p1: { x: f.ox + f.dx * wall.length, y: f.oy + f.dy * wall.length },
  };
}

export interface Pt {
  x: number;
  y: number;
}

/**
 * Snap targets for joining walls: the inner-face (room-side) endpoints.
 * Walls join inner-corner to inner-corner, so the thickness never eats into
 * either wall's usable length — it projects outward and the slabs miter.
 */
export function wallSnapPoints(wall: Wall): Pt[] {
  const { p0, p1 } = wallEndpoints(wall);
  return [p0, p1];
}

/** Intersection of two infinite lines (point + direction), or null if parallel. */
function lineIntersect(pa: Pt, da: Pt, pb: Pt, db: Pt): Pt | null {
  const denom = da.x * db.y - da.y * db.x;
  if (Math.abs(denom) < 1e-6) return null;
  const s = ((pb.x - pa.x) * db.y - (pb.y - pa.y) * db.x) / denom;
  return { x: pa.x + s * da.x, y: pa.y + s * da.y };
}

/**
 * Slab outline for a wall in its LOCAL frame (x = 0..length along the wall,
 * y = 0 at the inner/room face, y = -thickness at the outer face). Where this
 * wall's inner endpoints meet another wall's inner endpoint, the outer corner
 * is mitered to the intersection of the two outer faces — so connected walls
 * form a clean corner joint with the thickness on the outside.
 * Returns [innerStart, innerEnd, outerEnd, outerStart].
 */
export function wallSlabPolygonLocal(wall: Wall, walls: Wall[]): Pt[] {
  const f = frameForWall(wall);
  const T = wall.thickness ?? WALL_T;
  const O: Pt = { x: f.ox, y: f.oy };
  const D: Pt = { x: f.dx, y: f.dy };
  const innerStartW = O;
  const innerEndW: Pt = { x: O.x + D.x * wall.length, y: O.y + D.y * wall.length };
  // outer face = inner face offset along the outward normal (-inward normal)
  let outerStartW: Pt = { x: innerStartW.x - f.nx * T, y: innerStartW.y - f.ny * T };
  let outerEndW: Pt = { x: innerEndW.x - f.nx * T, y: innerEndW.y - f.ny * T };

  const neighborOuterLine = (corner: Pt): { p: Pt; d: Pt } | null => {
    for (const w of walls) {
      if (w.id === wall.id || w.ghost) continue;
      const e = wallEndpoints(w);
      for (const end of [e.p0, e.p1]) {
        if (dist(end.x, end.y, corner.x, corner.y) <= CORNER_EPS) {
          const wf = frameForWall(w);
          const wt = w.thickness ?? WALL_T;
          return { p: { x: end.x - wf.nx * wt, y: end.y - wf.ny * wt }, d: { x: wf.dx, y: wf.dy } };
        }
      }
    }
    return null;
  };

  const nbS = neighborOuterLine(innerStartW);
  if (nbS) {
    const h = lineIntersect(outerStartW, D, nbS.p, nbS.d);
    if (h) outerStartW = h;
  }
  const nbE = neighborOuterLine(innerEndW);
  if (nbE) {
    const h = lineIntersect(outerEndW, D, nbE.p, nbE.d);
    if (h) outerEndW = h;
  }

  // express the outer corners in the wall's local frame for rendering
  const rad = (wall.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const toLocal = (p: Pt): Pt => {
    const dx = p.x - O.x;
    const dy = p.y - O.y;
    return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
  };
  return [
    { x: 0, y: 0 },
    { x: wall.length, y: 0 },
    toLocal(outerEndW),
    toLocal(outerStartW),
  ];
}

/** Auto-arrange placements for the classic shapes. Returns one {x,y,angle} per wall. */
export function presetPlacements(kind: LayoutKind, walls: Pick<Wall, 'length'>[]): Array<{ x: number; y: number; angle: number }> {
  const out: Array<{ x: number; y: number; angle: number }> = [];
  if (kind === 'l' && walls.length >= 2) {
    out.push({ x: 0, y: 0, angle: 0 });
    out.push({ x: walls[0].length, y: 0, angle: 90 });
    let y = walls[1].length + 130;
    for (let i = 2; i < walls.length; i++) {
      out.push({ x: 0, y, angle: 0 });
      y += 130;
    }
    return out;
  }
  if (kind === 'u' && walls.length >= 3) {
    out.push({ x: 0, y: walls[0].length, angle: -90 });
    out.push({ x: 0, y: 0, angle: 0 });
    out.push({ x: walls[1].length, y: 0, angle: 90 });
    let y = Math.max(walls[0].length, walls[2].length) + 130;
    for (let i = 3; i < walls.length; i++) {
      out.push({ x: 0, y, angle: 0 });
      y += 130;
    }
    return out;
  }
  // galley / parallel runs
  let y = 0;
  for (let i = 0; i < walls.length; i++) {
    out.push({ x: 0, y, angle: 0 });
    y += 130;
  }
  return out;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export interface CornerReserve {
  start: number;
  end: number;
}

/** Extra clearance reserved on each wall at a corner for door/drawer clearance. */
const CORNER_FILLER = 3;

/**
 * Where two non-island walls meet, each wall reserves a "dead corner" only big
 * enough to clear the OTHER wall's cabinet at that corner — its depth plus a 3"
 * clearance. If the other wall has NO cabinet at the corner, nothing is reserved
 * (so a returning L-wall with no run lets cabinets sit right into the corner).
 * A blind/lazy-susan corner cabinet fills the corner, so the adjacent run butts
 * flush against it (no extra filler). Corner cabinets are exempt and may occupy
 * their own reserve.
 */
export function cornerReserves(
  walls: Wall[],
  items: PlacedItem[],
  catFor: (id: string) => CatalogItem
): Map<string, CornerReserve> {
  const map = new Map<string, CornerReserve>();
  for (const w of walls) map.set(w.id, { start: 0, end: 0 });

  // the floor cabinet nearest a wall end — the one that borders the corner and
  // must be cleared. Fillers are shallow trim that sit IN the reserve, so they
  // don't size it. Also reports whether it's a corner cabinet (susan/diagonal/
  // blind), which fills the corner so the adjacent run butts flush (no filler).
  const nearest = (wall: Wall, atEnd: 'start' | 'end'): { depth: number; corner: boolean } => {
    let bestDist = Infinity;
    let depth = 0;
    let corner = false;
    for (const it of items) {
      const c = catFor(it.catalogId);
      if (it.wallId !== wall.id || c.lane !== 'floor' || c.front === 'filler') continue;
      const fw = it.w + (it.endL ? 0.75 : 0) + (it.endR ? 0.75 : 0);
      const distToCorner = atEnd === 'start' ? it.x : wall.length - (it.x + fw);
      if (distToCorner < bestDist) {
        bestDist = distToCorner;
        depth = it.d + it.outset;
        corner = isCornerFront(c);
      }
    }
    return { depth, corner };
  };
  // No cabinet on the other wall → no reserve. A corner cabinet fills the
  // corner → the other run butts flush (no filler). Otherwise reserve that
  // cabinet's depth + 3" clearance.
  const reserveFor = (n: { depth: number; corner: boolean }): number =>
    n.depth <= 0 ? 0 : n.corner ? n.depth : n.depth + CORNER_FILLER;

  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const a = wallEndpoints(walls[i]);
      const b = wallEndpoints(walls[j]);
      const combos: Array<['start' | 'end', 'start' | 'end', number]> = [
        ['start', 'start', dist(a.p0.x, a.p0.y, b.p0.x, b.p0.y)],
        ['start', 'end', dist(a.p0.x, a.p0.y, b.p1.x, b.p1.y)],
        ['end', 'start', dist(a.p1.x, a.p1.y, b.p0.x, b.p0.y)],
        ['end', 'end', dist(a.p1.x, a.p1.y, b.p1.x, b.p1.y)],
      ];
      for (const [endA, endB, d] of combos) {
        if (d > CORNER_EPS) continue;
        if (walls[i].ghost || walls[j].ghost) continue; // islands don't form corners
        const ra = map.get(walls[i].id)!;
        const rb = map.get(walls[j].id)!;
        // Each wall reserves enough to clear the OTHER wall's nearest cabinet.
        // A dead corner (regular cabinet or empty) keeps a 3" filler clearance;
        // but when a corner cabinet (susan/diagonal/blind) fills the corner the
        // adjacent run butts flush against it, so no filler is added. Corner
        // cabinets are exempt and may occupy their own reserve.
        const reserveA = reserveFor(nearest(walls[j], endB));
        const reserveB = reserveFor(nearest(walls[i], endA));
        if (endA === 'start') ra.start = Math.max(ra.start, reserveA);
        else ra.end = Math.max(ra.end, reserveA);
        if (endB === 'start') rb.start = Math.max(rb.start, reserveB);
        else rb.end = Math.max(rb.end, reserveB);
      }
    }
  }
  return map;
}

/** Cabinet fronts allowed to occupy a reserved corner zone. */
export function isCornerFront(cat: CatalogItem): boolean {
  const f = cat.front;
  return f === 'corner' || f === 'susan' || f === 'blind' || f === 'blindl' || f === 'blindr';
}

/** Items allowed to impede into a reserved corner zone (corner cabinets + fillers). */
export function isReserveExempt(cat: CatalogItem): boolean {
  return isCornerFront(cat) || cat.front === 'filler';
}

/**
 * True when `wall` shares an endpoint with `other` but its inward side
 * (where cabinets sit) faces AWAY from the corner they form — i.e. the wall
 * should be flipped so the corner closes properly.
 */
export function cornerNeedsFlip(wall: Wall, other: Wall): boolean {
  const we = wallEndpoints(wall);
  const oe = wallEndpoints(other);
  let otherEnd: 'start' | 'end' | null = null;
  for (const [mine, theirs, end] of [
    [we.p0, oe.p0, 'start'],
    [we.p0, oe.p1, 'end'],
    [we.p1, oe.p0, 'start'],
    [we.p1, oe.p1, 'end'],
  ] as const) {
    if (dist(mine.x, mine.y, theirs.x, theirs.y) <= CORNER_EPS) {
      otherEnd = end;
      break;
    }
  }
  if (!otherEnd) return false;
  const fW = frameForWall(wall);
  const fO = frameForWall(other);
  // Direction the other wall runs AWAY from the shared corner.
  const ax = otherEnd === 'start' ? fO.dx : -fO.dx;
  const ay = otherEnd === 'start' ? fO.dy : -fO.dy;
  const dot = fW.nx * ax + fW.ny * ay;
  if (Math.abs(dot) < 0.01) return false; // collinear — no corner
  return dot < 0;
}

/** Axis-aligned bounding box of all wall frames including cabinet depth allowance. */
export function planBounds(frames: WallFrame[], pad = 40): { x: number; y: number; w: number; h: number } {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const consider = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const f of frames) {
    const L = f.wall.length;
    const T = f.wall.thickness ?? WALL_T;
    const D = 36; // depth allowance for cabinets + counters
    consider(f.ox - f.nx * T, f.oy - f.ny * T);
    consider(f.ox + f.dx * L - f.nx * T, f.oy + f.dy * L - f.ny * T);
    consider(f.ox + f.nx * D, f.oy + f.ny * D);
    consider(f.ox + f.dx * L + f.nx * D, f.oy + f.dy * L + f.ny * D);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 100, h: 100 };
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}
