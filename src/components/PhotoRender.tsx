import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import type { Design, FinishOption } from '../model/types';
import { useStore } from '../state/store';
import { buildDesignGroup, equirectSkyHDR, groundTexture } from '../three/scene3d';

export interface PhotoCam {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

const TARGET_SAMPLES = 350;

/**
 * Path-traced "photo render" of the current design from the current 3D
 * camera. Renders progressively — the image refines while you watch.
 */
export default function PhotoRender({
  design,
  fin,
  cam,
  onClose,
}: {
  design: Design;
  fin: FinishOption;
  cam: PhotoCam;
  onClose: () => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const [samples, setSamples] = useState(0);
  const [status, setStatus] = useState('Preparing scene…');
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const stopRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const setSnapshot = useStore((s) => s.setSnapshot);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    let disposed = false;
    let raf = 0;

    const W = 1440;
    const H = 900;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    } catch {
      setFailed('WebGL is not available in this browser.');
      return;
    }
    renderer.setPixelRatio(1);
    renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = 'auto';
    el.appendChild(renderer.domElement);
    canvasRef.current = renderer.domElement;

    const scene = new THREE.Scene();
    const sky = equirectSkyHDR();
    scene.environment = sky;
    scene.background = sky;
    scene.backgroundBlurriness = 0.06;

    const built = buildDesignGroup(design, fin);
    scene.add(built.group);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2000, 48),
      new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const camera = new THREE.PerspectiveCamera(cam.fov, W / H, 1, 4000);
    camera.position.copy(cam.pos);
    camera.lookAt(cam.target);
    camera.updateMatrixWorld();

    const pt = new WebGLPathTracer(renderer);
    pt.bounces = 6;
    pt.filterGlossyFactor = 0.5;
    pt.tiles.set(3, 3);
    pt.renderScale = 1;

    (async () => {
      // let the modal paint before the (brief) synchronous BVH build
      await new Promise((r) => setTimeout(r, 50));
      if (disposed) return;
      try {
        pt.setScene(scene, camera);
      } catch (e) {
        if (!disposed) setFailed(`Could not start the path tracer: ${e instanceof Error ? e.message : e}`);
        return;
      }
      if (disposed) return;
      setStatus('');
      const tick = () => {
        if (disposed) return;
        if (!stopRef.current && pt.samples < TARGET_SAMPLES) {
          pt.renderSample();
          const s = Math.floor(pt.samples);
          setSamples(s);
        } else if (!done) {
          setDone(true);
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      try {
        pt.dispose();
      } catch {
        /* path tracer may not have finished init */
      }
      sky.dispose();
      built.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.min(100, Math.round((samples / TARGET_SAMPLES) * 100));
  const usable = samples >= 16;

  function grab(): string | null {
    return canvasRef.current ? canvasRef.current.toDataURL('image/png') : null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-render" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Photo render</h2>
            <p className="modal-sub">
              {failed
                ? failed
                : status ||
                  (done || stopRef.current
                    ? `Finished — ${samples} samples`
                    : `Ray tracing… ${samples} samples (${pct}%) — the image keeps refining`)}
            </p>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        {!failed && (
          <div className="render-progress">
            <div className="render-progress-bar" style={{ width: `${pct}%` }} />
          </div>
        )}
        <div className="render-canvas" ref={mount} />
        <div className="modal-actions">
          {!done && !failed && (
            <button
              className="btn-ghost"
              onClick={() => {
                stopRef.current = true;
                setDone(true);
              }}
              disabled={!usable}
            >
              Stop here
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              className="btn-ghost"
              disabled={!usable}
              onClick={() => {
                const url = grab();
                if (!url) return;
                const a = document.createElement('a');
                a.href = url;
                a.download = `${design.name.replace(/[^\w-]+/g, '_')}-render.png`;
                a.click();
              }}
            >
              Download PNG
            </button>
            <button
              className="btn-primary"
              disabled={!usable}
              onClick={() => {
                const url = grab();
                if (!url) return;
                setSnapshot(url);
                setSavedMsg(true);
                setTimeout(() => setSavedMsg(false), 1800);
              }}
            >
              {savedMsg ? '✓ Saved to report' : 'Use in report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
