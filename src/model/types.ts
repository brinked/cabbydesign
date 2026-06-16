// All dimensions are in inches.

export type Lane = 'floor' | 'upper';

export type FrontKind =
  | 'door1'
  | 'door2'
  | 'drawers3'
  | 'drawers4'
  | 'doordrawer'
  | 'door2drawer'
  | 'sink'
  | 'sink2'
  | 'sink1'
  | 'sink1f'
  | 'open'
  | 'pantry'
  | 'trash'
  | 'trashdrawer'
  | 'corner'
  | 'susan'
  | 'blind'
  | 'blindl'
  | 'blindr'
  | 'grill'
  | 'grill4'
  | 'griddle'
  | 'burner'
  | 'fridge'
  | 'fridge2'
  | 'fridgep'
  | 'fridgep2'
  | 'propane'
  | 'propanedrawer'
  | 'kamado'
  | 'pizza'
  | 'cartgrill'
  | 'dishwasher'
  | 'icemaker'
  | 'endcap'
  | 'filler';

export type Category = 'base' | 'wall' | 'tall' | 'outdoor' | 'appliance' | 'trim';

export interface CatalogItem {
  id: string;
  name: string;
  category: Category;
  front: FrontKind;
  lane: Lane;
  /** Default size */
  w: number;
  d: number;
  h: number;
  minW: number;
  maxW: number;
  stepW: number;
  minD?: number;
  maxD?: number;
  /** Allowed height range (inches). Defaults to 12–96 in the editor when unset. */
  minH?: number;
  maxH?: number;
  /** Whether a countertop runs over this unit */
  counter: boolean;
  /** Appliance drawn above the counter line (grill head, burner lid...) */
  topGearH?: number;
  /** Default pricing formula for the box. Variables: W, D, H (inches). */
  formula: string;
  /** Mount height off the floor for upper-lane items (bottom edge). */
  mount?: number;
  /** Max pull-out trays this cabinet accepts (0 = none). */
  maxTrays?: number;
  /** Per-inch price for fillers (overrides formula when set). */
  perInch?: number;
  /** Short note shown in the catalog / editor (e.g. sizing guidance). */
  note?: string;
}

/** User override of a cabinet's allowed size range (Settings). */
export interface DimOverride {
  minW?: number;
  maxW?: number;
  minD?: number;
  maxD?: number;
}

export type HingeSide = 'left' | 'right';

/** Door face style: routed groove "shaker" (HDPE) or euro flat slab. */
export type DoorStyle = 'shaker' | 'flat';

export interface Wall {
  id: string;
  name: string;
  length: number;
  height: number;
  /** Plan-view placement: start point of the wall and direction in degrees (0 = east, 90 = south on screen). */
  x: number;
  y: number;
  angle: number;
  /** Wall thickness in plan view (inches). */
  thickness: number;
  /** Invisible wall — an island/peninsula run with no physical wall drawn. */
  ghost: boolean;
}

export interface PlacedItem {
  id: string;
  wallId: string;
  catalogId: string;
  /** Distance from the left end of the wall to the item's left edge. */
  x: number;
  w: number;
  d: number;
  h: number;
  /** Distance the unit is pulled away from the wall. */
  outset: number;
  /** Bottom edge height off the floor (upper-lane items only). */
  mount: number;
  /** Which side the door is hinged on (single-door fronts; door side for blind corners). */
  hinge: HingeSide;
  /** Applied (finished) end panel on the left/right end of a run. */
  endL: boolean;
  endR: boolean;
  /** Pull-out trays added inside this cabinet (0..maxTrays). */
  trays: number;
}

export type LayoutKind = 'linear' | 'l' | 'u';

export interface FinishOption {
  id: string;
  name: string;
  /** Cabinet body color */
  body: string;
  /** Door/drawer panel color (slightly lighter/darker) */
  panel: string;
  /** Recessed panel inner color */
  inner: string;
  /** Countertop color */
  counter: string;
}

/** Plumbing or electrical rough-in / stub-out fixed to a wall. */
export type RoughInKind = 'plumbing' | 'electrical';
export interface RoughIn {
  id: string;
  wallId: string;
  kind: RoughInKind;
  /** Distance from the left end of the wall to the center (inches). */
  x: number;
  /** Height from the floor to the center (inches). */
  y: number;
  /** Overall opening size (inches). */
  w: number;
  h: number;
}

export interface Design {
  name: string;
  client: string;
  layout: LayoutKind;
  finishId: string;
  doorStyle: DoorStyle;
  walls: Wall[];
  items: PlacedItem[];
  roughIns: RoughIn[];
}

export interface PricedLine {
  item: PlacedItem;
  cat: CatalogItem;
  price: number;
  formula: string;
  error?: string;
}
