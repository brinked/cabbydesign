// Design check: looks over a design for things a homeowner would want to know
// before asking for a quote — cabinets that don't fit, appliances too big for
// their cabinet, blocked windows, a grill with nowhere to put a plate down.
// Pure: everything it needs is passed in.
import type { ApplianceItem, Design, PlacedItem, Wall } from './types';
import { requiredCabinetWidth, selectedApplianceWidth } from './appliances';
import { bridgesCounter, catalogById } from './catalog';
import { footprintW, openingClash, roughInConflict } from '../state/store';

export type IssueLevel = 'problem' | 'warning' | 'tip';

export interface Issue {
  /** Stable within one check, for list keys. */
  id: string;
  level: IssueLevel;
  title: string;
  detail: string;
  /** Where to take the user when they click it. */
  wallId?: string;
  itemId?: string;
}

const LINER_CATS = ['grill', 'griddle', 'sideburner', 'powerburner'];
const COOKING_CATS = ['grill', 'griddle'];
const fmt = (n: number) => `${Math.round(n * 100) / 100}″`;

const isCooking = (it: PlacedItem) => {
  const c = catalogById(it.catalogId);
  return COOKING_CATS.includes(c.applianceCat ?? '') || c.front === 'cooktop' || c.front === 'range';
};

/** Floor-lane items of a wall, left to right. */
function floorRun(design: Design, wall: Wall): PlacedItem[] {
  return design.items.filter((it) => it.wallId === wall.id && catalogById(it.catalogId).lane === 'floor').sort((a, b) => a.x - b.x);
}

export function checkDesign(design: Design, appliances: ApplianceItem[], linerClearance: number): Issue[] {
  const out: Issue[] = [];
  const add = (level: IssueLevel, title: string, detail: string, where: { wallId?: string; itemId?: string } = {}) =>
    out.push({ id: `${out.length}`, level, title, detail, ...where });

  for (const wall of design.walls) {
    for (const lane of ['floor', 'upper'] as const) {
      const run = design.items.filter((it) => it.wallId === wall.id && catalogById(it.catalogId).lane === lane).sort((a, b) => a.x - b.x);
      let edge = -Infinity;
      let overlap: PlacedItem | null = null;
      for (const it of run) {
        if (it.x < edge - 0.01 && !overlap) overlap = it;
        edge = Math.max(edge, it.x + footprintW(it));
      }
      if (overlap) add('problem', `Cabinets overlap on ${wall.name}`, 'There are more cabinets here than the wall can hold. Remove or narrow one, or lengthen the wall.', { wallId: wall.id, itemId: overlap.id });
      else if (edge > wall.length + 0.01)
        add('problem', `Cabinets run past the end of ${wall.name}`, `They need ${fmt(edge)} but the wall is ${fmt(wall.length)} long. Remove or narrow one, or lengthen the wall.`, { wallId: wall.id, itemId: run[run.length - 1]?.id });
    }

    const run = floorRun(design, wall);
    for (let i = 0; i < run.length; i++) {
      const it = run[i];
      const cat = catalogById(it.catalogId);
      const where = { wallId: wall.id, itemId: it.id };
      const left = run[i - 1];
      const right = run[i + 1];
      const touches = (o: PlacedItem | undefined, side: 'l' | 'r') =>
        !!o && (side === 'l' ? it.x - (o.x + footprintW(o)) : o.x - (it.x + footprintW(it))) <= 1.5;

      // gap too small for a cabinet between two neighbours
      if (left && !left.auto && !it.auto) {
        const gap = it.x - (left.x + footprintW(left));
        if (gap > 1 && gap < 9) add('tip', `${fmt(gap)} gap on ${wall.name}`, 'Too narrow for a cabinet. Close it up, widen a neighbour, or add a filler strip.', where);
      }

      // appliance vs cabinet size
      if (cat.applianceCat && it.appliance?.mode === 'inventory' && it.appliance.applianceId) {
        const need = LINER_CATS.includes(cat.applianceCat)
          ? requiredCabinetWidth(it.appliance, appliances, cat.fixed ? 0 : linerClearance)
          : cat.applianceCat === 'fridge' || cat.applianceCat === 'icemaker'
            ? selectedApplianceWidth(it.appliance, appliances) ?? 0
            : 0;
        if (need > it.w + 0.01) add('problem', `${cat.name} is too narrow for its appliance`, `The appliance you chose needs ${fmt(need)}; this cabinet is ${fmt(it.w)} wide.`, where);
      } else if (COOKING_CATS.includes(cat.applianceCat ?? '') && !it.appliance && appliances.some((a) => a.category === cat.applianceCat && a.active !== false)) {
        add('tip', `Choose a ${cat.applianceCat} for the ${cat.name}`, 'Pick the model you want (or say you have your own) so the cabinet can be sized around it.', where);
      }

      if (isCooking(it)) {
        // somewhere to put a plate down
        const landing = (o: PlacedItem | undefined, side: 'l' | 'r') => {
          if (!o || !touches(o, side)) return false;
          const oc = catalogById(o.catalogId);
          return bridgesCounter(oc) && oc.category !== 'appliance' && !isCooking(o) && oc.front !== 'filler' && footprintW(o) >= 12;
        };
        if (!landing(left, 'l') && !landing(right, 'r'))
          add('tip', `No counter space beside the ${cat.name}`, 'A foot or more of countertop next to the grill gives you somewhere to set down plates and tools.', where);
        // heat next to refrigeration
        for (const [o, side] of [
          [left, 'l'],
          [right, 'r'],
        ] as const) {
          const oc = o && catalogById(o.catalogId);
          if (o && oc && touches(o, side) && (oc.applianceCat === 'fridge' || oc.applianceCat === 'icemaker'))
            add('warning', `${oc.name} is right next to the ${cat.name}`, 'Heat from the grill makes a refrigerator work harder. Put a cabinet between them if you can.', { wallId: wall.id, itemId: o.id });
        }
        // nothing but a hood above the grill
        const x1 = it.x;
        const x2 = it.x + footprintW(it);
        const above = design.items.find((o) => {
          if (o.wallId !== wall.id) return false;
          const oc = catalogById(o.catalogId);
          return oc.lane === 'upper' && oc.applianceCat !== 'hood' && o.x < x2 - 0.5 && o.x + footprintW(o) > x1 + 0.5;
        });
        if (above) add('warning', `Wall cabinet above the ${cat.name}`, 'A cabinet over a grill is a heat and fire risk. Move it aside or replace it with a vent hood.', { wallId: wall.id, itemId: above.id });
      }
    }
  }

  for (const o of design.openings) {
    if (openingClash(o, design.items, design.counterThickness)) {
      const wall = design.walls.find((w) => w.id === o.wallId);
      add('problem', `A ${o.kind === 'slider' ? 'sliding door' : o.kind} is blocked${wall ? ` on ${wall.name}` : ''}`, 'A cabinet sits in front of it. Move the cabinet or the opening.', { wallId: o.wallId });
    }
  }
  for (const r of design.roughIns) {
    if (roughInConflict(design, r)) {
      const wall = design.walls.find((w) => w.id === r.wallId);
      add('warning', `${r.kind[0].toUpperCase()}${r.kind.slice(1)} connection lands on a cabinet edge${wall ? ` on ${wall.name}` : ''}`, 'It needs to sit fully behind one cabinet, or in open space, so it can be reached.', { wallId: r.wallId });
    }
  }

  if (design.items.some(isCookingGas) && !design.gasType) add('tip', 'Natural gas or propane?', 'Tell us which fuel your grill will use, under Colors & style → Fuel.');

  const rank: Record<IssueLevel, number> = { problem: 0, warning: 1, tip: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

function isCookingGas(it: PlacedItem): boolean {
  return COOKING_CATS.includes(catalogById(it.catalogId).applianceCat ?? '');
}
