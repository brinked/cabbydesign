import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { useStore } from '../state/store';
import View3D from './View3D';

/**
 * Floating, draggable, resizable 3D preview shown over the plan / walls
 * views so the design can be watched live while it's being laid out. A
 * second View3D instance: it owns its own renderer and rebuilds from the
 * same store, so it tracks every edit. Position/size live in component
 * state (session only).
 */
export default function LivePreview() {
  const on = useStore((s) => s.liveView);
  const setOn = useStore((s) => s.setLiveView);
  const [pos, setPos] = useState({ x: 24, y: 96 });
  const [size, setSize] = useState({ w: 440, h: 300 });
  const box = useRef<HTMLDivElement>(null);

  // Track user resizes (CSS resize handle) so the size persists across toggles.
  useEffect(() => {
    const el = box.current;
    if (!el || !on) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [on]);

  // Drag the panel by its title bar: listeners are attached on mousedown
  // (window-level, so a fast drag that leaves the bar keeps tracking) and
  // removed on mouseup.
  const startDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const dx = e.clientX - pos.x;
    const dy = e.clientY - pos.y;
    const move = (ev: MouseEvent) => setPos({ x: Math.max(0, ev.clientX - dx), y: Math.max(56, ev.clientY - dy) });
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  if (!on) return null;
  return (
    <div
      ref={box}
      className="live-preview no-print"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      <div
        className="live-preview-bar"
        onMouseDown={startDrag}
      >
        <span>Live 3D</span>
        <span style={{ display: 'inline-flex', gap: 6 }}>
          <button className="live-preview-btn" title="Small" onClick={() => setSize({ w: 320, h: 220 })}>
            S
          </button>
          <button className="live-preview-btn" title="Medium" onClick={() => setSize({ w: 440, h: 300 })}>
            M
          </button>
          <button className="live-preview-btn" title="Large" onClick={() => setSize({ w: 640, h: 430 })}>
            L
          </button>
          <button className="live-preview-btn" title="Close" onClick={() => setOn(false)}>
            ×
          </button>
        </span>
      </div>
      <div className="live-preview-body">
        <View3D mini />
      </div>
    </div>
  );
}
