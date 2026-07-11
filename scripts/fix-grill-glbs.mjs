// Repair the grill/griddle GLBs in public/models/grills:
//  1. Snap each mesh node's rotation to the nearest axis-aligned orientation
//     whose result is "upright" (width along X the largest span, height along
//     Y the smallest of the three) — several heads were exported tilted.
//  2. When a head had to be snapped by more than ~2°, re-seat it on its
//     insulated jacket using the relations measured from the correctly
//     exported models: x-centered on the jacket, front face ~3.6" proud of
//     the jacket front, base ~1.4" above the jacket base.
// Writes the files in place. Pure Node — parses the GLB container directly.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';

// NOTE: the current `3dgrillswithliners` source models are already correctly
// oriented — do NOT bulk-run this. Snapping their (intentionally non-axis-
// aligned) authored rotations actually TILTS/flips them (that's what broke the
// Blaze + Napoleon heads). This tool is kept only for a one-off mis-exported
// model and must be run with explicit filenames. Running it with no args is a
// no-op on purpose.
const DIR = resolve(process.cwd(), 'public/models/grills');
const FILES = process.argv.slice(2);
if (!FILES.length) {
  console.log('No files given. The shipped grill models are already correctly oriented — nothing to do.\nPass explicit filenames only if you have a freshly mis-exported model to snap.');
  process.exit(0);
}

const JACKET_RE = /(^|[^a-z])ij\d*(\b|$)|liner|jacket|zcl|bsasl/i;

/** Explicit head orientations for files whose authored rotation is too far
 *  off for nearest-snap to recover (keyed `file::meshName`). */
const OVERRIDES = process.env.OVERRIDES_JSON ? JSON.parse(process.env.OVERRIDES_JSON) : {};
const RESEAT_ONLY = process.env.RESEAT_ONLY === '1';

// ---------- quaternion / matrix helpers ----------
const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qAxis = (x, y, z, deg) => {
  const h = (deg * Math.PI) / 360;
  const s = Math.sin(h);
  return [x * s, y * s, z * s, Math.cos(h)];
};
// the 24 proper axis-aligned orientations
function orientations() {
  const xs = [qAxis(1, 0, 0, 0), qAxis(1, 0, 0, 90), qAxis(1, 0, 0, 180), qAxis(1, 0, 0, 270)];
  const ys = [qAxis(0, 1, 0, 0), qAxis(0, 1, 0, 90), qAxis(0, 1, 0, 180), qAxis(0, 1, 0, 270)];
  const zs = [qAxis(0, 0, 1, 0), qAxis(0, 0, 1, 90), qAxis(0, 0, 1, 270)];
  const out = [];
  const seen = new Set();
  for (const a of ys) for (const b of xs) for (const c of zs) {
    const q = qMul(a, qMul(b, c));
    const n = Math.hypot(...q);
    const qq = q.map((v) => v / n);
    const key = qq.map((v) => (Math.abs(v) < 1e-6 ? 0 : +v.toFixed(4))).join(',');
    const keyNeg = qq.map((v) => (Math.abs(v) < 1e-6 ? 0 : +(-v).toFixed(4))).join(',');
    if (seen.has(key) || seen.has(keyNeg)) continue;
    seen.add(key);
    out.push(qq);
  }
  return out;
}
const ORIENTS = orientations();
const quatToMat = (q) => {
  const [x, y, z, w] = q;
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ];
};

// world bbox of a node's mesh under rotation q, scale s, translation t
function worldBox(local, q, s, t) {
  const R = quatToMat(q);
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (const cx of [local.min[0], local.max[0]])
    for (const cy of [local.min[1], local.max[1]])
      for (const cz of [local.min[2], local.max[2]]) {
        const v = [cx * s[0], cy * s[1], cz * s[2]];
        const r = [
          R[0] * v[0] + R[1] * v[1] + R[2] * v[2] + t[0],
          R[3] * v[0] + R[4] * v[1] + R[5] * v[2] + t[1],
          R[6] * v[0] + R[7] * v[1] + R[8] * v[2] + t[2],
        ];
        for (let k = 0; k < 3; k++) {
          mn[k] = Math.min(mn[k], r[k]);
          mx[k] = Math.max(mx[k], r[k]);
        }
      }
  return { min: mn, max: mx, span: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]] };
}

for (const name of FILES) {
  const file = resolve(DIR, name);
  const buf = readFileSync(file);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const rest = buf.subarray(20 + jsonLen); // BIN chunk (untouched)

  const meshNodes = (json.nodes ?? []).map((n, i) => ({ n, i })).filter(({ n }) => n.mesh != null);

  // sampled mesh-local vertices for a node (from the BIN chunk), for scoring
  const binStart = 20 + jsonLen + 8; // skip BIN chunk header
  const verticesFor = (n) => {
    const out = [];
    for (const p of json.meshes[n.mesh].primitives ?? []) {
      const a = json.accessors[p.attributes.POSITION];
      if (a.componentType !== 5126 || a.type !== 'VEC3') continue;
      const bv = json.bufferViews[a.bufferView];
      const base = binStart + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
      const stride = bv.byteStride ?? 12;
      const step = Math.max(1, Math.floor(a.count / 8000));
      for (let vi = 0; vi < a.count; vi += step) {
        const o = base + vi * stride;
        out.push([buf.readFloatLE(o), buf.readFloatLE(o + 4), buf.readFloatLE(o + 8)]);
      }
    }
    return out;
  };

  // How "grill-like" an orientation is: the control panel bulges forward (+z)
  // at the bottom while the hood sits back at the top, so score by how much
  // the bottom half's z-centroid leads the top half's.
  const grillScore = (verts, q, s) => {
    const R = quatToMat(q);
    const pts = verts.map(([x, y, z]) => {
      const v = [x * s[0], y * s[1], z * s[2]];
      return [
        R[0] * v[0] + R[1] * v[1] + R[2] * v[2],
        R[3] * v[0] + R[4] * v[1] + R[5] * v[2],
        R[6] * v[0] + R[7] * v[1] + R[8] * v[2],
      ];
    });
    let yMin = Infinity, yMax = -Infinity;
    for (const p of pts) { yMin = Math.min(yMin, p[1]); yMax = Math.max(yMax, p[1]); }
    const yMid = (yMin + yMax) / 2;
    let topZ = 0, topN = 0, botZ = 0, botN = 0;
    for (const p of pts) {
      if (p[1] > yMid) { topZ += p[2]; topN++; }
      else { botZ += p[2]; botN++; }
    }
    if (!topN || !botN) return -Infinity;
    return botZ / botN - topZ / topN;
  };
  const localFor = (n) => {
    const m = json.meshes[n.mesh];
    const mn = [Infinity, Infinity, Infinity];
    const mx = [-Infinity, -Infinity, -Infinity];
    for (const p of m.primitives ?? []) {
      const a = json.accessors[p.attributes.POSITION];
      for (let k = 0; k < 3; k++) {
        mn[k] = Math.min(mn[k], a.min[k]);
        mx[k] = Math.max(mx[k], a.max[k]);
      }
    }
    return { min: mn, max: mx };
  };

  let changed = false;
  const boxes = new Map(); // node index -> world box (post-fix)
  for (const { n, i } of meshNodes) {
    const local = localFor(n);
    const q0raw = n.rotation ?? [0, 0, 0, 1];
    const norm = Math.hypot(...q0raw) || 1;
    const q0 = q0raw.map((v) => v / norm);
    const s = n.scale ?? [1, 1, 1];
    const t = n.translation ?? [0, 0, 0];
    // candidates that read upright: width (x) is the largest span, height (y) the smallest
    const candidates = ORIENTS.filter((q) => {
      const b = worldBox(local, q, s, [0, 0, 0]);
      return b.span[0] >= b.span[2] - 1e-6 && b.span[2] >= b.span[1] - 1e-6;
    });
    if (!candidates.length) {
      boxes.set(i, worldBox(local, q0, s, t));
      continue;
    }
    // Default: keep the candidate closest to what was authored (fixes small
    // tilts). Heads whose authoring was too far gone are pinned explicitly.
    const pinned = OVERRIDES[`${name}::${json.meshes[n.mesh]?.name ?? ''}`];
    let best = candidates[0];
    if (pinned) {
      best = pinned;
    } else {
      let bestDot = -1;
      for (const q of candidates) {
        const dot = Math.abs(q[0] * q0[0] + q[1] * q0[1] + q[2] * q0[2] + q[3] * q0[3]);
        if (dot > bestDot) {
          bestDot = dot;
          best = q;
        }
      }
    }
    if (process.env.LIST) {
      const verts = verticesFor(n);
      console.log(`  [${json.meshes[n.mesh]?.name}] authored ${JSON.stringify(q0.map((v) => +v.toFixed(4)))} score ${(grillScore(verts, q0, s) / 0.0254).toFixed(2)}in`);
      for (const q of candidates) {
        const b = worldBox(local, q, s, [0, 0, 0]);
        const f = (v) => (v / 0.0254).toFixed(1);
        console.log(`    cand ${JSON.stringify(q.map((v) => +v.toFixed(4)))} score ${(grillScore(verts, q, s) / 0.0254).toFixed(2)}in spans x${f(b.span[0])} y${f(b.span[1])} z${f(b.span[2])}`);
      }
    }
    const dot = Math.abs(best[0] * q0[0] + best[1] * q0[1] + best[2] * q0[2] + best[3] * q0[3]);
    const angleOff = (2 * Math.acos(Math.min(1, dot)) * 180) / Math.PI;
    // RESEAT_ONLY: keep the (already-correct) authored rotation and only re-seat
    // the head on its jacket — for models whose rotation is fine but whose head
    // is authored too far back, hiding the front control panel.
    if (angleOff > 0.5 && !RESEAT_ONLY) {
      n.rotation = best.map((v) => +v.toFixed(6));
      n._snapped = angleOff;
      changed = true;
    }
    boxes.set(i, worldBox(local, n.rotation ?? [0, 0, 0, 1], s, t));
  }

  // re-seat the head on its jacket (front proud, base above), so the control
  // panel clears the countertop front. Runs for snapped heads, or always in
  // RESEAT_ONLY mode.
  const jacket = meshNodes.find(({ n }) => JACKET_RE.test(`${n.name ?? ''} ${json.meshes[n.mesh]?.name ?? ''}`));
  const head = meshNodes.find((x) => x !== jacket);
  if (jacket && head && (RESEAT_ONLY || head.n._snapped > 2)) {
    const jb = boxes.get(jacket.i);
    const hb = boxes.get(head.i);
    const t = head.n.translation ?? [0, 0, 0];
    const IN = 0.0254;
    const dx = (jb.min[0] + jb.max[0]) / 2 - (hb.min[0] + hb.max[0]) / 2; // x-center on jacket
    const dz = jb.max[2] + 3.6 * IN - hb.max[2]; // front ~3.6" proud of jacket front
    const dy = jb.min[1] + 1.4 * IN - hb.min[1]; // base ~1.4" above jacket base
    head.n.translation = [t[0] + dx, t[1] + dy, t[2] + dz].map((v) => +v.toFixed(6));
    changed = true;
  }

  const report = meshNodes
    .map(({ n, i }) => {
      const b = boxes.get(i);
      const f = (v) => (v / 0.0254).toFixed(1);
      return `    ${(json.meshes[n.mesh]?.name ?? '').padEnd(26)} ${n._snapped ? `SNAPPED ${n._snapped.toFixed(1)}°` : 'ok      '} x[${f(b.min[0])}..${f(b.max[0])}] y[${f(b.min[1])}..${f(b.max[1])}] z[${f(b.min[2])}..${f(b.max[2])}]`;
    })
    .join('\n');
  console.log(`${basename(file)}${changed ? '  (rewritten)' : '  (unchanged)'}\n${report}`);

  if (changed) {
    for (const { n } of meshNodes) delete n._snapped;
    let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
    const pad = (4 - (jsonBuf.length % 4)) % 4;
    if (pad) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(pad, 0x20)]);
    const out = Buffer.alloc(12 + 8 + jsonBuf.length + rest.length);
    out.write('glTF', 0);
    out.writeUInt32LE(2, 4);
    out.writeUInt32LE(out.length, 8);
    out.writeUInt32LE(jsonBuf.length, 12);
    out.write('JSON', 16);
    jsonBuf.copy(out, 20);
    rest.copy(out, 20 + jsonBuf.length);
    writeFileSync(file, out);
  }
}
