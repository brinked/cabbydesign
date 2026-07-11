import type { CatalogItem, FinishOption, HingeSide, OpeningKind, RoughInKind } from '../model/types';
import { COUNTER_T, TOEKICK_H } from '../model/catalog';

// All SVG drawing is done in inch coordinates; the parent <svg> sets a
// viewBox in inches so everything scales losslessly.

export const STEEL = '#cfd4d8';
export const STEEL_DK = '#a8aeb4';
export const STEEL_LN = '#8d949b';
export const INK = '#2b2e31';
export const CARCASS_SIDE = '#eceef0';
export const CARCASS_TOP = '#f6f7f8';

/**
 * Shared gradients/patterns, mounted once in App. Inline SVGs share the
 * document id namespace, so url(#...) references work from every diagram.
 */
export function SvgDefs() {
  return (
    <svg id="svg-shared-defs" width={0} height={0} style={{ position: 'absolute' }} aria-hidden focusable="false">
      <defs>
        <linearGradient id="g-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef1f3" />
          <stop offset="0.45" stopColor="#c3c9ce" />
          <stop offset="0.55" stopColor="#b4bbc1" />
          <stop offset="1" stopColor="#dde1e4" />
        </linearGradient>
        <linearGradient id="g-steel-h" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e8ebee" />
          <stop offset="0.5" stopColor="#bdc3c9" />
          <stop offset="1" stopColor="#dde1e4" />
        </linearGradient>
        {/* neutral light/shadow overlay for painted door panels */}
        <linearGradient id="g-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="0.35" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.10" />
        </linearGradient>
        <linearGradient id="g-counter" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.08" />
        </linearGradient>
        <radialGradient id="g-knob" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#f2f4f5" />
          <stop offset="0.7" stopColor="#aeb5bb" />
          <stop offset="1" stopColor="#8d949b" />
        </radialGradient>
        {/* inner shadow cast by the door frame onto the recessed panel */}
        <linearGradient id="g-recess" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000000" stopOpacity="0.30" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="g-recess-h" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000000" stopOpacity="0.16" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
        {/* studio-light overlay for door/drawer faces: lit from above */}
        <linearGradient id="g-door" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.34" />
          <stop offset="0.22" stopColor="#ffffff" stopOpacity="0.10" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.16" />
        </linearGradient>
        {/* horizontal sheen, light source slightly to the left */}
        <linearGradient id="g-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="0.4" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.07" />
        </linearGradient>
        {/* shadow band under the countertop nose */}
        <linearGradient id="g-undercounter" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000000" stopOpacity="0.22" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
        {/* fine vertical brushed-steel texture */}
        <pattern id="p-brush" patternUnits="userSpaceOnUse" width="1.2" height="8">
          <line x1="0.2" y1="0" x2="0.2" y2="8" stroke="#ffffff" strokeWidth="0.12" opacity="0.5" />
          <line x1="0.7" y1="0" x2="0.7" y2="8" stroke="#5d646b" strokeWidth="0.1" opacity="0.45" />
        </pattern>
        <filter id="f-soft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
        {/* doors/drawers sit proud of the face frame and cast a soft shadow */}
        <filter id="f-door" x="-25%" y="-25%" width="150%" height="160%">
          <feDropShadow dx="0.22" dy="0.5" stdDeviation="0.45" floodColor="#000000" floodOpacity="0.32" />
        </filter>
        <filter id="f-handle" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0.15" dy="0.35" stdDeviation="0.3" floodColor="#000000" floodOpacity="0.4" />
        </filter>
        <pattern id="p-hatch" patternUnits="userSpaceOnUse" width="3.5" height="3.5" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="3.5" stroke="#aab1bd" strokeWidth="1" />
        </pattern>
      </defs>
    </svg>
  );
}

function Shaker({ x, y, w, h, fin }: { x: number; y: number; w: number; h: number; fin: FinishOption }) {
  const inset = Math.min(2.5, w / 5, h / 5);
  const iw = Math.max(0.5, w - inset * 2);
  const ih = Math.max(0.5, h - inset * 2);
  // NewAge louvered door: horizontal slats in the door finish over a dark backing
  if (fin.naDoor === 'louvered' && h >= 8) {
    const fr = 1.1;
    const pitch = 2.1;
    const n = Math.max(3, Math.floor((h - fr * 2) / pitch));
    return (
      <g filter="url(#f-door)">
        <rect x={x} y={y} width={w} height={h} rx={0.35} fill={fin.panel} />
        <rect x={x} y={y} width={w} height={h} rx={0.35} fill="url(#g-door)" />
        {Array.from({ length: n }, (_, i) => {
          const sy = y + fr + ((h - fr * 2) * (i + 1)) / (n + 0.0001);
          return <line key={i} x1={x + fr} y1={sy} x2={x + w - fr} y2={sy} stroke={fin.inner} strokeWidth={0.5} opacity={0.85} />;
        })}
        <rect x={x} y={y} width={w} height={h} rx={0.35} fill="url(#g-sheen)" />
        <rect x={x} y={y} width={w} height={h} rx={0.35} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={0.22} />
      </g>
    );
  }
  // NewAge tempered-glass door: metal frame + tinted reflective pane
  if (fin.naDoor === 'glass' && h >= 8) {
    const fr = 1.6;
    return (
      <g filter="url(#f-door)">
        <rect x={x} y={y} width={w} height={h} rx={0.35} fill={fin.body} />
        <rect x={x} y={y} width={w} height={h} rx={0.35} fill="url(#g-door)" />
        <rect x={x + fr} y={y + fr} width={Math.max(0.5, w - fr * 2)} height={Math.max(0.5, h - fr * 2)} fill={fin.panel} />
        {/* diagonal glass glare */}
        <path
          d={`M ${x + fr} ${y + h - fr} L ${x + fr + (w - fr * 2) * 0.45} ${y + fr} L ${x + fr + (w - fr * 2) * 0.65} ${y + fr} L ${x + fr + (w - fr * 2) * 0.2} ${y + h - fr} Z`}
          fill="#ffffff"
          opacity={0.1}
        />
        <rect x={x + fr} y={y + fr} width={Math.max(0.5, w - fr * 2)} height={Math.max(0.5, h - fr * 2)} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={0.2} />
      </g>
    );
  }
  // NewAge flat metal door (Classic series): plain slab, no shaker recess
  if (fin.naDoor === 'flat') {
    return (
      <g filter="url(#f-door)">
        <rect x={x} y={y} width={w} height={h} rx={0.35} fill={fin.panel} />
        <rect x={x} y={y} width={w} height={h} rx={0.35} fill="url(#g-door)" />
        <rect x={x} y={y} width={w} height={h} rx={0.35} fill="url(#g-sheen)" />
        <line x1={x + 0.4} y1={y + 0.18} x2={x + w - 0.4} y2={y + 0.18} stroke="#ffffff" strokeWidth={0.22} opacity={0.5} />
      </g>
    );
  }
  return (
    // the whole door sits proud of the cabinet and casts a soft shadow
    <g filter="url(#f-door)">
      {/* frame */}
      <rect x={x} y={y} width={w} height={h} rx={0.35} fill={fin.panel} />
      <rect x={x} y={y} width={w} height={h} rx={0.35} fill="url(#g-door)" />
      <rect x={x} y={y} width={w} height={h} rx={0.35} fill="url(#g-sheen)" />
      {/* top edge catches the light */}
      <line x1={x + 0.4} y1={y + 0.18} x2={x + w - 0.4} y2={y + 0.18} stroke="#ffffff" strokeWidth={0.22} opacity={0.5} />
      {/* recessed center panel */}
      <rect x={x + inset} y={y + inset} width={iw} height={ih} fill={fin.inner} />
      <rect x={x + inset} y={y + inset} width={iw} height={ih} fill="url(#g-door)" opacity={0.55} />
      {/* blurred shadow the frame casts onto the panel (top + left) */}
      <rect x={x + inset} y={y + inset} width={iw} height={Math.min(2.4, ih)} fill="url(#g-recess)" />
      <rect x={x + inset} y={y + inset} width={Math.min(1.5, iw)} height={ih} fill="url(#g-recess-h)" />
      {/* crisp bevel edges of the recess */}
      <path
        d={`M ${x + inset} ${y + inset + ih} L ${x + inset} ${y + inset} L ${x + inset + iw} ${y + inset}`}
        fill="none"
        stroke="rgba(0,0,0,0.30)"
        strokeWidth={0.22}
      />
      <path
        d={`M ${x + inset} ${y + inset + ih} L ${x + inset + iw} ${y + inset + ih} L ${x + inset + iw} ${y + inset}`}
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={0.22}
      />
      {/* light catching the bottom rail of the recess */}
      <line x1={x + inset + 0.3} y1={y + inset + ih + 0.35} x2={x + inset + iw - 0.3} y2={y + inset + ih + 0.35} stroke="#ffffff" strokeWidth={0.25} opacity={0.25} />
    </g>
  );
}

function Knob({ x, y }: { x: number; y: number }) {
  return (
    <g filter="url(#f-handle)">
      <circle cx={x} cy={y} r={0.75} fill="url(#g-knob)" stroke={STEEL_LN} strokeWidth={0.1} />
      <circle cx={x - 0.2} cy={y - 0.22} r={0.2} fill="#ffffff" opacity={0.8} />
    </g>
  );
}

function BarHandle({ x, y, len, vertical = false }: { x: number; y: number; len: number; vertical?: boolean }) {
  return vertical ? (
    <g filter="url(#f-handle)">
      <rect x={x - 0.55} y={y} width={1.1} height={len} rx={0.55} fill="url(#g-steel-h)" stroke={STEEL_LN} strokeWidth={0.1} />
      <rect x={x - 0.26} y={y + 0.4} width={0.34} height={len - 0.8} rx={0.17} fill="#ffffff" opacity={0.7} />
    </g>
  ) : (
    <g filter="url(#f-handle)">
      <rect x={x} y={y - 0.55} width={len} height={1.1} rx={0.55} fill="url(#g-steel)" stroke={STEEL_LN} strokeWidth={0.1} />
      <rect x={x + 0.4} y={y - 0.26} width={len - 0.8} height={0.34} rx={0.17} fill="#ffffff" opacity={0.7} />
    </g>
  );
}

function Toekick({ w, h }: { w: number; h: number }) {
  return (
    <g>
      <rect x={1.5} y={h - TOEKICK_H} width={w - 3} height={TOEKICK_H} fill="rgba(0,0,0,0.42)" />
      {/* shadow cast by the doors above onto the recessed kick */}
      <rect x={1.5} y={h - TOEKICK_H} width={w - 3} height={1.6} fill="url(#g-recess)" />
    </g>
  );
}

function Knobs({ cx, y, n }: { cx: number; y: number; n: number }) {
  const gap = 4.5;
  const start = cx - ((n - 1) * gap) / 2;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <circle cx={start + i * gap} cy={y} r={1.3} fill="url(#g-knob)" stroke={STEEL_LN} strokeWidth={0.18} />
          <rect x={start + i * gap - 0.25} y={y - 1.1} width={0.5} height={1.1} fill={STEEL_LN} />
        </g>
      ))}
    </g>
  );
}

/** Stainless built-in grill head, drawn ABOVE the carcass (negative y). */
function GrillHead({ w, counter }: { w: number; counter: boolean }) {
  const gw = Math.max(20, w - 3);
  const x = (w - gw) / 2;
  const base = counter ? -COUNTER_T : 0;
  const bodyH = 8;
  const hoodH = 12;
  const by = base - bodyH;
  const hoodPath = `M ${x} ${by} L ${x + 2.5} ${by - hoodH + 2} Q ${x + 2.5} ${by - hoodH} ${x + 5} ${by - hoodH} L ${x + gw - 5} ${by - hoodH} Q ${x + gw - 2.5} ${by - hoodH} ${x + gw - 2.5} ${by - hoodH + 2} L ${x + gw} ${by} Z`;
  return (
    <g>
      <rect x={x} y={by} width={gw} height={bodyH} fill="url(#g-steel)" stroke={STEEL_LN} strokeWidth={0.25} />
      <rect x={x} y={by} width={gw} height={bodyH} fill="url(#p-brush)" opacity={0.45} />
      <Knobs cx={x + gw / 2} y={by + bodyH - 2.6} n={Math.max(3, Math.min(5, Math.round(gw / 9)))} />
      <path d={hoodPath} fill="url(#g-steel)" stroke={STEEL_LN} strokeWidth={0.25} />
      <path d={hoodPath} fill="url(#p-brush)" opacity={0.4} />
      <rect x={x + 6} y={by - hoodH + 3.2} width={gw - 12} height={1.2} rx={0.6} fill="url(#g-steel-h)" stroke={STEEL_LN} strokeWidth={0.12} filter="url(#f-handle)" />
      <line x1={x} y1={by} x2={x + gw} y2={by} stroke={STEEL_LN} strokeWidth={0.3} />
    </g>
  );
}

/** Drop-in glass cooktop: a slim black slab sitting on the counter (or on a
 *  range body when counter=false). */
function CooktopSlab({ w, counter }: { w: number; counter: boolean }) {
  const cw = Math.min(w - 4, 30);
  const x = (w - cw) / 2;
  const base = counter ? -COUNTER_T : 0;
  return (
    <g>
      <rect x={x} y={base - 0.8} width={cw} height={0.8} rx={0.25} fill="#141518" />
      <line x1={x + 0.6} y1={base - 0.62} x2={x + cw - 0.6} y2={base - 0.62} stroke="#ffffff" strokeWidth={0.18} opacity={0.35} />
    </g>
  );
}

function GriddleHead({ w, counter }: { w: number; counter: boolean }) {
  const gw = Math.max(20, w - 3);
  const x = (w - gw) / 2;
  const base = counter ? -COUNTER_T : 0;
  const bodyH = 6;
  const lidH = 6;
  const by = base - bodyH;
  return (
    <g>
      <rect x={x} y={by} width={gw} height={bodyH} fill="url(#g-steel)" stroke={STEEL_LN} strokeWidth={0.25} />
      <rect x={x} y={by} width={gw} height={bodyH} fill="url(#p-brush)" opacity={0.45} />
      <Knobs cx={x + gw / 2} y={by + bodyH - 2.4} n={3} />
      <rect x={x + 1} y={by - lidH} width={gw - 2} height={lidH} rx={1.6} fill="url(#g-steel)" stroke={STEEL_LN} strokeWidth={0.25} />
      <rect x={x + 1} y={by - lidH} width={gw - 2} height={lidH} rx={1.6} fill="url(#p-brush)" opacity={0.4} />
      <rect x={x + gw / 2 - 6} y={by - lidH + 1.8} width={12} height={1.1} rx={0.55} fill="url(#g-steel-h)" stroke={STEEL_LN} strokeWidth={0.12} filter="url(#f-handle)" />
    </g>
  );
}

function BurnerLid({ w, counter }: { w: number; counter: boolean }) {
  const gw = Math.max(12, w - 4);
  const x = (w - gw) / 2;
  const base = counter ? -COUNTER_T : 0;
  return (
    <g>
      <rect x={x} y={base - 4} width={gw} height={4} rx={1} fill="url(#g-steel)" stroke={STEEL_LN} strokeWidth={0.25} />
      <rect x={x} y={base - 4} width={gw} height={4} rx={1} fill="url(#p-brush)" opacity={0.4} />
      <rect x={x + gw / 2 - 4} y={base - 4 + 1.3} width={8} height={1} rx={0.5} fill="url(#g-steel-h)" stroke={STEEL_LN} strokeWidth={0.12} filter="url(#f-handle)" />
    </g>
  );
}

function KamadoEgg({ w, counter, standalone, h }: { w: number; counter: boolean; standalone?: boolean; h?: number }) {
  if (standalone && h) {
    const cx = w / 2;
    const eggR = Math.min(w / 2 - 3, 14);
    const eggCy = h - 14 - eggR;
    return (
      <g>
        <ellipse cx={cx} cy={eggCy} rx={eggR} ry={eggR * 1.15} fill="#1f3a2e" stroke="#142a21" strokeWidth={0.3} />
        <ellipse cx={cx - eggR * 0.35} cy={eggCy - eggR * 0.4} rx={eggR * 0.35} ry={eggR * 0.55} fill="#ffffff" opacity={0.12} />
        <rect x={cx - eggR - 1} y={eggCy - 2} width={(eggR + 1) * 2} height={2.4} rx={1} fill="#3a3f44" />
        <circle cx={cx} cy={eggCy - eggR * 0.55} r={1.6} fill="#3a3f44" />
        <line x1={cx - eggR} y1={h - 6} x2={cx - 2} y2={eggCy + eggR} stroke="#55595e" strokeWidth={1} />
        <line x1={cx + eggR} y1={h - 6} x2={cx + 2} y2={eggCy + eggR} stroke="#55595e" strokeWidth={1} />
        <line x1={cx - eggR - 1} y1={h - 5} x2={cx + eggR + 1} y2={h - 5} stroke="#55595e" strokeWidth={1} />
        <circle cx={cx - eggR + 1} cy={h - 2.4} r={2.4} fill="#3a3f44" />
        <circle cx={cx + eggR - 1} cy={h - 2.4} r={2.4} fill="#3a3f44" />
      </g>
    );
  }
  const cx = w / 2;
  const base = counter ? -COUNTER_T : 0;
  const eggR = Math.min(w / 2 - 4, 12);
  const eggCy = base - eggR * 0.95;
  return (
    <g>
      <ellipse cx={cx} cy={eggCy} rx={eggR} ry={eggR * 1.1} fill="#1f3a2e" stroke="#142a21" strokeWidth={0.3} />
      <ellipse cx={cx - eggR * 0.35} cy={eggCy - eggR * 0.35} rx={eggR * 0.32} ry={eggR * 0.5} fill="#ffffff" opacity={0.12} />
      <rect x={cx - eggR - 1} y={eggCy - 1.5} width={(eggR + 1) * 2} height={2.2} rx={1} fill="#3a3f44" />
      <circle cx={cx} cy={eggCy - eggR * 0.55} r={1.5} fill="#3a3f44" />
    </g>
  );
}

function Faucet({ w, counter }: { w: number; counter: boolean }) {
  const cx = w / 2;
  const base = counter ? -COUNTER_T : 0;
  return (
    <path
      d={`M ${cx - 0.8} ${base} L ${cx - 0.8} ${base - 9} Q ${cx - 0.8} ${base - 11.5} ${cx + 2} ${base - 11.5} L ${cx + 5} ${base - 11.5} L ${cx + 5} ${base - 9.5}`}
      fill="none"
      stroke={STEEL_DK}
      strokeWidth={1.4}
      strokeLinecap="round"
    />
  );
}

export interface FrontProps {
  cat: CatalogItem;
  w: number;
  h: number;
  fin: FinishOption;
  hinge?: HingeSide;
}

/** Elevation (front) rendering of a cabinet/appliance, origin at carcass top-left. */
export function CabinetFront({ cat, w, h, fin, hinge = 'left' }: FrontProps) {
  const floor = cat.lane === 'floor';
  const kick = floor && cat.category !== 'appliance' ? TOEKICK_H : 0;
  const fh = h - kick; // front (door/drawer) area height
  const gap = 0.75;

  const body = (
    <g>
      <rect x={0} y={0} width={w} height={h} fill={fin.body} stroke="rgba(0,0,0,0.22)" strokeWidth={0.25} />
      <rect x={0} y={0} width={w} height={h} fill="url(#g-shade)" opacity={0.5} />
      {/* ambient occlusion at the carcass sides */}
      <rect x={0} y={0} width={Math.min(1.4, w / 6)} height={h} fill="url(#g-recess-h)" opacity={0.8} />
      <g transform={`translate(${w} 0) scale(-1 1)`}>
        <rect x={0} y={0} width={Math.min(1.4, w / 6)} height={h} fill="url(#g-recess-h)" opacity={0.8} />
      </g>
    </g>
  );
  const kickEl = kick > 0 ? <Toekick w={w} h={h} /> : null;

  // Single doors: handle goes opposite the hinge. NewAge handles follow the
  // real products: Classic (flat metal) doors take horizontal pulls at the
  // top corner; Louvered/Aluminum doors take a vertical edge bar.
  const naBar = !!fin.line;
  const naTopPull = naBar && fin.naDoor === 'flat';
  const doors = (n: number, y = 0, dh = fh) => {
    const dw = (w - gap * (n + 1)) / n;
    const handleLen = naBar ? Math.min(14, dh * 0.5) : Math.min(7, dh * 0.4);
    // Base doors: pull near the top. Wall (upper-lane) doors: pull at the
    // BOTTOM. Tall doors: cap the pull at a reachable height (~44″ off the
    // floor; svg y runs down from the carcass top, floor at y = h).
    let hy = y + dh * 0.16;
    if (cat.lane === 'upper') hy = y + dh - handleLen - dh * 0.06;
    else if (h - (y + dh * 0.16) > 48) hy = Math.min(y + dh - handleLen - 1.4, Math.max(y + 1.4, h - 44 - handleLen / 2));
    return (
      <g>
        {Array.from({ length: n }, (_, i) => {
          const dx = gap + i * (dw + gap);
          let hx: number;
          if (n === 1) hx = hinge === 'left' ? dx + dw - 1.8 : dx + 1.8;
          else hx = i < n / 2 ? dx + dw - 1.8 : dx + 1.8;
          const topLen = Math.min(8, dw * 0.45);
          // wall (upper-lane) cabinet handles sit at the BOTTOM of the door
          const low = cat.lane === 'upper';
          return (
            <g key={i}>
              <Shaker x={dx} y={y + gap} w={dw} h={dh - gap * 2} fin={fin} />
              {naTopPull && dh > 8 ? (
                <BarHandle x={hx > dx + dw / 2 ? hx - topLen : hx} y={low ? y + dh - gap - 2.2 : y + gap + 1.6} len={topLen} />
              ) : dh > 14 ? (
                <BarHandle x={hx} y={hy} len={handleLen} vertical />
              ) : (
                <Knob x={hx} y={low ? y + dh - 3 : y + dh / 2} />
              )}
            </g>
          );
        })}
        {/* dark seam between door pairs */}
        {Array.from({ length: n - 1 }, (_, i) => (
          <rect
            key={`seam-${i}`}
            x={gap + (i + 1) * dw + (i + 0.5) * gap - 0.14}
            y={y + gap + 0.6}
            width={0.28}
            height={dh - gap * 2 - 1.2}
            fill="rgba(0,0,0,0.30)"
          />
        ))}
      </g>
    );
  };

  const drawers = (n: number, y = 0, dh = fh, topSmall = true) => {
    const rows: number[] = [];
    if (topSmall && n >= 3) {
      const top = dh * 0.24;
      const rest = (dh - top) / (n - 1);
      rows.push(top);
      for (let i = 1; i < n; i++) rows.push(rest);
    } else {
      for (let i = 0; i < n; i++) rows.push(dh / n);
    }
    let cy = y;
    return (
      <g>
        {rows.map((rh, i) => {
          const el = (
            <g key={i}>
              <Shaker x={gap} y={cy + gap} w={w - gap * 2} h={rh - gap * 2} fin={fin} />
              <BarHandle
                x={w / 2 - (naBar ? Math.min(6, w * 0.25) : Math.min(5, w / 4))}
                y={naBar ? cy + gap + 1.6 : cy + rh / 2}
                len={naBar ? Math.min(12, w * 0.5) : Math.min(10, w / 2)}
              />
            </g>
          );
          cy += rh;
          return el;
        })}
      </g>
    );
  };

  let front: JSX.Element | null = null;
  let gear: JSX.Element | null = null;

  switch (cat.front) {
    case 'door1':
      front = doors(1);
      break;
    case 'door2':
    case 'susan':
      front = doors(w >= 24 ? 2 : 1);
      break;
    case 'flipup':
      // gas-assist flip-up door: one full-width panel, pull at the bottom center
      front = (
        <g>
          <Shaker x={gap} y={gap} w={w - gap * 2} h={fh - gap * 2} fin={fin} />
          <BarHandle x={w / 2 - Math.min(5, w / 4)} y={fh - gap - 1.8} len={Math.min(10, w / 2)} />
        </g>
      );
      break;
    case 'corner': {
      // NewAge 90° corner: an open pentagon frame — posts + shelves, no door
      if (naBar) {
        const dw = (w - gap * 2) * 0.62;
        const lx = (w - dw) / 2;
        front = (
          <g>
            <rect x={lx} y={gap} width={dw} height={fh - gap * 2} fill={fin.inner} stroke="rgba(0,0,0,0.2)" strokeWidth={0.2} />
            <rect x={lx} y={gap} width={dw} height={fh - gap * 2} fill="url(#g-shade)" opacity={0.6} />
            <line x1={lx} y1={fh * 0.5} x2={lx + dw} y2={fh * 0.5} stroke={fin.body} strokeWidth={1.2} />
            <rect x={lx} y={gap} width={1.4} height={fh - gap * 2} fill={fin.body} />
            <rect x={lx + dw - 1.4} y={gap} width={1.4} height={fh - gap * 2} fill={fin.body} />
          </g>
        );
        break;
      }
      // angled corner-cabinet face: a centered door with body-colored returns.
      // Wall corners take their handle at the BOTTOM like every upper cabinet.
      const dw = (w - gap * 2) * 0.62;
      const lx = (w - dw) / 2;
      const chLen = Math.min(7, fh * 0.4);
      front = (
        <g>
          <rect x={lx} y={gap} width={dw} height={fh - gap * 2} fill={fin.body} />
          <Shaker x={lx} y={gap} w={dw} h={fh - gap * 2} fin={fin} />
          <BarHandle x={lx + 1.8} y={cat.lane === 'upper' ? fh - gap - chLen - 1.5 : fh * 0.16} len={chLen} vertical />
        </g>
      );
      break;
    }
    case 'blind':
    case 'blindl':
    case 'blindr': {
      // Blind portion (slab) toward the corner; working door away from it.
      const doorW = Math.max(12, w - 24);
      const blindW = w - doorW - gap * 3;
      // blindl/blindr fix the blind side; legacy 'blind' derives it from hinge
      const blindOnLeft = cat.front === 'blindl' || (cat.front === 'blind' && hinge === 'right');
      const doorX = blindOnLeft ? w - gap - doorW : gap;
      const blindX = blindOnLeft ? gap : doorW + gap * 2;
      // handle side moves with the rehinge (hinge) toggle
      const handleX = hinge === 'left' ? doorX + 1.8 : doorX + doorW - 1.8;
      front = (
        <g>
          <g filter="url(#f-door)">
            <rect x={blindX} y={gap} width={Math.max(0.5, blindW)} height={fh - gap * 2} rx={0.35} fill={fin.panel} />
            <rect x={blindX} y={gap} width={Math.max(0.5, blindW)} height={fh - gap * 2} rx={0.35} fill="url(#g-door)" />
          </g>
          <Shaker x={doorX} y={gap} w={doorW} h={fh - gap * 2} fin={fin} />
          <BarHandle x={handleX} y={fh * 0.28} len={Math.min(7, fh * 0.4)} vertical />
        </g>
      );
      break;
    }
    case 'cooktop': {
      // false front (no pull) up top, doors below; glass cooktop above counter
      const topH = fh * 0.2;
      front = (
        <g>
          <Shaker x={gap} y={gap} w={w - gap * 2} h={topH - gap} fin={fin} />
          {doors(w >= 24 ? 2 : 1, topH, fh - topH)}
        </g>
      );
      gear = <CooktopSlab w={w} counter={cat.counter} />;
      break;
    }
    case 'range': {
      const rw = w - gap * 2;
      const knobY = gap + 2;
      const winY = gap + 8.5;
      const winH = fh * 0.34;
      front = (
        <g>
          <rect x={gap} y={gap} width={rw} height={fh - gap * 2} rx={0.8} fill="url(#g-steel)" stroke={STEEL_LN} strokeWidth={0.3} />
          <rect x={gap} y={gap} width={rw} height={fh - gap * 2} rx={0.8} fill="url(#p-brush)" opacity={0.45} />
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={gap + rw * (0.14 + i * 0.18)} cy={knobY} r={1.05} fill={STEEL_DK} />
          ))}
          <BarHandle x={w / 2 - rw * 0.42} y={gap + 4.6} len={rw * 0.84} />
          <rect x={w / 2 - rw * 0.31} y={winY} width={rw * 0.62} height={winH} rx={1} fill="#1b1c1e" />
          <rect x={w / 2 - rw * 0.31} y={winY} width={rw * 0.62} height={winH * 0.4} rx={1} fill="#ffffff" opacity={0.07} />
          <line x1={gap + 1} y1={fh - 6.5} x2={w - gap - 1} y2={fh - 6.5} stroke={STEEL_LN} strokeWidth={0.4} />
          <BarHandle x={w / 2 - rw * 0.2} y={fh - 5.2} len={rw * 0.4} />
        </g>
      );
      gear = <CooktopSlab w={w} counter={false} />;
      break;
    }
    case 'drawers3':
      front = drawers(3);
      break;
    case 'drawers4':
      front = drawers(4, 0, fh, false);
      break;
    case 'doordrawer': {
      const dh = fh * 0.28;
      front = (
        <g>
          {drawers(1, 0, dh, false)}
          {doors(1, dh, fh - dh)}
        </g>
      );
      break;
    }
    case 'sink':
    case 'sink2':
    case 'sink1':
    case 'sink1f': {
      const twoDoor = (cat.front === 'sink' || cat.front === 'sink2') && w >= 24;
      const falseF = cat.front === 'sink' || cat.front === 'sink1f';
      const topH = falseF ? fh * 0.2 : 0;
      front = (
        <g>
          {falseF && (
            <g>
              <Shaker x={gap} y={gap} w={w - gap * 2} h={topH - gap} fin={fin} />
              <BarHandle x={w / 2 - Math.min(5, w / 4)} y={topH * 0.55} len={Math.min(10, w / 2)} />
            </g>
          )}
          {doors(twoDoor ? 2 : 1, falseF ? topH : 0, falseF ? fh - topH : fh)}
        </g>
      );
      gear = <Faucet w={w} counter={cat.counter} />;
      break;
    }
    case 'open':
      front = (
        <g>
          <rect x={gap} y={gap} width={w - gap * 2} height={fh - gap * 2} fill={fin.inner} stroke="rgba(0,0,0,0.2)" strokeWidth={0.2} />
          <rect x={gap} y={gap} width={w - gap * 2} height={fh - gap * 2} fill="url(#g-shade)" opacity={0.6} />
          <line x1={gap} y1={fh / 3} x2={w - gap} y2={fh / 3} stroke={fin.body} strokeWidth={1} />
          <line x1={gap} y1={(fh / 3) * 2} x2={w - gap} y2={(fh / 3) * 2} stroke={fin.body} strokeWidth={1} />
        </g>
      );
      break;
    case 'pantry': {
      const split = fh * 0.62;
      front = (
        <g>
          {doors(w >= 24 ? 2 : 1, 0, split)}
          {doors(w >= 24 ? 2 : 1, split, fh - split)}
        </g>
      );
      break;
    }
    case 'trash':
      front = (
        <g>
          {drawers(1, 0, fh, false)}
          <path
            d={`M ${w / 2 - 2.2} ${fh / 2 + 3} h 4.4 l -0.7 5.5 h -3 Z M ${w / 2 - 3} ${fh / 2 + 3} h 6 M ${w / 2 - 1} ${fh / 2 + 1.8} h 2 v 1.2`}
            fill="none"
            stroke="#6b7177"
            strokeWidth={0.5}
          />
        </g>
      );
      break;
    case 'grill':
    case 'grill4':
      front = doors(cat.front === 'grill4' ? 4 : 2);
      gear = <GrillHead w={w} counter={cat.counter} />;
      break;
    case 'griddle':
    case 'griddle4':
      front = doors(cat.front === 'griddle4' ? 4 : 2);
      gear = <GriddleHead w={w} counter={cat.counter} />;
      break;
    case 'burner':
      front = doors(1);
      gear = <BurnerLid w={w} counter={cat.counter} />;
      break;
    case 'propane':
      front = (
        <g>
          {doors(1)}
          {[0.35, 0.5, 0.65].map((f, i) => (
            <rect key={i} x={w * 0.25} y={fh * f} width={w * 0.5} height={1} rx={0.5} fill="rgba(0,0,0,0.25)" />
          ))}
        </g>
      );
      break;
    case 'fridge':
      front = (
        <g>
          <rect x={gap} y={gap} width={w - gap * 2} height={fh - gap * 2} rx={0.8} fill="url(#g-steel)" stroke={STEEL_LN} strokeWidth={0.3} />
          <rect x={gap} y={gap} width={w - gap * 2} height={fh - gap * 2} rx={0.8} fill="url(#p-brush)" opacity={0.45} />
          <BarHandle x={hinge === 'left' ? w - 4 : 4} y={5} len={fh * 0.55} vertical />
          <rect x={gap + 2} y={fh - 6} width={w - gap * 2 - 4} height={3.2} rx={0.6} fill={STEEL_DK} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={i} x1={gap + 3.5 + i * ((w - 11) / 5)} y1={fh - 5.4} x2={gap + 3.5 + i * ((w - 11) / 5)} y2={fh - 3.4} stroke={STEEL_LN} strokeWidth={0.4} />
          ))}
        </g>
      );
      break;
    case 'fridge2':
      front = (
        <g>
          {[0, 1].map((i) => {
            const dh = (fh - 6 - gap) / 2;
            const dy = gap + i * (dh + gap);
            return (
              <g key={i}>
                <rect x={gap} y={dy} width={w - gap * 2} height={dh} rx={0.8} fill="url(#g-steel)" stroke={STEEL_LN} strokeWidth={0.3} />
                <rect x={gap} y={dy} width={w - gap * 2} height={dh} rx={0.8} fill="url(#p-brush)" opacity={0.45} />
                <BarHandle x={w / 2 - Math.min(6, w / 4)} y={dy + dh / 2} len={Math.min(12, w / 2)} />
              </g>
            );
          })}
          <rect x={gap + 2} y={fh - 6} width={w - gap * 2 - 4} height={3.2} rx={0.6} fill={STEEL_DK} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={i} x1={gap + 3.5 + i * ((w - 11) / 5)} y1={fh - 5.4} x2={gap + 3.5 + i * ((w - 11) / 5)} y2={fh - 3.4} stroke={STEEL_LN} strokeWidth={0.4} />
          ))}
        </g>
      );
      break;
    case 'fridgep':
      front = doors(1);
      break;
    case 'fridgep2':
      front = drawers(2, 0, fh, false);
      break;
    case 'dishwasher':
    case 'icemaker': {
      const ctrlH = 4;
      const ventH = cat.front === 'icemaker' ? 3.5 : 0;
      const doorY = gap + ctrlH + gap;
      const doorH = fh - doorY - ventH - gap;
      front = (
        <g>
          {/* top control panel with a display */}
          <rect x={gap} y={gap} width={w - gap * 2} height={ctrlH} rx={0.6} fill="url(#g-steel)" stroke={STEEL_LN} strokeWidth={0.3} />
          <rect x={gap + 2} y={gap + 1} width={(w - gap * 2) * 0.28} height={ctrlH - 2} rx={0.4} fill={STEEL_DK} />
          {/* door panel + handle */}
          <rect x={gap} y={doorY} width={w - gap * 2} height={doorH} rx={0.8} fill="url(#g-steel)" stroke={STEEL_LN} strokeWidth={0.3} />
          <rect x={gap} y={doorY} width={w - gap * 2} height={doorH} rx={0.8} fill="url(#p-brush)" opacity={0.4} />
          <rect x={gap + 3} y={doorY + 2} width={w - gap * 2 - 6} height={1.4} rx={0.7} fill="url(#g-steel-h)" stroke={STEEL_LN} strokeWidth={0.12} filter="url(#f-handle)" />
          {/* ice maker bottom vent grille */}
          {cat.front === 'icemaker' && (
            <g>
              <rect x={gap + 2} y={fh - ventH - gap} width={w - gap * 2 - 4} height={ventH} rx={0.4} fill={STEEL_DK} />
              {[0, 1, 2, 3].map((i) => (
                <line key={i} x1={gap + 3.5} y1={fh - ventH - gap + 1 + i * 0.8} x2={w - gap - 3.5} y2={fh - ventH - gap + 1 + i * 0.8} stroke={STEEL_LN} strokeWidth={0.3} />
              ))}
            </g>
          )}
        </g>
      );
      break;
    }
    case 'kamado':
      if (cat.category === 'appliance') {
        front = <KamadoEgg w={w} counter={false} standalone h={h} />;
      } else {
        front = doors(2);
        gear = <KamadoEgg w={w} counter={cat.counter} />;
      }
      break;
    case 'kamadoinsert': {
      // doors below + an open 12″ compartment with the kamado set into it
      const openH = 12;
      const doorH = fh - openH - gap;
      front = (
        <g>
          {doors(2, openH + gap, doorH)}
          {/* open compartment (recessed interior) */}
          <rect x={gap} y={0} width={w - gap * 2} height={openH} rx={0.6} fill="url(#g-recess)" stroke="rgba(0,0,0,0.25)" strokeWidth={0.3} />
        </g>
      );
      gear = <KamadoEgg w={w} counter={false} />;
      break;
    }
    case 'pizza': {
      const domeR = Math.min(w / 2 - 2, 16);
      const cx = w / 2;
      const standH = h * 0.45;
      front = (
        <g>
          <rect x={cx - domeR} y={h - standH} width={domeR * 2} height={standH - 3} fill="#55595e" />
          <circle cx={cx - domeR + 3} cy={h - 2.4} r={2.4} fill="#3a3f44" />
          <circle cx={cx + domeR - 3} cy={h - 2.4} r={2.4} fill="#3a3f44" />
          <path d={`M ${cx - domeR} ${h - standH} A ${domeR} ${domeR * 0.92} 0 0 1 ${cx + domeR} ${h - standH} Z`} fill="#b8643c" stroke="#8f4c2d" strokeWidth={0.4} />
          <path d={`M ${cx - domeR * 0.45} ${h - standH} A ${domeR * 0.45} ${domeR * 0.5} 0 0 1 ${cx + domeR * 0.45} ${h - standH} Z`} fill="#2b2e31" />
          <rect x={cx + domeR * 0.55} y={h - standH - domeR * 0.95} width={2.4} height={domeR * 0.5} fill="#8f4c2d" />
        </g>
      );
      break;
    }
    case 'cartgrill': {
      const cartH = h * 0.58;
      const bodyH = h - cartH;
      const shelf = Math.min(10, w * 0.16);
      const gw = w - shelf * 2;
      front = (
        <g>
          <rect x={0} y={bodyH - 1.5} width={shelf} height={1.5} fill={STEEL_DK} />
          <rect x={w - shelf} y={bodyH - 1.5} width={shelf} height={1.5} fill={STEEL_DK} />
          <rect x={shelf} y={bodyH * 0.45} width={gw} height={bodyH * 0.55} fill="url(#g-steel)" stroke={STEEL_LN} strokeWidth={0.3} />
          <Knobs cx={w / 2} y={bodyH * 0.45 + bodyH * 0.55 - 2.6} n={4} />
          <path
            d={`M ${shelf} ${bodyH * 0.45} L ${shelf + 2} ${bodyH * 0.05} Q ${shelf + 2.5} ${0} ${shelf + 5} ${0} L ${shelf + gw - 5} ${0} Q ${shelf + gw - 2.5} ${0} ${shelf + gw - 2} ${bodyH * 0.05} L ${shelf + gw} ${bodyH * 0.45} Z`}
            fill="url(#g-steel)"
            stroke={STEEL_LN}
            strokeWidth={0.3}
          />
          <rect x={shelf + 6} y={bodyH * 0.16} width={gw - 12} height={1.2} rx={0.6} fill="url(#g-steel-h)" stroke={STEEL_LN} strokeWidth={0.12} />
          <rect x={shelf} y={bodyH} width={gw} height={cartH - 5} fill="url(#g-steel)" stroke={STEEL_LN} strokeWidth={0.3} />
          <rect x={shelf} y={bodyH} width={gw} height={cartH - 5} fill="url(#p-brush)" opacity={0.4} />
          <line x1={w / 2} y1={bodyH + 1.5} x2={w / 2} y2={bodyH + cartH - 6.5} stroke={STEEL_LN} strokeWidth={0.3} />
          <circle cx={shelf + 4} cy={h - 2.6} r={2.6} fill="#3a3f44" />
          <circle cx={w - shelf - 4} cy={h - 2.6} r={2.6} fill="#3a3f44" />
        </g>
      );
      break;
    }
  }

  const noBody = cat.category === 'appliance';
  return (
    <g>
      {noBody ? null : body}
      {front}
      {kickEl}
      {gear}
    </g>
  );
}

/**
 * Catalog-card rendering: front face plus receding side and top faces in a
 * light carcass color, like a product render.
 */
export function CabinetIso({ cat, fin, hinge = 'left' }: { cat: CatalogItem; fin: FinishOption; hinge?: HingeSide }) {
  const { w, h, d } = cat;
  const ox = d * 0.5;
  const oy = d * 0.26;
  const flat = cat.category === 'appliance';
  return (
    <g>
      <ellipse cx={(w + ox) / 2} cy={h + 0.5} rx={(w + ox) / 2 + 1} ry={2.2} fill="#000" opacity={0.1} filter="url(#f-soft)" />
      {!flat && (
        <g>
          {/* top face */}
          <polygon points={`0,0 ${w},0 ${w + ox},${-oy} ${ox},${-oy}`} fill={CARCASS_TOP} stroke="rgba(0,0,0,0.18)" strokeWidth={0.25} />
          {/* side face */}
          <polygon points={`${w},0 ${w + ox},${-oy} ${w + ox},${h - oy} ${w},${h}`} fill={CARCASS_SIDE} stroke="rgba(0,0,0,0.18)" strokeWidth={0.25} />
          <polygon points={`${w},0 ${w + ox},${-oy} ${w + ox},${h - oy} ${w},${h}`} fill="url(#g-shade)" opacity={0.6} />
        </g>
      )}
      <CabinetFront cat={cat} w={w} h={h} fin={fin} hinge={hinge} />
    </g>
  );
}

/** Plan (top) view symbol, origin at wall-side top-left; depth grows downward. */
export function CabinetTop({ cat, w, d, fin, hinge = 'left' }: { cat: CatalogItem; w: number; d: number; fin: FinishOption; hinge?: HingeSide }) {
  const sym = (() => {
    switch (cat.front) {
      case 'sink':
      case 'sink2':
      case 'sink1':
      case 'sink1f':
        return (
          <g>
            <rect x={w / 2 - Math.min(11, w / 2 - 3)} y={d * 0.2} width={Math.min(22, w - 6)} height={d * 0.55} rx={2} fill="#fff" stroke={STEEL_LN} strokeWidth={0.4} />
            <circle cx={w / 2} cy={d * 0.14} r={1.2} fill={STEEL_DK} />
          </g>
        );
      case 'grill':
      case 'grill4':
      case 'cartgrill': {
        const gx = 4;
        return (
          <g>
            <rect x={gx} y={d * 0.15} width={w - gx * 2} height={d * 0.62} rx={1} fill="#e8eaec" stroke={STEEL_LN} strokeWidth={0.4} />
            {Array.from({ length: Math.max(4, Math.floor((w - gx * 2) / 4)) }, (_, i) => (
              <line key={i} x1={gx + 2 + i * 4} y1={d * 0.18} x2={gx + 2 + i * 4} y2={d * 0.74} stroke={STEEL_DK} strokeWidth={0.5} />
            ))}
          </g>
        );
      }
      case 'griddle':
      case 'griddle4':
        return <rect x={4} y={d * 0.15} width={w - 8} height={d * 0.6} rx={1} fill="#dfe2e5" stroke={STEEL_LN} strokeWidth={0.4} />;
      case 'cooktop':
      case 'range': {
        const cw = Math.min(w - 4, 30);
        const cx0 = (w - cw) / 2;
        return (
          <g>
            <rect x={cx0} y={d * 0.12} width={cw} height={d * 0.68} rx={1} fill="#212327" />
            {[0, 1].map((ix) =>
              [0, 1].map((iz) => (
                <circle
                  key={`${ix}${iz}`}
                  cx={cx0 + cw * (0.28 + ix * 0.44)}
                  cy={d * (0.3 + iz * 0.34)}
                  r={iz === 1 ? Math.min(3.4, cw / 8) : Math.min(2.6, cw / 10)}
                  fill="none"
                  stroke="#8d939a"
                  strokeWidth={0.5}
                />
              ))
            )}
          </g>
        );
      }
      case 'burner':
        return (
          <g>
            <circle cx={w / 2} cy={d * 0.45} r={Math.min(5, w / 3)} fill="none" stroke={STEEL_DK} strokeWidth={0.6} />
            <circle cx={w / 2} cy={d * 0.45} r={Math.min(2.2, w / 6)} fill="none" stroke={STEEL_DK} strokeWidth={0.6} />
          </g>
        );
      case 'kamado':
      case 'kamadoinsert':
        return <circle cx={w / 2} cy={d * 0.5} r={Math.min(w, d) / 2 - 3} fill="#1f3a2e" stroke="#142a21" strokeWidth={0.4} />;
      case 'pizza':
        return <circle cx={w / 2} cy={d * 0.5} r={Math.min(w, d) / 2 - 3} fill="#b8643c" stroke="#8f4c2d" strokeWidth={0.4} />;
      case 'fridge':
      case 'fridge2':
      case 'fridgep':
      case 'fridgep2':
      case 'dishwasher':
      case 'icemaker':
        return <rect x={3} y={d - 3} width={w - 6} height={1.6} fill={STEEL_DK} />;
      case 'corner':
      case 'susan': {
        const r = Math.min(w, d) * 0.28;
        return <circle cx={w / 2} cy={d / 2} r={r} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />;
      }
      default:
        return null;
    }
  })();

  // corner cabinets keep a return matching their lane (24" base / 12" wall)
  const cornerRet = cat.lane === 'upper' ? 12 : 24;

  // diagonal corner cabinets draw a chamfered footprint on one side
  if (cat.front === 'corner') {
    const c = Math.max(6, Math.min(w, d) - cornerRet);
    const pts =
      hinge === 'right'
        ? `0,0 ${w},0 ${w},${d} ${c},${d} 0,${d - c}` // chamfer front-left
        : `0,0 ${w},0 ${w},${d - c} ${w - c},${d} 0,${d}`; // chamfer front-right
    return (
      <g>
        <polygon points={pts} fill={fin.body} stroke="rgba(0,0,0,0.35)" strokeWidth={0.4} />
        {sym}
      </g>
    );
  }

  // lazy-susan cabinets draw an L-shaped (notched) footprint
  if (cat.front === 'susan') {
    const leg = Math.min(cornerRet, Math.min(w, d) - 6);
    const pts =
      hinge === 'right'
        ? `0,0 ${w},0 ${w},${d} ${w - leg},${d} ${w - leg},${leg} 0,${leg}`
        : `0,0 ${w},0 ${w},${leg} ${leg},${leg} ${leg},${d} 0,${d}`;
    return (
      <g>
        <polygon points={pts} fill={fin.body} stroke="rgba(0,0,0,0.35)" strokeWidth={0.4} />
        {sym}
      </g>
    );
  }

  return (
    <g>
      <rect x={0} y={0} width={w} height={d} fill={fin.body} stroke="rgba(0,0,0,0.35)" strokeWidth={0.4} />
      <line x1={0.6} y1={d - 0.8} x2={w - 0.6} y2={d - 0.8} stroke="rgba(0,0,0,0.3)" strokeWidth={0.4} />
      {sym}
    </g>
  );
}

/**
 * Plan-view L-shaped countertop outline for a lazy-susan cabinet. Front and
 * notch (room-facing) edges carry the overhang O; wall-side edges do not, so the
 * deep leg lines up flush with an abutting standard cabinet on the next wall.
 */
export function susanCounterPts(w: number, d: number, hinge: HingeSide, O: number): string {
  const leg = Math.min(24, Math.min(w, d) - 6);
  return hinge === 'right'
    ? `0,0 ${w},0 ${w},${d + O} ${w - leg - O},${d + O} ${w - leg - O},${leg + O} 0,${leg + O}`
    : `0,0 ${w},0 ${w},${leg + O} ${leg + O},${leg + O} ${leg + O},${d + O} 0,${d + O}`;
}

/**
 * Plumbing / electrical rough-in glyph, drawn from (0,0) spanning w×h inches.
 * Blue = plumbing (drain + 2 water lines), amber = electrical (duplex outlet);
 * red dashed outline when it conflicts (not directly behind a cabinet).
 */
export function RoughInGlyph({ kind, w, h, conflict }: { kind: RoughInKind; w: number; h: number; conflict: boolean }) {
  // Green when the stub is good (behind a cabinet with clearance, or in open
  // space); red when a cabinet end intrudes on it. The icon shape still tells
  // plumbing vs electrical apart.
  const color = conflict ? '#dc2626' : '#16a34a';
  const fill = conflict ? 'rgba(220,38,38,0.12)' : 'rgba(22,163,74,0.12)';
  const sw = Math.max(0.35, Math.min(w, h) * 0.05);
  const cx = w / 2;
  const cy = h / 2;
  const m = Math.min(w, h);
  return (
    <g>
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        rx={Math.min(1.5, w * 0.12)}
        fill={fill}
        stroke={color}
        strokeWidth={sw}
        strokeDasharray={conflict ? `${sw * 3} ${sw * 2}` : undefined}
      />
      {kind === 'plumbing' ? (
        <g stroke={color} fill="none" strokeWidth={sw}>
          <circle cx={cx} cy={cy} r={m * 0.24} />
          <circle cx={cx} cy={cy} r={m * 0.07} fill={color} />
          <circle cx={cx - w * 0.3} cy={cy} r={m * 0.11} />
          <circle cx={cx + w * 0.3} cy={cy} r={m * 0.11} />
        </g>
      ) : kind === 'electrical' ? (
        <g stroke={color} fill="none" strokeWidth={sw} strokeLinecap="round">
          <line x1={cx - w * 0.14} y1={cy - h * 0.22} x2={cx - w * 0.14} y2={cy - h * 0.02} />
          <line x1={cx + w * 0.14} y1={cy - h * 0.22} x2={cx + w * 0.14} y2={cy - h * 0.02} />
          <circle cx={cx} cy={cy + h * 0.18} r={m * 0.06} fill={color} />
        </g>
      ) : (
        // gas — a flame
        <g stroke={color} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round">
          <path
            fill="none"
            d={`M ${cx} ${cy - m * 0.3} C ${cx + m * 0.24} ${cy - m * 0.02}, ${cx + m * 0.16} ${cy + m * 0.24}, ${cx} ${cy + m * 0.26} C ${cx - m * 0.16} ${cy + m * 0.24}, ${cx - m * 0.24} ${cy - m * 0.02}, ${cx} ${cy - m * 0.3} Z`}
          />
          <path
            fill={color}
            stroke="none"
            d={`M ${cx} ${cy + m * 0.02} C ${cx + m * 0.12} ${cy + m * 0.1}, ${cx + m * 0.08} ${cy + m * 0.22}, ${cx} ${cy + m * 0.24} C ${cx - m * 0.08} ${cy + m * 0.22}, ${cx - m * 0.12} ${cy + m * 0.1}, ${cx} ${cy + m * 0.02} Z`}
          />
        </g>
      )}
    </g>
  );
}

/**
 * Window / door glyph, drawn from (0,0) spanning w×h inches. Window = framed
 * glass with mullions; door = framed slab with two recessed panels and a knob.
 */
export function OpeningGlyph({ kind, w, h, clash }: { kind: OpeningKind; w: number; h: number; clash?: boolean }) {
  // Simple outdoor-style frame: a clean white frame around a single pane/slab.
  // When a cabinet clashes with the opening, render it red as a warning.
  const frame = clash ? '#d23b3b' : '#9aa1ad';
  const frameFill = clash ? '#fbe4e4' : '#f1efe9';
  const glass = clash ? 'rgba(210,59,59,0.28)' : 'rgba(168,205,228,0.45)';
  const slab = clash ? 'rgba(210,59,59,0.22)' : 'rgba(0,0,0,0.045)';
  const sw = Math.max(0.4, Math.min(w, h) * 0.03) * (clash ? 1.6 : 1);
  const inset = Math.max(1.2, Math.min(w, h) * 0.1); // frame thickness
  const gx = inset, gy = inset, gw = w - inset * 2, gh = h - inset * 2;
  if (kind === 'window') {
    return (
      <g>
        <rect x={0} y={0} width={w} height={h} rx={0.6} fill={frameFill} stroke={frame} strokeWidth={sw} />
        <rect x={gx} y={gy} width={gw} height={gh} fill={glass} stroke={frame} strokeWidth={sw * 0.6} />
      </g>
    );
  }
  // door — a simple slab in a frame with a knob
  return (
    <g>
      <rect x={0} y={0} width={w} height={h} rx={0.6} fill={frameFill} stroke={frame} strokeWidth={sw} />
      <rect x={gx} y={gy} width={gw} height={gh} rx={Math.min(1, w * 0.04)} fill={slab} stroke={frame} strokeWidth={sw * 0.6} />
      <circle cx={w - inset - Math.min(2.5, w * 0.12)} cy={h * 0.5} r={Math.max(0.6, w * 0.035)} fill={frame} />
    </g>
  );
}

export function fmtIn(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '');
  return `${str}″`;
}

/** Horizontal dimension line with end ticks and a centered label. */
export function DimH({ x1, x2, y, label, fs = 3.4 }: { x1: number; x2: number; y: number; label?: string; fs?: number }) {
  if (x2 - x1 < 0.01) return null;
  const text = label ?? fmtIn(x2 - x1);
  const cx = (x1 + x2) / 2;
  return (
    <g className="dim">
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="#9aa1ad" strokeWidth={0.25} />
      <line x1={x1} y1={y - 1.6} x2={x1} y2={y + 1.6} stroke="#9aa1ad" strokeWidth={0.25} />
      <line x1={x2} y1={y - 1.6} x2={x2} y2={y + 1.6} stroke="#9aa1ad" strokeWidth={0.25} />
      <text x={cx} y={y - 1} textAnchor="middle" fontSize={fs} fill="#5b6472" style={{ fontFamily: 'inherit' }}>
        {text}
      </text>
    </g>
  );
}

/** Vertical dimension line. */
export function DimV({ y1, y2, x, label, fs = 3.4 }: { y1: number; y2: number; x: number; label?: string; fs?: number }) {
  if (y2 - y1 < 0.01) return null;
  const text = label ?? fmtIn(y2 - y1);
  const cy = (y1 + y2) / 2;
  return (
    <g className="dim">
      <line x1={x} y1={y1} x2={x} y2={y2} stroke="#9aa1ad" strokeWidth={0.25} />
      <line x1={x - 1.6} y1={y1} x2={x + 1.6} y2={y1} stroke="#9aa1ad" strokeWidth={0.25} />
      <line x1={x - 1.6} y1={y2} x2={x + 1.6} y2={y2} stroke="#9aa1ad" strokeWidth={0.25} />
      <text x={x - 1} y={cy} textAnchor="middle" fontSize={fs} fill="#5b6472" transform={`rotate(-90 ${x - 1} ${cy})`} style={{ fontFamily: 'inherit' }}>
        {text}
      </text>
    </g>
  );
}
