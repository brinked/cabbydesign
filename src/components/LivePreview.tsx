import { useEffect, useRef, useState } from 'react';
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
  const drag = useRef<{ dx: number; dy: number } | null>(null);
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

  useEffect(() => {
    if (!drag.current) return;
    const move = (e: MouseEvent) => {
      if (!drag.current) return;
      setPos({ x: Math.max(0, e.clientX - drag.current.dx), y: Math.max(56, e.clientY - drag.current.dy) });
    };
    const up = () => {
      drag.current = null;
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  });

  if (!on) return null;
  return (
    <div
      ref={box}
      className="live-preview no-print"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      <div
        className="live-preview-bar"
        onMouseDown={(e) => {
          drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
          e.preventDefault();
        }}
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
