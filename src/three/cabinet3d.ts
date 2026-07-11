import * as THREE from 'three';
import { BASE_H, COUNTER_T, TOEKICK_H } from '../model/catalog';
import type { CatalogItem, DoorStyle, FinishOption, HingeSide, ModelAlign } from '../model/types';
import { countertopById, DEFAULT_COUNTERTOP, type Countertop } from '../model/countertops';
import { applianceModelInfo, fitModel, hasModel, requestModel } from './models';

// Real griddle model placement (tunable). Width as a fraction of the cabinet,
// how far the cooking surface sits PROUD of the cabinet top (the firebox drops
// in below), gap from the back wall, and a yaw flip if the controls face the
// wall. The model's front (controls) is +z, matching the room-facing direction.
const GRIDDLE_MODEL_W_FRAC = 0.9;
const GRIDDLE_MODEL_PROUD = 2.5;
const GRIDDLE_MODEL_BACK = -3; // protrude the griddle face a few inches past the cabinet
const GRIDDLE_MODEL_YAW = 0;

// Real grill model placement (Broilmaster B-Series head). The firebox drops
// into the cabinet by SINK inches (hood + control face stay above/in front);
// BACK works like the griddle's (negative = face protrudes past the cabinet).
const GRILL_MODEL_SINK = 7.5;
const GRILL_MODEL_BACK = -3;
const GRILL_MODEL_YAW = 0;

/** Door/drawer front build-out. Like the real construction, a cabinet's
 *  nominal depth INCLUDES the front: a 24″-deep cabinet has a 23″ box and the
 *  door face makes up the last inch, ending flush at the nominal depth. */
export const FRONT_T = 1;

export const STEEL_3D = 0xc9ced2;

export function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Subtle vertical wood grain for stained indoor finishes. Cached per finish
 *  (shared by every material/scene) so it's never disposed out from under a
 *  cached sprite material set. */
const woodTexCache = new Map<string, THREE.CanvasTexture>();
function woodTexture(id: string, base: string): THREE.CanvasTexture {
  let t = woodTexCache.get(id);
  if (t) return t;
  t = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * s;
      const dark = Math.random() < 0.55;
      ctx.strokeStyle = dark ? 'rgba(50,30,12,0.06)' : 'rgba(255,240,215,0.05)';
      ctx.lineWidth = 0.6 + Math.random() * 2.2;
      ctx.beginPath();
      ctx.moveTo(x, -4);
      for (let y = 0; y <= s + 16; y += 16) ctx.lineTo(x + Math.sin((y / s) * Math.PI * 2 + i) * 3, y);
      ctx.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 30, 1 / 30); // ~30" per tile so grain reads at cabinet scale
  woodTexCache.set(id, t);
  return t;
}

/** Subtle procedural marble/quartz for countertops. */
export function marbleTexture(base: string): THREE.CanvasTexture {
  const t = canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const r = 20 + Math.random() * 60;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(120,122,128,${0.03 + Math.random() * 0.04})`);
      g.addColorStop(1, 'rgba(120,122,128,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 7; i++) {
      ctx.strokeStyle = `rgba(110,112,120,${0.10 + Math.random() * 0.12})`;
      ctx.lineWidth = 0.8 + Math.random() * 1.4;
      ctx.beginPath();
      let x = Math.random() * s;
      let y = 0;
      ctx.moveTo(x, y);
      while (y < s) {
        x += (Math.random() - 0.5) * 60;
        y += 25 + Math.random() * 45;
        ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 40, y - 25, x, y);
      }
      ctx.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Procedural countertop texture for a selected style (granite/quartzite/etc). */
export function countertopTexture(ct: Countertop): THREE.CanvasTexture {
  const t = canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = ct.base;
    ctx.fillRect(0, 0, s, s);
    const mottle = (light: boolean, n: number, max: number, a: number) => {
      const rgb = light ? '255,255,255' : '0,0,0';
      for (let i = 0; i < n; i++) {
        const x = Math.random() * s, y = Math.random() * s, r = 24 + Math.random() * max;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${rgb},${a * (0.4 + Math.random())})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    };
    if (ct.category === 'granite') {
      mottle(true, 40, 80, 0.04);
      const flecks = ct.flecks ?? ['#888888'];
      for (let i = 0; i < 6500; i++) {
        ctx.fillStyle = flecks[(Math.random() * flecks.length) | 0];
        ctx.globalAlpha = 0.45 + Math.random() * 0.55;
        const x = Math.random() * s, y = Math.random() * s, r = 0.4 + Math.random() * 1.9;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (ct.category === 'concrete') {
      mottle(false, 55, 130, 0.05);
      mottle(true, 45, 120, 0.04);
      for (let i = 0; i < 2600; i++) {
        ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
        ctx.fillRect(Math.random() * s, Math.random() * s, 1, 1);
      }
      for (let i = 0; i < 120; i++) {
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        const x = Math.random() * s, y = Math.random() * s, r = 0.5 + Math.random() * 1.2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (ct.category === 'metal') {
      // brushed stainless: fine horizontal grain lines
      for (let i = 0; i < 900; i++) {
        ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        ctx.lineWidth = 0.5 + Math.random();
        const y = Math.random() * s;
        const x = Math.random() * s;
        const len = 30 + Math.random() * 180;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y);
        ctx.stroke();
      }
    } else {
      // solid + quartzite: soft mottle and flowing veins
      mottle(true, 45, 70, 0.035);
      const vein = ct.vein ?? '#b0b0b0';
      const nv = ct.category === 'quartzite' ? 9 : 6;
      for (let i = 0; i < nv; i++) {
        ctx.strokeStyle = vein;
        ctx.globalAlpha = 0.12 + Math.random() * 0.18;
        ctx.lineWidth = 0.6 + Math.random() * 1.8;
        ctx.beginPath();
        let x = Math.random() * s;
        let y = 0;
        ctx.moveTo(x, y);
        while (y < s) {
          x += (Math.random() - 0.5) * 70;
          y += 22 + Math.random() * 45;
          ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 45, y - 22, x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export interface CabMats {
  body: THREE.Material;
  panel: THREE.Material;
  inner: THREE.Material;
  groove: THREE.Material;
  kick: THREE.Material;
  counter: THREE.MeshPhysicalMaterial;
  counterTex: THREE.CanvasTexture;
  steel: THREE.Material;
  /** Matte brushed-steel for appliance filler panels (won't blow out white). */
  steelMatte: THREE.Material;
  dark: THREE.Material;
  egg: THREE.Material;
  carcass: THREE.Material;
  /** NewAge door construction (louvered slats / tempered glass); unset = slab. */
  naDoor?: 'flat' | 'louvered' | 'glass';
  /** Tinted tempered-glass pane material (NewAge aluminum doors). */
  glassPane?: THREE.Material;
  /** True for NewAge finishes — draws their long stainless bar pulls. */
  naBar?: boolean;
}

export function createMats(fin: FinishOption, ct: Countertop = countertopById(DEFAULT_COUNTERTOP)): CabMats {
  const counterTex = countertopTexture(ct);
  const counter =
    ct.category === 'metal'
      ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: counterTex, metalness: 0.85, roughness: 0.32 })
      : ct.matte
        ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: counterTex, roughness: 0.85, metalness: 0 })
        : new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: counterTex, roughness: 0.22, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  // Metallic finishes (NewAge stainless / aluminum) render with metalness so
  // the boxes read as brushed metal rather than painted HDPE.
  const metal = fin.metal ? { metalness: fin.metal === 'stainless' ? 0.85 : 0.65, roughness: fin.metal === 'stainless' ? 0.32 : 0.45 } : null;
  // Wood-stained indoor finishes: satin lacquer over a subtle grain texture.
  const grain = fin.wood ? woodTexture(fin.id, fin.body) : null;
  // NewAge door faces: louvered slats are wood-look (Grove) or painted (White)
  // — not bare metal; glass doors get a tinted pane inside the metal frame.
  const louvered = fin.naDoor === 'louvered';
  return {
    body: grain
      ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: grain, roughness: 0.52, clearcoat: 0.25, clearcoatRoughness: 0.4 })
      : metal
        ? new THREE.MeshPhysicalMaterial({ color: new THREE.Color(fin.body), ...metal })
        : new THREE.MeshPhysicalMaterial({ color: new THREE.Color(fin.body), roughness: 0.55, clearcoat: 0.18, clearcoatRoughness: 0.6 }),
    panel: grain
      ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: grain, roughness: 0.5, clearcoat: 0.28, clearcoatRoughness: 0.38 })
      : louvered
        ? new THREE.MeshPhysicalMaterial({ color: new THREE.Color(fin.panel), roughness: 0.58, metalness: 0.08, clearcoat: 0.1, clearcoatRoughness: 0.6 })
        : metal
          ? new THREE.MeshPhysicalMaterial({ color: new THREE.Color(fin.panel), ...metal })
          : new THREE.MeshPhysicalMaterial({ color: new THREE.Color(fin.panel), roughness: 0.5, clearcoat: 0.22, clearcoatRoughness: 0.55 }),
    inner: grain
      ? new THREE.MeshPhysicalMaterial({ color: 0xd6d2cc, map: grain, roughness: 0.58, clearcoat: 0.15, clearcoatRoughness: 0.5 })
      : louvered
        ? new THREE.MeshPhysicalMaterial({ color: new THREE.Color(fin.inner), roughness: 0.7, metalness: 0.05 })
        : metal
          ? new THREE.MeshPhysicalMaterial({ color: new THREE.Color(fin.inner), ...metal })
          : new THREE.MeshPhysicalMaterial({ color: new THREE.Color(fin.inner), roughness: 0.6, clearcoat: 0.15, clearcoatRoughness: 0.6 }),
    groove: new THREE.MeshStandardMaterial({ color: new THREE.Color(fin.inner).multiplyScalar(0.72), roughness: 0.85 }),
    kick: new THREE.MeshStandardMaterial({ color: new THREE.Color(fin.kick ?? fin.body), roughness: 0.75, metalness: fin.kick ? 0.35 : metal ? metal.metalness : 0 }),
    naDoor: fin.naDoor,
    naBar: !!fin.line,
    glassPane:
      fin.naDoor === 'glass'
        ? new THREE.MeshPhysicalMaterial({ color: new THREE.Color(fin.panel), metalness: 0.1, roughness: 0.12, clearcoat: 0.8, clearcoatRoughness: 0.15, transparent: true, opacity: 0.88 })
        : undefined,
    counterTex,
    counter,
    steel: new THREE.MeshStandardMaterial({ color: STEEL_3D, metalness: 0.9, roughness: 0.28 }),
    steelMatte: new THREE.MeshStandardMaterial({ color: 0x9a9ea3, metalness: 0.45, roughness: 0.5 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.6 }),
    egg: new THREE.MeshPhysicalMaterial({ color: 0x1f3a2e, roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    // NewAge metal units are factory-finished on every face — their "carcass"
    // is the same brushed metal as the body, not raw white HDPE board.
    carcass: metal
      ? new THREE.MeshPhysicalMaterial({ color: new THREE.Color(fin.body), ...metal })
      : new THREE.MeshPhysicalMaterial({ color: 0xeceef0, roughness: 0.55, clearcoat: 0.12, clearcoatRoughness: 0.6 }),
  };
}

export function disposeMats(m: CabMats): void {
  for (const mat of [m.body, m.panel, m.inner, m.groove, m.kick, m.counter, m.steel, m.steelMatte, m.dark, m.egg, m.carcass]) mat.dispose();
  m.glassPane?.dispose();
  m.counterTex.dispose();
}

export interface CabDims {
  w: number;
  d: number;
  h: number;
  hinge: HingeSide;
  style: DoorStyle;
  endL: boolean;
  endR: boolean;
  /** Finished applied panel(s) on the back (islands) — auto, split at ≤48". */
  backPanel?: boolean;
  /** Corner/susan footprint orientation, derived from placement so it stays
   *  fixed in its corner; when set, `hinge` is free to pick the handle side. */
  cornerSide?: 1 | -1;
  /** Selected appliance's overall height (inches) for fridge/ice-maker
   *  housings. When shorter than the cabinet, the unit renders to this height
   *  and leaves a visible gap under the counter. Defaults to the cabinet height. */
  applianceH?: number;
  /** Finished end — side built in finished material (no added width). */
  finL?: boolean;
  finR?: boolean;
  /** Countertop slab thickness (inches). Defaults to COUNTER_T. */
  counterT?: number;
  /** Brand-accurate 3D model for the selected grill/griddle appliance (key
   *  into three/models APPLIANCE_MODEL_URLS) + its real overall width. Lazy-
   *  loaded on first use; the generic head renders until it arrives. */
  modelKey?: string;
  modelW?: number;
  /** Admin aligner override for this model — applied on top of auto-seating. */
  modelAlign?: ModelAlign;
}

/** Apply an admin aligner override (rotation nudge, position offset, scale) to
 *  a placed appliance model, on top of its automatic seating. */
function applyModelAlign(model: THREE.Object3D, a?: ModelAlign): void {
  if (!a) return;
  const rad = (deg?: number) => ((deg ?? 0) * Math.PI) / 180;
  model.rotation.x += rad(a.pitch);
  model.rotation.y += rad(a.yaw);
  model.rotation.z += rad(a.roll);
  model.position.x += a.dx ?? 0;
  model.position.y += a.dy ?? 0;
  model.position.z += a.dz ?? 0;
  if (a.scale && a.scale > 0 && a.scale !== 1) model.scale.multiplyScalar(a.scale);
}

/** Max width of one applied panel; wider runs are split into multiple panels. */
export const MAX_PANEL_W = 48;

/** Reveal per cabinet side — adjacent cabinets read with the same 1/8″ gap as a door pair. */
const REVEAL = 0.0625;
const GAP = 0.125; // between doors / drawer fronts

/** Applied end panel thickness — adds to the cabinet's overall width. */
export const END_PANEL_T = 0.75;

/** Cabinet panel stile wrapping each side of a set-in grill/griddle face. */
const GRILL_STILE = 2;

/** Width of the recessed appliance face inside its picture frame. */
function applianceFaceW(w: number): number {
  return w - REVEAL * 2 - (GRILL_STILE + GAP) * 2;
}

/** Built-in appliances render at a realistic, fixed width so they don't stretch
 *  when the housing cabinet is widened — the cabinet's framing stiles widen
 *  instead. Capped to these per-type maxima; still shrinks to fit a narrow
 *  cabinet. (Undefined types fill the whole face, e.g. side/power burners.) */
const APPLIANCE_MAX_W: Record<string, number> = { grill: 30, grill4: 44, griddle: 30, griddle4: 36 };
/** The real grill model's true width (a 32″ Broilmaster head). Like a real
 *  grill it NEVER stretches — widening the cabinet only widens the framing. */
export const GRILL_MODEL_REAL_W = 32;
function applianceOpeningW(front: string, w: number, modelW?: number): number {
  const faceW = applianceFaceW(w);
  const max =
    modelW != null
      ? modelW + 1 // brand-accurate head + clearance
      : (front === 'grill' || front === 'grill4') && hasModel('grill')
        ? GRILL_MODEL_REAL_W + 1 // fixed-size head + clearance
        : APPLIANCE_MAX_W[front];
  return max ? Math.min(faceW, max) : faceW;
}

/** Roll-top grill hood: rounded side profile extruded across the width. */
function grillHood(gw: number, dh: number, hh: number, mat: THREE.Material): THREE.Mesh {
  const s = new THREE.Shape();
  // side profile: x = depth from the front face, y = up
  s.moveTo(0, 0);
  s.lineTo(0, hh * 0.35);
  s.quadraticCurveTo(0, hh, dh * 0.42, hh);
  s.lineTo(dh - 2, hh);
  s.quadraticCurveTo(dh, hh, dh, hh - 2);
  s.lineTo(dh, 0);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: gw, bevelEnabled: false, curveSegments: 10 });
  // extrusion z → width (x), profile x → depth (−z, so the front sits at z=0)
  geo.rotateY(Math.PI / 2);
  geo.translate(-gw / 2, 0, 0);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Routed groove ring (HDPE shaker look): four dark strips sitting just proud
 * of a face that spans w×h in the local XY plane, face at z=+faceZ.
 */
function grooveRing(w: number, h: number, faceZ: number, mats: CabMats): THREE.Group {
  const g = new THREE.Group();
  const R = 2.4; // groove centerline inset from the door edge
  const sw = 0.42; // groove width
  const t = 0.05;
  const z = faceZ + t / 2 - 0.01;
  const horiz = new THREE.BoxGeometry(w - 2 * R + sw, sw, t);
  const vert = new THREE.BoxGeometry(sw, h - 2 * R + sw, t);
  const top = new THREE.Mesh(horiz, mats.groove);
  top.position.set(0, h / 2 - R, z);
  const bot = new THREE.Mesh(horiz, mats.groove);
  bot.position.set(0, -h / 2 + R, z);
  const left = new THREE.Mesh(vert, mats.groove);
  left.position.set(-w / 2 + R, 0, z);
  const right = new THREE.Mesh(vert, mats.groove);
  right.position.set(w / 2 - R, 0, z);
  g.add(top, bot, left, right);
  return g;
}

/** Corner cabinets keep a 24" return (base) on each side so adjacent cabinets line up flush. */
export const CORNER_RETURN = 24;
/** Return depth for a corner cabinet — matches adjacent cabinet depth on its lane
 *  (base = 24", wall = 12"), so its legs line up with the neighbouring cabinets. */
export function cornerReturn(cat: CatalogItem): number {
  return cat.lane === 'upper' ? 12 : CORNER_RETURN;
}
/** Depth of the 45° chamfer leg given the cabinet depth and its return. */
export function cornerChamfer(d: number, ret: number = CORNER_RETURN): number {
  return Math.max(6, d - ret);
}

/**
 * Chamfered (pentagon-footprint) carcass for a diagonal corner cabinet: a box
 * with the front-room corner cut at 45°. Built from a footprint shape in
 * (x = width, y = depth) extruded to the cabinet height. Returns a mesh whose
 * bottom sits at y=0, depth at z∈[0,d], width at x∈[−w/2, w/2].
 */
function cornerCarcass(w: number, d: number, h: number, c: number, mat: THREE.Material, side: 1 | -1): THREE.Mesh {
  const s = new THREE.Shape();
  if (side === 1) {
    // chamfer the front-right corner (room corner when wall corner is at the left end)
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, d - c);
    s.lineTo(w / 2 - c, d);
    s.lineTo(-w / 2, d);
  } else {
    // chamfer the front-left corner
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, d);
    s.lineTo(-w / 2 + c, d);
    s.lineTo(-w / 2, d - c);
  }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
  geo.rotateX(Math.PI / 2); // shape Y (depth) → +z, extrude → −y
  const m = new THREE.Mesh(geo, mat);
  m.position.y = h; // lift so the bottom sits on the floor
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * L-shaped (pie-cut) lazy-susan carcass: two 24"-deep legs along the walls with
 * a square notch cut from the front-room inner corner. side 1 = corner at the
 * left end, −1 = corner at the right end.
 */
function susanCarcass(w: number, d: number, h: number, legD: number, mat: THREE.Material, side: 1 | -1): THREE.Mesh {
  const s = new THREE.Shape();
  if (side === 1) {
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, legD);
    s.lineTo(-w / 2 + legD, legD);
    s.lineTo(-w / 2 + legD, d);
    s.lineTo(-w / 2, d);
  } else {
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, d);
    s.lineTo(w / 2 - legD, d);
    s.lineTo(w / 2 - legD, legD);
    s.lineTo(-w / 2, legD);
  }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = h;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const KICK_RECESS = 1; // toe-kick inset from the room-facing faces (matches standard cabinets)

/**
 * Face layout (face coords: 0 = face centre, +y up) for the built-in appliance
 * tall cabinets. `applianceoven` = bottom drawer, oven/microwave opening, top
 * doors; `fridgetall` = top doors over a refrigerator opening. `fh` is the face
 * height (carcassH − reveals). Heights are clamped to fractions so the layout
 * still reads on shorter cabinets.
 */
function applianceTallLayout(
  front: 'applianceoven' | 'fridgetall',
  fh: number
): { drawer: { dy: number; h: number } | null; opening: { dy: number; h: number }; doors: { dy: number; h: number } } {
  if (front === 'applianceoven') {
    const drawerH = Math.min(11, fh * 0.16);
    const openingH = Math.min(30, fh * 0.42);
    const doorsH = Math.max(8, fh - drawerH - openingH - GAP * 2);
    return {
      drawer: { dy: -fh / 2 + drawerH / 2, h: drawerH },
      opening: { dy: -fh / 2 + drawerH + GAP + openingH / 2, h: openingH },
      doors: { dy: fh / 2 - doorsH / 2, h: doorsH },
    };
  }
  // fridgetall: a shallow upper cabinet (2 doors) over the fridge opening
  const doorsH = Math.min(16, fh * 0.22);
  const openingH = Math.max(8, fh - doorsH - GAP);
  return {
    drawer: null,
    opening: { dy: -fh / 2 + openingH / 2, h: openingH },
    doors: { dy: fh / 2 - doorsH / 2, h: doorsH },
  };
}

/** Recessed toe-kick block under a diagonal corner cabinet; sits at y∈[0, kick]. */
function cornerKick(w: number, d: number, kick: number, c: number, mat: THREE.Material, side: 1 | -1): THREE.Mesh {
  const R = KICK_RECESS;
  const s = new THREE.Shape();
  if (side === 1) {
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, d - c);
    s.lineTo(w / 2 - c + R, d - R);
    s.lineTo(-w / 2, d - R);
  } else {
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, d - R);
    s.lineTo(-w / 2 + c - R, d - R);
    s.lineTo(-w / 2, d - c);
  }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: kick, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = kick;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Recessed L-shaped toe-kick block under a lazy-susan cabinet; sits at y∈[0, kick]. */
function susanKick(w: number, d: number, kick: number, legD: number, mat: THREE.Material, side: 1 | -1): THREE.Mesh {
  const R = KICK_RECESS;
  const s = new THREE.Shape();
  if (side === 1) {
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, legD - R);
    s.lineTo(-w / 2 + legD - R, legD - R);
    s.lineTo(-w / 2 + legD - R, d - R);
    s.lineTo(-w / 2, d - R);
  } else {
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, d - R);
    s.lineTo(w / 2 - legD + R, d - R);
    s.lineTo(w / 2 - legD + R, legD - R);
    s.lineTo(-w / 2, legD - R);
  }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: kick, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = kick;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Door/drawer face. HDPE: flat slab, optionally with a shaker groove ring.
 *  NewAge louvered: horizontal slat door (Grove wood-look / painted white).
 *  NewAge glass: tinted tempered-glass pane in a body-metal frame. */
function doorFace(w: number, h: number, style: DoorStyle, mats: CabMats): THREE.Group {
  const g = new THREE.Group();
  // Louvered slat door — matches NewAge's Louvered series: angled horizontal
  // slats over a dark backing, in a slim frame of the same finish.
  if (mats.naDoor === 'louvered' && h >= 5.5 && w >= 8) {
    const FR = 1.1; // frame width
    g.add(box(w, h, 0.4, mats.inner)); // dark backing the slats sit over
    // frame: stiles + rails in the door finish
    g.add(boxAt(w, FR, 0.7, 0, h / 2 - FR / 2, 0.1, mats.panel));
    g.add(boxAt(w, FR, 0.7, 0, -h / 2 + FR / 2, 0.1, mats.panel));
    g.add(boxAt(FR, h - FR * 2, 0.7, -w / 2 + FR / 2, 0, 0.1, mats.panel));
    g.add(boxAt(FR, h - FR * 2, 0.7, w / 2 - FR / 2, 0, 0.1, mats.panel));
    // angled slats
    const innerH = h - FR * 2 - 0.6;
    const pitch = 2.1;
    const n = Math.max(3, Math.floor(innerH / pitch));
    const slatH = pitch * 1.25; // overlap so no gaps read through
    for (let i = 0; i < n; i++) {
      const y = -innerH / 2 + pitch * (i + 0.5);
      const slat = box(w - FR * 2 - 0.3, slatH, 0.35, mats.panel);
      slat.rotation.x = -0.42; // louver angle (top leans out)
      slat.position.set(0, y, 0.18);
      g.add(slat);
    }
    return g;
  }
  // Tempered-glass door — NewAge Aluminum series: metal frame + tinted pane.
  if (mats.naDoor === 'glass' && mats.glassPane && h >= 5.5 && w >= 8) {
    const FR = 1.6; // aluminum frame width
    g.add(boxAt(w, FR, 0.7, 0, h / 2 - FR / 2, 0, mats.body));
    g.add(boxAt(w, FR, 0.7, 0, -h / 2 + FR / 2, 0, mats.body));
    g.add(boxAt(FR, h - FR * 2, 0.7, -w / 2 + FR / 2, 0, 0, mats.body));
    g.add(boxAt(FR, h - FR * 2, 0.7, w / 2 - FR / 2, 0, 0, mats.body));
    const pane = box(w - FR * 2 + 0.2, h - FR * 2 + 0.2, 0.35, mats.glassPane);
    pane.position.z = -0.05;
    g.add(pane);
    return g;
  }
  // Indoor 5-piece doors: rail/stile frame around a center panel. Small fronts
  // (narrow drawers etc.) fall through to a plain slab, like real cabinetry.
  const FRAME_W: Partial<Record<DoorStyle, number>> = { 'shaker-inset': 2.25, 'shaker-skinny': 1.1, raised: 2.4, beadboard: 2.25 };
  const FR = FRAME_W[style];
  if (FR && w >= FR * 2 + 4 && h >= FR * 2 + 4) {
    // recessed center panel (raised-panel centers stay in the face color)
    const backing = box(w - 0.2, h - 0.2, 0.4, style === 'raised' ? mats.panel : mats.inner);
    backing.position.z = -0.1;
    g.add(backing);
    // frame: rails (top/bottom) + stiles (sides)
    g.add(boxAt(w, FR, 0.7, 0, h / 2 - FR / 2, 0, mats.panel));
    g.add(boxAt(w, FR, 0.7, 0, -h / 2 + FR / 2, 0, mats.panel));
    g.add(boxAt(FR, h - FR * 2, 0.7, -w / 2 + FR / 2, 0, 0, mats.panel));
    g.add(boxAt(FR, h - FR * 2, 0.7, w / 2 - FR / 2, 0, 0, mats.panel));
    if (style === 'raised') {
      // stepped center pillow — reads as the raised profile
      const pw = w - FR * 2 - 1.2;
      const ph = h - FR * 2 - 1.2;
      g.add(boxAt(pw, ph, 0.56, 0, 0, -0.02, mats.panel));
      g.add(boxAt(Math.max(1, pw - 2.2), Math.max(1, ph - 2.2), 0.68, 0, 0, 0, mats.panel));
    }
    if (style === 'beadboard') {
      // vertical bead grooves across the recessed center
      const innerW = w - FR * 2;
      const n = Math.max(2, Math.round(innerW / 1.9));
      for (let i = 1; i < n; i++) {
        g.add(boxAt(0.14, h - FR * 2, 0.32, -innerW / 2 + (innerW * i) / n, 0, 0, mats.groove));
      }
    }
    return g;
  }
  g.add(box(w, h, 0.7, mats.panel));
  if (style === 'shaker' && w >= 8 && h >= 8) {
    g.add(grooveRing(w, h, 0.35, mats));
  }
  return g;
}

/** box() positioned in one call. */
function boxAt(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material): THREE.Mesh {
  const m = box(w, h, d, mat);
  m.position.set(x, y, z);
  return m;
}

/** Fronts that carry a dropped-in sink basin + faucet. */
export function isSinkFront(front: CatalogItem['front']): boolean {
  return front === 'sink' || front === 'sink2' || front === 'sink1' || front === 'sink1f';
}

/** Basin opening (in cabinet-local inches): width, depth, center-from-wall, bowl depth.
 *  Shared by the 3D cabinet (the bowl) and the counter (the cut-out hole). */
export function sinkBasin(w: number, d: number): { bw: number; bd: number; zc: number; bowlH: number } {
  const bw = Math.max(10, Math.min(w - 7, 26));
  const bd = Math.max(8, Math.min(d - 9, 16));
  return { bw, bd, zc: d * 0.52, bowlH: 6.5 };
}

/** Counter cut-out (cabinet-local inches) for a drop-in grill/griddle: width,
 *  depth, center-from-wall — so the appliance drops through the countertop and
 *  the counter frames it. Returns null for non-grill fronts. */
export function grillCutout(cat: CatalogItem, w: number, d: number, modelW?: number): { bw: number; bd: number; zc: number } | null {
  if (cat.front === 'kamadoinsert') {
    // Open top compartment: the counter runs across the cabinet covering the
    // front stretcher and side rails; the kamado pokes through this cut-out.
    const bw = w - 2.5; // side rails
    const z1 = 1; // strip over the back panel
    const z2 = d - 3; // front stretcher stays covered
    return { bw, bd: z2 - z1, zc: (z1 + z2) / 2 };
  }
  if (cat.front !== 'grill' && cat.front !== 'grill4' && cat.front !== 'griddle' && cat.front !== 'griddle4' && cat.front !== 'burner') return null;
  const bw = applianceOpeningW(cat.front, w, modelW) + 1; // small gap around the unit
  // Grills, griddles and side/power burners all drop in with an insulated
  // liner jacket whose face hangs over the counter nose — the cut-out runs
  // through the counter's front edge (a notch, not a hole).
  const z1 = 2.5; // stone strip left behind the unit
  const z2 = d + 6; // safely past any run's front overhang
  return { bw, bd: z2 - z1, zc: (z1 + z2) / 2 };
}

/** Vertical extent of gear drawn above the carcass (for sprite bounding boxes). */
export function gearAbove(cat: CatalogItem): number {
  if (cat.topGearH) return cat.topGearH + (cat.counter ? COUNTER_T : 0);
  if (isSinkFront(cat.front)) return COUNTER_T + 12;
  return 0;
}

/**
 * Builds a single cabinet/appliance as a Group in local coordinates:
 * x centered on the cabinet width, y up from the floor (0), z from the wall
 * face (0) out the front (d). Counter slabs are NOT included — they are
 * drawn per run by the caller.
 */
export function buildCabinetLocal(cat: CatalogItem, dims: CabDims, mats: CabMats): THREE.Group {
  const g = new THREE.Group();
  const { w, d, h, hinge, style, endL, endR, finL, finR, backPanel } = dims;
  const isAppliance = cat.category === 'appliance';
  const isFridge = cat.front === 'fridge' || cat.front === 'fridge2' || cat.front === 'fridgep' || cat.front === 'fridgep2';
  const fridgeDrawers = cat.front === 'fridge2' || cat.front === 'fridgep2';
  const fridgePanel = cat.front === 'fridgep' || cat.front === 'fridgep2'; // cabinet-matched fronts
  const steelFridge = isFridge && !fridgePanel; // stainless fridge
  const isIcemaker = cat.front === 'icemaker';
  const steel = isAppliance || steelFridge || isIcemaker;
  const kick = cat.lane === 'floor' && !isAppliance ? TOEKICK_H : 0;
  const carcassH = h - kick;
  // Fridge/ice-maker housings render the unit at the selected appliance's
  // height; the space up to the counter (h) reads as a visible gap.
  const isApplianceHousing = cat.applianceCat === 'fridge' || cat.applianceCat === 'icemaker';
  const unitTotalH = isApplianceHousing && dims.applianceH && dims.applianceH > 0 ? Math.min(dims.applianceH, h) : h;
  const bodyH = Math.max(6, unitTotalH - kick); // carcass/front height above the kick

  const isCorner = cat.front === 'corner';
  const isSusan = cat.front === 'susan';
  const isOpen = cat.front === 'open'; // open shelving — no door, exposed shelves
  const isKamadoInsert = cat.front === 'kamadoinsert'; // doors + open 12" top compartment
  const KAMADO_OPEN_H = 12;
  // chamfer faces the room: side 1 (corner at left end) vs −1 (corner at right end).
  // Prefer the placement-derived side so the carcass stays put in its corner and
  // the hinge toggle only moves the (single) handle.
  const cornerSide: 1 | -1 = dims.cornerSide ?? (hinge === 'right' ? -1 : 1);
  const legRet = cornerReturn(cat); // 24" base / 12" wall
  if (isCorner && mats.naBar) {
    // NewAge 90° corner: an OPEN pentagon frame (chamfered front corner) —
    // corner posts, base + mid shelf, integrated stainless top, panels only
    // on the two wall sides. Matches the real product (open shelving).
    const c = cornerChamfer(d, legRet);
    const pent = (inset: number): THREE.Shape => {
      const s = new THREE.Shape();
      if (cornerSide === 1) {
        s.moveTo(-w / 2 + inset, inset);
        s.lineTo(w / 2 - inset, inset);
        s.lineTo(w / 2 - inset, d - c);
        s.lineTo(w / 2 - c, d - inset);
        s.lineTo(-w / 2 + inset, d - inset);
      } else {
        s.moveTo(-w / 2 + inset, inset);
        s.lineTo(w / 2 - inset, inset);
        s.lineTo(w / 2 - inset, d - inset);
        s.lineTo(-w / 2 + c, d - inset);
        s.lineTo(-w / 2 + inset, d - c);
      }
      s.closePath();
      return s;
    };
    const slab = (inset: number, thick: number, mat: THREE.Material, y: number) => {
      const geo = new THREE.ExtrudeGeometry(pent(inset), { depth: thick, bevelEnabled: false });
      geo.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(geo, mat);
      m.position.y = y + thick;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    };
    slab(0.4, 0.9, mats.body, kick); // base deck
    slab(1.2, 0.7, mats.body, kick + carcassH * 0.48); // mid shelf
    slab(0, 1.1, mats.steelMatte, kick + carcassH - 1.1); // integrated stainless top
    // corner posts (skip the inner wall corner)
    const post = (px: number, pz: number) => {
      const p = box(1.4, carcassH, 1.4, mats.body);
      p.position.set(px, kick + carcassH / 2, pz);
      p.castShadow = true;
      g.add(p);
    };
    if (cornerSide === 1) {
      post(w / 2 - 0.7, 0.7);
      post(w / 2 - 0.7, d - c + 0.4);
      post(w / 2 - c + 0.4, d - 0.7);
      post(-w / 2 + 0.7, d - 0.7);
    } else {
      post(-w / 2 + 0.7, 0.7);
      post(-w / 2 + 0.7, d - c + 0.4);
      post(-w / 2 + c - 0.4, d - 0.7);
      post(w / 2 - 0.7, d - 0.7);
    }
    // panels on the two wall-facing sides
    const backPanel = box(w, carcassH, 0.6, mats.body);
    backPanel.position.set(0, kick + carcassH / 2, 0.3);
    g.add(backPanel);
    const sidePanel = box(0.6, carcassH, d, mats.body);
    sidePanel.position.set(cornerSide === 1 ? -w / 2 + 0.3 : w / 2 - 0.3, kick + carcassH / 2, d / 2);
    g.add(sidePanel);
    if (kick > 0) g.add(cornerKick(w, d, kick, c, mats.kick, cornerSide));
  } else if (isCorner) {
    // chamfered (angled-front) carcass on a recessed toe kick. Sides are raw
    // (unfinished) carcass — like any cabinet, an end only gets a finished
    // colour/design when an applied end panel is added; otherwise a cabinet
    // butts against it. The angled FRONT is finished separately below.
    const c = cornerChamfer(d, legRet);
    const carc = cornerCarcass(w, d, carcassH, c, mats.carcass, cornerSide);
    carc.position.y += kick;
    g.add(carc);
    if (kick > 0) g.add(cornerKick(w, d, kick, c, mats.kick, cornerSide));
  } else if (isSusan) {
    // L-shaped pie-cut carcass (notched front corner) on a recessed toe kick.
    const carc = susanCarcass(w, d, carcassH, legRet, mats.carcass, cornerSide);
    carc.position.y += kick;
    g.add(carc);
    if (kick > 0) g.add(susanKick(w, d, kick, legRet, mats.kick, cornerSide));
  } else if (isOpen) {
    // open shelving — a finished shell (sides/top/bottom/back) with exposed
    // shelves and no door. Built in the cabinet's body finish.
    const T = 0.75;
    const yB = kick;
    const add = (bw: number, bh: number, bd: number, x: number, y: number, z: number, mat: THREE.Material = mats.body) => {
      const m = box(bw, bh, bd, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    };
    add(w, T, d, 0, yB + T / 2, d / 2); // bottom
    add(w, T, d, 0, yB + carcassH - T / 2, d / 2); // top
    add(T, carcassH, d, -w / 2 + T / 2, yB + carcassH / 2, d / 2); // left
    add(T, carcassH, d, w / 2 - T / 2, yB + carcassH / 2, d / 2); // right
    add(w, carcassH, T, 0, yB + carcassH / 2, T / 2, mats.inner); // interior back
    const nShelves = Math.max(1, Math.round(carcassH / 11) - 1);
    for (let i = 1; i <= nShelves; i++) {
      const sy = yB + (carcassH * i) / (nShelves + 1);
      add(w - T * 2, T, d - 1.5, 0, sy, d / 2); // shelf, set back slightly from the front
    }
    if (kick > 0) {
      const kickMesh = box(w + (endL ? END_PANEL_T : 0) + (endR ? END_PANEL_T : 0), kick, d - 1, mats.kick);
      kickMesh.position.set(((endR ? END_PANEL_T : 0) - (endL ? END_PANEL_T : 0)) / 2, kick / 2, d / 2 - 0.5);
      g.add(kickMesh);
    }
  } else if (isKamadoInsert) {
    // Built-in kamado: solid lower cabinet (doors) + an open top compartment
    // (shelf floor, back, two sides) with a flat top stretcher across the
    // front. The whole cabinet is in the selected finish color (the opening
    // exposes the interior, so no white melamine). No apron; open front & top.
    const T = 0.75;
    const openH = Math.min(KAMADO_OPEN_H, carcassH - 6);
    const lowerH = carcassH - openH;
    const yB = kick;
    const add = (bw: number, bh: number, bd: number, x: number, y: number, z: number, mat: THREE.Material = mats.body) => {
      const m = box(bw, bh, bd, mat);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    };
    add(w, lowerH, d - FRONT_T, 0, yB + lowerH / 2, (d - FRONT_T) / 2); // solid lower body (behind doors)
    const cy = yB + lowerH;
    add(w, T, d, 0, cy + T / 2, d / 2); // compartment floor / divider shelf
    add(w, openH, T, 0, cy + openH / 2, T / 2); // back of the opening
    add(T, openH, d, -w / 2 + T / 2, cy + openH / 2, d / 2); // left side
    add(T, openH, d, w / 2 - T / 2, cy + openH / 2, d / 2); // right side
    // flat top stretcher — a board lying flat across the top front
    const strD = 3.5;
    add(w, T, strD, 0, cy + openH - T / 2, d - strD / 2);
    if (kick > 0) {
      const kickMesh = box(w + (endL ? END_PANEL_T : 0) + (endR ? END_PANEL_T : 0), kick, d - 1, mats.kick);
      kickMesh.position.set(((endR ? END_PANEL_T : 0) - (endL ? END_PANEL_T : 0)) / 2, kick / 2, d / 2 - 0.5);
      g.add(kickMesh);
    }
  } else {
    // carcass — white box like the real product; colored fronts go on top.
    // The box stops FRONT_T short of the nominal depth: the door/drawer face
    // (added below) makes up the difference, like the real construction.
    // Steel appliances are the unit itself, so they keep the full depth.
    // Appliance housings only build up to the unit height (gap above).
    const ch2 = isApplianceHousing ? bodyH : carcassH;
    const boxD = steel ? d : Math.max(2, d - FRONT_T);
    const carcass = box(w, ch2, boxD, steel ? mats.steel : mats.carcass);
    carcass.position.set(0, kick + ch2 / 2, boxD / 2);
    g.add(carcass);
    if (kick > 0) {
      // Full cabinet width and finish-matched: kicks are applied as long strips,
      // so adjacent cabinets read as one seamless band.
      const kickD = Math.max(1, boxD - 1);
      const kickMesh = box(w + (endL ? END_PANEL_T : 0) + (endR ? END_PANEL_T : 0), kick, kickD, steel ? mats.steel : mats.kick);
      kickMesh.position.set(((endR ? END_PANEL_T : 0) - (endL ? END_PANEL_T : 0)) / 2, kick / 2, kickD / 2);
      g.add(kickMesh);
    }
  }

  // front faces — one-piece HDPE doors (grooved shaker or euro flat) + steel handle
  if (!steel && !isAppliance) {
    type Front = { dx: number; dy: number; w: number; h: number; handle: 'v-left' | 'v-right' | 'h-center' | 'none'; slab?: boolean; handleLow?: boolean; handleTop?: boolean; handleBottom?: boolean };
    const fronts: Front[] = [];
    const fw = w - REVEAL * 2;
    const fh = carcassH - REVEAL * 2;
    const half = (fw - GAP) / 2;
    const oneDoorHandle: 'v-left' | 'v-right' = hinge === 'left' ? 'v-right' : 'v-left';
    switch (cat.front) {
      case 'door2':
      case 'kamado':
        if (w >= 24) {
          fronts.push({ dx: -half / 2 - GAP / 2, dy: 0, w: half, h: fh, handle: 'v-right' });
          fronts.push({ dx: half / 2 + GAP / 2, dy: 0, w: half, h: fh, handle: 'v-left' });
        } else fronts.push({ dx: 0, dy: 0, w: fw, h: fh, handle: oneDoorHandle });
        break;
      case 'fridgep':
        // panel-ready fridge: one cabinet-matched door
        fronts.push({ dx: 0, dy: 0, w: fw, h: fh, handle: oneDoorHandle });
        break;
      case 'fridgep2': {
        // panel-ready fridge: two cabinet-matched drawer fronts
        const rh = (fh - GAP) / 2;
        fronts.push({ dx: 0, dy: fh / 2 - rh / 2, w: fw, h: rh, handle: 'h-center' });
        fronts.push({ dx: 0, dy: -fh / 2 + rh / 2, w: fw, h: rh, handle: 'h-center' });
        break;
      }
      case 'open':
        break; // open shelving — no door, shell built above
      case 'corner':
      case 'susan':
        break; // corner cabinets built separately below
      case 'sink':
      case 'sink2':
      case 'sink1':
      case 'sink1f': {
        const twoDoor = (cat.front === 'sink' || cat.front === 'sink2') && w >= 24;
        const falseFront = cat.front === 'sink' || cat.front === 'sink1f';
        const top = falseFront ? fh * 0.2 : 0;
        if (falseFront) fronts.push({ dx: 0, dy: fh / 2 - top / 2, w: fw, h: top - GAP, handle: 'h-center' });
        const doorH = fh - (falseFront ? top + GAP : 0);
        const doorDy = falseFront ? -top / 2 - GAP / 2 : 0;
        if (twoDoor) {
          fronts.push({ dx: -half / 2 - GAP / 2, dy: doorDy, w: half, h: doorH, handle: 'v-right' });
          fronts.push({ dx: half / 2 + GAP / 2, dy: doorDy, w: half, h: doorH, handle: 'v-left' });
        } else {
          fronts.push({ dx: 0, dy: doorDy, w: fw, h: doorH, handle: oneDoorHandle });
        }
        break;
      }
      case 'kamadoinsert': {
        // Built-in kamado: just the lower doors. The open top compartment +
        // top stretcher are built as carcass parts (no apron, no face panel).
        const doorH = fh - KAMADO_OPEN_H - GAP;
        if (w >= 24) {
          fronts.push({ dx: -half / 2 - GAP / 2, dy: -fh / 2 + doorH / 2, w: half, h: doorH, handle: 'v-right' });
          fronts.push({ dx: half / 2 + GAP / 2, dy: -fh / 2 + doorH / 2, w: half, h: doorH, handle: 'v-left' });
        } else {
          fronts.push({ dx: 0, dy: -fh / 2 + doorH / 2, w: fw, h: doorH, handle: oneDoorHandle });
        }
        break;
      }
      case 'grill':
      case 'grill4':
      case 'griddle':
      case 'griddle4':
      case 'burner': {
        // The appliance face is recessed into the top of the cabinet. The
        // cabinet front picture-frames it: apron below, panel stiles wrapping
        // both sides, doors at the bottom.
        const isGrill = cat.front === 'grill' || cat.front === 'grill4';
        const isBurner = cat.front === 'burner';
        // With the real grill model its own control panel fills the opening —
        // a shorter opening avoids a bare band under the panel. Side/power
        // burners use the SAME face height as grills so door tops line up
        // across a run.
        const applH = isGrill || isBurner ? (hasModel('grill') || (dims.modelKey && hasModel(dims.modelKey)) ? 6 : 9) : 7;
        const apronH = 4.5;
        const doorH = fh - applH - apronH - GAP * 2;
        if (cat.front === 'grill4' || cat.front === 'griddle4') {
          // two double-door pairs: handles meet in the middle of each pair
          const n = 4;
          const dw = (fw - GAP * (n - 1)) / n;
          for (let i = 0; i < n; i++) {
            fronts.push({
              dx: -fw / 2 + dw / 2 + i * (dw + GAP),
              dy: -fh / 2 + doorH / 2,
              w: dw,
              h: doorH,
              handle: i % 2 === 0 ? 'v-right' : 'v-left',
            });
          }
        } else if (w >= 24) {
          fronts.push({ dx: -half / 2 - GAP / 2, dy: -fh / 2 + doorH / 2, w: half, h: doorH, handle: 'v-right' });
          fronts.push({ dx: half / 2 + GAP / 2, dy: -fh / 2 + doorH / 2, w: half, h: doorH, handle: 'v-left' });
        } else {
          fronts.push({ dx: 0, dy: -fh / 2 + doorH / 2, w: fw, h: doorH, handle: oneDoorHandle });
        }
        // apron band below the appliance — runs tight to the appliance band
        // above (no reveal there, so no carcass seam shows across the apron)
        fronts.push({ dx: 0, dy: -fh / 2 + doorH + GAP + (apronH + GAP) / 2, w: fw, h: apronH + GAP, handle: 'none', slab: true });
        // side stiles wrap the appliance face. They widen as the cabinet grows so
        // the appliance opening stays a fixed (realistic) width, not stretched.
        const stileY = fh / 2 - applH / 2;
        const openW = applianceOpeningW(cat.front, w, dims.modelW);
        const stileW = Math.max(GRILL_STILE, (fw - openW - GAP * 2) / 2);
        fronts.push({ dx: -fw / 2 + stileW / 2, dy: stileY, w: stileW, h: applH, handle: 'none', slab: true });
        fronts.push({ dx: fw / 2 - stileW / 2, dy: stileY, w: stileW, h: applH, handle: 'none', slab: true });
        break;
      }
      case 'blind':
      case 'blindl':
      case 'blindr': {
        const doorW = Math.max(12, w - 24) - GAP;
        const slabW = fw - doorW - GAP;
        // Which side the blind (dead) panel sits on. blindl/blindr fix it; the
        // legacy 'blind' derives it from hinge. The working door sits opposite.
        const blindOnLeft = cat.front === 'blindl' || (cat.front === 'blind' && hinge === 'right');
        const doorDx = blindOnLeft ? fw / 2 - doorW / 2 : -fw / 2 + doorW / 2;
        const slabDx = blindOnLeft ? -fw / 2 + slabW / 2 : fw / 2 - slabW / 2;
        // handle side on the working door — the rehinge (hinge) toggle moves it
        const blindHandle: 'v-left' | 'v-right' = hinge === 'left' ? 'v-left' : 'v-right';
        fronts.push({ dx: doorDx, dy: 0, w: doorW, h: fh, handle: blindHandle });
        fronts.push({ dx: slabDx, dy: 0, w: slabW, h: fh, handle: 'none', slab: true });
        break;
      }
      case 'drawers3': {
        const top = fh * 0.24;
        const rest = (fh - top) / 2;
        fronts.push({ dx: 0, dy: fh / 2 - top / 2, w: fw, h: top - GAP, handle: 'h-center' });
        fronts.push({ dx: 0, dy: fh / 2 - top - rest / 2, w: fw, h: rest - GAP, handle: 'h-center' });
        fronts.push({ dx: 0, dy: fh / 2 - top - rest - rest / 2, w: fw, h: rest - GAP, handle: 'h-center' });
        break;
      }
      case 'cooktop': {
        // false front up top (no pull — the cooktop sits above), doors below
        const top = fh * 0.2;
        fronts.push({ dx: 0, dy: fh / 2 - top / 2, w: fw, h: top - GAP, handle: 'none' });
        const doorH = fh - top - GAP;
        const doorDy = -top / 2 - GAP / 2;
        if (w >= 24) {
          fronts.push({ dx: -half / 2 - GAP / 2, dy: doorDy, w: half, h: doorH, handle: 'v-right' });
          fronts.push({ dx: half / 2 + GAP / 2, dy: doorDy, w: half, h: doorH, handle: 'v-left' });
        } else {
          fronts.push({ dx: 0, dy: doorDy, w: fw, h: doorH, handle: oneDoorHandle });
        }
        break;
      }
      case 'drawers4':
        for (let i = 0; i < 4; i++) {
          const rh = fh / 4;
          fronts.push({ dx: 0, dy: fh / 2 - rh * i - rh / 2, w: fw, h: rh - GAP, handle: 'h-center' });
        }
        break;
      case 'doordrawer': {
        const top = fh * 0.28;
        fronts.push({ dx: 0, dy: fh / 2 - top / 2, w: fw, h: top - GAP, handle: 'h-center' });
        fronts.push({ dx: 0, dy: -top / 2 - GAP / 2, w: fw, h: fh - top - GAP, handle: oneDoorHandle });
        break;
      }
      case 'door2drawer': {
        const top = fh * 0.2;
        const doorH = fh - top - GAP;
        const doorHalf = (fw - GAP) / 2;
        fronts.push({ dx: 0, dy: fh / 2 - top / 2, w: fw, h: top - GAP, handle: 'h-center' });
        fronts.push({ dx: -doorHalf / 2 - GAP / 2, dy: -top / 2 - GAP / 2, w: doorHalf, h: doorH, handle: 'v-right' });
        fronts.push({ dx: doorHalf / 2 + GAP / 2, dy: -top / 2 - GAP / 2, w: doorHalf, h: doorH, handle: 'v-left' });
        break;
      }
      case 'trashdrawer':
      case 'propanedrawer': {
        const top = fh * 0.2;
        fronts.push({ dx: 0, dy: fh / 2 - top / 2, w: fw, h: top - GAP, handle: 'h-center' });
        fronts.push({
          dx: 0,
          dy: -top / 2 - GAP / 2,
          w: fw,
          h: fh - top - GAP,
          handle: cat.front === 'trashdrawer' ? 'h-center' : oneDoorHandle,
          // trash pull-out: handle at the top of the section, not centered
          handleTop: cat.front === 'trashdrawer',
        });
        break;
      }
      case 'applianceoven': {
        // bottom drawer + top doors; the oven/microwave opening is built below.
        // Top doors sit high, so their handles go low (at the door bottom) for reach.
        const L = applianceTallLayout('applianceoven', fh);
        fronts.push({ dx: 0, dy: L.drawer!.dy, w: fw, h: L.drawer!.h, handle: 'h-center' });
        if (fw >= 24) {
          fronts.push({ dx: -half / 2 - GAP / 2, dy: L.doors.dy, w: half, h: L.doors.h, handle: 'v-right', handleLow: true });
          fronts.push({ dx: half / 2 + GAP / 2, dy: L.doors.dy, w: half, h: L.doors.h, handle: 'v-left', handleLow: true });
        } else {
          fronts.push({ dx: 0, dy: L.doors.dy, w: fw, h: L.doors.h, handle: oneDoorHandle, handleLow: true });
        }
        break;
      }
      case 'fridgetall': {
        // 2 doors at the top; the refrigerator opening is built below. The doors
        // sit high, so their handles go low (at the door bottom) for reach.
        const L = applianceTallLayout('fridgetall', fh);
        if (fw >= 24) {
          fronts.push({ dx: -half / 2 - GAP / 2, dy: L.doors.dy, w: half, h: L.doors.h, handle: 'v-right', handleLow: true });
          fronts.push({ dx: half / 2 + GAP / 2, dy: L.doors.dy, w: half, h: L.doors.h, handle: 'v-left', handleLow: true });
        } else {
          fronts.push({ dx: 0, dy: L.doors.dy, w: fw, h: L.doors.h, handle: oneDoorHandle, handleLow: true });
        }
        break;
      }
      case 'trash':
        // trash pull-out: handle at the top of the door, not centered
        fronts.push({ dx: 0, dy: 0, w: fw, h: fh, handle: 'h-center', handleTop: true });
        break;
      case 'flipup':
        // gas-assist flip-up door (NewAge wall cabinets): one full-width door
        // hinged at the top, horizontal pull centered at the bottom edge
        fronts.push({ dx: 0, dy: 0, w: fw, h: fh, handle: 'h-center', handleBottom: true });
        break;
      case 'endcap':
      case 'filler':
        // finished panel in the cabinet design, no door hardware
        fronts.push({ dx: 0, dy: 0, w: fw, h: fh, handle: 'none' });
        break;
      default:
        fronts.push({ dx: 0, dy: 0, w: fw, h: fh, handle: oneDoorHandle });
    }
    for (const fr of fronts) {
      const fg = doorFace(fr.w, fr.h, fr.slab ? 'flat' : style, mats);
      if (fr.handle !== 'none') {
        let isV = fr.handle !== 'h-center';
        // NewAge handle styles (per product photos): drawers & flip-up doors
        // take slim horizontal top/bottom-edge pulls; Classic (flat metal)
        // doors ALSO use horizontal pulls at the door's top corner, while
        // Louvered and Aluminum glass doors keep a vertical edge bar.
        const naTopPull = mats.naBar && isV && mats.naDoor === 'flat';
        if (naTopPull) isV = false;
        const len = mats.naBar
          ? isV
            ? Math.min(14, fr.h * 0.5)
            : naTopPull
              ? Math.min(8, fr.w * 0.45)
              : Math.min(12, fr.w * 0.5)
          : isV
            ? Math.min(7, fr.h * 0.45)
            : Math.min(9, fr.w * 0.5);
        const rad = mats.naBar ? 0.35 : 0.45;
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, len, 10), mats.steel);
        bar.castShadow = true;
        if (isV) {
          bar.position.x = fr.handle === 'v-left' ? -fr.w / 2 + 1.6 : fr.w / 2 - 1.6;
          // Base doors carry the pull near the TOP; wall (upper-lane) doors and
          // high-mounted doors (handleLow) near the BOTTOM — like real cabinets.
          const yTop = fr.h / 2 - len / 2 - 1.4;
          const yLow = -fr.h / 2 + len / 2 + 1.4;
          let yPos = fr.handleLow || cat.lane === 'upper' ? yLow : yTop;
          // Tall doors (pantry/broom…): cap the pull at a reachable height
          // (~44″ off the floor) instead of the very top of an 84″ door.
          const faceCenter = kick + carcassH / 2 + fr.dy;
          if (yPos === yTop && faceCenter + yTop > 48) yPos = Math.max(yLow, 44 - faceCenter);
          bar.position.y = yPos;
        } else {
          bar.rotation.z = Math.PI / 2;
          if (naTopPull) {
            // Classic door: horizontal pull at the top, toward the seam edge
            bar.position.x = fr.handle === 'v-left' ? -fr.w / 2 + len / 2 + 1.2 : fr.w / 2 - len / 2 - 1.2;
            bar.position.y = fr.h / 2 - 1.3;
          } else if (fr.handleBottom) {
            // flip-up door: pull centered on the bottom edge
            bar.position.y = -fr.h / 2 + 1.3;
          } else if (fr.handleTop || mats.naBar) {
            // trash pull-outs and all NewAge drawers: pull at the top edge
            bar.position.y = fr.h / 2 - 1.5;
          }
        }
        bar.position.z = 1.1;
        fg.add(bar);
      }
      // Door slab centered so its outer face ends flush at the nominal depth.
      fg.position.set(fr.dx, kick + carcassH / 2 + fr.dy, d - 0.35);
      g.add(fg);
    }

    // lazy-susan corner cabinet: door flush on the 45° chamfer face
    // (NewAge 90° corners are open frames — no door)
    if (cat.front === 'corner' && !mats.naBar) {
      const c = cornerChamfer(d, legRet);
      const span = c * Math.SQRT2 - GAP * 2; // door width along the diagonal
      const door = doorFace(span, fh, style, mats);
      door.rotation.y = cornerSide * (Math.PI / 4); // face the room corner
      const nrm = 0.4;
      // midpoint of the chamfer face, nudged outward along its (±x, +z) normal
      door.position.set(cornerSide * (w / 2 - c / 2) + cornerSide * nrm * 0.707, kick + carcassH / 2, d - c / 2 + nrm * 0.707);
      const len = mats.naBar ? Math.min(15, fh * 0.55) : Math.min(7, fh * 0.45);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, len, 10), mats.steel);
      bar.castShadow = true;
      // wall corner cabinets carry the pull at the door bottom
      const cy = cat.lane === 'upper' ? -fh / 2 + len / 2 + 1.4 : fh / 2 - len / 2 - 1.4;
      bar.position.set(cornerSide * (-span / 2 + 1.7), cy, 1.1);
      door.add(bar);
      g.add(door);
    }

    // L-shaped lazy susan: two doors meeting at the notch corner (bi-fold look)
    if (cat.front === 'susan') {
      const legD = legRet;
      const midH = kick + carcassH / 2;
      const len = Math.min(7, fh * 0.45);
      const addBar = (door: THREE.Object3D, localX: number) => {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, len, 10), mats.steel);
        bar.castShadow = true;
        // wall susans carry the pull at the door bottom
        const cy = cat.lane === 'upper' ? -fh / 2 + len / 2 + 1.4 : fh / 2 - len / 2 - 1.4;
        bar.position.set(localX, cy, 1.1);
        door.add(bar);
      };
      // A bi-fold susan has ONE pull on its lead door; the other door follows.
      // The handle sits opposite the hinge side (hinge left → handle on the
      // right-hand door), and always on that door's outer edge (away from notch).
      const handleOnLegA = hinge === 'right';
      // door 1 — leg-A inner front, faces +z
      const doorW1 = Math.max(8, w - legD);
      const d1 = doorFace(doorW1 - GAP, fh, style, mats);
      d1.position.set(cornerSide * (legD / 2), midH, legD + 0.4);
      if (handleOnLegA) addBar(d1, cornerSide * (doorW1 / 2 - 1.7));
      g.add(d1);
      // door 2 — notch inner face, faces ±x
      const doorW2 = Math.max(8, d - legD);
      const d2 = doorFace(doorW2 - GAP, fh, style, mats);
      d2.rotation.y = cornerSide * (Math.PI / 2);
      d2.position.set(cornerSide * (legD - w / 2) + cornerSide * 0.4, midH, (legD + d) / 2);
      if (!handleOnLegA) addBar(d2, cornerSide * (-doorW2 / 2 + 1.7));
      g.add(d2);
    }
  }

  // NewAge sink cabinets ship with an integrated stainless top (basin + faucet
  // included) — they take no countertop, so build the top into the unit.
  if (mats.naBar && isSinkFront(cat.front)) {
    const topT = 1.0;
    const slab = box(w + 0.3, topT, d + 0.5, mats.steelMatte);
    slab.position.set(0, h - topT / 2, d / 2 + 0.15);
    slab.castShadow = true;
    g.add(slab);
    const { bw, bd, zc } = sinkBasin(w, d);
    const basin = box(bw, 0.5, bd, mats.dark);
    basin.position.set(0, h - 0.2, zc);
    g.add(basin);
    // gooseneck faucet behind the basin
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 8.5, 10), mats.steel);
    post.position.set(0, h + 4.25, d * 0.18);
    post.castShadow = true;
    g.add(post);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 5, 10), mats.steel);
    spout.rotation.x = Math.PI / 2;
    spout.position.set(0, h + 8.3, d * 0.18 + 2.5);
    spout.castShadow = true;
    g.add(spout);
  }

  // applied end panels — finished door-style panel on exposed run ends
  if (!isAppliance) {
    const addPanel = (faceW: number, px: number, pz: number, rotY: number) => {
      const pg = new THREE.Group();
      pg.add(box(faceW, carcassH, END_PANEL_T, mats.panel));
      if (style === 'shaker' && carcassH >= 8 && faceW >= 8) {
        pg.add(grooveRing(faceW, carcassH, END_PANEL_T / 2, mats));
      }
      pg.rotation.y = rotY; // local +z (panel face) rotated to point outward
      pg.position.set(px, kick + carcassH / 2, pz);
      g.add(pg);
    };
    if (cat.front === 'susan') {
      // L-shape: each end caps the exposed TIP of a leg, not the full side (one
      // side is only the leg depth, the other sits against the wall).
      const legD = legRet;
      const legAtipLeft = cornerSide === -1; // own-wall leg tip is left vs right
      // own-wall leg tip — left/right end of the run, like a normal cabinet
      if (legAtipLeft ? endL : endR) {
        const sx = legAtipLeft ? -1 : 1;
        addPanel(legD, sx * (w / 2 + END_PANEL_T / 2), legD / 2, sx * (Math.PI / 2));
      }
      // perpendicular (deep) leg tip — faces forward along the adjoining wall
      if (legAtipLeft ? endR : endL) {
        const cx = cornerSide === -1 ? w / 2 - legD / 2 : -w / 2 + legD / 2;
        addPanel(legD, cx, d + END_PANEL_T / 2, 0);
      }
    } else if (cat.front === 'corner') {
      // A diagonal corner cabinet has TWO backs (against each wall), TWO exposed
      // "sides" and the angled door. The full deep side opposite the chamfer is
      // the back against the perpendicular wall — never panelled. The two
      // finishable sides are: the short exposed side beside the door, and the
      // straight front return. Each applied end finishes the side on its hand.
      const c = cornerChamfer(d, legRet);
      const chamferOnRight = cornerSide === 1;
      // Finished door-style panel over the straight front return (beside the door).
      const addFrontReturn = () => {
        const fw = w - c;
        const fpg = new THREE.Group();
        fpg.add(box(fw, carcassH, END_PANEL_T, mats.panel));
        if (style === 'shaker' && carcassH >= 8 && fw >= 8) fpg.add(grooveRing(fw, carcassH, END_PANEL_T / 2, mats));
        fpg.position.set(chamferOnRight ? -c / 2 : c / 2, kick + carcassH / 2, d);
        g.add(fpg);
      };
      if (chamferOnRight) {
        // chamfer on the right → right side is the short exposed side; the front
        // return sits on the left-front. (Left deep side is the wall-side back.)
        if (endR) addPanel(d - c, w / 2 + END_PANEL_T / 2, (d - c) / 2, Math.PI / 2);
        if (endL) addFrontReturn();
      } else {
        // chamfer on the left → left side is the short exposed side; the front
        // return sits on the right-front. (Right deep side is the wall-side back.)
        if (endL) addPanel(d - c, -(w / 2 + END_PANEL_T / 2), (d - c) / 2, -(Math.PI / 2));
        if (endR) addFrontReturn();
      }
    } else {
      for (const side of [-1, 1] as const) {
        if ((side === -1 && !endL) || (side === 1 && !endR)) continue;
        addPanel(d, side * (w / 2 + END_PANEL_T / 2), d / 2, side * (Math.PI / 2));
      }
      // Finished ends: the cabinet side itself in finished material — a flat
      // flush skin in the panel colour, adding no width to the footprint.
      for (const side of [-1, 1] as const) {
        if ((side === -1 && !finL) || (side === 1 && !finR)) continue;
        if ((side === -1 && endL) || (side === 1 && endR)) continue; // applied end covers it
        const skin = box(Math.max(2, d - FRONT_T), carcassH, 0.15, mats.panel);
        skin.rotation.y = side * (Math.PI / 2);
        skin.position.set(side * (w / 2 + 0.08), kick + carcassH / 2, (d - FRONT_T) / 2);
        g.add(skin);
      }
    }
  }

  // applied back panel(s) for islands — finished back, split into ≤48" panels
  if (!isAppliance && backPanel) {
    const n = Math.max(1, Math.ceil(w / MAX_PANEL_W));
    const panelW = (w - GAP * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const pg = new THREE.Group();
      pg.add(box(panelW, carcassH, END_PANEL_T, mats.panel));
      if (style === 'shaker' && carcassH >= 8 && panelW >= 8) {
        pg.add(grooveRing(panelW, carcassH, END_PANEL_T / 2, mats));
      }
      pg.rotation.y = Math.PI; // groove face points out the back (-z)
      pg.position.set(-w / 2 + panelW / 2 + i * (panelW + GAP), kick + carcassH / 2, -END_PANEL_T / 2);
      g.add(pg);
    }
  }

  // stainless fridge — proud door/drawer fronts, tubular handles, bottom vent grille
  if (steelFridge) {
    const ffw = w - REVEAL * 2;
    const yB = kick + REVEAL;
    const yT = kick + bodyH - REVEAL;
    const grilleH = 2.4;
    const areaB = yB + grilleH + GAP; // bottom of the door/drawer area
    const tubeHandle = (len: number, vertical: boolean) => {
      const grp = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, len, 14), mats.steel);
      if (!vertical) bar.rotation.z = Math.PI / 2;
      bar.position.z = 1.5;
      bar.castShadow = true;
      grp.add(bar);
      for (const t of [-1, 1] as const) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.3, 8), mats.steel);
        post.rotation.x = Math.PI / 2;
        if (vertical) post.position.set(0, t * (len / 2 - 1), 0.85);
        else post.position.set(t * (len / 2 - 1), 0, 0.85);
        grp.add(post);
      }
      return grp;
    };
    const addFront = (yc: number, ph: number, orient: 'v' | 'h', hSide: 1 | -1) => {
      const panel = box(ffw, ph, 0.9, mats.steel); // sits proud with a thin reveal around it
      panel.castShadow = true;
      panel.position.set(0, yc, d + 0.45);
      if (orient === 'v') {
        const hd = tubeHandle(ph * 0.7, true);
        hd.position.set(hSide * (ffw / 2 - 1.8), 0, 0.45);
        panel.add(hd);
      } else {
        const hd = tubeHandle(Math.min(ffw * 0.5, 12), false);
        hd.position.set(0, ph / 2 - 1.6, 0.45);
        panel.add(hd);
      }
      g.add(panel);
    };
    if (fridgeDrawers) {
      const rh = (yT - areaB - GAP) / 2;
      addFront(yT - rh / 2, rh, 'h', 1);
      addFront(areaB + rh / 2, rh, 'h', 1);
    } else {
      // handle opposite the hinge
      addFront((yT + areaB) / 2, yT - areaB, 'v', hinge === 'left' ? 1 : -1);
    }
    // bottom vent grille (dark recess with stainless slats)
    const grille = box(ffw, grilleH, 0.5, mats.dark);
    grille.position.set(0, yB + grilleH / 2, d + 0.4);
    g.add(grille);
    for (let i = 0; i < 4; i++) {
      const slat = box(ffw - 1.5, 0.16, 0.3, mats.steel);
      slat.position.set(0, yB + 0.5 + i * 0.5, d + 0.68);
      g.add(slat);
    }
  }

  // Built-in appliance openings (oven/microwave cabinet, refrigerator cabinet):
  // a dark recessed niche framed by a body-colour reveal. The customer's
  // appliance drops into this opening; the doors/drawer are built above.
  if ((cat.front === 'applianceoven' || cat.front === 'fridgetall') && !isAppliance) {
    const fwO = w - REVEAL * 2;
    const fhO = carcassH - REVEAL * 2;
    const L = applianceTallLayout(cat.front, fhO);
    const centerY = kick + carcassH / 2 + L.opening.dy;
    const openW = fwO;
    const openH = L.opening.h;
    // dark cavity panel (the niche)
    const cav = box(openW, openH, 0.6, mats.dark);
    cav.position.set(0, centerY, d + 0.1);
    cav.receiveShadow = true;
    g.add(cav);
    // body-colour frame, slightly proud, so the cavity reads as recessed
    const FR = 1.25;
    const fz = d + 0.4;
    const addFrame = (bw: number, bh: number, x: number, y: number) => {
      const m = box(bw, bh, 0.5, mats.body);
      m.position.set(x, y, fz);
      m.castShadow = true;
      g.add(m);
    };
    addFrame(openW, FR, 0, centerY + openH / 2 - FR / 2);
    addFrame(openW, FR, 0, centerY - openH / 2 + FR / 2);
    addFrame(FR, openH - FR * 2, -openW / 2 + FR / 2, centerY);
    addFrame(FR, openH - FR * 2, openW / 2 - FR / 2, centerY);
  }

  // Built-in dishwasher / ice maker: stainless front, top control panel, tube
  // handle, and (ice maker) a bottom vent grille.
  if (cat.front === 'dishwasher' || cat.front === 'icemaker') {
    const ffw = w - 0.5;
    const fz = d + 0.45;
    const yB = kick + REVEAL;
    const yT = kick + bodyH - REVEAL;
    // top control panel strip with a small display + buttons
    const ctrlH = 3;
    const ctrl = box(ffw, ctrlH, 0.9, mats.steel);
    ctrl.position.set(0, yT - ctrlH / 2, fz);
    g.add(ctrl);
    const display = box(ffw * 0.26, 1.2, 0.3, mats.dark);
    display.position.set(-ffw * 0.16, yT - ctrlH / 2, fz + 0.5);
    g.add(display);
    for (let i = 0; i < 3; i++) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12), mats.dark);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(ffw * (0.14 + i * 0.1), yT - ctrlH / 2, fz + 0.45);
      g.add(btn);
    }
    // door panel below the control strip (ice maker leaves room for a vent)
    const doorTop = yT - ctrlH - GAP;
    const iceVentH = 2.4;
    const doorBot = cat.front === 'icemaker' ? yB + iceVentH + GAP : yB;
    const door = box(ffw, doorTop - doorBot, 0.9, mats.steel);
    door.position.set(0, (doorTop + doorBot) / 2, fz);
    g.add(door);
    // horizontal tube handle near the top of the door
    const hlen = Math.min(ffw - 2, cat.front === 'icemaker' ? 9 : 16);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, hlen, 14), mats.steel);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, doorTop - 1.6, fz + 1.5);
    bar.castShadow = true;
    g.add(bar);
    for (const t of [-1, 1] as const) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.3, 8), mats.steel);
      post.rotation.x = Math.PI / 2;
      post.position.set(t * (hlen / 2 - 1), doorTop - 1.6, fz + 0.85);
      g.add(post);
    }
    if (cat.front === 'icemaker') {
      const grille = box(ffw, iceVentH, 0.5, mats.dark);
      grille.position.set(0, yB + iceVentH / 2, fz - 0.05);
      g.add(grille);
      for (let i = 0; i < 4; i++) {
        const slat = box(ffw - 1.5, 0.16, 0.3, mats.steel);
        slat.position.set(0, yB + 0.5 + i * 0.5, fz + 0.23);
        g.add(slat);
      }
    }
  }

  // Freestanding range: steel body (built above) + glass cooktop with burners,
  // knob strip, oven door with window + tube handle, storage drawer below.
  if (cat.front === 'range') {
    const ffw = w - 0.5;
    const fz = d + 0.45;
    // black glass cooktop on top, slightly proud
    const glass = box(w - 0.6, 0.6, d - 3, mats.dark);
    glass.position.set(0, h + 0.3, d / 2);
    g.add(glass);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1] as const) {
        const r = sz > 0 ? 2.9 : 2.3; // bigger burners at the front
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.16, 8, 26), mats.steelMatte);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(sx * (w / 4 - 0.5), h + 0.62, d / 2 + sz * (d / 4 - 1.2));
        g.add(ring);
      }
    }
    // knob strip across the top of the front
    const knobY = h - 1.7;
    const strip = box(ffw, 3, 0.5, mats.steel);
    strip.position.set(0, knobY, fz);
    g.add(strip);
    for (let i = 0; i < 5; i++) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.8, 14), mats.dark);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(-ffw / 2 + ffw * (0.14 + i * 0.18), knobY, fz + 0.6);
      knob.castShadow = true;
      g.add(knob);
    }
    // oven door with window
    const drawerH = 5.5;
    const doorTop = knobY - 1.5 - GAP;
    const doorBot = drawerH + GAP;
    const door = box(ffw, doorTop - doorBot, 0.9, mats.steel);
    door.position.set(0, (doorTop + doorBot) / 2, fz);
    g.add(door);
    const win = box(ffw - 7, (doorTop - doorBot) * 0.42, 0.3, mats.dark);
    win.position.set(0, (doorTop + doorBot) / 2 + 1, fz + 0.5);
    g.add(win);
    // full-width tube handle at the top of the oven door
    const hlen = ffw - 3;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, hlen, 14), mats.steel);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, doorTop - 1.2, fz + 1.7);
    bar.castShadow = true;
    g.add(bar);
    for (const t of [-1, 1] as const) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.5, 8), mats.steel);
      post.rotation.x = Math.PI / 2;
      post.position.set(t * (hlen / 2 - 1.2), doorTop - 1.2, fz + 0.9);
      g.add(post);
    }
    // storage drawer at the bottom
    const drawer = box(ffw, drawerH - 1, 0.7, mats.steel);
    drawer.position.set(0, drawerH / 2, fz);
    g.add(drawer);
    const dh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, ffw * 0.4, 10), mats.steel);
    dh.rotation.z = Math.PI / 2;
    dh.position.set(0, drawerH / 2 + 0.6, fz + 0.8);
    g.add(dh);
  }

  // above-counter appliance gear
  const counterTop = BASE_H + (dims.counterT ?? COUNTER_T);

  // Drop-in cooktop: black glass slab resting on the countertop with four
  // burner rings (front pair larger) and a small front control strip.
  if (cat.front === 'cooktop') {
    const cw = Math.min(w - 4, 30);
    const cd = Math.max(12, d - 6);
    const zc = d / 2 + 0.5;
    const glass = box(cw, 0.5, cd, mats.dark);
    glass.position.set(0, counterTop + 0.25, zc);
    glass.castShadow = true;
    g.add(glass);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1] as const) {
        const r = sz > 0 ? Math.min(3.1, cw / 8) : Math.min(2.4, cw / 10);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.16, 8, 26), mats.steelMatte);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(sx * cw / 4, counterTop + 0.52, zc + sz * (cd / 4 - 0.6));
        g.add(ring);
      }
    }
    // touch-control strip at the front edge of the glass
    const ctrl = box(Math.min(10, cw * 0.4), 0.06, 1.6, mats.steelMatte);
    ctrl.position.set(0, counterTop + 0.53, zc + cd / 2 - 1.6);
    g.add(ctrl);
  }

  const addKnobs = (cx: number, y: number, z: number, n: number) => {
    const gap = 4.5;
    const start = cx - ((n - 1) * gap) / 2;
    for (let i = 0; i < n; i++) {
      const x = start + i * gap;
      // steel bezel + dark knob + pointer mark
      const bezel = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.5, 16), mats.steel);
      bezel.rotation.x = Math.PI / 2;
      bezel.position.set(x, y, z + 0.25);
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 1, 14), mats.dark);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(x, y, z + 0.85);
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, 0.2), mats.steel);
      mark.position.set(x, y + 0.35, z + 1.3);
      bezel.castShadow = knob.castShadow = true;
      g.add(bezel, knob, mark);
    }
  };
  const addHoodHandle = (width: number, y: number, z: number) => {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, width, 10), mats.steel);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, y, z);
    bar.castShadow = true;
    g.add(bar);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.4, 8), mats.steel);
      post.rotation.x = Math.PI / 2;
      post.position.set((side * width) / 2.4, y, z - 1.2);
      g.add(post);
    }
  };
  if ((cat.front === 'grill' || cat.front === 'grill4') && !isAppliance) {
    // Built-in grill set into the cabinet, fixed width (the cabinet frame
    // widens around it). Brand-accurate head for the selected appliance when
    // we carry its model (lazy-loaded), else the generic Broilmaster, else
    // the procedural stainless face + roll-top hood.
    if (dims.modelKey) requestModel(dims.modelKey);
    const gw = applianceOpeningW(cat.front, w, dims.modelW);
    const useKey = dims.modelKey && hasModel(dims.modelKey) ? dims.modelKey : 'grill';
    // Real-life size: the head renders at its true width (shrunk only if the
    // cabinet is narrower) — a wider cabinet grows the framing, not the grill.
    // Jacketed units clamp to the cabinet width (their flange spans the
    // counter, wider than the face opening between the stiles).
    const info = useKey !== 'grill' ? applianceModelInfo(useKey) : null;
    const fitW = info ? Math.min(w - 1.5, info.realWIn) : Math.min(applianceFaceW(w), GRILL_MODEL_REAL_W);
    const model = fitModel(useKey, fitW);
    if (model) {
      // Close the cabinet's appliance-face opening with a DARK recessed panel
      // behind the unit — the sliver visible either side of the head's control
      // panel then reads as the shadowed cavity of a real built-in, not bare
      // white carcass.
      const applH = 6; // matches the shorter opening used in the fronts layout
      const faceY = kick + carcassH - REVEAL - applH / 2;
      const face = box(gw + 1, applH + 1, 0.6, mats.dark);
      face.position.set(0, faceY, d - 1.6);
      g.add(face);
      if (GRILL_MODEL_YAW) model.rotation.y = GRILL_MODEL_YAW;
      const mb = new THREE.Box3().setFromObject(model);
      const md = mb.max.z - mb.min.z; // scaled depth
      if (info?.jacketTopIn) {
        // jacketed unit: the insulated liner's flange rests ON the countertop,
        // the jacket box hangs through the cut-out into the cabinet. Shift the
        // model forward so the CONTROL PANEL (not the overhanging hood) lands at
        // the counter front — capped so the hood can't slide off.
        const counterTop = h + (dims.counterT ?? COUNTER_T);
        const scale = fitW / info.realWIn;
        const fwd = Math.min((info.ctrlRecessFrac ?? 0) * md, md * 0.25);
        model.position.set(0, counterTop - info.jacketTopIn * scale, d - md / 2 - GRILL_MODEL_BACK + fwd);
      } else {
        // firebox sinks into the cabinet; hood rises above the countertop
        model.position.set(0, h - GRILL_MODEL_SINK, d - md / 2 - GRILL_MODEL_BACK);
      }
      applyModelAlign(model, dims.modelAlign);
      g.add(model);
    } else {
      const applH = 9;
      const faceY = kick + carcassH - REVEAL - applH / 2;
      const face = box(gw, applH, 1.5, mats.steel);
      face.position.set(0, faceY, d - 0.2);
      g.add(face);
      addKnobs(0, faceY - 1, d + 0.55, Math.max(3, Math.min(5, Math.round(gw / 8))));
      // grill body lip just above the cabinet top
      const lip = box(gw, 1.8, d - 3, mats.steel);
      lip.position.set(0, h + 0.9, d / 2);
      g.add(lip);
      // roll-top hood
      const hoodH = 8.5;
      const hoodD = d - 6;
      const hoodFrontZ = d - 2;
      const hood = grillHood(gw - 0.5, hoodD, hoodH, mats.steel);
      hood.position.set(0, h + 1.8, hoodFrontZ);
      g.add(hood);
      // thermometer on the hood face
      const thermoBezel = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.7, 18), mats.steel);
      thermoBezel.rotation.x = Math.PI / 2;
      thermoBezel.position.set(0, h + 1.8 + hoodH * 0.55, hoodFrontZ + 0.2);
      const thermoFace = new THREE.Mesh(
        new THREE.CylinderGeometry(1.05, 1.05, 0.75, 18),
        new THREE.MeshStandardMaterial({ color: 0xf4f5f2, roughness: 0.35 })
      );
      thermoFace.rotation.x = Math.PI / 2;
      thermoFace.position.set(0, h + 1.8 + hoodH * 0.55, hoodFrontZ + 0.25);
      g.add(thermoBezel, thermoFace);
      // handle across the hood front
      addHoodHandle(gw - 8, h + 1.8 + hoodH * 0.28, hoodFrontZ + 1.7);
    }
  } else if ((cat.front === 'griddle' || cat.front === 'griddle4') && !isAppliance) {
    // Fixed griddle width (centered) so the unit doesn't stretch with the cabinet.
    // Brand-accurate unit for the selected appliance when we carry its model.
    if (dims.modelKey) requestModel(dims.modelKey);
    const openW = applianceOpeningW(cat.front, w, dims.modelW);
    const useKey = dims.modelKey && hasModel(dims.modelKey) ? dims.modelKey : 'griddle';
    const info = useKey !== 'griddle' ? applianceModelInfo(useKey) : null;
    const fitW = info ? Math.min(w - 1.5, info.realWIn) : GRIDDLE_MODEL_W_FRAC * openW;
    const model = fitModel(useKey, fitW);
    if (model) {
      // Close the cabinet's appliance-face opening with a stainless panel set
      // back behind the unit, so no carcass shows but the model's own control
      // face (knobs/branding) stays visible in front of it.
      const gw = openW;
      const applH = 7;
      const faceY = kick + carcassH - REVEAL - applH / 2;
      const face = box(gw, applH, 0.6, mats.steelMatte);
      face.position.set(0, faceY, d - 1.6);
      g.add(face);
      // Drop the real griddle into the top of the cabinet, cooking surface PROUD
      // of the top, controls flush to the front (+z faces the room).
      if (GRIDDLE_MODEL_YAW) model.rotation.y = GRIDDLE_MODEL_YAW;
      const mb = new THREE.Box3().setFromObject(model);
      const mh = mb.max.y - mb.min.y; // scaled height
      const md = mb.max.z - mb.min.z; // scaled depth
      if (info?.jacketTopIn) {
        // jacketed unit: the liner flange rests on the countertop; shift forward
        // so the controls reach the counter front (capped)
        const counterTop = h + (dims.counterT ?? COUNTER_T);
        const fwd = Math.min((info.ctrlRecessFrac ?? 0) * md, md * 0.25);
        model.position.set(0, counterTop - info.jacketTopIn * (fitW / info.realWIn), d - md / 2 - GRIDDLE_MODEL_BACK + fwd);
      } else {
        model.position.set(0, h + GRIDDLE_MODEL_PROUD - mh, d - md / 2 - GRIDDLE_MODEL_BACK);
      }
      applyModelAlign(model, dims.modelAlign);
      g.add(model);
    } else {
      const gw = openW;
      const applH = 7;
      const faceY = kick + carcassH - REVEAL - applH / 2;
      const face = box(gw, applH, 1.5, mats.steel);
      face.position.set(0, faceY, d - 0.2);
      g.add(face);
      addKnobs(0, faceY - 1, d + 0.55, 3);
      const lip = box(gw, 1.4, d - 4, mats.steel);
      lip.position.set(0, h + 0.7, d / 2);
      g.add(lip);
      const lid = grillHood(gw - 0.5, d - 7, 3.4, mats.steel);
      lid.position.set(0, h + 1.4, d - 2.5);
      g.add(lid);
      addHoodHandle(Math.min(16, gw - 8), h + 2.6, d - 2.5 + 1.5);
    }
  } else if (cat.front === 'burner' && !isAppliance) {
    // Drop-in side/power burner: recessed control face, lip and rounded lid.
    // Face height mirrors the grill cabinets' (see the fronts layout) so the
    // steel face fills the opening and door tops line up across a run.
    const gw = applianceFaceW(w);
    const applH = hasModel('grill') ? 6 : 9;
    const faceY = kick + carcassH - REVEAL - applH / 2;
    const face = box(gw, applH, 1.5, mats.steel);
    face.position.set(0, faceY, d - 0.2);
    g.add(face);
    addKnobs(0, faceY - 1, d + 0.55, Math.max(1, Math.min(2, Math.round(gw / 10))));
    const lip = box(gw, 1.4, d - 4, mats.steel);
    lip.position.set(0, h + 0.7, d / 2);
    g.add(lip);
    const lid = grillHood(gw - 0.5, d - 7, 3, mats.steel);
    lid.position.set(0, h + 1.4, d - 2.5);
    g.add(lid);
    addHoodHandle(Math.min(12, gw - 5), h + 2.5, d - 2.5 + 1.4);
  } else if (cat.front === 'kamado' && !isAppliance) {
    const r = Math.min(w / 2 - 4, 12);
    const egg = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), mats.egg);
    egg.scale.y = 1.15;
    egg.castShadow = true;
    egg.position.set(0, counterTop + r * 0.7, d / 2);
    g.add(egg);
  } else if (cat.front === 'kamadoinsert' && !isAppliance) {
    // kamado recessed into the open 12″ compartment, dome rising above the top
    const r = Math.min(w / 2 - 5, 11);
    const egg = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), mats.egg);
    egg.scale.y = 1.15;
    egg.castShadow = true;
    const compFloor = h - KAMADO_OPEN_H; // top of the door region (= floor of the opening)
    const eggY = compFloor + r * 0.9;
    egg.position.set(0, eggY, d / 2 + 1);
    g.add(egg);
    // lid seam band around the kamado's widest point
    const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.0, 0.3, 8, 30), mats.dark);
    band.position.set(0, eggY, d / 2 + 1);
    band.rotation.x = Math.PI / 2;
    g.add(band);
  } else if (isSinkFront(cat.front)) {
    // dropped-in stainless basin (the counter is cut out over it in scene3d)
    const { bw, bd, zc, bowlH } = sinkBasin(w, d);
    const stl = mats.steel;
    const T = 0.4;
    const botY = counterTop - bowlH;
    const midY = counterTop - bowlH / 2;
    const addB = (bw2: number, bh2: number, bd2: number, x: number, y: number, z: number) => {
      const m = box(bw2, bh2, bd2, stl);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    };
    addB(bw, T, bd, 0, botY, zc); // bottom
    addB(bw, bowlH, T, 0, midY, zc - bd / 2 + T / 2); // back wall
    addB(bw, bowlH, T, 0, midY, zc + bd / 2 - T / 2); // front wall
    addB(T, bowlH, bd, -bw / 2 + T / 2, midY, zc); // left wall
    addB(T, bowlH, bd, bw / 2 - T / 2, midY, zc); // right wall
    // thin rim around the opening to finish the cut edge
    addB(bw + 0.8, 0.25, T, 0, counterTop + 0.1, zc - bd / 2 - 0.2);
    addB(bw + 0.8, 0.25, T, 0, counterTop + 0.1, zc + bd / 2 + 0.2);
    addB(T, 0.25, bd + 1.2, -bw / 2 - 0.2, counterTop + 0.1, zc);
    addB(T, 0.25, bd + 1.2, bw / 2 + 0.2, counterTop + 0.1, zc);
    // drain
    const drain = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.2, 14), mats.dark);
    drain.position.set(0, botY + 0.25, zc);
    g.add(drain);
    // gooseneck faucet behind the basin
    const zF = Math.max(2.2, zc - bd / 2 - 1.6);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 1.0, 16), stl);
    base.position.set(0, counterTop + 0.5, zF);
    base.castShadow = true;
    g.add(base);
    const riserH = 6;
    const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, riserH, 14), stl);
    riser.position.set(0, counterTop + 1 + riserH / 2, zF);
    riser.castShadow = true;
    g.add(riser);
    const topY = counterTop + 1 + riserH;
    const R = 2.4;
    const neck = new THREE.Mesh(new THREE.TorusGeometry(R, 0.42, 12, 20, Math.PI), stl);
    neck.rotation.y = Math.PI / 2; // arc into the Y-Z plane (up and forward)
    neck.position.set(0, topY, zF + R);
    neck.castShadow = true;
    g.add(neck);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 1.6, 12), stl);
    tip.position.set(0, topY - 0.7, zF + 2 * R);
    g.add(tip);
    // lever handle on the base
    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 3, 10), stl);
    lever.rotation.z = Math.PI / 2.4;
    lever.position.set(1.5, counterTop + 2, zF);
    lever.castShadow = true;
    g.add(lever);
  }

  // standalone appliances
  if (isAppliance) {
    if (cat.front === 'kamado') {
      const r = Math.min(w / 2 - 3, 14);
      const egg = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), mats.egg);
      egg.scale.y = 1.15;
      egg.castShadow = true;
      egg.position.set(0, h - 14 - r * 0.2, d / 2);
      g.add(egg);
    } else if (cat.front === 'pizza') {
      const r = Math.min(w / 2 - 2, 16);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(r, 24, 18, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xb8643c, roughness: 0.6 })
      );
      dome.castShadow = true;
      dome.position.set(0, h * 0.55, d / 2);
      g.add(dome);
    } else if (cat.front === 'cartgrill') {
      const hood = box(w * 0.62, 9, d - 4, mats.steel);
      hood.position.set(0, h - 4.5, d / 2);
      g.add(hood);
    }
  }

  return g;
}
