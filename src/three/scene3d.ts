import * as THREE from 'three';
import { ALL_FINISHES, BAR_DEPTH, BAR_NOSE, BAR_OVERHANG, BAR_RISE, BASE_H, COUNTER_OVERHANG, COUNTER_T, TOEKICK_H, bridgesCounter, catalogById } from '../model/catalog';
import { cornerCounterExtend, frameForWall, planBounds } from '../model/geometry';
import { appliance3dModel, selectedApplianceHeight } from '../model/appliances';
import { countertopById } from '../model/countertops';
import type { ApplianceItem, Design, FinishOption, ModelAligns, PlacedItem, Wall } from '../model/types';
import { resolveItemFinish } from '../model/newage';
import { backsplashSpans, barRiserFor, counterHeightFor, footprintW, laneItems, reservesFor } from '../state/store';
import { CORNER_RETURN, END_PANEL_T, box, buildCabinetLocal, canvasTexture, cornerChamfer, createMats, disposeMats, grillCutout, isSinkFront, sinkBasin } from './cabinet3d';

function counterRuns3d(items: PlacedItem[]): Array<{ x1: number; x2: number; d: number; h: number }> {
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
    const last = runs[runs.length - 1];
    // Merge only with an adjacent cabinet of the same height — a height change
    // starts a new run so the counter steps down to follow each cabinet.
    if (last && it.x <= last.x2 + 0.2 && Math.abs(last.h - h) < 0.01) {
      last.x2 = Math.max(last.x2, it.x + footprintW(it));
      last.d = Math.max(last.d, it.d + it.outset);
    } else runs.push({ x1: it.x, x2: it.x + footprintW(it), d: it.d + it.outset, h });
  }
  return runs;
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
  restH: number = BASE_H
): THREE.Mesh {
  const xL = segs[0].x1;
  const s = new THREE.Shape();
  s.moveTo(xL, 0);
  s.lineTo(segs[segs.length - 1].x2, 0); // back edge (wall)
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
  const cT = design.counterThickness ?? COUNTER_T;
  const bsH = design.backsplashHeight ?? 0; // stone backsplash height up the wall (0 = none)
  const BS_THICK = 0.75; // backsplash slab thickness off the wall
  const reserves = bsH > 0 ? reservesFor(design) : null; // corner zones for backsplash spans
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1eee7, roughness: 0.92 });
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x9c7a4d, roughness: 0.85 });
  // A picket fence centered at the origin (x=length, y=height, z=thickness), so it
  // drops into the same place() call the solid wall box uses.
  const buildFence = (L: number, H: number, th: number): THREE.Group => {
    const g = new THREE.Group();
    const postW = Math.min(3.5, Math.max(2, th));
    const posts = Math.max(2, Math.round(L / 72) + 1);
    for (let i = 0; i < posts; i++) {
      const post = box(postW, H, postW, fenceMat);
      post.position.set(-L / 2 + (L * i) / (posts - 1), 0, 0);
      post.castShadow = true;
      g.add(post);
    }
    for (const ry of [H * 0.32, -H * 0.32]) {
      const rail = box(L, 3.5, 1.0, fenceMat);
      rail.position.set(0, ry, 0);
      g.add(rail);
    }
    const pitch = 5.5; // picket + gap
    const n = Math.max(1, Math.floor(L / pitch));
    const picketH = H * 0.9;
    for (let i = 0; i < n; i++) {
      const pk = box(3.5, picketH, 0.75, fenceMat);
      pk.position.set(-L / 2 + ((i + 0.5) * L) / n, -(H - picketH) / 2, th / 2 - 0.4);
      pk.castShadow = true;
      g.add(pk);
    }
    return g;
  };
  // window / door materials (built once, disposed with the scene)
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xeeece6, roughness: 0.65, metalness: 0.05 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xbcd4e6, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.4, transmission: 0.5, clearcoat: 0.6 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xe6ded0, roughness: 0.7 });

  /** A framed window (frame+glass+mullions) or door (frame+panel+knob), built
   *  in local coords with its sill at y=0. */
  const buildOpening = (o: { kind: 'window' | 'door'; w: number; h: number }): THREE.Group => {
    const g2 = new THREE.Group();
    const { w, h } = o;
    const FT = 1.6; // frame face width
    const FD = 2.2; // frame depth (out from wall)
    const zc = 0.3; // proud of the room-facing wall surface
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
      if (f.wall.fence) {
        place(buildFence(f.wall.length, f.wall.height, th), f.wall.length / 2, -th / 2, f.wall.height / 2);
      } else {
        const wallMesh = box(f.wall.length, f.wall.height, th, wallMat);
        wallMesh.castShadow = false;
        place(wallMesh, f.wall.length / 2, -th / 2, f.wall.height / 2);
      }
    }

    const wallItems = design.items.filter((it) => it.wallId === f.wall.id);
    const floorItems = laneItems(wallItems, f.wall.id, 'floor');

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
      const cab = buildCabinetLocal(
        cat,
        { w: it.w, d: it.d, h: it.h, hinge: it.hinge, style: design.doorStyle, endL: it.endL, endR: it.endR, finL: it.finL, finR: it.finR, backPanel: f.wall.ghost, cornerSide: cat.front === 'susan' || cat.front === 'corner' ? geomSide : undefined, applianceH, counterT: cT, modelKey: mref?.key, modelW: mref?.w, modelAlign: mref?.key ? modelAligns[mref.key] : undefined },
        matsFor(resolveItemFinish(fin.id, it, cat))
      );
      const exL = cat.category !== 'appliance' && it.endL ? 0.75 : 0;
      cab.position.copy(origin).addScaledVector(dir, it.x + exL + it.w / 2).addScaledVector(nrm, it.outset);
      cab.position.y = it.mount;
      cab.rotation.y = yaw;
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
          m.map.repeat.set(Math.max(1, rw / 48), Math.max(1, bd / 48));
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
        const sideSlab = (along: number, depth: number, bottom = 0) => {
          const h = wfH - bottom;
          if (h <= 0.05) return; // fully hidden behind a taller neighbour
          place(box(cT, h, depth, wfMat()), along, depth / 2, bottom + h / 2);
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
          if (it.waterfallL) sideSlab(it.x - cT / 2, it.d + O, neighborTop('L'));
          if (it.waterfallR) sideSlab(it.x + fpw + cT / 2, it.d + O, neighborTop('R'));
        }
      }
    }

    const wr = reservesFor(design).get(f.wall.id) ?? { start: 0, end: 0 };
    const ext = cornerCounterExtend(f.wall, design.walls, design.items, design.cornerOverrides);
    for (const r of counterRuns3d(floorItems)) {
      // Overhang only exposed run ends. Where another cabinet abuts (e.g. a
      // shorter neighbour in its own run), keep the counter flush so it doesn't
      // cut over the adjoining cabinet.
      const leftAbut = floorItems.some((o) => Math.abs(o.x + footprintW(o) - r.x1) < 0.75);
      const rightAbut = floorItems.some((o) => Math.abs(o.x - r.x2) < 0.75);
      // At an owned dead corner, run the counter to the wall corner so the dead
      // square is covered (the run that reaches that end is the one extended).
      const fillStart = ext.start && r.x1 <= wr.start + 1;
      const fillEnd = ext.end && r.x2 >= f.wall.length - wr.end - 1;
      const x1 = fillStart ? 0 : Math.max(r.x1 - (leftAbut ? 0 : COUNTER_OVERHANG), 0);
      const x2 = fillEnd ? f.wall.length : Math.min(r.x2 + (rightAbut ? 0 : COUNTER_OVERHANG), f.wall.length);
      const slabMat = mats.counter.clone();
      slabMat.map = mats.counterTex.clone();
      slabMat.map.repeat.set(1 / 48, 1 / 48);
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
        .map((it) => ({ x1: it.x - runCenter, x2: it.x + footprintW(it) - runCenter, z: it.d + it.outset + COUNTER_OVERHANG }))
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
          const cut = sinkBasin(it.w, it.d);
          holes.push({ x1: cx - cut.bw / 2, x2: cx + cut.bw / 2, z1: cut.zc - cut.bd / 2, z2: cut.zc + cut.bd / 2 });
          continue;
        }
        const cut = grillCutout(cat, it.w, it.d, modelWFor(it));
        if (!cut) continue;
        const front = it.d + it.outset + COUNTER_OVERHANG;
        if (cut.zc + cut.bd / 2 >= front - 0.05) cuts.push({ x1: cx - cut.bw / 2, x2: cx + cut.bw / 2 });
        else holes.push({ x1: cx - cut.bw / 2, x2: cx + cut.bw / 2, z1: cut.zc - cut.bd / 2, z2: cut.zc + cut.bd / 2 });
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
        const slab = counterRunSlab(profile, pcHoles, slabMat, cT, r.h);
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
        bsMat.map.repeat.set(Math.max(1, w / 48), Math.max(1, bsH / 48));
        const bs = box(w, bsH, BS_THICK, bsMat);
        place(bs, (s.x1 + s.x2) / 2, BS_THICK / 2, BASE_H + cT + bsH / 2);
      }
    }

    // Windows / doors framed on the room-facing wall surface (real walls only).
    if (!f.wall.ghost) {
      for (const o of design.openings.filter((x) => x.wallId === f.wall.id)) {
        place(buildOpening(o), o.x, 0, o.y);
      }
    }
  }

  // Concrete patio pad under the kitchen: the walls/cabinets footprint plus a
  // 24" apron. The rest of the yard is lawn (see groundTexture), so the space
  // reads as a defined patio instead of an endless open plane.
  const slabMat = new THREE.MeshStandardMaterial({ color: 0xd8d6cf, roughness: 0.95 });
  // fences sit on the lawn — they don't stretch the pad
  const slabFrames = frames.filter((f) => !f.wall.fence);
  if (slabFrames.length) {
    const sb = planBounds(slabFrames, 24);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(sb.w, 1.2, sb.h), slabMat);
    // top face sits a hair above the lawn so the pad never z-fights it
    slab.position.set(sb.x + sb.w / 2, -0.55, sb.y + sb.h / 2);
    slab.receiveShadow = true;
    group.add(slab);
  }

  const b = planBounds(frames, 10);
  const center = new THREE.Vector3(b.x + b.w / 2, 20, b.y + b.h / 2);
  const radius = Math.max(b.w, b.h) / 2 + 30;
  const dispose = () => {
    slabMat.dispose();
    disposeMats(mats);
    for (const m of matsByFinish.values()) disposeMats(m);
    wallMat.dispose();
    fenceMat.dispose();
    frameMat.dispose();
    glassMat.dispose();
    doorMat.dispose();
  };
  return { group, center, radius, dispose };
}
