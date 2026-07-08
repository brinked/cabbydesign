import { useEffect, useRef, useState } from 'react';
import { COUNTER_OVERHANG, catalogById } from '../model/catalog';
import { WALL_T, cornerNeedsFlip, frameForWall, isCornerFront, isReserveExempt, planBounds, wallEndpoints, wallSlabPolygonLocal, wallSnapPoints } from '../model/geometry';
import type { MeasureEnd, Measurement, PlacedItem, Wall } from '../model/types';
import { footprintW, itemNumbers, laneItems, reservesFor, roughInConflict, uid, useStore } from '../state/store';
import { NumberField } from './NumberField';
import { useFinish } from './WallsView';
import { CabinetTop, DimH, fmtIn, susanCounterPts } from './svg';

const SNAP = 1.25; // inches, item snapping
const END_SNAP = 8; // inches, wall endpoint snapping

/**
 * Corner cabinets (susan/diagonal/blind) sit on one wall but their deep leg
 * runs along the perpendicular wall too. This reports, for `wall`, how far each
 * such cabinet from a neighbouring wall projects into it (and from which end),
 * so the dimension breakdown can show that leg on this wall as well.
 */
function cornerCabinetProjections(wall: Wall, walls: Wall[], items: PlacedItem[]): Array<{ fromStart: boolean; length: number }> {
  const EPS = 2;
  const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
  const me = wallEndpoints(wall);
  const out: Array<{ fromStart: boolean; length: number }> = [];
  for (const other of walls) {
    if (other.id === wall.id) continue;
    const oe = wallEndpoints(other);
    for (const it of items) {
      if (it.wallId !== other.id) continue;
      const c = catalogById(it.catalogId);
      if (!isCornerFront(c)) continue;
      const fw = footprintW(it);
      // the wall end the corner cabinet is against, and how far it reaches in
      const atStart = it.x <= other.length - (it.x + fw);
      const corner = atStart ? oe.p0 : oe.p1;
      // The applied end on the leg facing THIS wall (the non-own-wall end)
      // extends the projection here by its 0.75″ panel. On the other wall the
      // own tip is away from its corner, so the perpendicular end is the one on
      // the corner side: left-half → left end, right-half → right end.
      const onLeftHalf = it.x + it.w / 2 <= other.length / 2;
      const perpEnd = onLeftHalf ? !!it.endL : !!it.endR;
      const length = it.d + it.outset + (perpEnd ? 0.75 : 0);
      if (dist(corner.x, corner.y, me.p0.x, me.p0.y) < EPS) out.push({ fromStart: true, length });
      else if (dist(corner.x, corner.y, me.p1.x, me.p1.y) < EPS) out.push({ fromStart: false, length });
    }
  }
  return out;
}

function planCounterRuns(items: PlacedItem[]): Array<{ x1: number; x2: number; d: number }> {
  // lazy-susan cabinets get their own L-shaped counter, so exclude them from runs
  const tops = items.filter((it) => catalogById(it.catalogId).counter && catalogById(it.catalogId).front !== 'susan').sort((a, b) => a.x - b.x);
  const runs: Array<{ x1: number; x2: number; d: number }> = [];
  for (const it of tops) {
    const last = runs[runs.length - 1];
    if (last && it.x <= last.x2 + 0.2) {
      last.x2 = Math.max(last.x2, it.x + footprintW(it));
      last.d = Math.max(last.d, it.d + it.outset);
    } else {
      runs.push({ x1: it.x, x2: it.x + footprintW(it), d: it.d + it.outset });
    }
  }
  return runs;
}

function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: pt.x, y: pt.y };
}

type Draft = { x1: number; y1: number; x2: number; y2: number; len: number; angle: number };

type Tool = 'select' | 'draw' | 'measure';

export function TopViewSvg({ interactive = false, tool = 'select' as Tool, measureTarget, onToolDone }: { interactive?: boolean; tool?: Tool; measureTarget?: number; onToolDone?: () => void }) {
  const design = useStore((s) => s.design);
  const openEditor = useStore((s) => s.openEditor);
  const openRoughIn = useStore((s) => s.openRoughIn);
  const selectedId = useStore((s) => s.selectedId);
  const moveItem = useStore((s) => s.moveItem);
  const reflowAll = useStore((s) => s.reflowAll);
  const select = useStore((s) => s.select);
  const updateWall = useStore((s) => s.updateWall);
  const addWallAt = useStore((s) => s.addWallAt);
  const addMeasurement = useStore((s) => s.addMeasurement);
  const removeMeasurement = useStore((s) => s.removeMeasurement);
  const fin = useFinish(design.finishId);
  const measurements = design.measurements ?? [];

  const frames = design.walls.map(frameForWall);
  const bounds = planBounds(frames, tool === 'draw' ? 80 : 40);
  const numbers = itemNumbers(design);
  const reserves = reservesFor(design);

  // zoom/pan: null = fit to design
  const [view, setView] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const vb = interactive && view ? view : bounds;
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const viewRef = useRef(view);
  viewRef.current = view;
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null);
  const panRef = useRef<{ clientX: number; clientY: number; view: { x: number; y: number; w: number; h: number }; scale: number } | null>(null);

  // native wheel listener — React's synthetic wheel can't preventDefault
  useEffect(() => {
    if (!svgEl || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const k = e.deltaY > 0 ? 1.18 : 1 / 1.18;
      const b = boundsRef.current;
      const cur = viewRef.current ?? b;
      const p = svgPoint(svgEl, e.clientX, e.clientY);
      const w = Math.max(b.w / 10, Math.min(cur.w * k, b.w * 4));
      const scale = w / cur.w;
      setView({ x: p.x - (p.x - cur.x) * scale, y: p.y - (p.y - cur.y) * scale, w, h: cur.h * scale });
    };
    svgEl.addEventListener('wheel', onWheel, { passive: false });
    return () => svgEl.removeEventListener('wheel', onWheel);
  }, [svgEl, interactive]);

  const zoomBy = (k: number) => {
    const b = boundsRef.current;
    const cur = viewRef.current ?? b;
    const w = Math.max(b.w / 10, Math.min(cur.w * k, b.w * 4));
    const scale = w / cur.w;
    const cx = cur.x + cur.w / 2;
    const cy = cur.y + cur.h / 2;
    setView({ x: cx - w / 2, y: cy - (cur.h * scale) / 2, w, h: cur.h * scale });
  };

  function bgPanDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!interactive || tool !== 'select') return;
    if (e.target !== e.currentTarget) return; // only empty background
    const rect = e.currentTarget.getBoundingClientRect();
    const cur = viewRef.current ?? boundsRef.current;
    panRef.current = { clientX: e.clientX, clientY: e.clientY, view: { ...cur }, scale: cur.w / rect.width };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function bgPanMove(e: React.PointerEvent<SVGSVGElement>) {
    const p = panRef.current;
    if (!p) return;
    setView({
      x: p.view.x - (e.clientX - p.clientX) * p.scale,
      y: p.view.y - (e.clientY - p.clientY) * p.scale,
      w: p.view.w,
      h: p.view.h,
    });
  }

  function bgPanUp() {
    panRef.current = null;
  }

  const [draft, setDraft] = useState<Draft | null>(null);
  const itemDrag = useRef<{ id: string; wallId: string; startPt: { x: number; y: number }; startX: number; moved: boolean } | null>(null);
  const wallDrag = useRef<{ id: string; startPt: { x: number; y: number }; origX: number; origY: number; moved: boolean } | null>(null);

  const allEndpoints = (excludeId?: string) =>
    design.walls.filter((w) => w.id !== excludeId).flatMap((w) => wallSnapPoints(w));

  const snapToEndpoints = (p: { x: number; y: number }, excludeId?: string) => {
    let best = p;
    let bestD = END_SNAP;
    for (const e of allEndpoints(excludeId)) {
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < bestD) {
        bestD = d;
        best = { x: e.x, y: e.y };
      }
    }
    return best;
  };

  // ----- wall drawing -----
  function drawDown(e: React.PointerEvent<SVGSVGElement>) {
    if (tool !== 'draw') return;
    const p = snapToEndpoints(svgPoint(e.currentTarget, e.clientX, e.clientY));
    setDraft({ x1: p.x, y1: p.y, x2: p.x, y2: p.y, len: 0, angle: 0 });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function drawMove(e: React.PointerEvent<SVGSVGElement>) {
    if (tool !== 'draw' || !draft) return;
    const raw = snapToEndpoints(svgPoint(e.currentTarget, e.clientX, e.clientY));
    const dx = raw.x - draft.x1;
    const dy = raw.y - draft.y1;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    angle = Math.round(angle / 45) * 45;
    const rad = (angle * Math.PI) / 180;
    let len = dx * Math.cos(rad) + dy * Math.sin(rad);
    if (len < 0) {
      angle = (angle + 180) % 360;
      len = -len;
    }
    len = Math.round(len);
    setDraft({
      x1: draft.x1,
      y1: draft.y1,
      x2: draft.x1 + Math.cos((angle * Math.PI) / 180) * len,
      y2: draft.y1 + Math.sin((angle * Math.PI) / 180) * len,
      len,
      angle,
    });
  }

  function drawUp() {
    if (tool !== 'draw' || !draft) return;
    if (draft.len >= 12) {
      addWallAt({ x: draft.x1, y: draft.y1, angle: draft.angle, length: draft.len });
      onToolDone?.();
    }
    setDraft(null);
  }

  // ----- measuring tape -----
  const [measureDraft, setMeasureDraft] = useState<{ a: MeasureEnd; b: MeasureEnd } | null>(null);

  // Resolve an endpoint to live plan coords (anchored points follow their wall).
  const resolveEnd = (e: MeasureEnd): { x: number; y: number } => {
    if (e.wallId && e.t != null) {
      const w = design.walls.find((wl) => wl.id === e.wallId);
      if (w) {
        const { p0, p1 } = wallEndpoints(w);
        return { x: p0.x + (p1.x - p0.x) * e.t, y: p0.y + (p1.y - p0.y) * e.t };
      }
    }
    return { x: e.x, y: e.y };
  };

  // Snap a cursor point to the nearest wall line (anchored) or cabinet corner.
  const snapMeasure = (p: { x: number; y: number }): MeasureEnd => {
    let best: MeasureEnd = { x: p.x, y: p.y };
    let bestD = Math.max(2, vb.w * 0.022);
    for (const w of design.walls) {
      const { p0, p1 } = wallEndpoints(w);
      const vx = p1.x - p0.x;
      const vy = p1.y - p0.y;
      const len2 = vx * vx + vy * vy || 1;
      let t = ((p.x - p0.x) * vx + (p.y - p0.y) * vy) / len2;
      t = Math.max(0, Math.min(1, t));
      const fx = p0.x + vx * t;
      const fy = p0.y + vy * t;
      const d = Math.hypot(p.x - fx, p.y - fy);
      if (d < bestD) {
        bestD = d;
        best = { x: fx, y: fy, wallId: w.id, t };
      }
    }
    for (const it of design.items) {
      const wall = design.walls.find((w) => w.id === it.wallId);
      if (!wall) continue;
      const f = frameForWall(wall);
      const fpw = footprintW(it);
      const bx = f.ox + f.dx * it.x + f.nx * it.outset;
      const by = f.oy + f.dy * it.x + f.ny * it.outset;
      const corners = [
        { x: bx, y: by },
        { x: bx + f.dx * fpw, y: by + f.dy * fpw },
        { x: bx + f.nx * it.d, y: by + f.ny * it.d },
        { x: bx + f.dx * fpw + f.nx * it.d, y: by + f.dy * fpw + f.ny * it.d },
      ];
      for (const c of corners) {
        const d = Math.hypot(p.x - c.x, p.y - c.y);
        if (d < bestD) {
          bestD = d;
          best = { x: c.x, y: c.y };
        }
      }
    }
    return best;
  };

  function measureDown(e: React.PointerEvent<SVGSVGElement>) {
    if (tool !== 'measure') return;
    const a = snapMeasure(svgPoint(e.currentTarget, e.clientX, e.clientY));
    setMeasureDraft({ a, b: a });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function measureMove(e: React.PointerEvent<SVGSVGElement>) {
    if (tool !== 'measure' || !measureDraft) return;
    const b = snapMeasure(svgPoint(e.currentTarget, e.clientX, e.clientY));
    setMeasureDraft({ a: measureDraft.a, b });
  }

  function measureUp() {
    if (tool !== 'measure' || !measureDraft) return;
    const A = resolveEnd(measureDraft.a);
    const B = resolveEnd(measureDraft.b);
    if (Math.hypot(B.x - A.x, B.y - A.y) >= 2) {
      addMeasurement({ id: uid('m'), a: measureDraft.a, b: measureDraft.b, target: measureTarget && measureTarget > 0 ? measureTarget : undefined });
    }
    setMeasureDraft(null);
  }

  // ----- wall moving -----
  function wallDown(e: React.PointerEvent, wallId: string) {
    if (!interactive || tool !== 'select') return;
    const svg = (e.currentTarget as SVGRectElement).ownerSVGElement;
    if (!svg) return;
    const wall = design.walls.find((w) => w.id === wallId);
    if (!wall) return;
    wallDrag.current = { id: wallId, startPt: svgPoint(svg, e.clientX, e.clientY), origX: wall.x, origY: wall.y, moved: false };
    (e.currentTarget as SVGRectElement).setPointerCapture(e.pointerId);
    e.stopPropagation();
  }

  function wallMove(e: React.PointerEvent, wallId: string) {
    const d = wallDrag.current;
    if (!d || d.id !== wallId) return;
    const svg = (e.currentTarget as SVGRectElement).ownerSVGElement;
    if (!svg) return;
    const p = svgPoint(svg, e.clientX, e.clientY);
    const ddx = p.x - d.startPt.x;
    const ddy = p.y - d.startPt.y;
    if (Math.hypot(ddx, ddy) > 1) d.moved = true;
    const wall = design.walls.find((w) => w.id === wallId);
    if (!wall) return;
    let nx = d.origX + ddx;
    let ny = d.origY + ddy;
    // snap my slab corners to other walls' slab corners (corner-to-corner
    // joins keep wall thickness from covering another run's usable length)
    const moved = { ...wall, x: nx, y: ny };
    let bestAdj: { x: number; y: number } | null = null;
    let bestD = END_SNAP;
    for (const mine of wallSnapPoints(moved)) {
      for (const other of allEndpoints(wallId)) {
        const dd = Math.hypot(mine.x - other.x, mine.y - other.y);
        if (dd < bestD) {
          bestD = dd;
          bestAdj = { x: other.x - mine.x, y: other.y - mine.y };
        }
      }
    }
    if (bestAdj) {
      nx += bestAdj.x;
      ny += bestAdj.y;
    }
    updateWall(wallId, { x: Math.round(nx * 4) / 4, y: Math.round(ny * 4) / 4 });
  }

  function wallUp(_e: React.PointerEvent, wallId: string) {
    const d = wallDrag.current;
    if (!d || d.id !== wallId) return;
    wallDrag.current = null;
    if (!d.moved) return;
    // If the dragged wall now forms a corner facing the wrong way, flip it
    // so the corner closes the same no matter which end it attaches to.
    const st = useStore.getState();
    const wall = st.design.walls.find((w) => w.id === wallId);
    if (!wall) return;
    for (const other of st.design.walls) {
      if (other.id === wallId) continue;
      if (cornerNeedsFlip(wall, other)) {
        st.flipWall(wallId);
        break;
      }
    }
  }

  // ----- item dragging along its wall -----
  function itemDown(e: React.PointerEvent, it: PlacedItem) {
    if (!interactive || tool !== 'select') return;
    const svg = (e.currentTarget as SVGGElement).ownerSVGElement;
    if (!svg) return;
    itemDrag.current = { id: it.id, wallId: it.wallId, startPt: svgPoint(svg, e.clientX, e.clientY), startX: it.x, moved: false };
    (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
    select(it.id);
    e.stopPropagation();
  }

  function itemMove(e: React.PointerEvent, it: PlacedItem) {
    const d = itemDrag.current;
    if (!d || d.id !== it.id) return;
    const svg = (e.currentTarget as SVGGElement).ownerSVGElement;
    if (!svg) return;
    const wall = design.walls.find((w) => w.id === it.wallId);
    if (!wall) return;
    const f = frameForWall(wall);
    const p = svgPoint(svg, e.clientX, e.clientY);
    const along = (p.x - d.startPt.x) * f.dx + (p.y - d.startPt.y) * f.dy;
    if (Math.abs(along) > 0.75) d.moved = true;
    if (!d.moved) return;
    const cat = catalogById(it.catalogId);
    const fpw = footprintW(it);
    const r = cat.lane === 'floor' ? reserves.get(wall.id) ?? { start: 0, end: 0 } : { start: 0, end: 0 };
    const exempt = isReserveExempt(cat);
    const lo = exempt ? 0 : r.start;
    const hi = (exempt ? wall.length : wall.length - r.end) - fpw;
    let x = Math.max(lo, Math.min(d.startX + along, hi));
    const candidates: number[] = [lo, hi];
    for (const other of laneItems(design.items, wall.id, cat.lane)) {
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

  function itemUp(_e: React.PointerEvent, it: PlacedItem) {
    const d = itemDrag.current;
    if (!d || d.id !== it.id) return;
    itemDrag.current = null;
    if (d.moved) reflowAll();
    else openEditor(it.id);
  }

  return (
    <div className={interactive ? 'plan-stage' : undefined}>
    <svg
      ref={setSvgEl}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      style={{ width: '100%', maxHeight: '72vh', display: 'block', fontFamily: 'inherit', cursor: tool === 'draw' || tool === 'measure' ? 'crosshair' : 'default', touchAction: 'none' }}
      onPointerDown={tool === 'draw' ? drawDown : tool === 'measure' ? measureDown : bgPanDown}
      onPointerMove={tool === 'draw' ? drawMove : tool === 'measure' ? measureMove : bgPanMove}
      onPointerUp={tool === 'draw' ? drawUp : tool === 'measure' ? measureUp : bgPanUp}
    >
      {frames.map((f) => {
        const wallItems = design.items.filter((it) => it.wallId === f.wall.id);
        const floor = laneItems(wallItems, f.wall.id, 'floor');
        const runs = planCounterRuns(floor);
        // a lazy susan's L orientation follows the wall end it sits at (so it
        // stays put when the hinge toggle moves its single handle)
        const susanHinge = (it: PlacedItem): 'left' | 'right' => (it.x + footprintW(it) / 2 > f.wall.length / 2 ? 'right' : 'left');
        const isSel = selectedId === f.wall.id;
        const th = f.wall.thickness ?? WALL_T;
        const slabPts = wallSlabPolygonLocal(f.wall, design.walls)
          .map((p) => `${p.x},${p.y}`)
          .join(' ');
        const wallHandlers = {
          style: { cursor: interactive && tool === 'select' ? 'move' : 'default' } as React.CSSProperties,
          onPointerDown: (e: React.PointerEvent) => wallDown(e, f.wall.id),
          onPointerMove: (e: React.PointerEvent) => wallMove(e, f.wall.id),
          onPointerUp: (e: React.PointerEvent) => wallUp(e, f.wall.id),
          onClick: () => interactive && select(f.wall.id),
        };
        return (
          <g key={f.wall.id} transform={`translate(${f.ox} ${f.oy}) rotate(${f.angle})`}>
            {/* wall slab — mitered into connecting walls; islands draw as a dashed guide */}
            {f.wall.ghost ? (
              // island has no physical thickness; draw a fixed-height grabbable band
              <rect
                x={0}
                y={-WALL_T}
                width={f.wall.length}
                height={WALL_T}
                fill="rgba(91,91,214,0.06)"
                stroke={isSel ? '#5b5bd6' : '#9aa1ad'}
                strokeWidth={0.7}
                strokeDasharray="3 2.5"
                {...wallHandlers}
              />
            ) : (
              <polygon points={slabPts} fill={isSel ? '#5b5bd6' : '#3f4754'} {...wallHandlers} />
            )}
            {/* countertop runs */}
            {runs.map((r, i) => {
              const x1 = Math.max(r.x1 - COUNTER_OVERHANG, 0);
              const x2 = Math.min(r.x2 + COUNTER_OVERHANG, f.wall.length);
              return (
                <rect key={i} x={x1} y={0} width={x2 - x1} height={r.d + COUNTER_OVERHANG} fill={fin.counter} stroke="rgba(0,0,0,0.3)" strokeWidth={0.4} />
              );
            })}
            {/* L-shaped countertops for lazy-susan cabinets */}
            {floor
              .filter((it) => catalogById(it.catalogId).front === 'susan' && catalogById(it.catalogId).counter)
              .map((it) => (
                <polygon
                  key={`sc-${it.id}`}
                  transform={`translate(${it.x} ${it.outset})`}
                  points={susanCounterPts(footprintW(it), it.d, susanHinge(it), COUNTER_OVERHANG)}
                  fill={fin.counter}
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth={0.4}
                />
              ))}
            {/* cabinets */}
            {floor.map((it) => {
              const cat = catalogById(it.catalogId);
              const sel = selectedId === it.id;
              const fpw = footprintW(it);
              return (
                <g
                  key={it.id}
                  transform={`translate(${it.x} ${it.outset})`}
                  style={{ cursor: interactive && tool === 'select' ? (it.auto ? 'pointer' : 'grab') : 'default' }}
                  onPointerDown={it.auto ? (e) => e.stopPropagation() : (e) => itemDown(e, it)}
                  onPointerMove={it.auto ? undefined : (e) => itemMove(e, it)}
                  onPointerUp={it.auto ? undefined : (e) => itemUp(e, it)}
                  onClick={it.auto && interactive && tool === 'select' ? () => openEditor(it.id) : undefined}
                >
                  <CabinetTop cat={cat} w={fpw} d={it.d} fin={fin} hinge={cat.front === 'susan' || cat.front === 'corner' ? susanHinge(it) : it.hinge} />
                  <circle cx={fpw / 2} cy={it.d / 2} r={3.4} fill="#fff" stroke="#5b6472" strokeWidth={0.35} />
                  <text x={fpw / 2} y={it.d / 2 + 1.3} textAnchor="middle" fontSize={3.6} fill="#33394a" fontWeight={600}>
                    {numbers.get(it.id)}
                  </text>
                  {sel && interactive && (
                    <rect x={-0.8} y={-0.8} width={fpw + 1.6} height={it.d + 1.6} fill="none" stroke="#5b5bd6" strokeWidth={0.6} strokeDasharray="2 1.5" />
                  )}
                </g>
              );
            })}
            {/* upper cabinets as dashed outlines */}
            {laneItems(wallItems, f.wall.id, 'upper').map((it) => (
              <rect key={it.id} x={it.x} y={0} width={footprintW(it)} height={it.d} fill="none" stroke="#9aa1ad" strokeWidth={0.4} strokeDasharray="2.5 2" />
            ))}
            {/* plumbing / electrical rough-ins, marked on the wall line */}
            {design.roughIns
              .filter((r) => r.wallId === f.wall.id)
              .map((r) => {
                const conflict = roughInConflict(design, r);
                const color = conflict ? '#dc2626' : r.kind === 'plumbing' ? '#2563eb' : '#b45309';
                return (
                  <g
                    key={r.id}
                    style={{ cursor: interactive ? 'pointer' : 'default' }}
                    onPointerDown={(e) => {
                      if (!interactive) return;
                      e.stopPropagation();
                      openRoughIn(r.id);
                    }}
                  >
                    <rect x={r.x - r.w / 2} y={-1.5} width={r.w} height={4} rx={0.6} fill={color} opacity={0.92} />
                    <text x={r.x} y={1.7} textAnchor="middle" fontSize={2.6} fill="#fff" fontWeight={700}>
                      {r.kind === 'plumbing' ? 'P' : 'E'}
                    </text>
                  </g>
                );
              })}
            {/* per-item breakdown (cabinets, fillers, applied end panels) + overall */}
            {(() => {
              const E = 0.75; // applied end panel thickness
              const r2 = (n: number) => Math.round(n * 100) / 100;
              const edges = new Set<number>([0, f.wall.length]);
              for (const it of floor) {
                const ic = catalogById(it.catalogId);
                const appl = ic.category !== 'appliance';
                let exL = appl && it.endL ? E : 0;
                let exR = appl && it.endR ? E : 0;
                // A corner/susan has a leg on each wall, so one applied end runs
                // along the PERPENDICULAR wall — only the own-wall end widens this
                // wall (the other shows on the adjoining wall's dimensions).
                if (ic.front === 'corner' || ic.front === 'susan') {
                  // The corner is at the wall end the cabinet sits against; the
                  // own-wall leg tip is the OTHER end. Left-half cabinet → tip on
                  // the right (keep exR); right-half → tip on the left (keep exL).
                  const onLeftHalf = it.x + it.w / 2 <= f.wall.length / 2;
                  if (onLeftHalf) exL = 0;
                  else exR = 0;
                }
                edges.add(r2(it.x));
                if (exL) edges.add(r2(it.x + exL));
                if (exR) edges.add(r2(it.x + exL + it.w));
                edges.add(r2(it.x + exL + it.w + exR));
              }
              // include the leg of any corner cabinet projecting in from a neighbour wall
              for (const p of cornerCabinetProjections(f.wall, design.walls, design.items)) {
                edges.add(r2(p.fromStart ? p.length : f.wall.length - p.length));
              }
              const sorted = [...edges].sort((a, b) => a - b);
              return (
                <>
                  {sorted.slice(0, -1).map((x1, i) => {
                    const x2 = sorted[i + 1];
                    if (x2 - x1 < 0.4) return null;
                    return <DimH key={i} x1={x1} x2={x2} y={-th - 6} fs={3.2} />;
                  })}
                  <DimH x1={0} x2={f.wall.length} y={-th - 14} fs={4} />
                  <text x={f.wall.length / 2} y={-th - 20} textAnchor="middle" fontSize={4.2} fill="#33394a" fontWeight={600}>
                    {f.wall.name}
                  </text>
                </>
              );
            })()}
          </g>
        );
      })}

      {/* draw preview */}
      {draft && (
        <g>
          <line x1={draft.x1} y1={draft.y1} x2={draft.x2} y2={draft.y2} stroke="#5b5bd6" strokeWidth={WALL_T} strokeLinecap="round" opacity={0.55} />
          <circle cx={draft.x1} cy={draft.y1} r={3} fill="#5b5bd6" />
          {draft.len > 0 && (
            <text x={(draft.x1 + draft.x2) / 2} y={(draft.y1 + draft.y2) / 2 - 6} textAnchor="middle" fontSize={5} fill="#5b5bd6" fontWeight={600}>
              {fmtIn(draft.len)}
            </text>
          )}
        </g>
      )}

      {/* measurements (persistent tape) */}
      {(() => {
        const sw = Math.max(0.3, vb.w * 0.003);
        const fs = Math.max(3, vb.w * 0.02);
        const tick = fs * 0.7;
        const out: React.ReactElement[] = [];
        const line = (A: { x: number; y: number }, B: { x: number; y: number }, target: number | undefined, key: string, isDraft: boolean) => {
          const dist = Math.hypot(B.x - A.x, B.y - A.y);
          const mx = (A.x + B.x) / 2;
          const my = (A.y + B.y) / 2;
          const nx = -(B.y - A.y) / (dist || 1);
          const ny = (B.x - A.x) / (dist || 1);
          const ok = target ? Math.abs(dist - target) <= 0.5 : false;
          const color = isDraft ? '#5b5bd6' : target ? (ok ? '#1f9d55' : '#d23b3b') : '#5b5bd6';
          const label = target ? `${fmtIn(dist)} / ${fmtIn(target)} target` : fmtIn(dist);
          return (
            <g key={key}>
              <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={color} strokeWidth={sw} strokeDasharray={isDraft ? `${sw * 3} ${sw * 2}` : undefined} />
              <line x1={A.x - nx * tick} y1={A.y - ny * tick} x2={A.x + nx * tick} y2={A.y + ny * tick} stroke={color} strokeWidth={sw} />
              <line x1={B.x - nx * tick} y1={B.y - ny * tick} x2={B.x + nx * tick} y2={B.y + ny * tick} stroke={color} strokeWidth={sw} />
              <rect x={mx - fs * label.length * 0.31} y={my - fs * 0.95} width={fs * label.length * 0.62} height={fs * 1.4} rx={fs * 0.25} fill="#fff" opacity={0.92} />
              <text x={mx} y={my + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight={700} fill={color}>
                {label}
              </text>
            </g>
          );
        };
        for (const m of measurements) {
          const A = resolveEnd(m.a);
          const B = resolveEnd(m.b);
          out.push(line(A, B, m.target, m.id, false));
          if (interactive && tool === 'select') {
            const mx = (A.x + B.x) / 2;
            const my = (A.y + B.y) / 2;
            out.push(
              <g key={`${m.id}-del`} style={{ cursor: 'pointer' }} onPointerDown={(e) => { e.stopPropagation(); removeMeasurement(m.id); }}>
                <circle cx={mx + fs * 1.7} cy={my - fs * 1.2} r={fs * 0.72} fill="#d23b3b" />
                <text x={mx + fs * 1.7} y={my - fs * 1.2 + fs * 0.34} textAnchor="middle" fontSize={fs * 0.95} fill="#fff" fontWeight={700}>
                  ×
                </text>
              </g>
            );
          }
        }
        if (measureDraft) {
          out.push(line(resolveEnd(measureDraft.a), resolveEnd(measureDraft.b), measureTarget && measureTarget > 0 ? measureTarget : undefined, 'draft-measure', true));
        }
        return <g className="measure-layer">{out}</g>;
      })()}
    </svg>
    {interactive && (
      <div className="zoom-ctl">
        <button title="Zoom out" onClick={() => zoomBy(1.3)}>
          −
        </button>
        <button title="Fit design" onClick={() => setView(null)}>
          ⤢
        </button>
        <button title="Zoom in" onClick={() => zoomBy(1 / 1.3)}>
          +
        </button>
      </div>
    )}
    </div>
  );
}

export default function TopView() {
  const [tool, setTool] = useState<'select' | 'draw' | 'measure'>('select');
  const [measureTargetText, setMeasureTargetText] = useState('');
  const measureTarget = parseFloat(measureTargetText);
  const applyPreset = useStore((s) => s.applyPreset);
  const wallCount = useStore((s) => s.design.walls.length);
  const selectedId = useStore((s) => s.selectedId);
  const walls = useStore((s) => s.design.walls);
  const flipWall = useStore((s) => s.flipWall);
  const rotateWall = useStore((s) => s.rotateWall);
  const updateWall = useStore((s) => s.updateWall);
  const removeWall = useStore((s) => s.removeWall);
  const openAdd = useStore((s) => s.openAdd);
  const cornerOverrides = useStore((s) => s.design.cornerOverrides);
  const setCornerOverride = useStore((s) => s.setCornerOverride);
  const selectedWall = walls.find((w) => w.id === selectedId);
  // Corner-filler overrides on the selected wall (adjusted or removed) — offer a reset.
  const wallOverrides = selectedWall
    ? (['start', 'end'] as const).filter((end) => cornerOverrides?.[`${selectedWall.id}:${end}`] != null)
    : [];

  return (
    <div className="plan-view">
      <div className="plan-card">
        <div className="plan-toolbar">
          <div className="tool-group">
            <button className={tool === 'select' ? 'tool-btn active' : 'tool-btn'} onClick={() => setTool('select')}>
              ▦ Select / Move
            </button>
            <button className={tool === 'draw' ? 'tool-btn active' : 'tool-btn'} onClick={() => setTool('draw')}>
              ✏ Draw wall
            </button>
            <button className={tool === 'measure' ? 'tool-btn active' : 'tool-btn'} onClick={() => setTool('measure')} title="Drag between two points (snaps to walls & cabinets) to drop a measurement">
              📏 Measure
            </button>
            {tool === 'measure' && (
              <label className="tool-label" title="Optional target length. A measurement turns green when it matches this.">
                Target:
                <input
                  className="counter-input"
                  inputMode="decimal"
                  style={{ width: 56, marginLeft: 6 }}
                  value={measureTargetText}
                  placeholder="any"
                  onChange={(e) => setMeasureTargetText(e.target.value)}
                />
                ″
              </label>
            )}
          </div>
          <div className="tool-group">
            <span className="tool-label">Auto-arrange:</span>
            <button className="tool-btn" onClick={() => applyPreset('linear')}>
              Galley
            </button>
            <button className="tool-btn" disabled={wallCount < 2} onClick={() => applyPreset('l')}>
              L-shape
            </button>
            <button className="tool-btn" disabled={wallCount < 3} onClick={() => applyPreset('u')}>
              U-shape
            </button>
          </div>
        </div>
        {selectedWall && (
          <div className="wall-props">
            <button className="btn-dark wall-add-btn" title="Add a cabinet to this wall" onClick={() => openAdd(selectedWall.id)}>
              + Add cabinet
            </button>
            <input
              className="wall-name wall-name-sm"
              value={selectedWall.name}
              onChange={(e) => updateWall(selectedWall.id, { name: e.target.value })}
            />
            <label className="wall-dim-field">
              Length
              <NumberField value={selectedWall.length} min={4} max={600} onCommit={(length) => updateWall(selectedWall.id, { length })} />
            </label>
            <label className="wall-dim-field">
              Height
              <NumberField value={selectedWall.height} min={36} max={144} disabled={selectedWall.ghost} onCommit={(height) => updateWall(selectedWall.id, { height })} />
            </label>
            <label className="wall-dim-field">
              Thick.
              <NumberField value={selectedWall.thickness} min={0} max={12} step={0.5} round={0.25} disabled={selectedWall.ghost} title="Set to 0 for an island (no wall)" onCommit={(thickness) => updateWall(selectedWall.id, { thickness })} />
            </label>
            <label className="wall-dim-field wall-island" title="No physical wall — island/peninsula run">
              <input
                type="checkbox"
                checked={selectedWall.ghost}
                onChange={(e) => updateWall(selectedWall.id, { ghost: e.target.checked })}
              />
              Island
            </label>
            {wallOverrides.map((end) => {
              const o = cornerOverrides![`${selectedWall.id}:${end}`];
              return (
                <button
                  key={end}
                  className="tool-btn"
                  title={`The corner filler at this wall's ${end} was ${o.off ? 'removed' : `set to ${o.w}″`} — restore the standard 3″ filler`}
                  onClick={() => setCornerOverride(`${selectedWall.id}:${end}`, null)}
                >
                  ↺ Corner filler ({end === 'start' ? 'near end' : 'far end'})
                </button>
              );
            })}
            <button className="tool-btn" title="Rotate this wall 45° about its center" onClick={() => rotateWall(selectedWall.id, 45)}>
              ↻ 45°
            </button>
            <button className="tool-btn" title="Move cabinets to the other side of this wall" onClick={() => flipWall(selectedWall.id)}>
              ⇄ Flip
            </button>
            {walls.length > 1 && (
              <button
                className="tool-btn tool-btn-danger"
                title="Remove this wall and its cabinets"
                onClick={() => removeWall(selectedWall.id)}
              >
                ✕ Remove
              </button>
            )}
          </div>
        )}
        <TopViewSvg interactive tool={tool} measureTarget={Number.isFinite(measureTarget) ? measureTarget : undefined} onToolDone={() => setTool('select')} />
        <p className="plan-hint">
          {tool === 'draw'
            ? 'Click and drag to draw a wall — angles snap to 45°, ends snap to existing walls. Walls shorter than 12″ are discarded. Scroll to zoom.'
            : tool === 'measure'
              ? 'Drag between two points to drop a measurement — ends snap to walls & cabinets and stay put. Set a Target to line up to (it turns green when matched), then switch to Select and drag a wall to hit it. Click a measurement’s × to remove it.'
              : 'Click a wall to select it, then “+ Add cabinet”. Drag cabinets along their wall, drag a wall to move the whole run, click a cabinet to edit. Scroll to zoom, drag empty space to pan.'}
        </p>
      </div>
    </div>
  );
}
