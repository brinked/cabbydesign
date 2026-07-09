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
};

const requested = new Set<string>();

/**
 * Kick off loading a per-appliance model once (idempotent, safe to call from
 * render paths). Until it arrives, callers fall back to the generic model;
 * `onModelsLoaded` fires on arrival so views re-render with the real head.
 */
export function requestModel(key: string): void {
  const url = APPLIANCE_MODEL_URLS[key];
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

/** Center an object on X/Z with its base at y=0; record its size. */
function normalize(root: THREE.Object3D): ModelTemplate {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const wrap = new THREE.Group();
  root.position.set(-center.x, -box.min.y, -center.z);
  wrap.add(root);
  return { obj: wrap, size };
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
