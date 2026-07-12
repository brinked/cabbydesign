import { useMemo, useState } from 'react';
import { ApiError, type CompanyFinish, type CompanyHandle } from '../api/client';
import { CATALOG, CATEGORY_LABELS, FINISHES, INDOOR_FINISHES } from '../model/catalog';
import { money } from '../model/pricing';
import { uid, useStore } from '../state/store';
import { useSession } from '../state/session';

type TabId = 'cabinets' | 'handles' | 'finishes';

/**
 * Cabinet-company catalog personalization. Three tabs:
 *  - Cabinets: check/uncheck what appears in the Add-cabinet picker
 *  - Handles: toggle the stock handles + add the company's own (with price)
 *  - Colors & Finishes: toggle the stock palettes + add the company's own
 * Everything is ON by default; unchecked ids are stored in catalogPrefs.
 */
export default function CatalogPrefsScreen() {
  const catalogPrefs = useSession((s) => s.catalogPrefs);
  const setCatalogPrefs = useSession((s) => s.setCatalogPrefs);
  const handles = useStore((s) => s.handles);

  const [tabId, setTabId] = useState<TabId>('cabinets');
  const [hiddenCabinets, setHiddenCabinets] = useState<Set<string>>(() => new Set(catalogPrefs?.hiddenCabinets ?? []));
  const [hiddenHandles, setHiddenHandles] = useState<Set<string>>(() => new Set(catalogPrefs?.hiddenHandles ?? []));
  const [hiddenFinishes, setHiddenFinishes] = useState<Set<string>>(() => new Set(catalogPrefs?.hiddenFinishes ?? []));
  const [customFinishes, setCustomFinishes] = useState<CompanyFinish[]>(() => catalogPrefs?.customFinishes ?? []);
  const [customHandles, setCustomHandles] = useState<CompanyHandle[]>(() => catalogPrefs?.customHandles ?? []);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  // add-form state
  const [newColorName, setNewColorName] = useState('');
  const [newColor, setNewColor] = useState('#4a6b8a');
  const [newHandleName, setNewHandleName] = useState('');
  const [newHandlePrice, setNewHandlePrice] = useState('');

  const cabinetGroups = useMemo(() => {
    const items = CATALOG.filter((c) => !c.line && !c.hideFromAdd);
    return Object.entries(CATEGORY_LABELS)
      .map(([id, label]) => ({ label, items: items.filter((c) => (c.displayCategory ?? c.category) === id) }))
      .filter((g) => g.items.length > 0);
  }, []);

  const finishGroups = useMemo(
    () => [
      { label: 'Outdoor HDPE colors', items: FINISHES },
      { label: 'Indoor painted colors', items: INDOOR_FINISHES.filter((f) => !f.wood) },
      { label: 'Indoor wood stains', items: INDOOR_FINISHES.filter((f) => f.wood) },
    ],
    []
  );

  const stockHandles = handles.filter((h) => h.active !== false);

  const touch = () => {
    setDirty(true);
    setStatus('idle');
  };
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
    touch();
  };
  const setAll = (set: Set<string>, setter: (s: Set<string>) => void, ids: string[], hidden: boolean) => {
    const next = new Set(set);
    for (const id of ids) {
      if (hidden) next.add(id);
      else next.delete(id);
    }
    setter(next);
    touch();
  };

  async function save() {
    setStatus('saving');
    setError(null);
    try {
      await setCatalogPrefs({
        hiddenCabinets: [...hiddenCabinets],
        hiddenHandles: [...hiddenHandles],
        hiddenFinishes: [...hiddenFinishes],
        customFinishes,
        customHandles,
      });
      setStatus('saved');
      setDirty(false);
    } catch (e) {
      setStatus('idle');
      setError(e instanceof ApiError ? e.message : 'Could not save. Please try again.');
    }
  }

  function addColor() {
    const name = newColorName.trim();
    if (!name) return;
    setCustomFinishes([...customFinishes, { id: uid('cofin'), name, body: newColor }]);
    setNewColorName('');
    touch();
  }

  function addHandle() {
    const name = newHandleName.trim();
    const price = parseFloat(newHandlePrice);
    if (!name || !Number.isFinite(price) || price < 0) return;
    setCustomHandles([...customHandles, { id: uid('cohdl'), name, price: Math.round(price * 100) / 100 }]);
    setNewHandleName('');
    setNewHandlePrice('');
    touch();
  }

  const groupCard = (
    label: string,
    ids: string[],
    hidden: Set<string>,
    setter: (s: Set<string>) => void,
    rows: React.ReactNode
  ) => {
    const shown = ids.filter((id) => !hidden.has(id)).length;
    return (
      <section key={label} className="prefs-card">
        <div className="prefs-card-head">
          <h3>{label}</h3>
          <span className="prefs-count">
            {shown}/{ids.length} shown
            <button className="link-btn" onClick={() => setAll(hidden, setter, ids, false)}>
              all
            </button>
            <button className="link-btn" onClick={() => setAll(hidden, setter, ids, true)}>
              none
            </button>
          </span>
        </div>
        <div className="prefs-grid">{rows}</div>
      </section>
    );
  };

  const check = (id: string, label: React.ReactNode, hidden: Set<string>, setter: (s: Set<string>) => void) => (
    <label key={id} className={`prefs-check ${hidden.has(id) ? 'prefs-check-off' : ''}`}>
      <input type="checkbox" checked={!hidden.has(id)} onChange={() => toggle(hidden, setter, id)} />
      {label}
    </label>
  );

  const swatch = (color: string) => <span className="pref-swatch" style={{ background: color }} />;

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: 'cabinets', label: 'Cabinets' },
    { id: 'handles', label: 'Handles' },
    { id: 'finishes', label: 'Colors & Finishes' },
  ];

  return (
    <main className="screen">
      <div className="screen-head">
        <div>
          <h1>My Catalog</h1>
          <p className="screen-sub">
            Personalize the designer for your company — choose what appears, and add your own colors and handles.
          </p>
        </div>
        <div className="screen-head-actions">
          {dirty && <span className="prefs-dirty">Unsaved changes</span>}
          <button className="btn-primary" onClick={save} disabled={status === 'saving' || (!dirty && status !== 'saved')}>
            {status === 'saving' ? 'Saving…' : status === 'saved' && !dirty ? 'Saved ✓' : 'Save changes'}
          </button>
        </div>
      </div>
      {error && <div className="warn">{error}</div>}

      <nav className="tabs prefs-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tabId === t.id ? 'tab active' : 'tab'} onClick={() => setTabId(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tabId === 'cabinets' &&
        cabinetGroups.map((g) =>
          groupCard(
            g.label,
            g.items.map((c) => c.id),
            hiddenCabinets,
            setHiddenCabinets,
            g.items.map((c) => check(c.id, <span>{c.name}</span>, hiddenCabinets, setHiddenCabinets))
          )
        )}

      {tabId === 'handles' && (
        <>
          <section className="prefs-card">
            <div className="prefs-card-head">
              <h3>Your handles</h3>
              <span className="prefs-count">shown with your pricing</span>
            </div>
            {customHandles.length === 0 && <p className="muted">None yet — add your first handle below.</p>}
            {customHandles.length > 0 && (
              <div className="prefs-list">
                {customHandles.map((h) => (
                  <div key={h.id} className="prefs-list-row">
                    <span>{h.name}</span>
                    <span className="prefs-price">{money(h.price)}</span>
                    <button
                      className="btn-danger-ghost"
                      onClick={() => {
                        setCustomHandles(customHandles.filter((x) => x.id !== h.id));
                        touch();
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="prefs-add-row">
              <input className="settings-text prefs-add-name" placeholder="Handle name (e.g. 6″ Matte Black Bar Pull)" value={newHandleName} onChange={(e) => setNewHandleName(e.target.value)} />
              <span className="prefs-add-currency">$</span>
              <input className="settings-text prefs-add-price" placeholder="Price" inputMode="decimal" value={newHandlePrice} onChange={(e) => setNewHandlePrice(e.target.value)} />
              <button className="btn-soft" onClick={addHandle}>
                + Add handle
              </button>
            </div>
          </section>
          {stockHandles.length > 0 &&
            groupCard(
              'Stock handles',
              stockHandles.map((h) => h.id),
              hiddenHandles,
              setHiddenHandles,
              stockHandles.map((h) =>
                check(
                  h.id,
                  <span>
                    {h.name || 'Unnamed handle'} <em className="prefs-price">{money(h.retail)}</em>
                  </span>,
                  hiddenHandles,
                  setHiddenHandles
                )
              )
            )}
        </>
      )}

      {tabId === 'finishes' && (
        <>
          <section className="prefs-card">
            <div className="prefs-card-head">
              <h3>Your colors</h3>
              <span className="prefs-count">shown under “My Colors” in every palette</span>
            </div>
            {customFinishes.length === 0 && <p className="muted">None yet — add your first color below.</p>}
            {customFinishes.length > 0 && (
              <div className="prefs-list">
                {customFinishes.map((f) => (
                  <div key={f.id} className="prefs-list-row">
                    <span>
                      {swatch(f.body)} {f.name}
                    </span>
                    <span className="prefs-price">{f.body}</span>
                    <button
                      className="btn-danger-ghost"
                      onClick={() => {
                        setCustomFinishes(customFinishes.filter((x) => x.id !== f.id));
                        touch();
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="prefs-add-row">
              <input type="color" className="prefs-color" value={newColor} onChange={(e) => setNewColor(e.target.value)} title="Pick the door color" />
              <input className="settings-text prefs-add-name" placeholder="Color name (e.g. Coastal Blue)" value={newColorName} onChange={(e) => setNewColorName(e.target.value)} />
              <button className="btn-soft" onClick={addColor}>
                + Add color
              </button>
            </div>
          </section>
          {finishGroups.map((g) =>
            groupCard(
              g.label,
              g.items.map((f) => f.id),
              hiddenFinishes,
              setHiddenFinishes,
              g.items.map((f) =>
                check(
                  f.id,
                  <span>
                    {swatch(f.body)} {f.name}
                  </span>,
                  hiddenFinishes,
                  setHiddenFinishes
                )
              )
            )
          )}
        </>
      )}
    </main>
  );
}
