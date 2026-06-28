import { useEffect, useMemo, useState } from 'react';
import { BASE_H, CATALOG, CATEGORY_LABELS, COUNTER_T, catalogById, takesAppliedEnds } from '../model/catalog';
import { money, tryFormula } from '../model/pricing';
import {
  APPLIANCE_CATS,
  APPLIANCE_CAT_LABELS,
  applianceId,
  appliancesToCsv,
  LINER_CABINET_CLEARANCE,
  parseAppliancesCsv,
  requiredCabinetWidth,
  selectedApplianceWidth,
} from '../model/appliances';
import type { ApplianceItem, ApplianceSelection, CatalogItem, FrontKind, PlacedItem } from '../model/types';
import { effectiveDims, itemPrice, largestOpening, openingFor, roughInConflict, spaceLeft, useStore } from '../state/store';
import { api, ApiError, type DealerWithPrefs, type RestrictedBrands } from '../api/client';
import { useSession } from '../state/session';
import { CatalogThumb } from './CabinetImage';
import { useFinish } from './WallsView';
import { fmtIn } from './svg';

const HINGED_FRONTS: FrontKind[] = ['door1', 'doordrawer', 'burner', 'propane', 'blind', 'blindl', 'blindr', 'fridge', 'fridgep', 'corner', 'susan', 'sink1', 'sink1f'];

/** Cabinet appliance categories that house an insulated liner — these enforce
 *  the liner cutout-width + clearance rule (see LINER_CABINET_CLEARANCE). */
const LINER_RULE_CATS = ['grill', 'griddle', 'sideburner', 'powerburner'];
const usesLinerRule = (c?: string) => !!c && LINER_RULE_CATS.includes(c);

function Modal({ title, sub, onClose, children, wide }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {sub && <p className="modal-sub">{sub}</p>}
          </div>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MiniPreview({ cat }: { cat: CatalogItem }) {
  const fin = useFinish(useStore((s) => s.design.finishId));
  return <CatalogThumb cat={cat} fin={fin} />;
}

export function AddItemModal() {
  const wallId = useStore((s) => s.addToWallId);
  const openAdd = useStore((s) => s.openAdd);
  const addItem = useStore((s) => s.addItem);
  const design = useStore((s) => s.design);
  const dims = useStore((s) => s.dims);
  const [tab, setTab] = useState<string>('base');
  const [warn, setWarn] = useState<string | null>(null);

  if (!wallId) return null;
  const wall = design.walls.find((w) => w.id === wallId);
  if (!wall) return null;

  const cats = CATALOG.filter((c) => c.category === tab);
  const openFloor = largestOpening(design, wallId, 'floor').w;
  const openUpper = largestOpening(design, wallId, 'upper').w;

  return (
    <Modal
      title={`Add to ${wall.name}`}
      sub={`Largest opening — base: ${fmtIn(Math.max(0, openFloor))} · wall: ${fmtIn(Math.max(0, openUpper))}`}
      onClose={() => openAdd(null)}
      wide
    >
      <div className="cat-tabs">
        {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
          <button key={id} className={tab === id ? 'cat-tab active' : 'cat-tab'} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {warn && <div className="warn">{warn}</div>}
      <div className="cat-grid">
        {cats.map((c) => {
          const open = openingFor(design, wallId, c).w;
          const minW = effectiveDims(c.id, dims).minW;
          const fits = minW <= open + 0.001;
          return (
            <button
              key={c.id}
              className={`cat-card ${fits ? '' : 'cat-card-dim'}`}
              onClick={() => {
                if (addItem(wallId, c.id)) {
                  setWarn(null);
                  openAdd(null);
                } else {
                  setWarn(`Not enough space for a ${c.name} — needs at least ${fmtIn(minW)}, largest opening is ${fmtIn(Math.max(0, open))}.`);
                }
              }}
            >
              <MiniPreview cat={c} />
              <span className="cat-name">{c.name}</span>
              <span className="cat-size">
                {fmtIn(c.w)} W × {fmtIn(c.d)} D × {fmtIn(c.h)} H
              </span>
              {c.note && <span className="cat-note">{c.note}</span>}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/**
 * Arrows step by `step` (1″ for widths); the value can also be typed directly
 * and is rounded to the nearest 1/4″ and clamped to [min, max] on commit.
 */
function Stepper({
  label,
  value,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);
  // don't fight the user's typing — only sync from the prop when not editing
  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const v = parseFloat(text);
    if (Number.isNaN(v)) {
      setText(String(value));
      return;
    }
    const r = Math.min(max, Math.max(min, Math.round(v * 4) / 4));
    setText(String(r));
    if (r !== value) onChange(r);
  };

  // Apply as the user types (no Enter needed) once it's a complete in-range
  // number, so partial entries like "1" of "12" don't fire early.
  const live = (t: string) => {
    const v = parseFloat(t);
    if (!Number.isFinite(v) || v < min || v > max) return;
    const r = Math.round(v * 4) / 4;
    if (r !== value) onChange(r);
  };

  const bump = (dir: 1 | -1) => {
    const r = Math.min(max, Math.max(min, Math.round((value + dir * step) * 4) / 4));
    setText(String(r));
    if (r !== value) onChange(r);
  };

  return (
    <div className="stepper-row">
      <span className="stepper-label">{label}</span>
      <div className="stepper">
        <button onClick={() => bump(-1)} disabled={value - step < min - 0.001}>
          −
        </button>
        <input
          className="stepper-input"
          value={text}
          inputMode="decimal"
          onFocus={() => setEditing(true)}
          onChange={(e) => {
            setText(e.target.value);
            live(e.target.value);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            else if (e.key === 'ArrowUp') {
              e.preventDefault();
              bump(1);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              bump(-1);
            }
          }}
        />
        <button onClick={() => bump(1)} disabled={value + step > max + 0.001}>
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Appliance picker shown on appliance-housing cabinets (grills, fridges,
 * burners, kamado, griddle). Choose an inventory item, or declare the customer
 * is supplying their own. Grills surface their recommended insulated liner.
 */
function ApplianceSection({ it, cat }: { it: PlacedItem; cat: CatalogItem }) {
  const appliances = useStore((s) => s.appliances);
  const updateItem = useStore((s) => s.updateItem);
  const design = useStore((s) => s.design);
  const dimOverrides = useStore((s) => s.dims);
  const want = cat.applianceCat;

  const options = useMemo(
    () => appliances.filter((a) => a.category === want && a.active !== false),
    [appliances, want]
  );
  // Group by brand for the <optgroup>s.
  const byBrand = useMemo(() => {
    const m = new Map<string, ApplianceItem[]>();
    for (const a of options) (m.get(a.brand) ?? m.set(a.brand, []).get(a.brand)!).push(a);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [options]);

  const sel = it.appliance;
  const mode: 'none' | 'inventory' | 'own' = sel?.mode ?? 'none';
  const selected = sel?.mode === 'inventory' ? options.find((a) => a.id === sel.applianceId) : undefined;
  const liner = selected?.linerId ? appliances.find((a) => a.id === selected.linerId) : undefined;
  const reqW = usesLinerRule(want)
    ? requiredCabinetWidth(sel, appliances)
    : want === 'fridge' || want === 'icemaker'
      ? selectedApplianceWidth(sel, appliances) ?? 0
      : 0;

  // A fridge/ice maker just needs an opening sized to fit it — so when a model
  // is picked, auto-size the opening's width, depth AND height to the unit's
  // dimensions. The countertop is always drawn at counter height (BASE_H), so a
  // unit shorter than the counter shows the gap underneath automatically. Width
  // is clamped to the free space on the wall.
  const fitDims = (next: ApplianceSelection | undefined): Partial<PlacedItem> => {
    if (want !== 'fridge' && want !== 'icemaker') return {};
    if (!next || next.mode !== 'inventory' || !next.applianceId) return {};
    const item = appliances.find((a) => a.id === next.applianceId);
    if (!item) return {};
    const dr = effectiveDims(it.catalogId, dimOverrides);
    const patch: Partial<PlacedItem> = {};
    if (item.cutoutW && item.cutoutW > 0) {
      const available = it.w + spaceLeft(design, it.wallId, cat.lane);
      const w = Math.round(Math.min(item.cutoutW, available, dr.maxW) * 100) / 100;
      if (w !== it.w) patch.w = w;
    }
    if (item.cutoutD && item.cutoutD > 0) {
      const d = Math.round(Math.min(Math.max(item.cutoutD, dr.minD), dr.maxD) * 100) / 100;
      if (d !== it.d) patch.d = d;
    }
    if (item.cutoutH && item.cutoutH > 0) {
      const minH = cat.minH ?? 12;
      const maxH = cat.maxH ?? 96;
      const h = Math.round(Math.min(Math.max(item.cutoutH, minH), maxH) * 100) / 100;
      if (h !== it.h) patch.h = h;
    }
    return patch;
  };

  const set = (next: ApplianceSelection | undefined) => updateItem(it.id, { appliance: next, ...fitDims(next) });

  return (
    <div className="appliance-section">
      <div className="stepper-row">
        <span className="stepper-label">
          {APPLIANCE_CAT_LABELS[want!]}
          <span className="stepper-note">shown on the report</span>
        </span>
        <div className="seg">
          <button className={mode === 'inventory' ? 'seg-btn active' : 'seg-btn'} onClick={() => set({ mode: 'inventory', withLiner: true })}>
            From inventory
          </button>
          <button className={mode === 'own' ? 'seg-btn active' : 'seg-btn'} onClick={() => set({ mode: 'own', ownText: sel?.ownText ?? '' })}>
            Customer's own
          </button>
          <button className={mode === 'none' ? 'seg-btn active' : 'seg-btn'} onClick={() => set(undefined)}>
            None
          </button>
        </div>
      </div>

      {mode === 'inventory' && (
        <>
          <select
            className="select appliance-select"
            value={sel?.applianceId ?? ''}
            onChange={(e) => set({ ...sel!, mode: 'inventory', applianceId: e.target.value || undefined })}
          >
            <option value="">— Select {APPLIANCE_CAT_LABELS[want!].toLowerCase()} —</option>
            {byBrand.map(([brand, items]) => (
              <optgroup key={brand} label={brand}>
                {items.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.model}
                    {a.name ? ` — ${a.name}` : ''} ({money(a.msrp)})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {options.length === 0 && (
            <p className="card-sub" style={{ marginTop: 6 }}>
              No {APPLIANCE_CAT_LABELS[want!].toLowerCase()} models in inventory yet. An admin can add them under Appliances.
            </p>
          )}
          {selected && liner && (
            <div className="seg appliance-liner" style={{ marginTop: 8 }}>
              <button
                className={sel?.withLiner !== false ? 'seg-btn active' : 'seg-btn'}
                onClick={() => set({ ...sel!, withLiner: true })}
                title={`${liner.brand} ${liner.model} — ${money(liner.msrp)}`}
              >
                + Insulated liner (recommended)
              </button>
              <button className={sel?.withLiner === false ? 'seg-btn active' : 'seg-btn'} onClick={() => set({ ...sel!, withLiner: false })}>
                Without liner
              </button>
            </div>
          )}
          {selected && (
            <div className="price-line" style={{ marginTop: 6 }}>
              {selected.brand} {selected.model}: <b>{money(selected.msrp)}</b>
              {sel?.withLiner !== false && liner && (
                <span className="price-sub">
                  {' '}
                  + liner {liner.model} {money(liner.msrp)}
                </span>
              )}
              {selected.panelCharge ? <span className="price-sub"> + panel {money(selected.panelCharge)}</span> : null}
              {liner?.cutoutW ? <span className="price-sub"> · liner cutout {fmtIn(liner.cutoutW)} W</span> : null}
              {(want === 'fridge' || want === 'icemaker') && it.h < BASE_H - 0.01 ? (
                <span className="price-sub"> · {fmtIn(BASE_H - it.h)} gap under counter</span>
              ) : null}
            </div>
          )}
          {reqW > 0 &&
            it.w + 0.01 < reqW &&
            (usesLinerRule(want) ? (
              <div className="warn" style={{ marginTop: 8 }}>
                ⚠ This {APPLIANCE_CAT_LABELS[want!].toLowerCase()} needs a cabinet at least {fmtIn(reqW)} wide
                {liner?.cutoutW ? ` (liner cutout ${fmtIn(liner.cutoutW)} + ${LINER_CABINET_CLEARANCE}″ clearance)` : ''}. Widen the cabinet above to fit it.
              </div>
            ) : (
              <div className="warn" style={{ marginTop: 8 }}>
                ⚠ Not enough room on this wall — the {APPLIANCE_CAT_LABELS[want!].toLowerCase()} is {fmtIn(reqW)} wide but only {fmtIn(it.w)} of
                open space is available here. Free up space (shorten or remove a neighbouring cabinet) so it fits.
              </div>
            ))}
        </>
      )}

      {mode === 'own' && (
        <input
          className="appliance-own-input"
          placeholder="Describe the appliance the customer will use"
          value={sel?.ownText ?? ''}
          onChange={(e) => set({ mode: 'own', ownText: e.target.value })}
        />
      )}
    </div>
  );
}

export function EditItemModal() {
  const editingId = useStore((s) => s.editingId);
  const design = useStore((s) => s.design);
  const openEditor = useStore((s) => s.openEditor);
  const updateItem = useStore((s) => s.updateItem);
  const removeItem = useStore((s) => s.removeItem);
  const duplicateItem = useStore((s) => s.duplicateItem);
  const pricing = useStore((s) => s.pricing);
  const dims = useStore((s) => s.dims);
  const appliances = useStore((s) => s.appliances);

  if (!editingId) return null;
  const it = design.items.find((i) => i.id === editingId);
  if (!it) return null;
  const cat = catalogById(it.catalogId);
  const wall = design.walls.find((w) => w.id === it.wallId);
  if (!wall) return null;

  const left = spaceLeft(design, it.wallId, cat.lane);
  const dimRange = effectiveDims(it.catalogId, dims);
  const maxW = Math.min(dimRange.maxW, it.w + left);
  // A grill/griddle/burner's insulated liner needs cabinet width ≥ liner cutout
  // + clearance; a fridge/ice maker needs a cabinet at least as wide as the unit.
  const appMinW = usesLinerRule(cat.applianceCat)
    ? requiredCabinetWidth(it.appliance, appliances)
    : cat.applianceCat === 'fridge' || cat.applianceCat === 'icemaker'
      ? selectedApplianceWidth(it.appliance, appliances) ?? 0
      : 0;
  const minW = Math.max(dimRange.minW, Math.min(appMinW, maxW));
  const price = itemPrice(design, it, pricing);
  const island = wall.ghost;
  const maxTrays = cat.maxTrays ?? 0;

  return (
    <Modal title={`${fmtIn(it.w)} ${cat.name}`} sub={`Space left: ${fmtIn(Math.max(0, left))}`} onClose={() => openEditor(null)}>
      {cat.note && <div className="edit-note">{cat.note}</div>}
      <div className="stepper-list">
        <Stepper label="Width" value={it.w} step={1} min={minW} max={maxW} onChange={(w) => updateItem(it.id, { w })} />
        <Stepper label="Depth" value={it.d} step={1} min={dimRange.minD} max={dimRange.maxD} onChange={(d) => updateItem(it.id, { d })} />
        <Stepper label="Height" value={it.h} step={1} min={cat.minH ?? 12} max={cat.maxH ?? 96} onChange={(h) => updateItem(it.id, { h })} />
        {cat.front === 'filler' ? (
          <div className="stepper-row">
            <span className="stepper-label">
              Outset of wall
              <span className="stepper-note">auto — flush with neighbor</span>
            </span>
            <span className="stepper">{fmtIn(it.outset)}</span>
          </div>
        ) : cat.lane === 'floor' ? (
          <Stepper label="Outset of wall" value={it.outset} step={1} min={0} max={24} onChange={(outset) => updateItem(it.id, { outset })} />
        ) : (
          <Stepper label="Height off floor" value={it.mount} step={3} min={30} max={84} onChange={(mount) => updateItem(it.id, { mount })} />
        )}
        {maxTrays > 0 && (
          <Stepper label="Pull-out trays" value={it.trays} step={1} min={0} max={maxTrays} onChange={(trays) => updateItem(it.id, { trays })} />
        )}
        {takesAppliedEnds(cat) && (
          <div className="stepper-row">
            <span className="stepper-label">
              Applied ends
              <span className="stepper-note">+0.75″ width each</span>
            </span>
            <div className="seg">
              <button
                className={it.endL ? 'seg-btn active' : 'seg-btn'}
                title="Applied end panel on the left side (+0.75″ width)"
                onClick={() => updateItem(it.id, { endL: !it.endL })}
              >
                Left
              </button>
              <button
                className={it.endR ? 'seg-btn active' : 'seg-btn'}
                title="Applied end panel on the right side (+0.75″ width)"
                onClick={() => updateItem(it.id, { endR: !it.endR })}
              >
                Right
              </button>
            </div>
          </div>
        )}
        {cat.counter && cat.lane === 'floor' && (
          <div className="stepper-row">
            <span className="stepper-label">
              Waterfall edge
              <span className="stepper-note">counter wraps to the floor (run ends)</span>
            </span>
            <div className="seg">
              <button
                className={it.waterfallL ? 'seg-btn active' : 'seg-btn'}
                title="Waterfall countertop down the left side"
                onClick={() => updateItem(it.id, { waterfallL: !it.waterfallL })}
              >
                Left
              </button>
              <button
                className={it.waterfallR ? 'seg-btn active' : 'seg-btn'}
                title="Waterfall countertop down the right side"
                onClick={() => updateItem(it.id, { waterfallR: !it.waterfallR })}
              >
                Right
              </button>
            </div>
          </div>
        )}
        {HINGED_FRONTS.includes(cat.front) && (
          <div className="stepper-row">
            <span className="stepper-label">{cat.front === 'blind' ? 'Door side' : 'Hinge side'}</span>
            <div className="seg">
              <button
                className={it.hinge === 'left' ? 'seg-btn active' : 'seg-btn'}
                onClick={() => updateItem(it.id, { hinge: 'left' })}
              >
                {cat.front === 'blind' ? 'Door left' : 'Left'}
              </button>
              <button
                className={it.hinge === 'right' ? 'seg-btn active' : 'seg-btn'}
                onClick={() => updateItem(it.id, { hinge: 'right' })}
              >
                {cat.front === 'blind' ? 'Door right' : 'Right'}
              </button>
            </div>
          </div>
        )}
      </div>
      {cat.applianceCat && <ApplianceSection it={it} cat={cat} />}
      {island && cat.category !== 'appliance' && (
        <div className="price-line" style={{ marginTop: 4 }}>
          On island — finished back panel applied automatically.
        </div>
      )}
      {cat.category !== 'appliance' && (
        <div className="price-line">
          Unit price: <b>{price.error ? '—' : money(price.total)}</b>
          {!price.error && (
            <span className="price-sub">
              {' '}
              ({cat.perInch ? `${money(cat.perInch)}/in` : `box ${money(price.cabinet)}`}
              {price.trays > 0 ? ` + trays ${money(price.trays)}` : ''}
              {price.ends > 0 ? ` + ends ${money(price.ends)}` : ''}
              {price.back > 0 ? ` + back ${money(price.back)}` : ''})
            </span>
          )}
          {price.error && <span className="warn-inline"> formula error: {price.error}</span>}
        </div>
      )}
      <div className="modal-actions">
        <button className="btn-danger" onClick={() => removeItem(it.id)}>
          Remove
        </button>
        <button className="btn-ghost" onClick={() => duplicateItem(it.id)} disabled={left < it.w}>
          Duplicate
        </button>
        <button className="btn-primary" onClick={() => openEditor(null)}>
          Save
        </button>
      </div>
    </Modal>
  );
}

/** Horizontal position rows — both the from-left and from-right distances are
 *  directly editable (editing one updates the other). */
function PositionFields({ x, wallLen, onChange }: { x: number; wallLen: number; onChange: (x: number) => void }) {
  const fromRight = Math.round(Math.max(0, wallLen - x) * 100) / 100;
  return (
    <>
      <Stepper label="Center from left" value={x} step={1} min={0} max={wallLen} onChange={onChange} />
      <Stepper label="Center from right" value={fromRight} step={1} min={0} max={wallLen} onChange={(v) => onChange(Math.max(0, Math.min(wallLen, wallLen - v)))} />
    </>
  );
}

export function RoughInModal() {
  const id = useStore((s) => s.editingRoughInId);
  const design = useStore((s) => s.design);
  const updateRoughIn = useStore((s) => s.updateRoughIn);
  const removeRoughIn = useStore((s) => s.removeRoughIn);
  const openRoughIn = useStore((s) => s.openRoughIn);
  const r = design.roughIns.find((x) => x.id === id);
  if (!r) return null;
  const wall = design.walls.find((w) => w.id === r.wallId);
  const wallLen = wall?.length ?? 120;
  const wallH = wall?.height ?? 96;
  const conflict = roughInConflict(design, r);
  const set = (patch: Partial<typeof r>) => updateRoughIn(r.id, patch);
  return (
    <Modal
      title={r.kind === 'plumbing' ? 'Plumbing Stub-Out' : r.kind === 'gas' ? 'Gas Stub-Out' : 'Electrical Outlet'}
      sub={`On ${wall?.name ?? 'wall'}`}
      onClose={() => openRoughIn(null)}
    >
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={r.kind === 'plumbing' ? 'seg-btn active' : 'seg-btn'} onClick={() => set({ kind: 'plumbing' })}>
          Plumbing
        </button>
        <button className={r.kind === 'electrical' ? 'seg-btn active' : 'seg-btn'} onClick={() => set({ kind: 'electrical' })}>
          Electrical
        </button>
        <button className={r.kind === 'gas' ? 'seg-btn active' : 'seg-btn'} onClick={() => set({ kind: 'gas' })}>
          Gas
        </button>
      </div>
      {conflict && (
        <div className="warn">
          ⚠ Conflict — this stub-out must sit fully behind one cabinet and clear each cabinet end by at least 1″ (2″ where
          there’s an applied end panel). Move it so its full width fits inside a cabinet with that clearance. Tip: you can
          drag it directly on the wall elevation.
        </div>
      )}
      <div className="stepper-list">
        <Stepper label="Width" value={r.w} step={1} min={1} max={Math.max(1, wallLen)} onChange={(w) => set({ w })} />
        <Stepper label="Height" value={r.h} step={1} min={1} max={Math.max(1, wallH)} onChange={(h) => set({ h })} />
        <PositionFields x={r.x} wallLen={wallLen} onChange={(x) => set({ x })} />
        <Stepper label="Height from floor" value={r.y} step={1} min={0} max={wallH} onChange={(y) => set({ y })} />
      </div>
      <div className="modal-actions">
        <button className="btn-danger" onClick={() => removeRoughIn(r.id)}>
          Remove
        </button>
        <button className="btn-primary" onClick={() => openRoughIn(null)}>
          Save
        </button>
      </div>
    </Modal>
  );
}

export function OpeningModal() {
  const id = useStore((s) => s.editingOpeningId);
  const design = useStore((s) => s.design);
  const updateOpening = useStore((s) => s.updateOpening);
  const removeOpening = useStore((s) => s.removeOpening);
  const openOpening = useStore((s) => s.openOpening);
  const o = design.openings.find((x) => x.id === id);
  if (!o) return null;
  const wall = design.walls.find((w) => w.id === o.wallId);
  const wallLen = wall?.length ?? 120;
  const wallH = wall?.height ?? 96;
  const set = (patch: Partial<typeof o>) => updateOpening(o.id, patch);
  return (
    <Modal title={o.kind === 'window' ? 'Window' : 'Door'} sub={`On ${wall?.name ?? 'wall'} · drag to position on the elevation`} onClose={() => openOpening(null)}>
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={o.kind === 'window' ? 'seg-btn active' : 'seg-btn'} onClick={() => set({ kind: 'window' })}>
          Window
        </button>
        <button className={o.kind === 'door' ? 'seg-btn active' : 'seg-btn'} onClick={() => set({ kind: 'door', y: 0 })}>
          Door
        </button>
      </div>
      <div className="stepper-list">
        <Stepper label="Width" value={o.w} step={1} min={6} max={Math.max(6, wallLen)} onChange={(w) => set({ w })} />
        <Stepper label="Height" value={o.h} step={1} min={6} max={Math.max(6, wallH)} onChange={(h) => set({ h })} />
        <PositionFields x={o.x} wallLen={wallLen} onChange={(x) => set({ x })} />
        <Stepper label="Sill height (from floor)" value={o.y} step={1} min={0} max={Math.max(0, wallH - o.h)} onChange={(y) => set({ y })} />
      </div>
      <div className="modal-actions">
        <button className="btn-danger" onClick={() => removeOpening(o.id)}>
          Remove
        </button>
        <button className="btn-primary" onClick={() => openOpening(null)}>
          Save
        </button>
      </div>
    </Modal>
  );
}

/** Footer that pushes the current admin globals to the server for all dealers. */
function SaveGlobalFooter({ onSave }: { onSave: () => Promise<void> }) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="modal-actions" style={{ alignItems: 'center' }}>
      {error && <span className="warn-inline">{error}</span>}
      {state === 'saved' && <span className="ok-inline">Saved for all dealers.</span>}
      <button
        className="btn-primary"
        disabled={state === 'saving'}
        onClick={async () => {
          setError(null);
          setState('saving');
          try {
            await onSave();
            setState('saved');
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not save.');
            setState('idle');
          }
        }}
      >
        {state === 'saving' ? 'Saving…' : 'Save for all dealers'}
      </button>
    </div>
  );
}

export function PricingModal() {
  const open = useStore((s) => s.pricingOpen);
  const setOpen = useStore((s) => s.setPricingOpen);
  const pricing = useStore((s) => s.pricing);
  const setFormula = useStore((s) => s.setFormula);

  const rows = useMemo(() => CATALOG.filter((c) => c.category !== 'appliance' && !c.perInch), []);

  if (!open) return null;
  return (
    <Modal
      title="Base pricing formulas"
      sub="Box price = formula (the dealer's cost). Variables: W, D, H in inches (default W*D + 500). Drawers, trays, panels & add-ons price on top automatically. Dealers mark these up with their own margin."
      onClose={() => setOpen(false)}
      wide
    >
      <div className="pricing-table">
        <div className="pricing-row pricing-head">
          <span>Cabinet</span>
          <span>Formula</span>
          <span>@ default size</span>
          <span></span>
        </div>
        {rows.map((c) => {
          const formula = pricing[c.id] ?? c.formula;
          const { price, error } = tryFormula(formula, { W: c.w, D: c.d, H: c.h });
          const overridden = pricing[c.id] !== undefined && pricing[c.id] !== c.formula;
          return (
            <div className="pricing-row" key={c.id}>
              <span className="pricing-name">{c.name}</span>
              <span>
                <input
                  className={error ? 'formula-input formula-bad' : 'formula-input'}
                  value={formula}
                  onChange={(e) => setFormula(c.id, e.target.value)}
                  spellCheck={false}
                />
                {error && <div className="warn-inline">{error}</div>}
              </span>
              <span className="pricing-sample">{error ? '—' : money(price)}</span>
              <span>
                {overridden && (
                  <button className="btn-ghost" title="Reset to default" onClick={() => setFormula(c.id, null)}>
                    ↺
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <SaveGlobalFooter onSave={() => api.setPricing(useStore.getState().pricing).then(() => undefined)} />
    </Modal>
  );
}

/** Retail price formulas — the basis for contractor "% off retail" accounts. */
export function RetailPricingModal() {
  const open = useStore((s) => s.retailPricingOpen);
  const setOpen = useStore((s) => s.setRetailPricingOpen);
  const retailPricing = useStore((s) => s.retailPricing);
  const setRetailFormula = useStore((s) => s.setRetailFormula);

  const rows = useMemo(() => CATALOG.filter((c) => c.category !== 'appliance' && !c.perInch), []);

  if (!open) return null;
  return (
    <Modal
      title="Retail pricing formulas"
      sub="The retail (list) price per cabinet. Contractors on '% off retail' pay this minus their discount. Variables: W, D, H in inches. Blank = falls back to the base price formula."
      onClose={() => setOpen(false)}
      wide
    >
      <div className="pricing-table">
        <div className="pricing-row pricing-head">
          <span>Cabinet</span>
          <span>Retail formula</span>
          <span>@ default size</span>
          <span></span>
        </div>
        {rows.map((c) => {
          const set = retailPricing[c.id] !== undefined;
          const formula = retailPricing[c.id] ?? c.formula;
          const { price, error } = tryFormula(formula, { W: c.w, D: c.d, H: c.h });
          return (
            <div className="pricing-row" key={c.id}>
              <span className="pricing-name">{c.name}</span>
              <span>
                <input
                  className={error ? 'formula-input formula-bad' : 'formula-input'}
                  value={retailPricing[c.id] ?? ''}
                  placeholder={c.formula}
                  onChange={(e) => setRetailFormula(c.id, e.target.value)}
                  spellCheck={false}
                />
                {error && <div className="warn-inline">{error}</div>}
              </span>
              <span className="pricing-sample">{error ? '—' : money(price)}</span>
              <span>
                {set && (
                  <button className="btn-ghost" title="Clear (use base price)" onClick={() => setRetailFormula(c.id, null)}>
                    ↺
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <SaveGlobalFooter onSave={() => api.setRetailPricing(useStore.getState().retailPricing).then(() => undefined)} />
    </Modal>
  );
}

function DimCell({
  value,
  placeholder,
  onCommit,
}: {
  value: number | undefined;
  placeholder: number;
  onCommit: (v: number | undefined) => void;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  useEffect(() => setText(value === undefined ? '' : String(value)), [value]);
  return (
    <input
      className="dim-input"
      value={text}
      placeholder={String(placeholder)}
      inputMode="decimal"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const t = text.trim();
        if (t === '') return onCommit(undefined);
        const v = parseFloat(t);
        onCommit(Number.isNaN(v) ? undefined : Math.round(v * 4) / 4);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const dims = useStore((s) => s.dims);
  const setDim = useStore((s) => s.setDim);

  const rows = useMemo(() => CATALOG.filter((c) => c.category !== 'appliance'), []);

  if (!open) return null;
  return (
    <Modal
      title="Cabinet size limits"
      sub="Global min/max width &amp; depth for each cabinet — applies to every dealer. Blank = use the catalog default (shown as the placeholder)."
      onClose={() => setOpen(false)}
      wide
    >
      <div className="settings-table">
        <div className="settings-row settings-head">
          <span>Cabinet</span>
          <span>Min W</span>
          <span>Max W</span>
          <span>Min D</span>
          <span>Max D</span>
        </div>
        {rows.map((c) => {
          const o = dims[c.id] ?? {};
          return (
            <div className="settings-row" key={c.id}>
              <span className="pricing-name">{c.name}</span>
              <DimCell value={o.minW} placeholder={c.minW} onCommit={(minW) => setDim(c.id, { minW })} />
              <DimCell value={o.maxW} placeholder={c.maxW} onCommit={(maxW) => setDim(c.id, { maxW })} />
              <DimCell value={o.minD} placeholder={c.minD ?? 12} onCommit={(minD) => setDim(c.id, { minD })} />
              <DimCell value={o.maxD} placeholder={c.maxD ?? 36} onCommit={(maxD) => setDim(c.id, { maxD })} />
            </div>
          );
        })}
      </div>
      <SaveGlobalFooter onSave={() => api.setCabinetDims(useStore.getState().dims).then(() => undefined)} />
    </Modal>
  );
}

/** One editable inventory row. Local text mirrors commit on blur. */
function ApplianceRow({
  a,
  liners,
  onChange,
  onRemove,
}: {
  a: ApplianceItem;
  liners: ApplianceItem[];
  onChange: (patch: Partial<ApplianceItem>) => void;
  onRemove: () => void;
}) {
  const [brand, setBrand] = useState(a.brand);
  const [model, setModel] = useState(a.model);
  const [name, setName] = useState(a.name);
  const [msrp, setMsrp] = useState(String(a.msrp));
  const numStr = (n?: number) => (n === undefined ? '' : String(n));
  const [cw, setCw] = useState(numStr(a.cutoutW));
  const [cd, setCd] = useState(numStr(a.cutoutD));
  const [ch, setCh] = useState(numStr(a.cutoutH));
  const [panel, setPanel] = useState(numStr(a.panelCharge));
  useEffect(() => setBrand(a.brand), [a.brand]);
  useEffect(() => setModel(a.model), [a.model]);
  useEffect(() => setName(a.name), [a.name]);
  useEffect(() => setMsrp(String(a.msrp)), [a.msrp]);
  useEffect(() => setCw(numStr(a.cutoutW)), [a.cutoutW]);
  useEffect(() => setCd(numStr(a.cutoutD)), [a.cutoutD]);
  useEffect(() => setCh(numStr(a.cutoutH)), [a.cutoutH]);
  useEffect(() => setPanel(numStr(a.panelCharge)), [a.panelCharge]);

  // Commit a numeric field: blank → cleared, otherwise a non-negative number.
  const commitNum = (key: 'cutoutW' | 'cutoutD' | 'cutoutH' | 'panelCharge', text: string) => {
    const t = text.replace(/[$,]/g, '').trim();
    if (t === '') return onChange({ [key]: undefined });
    const v = parseFloat(t);
    onChange({ [key]: Number.isFinite(v) && v >= 0 ? v : undefined });
  };
  // liners use a cutout opening; fridges/ice makers carry their own W×D×H.
  const sized = a.category === 'liner' || a.category === 'fridge' || a.category === 'icemaker';
  const panelReadyCat = a.category === 'fridge' || a.category === 'icemaker';

  return (
    <div className="appliance-row">
      <select className="select" value={a.category} onChange={(e) => onChange({ category: e.target.value as ApplianceItem['category'] })}>
        {APPLIANCE_CATS.map((c) => (
          <option key={c} value={c}>
            {APPLIANCE_CAT_LABELS[c]}
          </option>
        ))}
      </select>
      <input className="dim-input" value={brand} placeholder="Brand" onChange={(e) => setBrand(e.target.value)} onBlur={() => onChange({ brand: brand.trim() })} />
      <input className="dim-input" value={model} placeholder="Model #" onChange={(e) => setModel(e.target.value)} onBlur={() => onChange({ model: model.trim() })} />
      <input className="dim-input" value={name} placeholder="Description" onChange={(e) => setName(e.target.value)} onBlur={() => onChange({ name: name.trim() })} />
      <input
        className="dim-input"
        value={msrp}
        inputMode="decimal"
        placeholder="MSRP"
        onChange={(e) => setMsrp(e.target.value)}
        onBlur={() => {
          const v = parseFloat(msrp.replace(/[$,]/g, ''));
          onChange({ msrp: Number.isFinite(v) && v >= 0 ? v : 0 });
        }}
      />
      {sized ? (
        <div className="cutout-cell" title={a.category === 'liner' ? 'Insulated-liner cutout opening (inches). Width drives the 3″ grill-cabinet rule.' : 'Appliance size (inches). Height drives the gap shown under the counter.'}>
          <input className="dim-input cutout-in" value={cw} inputMode="decimal" placeholder="W" onChange={(e) => setCw(e.target.value)} onBlur={() => commitNum('cutoutW', cw)} />
          <span className="cutout-x">×</span>
          <input className="dim-input cutout-in" value={cd} inputMode="decimal" placeholder="D" onChange={(e) => setCd(e.target.value)} onBlur={() => commitNum('cutoutD', cd)} />
          <span className="cutout-x">×</span>
          <input className="dim-input cutout-in" value={ch} inputMode="decimal" placeholder="H" onChange={(e) => setCh(e.target.value)} onBlur={() => commitNum('cutoutH', ch)} />
        </div>
      ) : (
        <select className="select" value={a.linerId ?? ''} onChange={(e) => onChange({ linerId: e.target.value || undefined })}>
          <option value="">— no liner —</option>
          {liners.map((l) => (
            <option key={l.id} value={l.id}>
              {l.brand} {l.model}
              {l.cutoutW ? ` (${l.cutoutW}″ cut)` : ''}
            </option>
          ))}
        </select>
      )}
      {panelReadyCat ? (
        <input
          className="dim-input"
          value={panel}
          inputMode="decimal"
          placeholder="Panel $"
          title="Panel-ready: charge for the custom cabinet-matched door panel(s). Leave blank for stainless."
          onChange={(e) => setPanel(e.target.value)}
          onBlur={() => commitNum('panelCharge', panel)}
        />
      ) : (
        <span className="appliance-pad" />
      )}
      <button className="btn-danger-ghost" title="Remove" onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}

/** Per-brand "visible to these accounts" picker. Empty = visible to everyone. */
function BrandVisibility({
  accounts,
  value,
  onChange,
}: {
  accounts: DealerWithPrefs[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const sel = new Set(value);
  const toggle = (id: number) => {
    const n = new Set(sel);
    n.has(id) ? n.delete(id) : n.add(id);
    onChange([...n]);
  };
  const summary = value.length === 0 ? 'Everyone' : `${value.length} customer${value.length > 1 ? 's' : ''}`;
  return (
    <details className="brand-vis">
      <summary>
        Visible to: <b>{summary}</b>
      </summary>
      <div className="brand-vis-list">
        {accounts.length === 0 && <span className="card-sub">No customer accounts yet.</span>}
        {accounts.map((a) => (
          <label key={a.id} className="brand-vis-row">
            <input type="checkbox" checked={sel.has(a.id)} onChange={() => toggle(a.id)} />
            <span>
              {a.name}
              {a.companyName ? ` — ${a.companyName}` : ''}
              {a.role === 'contractor' ? ' (contractor)' : ''}
            </span>
          </label>
        ))}
        {value.length > 0 && (
          <button className="link-btn" onClick={() => onChange([])}>
            Reset to everyone
          </button>
        )}
      </div>
    </details>
  );
}

export function AppliancesModal() {
  const open = useStore((s) => s.appliancesOpen);
  const setOpen = useStore((s) => s.setAppliancesOpen);
  const appliances = useStore((s) => s.appliances);
  const brands = useStore((s) => s.applianceBrands);
  const setAppliances = useStore((s) => s.setAppliances);
  const setApplianceBrands = useStore((s) => s.setApplianceBrands);
  const [csvMsg, setCsvMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [accounts, setAccounts] = useState<DealerWithPrefs[]>([]);
  const [restricted, setRestricted] = useState<RestrictedBrands>({});

  // Load the account list + current brand visibility when the modal opens.
  useEffect(() => {
    if (!open) return;
    api.listDealers().then(({ dealers }) => setAccounts(dealers.filter((d) => d.role !== 'admin'))).catch(() => undefined);
    api.getRestrictedBrands().then(({ restrictedBrands }) => setRestricted(restrictedBrands)).catch(() => undefined);
  }, [open]);

  const setBrandVisibility = (brand: string, ids: number[]) =>
    setRestricted((r) => {
      const n = { ...r };
      if (ids.length) n[brand] = ids;
      else delete n[brand];
      return n;
    });

  // Brands shown = those with a discount set plus every brand used in inventory.
  const brandNames = useMemo(() => {
    const s = new Set<string>(Object.keys(brands));
    for (const a of appliances) if (a.brand) s.add(a.brand);
    return [...s].sort((x, y) => x.localeCompare(y));
  }, [brands, appliances]);
  const liners = useMemo(() => appliances.filter((a) => a.category === 'liner'), [appliances]);

  if (!open) return null;

  const updateAppliance = (id: string, patch: Partial<ApplianceItem>) => {
    let next = appliances.map((a) => (a.id === id ? { ...a, ...patch } : a));
    // Keep ids in sync if brand/model changed and the new id is free.
    if (patch.brand !== undefined || patch.model !== undefined) {
      const a = next.find((x) => x.id === id)!;
      const newId = applianceId(a.brand, a.model);
      if (newId && newId !== id && !next.some((x) => x.id === newId)) {
        next = next.map((x) => (x.id === id ? { ...x, id: newId } : x.linerId === id ? { ...x, linerId: newId } : x));
      }
    }
    setAppliances(next);
  };

  const addRow = () =>
    setAppliances([
      ...appliances,
      { id: `new-${appliances.length + 1}-${Math.max(1, Math.round(Date.now() % 1e6))}`, category: 'grill', brand: '', model: '', name: '', msrp: 0, active: true },
    ]);

  const removeRow = (id: string) =>
    setAppliances(appliances.filter((a) => a.id !== id).map((a) => (a.linerId === id ? { ...a, linerId: undefined } : a)));

  const setBrandPct = (brand: string, pct: number | undefined) => {
    const next = { ...brands };
    if (pct === undefined || Number.isNaN(pct)) delete next[brand];
    else next[brand] = { discountPct: pct };
    setApplianceBrands(next);
  };

  const importCsv = (text: string) => {
    const { items, errors } = parseAppliancesCsv(text);
    if (items.length === 0) {
      setCsvMsg({ ok: false, text: errors[0] ?? 'No rows found in the file.' });
      return;
    }
    setAppliances(items);
    setCsvMsg({
      ok: errors.length === 0,
      text: errors.length === 0 ? `Imported ${items.length} items (replaced existing). Review, then Save for all dealers.` : `Imported ${items.length} items, ${errors.length} skipped: ${errors.slice(0, 3).join(' ')}`,
    });
  };

  // Append/merge: add the parsed items to the existing inventory (upsert by id),
  // so a brand file (e.g. NewAge) can be added without wiping what's there.
  const appendCsv = (text: string) => {
    const { items, errors } = parseAppliancesCsv(text);
    if (items.length === 0) {
      setCsvMsg({ ok: false, text: errors[0] ?? 'No rows found in the file.' });
      return;
    }
    const ids = new Set(items.map((i) => i.id));
    const merged = [...appliances.filter((a) => !ids.has(a.id)), ...items];
    setAppliances(merged);
    setCsvMsg({
      ok: errors.length === 0,
      text: `Added ${items.length} items (inventory now ${merged.length}). Review, set each brand's visibility above, then Save for all dealers.${errors.length ? ` ${errors.length} rows skipped.` : ''}`,
    });
  };

  const exportCsv = () => {
    const blob = new Blob([appliancesToCsv(appliances)], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'appliance-inventory.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <Modal
      title="Appliance inventory & brand discounts"
      sub="Grills, griddles, burners, kamados, fridges and insulated liners that drop into outdoor cabinets. Customers see MSRP on the report; the dealer's cost is MSRP minus half the brand discount."
      onClose={() => setOpen(false)}
      wide
    >
      <h3 className="modal-h3">Brands — discount &amp; visibility</h3>
      <p className="card-sub">
        Enter the manufacturer discount you receive (each dealer automatically gets half). Set <b>Visible to</b> to limit a
        brand to specific customer accounts — leave it on <b>Everyone</b> to show it to all.
      </p>
      <div className="brand-grid">
        {brandNames.length === 0 && <span className="card-sub">Add inventory below, then set each brand's discount here.</span>}
        {brandNames.map((b) => (
          <div key={b} className="brand-cell">
            <div className="brand-cell-head">
              <span className="brand-cell-name">{b}</span>
              <span className="suffix-input">
                <DimCell value={brands[b]?.discountPct} placeholder={0} onCommit={(v) => setBrandPct(b, v)} />
                <span className="suffix">%</span>
              </span>
            </div>
            <BrandVisibility accounts={accounts} value={restricted[b] ?? []} onChange={(ids) => setBrandVisibility(b, ids)} />
          </div>
        ))}
      </div>

      <h3 className="modal-h3" style={{ marginTop: 18 }}>
        Inventory
      </h3>
      <div className="appliance-list">
        <div className="appliance-row appliance-row-head">
          <span>Category</span>
          <span>Brand</span>
          <span>Model #</span>
          <span>Description</span>
          <span>MSRP</span>
          <span>Liner / Size W×D×H</span>
          <span>Panel $</span>
          <span></span>
        </div>
        {appliances.map((a) => (
          <ApplianceRow key={a.id} a={a} liners={liners} onChange={(patch) => updateAppliance(a.id, patch)} onRemove={() => removeRow(a.id)} />
        ))}
        {appliances.length === 0 && <p className="card-sub">No appliances yet. Add a row or import a CSV.</p>}
      </div>

      <div className="appliance-tools">
        <button className="btn-ghost" onClick={addRow}>
          + Add row
        </button>
        <label className="btn-ghost file-btn">
          Append CSV
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) f.text().then(appendCsv);
              e.target.value = '';
            }}
          />
        </label>
        <label className="btn-ghost file-btn">
          Replace from CSV
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) f.text().then(importCsv);
              e.target.value = '';
            }}
          />
        </label>
        <button className="btn-ghost" onClick={exportCsv} disabled={appliances.length === 0}>
          Export CSV
        </button>
        <span className="card-sub appliance-csv-help">
          CSV columns: category, brand, model, name, msrp, liner_model, cutout_w, cutout_d, cutout_h, panel_charge
        </span>
      </div>
      {csvMsg && <div className={csvMsg.ok ? 'ok-banner' : 'warn'} style={{ marginTop: 8 }}>{csvMsg.text}</div>}

      <SaveGlobalFooter
        onSave={async () => {
          await api.setAppliances(useStore.getState().appliances);
          await api.setApplianceBrands(useStore.getState().applianceBrands);
          await api.setRestrictedBrands(restricted);
        }}
      />
    </Modal>
  );
}

/**
 * Dealer-facing inventory: add your own appliances + insulated liners (on top of
 * the admin-managed global list) and hide brands you don't want to offer. Your
 * additions and hidden brands are private to your account.
 */
export function MyAppliancesModal() {
  const open = useStore((s) => s.myAppliancesOpen);
  const setOpen = useStore((s) => s.setMyAppliancesOpen);
  const visible = useStore((s) => s.appliances); // dealer's current (merged) list
  const prefs = useSession((s) => s.prefs);
  const setPrefs = useSession((s) => s.setPrefs);
  const refreshGlobals = useSession((s) => s.refreshGlobals);

  const [own, setOwn] = useState<ApplianceItem[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setState('idle');
    setError(null);
    setHidden(prefs?.hiddenBrands ?? []);
    api.getOwnAppliances().then(({ appliances }) => setOwn(appliances)).catch(() => setOwn([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Liners the dealer can attach to a grill = global (visible) + their own.
  const liners = useMemo(() => {
    const all = [...visible.filter((a) => a.category === 'liner'), ...own.filter((a) => a.category === 'liner')];
    return [...new Map(all.map((l) => [l.id, l])).values()];
  }, [visible, own]);

  // Every brand the dealer could offer, including ones currently hidden (so they
  // can be turned back on). Hidden brands are absent from `visible`, so add them.
  const allBrands = useMemo(() => {
    const s = new Set<string>(hidden);
    for (const a of visible) if (a.brand) s.add(a.brand);
    for (const a of own) if (a.brand) s.add(a.brand);
    return [...s].sort((x, y) => x.localeCompare(y));
  }, [visible, own, hidden]);

  if (!open) return null;

  const hiddenSet = new Set(hidden);
  const toggleHidden = (brand: string) =>
    setHidden((h) => (h.includes(brand) ? h.filter((b) => b !== brand) : [...h, brand]));

  const updateOwn = (id: string, patch: Partial<ApplianceItem>) =>
    setOwn((list) => {
      let next = list.map((a) => (a.id === id ? { ...a, ...patch } : a));
      if (patch.brand !== undefined || patch.model !== undefined) {
        const a = next.find((x) => x.id === id)!;
        const newId = applianceId(a.brand, a.model);
        if (newId && newId !== id && !next.some((x) => x.id === newId)) {
          next = next.map((x) => (x.id === id ? { ...x, id: newId } : x.linerId === id ? { ...x, linerId: newId } : x));
        }
      }
      return next;
    });

  const addRow = () =>
    setOwn((list) => [
      ...list,
      { id: `mine-${Math.max(1, Math.round(Date.now() % 1e6))}-${list.length}`, category: 'grill', brand: '', model: '', name: '', msrp: 0, active: true },
    ]);

  const removeRow = (id: string) =>
    setOwn((list) => list.filter((a) => a.id !== id).map((a) => (a.linerId === id ? { ...a, linerId: undefined } : a)));

  const save = async () => {
    setError(null);
    setState('saving');
    try {
      // Only persist rows that actually have a brand + model.
      const clean = own.filter((a) => a.brand.trim() && a.model.trim());
      await api.setOwnAppliances(clean);
      if (prefs) await setPrefs({ ...prefs, hiddenBrands: hidden });
      await refreshGlobals();
      setState('saved');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your inventory.');
      setState('idle');
    }
  };

  return (
    <Modal
      title="My appliances & brands"
      sub="Add grills, griddles, burners, fridges and insulated liners you carry, and hide brands you don't want to offer. These are private to your account, on top of the standard catalog."
      onClose={() => setOpen(false)}
      wide
    >
      <h3 className="modal-h3">Brands I offer</h3>
      <p className="card-sub">Uncheck a brand to hide all of its appliances from your designs and reports.</p>
      <div className="brand-grid">
        {allBrands.length === 0 && <span className="card-sub">No brands yet — add appliances below.</span>}
        {allBrands.map((b) => (
          <label key={b} className="brand-toggle">
            <input type="checkbox" checked={!hiddenSet.has(b)} onChange={() => toggleHidden(b)} />
            <span>{b}</span>
          </label>
        ))}
      </div>

      <h3 className="modal-h3" style={{ marginTop: 18 }}>
        My added appliances
      </h3>
      <div className="appliance-list">
        <div className="appliance-row appliance-row-head">
          <span>Category</span>
          <span>Brand</span>
          <span>Model #</span>
          <span>Description</span>
          <span>MSRP</span>
          <span>Liner / Size W×D×H</span>
          <span>Panel $</span>
          <span></span>
        </div>
        {own.map((a) => (
          <ApplianceRow key={a.id} a={a} liners={liners} onChange={(patch) => updateOwn(a.id, patch)} onRemove={() => removeRow(a.id)} />
        ))}
        {own.length === 0 && <p className="card-sub">You haven't added any appliances yet. Click “Add appliance”.</p>}
      </div>
      <div className="appliance-tools">
        <button className="btn-ghost" onClick={addRow}>
          + Add appliance
        </button>
      </div>

      <div className="modal-actions" style={{ alignItems: 'center' }}>
        {error && <span className="warn-inline">{error}</span>}
        {state === 'saved' && <span className="ok-inline">Saved.</span>}
        <button className="btn-primary" disabled={state === 'saving'} onClick={save}>
          {state === 'saving' ? 'Saving…' : 'Save my inventory'}
        </button>
      </div>
    </Modal>
  );
}
