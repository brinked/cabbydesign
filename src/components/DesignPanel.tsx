// The "Design" panel — every look-and-feel choice for a kitchen in one place.
//
// This replaces a cramped dropdown of labelled <select>s. The people using this
// build are homeowners, not dealers: they are picking things they can SEE, so
// every choice is a swatch or a drawn preview rather than a word in a list, and
// the trade wording ("bridge gaps", "gas type") is either gone or plain English.
import { DOOR_STYLE_LABELS, doorStylesFor, finishesForLine } from '../model/catalog';
import { COUNTERTOPS, COUNTER_CATEGORY_LABELS, type CounterCategory } from '../model/countertops';
import { DEFAULT_FLOORING, FLOORING } from '../model/flooring';
import { companyFinishes, mergedHandles } from '../model/companyCatalog';
import { LINE_LABELS } from '../model/newage';
import type { Design, DoorStyle, FinishOption, FlooringKind, HandleItem, ProductLine } from '../model/types';
import { useStore } from '../state/store';
import { useSession } from '../state/session';
import { Modal } from './Modals';

/** A miniature of each door design, drawn in CSS so the picker shows the
 *  actual look instead of a name. Mirrors facePattern() in three/cabinet3d. */
function DoorPreview({ style, fin }: { style: DoorStyle; fin: FinishOption }) {
  const frame: React.CSSProperties = {
    background: fin.panel,
    border: `1px solid rgba(0,0,0,0.18)`,
    borderRadius: 3,
    position: 'relative',
    // portrait, like a real door — a full-width preview reads as a drawer front
    width: 62,
    height: 84,
    margin: '0 auto',
    overflow: 'hidden',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
  };
  const groove = 'rgba(0,0,0,0.30)';
  // an inset ring, as Vibe/Regal have
  const ring = (inset: number, extra?: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute',
    inset,
    border: `1px solid ${groove}`,
    borderRadius: 2,
    ...extra,
  });
  const lines = (dir: 'v' | 'h', n: number, inset = 0): React.CSSProperties => ({
    position: 'absolute',
    inset,
    background: `repeating-linear-gradient(${dir === 'v' ? '90deg' : '0deg'}, transparent 0 ${100 / n - 1.2}%, ${groove} ${100 / n - 1.2}% ${100 / n}%)`,
  });
  return (
    <span style={frame}>
      {style === 'shaker' && <span style={ring(7)} />}
      {style === 'regal' && (
        <>
          <span style={ring(6)} />
          <span style={ring(11, { background: 'rgba(255,255,255,0.13)' })} />
        </>
      )}
      {style === 'metro' && (
        <>
          <span style={{ position: 'absolute', left: 6, top: 0, bottom: 0, width: 1, background: groove }} />
          <span style={{ position: 'absolute', right: 6, top: 0, bottom: 0, width: 1, background: groove }} />
          <span style={{ position: 'absolute', left: 6, right: 6, top: 8, height: 1, background: groove }} />
          <span style={{ position: 'absolute', left: 6, right: 6, bottom: 8, height: 1, background: groove }} />
        </>
      )}
      {style === 'clove' && (
        <>
          <span style={ring(6)} />
          <span style={lines('v', 5, 8)} />
        </>
      )}
      {style === 'cottage' && <span style={lines('v', 5)} />}
      {style === 'slat' && (
        <>
          <span style={{ position: 'absolute', left: 6, top: 0, bottom: 0, width: 1, background: groove }} />
          <span style={{ position: 'absolute', right: 6, top: 0, bottom: 0, width: 1, background: groove }} />
          <span style={lines('v', 3, 8)} />
        </>
      )}
      {style === 'miami' && (
        <>
          <span style={ring(6)} />
          <span style={lines('h', 4, 8)} />
        </>
      )}
      {style === 'tampa' && <span style={lines('h', 5)} />}
      {(style === 'shaker-inset' || style === 'shaker-skinny' || style === 'beadboard') && (
        <span style={ring(style === 'shaker-skinny' ? 5 : 9, { background: fin.inner })} />
      )}
      {style === 'beadboard' && <span style={lines('v', 6, 10)} />}
      {style === 'raised' && (
        <>
          <span style={ring(7, { background: fin.inner })} />
          <span style={ring(12, { background: fin.panel })} />
        </>
      )}
      {/* a pull, so the mini reads as a door */}
      <span style={{ position: 'absolute', right: 4, top: '38%', width: 2, height: 14, borderRadius: 2, background: '#b8bfc6' }} />
    </span>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="dp-section">
      <div className="dp-section-head">
        <h3>{title}</h3>
        {hint && <span>{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export default function DesignPanel({ onClose }: { onClose: () => void }) {
  const design = useStore((s) => s.design);
  const setDesignMeta = useStore((s) => s.setDesignMeta);
  const setLine = useStore((s) => s.setLine);
  const handles = useStore((s) => s.handles);
  const catalogPrefs = useSession((s) => s.catalogPrefs);

  const line: ProductLine = design.line ?? 'ext';
  const isNewAge = line === 'newage';
  const hiddenFinishes = new Set(catalogPrefs?.hiddenFinishes ?? []);
  const finishes = [
    ...finishesForLine(line, design.kitchenType).filter((f) => !hiddenFinishes.has(f.id)),
    ...(isNewAge ? [] : companyFinishes(catalogPrefs)),
  ];
  const fin = finishes.find((f) => f.id === design.finishId) ?? finishes[0];
  const handleOptions: HandleItem[] = mergedHandles(handles, catalogPrefs);
  const doorStyles = doorStylesFor(design.kitchenType);
  const counterCats: CounterCategory[] = ['dekton', 'solid', 'granite', 'quartzite', 'concrete', 'metal'];
  const set = (patch: Partial<Design>) => setDesignMeta(patch);

  return (
    <Modal title="Design your kitchen" sub="Pick a look — everything updates live in 3D." onClose={onClose} wide>
      <div className="design-panel">
        {/* ---- cabinets ---- */}
        <Section title="Cabinet style" hint="The range your cabinets come from">
          <div className="dp-seg">
            {(['ext', 'newage'] as ProductLine[]).map((l) => (
              <button
                key={l}
                className={line === l ? 'dp-seg-btn active' : 'dp-seg-btn'}
                onClick={() => {
                  if (l === line) return;
                  const dropped = design.items.filter((it) => !it.auto).length;
                  if (
                    dropped === 0 ||
                    confirm(`Switch to ${LINE_LABELS[l]}? The ${dropped} cabinet(s) you've placed belong to the current range and will be removed. Your walls, windows and doors stay.`)
                  ) {
                    setLine(l);
                  }
                }}
              >
                {LINE_LABELS[l]}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Colour" hint={fin ? fin.name : undefined}>
          <div className="dp-swatches">
            {finishes.map((f) => (
              <button
                key={f.id}
                className={design.finishId === f.id ? 'dp-swatch active' : 'dp-swatch'}
                onClick={() => set({ finishId: f.id })}
                title={f.name}
              >
                <span className="dp-swatch-chip" style={{ background: f.panel, borderColor: f.body }}>
                  <span style={{ background: f.counter }} />
                </span>
                <span className="dp-swatch-name">{f.name}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Door design" hint={DOOR_STYLE_LABELS[design.doorStyle]}>
          <div className="dp-cards">
            {doorStyles.map((st) => (
              <button
                key={st}
                className={design.doorStyle === st ? 'dp-card active' : 'dp-card'}
                onClick={() => set({ doorStyle: st })}
                title={DOOR_STYLE_LABELS[st]}
              >
                {fin && <DoorPreview style={st} fin={fin} />}
                <span className="dp-card-name">{DOOR_STYLE_LABELS[st].replace(/\s*\(.*\)$/, '')}</span>
              </button>
            ))}
          </div>
        </Section>

        {handleOptions.length > 0 && (
          <Section title="Handles" hint="Fitted to every door and drawer">
            <div className="dp-cards dp-cards-sm">
              {handleOptions.map((h) => (
                <button
                  key={h.id}
                  className={design.handleId === h.id ? 'dp-card active' : 'dp-card'}
                  onClick={() => set({ handleId: h.id })}
                  title={h.name}
                >
                  {h.photo ? <img src={h.photo} alt="" className="dp-card-img" /> : <span className="dp-card-bar" />}
                  <span className="dp-card-name">{h.name || 'Handle'}</span>
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* ---- countertop ---- */}
        <Section title="Countertop" hint={COUNTERTOPS.find((c) => c.id === design.counterId)?.name}>
          {counterCats.map((cat) => {
            const rows = COUNTERTOPS.filter((c) => c.category === cat);
            if (!rows.length) return null;
            return (
              <div key={cat} className="dp-group">
                <div className="dp-group-label">{COUNTER_CATEGORY_LABELS[cat]}</div>
                <div className="dp-swatches">
                  {rows.map((c) => (
                    <button
                      key={c.id}
                      className={design.counterId === c.id ? 'dp-swatch active' : 'dp-swatch'}
                      onClick={() => set({ counterId: c.id })}
                      title={c.name}
                    >
                      <span className="dp-swatch-chip dp-swatch-stone" style={{ background: c.base }} />
                      <span className="dp-swatch-name">{c.name.replace(/^Dekton /, '')}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="dp-row">
            <span>Splashback up the wall</span>
            <div className="dp-seg dp-seg-sm">
              {[
                { v: 0, label: 'None' },
                { v: 4, label: '4″' },
                { v: 18, label: '18″' },
                { v: 96, label: 'Full' },
              ].map((o) => (
                <button
                  key={o.v}
                  className={(design.backsplashHeight ?? 0) === o.v ? 'dp-seg-btn active' : 'dp-seg-btn'}
                  onClick={() => set({ backsplashHeight: o.v })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="dp-row">
            <span>Worktop thickness</span>
            <div className="dp-seg dp-seg-sm">
              {[1.25, 1.5, 2].map((t) => (
                <button key={t} className={design.counterThickness === t ? 'dp-seg-btn active' : 'dp-seg-btn'} onClick={() => set({ counterThickness: t })}>
                  {t === 1.25 ? '3cm' : t === 1.5 ? '4cm' : '5cm'}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* ---- surroundings ---- */}
        <Section title="Patio floor" hint="What your kitchen stands on">
          <div className="dp-cards dp-cards-sm">
            {FLOORING.map((f) => (
              <button
                key={f.id}
                className={(design.flooring ?? DEFAULT_FLOORING) === f.id ? 'dp-card active' : 'dp-card'}
                onClick={() => set({ flooring: f.id as FlooringKind })}
              >
                <span
                  className="dp-card-img"
                  style={{
                    background:
                      f.id === 'marble-pavers'
                        ? 'repeating-linear-gradient(0deg, #cfcdc6 0 1px, #f4f3ef 1px 14px), repeating-linear-gradient(90deg, #cfcdc6 0 1px, #f4f3ef 1px 26px)'
                        : f.base,
                  }}
                />
                <span className="dp-card-name">{f.name}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Fuel" hint="For the grill and burners">
          <div className="dp-seg">
            {[
              { v: undefined, label: 'Not sure yet' },
              { v: 'ng' as const, label: 'Natural gas' },
              { v: 'lp' as const, label: 'Propane' },
            ].map((o) => (
              <button key={o.label} className={(design.gasType ?? undefined) === o.v ? 'dp-seg-btn active' : 'dp-seg-btn'} onClick={() => set({ gasType: o.v })}>
                {o.label}
              </button>
            ))}
          </div>
        </Section>
      </div>

      <div className="modal-actions">
        <button className="btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
