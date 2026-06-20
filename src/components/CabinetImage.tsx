import { useMemo } from 'react';
import type { CatalogItem, FinishOption, PlacedItem } from '../model/types';
import { useStore } from '../state/store';
import { selectedApplianceHeight } from '../model/appliances';
import type { CabDims } from '../three/cabinet3d';
import { cabinetSprite, spriteEndExtents, spriteTopY } from '../three/sprite';
import { CabinetFront, CabinetIso } from './svg';

/**
 * Photoreal cabinet for the elevation view: a studio-lit render from the 3D
 * engine, mapped 1:1 onto elevation inches. Drawn inside the item group whose
 * origin is the carcass top-left. Falls back to the SVG drawing if WebGL is
 * unavailable.
 */
export function ElevationCabinet({ cat, it, fin, wallLength }: { cat: CatalogItem; it: PlacedItem; fin: FinishOption; wallLength: number }) {
  const style = useStore((s) => s.design.doorStyle);
  const counterT = useStore((s) => s.design.counterThickness);
  const appliances = useStore((s) => s.appliances);
  // a lazy susan keeps its corner orientation from placement; hinge only moves
  // the single handle, matching the 3D and plan views
  const cornerSide: 1 | -1 | undefined = cat.front === 'susan' ? (it.x + (it.w + (it.endL ? 0.75 : 0) + (it.endR ? 0.75 : 0)) / 2 > wallLength / 2 ? -1 : 1) : undefined;
  // fridge/ice-maker housings render the selected unit at its real height, so a
  // shorter unit shows a gap under the counter.
  const applianceH = cat.applianceCat ? selectedApplianceHeight(it.appliance, appliances) : undefined;
  const dims: CabDims = { w: it.w, d: it.d, h: it.h, hinge: it.hinge, style, endL: it.endL, endR: it.endR, cornerSide, applianceH, counterT };
  const url = useMemo(
    () => cabinetSprite(cat, dims, fin, 'front'),
    [cat, it.w, it.d, it.h, it.hinge, it.endL, it.endR, style, fin, cornerSide, applianceH, counterT]
  );
  if (!url) return <CabinetFront cat={cat} w={it.w} h={it.h} fin={fin} hinge={it.hinge} />;
  const top = spriteTopY(cat, it.h);
  const { exL, exR } = spriteEndExtents(cat, dims);
  const fpw = it.w + exL + exR;
  return (
    <g>
      {/* item.x is the footprint's left edge — applied ends included */}
      <image href={url} x={0} y={it.h - top} width={fpw} height={top} preserveAspectRatio="none" />
      {/* reliable hit area (sprite has transparent regions) */}
      <rect x={0} y={0} width={fpw} height={it.h} fill="transparent" />
    </g>
  );
}

/** Product-shot thumbnail for catalog cards, with SVG fallback. */
export function CatalogThumb({ cat, fin }: { cat: CatalogItem; fin: FinishOption }) {
  const style = useStore((s) => s.design.doorStyle);
  const url = useMemo(
    () => cabinetSprite(cat, { w: cat.w, d: cat.d, h: cat.h, hinge: 'left', style, endL: false, endR: false }, fin, 'iso'),
    [cat, fin, style]
  );
  if (url) return <img className="mini-preview" src={url} alt={cat.name} />;
  const ox = cat.d * 0.5;
  const oy = cat.d * 0.26;
  const above = (cat.topGearH ?? 0) + oy + 4;
  return (
    <svg viewBox={`-3 ${-above} ${cat.w + ox + 6} ${cat.h + above + 5}`} className="mini-preview">
      <CabinetIso cat={cat} fin={fin} />
    </svg>
  );
}
