// Admin control for the pergola: the published price list every design builds
// against. The dealer product also carries a per-account access list and
// personal rate overrides — this build has neither, because every user gets
// the tool and there is one set of prices.
import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { COLUMN_RATE_SUFFIX, PERGOLA_MODELS } from '../model/pergola';
import { useStore } from '../state/store';
import { Modal } from './Modals';

export function PergolaAdminModal({ onClose }: { onClose: () => void }) {
  const [rates, setRates] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .getPergola()
      .then((p) => setRates(Object.fromEntries(Object.entries(p.rates).map(([k, v]) => [k, String(v)]))))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load pergola rates.'));
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const clean: Record<string, number> = {};
      for (const [k, v] of Object.entries(rates)) {
        const n = parseFloat(v);
        if (Number.isFinite(n) && n >= 0) clean[k] = n; // 0 is valid (quote-only)
      }
      await api.setPergolaRates(clean);
      useStore.setState({ pergolaRates: clean }); // live for anyone designing now
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Pergola pricing"
      sub="What each model bills at. Blank uses the built-in default shown in the box."
      onClose={onClose}
    >
      {error && <div className="warn">{error}</div>}
      <div className="settings-menu-label">$ per sq ft of footprint · $ per column</div>
      {PERGOLA_MODELS.map((m) => (
        <label key={m.id} className="settings-menu-row">
          <span>
            {m.name} <span style={{ opacity: 0.6 }}>({m.desc})</span>
            <span style={{ opacity: 0.6, display: 'block', fontSize: 11 }}>extra column every {m.maxSpanFt} ft</span>
          </span>
          <span style={{ display: 'flex', gap: 6 }}>
            <input
              className="counter-input"
              style={{ width: 74 }}
              inputMode="decimal"
              placeholder={`${m.rate}/sf`}
              title="$ per square foot"
              value={rates[m.id] ?? ''}
              onChange={(e) => setRates((r) => ({ ...r, [m.id]: e.target.value }))}
            />
            <input
              className="counter-input"
              style={{ width: 74 }}
              inputMode="decimal"
              placeholder={`${m.columnPrice}/col`}
              title="$ per column"
              value={rates[m.id + COLUMN_RATE_SUFFIX] ?? ''}
              onChange={(e) => setRates((r) => ({ ...r, [m.id + COLUMN_RATE_SUFFIX]: e.target.value }))}
            />
          </span>
        </label>
      ))}
      <div className="modal-actions">
        {saved && <span className="ok-inline">Saved.</span>}
        <button className="btn-primary" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save rates'}
        </button>
      </div>
    </Modal>
  );
}
