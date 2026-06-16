import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BASE_H } from '../model/catalog';
import type { CatalogItem, FinishOption } from '../model/types';
import { END_PANEL_T, buildCabinetLocal, createMats, gearAbove, type CabDims, type CabMats } from './cabinet3d';

/**
 * Offscreen "product shot" renderer. Each cabinet is rendered once per
 * (catalog item, size, finish, hinge, view) with studio lighting on a
 * transparent background, then cached as a data URL.
 */

let renderer: THREE.WebGLRenderer | null = null;
let rendererFailed = false;
let envTex: THREE.Texture | null = null;
const matsByFinish = new Map<string, CabMats>();
const cache = new Map<string, string | null>();

function getRenderer(): THREE.WebGLRenderer | null {
  if (renderer) return renderer;
  if (rendererFailed) return null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  } catch {
    renderer = null;
    rendererFailed = true;
  }
  if (!renderer) rendererFailed = true;
  return renderer;
}

function matsFor(fin: FinishOption): CabMats {
  let m = matsByFinish.get(fin.id);
  if (!m) {
    m = createMats(fin);
    matsByFinish.set(fin.id, m);
  }
  return m;
}

export type SpriteView = 'front' | 'iso';

/** Total sprite height in inches for a front-view sprite (carcass + gear). */
export function spriteTopY(cat: CatalogItem, h: number): number {
  const gear = gearAbove(cat);
  return gear > 0 ? BASE_H + gear : h;
}

/** Extra sprite width on each side for applied end panels. */
export function spriteEndExtents(cat: CatalogItem, dims: CabDims): { exL: number; exR: number } {
  const yes = cat.category !== 'appliance';
  return { exL: yes && dims.endL ? END_PANEL_T : 0, exR: yes && dims.endR ? END_PANEL_T : 0 };
}

export function cabinetSprite(cat: CatalogItem, dims: CabDims, fin: FinishOption, view: SpriteView): string | null {
  const key = `${cat.id}|${dims.w}x${dims.d}x${dims.h}|${dims.hinge}|${dims.cornerSide ?? ''}|${dims.style}|${dims.endL ? 'L' : ''}${dims.endR ? 'R' : ''}|${fin.id}|${view}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const r = getRenderer();
  if (!r || !envTex) {
    cache.set(key, null);
    return null;
  }
  if (cache.size > 400) cache.clear();

  const scene = new THREE.Scene();
  scene.environment = envTex;
  scene.environmentIntensity = 0.65;

  const mats = matsFor(fin);
  const cab = buildCabinetLocal(cat, dims, mats);
  scene.add(cab);

  const topY = spriteTopY(cat, dims.h);

  // key light, slightly left and in front — gives the doors their cast shadows
  const sun = new THREE.DirectionalLight(0xfff3e2, 2.2);
  sun.position.set(-dims.w * 0.8, topY * 2.2, dims.d + 90);
  sun.target.position.set(0, topY * 0.4, dims.d / 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const s = Math.max(dims.w, topY) * 1.2;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d4cc, 0.5));

  let camera: THREE.Camera;
  let pw: number;
  let ph: number;

  if (view === 'front') {
    // Orthographic, exactly framing the cabinet (plus any applied end
    // panels) so the image maps 1:1 onto elevation inches.
    const { exL, exR } = spriteEndExtents(cat, dims);
    const cam = new THREE.OrthographicCamera(-dims.w / 2 - exL, dims.w / 2 + exR, topY, 0, 1, 1000);
    cam.position.set(0, 0, 400);
    camera = cam;
    const fw = dims.w + exL + exR;
    const ppi = Math.min(16, 1500 / Math.max(fw, topY));
    pw = Math.max(64, Math.round(fw * ppi));
    ph = Math.max(64, Math.round(topY * ppi));
  } else {
    // Product-shot 3/4 view with a soft ground shadow.
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(Math.max(dims.w, dims.d) * 2.5, 32),
      new THREE.ShadowMaterial({ opacity: 0.22 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const sphere = new THREE.Box3().setFromObject(cab).getBoundingSphere(new THREE.Sphere());
    const fov = 30;
    const cam = new THREE.PerspectiveCamera(fov, 1, 1, 2000);
    const dir = new THREE.Vector3(0.62, 0.38, 1).normalize();
    const dist = (sphere.radius / Math.sin(((fov / 2) * Math.PI) / 180)) * 1.06;
    cam.position.copy(sphere.center).addScaledVector(dir, dist);
    cam.lookAt(sphere.center);
    camera = cam;
    pw = 480;
    ph = 480;
  }

  let url: string | null = null;
  try {
    r.setSize(pw, ph, false);
    r.setClearColor(0x000000, 0);
    r.render(scene, camera);
    url = r.domElement.toDataURL('image/png');
  } catch {
    url = null;
  }

  // dispose per-call geometry (materials are cached per finish)
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      if (o.material instanceof THREE.ShadowMaterial) o.material.dispose();
    }
  });

  cache.set(key, url);
  return url;
}
