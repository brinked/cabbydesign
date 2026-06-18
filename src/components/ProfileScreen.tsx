import { useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useSession } from '../state/session';

export default function ProfileScreen() {
  const user = useSession((s) => s.user);
  const prefs = useSession((s) => s.prefs);
  const setPrefs = useSession((s) => s.setPrefs);
  const taxRate = useSession((s) => s.taxRate);

  const [marginPct, setMarginPct] = useState(String(prefs?.marginPct ?? 0));
  const [markupMode, setMarkupMode] = useState<'percent' | 'flat'>(prefs?.markupMode ?? 'percent');
  const [flatAmount, setFlatAmount] = useState(String(prefs?.flatAmount ?? 0));
  const [showPricing, setShowPricing] = useState(prefs?.showPricing ?? true);
  const [priceMode, setPriceMode] = useState<'cost' | 'marked_up'>(prefs?.priceMode ?? 'marked_up');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const taxExempt = prefs?.taxExempt ?? false;

  const dirty = () => setSaved(false);

  async function save() {
    setError(null);
    setSaved(false);
    const margin = parseFloat(marginPct);
    const flat = parseFloat(flatAmount);
    if (markupMode === 'percent' && (Number.isNaN(margin) || margin < 0)) {
      setError('Enter a valid margin percentage (0 or more).');
      return;
    }
    if (markupMode === 'flat' && (Number.isNaN(flat) || flat < 0)) {
      setError('Enter a valid flat dollar amount (0 or more).');
      return;
    }
    setBusy(true);
    try {
      await setPrefs({
        ...prefs!,
        marginPct: Number.isNaN(margin) ? 0 : margin,
        flatAmount: Number.isNaN(flat) ? 0 : flat,
        markupMode,
        showPricing,
        priceMode,
        taxExempt, // ignored by the server (admin-only) but kept for the type
      });
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

      {user?.role === 'contractor' ? (
        <section className="card">
          <h2>Pricing</h2>
          <p className="card-sub">Your pricing is set by your administrator.</p>
          <p style={{ marginTop: 8 }}>
            {prefs?.contractorMode === 'own' ? (
              <b>Custom pricing</b>
            ) : (
              <>
                <b>{prefs?.retailDiscountPct ?? 0}% off retail</b>
              </>
            )}
          </p>
        </section>
      ) : (
      <section className="card">
        <h2>Markup</h2>
        <p className="card-sub">How your selling price is calculated from cost when “marked-up” pricing is shown.</p>
        <div className="seg" style={{ maxWidth: 360, marginTop: 12 }}>
          <button
            className={markupMode === 'percent' ? 'seg-btn active' : 'seg-btn'}
            onClick={() => {
              setMarkupMode('percent');
              dirty();
            }}
          >
            Percentage
          </button>
          <button
            className={markupMode === 'flat' ? 'seg-btn active' : 'seg-btn'}
            onClick={() => {
              setMarkupMode('flat');
              dirty();
            }}
          >
            Flat $ per cabinet
          </button>
        </div>
        {markupMode === 'percent' ? (
          <label className="form-field form-field-inline">
            <span>Margin</span>
            <span className="suffix-input">
              <input
                inputMode="decimal"
                value={marginPct}
                onChange={(e) => {
                  setMarginPct(e.target.value);
                  dirty();
                }}
              />
              <span className="suffix">%</span>
            </span>
          </label>
        ) : (
          <label className="form-field form-field-inline">
            <span>Flat markup</span>
            <span className="suffix-input">
              <span className="suffix">$</span>
              <input
                inputMode="decimal"
                value={flatAmount}
                onChange={(e) => {
                  setFlatAmount(e.target.value);
                  dirty();
                }}
              />
              <span className="suffix">/ cabinet</span>
            </span>
          </label>
        )}
        <p className="card-sub" style={{ marginTop: 10 }}>
          {markupMode === 'percent'
            ? 'Example: a 35% margin turns a $1,000 cabinet into $1,350.'
            : 'Example: a $200 flat markup adds $200 to each cabinet line.'}
        </p>
      </section>
      )}

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
              <b>Marked-up pricing</b> — show prices with your markup applied.
            </span>
          </label>
        </div>
        <p className="card-sub" style={{ marginTop: 12 }}>
          Sales tax:{' '}
          {taxExempt ? (
            <b>Exempt</b>
          ) : (
            <>
              <b>{taxRate}%</b> is added to marked-up totals
            </>
          )}
          . {taxExempt ? 'Your account is marked tax-exempt by the administrator.' : 'Upload your resale certificate below if you should be exempt.'}
        </p>
      </section>

      <div className="screen-actions">
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save preferences'}
        </button>
      </div>

      <ResaleCertCard />
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

const MAX_CERT_BYTES = 3_000_000;

function ResaleCertCard() {
  const cert = useSession((s) => s.cert);
  const setCert = useSession((s) => s.setCert);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function pick(file: File) {
    setMsg(null);
    const okType = file.type === 'application/pdf' || file.type.startsWith('image/');
    if (!okType) {
      setMsg({ ok: false, text: 'Please upload a PDF or image.' });
      return;
    }
    if (file.size > MAX_CERT_BYTES) {
      setMsg({ ok: false, text: 'File is too large — please use one under 3 MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(true);
      try {
        await setCert(String(reader.result), file.name);
        setMsg({ ok: true, text: 'Certificate uploaded. Your administrator can review it.' });
      } catch (err) {
        setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Could not upload certificate.' });
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function view() {
    try {
      const { cert: data } = await api.getCert();
      const w = window.open();
      if (w) w.document.write(`<iframe src="${data}" style="border:0;width:100%;height:100%"></iframe>`);
    } catch {
      setMsg({ ok: false, text: 'Could not open the certificate.' });
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await setCert('', '');
      setMsg({ ok: true, text: 'Certificate removed.' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Could not remove certificate.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Resale tax certificate</h2>
      <p className="card-sub">
        Upload your resale/exemption certificate (PDF or image). Your administrator reviews it before marking your
        account tax-exempt.
      </p>
      <div className="logo-row">
        <div className="cert-status">
          {cert?.present ? (
            <>
              <span className="pill pill-ok">on file</span>
              <span className="cert-name">{cert.name || 'certificate'}</span>
            </>
          ) : (
            <span className="logo-empty">No certificate uploaded</span>
          )}
        </div>
        <div className="logo-actions">
          <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Saving…' : cert?.present ? 'Replace' : 'Upload'}
          </button>
          {cert?.present && (
            <>
              <button className="btn-ghost" onClick={view} disabled={busy}>
                View
              </button>
              <button className="btn-danger-ghost" onClick={remove} disabled={busy}>
                Remove
              </button>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
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
