import * as THREE from 'three';
import { BASE_H, COUNTER_OVERHANG, COUNTER_T, catalogById } from '../model/catalog';
import { frameForWall, planBounds } from '../model/geometry';
import { selectedApplianceHeight } from '../model/appliances';
import { countertopById } from '../model/countertops';
import type { ApplianceItem, Design, FinishOption, PlacedItem } from '../model/types';
import { backsplashSpans, footprintW, laneItems, reservesFor } from '../state/store';
import { CORNER_RETURN, box, buildCabinetLocal, canvasTexture, cornerChamfer, createMats, disposeMats, isSinkFront, sinkBasin } from './cabinet3d';

function counterRuns3d(items: PlacedItem[]): Array<{ x1: number; x2: number; d: number; h: number }> {
  // corner cabinets get their own shaped counter, so exclude them from runs
  const tops = items
    .filter((it) => {
      const f = catalogById(it.catalogId).front;
      return catalogById(it.catalogId).counter && f !== 'corner' && f !== 'susan';
    })
    .sort((a, b) => a.x - b.x);
  const runs: Array<{ x1: number; x2: number; d: number; h: number }> = [];
  for (const it of tops) {
    const last = runs[runs.length - 1];
    // Merge only with an adjacent cabinet of the same height — a height change
    // starts a new run so the counter steps down to follow each cabinet.
    if (last && it.x <= last.x2 + 0.2 && Math.abs(last.h - it.h) < 0.01) {
      last.x2 = Math.max(last.x2, it.x + footprintW(it));
      last.d = Math.max(last.d, it.d + it.outset);
    } else runs.push({ x1: it.x, x2: it.x + footprintW(it), d: it.d + it.outset, h: it.h });
  }
  return runs;
}

export function groundTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.05, s / 2, s / 2, s * 0.55);
    g.addColorStop(0, '#dadcdf');
    g.addColorStop(0.6, '#cdd0d4');
    g.addColorStop(1, '#b9bdc2');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
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
  const gnd = [0.46, 0.46, 0.47];
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
function counterSlabHoles(
  runW: number,
  depth: number,
  holes: Array<{ x1: number; x2: number; z1: number; z2: number }>,
  mat: THREE.Material,
  cT: number,
  restH: number = BASE_H
): THREE.Mesh {
  const s = new THREE.Shape();
  s.moveTo(-runW / 2, 0);
  s.lineTo(runW / 2, 0);
  s.lineTo(runW / 2, depth);
  s.lineTo(-runW / 2, depth);
  s.closePath();
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
export function buildDesignGroup(design: Design, fin: FinishOption, appliances: ApplianceItem[] = []): BuiltScene {
  const group = new THREE.Group();
  const mats = createMats(fin, countertopById(design.counterId));
  const cT = design.counterThickness ?? COUNTER_T;
  const bsH = design.backsplashHeight ?? 0; // stone backsplash height up the wall (0 = none)
  const BS_THICK = 0.75; // backsplash slab thickness off the wall
  const reserves = bsH > 0 ? reservesFor(design) : null; // corner zones for backsplash spans
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1eee7, roughness: 0.92 });
  // window / door materials (built once, disposed with the scene)
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3c4149, roughness: 0.6, metalness: 0.1 });
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
      const glass = box(iw, ih, 0.3, glassMat);
      glass.position.set(0, h / 2, zc);
      g2.add(glass);
      const mv = box(0.8, ih, FD * 0.7, frameMat); // vertical mullion
      mv.position.set(0, h / 2, zc);
      g2.add(mv);
      const mh = box(iw, 0.8, FD * 0.7, frameMat); // horizontal mullion
      mh.position.set(0, h / 2, zc);
      g2.add(mh);
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
      const wallMesh = box(f.wall.length, f.wall.height, th, wallMat);
      wallMesh.castShadow = false;
      place(wallMesh, f.wall.length / 2, -th / 2, f.wall.height / 2);
    }

    const wallItems = design.items.filter((it) => it.wallId === f.wall.id);
    const floorItems = laneItems(wallItems, f.wall.id, 'floor');

    for (const it of wallItems) {
      const cat = catalogById(it.catalogId);
      // Orientation a lazy susan keeps in its corner is set by which wall end it
      // sits at — not by the hinge field, which only chooses the handle door.
      const geomSide: 1 | -1 = it.x + footprintW(it) / 2 > f.wall.length / 2 ? -1 : 1;
      const applianceH = cat.applianceCat ? selectedApplianceHeight(it.appliance, appliances) : undefined;
      const cab = buildCabinetLocal(
        cat,
        { w: it.w, d: it.d, h: it.h, hinge: it.hinge, style: design.doorStyle, endL: it.endL, endR: it.endR, backPanel: f.wall.ghost, cornerSide: cat.front === 'susan' || cat.front === 'corner' ? geomSide : undefined, applianceH, counterT: cT },
        mats
      );
      const exL = cat.category !== 'appliance' && it.endL ? 0.75 : 0;
      cab.position.copy(origin).addScaledVector(dir, it.x + exL + it.w / 2).addScaledVector(nrm, it.outset);
      cab.position.y = it.mount;
      cab.rotation.y = yaw;
      group.add(cab);

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

    for (const r of counterRuns3d(floorItems)) {
      const x1 = Math.max(r.x1 - COUNTER_OVERHANG, 0);
      const x2 = Math.min(r.x2 + COUNTER_OVERHANG, f.wall.length);
      const depth = r.d + COUNTER_OVERHANG;
      const slabMat = mats.counter.clone();
      slabMat.map = mats.counterTex.clone();
      const runCenter = (x1 + x2) / 2;
      // sink basins in this run → cut holes so the basin shows through
      const holes = floorItems
        .filter((it) => {
          if (!isSinkFront(catalogById(it.catalogId).front)) return false;
          const cx = it.x + footprintW(it) / 2;
          return cx >= r.x1 - 0.1 && cx <= r.x2 + 0.1;
        })
        .map((it) => {
          const b = sinkBasin(it.w, it.d);
          const cx = it.x + footprintW(it) / 2 - runCenter;
          return { x1: cx - b.bw / 2, x2: cx + b.bw / 2, z1: b.zc - b.bd / 2, z2: b.zc + b.bd / 2 };
        });
      if (holes.length) {
        slabMat.map.repeat.set(1 / 48, 1 / 48);
        const slab = counterSlabHoles(x2 - x1, depth, holes, slabMat, cT, r.h);
        slab.position.copy(origin).addScaledVector(dir, runCenter);
        slab.position.y = 0;
        slab.rotation.y = yaw;
        group.add(slab);
      } else {
        slabMat.map.repeat.set(Math.max(1, (x2 - x1) / 48), Math.max(1, depth / 48));
        const slab = box(x2 - x1, cT, depth, slabMat);
        place(slab, runCenter, depth / 2, r.h + cT / 2);
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

  const b = planBounds(frames, 10);
  const center = new THREE.Vector3(b.x + b.w / 2, 20, b.y + b.h / 2);
  const radius = Math.max(b.w, b.h) / 2 + 30;
  const dispose = () => {
    disposeMats(mats);
    wallMat.dispose();
    frameMat.dispose();
    glassMat.dispose();
    doorMat.dispose();
  };
  return { group, center, radius, dispose };
}
