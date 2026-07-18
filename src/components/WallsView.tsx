import { useRef, useState } from 'react';
import type { FinishOption, OpeningKind, PlacedItem, RoughInKind, Wall } from '../model/types';
import { ALL_FINISHES, BAR_RISE, BASE_H, COUNTER_OVERHANG, COUNTER_T, bridgesCounter, catalogById } from '../model/catalog';
import { companyFinishById } from '../model/companyCatalog';
import { useSession } from '../state/session';
import { resolveItemFinish } from '../model/newage';
import { countertopById } from '../model/countertops';
import { cornerCounterExtend, isReserveExempt, type CornerReserve } from '../model/geometry';
import { backsplashSpans, counterHeightFor, footprintW, laneItems, openingClash, reservesFor, roughInBand, roughInConflict, roughInHost, spaceLeft, useStore } from '../state/store';
import { grillCutout } from '../three/cabinet3d';
import { hasModel } from '../three/models';
import { ElevationCabinet } from './CabinetImage';
import { NumberField } from './NumberField';
import { DimH, DimV, OpeningGlyph, RoughInGlyph, fmtIn } from './svg';
import { appliance3dModel } from '../model/appliances';

const SNAP = 1.25; // inches

/** Contiguous runs of counter-topped floor items at the same height. A height
 *  change starts a new run so the counter steps to follow each cabinet. */
function counterRuns(items: PlacedItem[]): Array<{ x1: number; x2: number; h: number }> {
  const tops = items
    .filter((it) => catalogById(it.catalogId).counter)
    .sort((a, b) => a.x - b.x);
  const runs: Array<{ x1: number; x2: number; h: number }> = [];
  for (const it of tops) {
    // undercounter appliances keep the counter at standard height over them
    const h = counterHeightFor(it);
    const last = runs[runs.length - 1];
    if (last && it.x <= last.x2 + 0.2 && Math.abs(last.h - h) < 0.01) last.x2 = Math.max(last.x2, it.x + footprintW(it));
    else runs.push({ x1: it.x, x2: it.x + footprintW(it), h });
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
  const updateOpening = useStore((s) => s.updateOpening);
  const openOpening = useStore((s) => s.openOpening);
  const editingOpeningId = useStore((s) => s.editingOpeningId);
  const wallOpenings = design.openings.filter((o) => o.wallId === wall.id);
  const appliances = useStore((s) => s.appliances);
  // re-render when real 3D models arrive (counter gaps depend on the grill model)
  useStore((s) => s.modelsReady);

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
  const bsH = design.backsplashHeight ?? 0;
  const counterColor = countertopById(design.counterId).base;

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

  // --- window / door drag: 2D move (center x + sill y), live dimensions ---
  const openDrag = useRef<{ id: string; startClientX: number; startClientY: number; startX: number; startY: number; scale: number; moved: boolean } | null>(null);
  const [draggingOpenId, setDraggingOpenId] = useState<string | null>(null);

  function onOpenDown(e: React.PointerEvent, o: (typeof wallOpenings)[number]) {
    if (!interactive) return;
    e.stopPropagation();
    const svg = (e.currentTarget as SVGGElement).ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / viewW, rect.height / viewH);
    openDrag.current = { id: o.id, startClientX: e.clientX, startClientY: e.clientY, startX: o.x, startY: o.y, scale, moved: false };
    try {
      (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    select(null);
  }

  function onOpenMove(e: React.PointerEvent, o: (typeof wallOpenings)[number]) {
    const d = openDrag.current;
    if (!d || d.id !== o.id) return;
    const dxPx = e.clientX - d.startClientX;
    const dyPx = e.clientY - d.startClientY;
    if (!d.moved) {
      if (Math.abs(dxPx) < 3 && Math.abs(dyPx) < 3) return;
      d.moved = true;
      setDraggingOpenId(o.id);
    }
    let cx = d.startX + dxPx / d.scale;
    cx = Math.max(o.w / 2, Math.min(cx, wall.length - o.w / 2));
    let sill = d.startY - dyPx / d.scale; // dragging up raises the sill
    sill = Math.max(0, Math.min(sill, wall.height - o.h));
    updateOpening(o.id, { x: Math.round(cx * 8) / 8, y: Math.round(sill * 8) / 8 });
  }

  function onOpenUp(e: React.PointerEvent, o: (typeof wallOpenings)[number]) {
    const d = openDrag.current;
    if (!d || d.id !== o.id) return;
    openDrag.current = null;
    setDraggingOpenId(null);
    if (!d.moved) openOpening(o.id);
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

      {/* windows & doors — drawn on the wall, BEHIND the cabinets so cabinets
          in front of them occlude the overlap */}
      {wallOpenings.map((o) => {
        const gx = o.x - o.w / 2;
        const gy = floorY - o.y - o.h; // top-left (y is the sill / bottom height)
        const dragging = draggingOpenId === o.id;
        const sel = editingOpeningId === o.id || dragging;
        return (
          <g key={o.id}>
            {dragging && (
              <g className="rough-dims">
                <line x1={0} y1={gy + o.h} x2={wall.length} y2={gy + o.h} stroke="#5b5bd6" strokeWidth={0.3} strokeDasharray="1.5 1" />
                <DimH x1={0} x2={o.x} y={gy + o.h - 2} label={`${fmtIn(o.x)} →`} />
                <DimH x1={o.x} x2={wall.length} y={gy + o.h - 2} label={`← ${fmtIn(Math.max(0, wall.length - o.x))}`} />
                {o.y > 0.01 && <DimV y1={gy + o.h} y2={floorY} x={gx - 3} label={`${fmtIn(o.y)} ↑`} />}
              </g>
            )}
            <g
              data-opening={o.id}
              transform={`translate(${gx} ${gy})`}
              style={{ cursor: interactive ? (dragging ? 'grabbing' : 'grab') : 'default' }}
              onPointerDown={(e) => onOpenDown(e, o)}
              onPointerMove={(e) => onOpenMove(e, o)}
              onPointerUp={(e) => onOpenUp(e, o)}
            >
              <OpeningGlyph kind={o.kind} w={o.w} h={o.h} clash={openingClash(o, items, cT)} />
              {sel && interactive && (
                <rect x={-1} y={-1} width={o.w + 2} height={o.h + 2} fill="none" stroke="#5b5bd6" strokeWidth={0.6} strokeDasharray="2 1.5" rx={1} />
              )}
            </g>
          </g>
        );
      })}

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

      {/* stone backsplash — a band of counter stone up the wall above the
          counter. On the wall, so it sits BEHIND the cabinets (grill hoods
          and other top gear must not be covered). */}
      {bsH > 0 &&
        backsplashSpans(floorItems, wall.length, reserve).map((s, i) => {
          const cy = floorY - BASE_H - cT; // counter top surface
          return (
            <g key={`bs-${i}`}>
              <rect x={s.x1} y={cy - bsH} width={s.x2 - s.x1} height={bsH} fill={counterColor} stroke="rgba(0,0,0,0.18)" strokeWidth={0.2} />
              <rect x={s.x1} y={cy - bsH} width={s.x2 - s.x1} height={bsH} fill="url(#g-counter)" opacity={0.5} />
            </g>
          );
        })}

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

      {/* bar-height cabinets: the raised bar tier (+BAR_RISE) with its stone top,
          drawn BEHIND the cabinets so a sink faucet/top gear shows in front of
          the bar backsplash (like the 3D). */}
      {floorItems
        .filter((it) => catalogById(it.catalogId).barHeight)
        .map((it) => {
          const w = footprintW(it);
          const riserTop = floorY - (it.h + BAR_RISE);
          const barTopY = riserTop - cT;
          // The step face shows the granite backsplash, capped by the stone bar top.
          return (
            <g key={`bar-${it.id}`}>
              <rect x={it.x} y={riserTop} width={w} height={BAR_RISE - cT} fill={counterColor} stroke="rgba(0,0,0,0.22)" strokeWidth={0.2} />
              <rect x={it.x} y={riserTop} width={w} height={BAR_RISE - cT} fill="url(#g-counter)" />
              <rect x={it.x} y={barTopY} width={w} height={cT} rx={0.35} fill={counterColor} stroke="rgba(0,0,0,0.22)" strokeWidth={0.2} />
              <rect x={it.x} y={barTopY} width={w} height={cT} rx={0.35} fill="url(#g-counter)" />
            </g>
          );
        })}

      {/* items */}
      {wallItems.map((it) => {
        const cat = catalogById(it.catalogId);
        const y = floorY - it.mount - it.h;
        const sel = selectedId === it.id;
        // per-cabinet finish (NewAge series/door options), resolved to a
        // finish the unit is actually made in
        const effFinId = resolveItemFinish(fin.id, it, cat);
        const itFin = effFinId !== fin.id ? ALL_FINISHES.find((f) => f.id === effFinId) ?? fin : fin;
        return (
          <g
            key={it.id}
            transform={`translate(${it.x} ${y})`}
            style={{ cursor: interactive ? (it.auto ? 'pointer' : 'grab') : 'default' }}
            onPointerDown={it.auto ? (e) => e.stopPropagation() : (e) => onPointerDown(e, it)}
            onPointerMove={it.auto ? undefined : (e) => onPointerMove(e, it)}
            onPointerUp={it.auto ? undefined : (e) => onPointerUp(e, it)}
            onClick={it.auto && interactive ? () => openEditor(it.id) : undefined}
          >
            <ElevationCabinet cat={cat} it={it} fin={itFin} wallLength={wall.length} />
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
        // Overhang only exposed ends — keep flush where a neighbour abuts so the
        // counter doesn't cut over an adjoining cabinet of a different height.
        const leftAbut = floorItems.some((o) => Math.abs(o.x + footprintW(o) - r.x1) < 0.75);
        const rightAbut = floorItems.some((o) => Math.abs(o.x - r.x2) < 0.75);
        // At an owned dead corner the counter runs to the wall end (matches 3D).
        const ext = cornerCounterExtend(wall, design.walls, design.items, design.cornerOverrides);
        const fillStart = ext.start && r.x1 <= reserve.start + 1;
        const fillEnd = ext.end && r.x2 >= wall.length - reserve.end - 1;
        const x1 = fillStart ? 0 : Math.max(r.x1 - (leftAbut ? 0 : COUNTER_OVERHANG), 0);
        const x2 = fillEnd ? wall.length : Math.min(r.x2 + (rightAbut ? 0 : COUNTER_OVERHANG), wall.length);
        const cy = floorY - r.h - cT; // counter sits on top of this run's cabinets
        // The real grill head's control panel hangs in front of the counter, so
        // the counter visually breaks at its opening (matches the 3D notch).
        const gaps = floorItems
          .filter((it) => {
            const c = catalogById(it.catalogId);
            const notched = c.front === 'grill' || c.front === 'grill4' || c.front === 'griddle' || c.front === 'griddle4' || c.front === 'burner';
            return notched && it.x >= r.x1 - 0.1 && it.x <= r.x2 + 0.1 && Math.abs(it.h - r.h) < 0.01;
          })
          .map((it) => {
            const cut = grillCutout(catalogById(it.catalogId), it.w, it.d, appliance3dModel(it.appliance, appliances)?.w)!;
            const cx = it.x + footprintW(it) / 2;
            return { x1: cx - cut.bw / 2, x2: cx + cut.bw / 2 };
          })
          .sort((a, b) => a.x1 - b.x1);
        const segs: Array<{ x1: number; x2: number }> = [];
        let cur = x1;
        for (const gp of gaps) {
          if (gp.x1 > cur) segs.push({ x1: cur, x2: Math.min(gp.x1, x2) });
          cur = Math.max(cur, gp.x2);
        }
        if (cur < x2) segs.push({ x1: cur, x2 });
        return (
          <g key={`c-${i}`}>
            {segs.map((sg, j) => (
              <g key={j}>
                <rect x={sg.x1} y={cy + cT} width={sg.x2 - sg.x1} height={1.6} fill="url(#g-undercounter)" />
                <rect x={sg.x1} y={cy} width={sg.x2 - sg.x1} height={cT} rx={0.35} fill={counterColor} stroke="rgba(0,0,0,0.22)" strokeWidth={0.2} />
                <rect x={sg.x1} y={cy} width={sg.x2 - sg.x1} height={cT} rx={0.35} fill="url(#g-counter)" />
                <line x1={sg.x1 + 0.3} y1={cy + 0.25} x2={sg.x2 - 0.3} y2={cy + 0.25} stroke="#ffffff" strokeWidth={0.25} opacity={0.55} />
              </g>
            ))}
          </g>
        );
      })}

      {/* waterfall edges — countertop wrapping down a run-end side. Stops at the
          top of an adjoining cabinet (matching 3D) so it doesn't run over it. */}
      {floorItems.map((it) => {
        const cat = catalogById(it.catalogId);
        if (!cat.counter) return null;
        const cy = floorY - it.h - cT;
        // top (height above floor) of an immediately-adjacent cabinet on a side
        const neighborTop = (side: 'L' | 'R'): number => {
          const edge = side === 'L' ? it.x : it.x + footprintW(it);
          let top = 0;
          for (const o of floorItems) {
            if (o.id === it.id) continue;
            const oEdge = side === 'L' ? o.x + footprintW(o) : o.x;
            if (Math.abs(oEdge - edge) < 0.75) {
              const oc = catalogById(o.catalogId);
              top = Math.max(top, o.h + (oc.counter ? cT : 0));
            }
          }
          return top;
        };
        const sides: Array<{ side: 'L' | 'R'; x: number }> = [];
        if (it.waterfallL) sides.push({ side: 'L', x: it.x - cT });
        if (it.waterfallR) sides.push({ side: 'R', x: it.x + footprintW(it) });
        return sides.map(({ side, x }) => {
          const h = it.h + cT - neighborTop(side); // stop at the neighbour's top
          if (h <= 0.05) return null; // fully hidden behind a taller neighbour
          return (
            <g key={`wf-${it.id}-${side}`}>
              <rect x={x} y={cy} width={cT} height={h} fill={counterColor} stroke="rgba(0,0,0,0.22)" strokeWidth={0.2} />
              <rect x={x} y={cy} width={cT} height={h} fill="url(#g-counter)" />
            </g>
          );
        });
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
            {/* live distance read-outs while dragging: height off floor + from each wall end */}
            {dragging && (
              <g className="rough-dims">
                <line x1={gx} y1={floorY} x2={gx} y2={floorY - r.y} stroke="#5b5bd6" strokeWidth={0.3} strokeDasharray="1.5 1" />
                <line x1={0} y1={floorY - r.y} x2={wall.length} y2={floorY - r.y} stroke="#5b5bd6" strokeWidth={0.3} strokeDasharray="1.5 1" />
                <DimV y1={floorY - r.y} y2={floorY} x={gx - 3} label={`${fmtIn(r.y)} ↑`} />
                <DimH x1={0} x2={r.x} y={floorY - r.y - 2} label={`${fmtIn(r.x)} →`} />
                <DimH x1={r.x} x2={wall.length} y={floorY - r.y - 2} label={`← ${fmtIn(Math.max(0, wall.length - r.x))}`} />
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

      {/* windows / doors — draggable framed openings on the wall */}
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
          <NumberField value={wall.length} min={4} max={600} onCommit={(length) => updateWall(wall.id, { length })} />
        </label>
        <label className="wall-dim-field">
          Height
          <NumberField value={wall.height} min={1} max={144} disabled={wall.ghost} onCommit={(height) => updateWall(wall.id, { height })} />
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
        <RoughInAdd wallId={wall.id} />
        <OpeningAdd wallId={wall.id} />
        <button className="btn-dark" onClick={() => openAdd(wall.id)}>
          + Add Cabinet
        </button>
      </div>
      <div className="wall-card-body" style={zoom > 1 ? { overflowX: 'auto' } : undefined}>
        <WallElevationSvg wall={wall} items={design.items} fin={fin} interactive reserve={reserve} zoom={zoom} />
      </div>
    </div>
  );
}

/** Add-rough-in dropdown: plumbing / electrical / gas under one button. */
const ROUGHIN_KINDS: { kind: RoughInKind; label: string }[] = [
  { kind: 'plumbing', label: 'Plumbing stub-out' },
  { kind: 'electrical', label: 'Electrical outlet' },
  { kind: 'gas', label: 'Gas stub-out' },
];

function RoughInAdd({ wallId }: { wallId: string }) {
  const addRoughIn = useStore((s) => s.addRoughIn);
  const [open, setOpen] = useState(false);
  return (
    <div className="roughin-dd">
      <button className="btn-soft" title="Add a plumbing, electrical, or gas rough-in" onClick={() => setOpen((o) => !o)}>
        + Rough-in ▾
      </button>
      {open && (
        <>
          <div className="roughin-backdrop" onClick={() => setOpen(false)} />
          {/* right-aligned: this button sits at the card's right edge */}
          <div className="roughin-menu roughin-menu-right">
            {ROUGHIN_KINDS.map((k) => (
              <button
                key={k.kind}
                className="roughin-menu-item"
                onClick={() => {
                  addRoughIn(wallId, k.kind);
                  setOpen(false);
                }}
              >
                {k.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Add-opening dropdown: window / door under one button. */
const OPENING_KINDS: { kind: OpeningKind; label: string }[] = [
  { kind: 'window', label: 'Window' },
  { kind: 'door', label: 'Door' },
];

function OpeningAdd({ wallId }: { wallId: string }) {
  const addOpening = useStore((s) => s.addOpening);
  const [open, setOpen] = useState(false);
  return (
    <div className="roughin-dd">
      <button className="btn-soft" title="Add a window or door" onClick={() => setOpen((o) => !o)}>
        + Window/Door ▾
      </button>
      {open && (
        <>
          <div className="roughin-backdrop" onClick={() => setOpen(false)} />
          <div className="roughin-menu">
            {OPENING_KINDS.map((k) => (
              <button
                key={k.kind}
                className="roughin-menu-item"
                onClick={() => {
                  addOpening(wallId, k.kind);
                  setOpen(false);
                }}
              >
                {k.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function useFinish(id: string): FinishOption {
  // Company-defined colors resolve alongside the built-in palettes.
  const catalogPrefs = useSession((s) => s.catalogPrefs);
  return ALL_FINISHES.find((f) => f.id === id) ?? companyFinishById(catalogPrefs, id) ?? ALL_FINISHES[0];
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
