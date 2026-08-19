import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { polyArea, polyCenter, snapIn, type CounterPt } from '../model/counterShape';
import { useStore } from '../state/store';

/**
 * Plan-view countertop editor for ONE wall, rendered inside that wall's
 * local <g> (x along the wall, y = depth; negative y = behind the wall
 * line). Starts from the wall's auto outline(s) and lets the designer:
 *   - drag a corner handle to reshape (snaps to 1/2")
 *   - click a midpoint (+) to insert a corner
 *   - double-click a corner to remove it (min 3 per polygon)
 *   - drag the polygon body to move the whole piece
 *   - Reset to auto clears the manual shape
 * Edits commit to the store on pointer-up (one undo step per drag).
 */
export default function CounterEditor({
  wallId,
  autoPolys,
  toSvg,
  scale,
}: {
  wallId: string;
  autoPolys: CounterPt[][];
  /** client (x,y) -> this wall's local coords */
  toSvg: (clientX: number, clientY: number) => { x: number; y: number };
  /** plan units per CSS pixel (for handle sizes) */
  scale: number;
}) {
  const shape = useStore((s) => s.design.counterShapes?.[wallId]);
  const setCounterShape = useStore((s) => s.setCounterShape);
  const [draft, setDraft] = useState<CounterPt[][] | null>(null);
  const [sel, setSel] = useState<{ poly: number; pt: number } | null>(null);
  const polys = draft ?? shape?.polys ?? autoPolys;
  const dragging = useRef(false);

  // Drop the local draft when the stored shape changes from outside (undo).
  useEffect(() => {
    if (!dragging.current) setDraft(null);
  }, [shape]);

  const h = 3.2 * scale; // handle half-size in plan units (~6px)
  const commit = (next: CounterPt[][]) => {
    setDraft(null);
    setCounterShape(wallId, { polys: next });
  };

  const startPointDrag = (e: React.PointerEvent, pi: number, vi: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    dragging.current = true;
    setSel({ poly: pi, pt: vi });
    let cur = polys.map((p) => p.map((q) => ({ ...q })));
    const move = (ev: PointerEvent) => {
      const p = toSvg(ev.clientX, ev.clientY);
      cur = cur.map((poly, a) => (a !== pi ? poly : poly.map((q, b) => (b !== vi ? q : { x: snapIn(p.x), z: snapIn(p.y) }))));
      setDraft(cur);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dragging.current = false;
      commit(cur);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startBodyDrag = (e: React.PointerEvent, pi: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    dragging.current = true;
    const origin = toSvg(e.clientX, e.clientY);
    const base = polys.map((p) => p.map((q) => ({ ...q })));
    let cur = base;
    const move = (ev: PointerEvent) => {
      const p = toSvg(ev.clientX, ev.clientY);
      const dx = snapIn(p.x - origin.x);
      const dz = snapIn(p.y - origin.y);
      cur = base.map((poly, a) => (a !== pi ? poly : poly.map((q) => ({ x: q.x + dx, z: q.z + dz }))));
      setDraft(cur);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dragging.current = false;
      commit(cur);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const insertPoint = (pi: number, afterIdx: number) => {
    const poly = polys[pi];
    const a = poly[afterIdx];
    const b = poly[(afterIdx + 1) % poly.length];
    const mid = { x: snapIn((a.x + b.x) / 2), z: snapIn((a.z + b.z) / 2) };
    const next = polys.map((p, i) => (i !== pi ? p : [...p.slice(0, afterIdx + 1), mid, ...p.slice(afterIdx + 1)]));
    commit(next);
    setSel({ poly: pi, pt: afterIdx + 1 });
  };

  const removePoint = (pi: number, vi: number) => {
    if (polys[pi].length <= 3) return;
    commit(polys.map((p, i) => (i !== pi ? p : p.filter((_, j) => j !== vi))));
    setSel(null);
  };

  const fmt = (v: number) => (Math.abs(v - Math.round(v)) < 0.01 ? `${Math.round(v)}` : v.toFixed(1));

  return (
    <g className="counter-editor">
      {polys.map((poly, pi) => {
        const pts = poly.map((p) => `${p.x},${p.z}`).join(' ');
        const c = polyCenter(poly);
        return (
          <g key={pi}>
            <polygon
              points={pts}
              fill="rgba(91,91,214,0.18)"
              stroke="#5b5bd6"
              strokeWidth={0.8 * scale}
              strokeDasharray={`${3 * scale} ${2 * scale}`}
              style={{ cursor: 'move' }}
              onPointerDown={(e) => startBodyDrag(e, pi)}
            />
            {/* edge midpoints: click to add a corner */}
            {poly.map((p, i) => {
              const q = poly[(i + 1) % poly.length];
              const mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2;
              const len = Math.hypot(q.x - p.x, q.z - p.z);
              return (
                <g key={`m${i}`}>
                  <circle
                    cx={mx}
                    cy={mz}
                    r={h * 0.75}
                    fill="#fff"
                    stroke="#5b5bd6"
                    strokeWidth={0.6 * scale}
                    style={{ cursor: 'copy' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      insertPoint(pi, i);
                    }}
                  >
                    <title>Click to add a corner here</title>
                  </circle>
                  <text x={mx} y={mz - h * 1.4} fontSize={4.2 * scale} textAnchor="middle" fill="#2c3345" style={{ pointerEvents: 'none', fontWeight: 700 }}>
                    {fmt(len)}″
                  </text>
                </g>
              );
            })}
            {/* corner handles */}
            {poly.map((p, i) => {
              const isSel = sel?.poly === pi && sel.pt === i;
              return (
                <rect
                  key={`p${i}`}
                  x={p.x - h}
                  y={p.z - h}
                  width={h * 2}
                  height={h * 2}
                  fill={isSel ? '#5b5bd6' : '#fff'}
                  stroke="#5b5bd6"
                  strokeWidth={0.8 * scale}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => startPointDrag(e, pi, i)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    removePoint(pi, i);
                  }}
                >
                  <title>Drag to reshape · double-click to remove this corner</title>
                </rect>
              );
            })}
            <text x={c.x} y={c.z} fontSize={4.5 * scale} textAnchor="middle" fill="#2c3345" style={{ pointerEvents: 'none', fontWeight: 700 }}>
              {(polyArea(poly) / 144).toFixed(1)} sq ft
            </text>
          </g>
        );
      })}
    </g>
  );
}
