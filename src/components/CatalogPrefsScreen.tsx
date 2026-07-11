import { useMemo, useState } from 'react';
import { ApiError } from '../api/client';
import { CATALOG, CATEGORY_LABELS, FINISHES, INDOOR_FINISHES } from '../model/catalog';
import { useStore } from '../state/store';
import { useSession } from '../state/session';

/**
 * Cabinet-company catalog customization: toggle which cabinets, handles and
 * colors/finishes appear in this company's pickers. Everything is ON by
 * default; unchecked ids are stored in catalogPrefs.hidden*.
 */
export default function CatalogPrefsScreen() {
  const catalogPrefs = useSession((s) => s.catalogPrefs);
  const setCatalogPrefs = useSession((s) => s.setCatalogPrefs);
  const handles = useStore((s) => s.handles);

  const [hiddenCabinets, setHiddenCabinets] = useState<Set<string>>(() => new Set(catalogPrefs?.hiddenCabinets ?? []));
  const [hiddenHandles, setHiddenHandles] = useState<Set<string>>(() => new Set(catalogPrefs?.hiddenHandles ?? []));
  const [hiddenFinishes, setHiddenFinishes] = useState<Set<string>>(() => new Set(catalogPrefs?.hiddenFinishes ?? []));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  // EXT items offered in the Add picker (NewAge factory units aren't
  // company-customizable; auto-convert variants follow their 2-door parent).
  const cabinetGroups = useMemo(() => {
    const items = CATALOG.filter((c) => !c.line && !c.hideFromAdd);
    return Object.entries(CATEGORY_LABELS)
      .map(([id, label]) => ({ label, items: items.filter((c) => (c.displayCategory ?? c.category) === id) }))
      .filter((g) => g.items.length > 0);
  }, []);

  const finishGroups = useMemo(
    () => [
      { label: 'Outdoor HDPE Colors', items: FINISHES },
      { label: 'Indoor Painted & Wood Finishes', items: INDOOR_FINISHES },
    ],
    []
  );

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
    setStatus('idle');
  };

  async function save() {
    setStatus('saving');
    setError(null);
    try {
      await setCatalogPrefs({
        hiddenCabinets: [...hiddenCabinets],
        hiddenHandles: [...hiddenHandles],
        hiddenFinishes: [...hiddenFinishes],
      });
      setStatus('saved');
    } catch (e) {
      setStatus('idle');
      setError(e instanceof ApiError ? e.message : 'Could not save. Please try again.');
    }
  }

  const chip = (id: string, label: string, hidden: Set<string>, setter: (s: Set<string>) => void, swatch?: string) => (
    <button
      key={id}
      className={`pref-chip ${hidden.has(id) ? 'pref-chip-off' : ''}`}
      title={hidden.has(id) ? 'Hidden — click to show' : 'Shown — click to hide'}
      onClick={() => toggle(hidden, setter, id)}
    >
      {swatch && <span className="pref-swatch" style={{ background: swatch }} />}
      {label}
    </button>
  );

  return (
    <main className="screen">
      <div className="screen-head">
        <div>
          <h1>My Catalog</h1>
          <p className="screen-sub">
            Choose what your team sees in the designer. Unchecked items are hidden from the cabinet picker, handle list and
            color/finish palettes for everyone signed in to this company account.
          </p>
        </div>
        <div className="screen-head-actions">
          <button className="btn-primary" onClick={save} disabled={status === 'saving'}>
            {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : 'Save changes'}
          </button>
        </div>
      </div>
      {error && <div className="warn">{error}</div>}

      <h2 className="pref-h2">Cabinets</h2>
      {cabinetGroups.map((g) => (
        <section key={g.label} className="pref-section">
          <h3 className="pref-h3">{g.label}</h3>
          <div className="pref-chips">{g.items.map((c) => chip(c.id, c.name, hiddenCabinets, setHiddenCabinets))}</div>
        </section>
      ))}

      <h2 className="pref-h2">Handles</h2>
      <section className="pref-section">
        {handles.filter((h) => h.active !== false).length === 0 ? (
          <p className="muted">No handles in the inventory yet.</p>
        ) : (
          <div className="pref-chips">
            {handles.filter((h) => h.active !== false).map((h) => chip(h.id, h.name || 'Unnamed handle', hiddenHandles, setHiddenHandles))}
          </div>
        )}
      </section>

      <h2 className="pref-h2">Colors &amp; Finishes</h2>
      {finishGroups.map((g) => (
        <section key={g.label} className="pref-section">
          <h3 className="pref-h3">{g.label}</h3>
          <div className="pref-chips">{g.items.map((f) => chip(f.id, f.name, hiddenFinishes, setHiddenFinishes, f.body))}</div>
        </section>
      ))}
    </main>
  );
}
