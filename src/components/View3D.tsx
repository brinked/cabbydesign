import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useStore } from '../state/store';
import { buildDesignGroup, groundTexture, skyTexture } from '../three/scene3d';
import PhotoRender, { type PhotoCam } from './PhotoRender';
import { useFinish } from './WallsView';

export default function View3D() {
  const mount = useRef<HTMLDivElement>(null);
  const design = useStore((s) => s.design);
  const fin = useFinish(design.finishId);
  const appliances = useStore((s) => s.appliances);
  const modelAligns = useStore((s) => s.modelAligns);
  const modelsReady = useStore((s) => s.modelsReady);
  const setSnapshot = useStore((s) => s.setSnapshot);
  const [saved, setSaved] = useState(false);
  const [photoCam, setPhotoCam] = useState<PhotoCam | null>(null);

  const captureRef = useRef<(() => string) | null>(null);
  const camRef = useRef<{ camera: THREE.PerspectiveCamera; controls: OrbitControls } | null>(null);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = skyTexture();

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
    sun.shadow.blurSamples = 8;
    sun.shadow.bias = -0.0004;
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(1600, 48),
      new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const { group, center, radius, dispose } = buildDesignGroup(design, fin, appliances, modelAligns);
    scene.add(group);

    sun.position.copy(center).add(new THREE.Vector3(radius, radius * 1.4, radius * 0.6));
    sun.target.position.copy(center);
    scene.add(sun.target);
    const s = radius * 1.4;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.camera.far = radius * 6;

    camera.position.copy(center).add(new THREE.Vector3(radius * 1.1, radius * 0.8, radius * 1.25));
    controls.target.copy(center);

    let needsRender = true;
    controls.addEventListener('change', () => {
      needsRender = true;
    });

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      needsRender = true;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let raf = 0;
    const tick = () => {
      controls.update();
      if (needsRender) {
        needsRender = false;
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();

    captureRef.current = () => {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      dispose();
      camRef.current = null;
    };
  }, [design, fin, appliances, modelAligns, modelsReady]);

  return (
    <div className="view3d">
      <div className="view3d-canvas" ref={mount} />
      <div className="view3d-bar">
        <span>Drag to orbit · scroll to zoom · right-drag to pan</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-ghost"
            onClick={() => {
              if (captureRef.current) {
                setSnapshot(captureRef.current());
                setSaved(true);
                setTimeout(() => setSaved(false), 1800);
              }
            }}
          >
            {saved ? '✓ Saved to report' : 'Quick snapshot'}
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              const c = camRef.current;
              if (!c) return;
              setPhotoCam({ pos: c.camera.position.clone(), target: c.controls.target.clone(), fov: c.camera.fov });
            }}
          >
            ✨ Photo render
          </button>
        </div>
      </div>
      {photoCam && <PhotoRender design={design} fin={fin} cam={photoCam} onClose={() => setPhotoCam(null)} />}
    </div>
  );
}
