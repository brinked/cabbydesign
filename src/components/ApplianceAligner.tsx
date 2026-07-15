import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ApplianceItem, Design, ModelAlign, ModelAligns } from '../model/types';
import { api } from '../api/client';
import { useStore } from '../state/store';
import { buildDesignGroup, groundTexture, skyTexture } from '../three/scene3d';
import { onModelsLoaded } from '../three/models';
import { useFinish } from './WallsView';
import { Modal, SaveGlobalFooter } from './Modals';

/** A grill/griddle model the admin can align, with a synthetic appliance whose
 *  brand/model/name resolves (via appliance3dModel) to that model key. */
interface AlignerModel {
  key: string;
  label: string;
  cat: 'grill' | 'griddle' | 'hood';
  brand: string;
  model: string;
  name: string;
  /** cabinet width for the preview (wide enough to show the head at real size). */
  cabW: number;
}

const ALIGNER_MODELS: AlignerModel[] = [
  { key: 'blaze-lte-32', label: 'Blaze LTE 32″', cat: 'grill', brand: 'Blaze', model: 'BLZ-4-LTE2', name: 'LTE 32', cabW: 40 },
  { key: 'blaze-lte-40', label: 'Blaze LTE 40″', cat: 'grill', brand: 'Blaze', model: 'BLZ-5-LTE2', name: 'LTE 40"', cabW: 48 },
  { key: 'blaze-lte-pro-40', label: 'Blaze LTE Pro 40″', cat: 'grill', brand: 'Blaze', model: 'BLZ-5-LTE-PRO', name: 'LTE Pro 40"', cabW: 48 },
  { key: 'broilmaster-b-32', label: 'Broilmaster B-Series 32″', cat: 'grill', brand: 'Broilmaster', model: 'B-Series', name: 'B Series Basic', cabW: 40 },
  { key: 'napoleon-700-32', label: 'Napoleon 700 32″', cat: 'grill', brand: 'Napoleon', model: 'BIG32', name: '700 BIG32', cabW: 40 },
  { key: 'napoleon-700-38', label: 'Napoleon 700 38″', cat: 'grill', brand: 'Napoleon', model: 'BIG38', name: '700 BIG38', cabW: 46 },
  { key: 'napoleon-700-44', label: 'Napoleon 700 44″', cat: 'grill', brand: 'Napoleon', model: 'BIG44', name: '700 BIG44', cabW: 52 },
  { key: 'xo-xlt-32', label: 'XO XLT 32″', cat: 'grill', brand: 'XO', model: 'XLT32', name: 'XLT 32', cabW: 40 },
  { key: 'xo-xlt-40', label: 'XO XLT 40″', cat: 'grill', brand: 'XO', model: 'XLT40', name: 'XLT 40"', cabW: 48 },
  { key: 'legriddle-commercial-75', label: 'Le Griddle Commercial 75', cat: 'griddle', brand: 'Le Griddle', model: 'OML75', name: 'Commercial OML75', cabW: 40 },
  { key: 'legriddle-commercial-105', label: 'Le Griddle Commercial 105', cat: 'griddle', brand: 'Le Griddle', model: 'OML105', name: 'Commercial OML105', cabW: 50 },
  { key: 'hood', label: 'Range Hood (Proline 48″)', cat: 'hood', brand: 'Proline', model: '48WC', name: 'Wall Canopy Hood', cabW: 48 },
];

function previewAppliance(m: AlignerModel): ApplianceItem {
  return { id: 'preview', category: m.cat, brand: m.brand, model: m.model, name: m.name, msrp: 0, active: true };
}

function previewDesign(m: AlignerModel): Design {
  return {
    name: '', client: '', layout: 'linear', finishId: 'indigo', doorStyle: 'shaker', counterThickness: 1.5, counterId: 'classic-white', backsplashHeight: 0,
    walls: [{ id: 'w1', name: 'W', length: m.cabW + 24, height: 60, x: 0, y: 0, angle: 0, thickness: 5, ghost: false }],
    items: [
      m.cat === 'hood'
        ? { id: 'g', wallId: 'w1', catalogId: 'out-hood', x: 12, w: m.cabW, d: 24, h: 24, outset: 0, mount: 26, hinge: 'left', endL: false, endR: false, trays: 0 }
        : { id: 'g', wallId: 'w1', catalogId: m.cat === 'griddle' ? 'out-griddle' : 'out-grill', x: 12, w: m.cabW, d: 30, h: 34.5, outset: 0, mount: 0, hinge: 'left', endL: false, endR: false, trays: 0, appliance: { mode: 'inventory', applianceId: 'preview', withLiner: true } },
    ],
    roughIns: [], openings: [], measurements: [],
  };
}

/** Live 3D preview of one grill/griddle with the draft alignment applied. */
function AlignerPreview({ model, align }: { model: AlignerModel; align: ModelAlign }) {
  const mount = useRef<HTMLDivElement>(null);
  const fin = useFinish(useStore((s) => s.design.finishId));
  const sceneRef = useRef<THREE.Scene | null>(null);
  const camRef = useRef<{ camera: THREE.PerspectiveCamera; controls: OrbitControls } | null>(null);
  const sunRef = useRef<THREE.DirectionalLight | null>(null);
  const groupRef = useRef<{ group: THREE.Group; dispose: () => void } | null>(null);
  const invalidate = useRef<() => void>(() => {});
  const framedKey = useRef<string>('');
  const [ready, setReady] = useState(0); // bumped when a lazy model arrives

  useEffect(() => onModelsLoaded(() => setReady((n) => n + 1)), []);

  // one-time renderer / scene / camera setup
  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    framedKey.current = ''; // fresh camera → let the rebuild re-frame it
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = skyTexture();
    sceneRef.current = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.55;

    const camera = new THREE.PerspectiveCamera(42, 1, 1, 4000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    camRef.current = { camera, controls };

    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc8bc, 0.35));
    const sun = new THREE.DirectionalLight(0xfff1dd, 2.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.radius = 4;
    scene.add(sun);
    scene.add(sun.target);
    sunRef.current = sun;

    const ground = new THREE.Mesh(new THREE.CircleGeometry(1600, 48), new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    let needs = true;
    invalidate.current = () => {
      needs = true;
    };
    controls.addEventListener('change', () => (needs = true));
    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      needs = true;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    let raf = 0;
    const tick = () => {
      controls.update();
      if (needs) {
        needs = false;
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      groupRef.current?.dispose();
      groupRef.current = null;
      sceneRef.current = null;
      camRef.current = null;
    };
  }, []);

  // rebuild the previewed cabinet whenever the model or alignment changes
  useEffect(() => {
    const scene = sceneRef.current;
    const cam = camRef.current;
    const sun = sunRef.current;
    if (!scene || !cam || !sun) return;
    if (groupRef.current) {
      scene.remove(groupRef.current.group);
      groupRef.current.dispose();
      groupRef.current = null;
    }
    const built = buildDesignGroup(previewDesign(model), fin, [previewAppliance(model)], { [model.key]: align });
    scene.add(built.group);
    groupRef.current = { group: built.group, dispose: built.dispose };

    sun.position.copy(built.center).add(new THREE.Vector3(built.radius, built.radius * 1.4, built.radius * 0.6));
    sun.target.position.copy(built.center);
    const s = built.radius * 1.4;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.camera.far = built.radius * 6;
    sun.shadow.camera.updateProjectionMatrix();

    // only reset the camera when the MODEL changes — keep the orbit while tuning
    if (framedKey.current !== model.key) {
      framedKey.current = model.key;
      cam.camera.position.copy(built.center).add(new THREE.Vector3(built.radius * 0.9, built.radius * 0.6, built.radius * 1.2));
      cam.controls.target.copy(built.center);
      cam.controls.update();
    }
    invalidate.current();
  }, [model, align, fin, ready]);

  return <div className="aligner-preview" ref={mount} />;
}

/** One labeled slider + number box bound to an alignment field. */
function AlignSlider({ label, unit, value, min, max, step, onChange }: { label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="aligner-slider">
      <span className="aligner-slider-label">
        {label} <span className="aligner-slider-unit">{unit}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
      <input
        className="aligner-num"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
      />
    </label>
  );
}

export function ApplianceAlignerModal() {
  const open = useStore((s) => s.alignerOpen);
  const setOpen = useStore((s) => s.setAlignerOpen);
  const storeAligns = useStore((s) => s.modelAligns);
  const setModelAligns = useStore((s) => s.setModelAligns);
  const [draft, setDraft] = useState<ModelAligns>({});
  const [key, setKey] = useState<string>(ALIGNER_MODELS[0].key);

  useEffect(() => {
    if (open) setDraft(storeAligns);
  }, [open, storeAligns]);

  if (!open) return null;
  const model = ALIGNER_MODELS.find((m) => m.key === key) ?? ALIGNER_MODELS[0];
  const align = draft[key] ?? {};
  const setField = (f: keyof ModelAlign, v: number) => setDraft((d) => ({ ...d, [key]: { ...(d[key] ?? {}), [f]: v } }));
  const reset = () =>
    setDraft((d) => {
      const n = { ...d };
      delete n[key];
      return n;
    });

  return (
    <Modal
      title="Appliance model aligner"
      sub="Pick a model, nudge it into place with the sliders (instant preview), then save for all dealers. Adjustments layer on top of the automatic seating — leave a model untouched to keep the default."
      onClose={() => setOpen(false)}
      wide
    >
      <div className="aligner">
        <div className="aligner-controls">
          <label className="aligner-field">
            <span>Model</span>
            <select className="select" value={key} onChange={(e) => setKey(e.target.value)}>
              {ALIGNER_MODELS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                  {draft[m.key] ? ' •' : ''}
                </option>
              ))}
            </select>
          </label>

          <div className="aligner-group-label">Rotation</div>
          <AlignSlider label="Turn (yaw)" unit="°" value={align.yaw ?? 0} min={-180} max={180} step={1} onChange={(v) => setField('yaw', v)} />
          <AlignSlider label="Tip (pitch)" unit="°" value={align.pitch ?? 0} min={-45} max={45} step={1} onChange={(v) => setField('pitch', v)} />
          <AlignSlider label="Tilt (roll)" unit="°" value={align.roll ?? 0} min={-45} max={45} step={1} onChange={(v) => setField('roll', v)} />

          <div className="aligner-group-label">Position</div>
          <AlignSlider label="Left / Right" unit="in" value={align.dx ?? 0} min={-12} max={12} step={0.25} onChange={(v) => setField('dx', v)} />
          <AlignSlider label="Up / Down" unit="in" value={align.dy ?? 0} min={-12} max={12} step={0.25} onChange={(v) => setField('dy', v)} />
          <AlignSlider label="Forward / Back" unit="in" value={align.dz ?? 0} min={-12} max={12} step={0.25} onChange={(v) => setField('dz', v)} />

          <div className="aligner-group-label">Size</div>
          <AlignSlider label="Scale" unit="×" value={align.scale ?? 1} min={0.6} max={1.6} step={0.01} onChange={(v) => setField('scale', v)} />

          <div className="aligner-actions">
            <button className="btn-ghost" onClick={reset}>
              Reset this model
            </button>
          </div>
        </div>

        <AlignerPreview model={model} align={align} />
      </div>

      <SaveGlobalFooter
        onSave={async () => {
          // drop no-op overrides so we don't persist empty adjustments
          const clean: ModelAligns = {};
          for (const [k, v] of Object.entries(draft)) {
            if (!v) continue;
            const moved = (['yaw', 'pitch', 'roll', 'dx', 'dy', 'dz'] as const).some((f) => (v[f] ?? 0) !== 0) || (v.scale != null && v.scale !== 1);
            if (moved) clean[k] = v;
          }
          setModelAligns(clean);
          await api.setModelAligns(clean);
        }}
      />
    </Modal>
  );
}
