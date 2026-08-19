import type { Design, Wall } from './types';

/** A point in a wall's local frame: x along the wall from its start, z the
 *  depth from the wall line (positive toward the room, negative behind -
 *  the seating-overhang side of an island). Inches. */
export interface CounterPt {
  x: number;
  z: number;
}

/** Manual countertop shape for one wall: one or more closed polygons in the
 *  wall's local frame. When present it REPLACES the auto-generated slab for
 *  that wall (sink / drop-in cut-outs still apply automatically). */
export interface CounterShape {
  polys: CounterPt[][];
}

export function counterShapeFor(design: Design, wallId: string): CounterShape | undefined {
  return design.counterShapes?.[wallId];
}

/** Polygon area (shoelace), square inches. */
export function polyArea(poly: CounterPt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.z - q.x * p.z;
  }
  return Math.abs(a) / 2;
}

/** Round a coordinate to the editor's snap grid (1/2"). */
export function snapIn(v: number, step = 0.5): number {
  return Math.round(v / step) * step;
}

/** Centroid of a polygon (for labels). */
export function polyCenter(poly: CounterPt[]): CounterPt {
  const n = poly.length || 1;
  return { x: poly.reduce((s, p) => s + p.x, 0) / n, z: poly.reduce((s, p) => s + p.z, 0) / n };
}

/** Build a rectangle polygon from a plan rect (x1..x2, zBack..zFront). */
export function rectPoly(x1: number, x2: number, zBack: number, zFront: number): CounterPt[] {
  return [
    { x: x1, z: zBack },
    { x: x2, z: zBack },
    { x: x2, z: zFront },
    { x: x1, z: zFront },
  ];
}

/** Convert a wall-local point to world plan coords (for 3D placement via
 *  the wall's frame this is done by the scene; here only for the plan). */
export function wallLocalToWorld(wall: Wall, p: CounterPt): { x: number; y: number } {
  const a = (wall.angle * Math.PI) / 180;
  const dx = Math.cos(a), dy = Math.sin(a);
  const nx = -dy, ny = dx;
  return { x: wall.x + dx * p.x + nx * p.z, y: wall.y + dy * p.x + ny * p.z };
}
