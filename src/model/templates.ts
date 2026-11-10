// Guided start: the kitchen shapes a new design can begin as, and the starter
// layouts that pre-fill them, per brand. A starter is only a first draft — the
// cabinets are ordinary ones the user can move, swap or delete.
import type { KitchenType, LayoutKind, ProductLine, Wall } from './types';
import { presetPlacements } from './geometry';

export type KitchenShape = 'straight' | 'island' | 'l' | 'u';

export interface StartSpec {
  kitchenType: KitchenType;
  line: ProductLine;
  shape: KitchenShape;
  /** Run lengths in inches, one per wall of the shape. */
  lengths: number[];
  /** Pre-fill with a starter layout (otherwise the walls start empty). */
  starter: boolean;
}

export const SHAPES: Array<{ id: KitchenShape; label: string; sub: string; walls: string[]; defaults: number[] }> = [
  { id: 'straight', label: 'Straight run', sub: 'One run of cabinets against a wall.', walls: ['Wall length'], defaults: [144] },
  { id: 'island', label: 'Island', sub: 'A freestanding island, finished on all sides.', walls: ['Island length'], defaults: [120] },
  { id: 'l', label: 'L-shape', sub: 'Two runs meeting in a corner.', walls: ['First wall', 'Second wall'], defaults: [144, 96] },
  { id: 'u', label: 'U-shape', sub: 'Three runs wrapping around you.', walls: ['Left wall', 'Back wall', 'Right wall'], defaults: [96, 144, 96] },
];

const WALL_NAMES: Record<KitchenShape, string[]> = {
  straight: ['Front Wall'],
  island: ['Island'],
  l: ['Back Wall', 'Side Wall'],
  u: ['Left Wall', 'Back Wall', 'Right Wall'],
};

/** Shortest / longest run the wizard accepts (inches). */
export const MIN_RUN = 36;
export const MAX_RUN = 480;

export function layoutFor(shape: KitchenShape): LayoutKind {
  return shape === 'l' ? 'l' : shape === 'u' ? 'u' : 'linear';
}

/** The walls of a shape, placed and joined at their corners. */
export function wallsForShape(shape: KitchenShape, lengths: number[], newId: () => string): Wall[] {
  const def = SHAPES.find((s) => s.id === shape)!;
  const lens = def.defaults.map((d, i) => {
    const v = Number(lengths[i]);
    return Number.isFinite(v) && v > 0 ? Math.min(MAX_RUN, Math.max(MIN_RUN, Math.round(v))) : d;
  });
  const island = shape === 'island';
  const place = presetPlacements(layoutFor(shape), lens.map((length) => ({ length })));
  return lens.map((length, i) => ({
    id: newId(),
    name: WALL_NAMES[shape][i],
    length,
    height: 96,
    ...place[i],
    thickness: island ? 0 : 5,
    ghost: island,
  }));
}

/** Index of the wall that carries the cooking/sink run in a starter layout. */
export function mainWallIndex(shape: KitchenShape): number {
  return shape === 'u' ? 1 : 0;
}

interface Recipe {
  /** Left-to-right cabinets of the main run (each is skipped if it won't fit). */
  main: string[];
  /** Storage cabinets used to fill whatever space is left, first that fits. */
  fill: string[];
}

const RECIPES: Record<string, Recipe> = {
  'ext-outdoor': { main: ['base-drawer3', 'out-grill', 'base-2door', 'base-sink2', 'base-trashdrawer'], fill: ['base-2door', 'base-1door'] },
  'ext-indoor': { main: ['base-drawer3', 'base-cooktop', 'base-2door', 'base-sink2', 'base-trashdrawer'], fill: ['base-2door', 'base-1door'] },
  newage: { main: ['na-3drawer', 'na-grill36', 'na-2door', 'na-sink', 'na-bar'], fill: ['na-2door', 'na-1door16'] },
  challenger: { main: ['ch-drawer3', 'ch-grill', 'ch-door2', 'ch-sink2', 'ch-waste'], fill: ['ch-door2', 'ch-door1'] },
};

/** The starter recipe for a brand + kitchen type. */
export function recipeFor(line: ProductLine | undefined, kitchenType: KitchenType | undefined): Recipe {
  const l = line ?? 'ext';
  return RECIPES[l === 'ext' ? `ext-${kitchenType ?? 'outdoor'}` : l] ?? RECIPES['ext-outdoor'];
}
