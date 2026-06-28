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
  | 'endcap'
  | 'filler';

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
  /** Appliance chosen for this cabinet (appliance-housing cabinets only). */
  appliance?: ApplianceSelection;
  /** Countertop waterfall edge down the left/right side (run ends only). */
  waterfallL?: boolean;
  waterfallR?: boolean;
  /** Auto-placed dead-corner filler — re-derived on every layout change and
   *  not hand-editable (managed by the app, not the user). */
  auto?: boolean;
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

export interface Design {
  name: string;
  client: string;
  layout: LayoutKind;
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
}

export interface PricedLine {
  item: PlacedItem;
  cat: CatalogItem;
  price: number;
  formula: string;
  error?: string;
}
