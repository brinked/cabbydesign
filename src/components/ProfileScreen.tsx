import { useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useSession } from '../state/session';

export default function ProfileScreen() {
  const user = useSession((s) => s.user);
  const prefs = useSession((s) => s.prefs);
  const setPrefs = useSession((s) => s.setPrefs);

  const [marginPct, setMarginPct] = useState(String(prefs?.marginPct ?? 0));
  const [showPricing, setShowPricing] = useState(prefs?.showPricing ?? true);
  const [priceMode, setPriceMode] = useState<'cost' | 'marked_up'>(prefs?.priceMode ?? 'marked_up');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    setSaved(false);
    setBusy(true);
    const margin = parseFloat(marginPct);
    if (Number.isNaN(margin) || margin < 0) {
      setError('Enter a valid margin percentage (0 or more).');
      setBusy(false);
      return;
    }
    try {
      await setPrefs({ marginPct: margin, showPricing, priceMode });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save preferences.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen">
      <div className="screen-head">
        <div>
          <h1>Profile &amp; Pricing</h1>
          <p className="screen-sub">
            Signed in as {user?.name} ({user?.email})
          </p>
        </div>
      </div>

      {error && <div className="warn">{error}</div>}
      {saved && <div className="ok-banner">Saved.</div>}

      <LogoCard />

      <section className="card">
        <h2>Profit margin</h2>
        <p className="card-sub">
          Your markup over cost. A 35% margin turns a $1,000 cost into $1,350 when “marked-up” pricing is shown.
        </p>
        <label className="form-field form-field-inline">
          <span>Margin</span>
          <span className="suffix-input">
            <input
              inputMode="decimal"
              value={marginPct}
              onChange={(e) => {
                setMarginPct(e.target.value);
                setSaved(false);
              }}
            />
            <span className="suffix">%</span>
          </span>
        </label>
      </section>

      <section className="card">
        <h2>Report pricing</h2>
        <p className="card-sub">Controls how prices appear on the printable customer report.</p>

        <label className="check-row">
          <input
            type="checkbox"
            checked={showPricing}
            onChange={(e) => {
              setShowPricing(e.target.checked);
              setSaved(false);
            }}
          />
          <span>Show pricing on the report (uncheck to hide all prices &amp; totals)</span>
        </label>

        <div className="radio-group" aria-disabled={!showPricing}>
          <label className={`radio-row ${!showPricing ? 'disabled' : ''}`}>
            <input
              type="radio"
              name="priceMode"
              checked={priceMode === 'cost'}
              disabled={!showPricing}
              onChange={() => {
                setPriceMode('cost');
                setSaved(false);
              }}
            />
            <span>
              <b>My pricing (cost)</b> — show the base catalog prices you pay.
            </span>
          </label>
          <label className={`radio-row ${!showPricing ? 'disabled' : ''}`}>
            <input
              type="radio"
              name="priceMode"
              checked={priceMode === 'marked_up'}
              disabled={!showPricing}
              onChange={() => {
                setPriceMode('marked_up');
                setSaved(false);
              }}
            />
            <span>
              <b>Marked-up pricing</b> — show prices with your margin applied.
            </span>
          </label>
        </div>
      </section>

      <div className="screen-actions">
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save preferences'}
        </button>
      </div>

      <ChangePasswordCard />
    </main>
  );
}

// ~1 MB cap (matches the server). Larger files are rejected before upload.
const MAX_LOGO_BYTES = 1_000_000;

function LogoCard() {
  const user = useSession((s) => s.user);
  const setLogo = useSession((s) => s.setLogo);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const logo = user?.logo ?? '';

  function pick(file: File) {
    setMsg(null);
    if (!file.type.startsWith('image/')) {
      setMsg({ ok: false, text: 'Please choose an image file (PNG, JPG, SVG…).' });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setMsg({ ok: false, text: 'Image is too large — please use one under 1 MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      setBusy(true);
      try {
        await setLogo(dataUrl);
        setMsg({ ok: true, text: 'Logo updated. It will appear on your reports.' });
      } catch (err) {
        setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Could not save logo.' });
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function remove() {
    setMsg(null);
    setBusy(true);
    try {
      await setLogo('');
      setMsg({ ok: true, text: 'Logo removed.' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Could not remove logo.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Company logo</h2>
      <p className="card-sub">Shown at the top of the reports you generate for your customers. PNG or JPG works best.</p>
      <div className="logo-row">
        <div className="logo-preview">
          {logo ? <img src={logo} alt="Company logo" /> : <span className="logo-empty">No logo yet</span>}
        </div>
        <div className="logo-actions">
          <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Saving…' : logo ? 'Replace logo' : 'Upload logo'}
          </button>
          {logo && (
            <button className="btn-danger-ghost" onClick={remove} disabled={busy}>
              Remove
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pick(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      {msg && <div className={msg.ok ? 'ok-banner' : 'warn'} style={{ marginTop: 12 }}>{msg.text}</div>}
    </section>
  );
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next.length < 8) {
      setMsg({ ok: false, text: 'New password must be at least 8 characters.' });
      return;
    }
    if (next !== confirm) {
      setMsg({ ok: false, text: 'New passwords do not match.' });
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(current, next);
      setMsg({ ok: true, text: 'Password changed.' });
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Could not change password.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Change password</h2>
      <form onSubmit={submit}>
        {msg && <div className={msg.ok ? 'ok-banner' : 'warn'}>{msg.text}</div>}
        <div className="form-grid">
          <label className="form-field">
            <span>Current password</span>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </label>
          <label className="form-field">
            <span>New password</span>
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="form-field">
            <span>Confirm new password</span>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </label>
        </div>
        <div className="screen-actions">
          <button className="btn-ghost" type="submit" disabled={busy}>
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </form>
    </section>
  );
}
