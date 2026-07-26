// Real 3D appliance models (glTF/.glb) that replace the procedural geometry for
// select appliances. Models load asynchronously and are cached as a normalized
// template (centered on X/Z, base at y=0, real-world size recorded). Callers
// clone + scale-to-fit on demand. Until a model finishes loading, getters
// return null and the procedural fallback is used; `onModelsLoaded` lets the UI
// re-render (live 3D scene + cached 2D sprites) once a model arrives.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface ModelTemplate {
  /** Normalized object: centered in X/Z, base at y=0. */
  obj: THREE.Object3D;
  /** Real-world bounding-box size (model units, after node transforms). */
  size: THREE.Vector3;
  /** Insulated-jacket flange top above the model base (model units). The
   *  flange is what rests on the countertop when the unit drops in. */
  jacketTop?: number;
  /** How far the control panel (the head's front at its lower band) sits behind
   *  the model's overall front, as a fraction of depth. The hood usually
   *  overhangs past the controls, so front-aligning the whole model leaves the
   *  knobs set back; placement shifts forward by this to bring the control panel
   *  to the counter front. */
  ctrlRecessFrac?: number;
}

const templates = new Map<string, ModelTemplate>();
const listeners = new Set<() => void>();
let started = false;

/** Public model URLs (served from /public). One entry per real model.
 *  These are small and preloaded at startup as the generic fallbacks. */
const MODEL_URLS: Record<string, string> = {
  griddle: '/models/griddle.glb',
  grill: '/models/grill.glb', // Broilmaster B-Series head for grill cabinets
};

/**
 * Per-appliance models (brand-accurate heads incl. insulated liners). These
 * are large (~5-8 MB each), so they are NOT preloaded — `requestModel` lazy-
 * loads one the first time a design actually shows that appliance. Keys are
 * resolved from the selected appliance by `appliance3dModel` (model layer).
 */
const APPLIANCE_MODEL_URLS: Record<string, string> = {
  'blaze-lte-32': '/models/grills/blaze-lte-32.glb',
  'blaze-lte-40': '/models/grills/blaze-lte-40.glb',
  'blaze-lte-pro-40': '/models/grills/blaze-lte-pro-40.glb',
  'broilmaster-b-32': '/models/grills/broilmaster-b-32.glb',
  'napoleon-700-32': '/models/grills/napoleon-700-32.glb',
  'napoleon-700-38': '/models/grills/napoleon-700-38.glb',
  'napoleon-700-44': '/models/grills/napoleon-700-44.glb',
  'xo-xlt-32': '/models/grills/xo-xlt-32.glb',
  'xo-xlt-40': '/models/grills/xo-xlt-40.glb',
  'legriddle-commercial-75': '/models/grills/legriddle-commercial-75.glb',
  'legriddle-commercial-105': '/models/grills/legriddle-commercial-105.glb',
  hood: '/models/hood.glb', // Proline 48" wall-canopy range hood
};

/**
 * Wall-opening models — real product geometry replacing the procedural
 * frame+panel: a hinged entry door, and sliding patio doors in two panel
 * counts. Like the appliance heads these are ~1-2 MB, so they lazy-load
 * through `requestModel` the first time a design actually shows one.
 */
const OPENING_MODEL_URLS: Record<string, string> = {
  'door-modern': '/models/openings/door-modern.glb',
  'slider-2panel': '/models/openings/slider-2panel.glb',
  'slider-4panel': '/models/openings/slider-4panel.glb',
};

/** Width (inches) at or above which a sliding door renders as the 4-panel
 *  unit; narrower openings get the 2-panel one. The two models cover roughly
 *  5' to 10' of opening, which is the real product range. */
export const SLIDER_4PANEL_MIN_W = 84;

/** The model key for a sliding door of this opening width. */
export function sliderModelKey(w: number): string {
  return w >= SLIDER_4PANEL_MIN_W ? 'slider-4panel' : 'slider-2panel';
}

/** Cabinet pull models. Exported from the handle library by
 *  `scripts/export-handles.py` already in door-local space: length along X,
 *  standoff along +Z, mounting face at Z=0, sized in inches. Real stock
 *  lengths — callers pick the nearest and stretch only along X (which is how
 *  a real handle family varies: posts move apart, bar diameter stays). */
const HANDLE_MODEL_URLS: Record<string, string> = {
  'bar-5': '/models/handles/bar-5.glb',
  'bar-7': '/models/handles/bar-7.glb',
  'bar-8': '/models/handles/bar-8.glb',
};

/** Named hardware products modelled individually. Unlike the generic bar
 *  family these render at their TRUE length (a real product comes in fixed
 *  sizes), and are chosen by matching the design's selected handle name. */
const NAMED_HANDLE_MODELS: Record<string, string> = {
  'charlotte-316': '/models/handles/charlotte-316.glb',
};

/** The scanned HDPE surface normal map — the real molded-poly grain instead
 *  of a downscaled canvas approximation. Loaded once and shared by every
 *  cabinet material (hence a single shared `repeat`). */
let hdpeNormal: THREE.Texture | null = null;

/** The HDPE normal map, or null until it loads. */
export function hdpeNormalMap(): THREE.Texture | null {
  return hdpeNormal;
}

/** Scanned PBR maps under /textures (granite, grass, marble pavers…). Each is
 *  fetched once on first request and shared by every material that wants it —
 *  they are never disposed (materials are; see disposeMats), which is what
 *  makes sharing safe. Returns null until the file arrives; `onModelsLoaded`
 *  fires then, so the caller re-renders with the real map. */
const libTextures = new Map<string, THREE.Texture | null>();

/**
 * A texture from /textures/<file>, or null until it loads.
 * Pass data=true for normal/roughness maps so they skip the sRGB transform.
 * Callers that need their own tiling should `.clone()` the result — a clone
 * carries its own repeat/offset while sharing the uploaded image.
 */
export function libTexture(file: string, data = false): THREE.Texture | null {
  const cached = libTextures.get(file);
  if (cached !== undefined) return cached;
  libTextures.set(file, null); // in flight — don't request it twice
  new THREE.TextureLoader().load(
    `/textures/${file}`,
    (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      libTextures.set(file, tex);
      listeners.forEach((l) => l());
    },
    undefined,
    () => undefined // missing file: caller keeps its procedural fallback
  );
  return null;
}

/** Selectable 3D models for a hardware item (catalog prefs → Handles). */
export const HANDLE_3D_MODELS: Array<{ key: string; label: string }> = [
  { key: 'bar', label: 'Bar pull (auto-sized)' },
  { key: 'charlotte-316', label: 'Charlotte 316' },
];

interface HandleTemplate {
  obj: THREE.Object3D;
  /** True length of the model along X (inches). */
  len: number;
}

const handleTemplates = new Map<string, HandleTemplate>();

/** Slugified handle name → model key, or null when there's no dedicated model
 *  (the generic bar family is used instead). */
export function namedHandleKey(name: string | undefined): string | null {
  if (!name) return null;
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug in NAMED_HANDLE_MODELS ? slug : null;
}

/** A named product handle at its true size; null until the model loads. */
export function namedHandle(key: string): { obj: THREE.Object3D; len: number } | null {
  const t = handleTemplates.get(key);
  return t ? { obj: t.obj.clone(true), len: t.len } : null;
}

/** Stock handle lengths, ascending — used to pick the closest size. */
export const HANDLE_SIZES: Array<{ key: string; len: number }> = [
  { key: 'bar-5', len: 5.38 },
  { key: 'bar-7', len: 6.6 },
  { key: 'bar-8', len: 7.88 },
];

/** Nearest stock handle to a target length; null until the models load. */
export function handleFor(targetLen: number): { obj: THREE.Object3D; len: number } | null {
  let best: { key: string; len: number } | null = null;
  for (const s of HANDLE_SIZES) {
    if (!handleTemplates.has(s.key)) continue;
    if (!best || Math.abs(s.len - targetLen) < Math.abs(best.len - targetLen)) best = s;
  }
  if (!best) return null;
  const t = handleTemplates.get(best.key)!;
  return { obj: t.obj.clone(true), len: t.len };
}

const requested = new Set<string>();

/**
 * Kick off loading a per-appliance model once (idempotent, safe to call from
 * render paths). Until it arrives, callers fall back to the generic model;
 * `onModelsLoaded` fires on arrival so views re-render with the real head.
 */
export function requestModel(key: string): void {
  const url = APPLIANCE_MODEL_URLS[key] ?? OPENING_MODEL_URLS[key];
  if (!url || requested.has(key) || templates.has(key)) return;
  requested.add(key);
  new GLTFLoader().load(
    url,
    (gltf) => {
      templates.set(key, normalize(gltf.scene));
      listeners.forEach((l) => l());
    },
    undefined,
    () => undefined // on error: generic fallback stays
  );
}

/** True once at least the requested model is available. */
export function hasModel(key: string): boolean {
  return templates.has(key);
}

/** Subscribe to "a model finished loading"; returns an unsubscribe fn. */
export function onModelsLoaded(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Strip the molded "Le Griddle / GFE75" logo + text from the griddle model:
 * the text geometry (node named with the SKU) and the logo decal (the only
 * mesh whose material carries a texture map). Leaves the plain steel/plastic.
 */
function stripGriddleBranding(root: THREE.Object3D): void {
  const remove: THREE.Object3D[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const hasTexture = mats.some((m) => m && (m as THREE.MeshStandardMaterial).map);
    // own name only (e.g. "Geom3D_LeGriddle GFE75L"); never match a parent group
    if (hasTexture || /legriddle|gfe\d/i.test(o.name)) remove.push(o);
  });
  remove.forEach((o) => o.parent?.remove(o));
}

/** Node/mesh names that identify the insulated jacket/liner in a grill GLB. */
const JACKET_RE = /(^|[^a-z0-9])ij\d*($|[^a-z0-9])|liner|jacket|zcl|bsasl/i;

/** Center an object on X/Z with its base at y=0; record its size (and the
 *  insulated jacket's flange height, when the model carries one). */
function normalize(root: THREE.Object3D): ModelTemplate {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  let jacketTop: number | undefined;
  // Front-most z of the control panel: the head (non-jacket) geometry in the
  // lower ~40% of its height, where the knobs live (the hood above overhangs).
  const bandTop = box.min.y + size.y * 0.4;
  let ctrlZ = -Infinity;
  const v = new THREE.Vector3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (JACKET_RE.test(o.name)) {
      const jb = new THREE.Box3().setFromObject(o);
      jacketTop = Math.max(jacketTop ?? -Infinity, jb.max.y - box.min.y);
      return;
    }
    const pos = m.geometry.getAttribute('position');
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 4000));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (v.y <= bandTop && v.z > ctrlZ) ctrlZ = v.z;
    }
  });
  const ctrlRecessFrac = ctrlZ > -Infinity && size.z > 1e-6 ? Math.max(0, (box.max.z - ctrlZ) / size.z) : 0;
  const wrap = new THREE.Group();
  root.position.set(-center.x, -box.min.y, -center.z);
  wrap.add(root);
  return { obj: wrap, size, jacketTop, ctrlRecessFrac };
}

/** Kick off loading every known model once (idempotent). */
export function loadModels(): void {
  if (started) return;
  started = true;
  const loader = new GLTFLoader();
  for (const [key, url] of Object.entries(MODEL_URLS)) {
    loader.load(
      url,
      (gltf) => {
        if (key === 'griddle') stripGriddleBranding(gltf.scene);
        templates.set(key, normalize(gltf.scene));
        listeners.forEach((l) => l());
      },
      undefined,
      () => undefined // on error: leave it unset, procedural fallback stays
    );
  }
  // cabinet surface grain — fires the same listeners so the 3D scene rebuilds
  // with it once it arrives
  new THREE.TextureLoader().load(
    '/textures/hdpe-normal.jpg',
    (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.NoColorSpace; // normal maps are data, not color
      // BoxGeometry UVs run 0..1 per face, so this is a tile count rather
      // than a real-world size: ~5 tiles reads as fine grain on a door and
      // stays invisibly fine on small parts.
      tex.repeat.set(5, 5);
      hdpeNormal = tex;
      listeners.forEach((l) => l());
    },
    undefined,
    () => undefined // no grain is fine — materials just render smooth
  );
  for (const [key, url] of Object.entries({ ...HANDLE_MODEL_URLS, ...NAMED_HANDLE_MODELS })) {
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(root);
        handleTemplates.set(key, { obj: root, len: box.max.x - box.min.x });
        listeners.forEach((l) => l());
      },
      undefined,
      () => undefined // handle model missing: the procedural bar stays
    );
  }
}

/** Physical facts about a loaded appliance model, in inches at real size:
 *  overall width, and (when it carries an insulated jacket) the height of
 *  the jacket's flange above the model base. Null until loaded. */
export function applianceModelInfo(key: string): { realWIn: number; jacketTopIn?: number; ctrlRecessFrac?: number } | null {
  const t = templates.get(key);
  if (!t || t.size.x <= 0) return null;
  // model files are authored in real-world meters; report inches
  const IN = 0.0254;
  return { realWIn: t.size.x / IN, jacketTopIn: t.jacketTop != null ? t.jacketTop / IN : undefined, ctrlRecessFrac: t.ctrlRecessFrac };
}

/**
 * A clone of a model scaled so its width fits `targetWidthIn`, base at y=0,
 * centered in X/Z. Geometries are deep-cloned so callers may dispose them
 * (the sprite renderer disposes per-render) without harming the template.
 * Returns null until the model has loaded.
 */
export function fitModel(key: string, targetWidthIn: number): THREE.Object3D | null {
  const t = templates.get(key);
  if (!t || t.size.x <= 0) return null;
  const clone = t.obj.clone(true);
  clone.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh;
      m.geometry = m.geometry.clone();
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  clone.scale.setScalar(targetWidthIn / t.size.x);
  return clone;
}

/**
 * A clone of a model scaled per-axis to exactly W×H×D inches (base at y=0,
 * centered in X/Z). Used by items that ARE the model (e.g. range hoods),
 * where the user's size steppers stretch the unit itself.
 */
export function fitModelBox(key: string, w: number, h: number, d: number): THREE.Object3D | null {
  const t = templates.get(key);
  if (!t || t.size.x <= 0 || t.size.y <= 0 || t.size.z <= 0) return null;
  const clone = t.obj.clone(true);
  clone.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh;
      m.geometry = m.geometry.clone();
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  clone.scale.set(w / t.size.x, h / t.size.y, d / t.size.z);
  return clone;
}
