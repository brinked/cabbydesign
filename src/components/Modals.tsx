import { useEffect, useMemo, useState } from 'react';
import { CATALOG, CATEGORY_LABELS, COUNTER_T, catalogById } from '../model/catalog';
import { money, tryFormula } from '../model/pricing';
import type { CatalogItem, FrontKind } from '../model/types';
import { effectiveDims, itemPrice, largestOpening, openingFor, roughInConflict, spaceLeft, useStore } from '../state/store';
import { api, ApiError } from '../api/client';
import { CatalogThumb } from './CabinetImage';
import { useFinish } from './WallsView';
import { fmtIn } from './svg';

const HINGED_FRONTS: FrontKind[] = ['door1', 'doordrawer', 'burner', 'propane', 'blind', 'blindl', 'blindr', 'fridge', 'fridgep', 'corner', 'susan', 'sink1', 'sink1f'];

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
  useEffect(() => setText(String(value)), [value]);

  const commit = () => {
    const v = parseFloat(text);
    if (Number.isNaN(v)) {
      setText(String(value));
      return;
    }
    const r = Math.min(max, Math.max(min, Math.round(v * 4) / 4));
    setText(String(r));
    if (r !== value) onChange(r);
  };

  return (
    <div className="stepper-row">
      <span className="stepper-label">{label}</span>
      <div className="stepper">
        <button onClick={() => onChange(Math.max(min, Math.round((value - step) * 4) / 4))} disabled={value - step < min - 0.001}>
          −
        </button>
        <input
          className="stepper-input"
          value={text}
          inputMode="decimal"
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        <button onClick={() => onChange(Math.min(max, Math.round((value + step) * 4) / 4))} disabled={value + step > max + 0.001}>
          +
        </button>
      </div>
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

  if (!editingId) return null;
  const it = design.items.find((i) => i.id === editingId);
  if (!it) return null;
  const cat = catalogById(it.catalogId);
  const wall = design.walls.find((w) => w.id === it.wallId);
  if (!wall) return null;

  const left = spaceLeft(design, it.wallId, cat.lane);
  const dimRange = effectiveDims(it.catalogId, dims);
  const maxW = Math.min(dimRange.maxW, it.w + left);
  const price = itemPrice(design, it, pricing);
  const island = wall.ghost;
  const maxTrays = cat.maxTrays ?? 0;

  return (
    <Modal title={`${fmtIn(it.w)} ${cat.name}`} sub={`Space left: ${fmtIn(Math.max(0, left))}`} onClose={() => openEditor(null)}>
      {cat.note && <div className="edit-note">{cat.note}</div>}
      <div className="stepper-list">
        <Stepper label="Width" value={it.w} step={1} min={dimRange.minW} max={maxW} onChange={(w) => updateItem(it.id, { w })} />
        <Stepper label="Depth" value={it.d} step={3} min={dimRange.minD} max={dimRange.maxD} onChange={(d) => updateItem(it.id, { d })} />
        <Stepper label="Height" value={it.h} step={1.5} min={12} max={96} onChange={(h) => updateItem(it.id, { h })} />
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
        {cat.category !== 'appliance' && (
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
    <Modal title={r.kind === 'plumbing' ? 'Plumbing Stub-Out' : 'Electrical Outlet'} sub={`On ${wall?.name ?? 'wall'}`} onClose={() => openRoughIn(null)}>
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={r.kind === 'plumbing' ? 'seg-btn active' : 'seg-btn'} onClick={() => set({ kind: 'plumbing' })}>
          Plumbing (drain + 2 lines)
        </button>
        <button className={r.kind === 'electrical' ? 'seg-btn active' : 'seg-btn'} onClick={() => set({ kind: 'electrical' })}>
          Electrical
        </button>
      </div>
      {conflict && (
        <div className="warn">
          ⚠ Conflict — this stub-out isn’t directly behind a single cabinet. A hole can’t be cut in the gap between two
          cabinets; move it so its full width sits behind one cabinet.
        </div>
      )}
      <div className="stepper-list">
        <Stepper label="Width" value={r.w} step={1} min={1} max={Math.max(1, wallLen)} onChange={(w) => set({ w })} />
        <Stepper label="Height" value={r.h} step={1} min={1} max={Math.max(1, wallH)} onChange={(h) => set({ h })} />
        <Stepper label="Center from left" value={r.x} step={1} min={0} max={wallLen} onChange={(x) => set({ x })} />
        <Stepper label="Height from floor" value={r.y} step={1} min={0} max={wallH} onChange={(y) => set({ y })} />
        <div className="stepper-row">
          <span className="stepper-label">
            Center from right<span className="stepper-note">auto</span>
          </span>
          <span className="stepper">{fmtIn(Math.max(0, wallLen - r.x))}</span>
        </div>
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
