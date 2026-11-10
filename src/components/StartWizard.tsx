// Guided start: kitchen type → cabinet range → shape → size → starter layout.
// Used from the landing page and from File → New design.
import { useState } from 'react';
import type { KitchenType, ProductLine } from '../model/types';
import { BRAND_LIST, brandOf } from '../model/brands';
import { finishesForLine } from '../model/catalog';
import { MAX_RUN, MIN_RUN, SHAPES, type KitchenShape, type StartSpec } from '../model/templates';

type Step = 'where' | 'brand' | 'shape' | 'size';

const BRAND_BLURB: Record<string, string> = {
  ext: 'Made to size in weatherproof HDPE — any width, dozens of colors and door designs.',
  newage: 'Modular 304 stainless or aluminum units at set factory sizes.',
  challenger: 'All-aluminum, powder-coated cabinets built to order in 3″ width steps.',
};

/** Small drawing of each shape (plan view). */
function ShapeIcon({ shape }: { shape: KitchenShape }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <svg viewBox="0 0 80 60" width="80" height="60" aria-hidden>
      {shape === 'straight' && (
        <>
          <path d="M8 14h64" stroke="var(--line)" strokeWidth={3} />
          <path d="M12 24h56" {...s} />
        </>
      )}
      {shape === 'island' && <rect x="16" y="22" width="48" height="16" rx="3" {...s} />}
      {shape === 'l' && <path d="M14 14h52v34" {...s} />}
      {shape === 'u' && <path d="M14 48V14h52v34" {...s} />}
    </svg>
  );
}

const fmtFeet = (inches: number) => {
  const ft = Math.floor(inches / 12);
  const rem = Math.round(inches - ft * 12);
  return rem ? `${ft}′ ${rem}″` : `${ft}′`;
};

export default function StartWizard({
  initial,
  onClose,
  onCreate,
  busy,
}: {
  /** Pre-chosen answers (e.g. the landing card clicked) — those steps are skipped. */
  initial?: { kitchenType?: KitchenType; line?: ProductLine };
  onClose: () => void;
  onCreate: (spec: StartSpec) => void;
  busy?: boolean;
}) {
  const [kitchenType, setKitchenType] = useState<KitchenType>(initial?.kitchenType ?? 'outdoor');
  const [line, setLine] = useState<ProductLine>(initial?.line ?? 'ext');
  const [shape, setShape] = useState<KitchenShape>('straight');
  const [lengths, setLengths] = useState<number[]>(SHAPES[0].defaults);
  const [starter, setStarter] = useState(true);
  const firstStep: Step = initial?.line ? 'shape' : initial?.kitchenType === 'indoor' ? 'shape' : initial?.kitchenType ? 'brand' : 'where';
  const [step, setStep] = useState<Step>(firstStep);

  const steps: Step[] = kitchenType === 'indoor' ? ['where', 'shape', 'size'] : ['where', 'brand', 'shape', 'size'];
  const shown = steps.slice(steps.indexOf(firstStep));
  const idx = shown.indexOf(step);
  const back = () => (idx > 0 ? setStep(shown[idx - 1]) : onClose());
  const def = SHAPES.find((s) => s.id === shape)!;
  const valid = lengths.slice(0, def.walls.length).every((v) => Number.isFinite(v) && v >= MIN_RUN && v <= MAX_RUN);

  const pickShape = (s: KitchenShape) => {
    setShape(s);
    setLengths(SHAPES.find((x) => x.id === s)!.defaults);
    setStep('size');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="wizard-progress" aria-hidden>
              {shown.map((s, i) => (
                <span key={s} className={i <= idx ? 'wizard-dot active' : 'wizard-dot'} />
              ))}
            </div>
            <h2 id="wizard-title">
              {step === 'where' && 'Where is your kitchen?'}
              {step === 'brand' && 'Which cabinets would you like?'}
              {step === 'shape' && 'What shape is it?'}
              {step === 'size' && 'How big is it?'}
            </h2>
            <p className="modal-sub">
              {step === 'where' && 'You can change everything later — this just gets you started.'}
              {step === 'brand' && 'Each range has its own sizes, colors and look. You can switch later.'}
              {step === 'shape' && 'Pick the closest match. You can add, move and resize walls afterwards.'}
              {step === 'size' && 'A rough measurement is fine — every length can be adjusted in the designer.'}
            </p>
          </div>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {step === 'where' && (
          <div className="wizard-grid wizard-grid-2">
            {(['outdoor', 'indoor'] as KitchenType[]).map((k) => (
              <button
                key={k}
                className={kitchenType === k ? 'wizard-card active' : 'wizard-card'}
                onClick={() => {
                  setKitchenType(k);
                  if (k === 'indoor') setLine('ext');
                  setStep(k === 'indoor' ? 'shape' : 'brand');
                }}
              >
                <img src={k === 'outdoor' ? '/landing/outdoor-3d.jpg' : '/landing/indoor-plan.jpg'} alt="" />
                <b>{k === 'outdoor' ? 'Outdoor kitchen' : 'Indoor kitchen'}</b>
                <span>{k === 'outdoor' ? 'Grill islands, patios and pool-side kitchens built for the weather.' : 'Made-to-size cabinets for the kitchen inside your home.'}</span>
              </button>
            ))}
          </div>
        )}

        {step === 'brand' && (
          <div className="wizard-grid wizard-grid-3">
            {BRAND_LIST.map((b) => (
              <button
                key={b.id}
                className={line === b.id ? 'wizard-card active' : 'wizard-card'}
                onClick={() => {
                  setLine(b.id);
                  setStep('shape');
                }}
              >
                <span className="wizard-swatches" aria-hidden>
                  {finishesForLine(b.id, 'outdoor')
                    .slice(0, 6)
                    .map((f) => (
                      <i key={f.id} style={{ background: f.panel }} title={f.name} />
                    ))}
                </span>
                <b>{b.id === 'ext' ? 'EXT Cabinets' : brandOf(b.id).label.split(' — ')[0]}</b>
                <span>{BRAND_BLURB[b.id] ?? b.startSub}</span>
              </button>
            ))}
          </div>
        )}

        {step === 'shape' && (
          <div className="wizard-grid wizard-grid-4">
            {SHAPES.map((s) => (
              <button key={s.id} className={shape === s.id ? 'wizard-card wizard-card-center active' : 'wizard-card wizard-card-center'} onClick={() => pickShape(s.id)}>
                <ShapeIcon shape={s.id} />
                <b>{s.label}</b>
                <span>{s.sub}</span>
              </button>
            ))}
          </div>
        )}

        {step === 'size' && (
          <div className="wizard-size">
            <div className="wizard-size-shape">
              <ShapeIcon shape={shape} />
            </div>
            <div className="wizard-size-fields">
              {def.walls.map((label, i) => (
                <label key={label} className="wizard-field">
                  <span>{label}</span>
                  <span className="wizard-input">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={MIN_RUN}
                      max={MAX_RUN}
                      value={Number.isFinite(lengths[i]) ? lengths[i] : ''}
                      onChange={(e) => setLengths((cur) => cur.map((v, j) => (j === i ? (e.target.value === '' ? NaN : Number(e.target.value)) : v)))}
                    />
                    <em>inches{Number.isFinite(lengths[i]) && lengths[i] >= 12 ? ` · ${fmtFeet(lengths[i])}` : ''}</em>
                  </span>
                </label>
              ))}
              {!valid && (
                <p className="warn">
                  Each run needs to be between {MIN_RUN}″ and {MAX_RUN}″ ({fmtFeet(MAX_RUN)}).
                </p>
              )}
              <label className="wizard-check">
                <input type="checkbox" checked={starter} onChange={(e) => setStarter(e.target.checked)} />
                <span>
                  <b>Start me off with a layout</b>
                  <em>We’ll place a first set of cabinets to fit — swap, move or remove any of them.</em>
                </span>
              </label>
            </div>
          </div>
        )}

        <div className="modal-actions wizard-actions">
          <button className="btn-ghost" onClick={back}>
            {idx > 0 ? '← Back' : 'Cancel'}
          </button>
          {step === 'size' && (
            <button className="btn-primary" disabled={!valid || busy} onClick={() => onCreate({ kitchenType, line: kitchenType === 'indoor' ? 'ext' : line, shape, lengths: lengths.slice(0, def.walls.length), starter })}>
              {busy ? 'Setting up…' : 'Start designing →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
