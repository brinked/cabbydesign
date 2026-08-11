import * as THREE from 'three';
import { ALL_FINISHES, BAR_DEPTH, BAR_NOSE, BAR_OVERHANG, BAR_RISE, BASE_H, COUNTER_OVERHANG, COUNTER_T, TOEKICK_H, bridgesCounter, catalogById, frontExtraD, takesAppliedEnds } from '../model/catalog';
import { CORNER_EPS, cornerCounterExtend, frameForWall, isFenceStyle, planBounds, wallEndpoints, wallStyleOf } from '../model/geometry';
import { appliance3dModel, selectedApplianceHeight } from '../model/appliances';
import { countertopById } from '../model/countertops';
import { flooringById } from '../model/flooring';
import { pergolaColorHex, pergolaColumns, pergolaModelInfo } from '../model/pergola';
import type { ApplianceItem, Design, FinishOption, ModelAligns, OpeningKind, Pergola, PlacedItem, Wall } from '../model/types';
import { resolveItemFinish } from '../model/newage';
import { backsplashSpans, barRiserFor, counterHeightFor, footprintW, laneItems, reservesFor, useStore } from '../state/store';
import { SLIDER_4PANEL_MIN_W, fitModelBox, hasModel, libTexture, namedHandleKey, onModelsLoaded, requestModel, sliderModelKey } from './models';
import { CORNER_RETURN, END_PANEL_T, MAX_PANEL_W, box, buildCabinetLocal, canvasTexture, cornerChamfer, createMats, disposeMats, facePattern, grillCutout, isSinkFront, sinkBasin } from './cabinet3d';

function counterRuns3d(items: PlacedItem[], bridge: boolean): Array<{ x1: number; x2: number; d: number; h: number }> {
  // corner cabinets get their own shaped counter, so exclude them from runs.
  // Bar-height cabinets carry BOTH their stone tiers in the cabinet build, so
  // they're excluded from the per-run counter too.
  const tops = items
    .filter((it) => {
      const c = catalogById(it.catalogId);
      return bridgesCounter(c) && !c.barHeight && c.front !== 'corner' && c.front !== 'susan';
    })
    .sort((a, b) => a.x - b.x);
  const runs: Array<{ x1: number; x2: number; d: number; h: number }> = [];
  for (const it of tops) {
    // Undercounter appliances (fridges/ice makers) keep the counter at the
    // standard height passing over them — the gap shows underneath.
    const h = counterHeightFor(it);
    const fd = it.d + it.outset + frontExtraD(catalogById(it.catalogId));
    const last = runs[runs.length - 1];
    // Merge only with an adjacent cabinet of the same height — a height change
    // starts a new run so the counter steps down to follow each cabinet.
    if (last && it.x <= last.x2 + (bridge ? 60 : 0.2) && Math.abs(last.h - h) < 0.01) {
      last.x2 = Math.max(last.x2, it.x + footprintW(it));
      last.d = Math.max(last.d, fd);
    } else runs.push({ x1: it.x, x2: it.x + footprintW(it), d: fd, h });
  }
  return runs;
}

/**
 * Aluminum pergola over the kitchen (The Pergola Collection). Local frame:
 * x = beam span (width), z = projection, y up; centred on x/z at ground level.
 * Roof style follows the model: aria = open lattice, fresco = translucent
 * panel, moderno/contempo/classico = solid (with trusses/rafter tails), sole =
 * angled louvers.
 */
function buildPergola(p: Pergola): { group: THREE.Group; dispose: () => void } {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(pergolaColorHex(p.color)), roughness: 0.5, metalness: 0.3 });
  const paneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, transparent: true, opacity: 0.42 });
  const add = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = mat) => {
    const b = box(w, h, d, m);
    b.position.set(x, y, z);
    b.castShadow = b.receiveShadow = true;
    g.add(b);
  };
  const { w, l, postH, model } = p;
  const info = pergolaModelInfo(model);
  const POST = 7;
  // Modern sets its posts flush at the corners for a clean line; the others
  // inset them under the beam.
  const IN = info.edgeColumns ? POST / 2 : 6;
  // Columns form a grid — an extra one every maxSpanFt — and the side set
  // against a wall drops its whole row (the structure hangs off the building).
  const { nx, ny } = pergolaColumns(p);
  const spread = (n: number, span: number) =>
    n <= 1 ? [0] : Array.from({ length: n }, (_, i) => -(span / 2 - IN) + (i * (span - IN * 2)) / (n - 1));
  const xs = spread(nx, w);
  const zs = spread(ny, l);
  for (let ix = 0; ix < xs.length; ix++) {
    for (let iz = 0; iz < zs.length; iz++) {
      // skip the row carried by the wall
      if (p.attach === 'back' && iz === 0) continue;
      if (p.attach === 'front' && iz === zs.length - 1) continue;
      if (p.attach === 'left' && ix === 0) continue;
      if (p.attach === 'right' && ix === xs.length - 1) continue;
      add(POST, postH, POST, xs[ix], postH / 2, zs[iz]);
    }
  }
  if (model === 'modern') {
    // Squared modern frame: a flush fascia band sitting directly on the corner
    // posts (no overhang, no rafters) with a solid recessed ceiling — the
    // clean rectangular silhouette, not a louvered roof.
    const fascia = 8;
    const T = 3.5; // fascia thickness
    const fy = postH + fascia / 2;
    add(w, fascia, T, 0, fy, -(l / 2 - T / 2));
    add(w, fascia, T, 0, fy, l / 2 - T / 2);
    add(T, fascia, l - T * 2, -(w / 2 - T / 2), fy, 0);
    add(T, fascia, l - T * 2, w / 2 - T / 2, fy, 0);
    // solid roof panel, set just below the fascia's top edge
    add(w - T * 2, 2, l - T * 2, 0, postH + fascia - 2.6, 0);
    return { group: g, dispose: () => { mat.dispose(); paneMat.dispose(); } };
  }

  // perimeter beams
  const beamH = 9;
  const beamY = postH + beamH / 2;
  add(w + 8, beamH, 3, 0, beamY, -(l / 2 - IN));
  add(w + 8, beamH, 3, 0, beamY, l / 2 - IN);
  add(3, beamH, l, -(w / 2 - IN), beamY, 0);
  add(3, beamH, l, w / 2 - IN, beamY, 0);
  const topY = postH + beamH;
  const rafterN = Math.max(3, Math.round(w / 16));
  const rafters = (spacingN: number, tall = 7) => {
    for (let i = 0; i < spacingN; i++) {
      const x = -w / 2 + ((i + 0.5) * w) / spacingN;
      add(2, tall, l + 10, x, topY + tall / 2, 0);
    }
  };
  if (model === 'aria') {
    rafters(rafterN);
    // adjustable shade lattice: purlins across the rafters
    const pn = Math.max(3, Math.round(l / 20));
    for (let i = 0; i < pn; i++) {
      const z = -l / 2 + ((i + 0.5) * l) / pn;
      add(w + 4, 1.6, 1.6, 0, topY + 7.8, z);
    }
  } else if (model === 'fresco') {
    rafters(Math.max(3, Math.round(w / 24)));
    add(w + 6, 0.6, l + 6, 0, topY + 7.6, 0, paneMat);
  } else if (model === 'sole') {
    // motorized louvers inside the frame
    const ln = Math.max(4, Math.round(l / 7));
    for (let i = 0; i < ln; i++) {
      const z = -l / 2 + IN + ((i + 0.5) * (l - IN * 2)) / ln;
      const slat = box(w - IN * 2, 0.8, 6, mat);
      slat.rotation.x = -0.6;
      slat.position.set(0, topY + 3, z);
      slat.castShadow = slat.receiveShadow = true;
      g.add(slat);
    }
  } else {
    // solid insulated roof (moderno / contempo / classico)
    add(w + 8, 4, l + 8, 0, topY + 2, 0);
    if (model === 'contempo') {
      // decorative truss ends past the beams on both sides
      for (const pz of [-(l / 2 - IN), l / 2 - IN]) add(w + 20, 5, 2.5, 0, postH + 4, pz);
    }
    if (model === 'classico') {
      // full exposed rafter tails under the roof
      for (let i = 0; i < rafterN; i++) {
        const x = -w / 2 + ((i + 0.5) * w) / rafterN;
        add(2, 5, l + 16, x, postH + beamH - 2.5, 0);
      }
    }
  }
  return { group: g, dispose: () => { mat.dispose(); paneMat.dispose(); } };
}

/** Real-world size of one lawn texture tile (inches) — the scan is a ~2 m
 *  patch of turf, so it repeats about every 80". */
const GRASS_TILE = 80;

/**
 * Lawn material for the yard the kitchen sits in. Uses the scanned turf
 * (colour + normal) once it loads, tiled at its true size; until then — and if
 * the texture is ever missing — it falls back to the procedural canvas below.
 *
 * `radius` is the ground disc's radius in inches, used to work out the tile
 * count (CircleGeometry UVs span 0..1 across the bounding square).
 */
export function groundMaterial(radius: number): THREE.MeshStandardMaterial {
  const reps = Math.max(1, Math.round((radius * 2) / GRASS_TILE));
  const tile = (t: THREE.Texture) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(reps, reps);
    return c;
  };
  // the scan already carries its own shading; keep the surface fully matte
  const mat = new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 });
  const apply = () => {
    const color = libTexture('grass-color.jpg');
    if (!color) return false;
    const normal = libTexture('grass-normal.jpg', true);
    mat.map?.dispose(); // the procedural canvas it replaces
    mat.map = tile(color);
    if (normal) mat.normalMap = tile(normal);
    mat.needsUpdate = true;
    return true;
  };
  // The ground is built once by the viewer, not rebuilt with the design, so
  // it has to patch itself when the scan lands rather than wait to be redrawn.
  if (!apply()) {
    const off = onModelsLoaded(() => {
      if (apply()) off();
    });
  }
  return mat;
}

export function groundTexture(): THREE.CanvasTexture {
  // Lawn: the whole yard reads as grass; the kitchen sits on its own concrete
  // pad (see the slab in buildDesignGroup) so the space feels defined.
  return canvasTexture(1024, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.05, s / 2, s / 2, s * 0.55);
    g.addColorStop(0, '#8fb872');
    g.addColorStop(0.6, '#7ca961');
    g.addColorStop(1, '#699553');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    // sparse mottling so the lawn isn't a flat wash
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(56,99,42,0.16)' : 'rgba(173,208,138,0.15)';
      ctx.fillRect(x, y, 2, Math.random() < 0.3 ? 4 : 2);
    }
  });
}

export function skyTexture(): THREE.CanvasTexture {
  return canvasTexture(512, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#cfe0f0');
    g.addColorStop(0.55, '#e8eef5');
    g.addColorStop(1, '#f4f2ee');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

/**
 * HDR equirect sky for path tracing: blue-to-warm gradient with a bright sun
 * disk. The sun carries real HDR intensity, so the path tracer produces
 * directional soft shadows and accurate metal highlights from it.
 */
export function equirectSkyHDR(): THREE.DataTexture {
  const w = 1024;
  const h = 512;
  const data = new Float32Array(w * h * 4);
  const zen = [0.42, 0.6, 0.86];
  const hor = [0.95, 0.96, 0.99];
  const gnd = [0.36, 0.44, 0.3]; // grass bounce light
  // sun position: a bit east and fairly high
  const sunX = w * 0.3;
  const sunY = h * 0.22;
  const sunR = 14;
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    let r: number, g: number, b: number;
    if (t < 0.5) {
      const k = t / 0.5;
      r = zen[0] + (hor[0] - zen[0]) * k;
      g = zen[1] + (hor[1] - zen[1]) * k;
      b = zen[2] + (hor[2] - zen[2]) * k;
    } else {
      const k = (t - 0.5) / 0.5;
      r = hor[0] + (gnd[0] - hor[0]) * k;
      g = hor[1] + (gnd[1] - hor[1]) * k;
      b = hor[2] + (gnd[2] - hor[2]) * k;
    }
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // wrap-aware distance to the sun
      const dx = Math.min(Math.abs(x - sunX), w - Math.abs(x - sunX));
      const dy = y - sunY;
      const dist = Math.hypot(dx, dy);
      const sun = Math.exp(-(dist * dist) / (2 * sunR * sunR)) * 60;
      const halo = Math.exp(-(dist * dist) / (2 * 90 * 90)) * 0.8;
      data[i] = r + sun + halo * 1.0;
      data[i + 1] = g + sun * 0.96 + halo * 0.95;
      data[i + 2] = b + sun * 0.88 + halo * 0.85;
      data[i + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  return tex;
}

export interface BuiltScene {
  group: THREE.Group;
  center: THREE.Vector3;
  radius: number;
  dispose: () => void;
}

/** Angled (chamfered) countertop for a corner cabinet, with a front overhang. */
function cornerCounter(w: number, d: number, side: 1 | -1, mat: THREE.Material, cT: number, restH: number = BASE_H): THREE.Mesh {
  const O = COUNTER_OVERHANG;
  const c = cornerChamfer(d);
  const s = new THREE.Shape();
  if (side === 1) {
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, d - c + O);
    s.lineTo(w / 2 - c, d + O);
    s.lineTo(-w / 2, d + O);
  } else {
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, d + O);
    s.lineTo(-w / 2 + c, d + O);
    s.lineTo(-w / 2, d - c + O);
  }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: cT, bevelEnabled: false });
  geo.rotateX(Math.PI / 2); // depth → +z, extrude → −y
  geo.translate(0, restH + cT, 0); // sit on top of the base cabinet
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** L-shaped countertop for a lazy-susan cabinet, with a front overhang. */
function susanCounter(w: number, d: number, side: 1 | -1, mat: THREE.Material, cT: number, restH: number = BASE_H): THREE.Mesh {
  const O = COUNTER_OVERHANG;
  const legD = CORNER_RETURN;
  // The notch (inner) edge faces the room too, so it carries the same overhang
  // as the legs' front edges — otherwise the deep leg reads 1" shallower than an
  // abutting standard cabinet on the perpendicular wall.
  const s = new THREE.Shape();
  if (side === 1) {
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, legD + O);
    s.lineTo(-w / 2 + legD + O, legD + O);
    s.lineTo(-w / 2 + legD + O, d + O);
    s.lineTo(-w / 2, d + O);
  } else {
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, d + O);
    s.lineTo(w / 2 - legD - O, d + O);
    s.lineTo(w / 2 - legD - O, legD + O);
    s.lineTo(-w / 2, legD + O);
  }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: cT, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, restH + cT, 0);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Countertop slab (centred on x, 0..depth from the wall) with rectangular
 * cut-outs for dropped-in sinks. Coords are in the wall's local frame.
 */
/** One front-depth segment of a counter run: the counter reaches `z` (inches
 *  from the wall) across [x1, x2] (run-local x). */
interface FrontSeg {
  x1: number;
  x2: number;
  z: number;
}

/**
 * Build the stepped front profile of a counter run across [xL, xR] (run-local
 * x). Each real cabinet sets the counter's front to its own depth + overhang;
 * gaps and shallow fillers inherit the deeper neighbouring depth.
 */
function buildFrontProfile(xL: number, xR: number, depthCabs: FrontSeg[], fallbackZ: number): FrontSeg[] {
  // Elementary boundaries: run ends + every cabinet edge (clamped).
  const clamp = (x: number) => Math.max(xL, Math.min(xR, x));
  const bounds = new Set<number>([xL, xR]);
  for (const c of depthCabs) {
    bounds.add(clamp(c.x1));
    bounds.add(clamp(c.x2));
  }
  const xs = [...bounds].sort((a, b) => a - b);
  const zAt = (m: number): number => {
    // Inside a real cabinet → that cabinet's front depth.
    for (const c of depthCabs) if (m >= c.x1 && m <= c.x2) return c.z;
    // A gap / overhang / filler → the deeper of the nearest cabinets each side.
    let left = -Infinity, leftZ = 0, right = Infinity, rightZ = 0;
    for (const c of depthCabs) {
      if (c.x2 <= m && c.x2 > left) { left = c.x2; leftZ = c.z; }
      if (c.x1 >= m && c.x1 < right) { right = c.x1; rightZ = c.z; }
    }
    const zs = [leftZ, rightZ].filter((z) => z > 0);
    return zs.length ? Math.max(...zs) : fallbackZ;
  };
  const segs: FrontSeg[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1];
    if (b - a < 0.01) continue;
    const z = zAt((a + b) / 2);
    const last = segs[segs.length - 1];
    if (last && Math.abs(last.z - z) < 0.01) last.x2 = b; // merge equal-depth runs
    else segs.push({ x1: a, x2: b, z });
  }
  return segs;
}

/**
 * Countertop slab for a run: a stepped front profile (each cabinet at its own
 * depth + overhang, grills notched back) with rectangular cut-outs for dropped
 * sinks. Coords are in the wall's local frame, x centred on the run.
 */
function counterRunSlab(
  segs: FrontSeg[],
  holes: Array<{ x1: number; x2: number; z1: number; z2: number }>,
  mat: THREE.Material,
  cT: number,
  restH: number = BASE_H,
  backZ = 0 // negative = seating overhang past the island's back
): THREE.Mesh {
  const xL = segs[0].x1;
  const s = new THREE.Shape();
  s.moveTo(xL, backZ);
  s.lineTo(segs[segs.length - 1].x2, backZ); // back edge (wall, or overhang)
  // Up the right side, then walk the stepped front right → left.
  s.lineTo(segs[segs.length - 1].x2, segs[segs.length - 1].z);
  for (let i = segs.length - 1; i >= 0; i--) {
    s.lineTo(segs[i].x1, segs[i].z); // across this segment's front
    if (i > 0) s.lineTo(segs[i].x1, segs[i - 1].z); // step to the left neighbour's depth
  }
  s.closePath(); // down the left side back to (xL, 0)
  for (const h of holes) {
    const p = new THREE.Path();
    p.moveTo(h.x1, h.z1);
    p.lineTo(h.x2, h.z1);
    p.lineTo(h.x2, h.z2);
    p.lineTo(h.x1, h.z2);
    p.closePath();
    s.holes.push(p);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth: cT, bevelEnabled: false });
  geo.rotateX(Math.PI / 2); // shape Y → +z (depth), extrude → −y
  geo.translate(0, restH + cT, 0); // top surface at counter height
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Builds all walls, cabinets and counters for a design as one group. */
export function buildDesignGroup(design: Design, fin: FinishOption, appliances: ApplianceItem[] = [], modelAligns: ModelAligns = {}): BuiltScene {
  const group = new THREE.Group();
  const mats = createMats(fin, countertopById(design.counterId));
  // Per-cabinet finish overrides (NewAge series/door options) — one material
  // set per distinct finish, created lazily and disposed with the scene.
  const matsByFinish = new Map<string, ReturnType<typeof createMats>>();
  const matsFor = (finishId: string | undefined): typeof mats => {
    if (!finishId || finishId === fin.id) return mats;
    const f = ALL_FINISHES.find((x) => x.id === finishId);
    if (!f) return mats;
    let m = matsByFinish.get(finishId);
    if (!m) {
      m = createMats(f, countertopById(design.counterId));
      matsByFinish.set(finishId, m);
    }
    return m;
  };
  // Selected hardware: a handle named to match a modelled product (e.g.
  // "Charlotte 316") renders as that product; anything else falls back to the
  // generic bar family sized per front.
  const selectedHandle = design.handleId ? useStore.getState().handles.find((h) => h.id === design.handleId) : undefined;
  // explicit model choice wins; otherwise fall back to matching the product
  // name (so items named e.g. "Charlotte 316" work without being re-saved)
  const handleModel =
    selectedHandle?.model && selectedHandle.model !== 'bar' ? selectedHandle.model : namedHandleKey(selectedHandle?.name);
  const cT = design.counterThickness ?? COUNTER_T;
  const bsH = design.backsplashHeight ?? 0; // stone backsplash height up the wall (0 = none)
  const BS_THICK = 0.75; // backsplash slab thickness off the wall
  const reserves = bsH > 0 ? reservesFor(design) : null; // corner zones for backsplash spans
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1eee7, roughness: 0.92 });
  // Per-wall paint colors (standard finish only) — created on demand, disposed
  // with the scene.
  const coloredWallMats: THREE.MeshStandardMaterial[] = [];
  const wallMatFor = (wall: Wall): THREE.MeshStandardMaterial => {
    if (!wall.color) return wallMat;
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(wall.color), roughness: 0.92 });
    coloredWallMats.push(m);
    return m;
  };
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x9c7a4d, roughness: 0.85 });
  const whiteFenceMat = new THREE.MeshStandardMaterial({ color: 0xf2f1ec, roughness: 0.8 });
  // Screened-in patio wall: dark bronze aluminum framing + see-through mesh.
  const screenFrameMat = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.5, metalness: 0.45 });
  const screenMeshMat = new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.9, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
  // Textured wall finishes (brick / shiplap / modern wood / acoustic slats):
  // one procedural 48"-tile per style, repeated to each wall's size.
  const styledWallMats: THREE.MeshStandardMaterial[] = [];
  const styledWallMat = (style: string, L: number, H: number): THREE.MeshStandardMaterial => {
    const TILE = 48;
    const tex = canvasTexture(512, (ctx, s) => {
      const px = s / TILE; // pixels per inch
      if (style === 'brick') {
        ctx.fillStyle = '#cfc7bb'; // mortar
        ctx.fillRect(0, 0, s, s);
        const bh = 2.7 * px;
        const bw = 8.4 * px;
        const bricks = ['#9b5744', '#8f4f3e', '#a56350', '#94564a'];
        for (let r = 0; r * bh < s; r++) {
          const off = r % 2 ? bw / 2 : 0;
          for (let cIdx = -1; cIdx * bw < s + bw; cIdx++) {
            ctx.fillStyle = bricks[Math.abs((r * 7 + cIdx * 3) % bricks.length)];
            ctx.fillRect(cIdx * bw + off + 0.4 * px, r * bh + 0.4 * px, bw - 0.8 * px, bh - 0.8 * px);
          }
        }
      } else if (style === 'shiplap') {
        ctx.fillStyle = '#eceeed';
        ctx.fillRect(0, 0, s, s);
        const board = 6.85 * px;
        for (let r = 0; r * board < s; r++) {
          const y = r * board;
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.fillRect(0, y, s, 1.5);
          ctx.fillStyle = r % 2 ? '#e9ebe9' : '#eff1f0';
          ctx.fillRect(0, y + 1.5, s, board - 1.5);
          ctx.fillStyle = 'rgba(0,0,0,0.04)';
          for (let i = 0; i < 6; i++) ctx.fillRect(Math.random() * s, y + Math.random() * board, 30 + Math.random() * 90, 1);
        }
      } else if (style === 'modern-wood') {
        const planks = ['#7a5a3d', '#8a6748', '#6e4f35', '#83603f'];
        const board = 7.9 * px;
        for (let r = 0; r * board < s; r++) {
          const y = r * board;
          ctx.fillStyle = planks[r % planks.length];
          ctx.fillRect(0, y, s, board);
          ctx.fillStyle = 'rgba(0,0,0,0.28)';
          ctx.fillRect(0, y, s, 1.2);
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          for (let i = 0; i < 8; i++) ctx.fillRect(0, y + Math.random() * board, s, 0.8);
        }
      } else {
        // acoustic slats: warm wood slats over a near-black backing
        ctx.fillStyle = '#17130f';
        ctx.fillRect(0, 0, s, s);
        const pitch = 3.4 * px;
        const slat = 2.3 * px;
        const woods = ['#a97e5a', '#9c7250', '#b0855f', '#8a6344'];
        for (let cIdx = 0; cIdx * pitch < s + pitch; cIdx++) {
          const x = cIdx * pitch;
          ctx.fillStyle = woods[cIdx % woods.length];
          ctx.fillRect(x, 0, slat, s);
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          for (let i = 0; i < 5; i++) ctx.fillRect(x + Math.random() * slat, 0, 0.8, s);
        }
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, L / TILE), Math.max(1, H / TILE));
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: style === 'shiplap' ? 0.85 : 0.9 });
    styledWallMats.push(m);
    return m;
  };
  // A picket fence centered at the origin (x=length, y=height, z=thickness), so it
  // drops into the same place() call the solid wall box uses.
  const buildFence = (L: number, H: number, th: number, mat: THREE.Material = fenceMat): THREE.Group => {
    const g = new THREE.Group();
    const postW = Math.min(3.5, Math.max(2, th));
    const posts = Math.max(2, Math.round(L / 72) + 1);
    for (let i = 0; i < posts; i++) {
      const post = box(postW, H, postW, mat);
      post.position.set(-L / 2 + (L * i) / (posts - 1), 0, 0);
      post.castShadow = true;
      g.add(post);
    }
    for (const ry of [H * 0.32, -H * 0.32]) {
      const rail = box(L, 3.5, 1.0, mat);
      rail.position.set(0, ry, 0);
      g.add(rail);
    }
    const pitch = 5.5; // picket + gap
    const n = Math.max(1, Math.floor(L / pitch));
    const picketH = H * 0.9;
    for (let i = 0; i < n; i++) {
      const pk = box(3.5, picketH, 0.75, mat);
      pk.position.set(-L / 2 + ((i + 0.5) * L) / n, -(H - picketH) / 2, th / 2 - 0.4);
      pk.castShadow = true;
      g.add(pk);
    }
    return g;
  };
  // A screened-in patio wall centered at the origin like buildFence: square
  // aluminum posts every ~8 ft bay, top/bottom (and knee-height) rails, and a
  // single translucent mesh plane you can see the yard through.
  const buildScreen = (L: number, H: number): THREE.Group => {
    const g = new THREE.Group();
    const P = 2; // 2" square aluminum tube
    const bays = Math.max(1, Math.round(L / 96));
    for (let i = 0; i <= bays; i++) {
      const post = box(P, H, P, screenFrameMat);
      post.position.set(-L / 2 + (L * i) / bays, 0, 0);
      post.castShadow = true;
      g.add(post);
    }
    const railYs = [H / 2 - P / 2, -H / 2 + P / 2];
    if (H > 54) railYs.push(-H / 2 + 36); // knee rail on full-height walls
    for (const ry of railYs) {
      const rail = box(L, P, P, screenFrameMat);
      rail.position.set(0, ry, 0);
      g.add(rail);
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(L, H - P * 2), screenMeshMat);
    mesh.position.set(0, 0, 0);
    g.add(mesh);
    return g;
  };
  // window / door materials (built once, disposed with the scene)
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xeeece6, roughness: 0.65, metalness: 0.05 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xbcd4e6, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.4, transmission: 0.5, clearcoat: 0.6 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xe6ded0, roughness: 0.7 });

  /**
   * A framed window, a hinged door or a sliding patio door, built in local
   * coords with its sill at y=0.
   *
   * Doors and sliders render as real product models, stretched to the opening
   * the user drew. A slider picks its model by width — a wide opening is a
   * 4-panel unit, a narrow one a 2-panel (see sliderModelKey). Models are
   * lazy-loaded, so until one arrives (or if it fails) the procedural
   * frame+panel below still draws.
   */
  const buildOpening = (o: { kind: OpeningKind; w: number; h: number }): THREE.Group => {
    const g2 = new THREE.Group();
    const { w, h } = o;
    const FT = 1.6; // frame face width
    const FD = 2.2; // frame depth (out from wall)
    const zc = 0.3; // proud of the room-facing wall surface

    if (o.kind === 'door' || o.kind === 'slider') {
      const key = o.kind === 'slider' ? sliderModelKey(w) : 'door-modern';
      requestModel(key);
      if (hasModel(key)) {
        // The unit fills the drawn opening exactly: these are sold in stock
        // sizes, but the design's opening is what the wall was framed for.
        const unit = fitModelBox(key, w, h, FD + 1.4);
        if (unit) {
          unit.position.set(0, 0, zc);
          g2.add(unit);
          return g2;
        }
      }
    }

    const addFrame = (bw: number, bh: number, x: number, y: number) => {
      const m = box(bw, bh, FD, frameMat);
      m.position.set(x, y, zc);
      g2.add(m);
    };
    addFrame(w, FT, 0, h - FT / 2); // head
    addFrame(w, FT, 0, FT / 2); // sill
    addFrame(FT, h, -w / 2 + FT / 2, h / 2); // left jamb
    addFrame(FT, h, w / 2 - FT / 2, h / 2); // right jamb
    const iw = w - FT * 2, ih = h - FT * 2;
    if (o.kind === 'window') {
      // a single clean glass pane in the frame — no mullions
      const glass = box(iw, ih, 0.3, glassMat);
      glass.position.set(0, h / 2, zc);
      g2.add(glass);
    } else if (o.kind === 'slider') {
      // glazed panels split by a meeting stile, matching the real unit
      const panes = w >= SLIDER_4PANEL_MIN_W ? 4 : 2;
      const pw = iw / panes;
      for (let i = 0; i < panes; i++) {
        const x = -iw / 2 + pw * (i + 0.5);
        const glass = box(pw - 1.2, ih - 1.2, 0.3, glassMat);
        glass.position.set(x, h / 2, zc);
        g2.add(glass);
        if (i > 0) {
          const stile = box(1.2, ih, FD * 0.8, frameMat);
          stile.position.set(-iw / 2 + pw * i, h / 2, zc);
          g2.add(stile);
        }
      }
    } else {
      const panel = box(iw, ih, 1.0, doorMat);
      panel.position.set(0, h / 2, zc);
      g2.add(panel);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 12), mats.steel);
      knob.position.set(w / 2 - FT - 1.6, h * 0.45, zc + 0.8);
      g2.add(knob);
    }
    return g2;
  };

  const frames = design.walls.map(frameForWall);

  for (const f of frames) {
    const dir = new THREE.Vector3(f.dx, 0, f.dy);
    const nrm = new THREE.Vector3(f.nx, 0, f.ny);
    const origin = new THREE.Vector3(f.ox, 0, f.oy);
    const yaw = Math.atan2(-f.dy, f.dx);

    const place = (mesh: THREE.Object3D, along: number, out: number, y: number) => {
      mesh.position.copy(origin).addScaledVector(dir, along).addScaledVector(nrm, out);
      mesh.position.y = y;
      mesh.rotation.y = yaw;
      group.add(mesh);
    };

    if (!f.wall.ghost) {
      const th = f.wall.thickness ?? 5;
      const wallStyle = wallStyleOf(f.wall);
      // EVERY opening punches a REAL hole through the wall — a door, slider or
      // window shouldn't show the painted wall through its glass (the unit's
      // frame covers the cut edges), and cutouts are pass-throughs by nature.
      // Walls with openings are built as an extruded outline-with-holes.
      const cutouts = design.openings.filter((o) => o.wallId === f.wall.id);
      const wallGeoWithHoles = (): THREE.ExtrudeGeometry => {
        const L = f.wall.length;
        const H = f.wall.height;
        const s = new THREE.Shape();
        s.moveTo(0, 0);
        s.lineTo(L, 0);
        s.lineTo(L, H);
        s.lineTo(0, H);
        s.closePath();
        for (const o of cutouts) {
          const hw = Math.min(o.w, L - 2) / 2;
          const cx = Math.min(Math.max(o.x, hw + 0.5), L - hw - 0.5);
          const y0 = Math.max(o.y, 0);
          const y1 = Math.min(y0 + o.h, H - 0.5);
          if (y1 - y0 < 1) continue;
          const p = new THREE.Path();
          p.moveTo(cx - hw, y0);
          p.lineTo(cx + hw, y0);
          p.lineTo(cx + hw, y1);
          p.lineTo(cx - hw, y1);
          p.closePath();
          s.holes.push(p);
        }
        const geo = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false });
        geo.translate(0, 0, -th); // wall body sits behind the room-facing plane
        return geo;
      };
      if (wallStyle === 'fence' || wallStyle === 'white-fence') {
        place(buildFence(f.wall.length, f.wall.height, th, wallStyle === 'white-fence' ? whiteFenceMat : fenceMat), f.wall.length / 2, -th / 2, f.wall.height / 2);
      } else if (wallStyle === 'screen') {
        place(buildScreen(f.wall.length, f.wall.height), f.wall.length / 2, -th / 2, f.wall.height / 2);
      } else if (cutouts.length) {
        const mat = wallStyle !== 'standard' ? styledWallMat(wallStyle, f.wall.length, f.wall.height) : wallMatFor(f.wall);
        if (wallStyle !== 'standard' && mat.map) mat.map.repeat.set(1 / 48, 1 / 48); // extrude UVs are in inches
        const wallMesh = new THREE.Mesh(wallGeoWithHoles(), mat);
        wallMesh.castShadow = false;
        wallMesh.receiveShadow = true;
        place(wallMesh, 0, 0, 0);
      } else if (wallStyle !== 'standard') {
        const wallMesh = box(f.wall.length, f.wall.height, th, styledWallMat(wallStyle, f.wall.length, f.wall.height));
        wallMesh.castShadow = false;
        place(wallMesh, f.wall.length / 2, -th / 2, f.wall.height / 2);
      } else {
        const wallMesh = box(f.wall.length, f.wall.height, th, wallMatFor(f.wall));
        wallMesh.castShadow = false;
        place(wallMesh, f.wall.length / 2, -th / 2, f.wall.height / 2);
      }
    }

    const wallItems = design.items.filter((it) => it.wallId === f.wall.id);
    const floorItems = laneItems(wallItems, f.wall.id, 'floor');

    // A real toe kick is ONE continuous strip along the run, sitting on the
    // shallowest cabinet's line — deep fridges and grill cabinets included.
    // Every member of a contiguous run gets the run's plane; coplanar faces
    // in the same finish read as a single piece.
    const kickPlanes = new Map<string, number>();
    {
      const chain: PlacedItem[] = [];
      const flush = () => {
        const real = chain.filter((o) => catalogById(o.catalogId).front !== 'filler');
        if (real.length > 1) {
          const plane = Math.min(...real.map((o) => o.d + o.outset)) - 2;
          for (const o of chain) kickPlanes.set(o.id, plane - o.outset);
        }
        chain.length = 0;
      };
      const kickable = floorItems
        .filter((o) => {
          const oc = catalogById(o.catalogId);
          // hidden cabinets face backward - their kick lives on the back
          // plane, not the run's front band
          return oc.category !== 'appliance' && oc.front !== 'corner' && oc.front !== 'susan' && !oc.barHeight && !oc.hidden;
        })
        .sort((a, b) => a.x - b.x);
      for (const o of kickable) {
        const prev = chain[chain.length - 1];
        if (prev && o.x - (prev.x + footprintW(prev)) > 0.5) flush();
        chain.push(o);
      }
      flush();
    }


    // Owned dead corners: the kick band continues from the corner filler to
    // the wall end, closing the open void under the corner (the counter above
    // it is already extended by the corner fill). It runs on the RUN's kick
    // plane (not the neighbor's own depth) so it stays coplanar with the
    // band, and the two walls split the square the way the counters do: the
    // owning wall ('full') carries its band all the way in, the other wall's
    // band stops flush at the owner's kick line so nothing pokes past it.
    for (const cEnd of ['start', 'end'] as const) {
      const cf = wallItems.find((i) => i.id === `cf-${f.wall.id}-${cEnd}`);
      if (!cf) continue;
      const nb = floorItems.find(
        (i) => !i.auto && !catalogById(i.catalogId).hidden && Math.abs(cEnd === 'start' ? i.x - (cf.x + cf.w) : cf.x - (i.x + footprintW(i))) < 1
      );
      const kPlane = nb ? (kickPlanes.get(nb.id) ?? nb.d - 2) + nb.outset : cf.d + cf.outset - 2;
      const kd = Math.max(1, kPlane - 0.75);
      const x1 = cEnd === 'start' ? 0 : cf.x + cf.w;
      const x2 = cEnd === 'start' ? cf.x : f.wall.length;
      if (x2 - x1 < 0.25) continue;
      // Both walls of a corner draw their full strip: in a shared inside
      // corner the overlap sits entirely inside the enclosed dead void, and
      // on wrap-around corners (island heading away from the kitchen) the
      // two zones are disjoint and each genuinely needs its own. The tiny
      // per-wall height offset keeps the coincident top faces in the shared
      // case from z-fighting. A hidden cabinet living in the reserve carves
      // its span out - its own reversed body (and kick) stands there.
      let stripSegs = [[x1, x2]] as Array<[number, number]>;
      for (const o of floorItems) {
        if (!catalogById(o.catalogId).hidden) continue;
        const ha = o.x;
        const hb = o.x + footprintW(o);
        stripSegs = stripSegs.flatMap(([sa, sb]) => {
          const out: Array<[number, number]> = [];
          if (ha > sa) out.push([sa, Math.min(ha, sb)]);
          if (hb < sb) out.push([Math.max(hb, sa), sb]);
          return out;
        });
      }
      for (const [sa, sb] of stripSegs) {
        if (sb - sa < 0.25) continue;
        const km = box(sb - sa, TOEKICK_H - 0.05, kd, mats.kick);
        km.castShadow = km.receiveShadow = true;
        place(km, (sa + sb) / 2, 0.75 + kd / 2, (TOEKICK_H - 0.05) / 2 - design.walls.indexOf(f.wall) * 0.013);
      }
    }

    for (const it of wallItems) {
      const cat = catalogById(it.catalogId);
      // Orientation a lazy susan keeps in its corner is set by which wall end it
      // sits at — not by the hinge field, which only chooses the handle door.
      const geomSide: 1 | -1 = it.x + footprintW(it) / 2 > f.wall.length / 2 ? -1 : 1;
      const applianceH = cat.applianceCat ? selectedApplianceHeight(it.appliance, appliances) : undefined;
      // brand-accurate 3D head for the selected grill/griddle appliance
      const mref =
        cat.applianceCat === 'grill' || cat.applianceCat === 'griddle'
          ? appliance3dModel(it.appliance, appliances)
          : cat.front === 'hood'
            ? { key: 'hood', w: it.w }
            : null;
      // Hidden cabinets carry their own pull ('tab' built-in default, or a
      // specific inventory handle) instead of the job handle, and a mirrored
      // hinge so the editor's choice matches what you see from the back.
      const ownHandle = it.handleId && it.handleId !== 'tab' ? useStore.getState().handles.find((h) => h.id === it.handleId) : undefined;
      const itemHandleModel = it.handleId
        ? it.handleId === 'tab'
          ? null
          : ownHandle?.model && ownHandle.model !== 'bar'
            ? ownHandle.model
            : namedHandleKey(ownHandle?.name)
        : handleModel;
      const cab = buildCabinetLocal(
        cat,
        { w: it.w, d: it.d, h: it.h, hinge: cat.hidden ? (it.hinge === 'left' ? 'right' : 'left') : it.hinge, style: design.doorStyle, endL: cat.hidden ? false : it.endL, endR: cat.hidden ? false : it.endR, finL: it.finL, finR: it.finR, backPanel: false, cornerSide: cat.front === 'susan' || cat.front === 'corner' ? geomSide : undefined, applianceH, counterT: cT, modelKey: mref?.key, modelW: mref?.w, modelAlign: mref?.key ? modelAligns[mref.key] : undefined, handleModel: itemHandleModel, handleTab: it.handleId === 'tab', topRowH: it.topRowH, kickFrontZ: cat.hidden ? undefined : kickPlanes.get(it.id) },
        matsFor(resolveItemFinish(fin.id, it, cat))
      );
      const exL = cat.category !== 'appliance' && !cat.hidden && it.endL ? 0.75 : 0;
      if (cat.hidden) {
        // Reversed mount: rotate the box 180 degrees and slide it so the door
        // faces land exactly on the finished back plane (panels sit
        // END_PANEL_T out from the wall line; door slabs end flush at the
        // nominal depth).
        cab.position.copy(origin).addScaledVector(dir, it.x + it.w / 2).addScaledVector(nrm, it.d - END_PANEL_T);
        cab.position.y = it.mount;
        cab.rotation.y = yaw + Math.PI;
      } else {
        cab.position.copy(origin).addScaledVector(dir, it.x + exL + it.w / 2).addScaledVector(nrm, it.outset);
        cab.position.y = it.mount;
        cab.rotation.y = yaw;
      }
      group.add(cab);

      // Connecting bar riser: a fridge flush between two bar-height cabinets
      // gets the raised bar back bridged across it — carcass column, finished
      // back on the seating side, and the stone bar top + step splash running
      // continuously with the flanking bars.
      const rs = barRiserFor(design, it);
      if (rs) {
        const rmats = matsFor(resolveItemFinish(fin.id, it, cat));
        const rw = footprintW(it);
        const rcx = it.x + rw / 2;
        const stone = (bd: number) => {
          const m = rmats.counter.clone();
          m.map = rmats.counterTex.clone();
          m.map.repeat.set(Math.max(1, rw / mats.counterTile), Math.max(1, bd / mats.counterTile));
          return m;
        };
        const topY = rs.topH + BAR_RISE;
        const colH = topY - TOEKICK_H;
        const rbody = box(rw, colH, BAR_DEPTH - 0.1, rmats.carcass);
        rbody.castShadow = rbody.receiveShadow = true;
        place(rbody, rcx, 0.1 + (BAR_DEPTH - 0.1) / 2, TOEKICK_H + colH / 2);
        // finished back panel on the seating side (like island back panels)
        const bp = box(rw, colH, END_PANEL_T, rmats.panel);
        bp.castShadow = bp.receiveShadow = true;
        place(bp, rcx, -END_PANEL_T / 2, TOEKICK_H + colH / 2);
        // granite step splash on the working side, matching the flanking bars
        const splash = box(rw, BAR_RISE, 0.75, stone(0.75));
        splash.castShadow = splash.receiveShadow = true;
        place(splash, rcx, BAR_DEPTH + 0.375, rs.topH + cT + BAR_RISE / 2);
        // stone bar top with the seating overhang, continuous with the bars
        const barD = BAR_OVERHANG + BAR_DEPTH + BAR_NOSE;
        const barStone = box(rw, cT, barD, stone(barD));
        barStone.castShadow = barStone.receiveShadow = true;
        place(barStone, rcx, BAR_DEPTH + BAR_NOSE - barD / 2, topY + cT / 2);
      }

      // corner / susan cabinets get a shaped countertop matching their top
      if ((cat.front === 'corner' || cat.front === 'susan') && cat.counter) {
        const side: 1 | -1 = geomSide;
        const slabMat = mats.counter.clone();
        slabMat.map = mats.counterTex.clone();
        const ct = cat.front === 'corner' ? cornerCounter(it.w, it.d, side, slabMat, cT, it.h) : susanCounter(it.w, it.d, side, slabMat, cT, it.h);
        ct.position.copy(origin).addScaledVector(dir, it.x + it.w / 2).addScaledVector(nrm, it.outset);
        ct.position.y = it.mount;
        ct.rotation.y = yaw;
        group.add(ct);
      }

      // waterfall edges — counter material wrapping down a run-end to the floor.
      // Corner cabinets aren't simple boxes, so the waterfall mirrors each type's
      // exposed edges (same geometry as their applied ends): the diagonal corner's
      // two straight sides (one full, one cut short by the chamfer), and the lazy
      // susan's two leg tips (one a side, one facing forward along the next wall).
      if (cat.counter && cat.lane === 'floor' && (it.waterfallL || it.waterfallR)) {
        const wfH = it.h + cT;
        const O = COUNTER_OVERHANG;
        const fpw = footprintW(it);
        const wfMat = () => {
          const m = mats.counter.clone();
          m.map = mats.counterTex.clone();
          return m;
        };
        // Top of an immediately-adjacent floor cabinet on a given side (its
        // counter surface), or 0 (floor) if nothing abuts. A waterfall stops
        // here instead of running to the floor past a neighbour.
        const neighborTop = (side: 'L' | 'R'): number => {
          const edge = side === 'L' ? it.x : it.x + fpw;
          let top = 0;
          for (const o of floorItems) {
            if (o.id === it.id) continue;
            const oEdge = side === 'L' ? o.x + footprintW(o) : o.x;
            if (Math.abs(oEdge - edge) < 0.75) {
              const oc = catalogById(o.catalogId);
              top = Math.max(top, o.h + (oc.counter ? cT : 0));
            }
          }
          return top;
        };
        // a side waterfall: thin along the wall, running `depth` into the room.
        // `bottom` lifts the slab's foot to a neighbour's top so it stops there.
        // backZ extends the slab BEHIND the wall line — the island seating
        // overhang — so the waterfall wraps the full counter depth.
        const sideSlab = (along: number, depth: number, bottom = 0, backZ = 0) => {
          const h = wfH - bottom;
          if (h <= 0.05) return; // fully hidden behind a taller neighbour
          place(box(cT, h, depth + backZ, wfMat()), along, (depth - backZ) / 2, bottom + h / 2);
        };
        // a forward-facing waterfall at the cabinet front (thin in depth)
        const frontSlab = (along: number, widthX: number) => place(box(widthX, wfH, cT, wfMat()), along, it.d + O, wfH / 2);
        if (cat.front === 'susan') {
          const legD = CORNER_RETURN;
          const legAtipLeft = geomSide === -1; // own-wall leg tip is left vs right
          if (legAtipLeft ? it.waterfallL : it.waterfallR) sideSlab(legAtipLeft ? it.x - cT / 2 : it.x + fpw + cT / 2, legD + O, neighborTop(legAtipLeft ? 'L' : 'R'));
          if (legAtipLeft ? it.waterfallR : it.waterfallL) frontSlab(it.x + (geomSide === -1 ? fpw - legD / 2 : legD / 2), legD);
        } else if (cat.front === 'corner') {
          // Match the applied-end logic: the two exposed faces are the short
          // side beside the door and the straight front return. The full deep
          // side opposite the chamfer is the back (against the wall) — no
          // waterfall there. Orientation follows placement (geomSide), not hinge.
          const c = cornerChamfer(it.d);
          const partial = it.d - c + O; // the chamfered (short) exposed side
          const fwid = it.w - c; // straight front-return width
          const chamferOnRight = geomSide === 1;
          if (chamferOnRight) {
            // right side short+exposed; front return on the left-front
            if (it.waterfallR) sideSlab(it.x + fpw + cT / 2, partial, neighborTop('R'));
            if (it.waterfallL) frontSlab(it.x + fwid / 2, fwid);
          } else {
            // left side short+exposed; front return on the right-front
            if (it.waterfallL) sideSlab(it.x - cT / 2, partial, neighborTop('L'));
            if (it.waterfallR) frontSlab(it.x + fpw - fwid / 2, fwid);
          }
        } else {
          // seating-overhang islands: the waterfall runs under the overhang too
          const wfBack = f.wall.ghost && f.wall.seatingOverhang && !cat.barHeight ? (it.d + it.outset) / 2 : 0;
          if (it.waterfallL) sideSlab(it.x - cT / 2, it.d + O, neighborTop('L'), wfBack);
          if (it.waterfallR) sideSlab(it.x + fpw + cT / 2, it.d + O, neighborTop('R'), wfBack);
        }
      }
    }

    // Island finished backs — built across the whole RUN (not per cabinet) so
    // the routed design lands in evenly sized, evenly spaced panels along the
    // entire back. Contiguous cabinets of the same back height form one group;
    // the group's width splits into equal panels of MAX_PANEL_W max.
    if (f.wall.ghost) {
      const RUN_GAP = 0.125;
      type BackGroup = { x1: number; x2: number; topY: number };
      const groups: BackGroup[] = [];
      const sortedBack = [...floorItems].sort((a, b) => a.x - b.x);
      const paneled = (idx: number): number | null => {
        const o = sortedBack[idx];
        if (!o) return null;
        const oc = catalogById(o.catalogId);
        if (!takesAppliedEnds(oc) || oc.lane !== 'floor') return null;
        // Hidden cabinets' doors ARE the back where they stand.
        if (oc.hidden) return null;
        return o.h + (oc.barHeight ? BAR_RISE : 0);
      };
      for (let i = 0; i < sortedBack.length; i++) {
        const it = sortedBack[i];
        const c = catalogById(it.catalogId);
        if (c.lane !== 'floor') continue;
        let topY = paneled(i);
        // A fridge/ice-maker opening flush between two paneled cabinets of the
        // same back height gets the finished back bridged across it — matching
        // the bar-riser behaviour (which covers the bar-height case itself).
        if (topY == null && (c.applianceCat === 'fridge' || c.applianceCat === 'icemaker') && !barRiserFor(design, it)) {
          const lTop = paneled(i - 1);
          const rTop = paneled(i + 1);
          const prevIt = sortedBack[i - 1];
          const nextIt = sortedBack[i + 1];
          const flushL = prevIt && Math.abs(prevIt.x + footprintW(prevIt) - it.x) < 0.75;
          const flushR = nextIt && Math.abs(nextIt.x - (it.x + footprintW(it))) < 0.75;
          if (lTop != null && rTop != null && flushL && flushR && Math.abs(lTop - rTop) < 0.01) topY = lTop;
        }
        if (topY == null) continue;
        const x1 = it.x;
        const x2 = it.x + footprintW(it);
        const last = groups[groups.length - 1];
        if (last && x1 <= last.x2 + 0.75 && Math.abs(last.topY - topY) < 0.01) last.x2 = Math.max(last.x2, x2);
        else groups.push({ x1, x2, topY });
      }
      // A dead corner on an island closes from behind automatically: the
      // finished back runs to the wall end across the corner reserve, without
      // needing the full-length back switch. Guarded to the corner reserve so
      // a back never grows over an intentionally open stretch of wall.
      {
        const wrB = reservesFor(design).get(f.wall.id) ?? { start: 0, end: 0 };
        const firstG = groups[0];
        if (firstG && wrB.start > 0 && firstG.x1 <= wrB.start + 2) firstG.x1 = 0;
        const lastG = groups[groups.length - 1];
        if (lastG && wrB.end > 0 && lastG.x2 >= f.wall.length - wrB.end - 2) lastG.x2 = f.wall.length;
      }
      // Hidden cabinets face their doors out the back: the finished back
      // panels (dead-corner extensions and full-length backs included) part
      // around their spans - the doors are the finish there.
      {
        const hiddenSpans = floorItems
          .filter((o) => catalogById(o.catalogId).hidden)
          .map((o) => [o.x, o.x + footprintW(o)] as [number, number]);
        if (hiddenSpans.length) {
          const cut: BackGroup[] = [];
          for (const g of groups) {
            let segs = [[g.x1, g.x2]] as Array<[number, number]>;
            for (const [ha, hb] of hiddenSpans) {
              segs = segs.flatMap(([sa, sb]) => {
                const out: Array<[number, number]> = [];
                if (ha > sa) out.push([sa, Math.min(ha, sb)]);
                if (hb < sb) out.push([Math.max(hb, sa), sb]);
                return out;
              });
            }
            for (const [sa, sb] of segs) if (sb - sa > 0.6) cut.push({ x1: sa, x2: sb, topY: g.topY });
          }
          groups.length = 0;
          groups.push(...cut);
        }
      }
      // The base band follows the back: any stretch of a back group with no
      // cabinet or filler kick under it (a full-length back, the dead-corner
      // extension) gets its own kick strip, so the panel never floats on air.
      // Shallow (2") on purpose: from behind it reads as the same continuous
      // reveal line; from the front an open full-back stretch shows a tidy
      // plinth instead of a 22"-deep slab.
      {
        const kicked = floorItems
          .filter((o) => {
            const oc = catalogById(o.catalogId);
            return oc.category !== 'appliance' && oc.front !== 'corner' && oc.front !== 'susan';
          })
          .map((o) => [o.x, o.x + footprintW(o)] as [number, number])
          .sort((a, b) => a[0] - b[0]);
        for (const grp of groups) {
          let cur = grp.x1;
          const bare: Array<[number, number]> = [];
          for (const [a, b] of kicked) {
            if (b <= cur) continue;
            if (a >= grp.x2) break;
            if (a > cur) bare.push([cur, Math.min(a, grp.x2)]);
            cur = Math.max(cur, b);
            if (cur >= grp.x2) break;
          }
          if (cur < grp.x2) bare.push([cur, grp.x2]);
          for (const [a, b] of bare) {
            if (b - a < 0.5) continue;
            const km = box(b - a, TOEKICK_H, 2, mats.kick);
            km.castShadow = km.receiveShadow = true;
            place(km, a + (b - a) / 2, 0.75 + 1, TOEKICK_H / 2);
          }
        }
      }
      for (const grp of groups) {
        const W = grp.x2 - grp.x1;
        if (W < 2) continue;
        const colH = Math.max(1, grp.topY - TOEKICK_H);
        const n = Math.max(1, Math.ceil(W / MAX_PANEL_W));
        const panelW = (W - RUN_GAP * (n - 1)) / n;
        for (let i = 0; i < n; i++) {
          const inner = new THREE.Group();
          inner.add(box(panelW, colH, END_PANEL_T, mats.panel));
          inner.add(facePattern(panelW, colH, design.doorStyle, END_PANEL_T / 2, mats));
          inner.rotation.y = Math.PI; // design faces out the back (-z)
          const wrap = new THREE.Group();
          wrap.add(inner);
          place(wrap, grp.x1 + panelW / 2 + i * (panelW + RUN_GAP), -END_PANEL_T / 2, TOEKICK_H + colH / 2);
        }
      }
    }

    const wr = reservesFor(design).get(f.wall.id) ?? { start: 0, end: 0 };
    const ext = cornerCounterExtend(f.wall, design.walls, design.items, design.cornerOverrides);
    const runs3d = counterRuns3d(floorItems, true);
    for (let ri = 0; ri < runs3d.length; ri++) {
      const r = runs3d[ri];
      // Overhang only exposed run ends. Where another cabinet abuts (e.g. a
      // shorter neighbour in its own run), keep the counter flush so it doesn't
      // cut over the adjoining cabinet.
      const leftAbut = floorItems.some((o) => Math.abs(o.x + footprintW(o) - r.x1) < 0.75);
      const rightAbut = floorItems.some((o) => Math.abs(o.x - r.x2) < 0.75);
      // At an owned dead corner, run the counter to the wall corner so the dead
      // square is covered (the run that reaches that end is the one extended).
      const fillStart = ext.start && r.x1 <= wr.start + 1;
      const fillEnd = ext.end && r.x2 >= f.wall.length - wr.end - 1;
      // An island's top spans the WHOLE ghost wall, not just the cabinets under
      // it: the invisible wall's length is what defines the counter's length,
      // so lengthening the wall lengthens the top (and its seating overhang)
      // past the boxes. The outermost run on each side reaches the wall end;
      // interior runs (a height change starts a new one) still butt normally.
      // The top covers just the cabinets in the run, overhanging exposed ends
      // by COUNTER_OVERHANG (1") — islands included.
      // A seating overhang also projects past a shared corner point by half a
      // cabinet depth, so a filled corner stopping dead at the wall end leaves
      // a step. Run on by that overhang to close the pair into one L.
      const cornerRunOn = f.wall.ghost && f.wall.seatingOverhang ? r.d / 2 : 0;
      // A corner partner that is an island WITH a seating overhang projects its
      // slab past the shared corner point. The filling slab runs on past the
      // wall end by that overhang so the two outlines meet instead of leaving
      // a notch at the junction.
      const partnerOverRun = (end: 'start' | 'end'): number => {
        const my = wallEndpoints(f.wall);
        const pt = end === 'start' ? my.p0 : my.p1;
        for (const o of design.walls) {
          if (o.id === f.wall.id || !o.ghost || !o.seatingOverhang) continue;
          const oe = wallEndpoints(o);
          const touches =
            Math.hypot(oe.p0.x - pt.x, oe.p0.y - pt.y) <= CORNER_EPS || Math.hypot(oe.p1.x - pt.x, oe.p1.y - pt.y) <= CORNER_EPS;
          if (!touches) continue;
          const ds = design.items
            .filter((i) => {
              const c = catalogById(i.catalogId);
              return i.wallId === o.id && c.lane === 'floor' && c.front !== 'filler' && c.category !== 'appliance';
            })
            .map((i) => i.d + i.outset);
          if (ds.length) return Math.max(...ds) / 2;
        }
        return 0;
      };
      // 'toFiller': stop at the corner filler's start (the owner's face
      // plane) so this slab meets the owner's extended slab edge to edge.
      const cfS = design.items.find((i) => i.id === `cf-${f.wall.id}-start`);
      const cfE = design.items.find((i) => i.id === `cf-${f.wall.id}-end`);
      const x1 = fillStart
        ? ext.start === 'toFiller' && cfS
          ? cfS.x
          : -Math.max(cornerRunOn, partnerOverRun('start'))
        : Math.max(r.x1 - (leftAbut ? 0 : COUNTER_OVERHANG), 0);
      const x2 = fillEnd
        ? ext.end === 'toFiller' && cfE
          ? cfE.x + cfE.w
          : f.wall.length + Math.max(cornerRunOn, partnerOverRun('end'))
        : Math.min(r.x2 + (rightAbut ? 0 : COUNTER_OVERHANG), f.wall.length);
      const slabMat = mats.counter.clone();
      slabMat.map = mats.counterTex.clone();
      slabMat.map.repeat.set(1 / mats.counterTile, 1 / mats.counterTile);
      const runCenter = (x1 + x2) / 2;
      const modelWFor = (it: PlacedItem) => appliance3dModel(it.appliance, appliances)?.w;

      // Cabinets in this run (the corner/susan units carry their own tops).
      const runCabs = floorItems.filter((it) => {
        const cx = it.x + footprintW(it) / 2;
        if (cx < r.x1 - 0.1 || cx > r.x2 + 0.1) return false;
        const c = catalogById(it.catalogId);
        return bridgesCounter(c) && !c.barHeight && c.front !== 'corner' && c.front !== 'susan';
      });
      // Front depth per real cabinet: its own depth + 1" overhang (run-local x).
      // Shallow fillers are excluded so they inherit the neighbouring depth.
      const depthCabs: FrontSeg[] = runCabs
        .filter((it) => catalogById(it.catalogId).front !== 'filler')
        .map((it) => ({ x1: it.x - runCenter, x2: it.x + footprintW(it) - runCenter, z: it.d + it.outset + frontExtraD(catalogById(it.catalogId)) + COUNTER_OVERHANG }))
        .sort((a, b) => a.x1 - b.x1);
      const fallbackZ = r.d + COUNTER_OVERHANG;

      // Drop-in grills/griddles/burners: the counter is cut FULL DEPTH around the
      // liner-jacket opening (a notch), so no stone runs over or behind the liner
      // — it splits the run into separate stone pieces. Sinks (and kamado
      // inserts) stay inner holes the stone frames.
      const cuts: Array<{ x1: number; x2: number }> = [];
      const holes: Array<{ x1: number; x2: number; z1: number; z2: number }> = [];
      for (const it of runCabs) {
        const cat = catalogById(it.catalogId);
        const cx = it.x + footprintW(it) / 2 - runCenter;
        if (isSinkFront(cat.front)) {
          // The basin is drawn in cabinet-local z and the cabinet is placed
          // with its outset — the hole must ride along, or an outset sink
          // (fronts aligned with a deeper grill run) gets stone over the
          // basin front and a bare deck where the faucet stands.
          const cut = sinkBasin(it.w, it.d);
          holes.push({ x1: cx - cut.bw / 2, x2: cx + cut.bw / 2, z1: it.outset + cut.zc - cut.bd / 2, z2: it.outset + cut.zc + cut.bd / 2 });
          continue;
        }
        const cut = grillCutout(cat, it.w, it.d, modelWFor(it));
        if (!cut) continue;
        const front = it.d + it.outset + COUNTER_OVERHANG;
        if (it.outset + cut.zc + cut.bd / 2 >= front - 0.05) cuts.push({ x1: cx - cut.bw / 2, x2: cx + cut.bw / 2 });
        else holes.push({ x1: cx - cut.bw / 2, x2: cx + cut.bw / 2, z1: it.outset + cut.zc - cut.bd / 2, z2: it.outset + cut.zc + cut.bd / 2 });
      }

      // Break the run into stone pieces on either side of each grill/liner cut.
      const L = x1 - runCenter, R = x2 - runCenter;
      cuts.sort((a, b) => a.x1 - b.x1);
      const pieces: Array<{ a: number; b: number }> = [];
      let cursor = L;
      for (const c of cuts) {
        const a = cursor, b = Math.min(Math.max(c.x1, L), R);
        if (b - a > 0.1) pieces.push({ a, b });
        cursor = Math.min(Math.max(c.x2, cursor), R);
      }
      if (R - cursor > 0.1) pieces.push({ a: cursor, b: R });

      for (const pc of pieces) {
        const profile = buildFrontProfile(pc.a, pc.b, depthCabs, fallbackZ);
        const pcHoles = holes.filter((h) => (h.x1 + h.x2) / 2 >= pc.a - 0.01 && (h.x1 + h.x2) / 2 <= pc.b + 0.01);
        // island seating overhang: extend the slab past the back by half
        // the cabinet depth (24″ deep → 12″)
        const backExt = f.wall.ghost && f.wall.seatingOverhang ? r.d / 2 : 0;
        const slab = counterRunSlab(profile, pcHoles, slabMat, cT, r.h, -backExt);
        slab.position.copy(origin).addScaledVector(dir, runCenter);
        slab.position.y = 0;
        slab.rotation.y = yaw;
        group.add(slab);
      }
    }

    // Stone backsplash — vertical slabs of the counter stone up the wall behind
    // the cabinetry, continuous around inside corners. Real walls only (islands
    // have no wall to climb).
    if (bsH > 0 && !f.wall.ghost) {
      const reserve = reserves?.get(f.wall.id) ?? { start: 0, end: 0 };
      for (const s of backsplashSpans(floorItems, f.wall.length, reserve)) {
        const w = s.x2 - s.x1;
        if (w <= 0) continue;
        const bsMat = mats.counter.clone();
        bsMat.map = mats.counterTex.clone();
        bsMat.map.repeat.set(Math.max(1, w / mats.counterTile), Math.max(1, bsH / mats.counterTile));
        const bs = box(w, bsH, BS_THICK, bsMat);
        place(bs, (s.x1 + s.x2) / 2, BS_THICK / 2, BASE_H + cT + bsH / 2);
      }
    }

    // Windows / doors framed on the room-facing wall surface (real walls only).
    if (!f.wall.ghost) {
      for (const o of design.openings.filter((x) => x.wallId === f.wall.id && x.kind !== 'cutout')) {
        place(buildOpening(o), o.x, 0, o.y);
      }
    }
  }

  let pergolaDispose: (() => void) | null = null;
  if (design.pergola) {
    const built = buildPergola(design.pergola);
    built.group.position.set(design.pergola.x, 0, design.pergola.y);
    built.group.rotation.y = (-design.pergola.angle * Math.PI) / 180;
    group.add(built.group);
    pergolaDispose = built.dispose;
  }

  // Patio pad under the kitchen: the walls/cabinets footprint plus a 24"
  // apron. The rest of the yard is lawn (see groundMaterial), so the space
  // reads as a defined patio instead of an endless open plane. Its surface is
  // the design's flooring choice — poured concrete, or a laid paver field.
  const floor = flooringById(design.flooring);
  const floorColor = floor.tex ? libTexture(`${floor.tex}-color.jpg`) : null;
  const floorNormal = floor.tex ? libTexture(`${floor.tex}-normal.jpg`, true) : null;
  const slabMat = new THREE.MeshStandardMaterial({
    color: floorColor ? 0xffffff : new THREE.Color(floor.base),
    roughness: floor.roughness,
  });
  // fences sit on the lawn — they don't stretch the pad
  const slabFrames = frames.filter((f) => !isFenceStyle(f.wall));
  if (slabFrames.length) {
    const sb = planBounds(slabFrames, 24);
    // Pavers tile across the pad's top face at their real size. BoxGeometry
    // UVs run 0..1 per face, so the repeat is a tile count, and only the top
    // face is seen — sizing it to the pad's own footprint keeps the courses
    // square whatever shape the patio is.
    if (floorColor) {
      const t = floor.texScale ?? 48;
      const tile = (tex: THREE.Texture) => {
        const c = tex.clone();
        c.needsUpdate = true;
        c.wrapS = c.wrapT = THREE.RepeatWrapping;
        // Same inches-per-tile on both axes so the pavers stay square. Don't
        // round or clamp to whole tiles: a patio is far shallower than it is
        // wide, and forcing a full tile into the depth squashes the courses
        // into a smear. The scan is seamless, so fractions tile cleanly.
        c.repeat.set(sb.w / t, sb.h / t);
        return c;
      };
      slabMat.map = tile(floorColor);
      if (floorNormal) {
        slabMat.normalMap = tile(floorNormal);
        // pavers are laid with real joints — keep them readable at a distance
        slabMat.normalScale = new THREE.Vector2(1.5, 1.5);
      }
    }
    const slab = new THREE.Mesh(new THREE.BoxGeometry(sb.w, 1.2, sb.h), slabMat);
    // top face sits a hair above the lawn so the pad never z-fights it
    slab.position.set(sb.x + sb.w / 2, -0.55, sb.y + sb.h / 2);
    slab.receiveShadow = true;
    group.add(slab);
  }

  const b = planBounds(frames, 10);
  // A pergola is usually larger than the cabinet run it covers, so the camera
  // has to see it too — framing on the walls alone puts the viewer inside it.
  let bx0 = b.x, by0 = b.y, bx1 = b.x + b.w, by1 = b.y + b.h;
  if (design.pergola) {
    const pg = design.pergola;
    const he = Math.hypot(pg.w, pg.l) / 2; // half-extent at any rotation
    bx0 = Math.min(bx0, pg.x - he);
    by0 = Math.min(by0, pg.y - he);
    bx1 = Math.max(bx1, pg.x + he);
    by1 = Math.max(by1, pg.y + he);
  }
  const center = new THREE.Vector3((bx0 + bx1) / 2, 20, (by0 + by1) / 2);
  const radius = Math.max(bx1 - bx0, by1 - by0) / 2 + 30;
  const dispose = () => {
    pergolaDispose?.();
    slabMat.dispose();
    disposeMats(mats);
    for (const m of matsByFinish.values()) disposeMats(m);
    wallMat.dispose();
    for (const m of coloredWallMats) m.dispose();
    fenceMat.dispose();
    whiteFenceMat.dispose();
    screenFrameMat.dispose();
    screenMeshMat.dispose();
    for (const m of styledWallMats) {
      m.map?.dispose();
      m.dispose();
    }
    frameMat.dispose();
    glassMat.dispose();
    doorMat.dispose();
  };
  return { group, center, radius, dispose };
}
