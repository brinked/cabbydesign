// All dimensions are in inches.

export type Lane = 'floor' | 'upper';

/** Cabinet product line. 'ext' = EXT Cabinets custom HDPE (made-to-size);
 *  'newage' = NewAge Products Classic Series modular outdoor cabinets (fixed
 *  factory sizes; series & door finish — stainless Classic/Louvered or
 *  aluminum tempered-glass — are chosen per cabinet). */
export type ProductLine = 'ext' | 'newage';

/** What the user is designing — filters the catalog offered. */
export type KitchenType = 'indoor' | 'outdoor';

/** One purchasable NewAge variant: the SKU + retail pricing for a catalog item
 *  in a specific finish. `msrp` is the compare-at price (shown struck through). */
export interface NaVariant {
  sku: string;
  price: number;
  msrp: number;
}

export type FrontKind =
  | 'door1'
  | 'door2'
  | 'drawers3'
  | 'drawers4'
  | 'doordrawer'
  | 'door2drawer'
  | 'cooktop'
  | 'range'
  | 'sink'
  | 'sink2'
  | 'sink1'
  | 'sink1f'
  | 'open'
  | 'pantry'
  | 'applianceoven'
  | 'fridgetall'
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
  | 'griddle4'
  | 'burner'
  | 'fridge'
  | 'fridge2'
  | 'fridgep'
  | 'fridgep2'
  | 'propane'
  | 'propanedrawer'
  | 'kamado'
  | 'kamadoinsert'
  | 'pizza'
  | 'cartgrill'
  | 'dishwasher'
  | 'icemaker'
  | 'hood'
  | 'endcap'
  | 'filler'
  | 'flipup';

export type Category = 'base' | 'wall' | 'tall' | 'outdoor' | 'appliance' | 'trim';

/** Appliance categories that fit into a housing cabinet. */
export type ApplianceCat =
  | 'grill'
  | 'griddle'
  | 'sideburner'
  | 'powerburner'
  | 'kamado'
  | 'fridge'
  | 'icemaker'
  | 'hood'
  | 'liner';

/** One sellable appliance in the admin-managed inventory (model + MSRP). */
export interface ApplianceItem {
  /** Stable slug id. */
  id: string;
  category: ApplianceCat;
  brand: string;
  /** Manufacturer model number. */
  model: string;
  /** Short description shown beside the model. */
  name: string;
  /** Manufacturer's list price (what the customer pays on the report). */
  msrp: number;
  /** Grills only: id of the recommended insulated liner ('liner' item). */
  linerId?: string;
  /** Physical/cutout dimensions (inches). For a liner, the insulated-liner
   *  cutout opening (its width drives the 3″ grill-cabinet rule). For a
   *  fridge/ice maker, the appliance's own W×D×H — the height drives the gap
   *  shown under the counter when it's shorter than the cabinet. */
  cutoutW?: number;
  cutoutD?: number;
  cutoutH?: number;
  /** Panel-ready fridge/ice maker: charge for the custom cabinet-matched door
   *  panel(s). Adds a separate line on the report when > 0. */
  panelCharge?: number;
  /** Hidden from the dealer dropdowns when false. Defaults to true. */
  active?: boolean;
}

/** Per-brand discount map. The percent is the manufacturer discount the admin
 *  receives; the dealer automatically gets half of it. */
export type ApplianceBrands = Record<string, { discountPct: number }>;

/** Admin-managed $/sqft rates for end/back panels. `applied` covers applied
 *  end + island back panels; `finished` covers finished ends (costlier). */
export interface PanelRates {
  applied: number;
  finished: number;
}

/** Per-model 3D placement override, tuned in the admin Appliance Aligner and
 *  applied on top of the automatic seating. Keyed by model key (e.g.
 *  "blaze-lte-32"). All fields optional; absent = no adjustment. */
export interface ModelAlign {
  /** Rotation in degrees. yaw = around vertical, pitch = tip fwd/back, roll = tilt. */
  yaw?: number;
  pitch?: number;
  roll?: number;
  /** Position nudge in inches: left/right, up/down, forward/back. */
  dx?: number;
  dy?: number;
  dz?: number;
  /** Uniform size multiplier on top of the width fit (default 1). */
  scale?: number;
}
export type ModelAligns = Record<string, ModelAlign>;

/** One cabinet handle/pull in the admin-managed hardware inventory. */
export interface HandleItem {
  /** Stable slug id. */
  id: string;
  /** Display name (e.g. "6″ Brushed-Nickel Bar Pull"). */
  name: string;
  /** Optional product photo as a data-URL (base64). */
  photo?: string;
  /** Retail price per handle (what the customer pays). */
  retail: number;
  /** Dealer cost per handle. */
  dealer: number;
  /** Hidden from selection when false. Defaults to true. */
  active?: boolean;
}

/** A placed cabinet's appliance choice (persisted in the design JSON). */
export interface ApplianceSelection {
  /** 'inventory' = pick from the catalog; 'own' = customer-supplied (free text). */
  mode: 'inventory' | 'own';
  /** Selected inventory item id (mode 'inventory'). */
  applianceId?: string;
  /** Grill bundle: include the recommended insulated liner. */
  withLiner?: boolean;
  /** Free-text appliance description (mode 'own'). */
  ownText?: string;
}

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
  /** An under-counter appliance (e.g. a dishwasher) that carries no counter of
   *  its own but tucks under a continuous run, so the counter bridges over it. */
  underCounter?: boolean;
  /** Bar-height cabinet: the standard body plus a raised back "bar" that steps
   *  up BAR_RISE″ and adds BAR_DEPTH″ of depth, each tier getting its own stone
   *  top. `d` is the TOTAL depth (front body + bar). */
  barHeight?: boolean;
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
  /** Appliance category this cabinet houses — enables the appliance dropdown. */
  applianceCat?: ApplianceCat;
  /** Product line this item belongs to. Undefined = 'ext' (EXT HDPE custom). */
  line?: ProductLine;
  /** Factory-fixed dimensions — W/D/H are not editable (NewAge modular units). */
  fixed?: boolean;
  /** NewAge retail pricing per finish id (finish → SKU + price). A finish
   *  missing from the map means the unit isn't made in that finish. */
  naPricing?: Record<string, NaVariant>;
  /** Not offered in the Add-cabinet picker (e.g. the 4-door grill/griddle,
   *  which the 2-door version auto-converts into when widened past 41″). */
  hideFromAdd?: boolean;
  /** Tab the item is listed under in the Add-cabinet picker when it differs
   *  from `category` (e.g. fridges behave as outdoor cabinets but are picked
   *  from the Appliances tab). */
  displayCategory?: Category;
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
/** Door construction. 'shaker' is the HDPE routed-groove look (outdoor line);
 *  indoor wood cabinets use real 5-piece styles: inset-panel shaker, skinny
 *  (narrow-rail) shaker, raised panel and beadboard. 'flat' = slab/euro. */
export type DoorStyle = 'shaker' | 'flat' | 'shaker-inset' | 'shaker-skinny' | 'raised' | 'beadboard';

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
  /** Finished end — the cabinet side itself built from finished material
   *  (no added width, priced per sqft above the applied-end rate). */
  finL?: boolean;
  finR?: boolean;
  /** Pull-out trays added inside this cabinet (0..maxTrays). */
  trays: number;
  /** Appliance chosen for this cabinet (appliance-housing cabinets only). */
  appliance?: ApplianceSelection;
  /** Countertop waterfall edge down the left/right side (run ends only). */
  waterfallL?: boolean;
  waterfallR?: boolean;
  /** Auto-placed dead-corner filler — re-derived on every layout change and
   *  not hand-editable (managed by the app, not the user). */
  auto?: boolean;
  /** Per-cabinet series/door-finish override (NewAge units) — a finish id from
   *  the NewAge palette. Unset = follow the design's default finish. */
  finish?: string;
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
  /** Product line this finish belongs to. Undefined = 'ext' (HDPE colors). */
  line?: ProductLine;
  /** Wood-stained finish (indoor) — 3D renders a satin wood material. */
  wood?: boolean;
  /** Metallic surface — the 3D engine renders these with metalness/roughness. */
  metal?: 'stainless' | 'aluminum';
  /** Door-style group label for NewAge finishes (e.g. "Classic Door"). */
  group?: string;
  /** NewAge door construction: flat metal slab, horizontal louvered slats, or
   *  tempered glass in a metal frame. Drives 2D/3D door detailing. */
  naDoor?: 'flat' | 'louvered' | 'glass';
  /** Toe-kick/base color override (NewAge bases are black with levelers). */
  kick?: string;
}

/** Plumbing or electrical rough-in / stub-out fixed to a wall. */
export type RoughInKind = 'plumbing' | 'electrical' | 'gas';
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

/** A window or door cut into a wall — framed, draggable/resizable in elevation. */
export type OpeningKind = 'window' | 'door';
export interface Opening {
  id: string;
  wallId: string;
  kind: OpeningKind;
  /** Distance from the left end of the wall to the opening's center (inches). */
  x: number;
  /** Height from the floor to the bottom (sill) of the opening (inches). */
  y: number;
  /** Opening size (inches). */
  w: number;
  h: number;
}

/** Fuel type for the gas appliances in a job. Undefined = not yet chosen. */
export type GasType = 'ng' | 'lp';

/** Which wall end horizontal positions are measured from in the editors. */
export type DimFrom = 'left' | 'right';

/** One end of a measurement. If wallId/t are set the point is anchored to that
 *  wall (parametric position along it) and follows when the wall is moved;
 *  otherwise it's a free point at x/y. */
export interface MeasureEnd {
  x: number;
  y: number;
  wallId?: string;
  t?: number;
}

/** A persistent tape-measure annotation in the plan (top) view. */
export interface Measurement {
  id: string;
  a: MeasureEnd;
  b: MeasureEnd;
  /** Optional manual target length (inches) to line up against. */
  target?: number;
}

export interface Design {
  name: string;
  client: string;
  layout: LayoutKind;
  /** Indoor or outdoor kitchen — filters the catalog. Default 'outdoor'. */
  kitchenType?: KitchenType;
  /** Cabinet product line for this design. Default 'ext' (EXT HDPE custom). */
  line?: ProductLine;
  finishId: string;
  doorStyle: DoorStyle;
  /** Natural gas / liquid propane for the whole job (undefined = unset). */
  gasType?: GasType;
  /** Countertop slab thickness in inches (default 1.25″ = 3cm). */
  counterThickness: number;
  /** Countertop material/style id (see model/countertops). */
  counterId: string;
  /** Stone backsplash height up the wall in inches (0 = no backsplash). Uses
   *  the same stone as the countertop. */
  backsplashHeight: number;
  /** Measure horizontal positions from the left or right wall end. */
  dimFrom?: DimFrom;
  /** Selected cabinet handle/pull for the job (id into the handle inventory). */
  handleId?: string;
  walls: Wall[];
  items: PlacedItem[];
  roughIns: RoughIn[];
  openings: Opening[];
  /** Persistent tape-measure annotations in the plan view. */
  measurements?: Measurement[];
  /** Per-corner overrides for the auto-added corner fillers, keyed
   *  `${wallId}:start|end` — a custom width, or removed entirely. */
  cornerOverrides?: Record<string, { w?: number; off?: boolean }>;
}

export interface PricedLine {
  item: PlacedItem;
  cat: CatalogItem;
  price: number;
  formula: string;
  error?: string;
}
