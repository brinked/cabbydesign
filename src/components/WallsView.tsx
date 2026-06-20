import { useRef, useState } from 'react';
import type { FinishOption, PlacedItem, Wall } from '../model/types';
import { BASE_H, COUNTER_OVERHANG, COUNTER_T, FINISHES, catalogById } from '../model/catalog';
import { isReserveExempt, type CornerReserve } from '../model/geometry';
import { footprintW, laneItems, reservesFor, roughInBand, roughInConflict, roughInHost, spaceLeft, useStore } from '../state/store';
import { ElevationCabinet } from './CabinetImage';
import { NumberField } from './NumberField';
import { DimH, DimV, RoughInGlyph, fmtIn } from './svg';

const SNAP = 1.25; // inches

/** Contiguous runs of counter-topped floor items. */
function counterRuns(items: PlacedItem[]): Array<{ x1: number; x2: number }> {
  const tops = items
    .filter((it) => catalogById(it.catalogId).counter)
    .sort((a, b) => a.x - b.x);
  const runs: Array<{ x1: number; x2: number }> = [];
  for (const it of tops) {
    const last = runs[runs.length - 1];
    if (last && it.x <= last.x2 + 0.2) last.x2 = Math.max(last.x2, it.x + footprintW(it));
    else runs.push({ x1: it.x, x2: it.x + footprintW(it) });
  }
  return runs;
}

export interface ElevationProps {
  wall: Wall;
  items: PlacedItem[];
  fin: FinishOption;
  interactive?: boolean;
  showHeightDim?: boolean;
  numbers?: Map<string, number>;
  reserve?: CornerReserve;
  /** 1 = fit the card; >1 widens the svg so the card scrolls horizontally. */
  zoom?: number;
}

export function WallElevationSvg({
  wall,
  items,
  fin,
  interactive = false,
  showHeightDim = false,
  numbers,
  reserve = { start: 0, end: 0 },
  zoom = 1,
}: ElevationProps) {
  const selectedId = useStore((s) => s.selectedId);
  const moveItem = useStore((s) => s.moveItem);
  const reflowAll = useStore((s) => s.reflowAll);
  const openEditor = useStore((s) => s.openEditor);
  const select = useStore((s) => s.select);
  const design = useStore((s) => s.design);
  const openRoughIn = useStore((s) => s.openRoughIn);
  const updateRoughIn = useStore((s) => s.updateRoughIn);
  const editingRoughInId = useStore((s) => s.editingRoughInId);
  const wallRoughIns = design.roughIns.filter((r) => r.wallId === wall.id);

  const wallItems = items.filter((it) => it.wallId === wall.id);
  const floorY = wall.height;
  const M = showHeightDim ? 14 : 6;
  const dimSpace = 22;
  const topPad = 8;
  const viewW = wall.length + M * 2;
  const viewH = wall.height + topPad + dimSpace;

  const floorItems = laneItems(wallItems, wall.id, 'floor');
  const runs = counterRuns(floorItems);
  const cT = design.counterThickness ?? COUNTER_T;

  // Dimension boundaries along the floor lane
  const edges = new Set<number>([0, wall.length]);
  for (const it of floorItems) {
    edges.add(Math.round(it.x * 100) / 100);
    edges.add(Math.round((it.x + footprintW(it)) * 100) / 100);
  }
  const sortedEdges = [...edges].sort((a, b) => a - b);

  const drag = useRef<{ id: string; startClientX: number; startX: number; scale: number; moved: boolean } | null>(null);

  function onPointerDown(e: React.PointerEvent, it: PlacedItem) {
    if (!interactive) return;
    const svg = (e.currentTarget as SVGGElement).ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    drag.current = {
      id: it.id,
      startClientX: e.clientX,
      startX: it.x,
      scale: rect.width / viewW,
      moved: false,
    };
    (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
    select(it.id);
  }

  function onPointerMove(e: React.PointerEvent, it: PlacedItem) {
    const d = drag.current;
    if (!d || d.id !== it.id) return;
    const dxPx = e.clientX - d.startClientX;
    if (Math.abs(dxPx) > 3) d.moved = true;
    if (!d.moved) return;
    const cat = catalogById(it.catalogId);
    const fpw = footprintW(it);
    const exempt = isReserveExempt(cat) || cat.lane === 'upper';
    const lo = exempt ? 0 : reserve.start;
    const hi = (exempt ? wall.length : wall.length - reserve.end) - fpw;
    let x = d.startX + dxPx / d.scale;
    x = Math.max(lo, Math.min(x, hi));
    // Snap to bounds and neighbor edges
    const candidates: number[] = [lo, hi];
    for (const other of laneItems(wallItems, wall.id, cat.lane)) {
      if (other.id === it.id) continue;
      candidates.push(other.x - fpw, other.x + footprintW(other));
    }
    for (const c of candidates) {
      if (c >= lo - 0.001 && c <= hi + 0.001 && Math.abs(x - c) <= SNAP) {
        x = c;
        break;
      }
    }
    moveItem(it.id, Math.round(x * 8) / 8);
  }

  function onPointerUp(e: React.PointerEvent, it: PlacedItem) {
    const d = drag.current;
    if (!d || d.id !== it.id) return;
    drag.current = null;
    if (d.moved) reflowAll();
    else openEditor(it.id);
  }

  // --- rough-in (plumbing / electrical) drag: 2D move with live dimensions ---
  const roughDrag = useRef<{
    id: string;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    scale: number;
    moved: boolean;
  } | null>(null);
  const [draggingRoughId, setDraggingRoughId] = useState<string | null>(null);

  function onRoughDown(e: React.PointerEvent, r: (typeof wallRoughIns)[number]) {
    if (!interactive) return;
    e.stopPropagation();
    const svg = (e.currentTarget as SVGGElement).ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // viewBox is letterboxed (preserveAspectRatio meet) → one uniform scale.
    const scale = Math.min(rect.width / viewW, rect.height / viewH);
    roughDrag.current = { id: r.id, startClientX: e.clientX, startClientY: e.clientY, startX: r.x, startY: r.y, scale, moved: false };
    try {
      (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
    } catch {
      /* no active pointer (e.g. synthetic events) — drag still works */
    }
    select(null);
  }

  function onRoughMove(e: React.PointerEvent, r: (typeof wallRoughIns)[number]) {
    const d = roughDrag.current;
    if (!d || d.id !== r.id) return;
    const dxPx = e.clientX - d.startClientX;
    const dyPx = e.clientY - d.startClientY;
    if (!d.moved) {
      if (Math.abs(dxPx) < 3 && Math.abs(dyPx) < 3) return;
      d.moved = true;
      setDraggingRoughId(r.id);
    }
    // horizontal: clamp to wall, then to the host cabinet's clearance band so it
    // always clears the cabinet ends (and applied end panels) by 1″ / 2″.
    let cx = d.startX + dxPx / d.scale;
    cx = Math.max(r.w / 2, Math.min(cx, wall.length - r.w / 2));
    const host = roughInHost(design, { ...r, x: cx });
    if (host) {
      const band = roughInBand(host, r.w);
      if (band.lo <= band.hi) cx = Math.max(band.lo, Math.min(cx, band.hi));
    }
    // vertical: height of center off the floor; dragging up raises it.
    let cy = d.startY - dyPx / d.scale;
    cy = Math.max(r.h / 2, Math.min(cy, wall.height - r.h / 2));
    updateRoughIn(r.id, { x: Math.round(cx * 8) / 8, y: Math.round(cy * 8) / 8 });
  }

  function onRoughUp(e: React.PointerEvent, r: (typeof wallRoughIns)[number]) {
    const d = roughDrag.current;
    if (!d || d.id !== r.id) return;
    roughDrag.current = null;
    setDraggingRoughId(null);
    if (!d.moved) openRoughIn(r.id); // a click (no drag) opens the numeric editor
  }

  return (
    <svg
      viewBox={`${-M} ${-topPad} ${viewW} ${viewH}`}
      style={
        zoom > 1
          ? { width: `${zoom * 100}%`, display: 'block', fontFamily: 'inherit' }
          : { width: '100%', maxHeight: interactive ? '58vh' : undefined, display: 'block', margin: '0 auto', fontFamily: 'inherit' }
      }
      className="elevation-svg"
    >
      {/* wall background (omitted for island runs) */}
      {!wall.ghost && (
        <rect x={0} y={0} width={wall.length} height={wall.height} fill="#fbfbfc" stroke="#e3e6ea" strokeWidth={0.3} />
      )}
      {/* floor line */}
      <line x1={-M} y1={floorY} x2={wall.length + M} y2={floorY} stroke="#c9cdd3" strokeWidth={0.5} />

      {/* reserved corner zones */}
      {reserve.start > 0 && (
        <g>
          <rect x={0} y={floorY - BASE_H - COUNTER_T} width={reserve.start} height={BASE_H + COUNTER_T} fill="url(#p-hatch)" opacity={0.7} />
          <text x={reserve.start / 2} y={floorY - BASE_H - COUNTER_T - 2} textAnchor="middle" fontSize={3} fill="#8d96a5">
            corner
          </text>
        </g>
      )}
      {reserve.end > 0 && (
        <g>
          <rect x={wall.length - reserve.end} y={floorY - BASE_H - COUNTER_T} width={reserve.end} height={BASE_H + COUNTER_T} fill="url(#p-hatch)" opacity={0.7} />
          <text x={wall.length - reserve.end / 2} y={floorY - BASE_H - COUNTER_T - 2} textAnchor="middle" fontSize={3} fill="#8d96a5">
            corner
          </text>
        </g>
      )}

      {/* floor contact shadows */}
      {floorItems.map((it) => (
        <ellipse
          key={`sh-${it.id}`}
          cx={it.x + footprintW(it) / 2}
          cy={floorY - 0.2}
          rx={footprintW(it) / 2 + 1}
          ry={1.4}
          fill="#000"
          opacity={0.13}
          filter="url(#f-soft)"
        />
      ))}

      {/* items */}
      {wallItems.map((it) => {
        const cat = catalogById(it.catalogId);
        const y = floorY - it.mount - it.h;
        const sel = selectedId === it.id;
        return (
          <g
            key={it.id}
            transform={`translate(${it.x} ${y})`}
            style={{ cursor: interactive ? 'grab' : 'default' }}
            onPointerDown={(e) => onPointerDown(e, it)}
            onPointerMove={(e) => onPointerMove(e, it)}
            onPointerUp={(e) => onPointerUp(e, it)}
          >
            <ElevationCabinet cat={cat} it={it} fin={fin} wallLength={wall.length} />
            {numbers && (
              <g>
                <circle cx={footprintW(it) / 2} cy={it.h / 2} r={3.4} fill="#fff" stroke="#5b6472" strokeWidth={0.35} />
                <text x={footprintW(it) / 2} y={it.h / 2 + 1.3} textAnchor="middle" fontSize={3.6} fill="#33394a" fontWeight={600}>
                  {numbers.get(it.id)}
                </text>
              </g>
            )}
            {sel && interactive && (
              <rect
                x={-0.8}
                y={-0.8 - (cat.topGearH ?? 0) - (cat.counter ? COUNTER_T : 0)}
                width={footprintW(it) + 1.6}
                height={it.h + 1.6 + (cat.topGearH ?? 0) + (cat.counter ? COUNTER_T : 0)}
                fill="none"
                stroke="#5b5bd6"
                strokeWidth={0.6}
                strokeDasharray="2 1.5"
                rx={0.8}
              />
            )}
          </g>
        );
      })}

      {/* counters drawn over the carcasses, with a shadow band under the nose */}
      {runs.map((r, i) => {
        const x1 = Math.max(r.x1 - COUNTER_OVERHANG, 0);
        const x2 = Math.min(r.x2 + COUNTER_OVERHANG, wall.length);
        const cy = floorY - BASE_H - cT;
        return (
          <g key={`c-${i}`}>
            <rect x={x1} y={cy + cT} width={x2 - x1} height={1.6} fill="url(#g-undercounter)" />
            <rect x={x1} y={cy} width={x2 - x1} height={cT} rx={0.35} fill={fin.counter} stroke="rgba(0,0,0,0.22)" strokeWidth={0.2} />
            <rect x={x1} y={cy} width={x2 - x1} height={cT} rx={0.35} fill="url(#g-counter)" />
            <line x1={x1 + 0.3} y1={cy + 0.25} x2={x2 - 0.3} y2={cy + 0.25} stroke="#ffffff" strokeWidth={0.25} opacity={0.55} />
          </g>
        );
      })}

      {/* waterfall edges — countertop wrapping down a run-end side to the floor */}
      {floorItems.map((it) => {
        const cat = catalogById(it.catalogId);
        if (!cat.counter) return null;
        const cy = floorY - BASE_H - cT;
        const sides: Array<{ side: 'L' | 'R'; x: number }> = [];
        if (it.waterfallL) sides.push({ side: 'L', x: it.x - cT });
        if (it.waterfallR) sides.push({ side: 'R', x: it.x + footprintW(it) });
        return sides.map(({ side, x }) => (
          <g key={`wf-${it.id}-${side}`}>
            <rect x={x} y={cy} width={cT} height={BASE_H + cT} fill={fin.counter} stroke="rgba(0,0,0,0.22)" strokeWidth={0.2} />
            <rect x={x} y={cy} width={cT} height={BASE_H + cT} fill="url(#g-counter)" />
          </g>
        ));
      })}

      {/* plumbing / electrical rough-ins — draggable in 2D */}
      {wallRoughIns.map((r) => {
        const conflict = roughInConflict(design, r);
        const gx = r.x - r.w / 2;
        const gy = floorY - r.y - r.h / 2;
        const dragging = draggingRoughId === r.id;
        const sel = editingRoughInId === r.id || dragging;
        return (
          <g key={r.id}>
            {/* live distance read-outs while dragging: height off floor + from wall */}
            {dragging && (
              <g className="rough-dims">
                <line x1={gx} y1={floorY} x2={gx} y2={floorY - r.y} stroke="#5b5bd6" strokeWidth={0.3} strokeDasharray="1.5 1" />
                <line x1={0} y1={floorY - r.y} x2={r.x} y2={floorY - r.y} stroke="#5b5bd6" strokeWidth={0.3} strokeDasharray="1.5 1" />
                <DimV y1={floorY - r.y} y2={floorY} x={gx - 3} label={`${fmtIn(r.y)} ↑`} />
                <DimH x1={0} x2={r.x} y={floorY - r.y - 2} label={`${fmtIn(r.x)} →`} />
              </g>
            )}
            <g
              data-roughin={r.id}
              transform={`translate(${gx} ${gy})`}
              style={{ cursor: interactive ? (dragging ? 'grabbing' : 'grab') : 'default' }}
              onPointerDown={(e) => onRoughDown(e, r)}
              onPointerMove={(e) => onRoughMove(e, r)}
              onPointerUp={(e) => onRoughUp(e, r)}
            >
              <RoughInGlyph kind={r.kind} w={r.w} h={r.h} conflict={conflict} />
              {sel && interactive && (
                <rect x={-1} y={-1} width={r.w + 2} height={r.h + 2} fill="none" stroke="#5b5bd6" strokeWidth={0.6} strokeDasharray="2 1.5" rx={1} />
              )}
            </g>
          </g>
        );
      })}

      {/* dimensions */}
      {sortedEdges.slice(0, -1).map((x1, i) => {
        const x2 = sortedEdges[i + 1];
        if (x2 - x1 < 0.5) return null;
        return <DimH key={i} x1={x1} x2={x2} y={floorY + 7} />;
      })}
      <DimH x1={0} x2={wall.length} y={floorY + 15} />
      {showHeightDim && <DimV y1={0} y2={wall.height} x={-7} />}
    </svg>
  );
}

function WallCard({ wall, index }: { wall: Wall; index: number }) {
  const design = useStore((s) => s.design);
  const updateWall = useStore((s) => s.updateWall);
  const removeWall = useStore((s) => s.removeWall);
  const openAdd = useStore((s) => s.openAdd);
  const addRoughIn = useStore((s) => s.addRoughIn);
  const finish = useStore((s) => s.design.finishId);
  const fin = useFinish(finish);

  const left = spaceLeft(design, wall.id, 'floor');
  const reserve = reservesFor(design).get(wall.id);
  const [zoom, setZoom] = useState(1);

  return (
    <div className="wall-card">
      <div className="wall-card-head">
        <span className="wall-badge">{index + 1}</span>
        <input
          className="wall-name"
          value={wall.name}
          onChange={(e) => updateWall(wall.id, { name: e.target.value })}
        />
        <span className="space-left">
          Space left: <b>{fmtIn(Math.max(0, left))}</b>
        </span>
        <label className="wall-dim-field">
          Length
          <NumberField value={wall.length} min={12} max={600} onCommit={(length) => updateWall(wall.id, { length })} />
        </label>
        <label className="wall-dim-field">
          Height
          <NumberField value={wall.height} min={36} max={144} disabled={wall.ghost} onCommit={(height) => updateWall(wall.id, { height })} />
        </label>
        <label className="wall-dim-field">
          Thick.
          <NumberField value={wall.thickness} min={0} max={12} step={0.5} round={0.25} disabled={wall.ghost} title="Set to 0 for an island (no wall)" onCommit={(thickness) => updateWall(wall.id, { thickness })} />
        </label>
        <label className="wall-dim-field wall-island" title="No physical wall — island/peninsula run">
          <input
            type="checkbox"
            checked={wall.ghost}
            onChange={(e) => updateWall(wall.id, { ghost: e.target.checked })}
          />
          Island
        </label>
        <div className="zoom-ctl zoom-ctl-inline">
          <button title="Zoom out" onClick={() => setZoom((z) => Math.max(1, Math.round((z / 1.25) * 100) / 100))} disabled={zoom <= 1}>
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button title="Zoom in" onClick={() => setZoom((z) => Math.min(5, Math.round(z * 1.25 * 100) / 100))}>
            +
          </button>
        </div>
        {design.walls.length > 1 && (
          <button className="btn-ghost" title="Remove wall" onClick={() => removeWall(wall.id)}>
            ✕
          </button>
        )}
        <button className="btn-soft" title="Add a plumbing stub-out" onClick={() => addRoughIn(wall.id, 'plumbing')}>
          + Plumbing
        </button>
        <button className="btn-soft" title="Add an electrical outlet" onClick={() => addRoughIn(wall.id, 'electrical')}>
          + Electrical
        </button>
        <button className="btn-dark" onClick={() => openAdd(wall.id)}>
          + Add
        </button>
      </div>
      <div className="wall-card-body" style={zoom > 1 ? { overflowX: 'auto' } : undefined}>
        <WallElevationSvg wall={wall} items={design.items} fin={fin} interactive reserve={reserve} zoom={zoom} />
      </div>
    </div>
  );
}

export function useFinish(id: string): FinishOption {
  return FINISHES.find((f) => f.id === id) ?? FINISHES[0];
}

export default function WallsView() {
  const walls = useStore((s) => s.design.walls);
  const addWall = useStore((s) => s.addWall);
  const setTab = useStore((s) => s.setTab);

  return (
    <div className="walls-view">
      {walls.map((w, i) => (
        <WallCard key={w.id} wall={w} index={i} />
      ))}
      <div className="walls-actions">
        <button className="add-wall" onClick={addWall}>
          + Add wall / run
        </button>
        <button className="add-wall" onClick={() => setTab('plan')}>
          ✏ Draw walls in Top View
        </button>
      </div>
    </div>
  );
}
