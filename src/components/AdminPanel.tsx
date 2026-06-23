import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, type AdminJobSummary, type DealerInput, type DealerWithPrefs } from '../api/client';
import { CATALOG } from '../model/catalog';
import { useStore } from '../state/store';
import { useSession } from '../state/session';

const BLANK: DealerInput = {
  name: '',
  email: '',
  role: 'dealer',
  companyName: '',
  companySlogan: '',
  address: '',
  phone: '',
  active: true,
  taxExempt: false,
  contractorMode: 'retail_discount',
  retailDiscountPct: 0,
  ownPricing: {},
  password: '',
};

const DEFAULT_PASSWORD = 'ChangeMe123';

export default function AdminPanel() {
  const [dealers, setDealers] = useState<DealerWithPrefs[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<DealerWithPrefs | 'new' | null>(null);
  const [showDesigns, setShowDesigns] = useState(false);
  const setPricingOpen = useStore((s) => s.setPricingOpen);
  const setRetailPricingOpen = useStore((s) => s.setRetailPricingOpen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setAppliancesOpen = useStore((s) => s.setAppliancesOpen);

  async function refresh() {
    try {
      const { dealers } = await api.listDealers();
      setDealers(dealers);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load dealers.');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggleActive(d: DealerWithPrefs) {
    try {
      await api.updateDealer(d.id, { ...toInput(d), active: !d.active });
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update dealer.');
    }
  }

  async function resetPassword(d: DealerWithPrefs) {
    const pw = prompt(`New password for ${d.name} — leave blank to reset to the default (${DEFAULT_PASSWORD}):`, '');
    if (pw == null) return;
    if (pw.length > 0 && pw.length < 8) {
      alert('Password must be at least 8 characters.');
      return;
    }
    try {
      const { defaultUsed } = await api.resetDealerPassword(d.id, pw);
      alert(`Password updated for ${d.name}${defaultUsed ? ` to the default (${DEFAULT_PASSWORD})` : ''}.`);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not reset password.');
    }
  }

  async function remove(d: DealerWithPrefs) {
    if (!confirm(`Delete ${d.name} and all their saved jobs? This cannot be undone.`)) return;
    try {
      await api.deleteDealer(d.id);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete dealer.');
    }
  }

  async function viewCert(d: DealerWithPrefs) {
    try {
      const { cert } = await api.getDealerCert(d.id);
      const win = window.open();
      if (win) win.document.write(`<iframe src="${cert}" style="border:0;width:100%;height:100%"></iframe>`);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not open the certificate.');
    }
  }

  const shown = (dealers ?? []).filter((d) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return [d.name, d.email, d.companyName].some((s) => s.toLowerCase().includes(q));
  });

  return (
    <main className="screen">
      <div className="screen-head">
        <div>
          <h1>Admin — Dealers</h1>
          <p className="screen-sub">Manage who can sign in and use the design tool.</p>
        </div>
        <div className="screen-head-actions">
          <TaxRateControl />
          <button className="btn-ghost" onClick={() => setSettingsOpen(true)}>
            Cabinet size limits
          </button>
          <button className="btn-ghost" onClick={() => setPricingOpen(true)}>
            Base pricing
          </button>
          <button className="btn-ghost" onClick={() => setRetailPricingOpen(true)}>
            Retail pricing
          </button>
          <button className="btn-ghost" onClick={() => setAppliancesOpen(true)}>
            Appliances
          </button>
          <button className="btn-ghost" onClick={() => setShowDesigns(true)}>
            Saved designs
          </button>
          <button className="btn-primary" onClick={() => setEditing('new')}>
            + Add dealer
          </button>
        </div>
      </div>

      {error && <div className="warn">{error}</div>}

      <input
        className="search-input"
        placeholder="Search dealers…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {dealers === null ? (
        <p className="muted">Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Email</th>
              <th>Role</th>
              <th>Markup</th>
              <th>Tax</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((d) => (
              <tr key={d.id} className={d.active ? '' : 'row-inactive'}>
                <td>
                  <b>{d.name}</b>
                </td>
                <td>{d.companyName || '—'}</td>
                <td>{d.email}</td>
                <td>
                  {d.role === 'admin' ? (
                    <span className="pill pill-admin">admin</span>
                  ) : d.role === 'contractor' ? (
                    <span className="pill pill-admin">contractor</span>
                  ) : (
                    'dealer'
                  )}
                </td>
                <td>
                  {d.role === 'contractor'
                    ? d.prefs.contractorMode === 'own'
                      ? 'own pricing'
                      : `${d.prefs.retailDiscountPct}% off retail`
                    : d.prefs.markupMode === 'flat'
                      ? `$${d.prefs.flatAmount}`
                      : `${d.prefs.marginPct}%`}
                </td>
                <td>
                  {d.prefs.taxExempt ? <span className="pill pill-ok">exempt</span> : <span className="pill">taxed</span>}
                  {d.cert.present && (
                    <button className="link-btn" title={d.cert.name || 'View certificate'} onClick={() => viewCert(d)}>
                      cert
                    </button>
                  )}
                </td>
                <td>{d.active ? <span className="pill pill-ok">active</span> : <span className="pill">disabled</span>}</td>
                <td className="row-actions">
                  <button className="btn-ghost" onClick={() => setEditing(d)}>
                    Edit
                  </button>
                  <button className="btn-ghost" onClick={() => toggleActive(d)}>
                    {d.active ? 'Disable' : 'Enable'}
                  </button>
                  <button className="btn-ghost" onClick={() => resetPassword(d)}>
                    Reset PW
                  </button>
                  <button className="btn-danger-ghost" onClick={() => remove(d)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <DealerEditModal
          dealer={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}

      {showDesigns && <DesignsModal onClose={() => setShowDesigns(false)} />}
    </main>
  );
}

/** Admin view of every dealer's saved designs. Open one to load it (read-only)
 *  into the designer for review. */
function DesignsModal({ onClose }: { onClose: () => void }) {
  const [jobs, setJobs] = useState<AdminJobSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const loadDesign = useStore((s) => s.loadDesign);
  const setScreen = useSession((s) => s.setScreen);
  const setCurrentJob = useSession((s) => s.setCurrentJob);

  useEffect(() => {
    api
      .listAllJobs()
      .then(({ jobs }) => setJobs(jobs))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load designs.'));
  }, []);

  async function open(j: AdminJobSummary) {
    try {
      const { job } = await api.getJob(j.id);
      loadDesign(job.design);
      // Viewing a dealer's design — not the admin's own job, so don't track it
      // as the current (savable) job. Saving will create a new copy under admin.
      setCurrentJob(null, null);
      setScreen('design');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open design.');
    }
  }

  const shown = (jobs ?? []).filter((j) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      j.name.toLowerCase().includes(q) ||
      j.ownerName.toLowerCase().includes(q) ||
      j.ownerCompany.toLowerCase().includes(q) ||
      j.ownerEmail.toLowerCase().includes(q) ||
      j.customerName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Saved designs</h2>
            <p className="modal-sub">Every dealer's saved jobs. Open one to view it in the designer.</p>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && <div className="warn">{error}</div>}

        <input
          className="search-input"
          placeholder="Search by dealer, company, job, or customer…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        {jobs === null ? (
          <p className="muted">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="muted">{jobs.length === 0 ? 'No dealers have saved any designs yet.' : 'No designs match your search.'}</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Dealer</th>
                <th>Job</th>
                <th>Customer</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((j) => (
                <tr key={j.id}>
                  <td>
                    <b>{j.ownerName}</b>
                    {j.ownerCompany && <div className="muted" style={{ fontSize: 12 }}>{j.ownerCompany}</div>}
                  </td>
                  <td>{j.name}</td>
                  <td>{j.customerName || '—'}</td>
                  <td>{fmtJobDate(j.updatedAt)}</td>
                  <td className="row-actions">
                    <button className="btn-ghost" onClick={() => open(j)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function fmtJobDate(iso: string): string {
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

function TaxRateControl() {
  const taxRate = useSession((s) => s.taxRate);
  const refreshGlobals = useSession((s) => s.refreshGlobals);
  const [val, setVal] = useState(String(taxRate));
  const [busy, setBusy] = useState(false);

  async function save() {
    const rate = parseFloat(val);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      alert('Tax rate must be between 0 and 100.');
      return;
    }
    setBusy(true);
    try {
      await api.setTaxRate(rate);
      await refreshGlobals();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not save tax rate.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="tax-control" title="Global sales-tax rate applied to non-exempt dealers">
      <span>Sales tax</span>
      <input className="tax-input" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} />
      <span>%</span>
      <button className="btn-ghost" onClick={save} disabled={busy || val === String(taxRate)}>
        Save
      </button>
    </span>
  );
}

function toInput(d: DealerWithPrefs): DealerInput {
  return {
    name: d.name,
    email: d.email,
    role: d.role,
    companyName: d.companyName,
    companySlogan: d.companySlogan,
    address: d.address,
    phone: d.phone,
    active: d.active,
    taxExempt: d.prefs.taxExempt,
    contractorMode: d.prefs.contractorMode,
    retailDiscountPct: d.prefs.retailDiscountPct,
    ownPricing: d.prefs.ownPricing,
  };
}

function DealerEditModal({
  dealer,
  onClose,
  onSaved,
}: {
  dealer: DealerWithPrefs | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = dealer == null;
  const [form, setForm] = useState<DealerInput>(dealer ? toInput(dealer) : { ...BLANK });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<DealerInput>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    setError(null);
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }
    if (isNew && form.password && form.password.length < 8) {
      setError('Password must be at least 8 characters (or leave blank for the default).');
      return;
    }
    setBusy(true);
    try {
      if (isNew) await api.createDealer(form);
      else await api.updateDealer(dealer!.id, form);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save dealer.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{isNew ? 'Add dealer' : `Edit ${dealer!.name}`}</h2>
            <p className="modal-sub">Dealers sign in with their email and password.</p>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && <div className="warn">{error}</div>}

        <div className="form-grid">
          <label className="form-field">
            <span>Name</span>
            <input value={form.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
          </label>
          <label className="form-field">
            <span>Company name</span>
            <input value={form.companyName} onChange={(e) => set({ companyName: e.target.value })} />
          </label>
          <label className="form-field">
            <span>Company slogan</span>
            <input value={form.companySlogan} onChange={(e) => set({ companySlogan: e.target.value })} />
          </label>
          <label className="form-field form-field-wide">
            <span>Address</span>
            <input value={form.address} onChange={(e) => set({ address: e.target.value })} />
          </label>
          <label className="form-field">
            <span>Phone</span>
            <input value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
          </label>
          <label className="form-field">
            <span>Role</span>
            <select value={form.role} onChange={(e) => set({ role: e.target.value as DealerInput['role'] })}>
              <option value="dealer">Dealer</option>
              <option value="contractor">Contractor</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {isNew && (
            <label className="form-field">
              <span>Initial password</span>
              <input
                type="text"
                value={form.password ?? ''}
                onChange={(e) => set({ password: e.target.value })}
                placeholder={`blank = ${DEFAULT_PASSWORD}`}
              />
            </label>
          )}
        </div>

        <label className="check-row">
          <input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} />
          <span>Active (can sign in)</span>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={form.taxExempt} onChange={(e) => set({ taxExempt: e.target.checked })} />
          <span>Tax exempt (no sales tax on this dealer's orders)</span>
        </label>
        {form.role === 'contractor' && <ContractorPricing form={form} set={set} />}
        {!isNew && dealer!.cert.present && (
          <p className="card-sub" style={{ marginTop: 8 }}>
            Resale certificate on file: <b>{dealer!.cert.name || 'certificate'}</b>.{' '}
            <button
              className="link-btn"
              onClick={async () => {
                try {
                  const { cert } = await api.getDealerCert(dealer!.id);
                  const win = window.open();
                  if (win) win.document.write(`<iframe src="${cert}" style="border:0;width:100%;height:100%"></iframe>`);
                } catch {
                  /* ignore */
                }
              }}
            >
              View
            </button>
          </p>
        )}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : isNew ? 'Create dealer' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Contractor pricing config inside the dealer edit modal (admin-controlled). */
function ContractorPricing({ form, set }: { form: DealerInput; set: (patch: Partial<DealerInput>) => void }) {
  const rows = useMemo(() => CATALOG.filter((c) => c.category !== 'appliance' && !c.perInch), []);
  return (
    <div className="card" style={{ marginTop: 12, padding: 12 }}>
      <h2 style={{ fontSize: 15 }}>Contractor pricing</h2>
      <div className="seg" style={{ maxWidth: 360, marginTop: 8 }}>
        <button
          className={form.contractorMode === 'retail_discount' ? 'seg-btn active' : 'seg-btn'}
          onClick={() => set({ contractorMode: 'retail_discount' })}
        >
          % off retail
        </button>
        <button
          className={form.contractorMode === 'own' ? 'seg-btn active' : 'seg-btn'}
          onClick={() => set({ contractorMode: 'own' })}
        >
          Their own pricing
        </button>
      </div>
      {form.contractorMode === 'retail_discount' ? (
        <label className="form-field form-field-inline" style={{ marginTop: 10 }}>
          <span>Discount off retail</span>
          <span className="suffix-input">
            <input
              inputMode="decimal"
              value={String(form.retailDiscountPct)}
              onChange={(e) => set({ retailDiscountPct: parseFloat(e.target.value) || 0 })}
            />
            <span className="suffix">%</span>
          </span>
        </label>
      ) : (
        <div className="pricing-table" style={{ marginTop: 10, maxHeight: '38vh', overflowY: 'auto' }}>
          <div className="pricing-row pricing-head" style={{ gridTemplateColumns: '1fr 2fr' }}>
            <span>Cabinet</span>
            <span>Formula (blank = retail)</span>
          </div>
          {rows.map((c) => (
            <div className="pricing-row" key={c.id} style={{ gridTemplateColumns: '1fr 2fr' }}>
              <span className="pricing-name">{c.name}</span>
              <input
                className="formula-input"
                value={form.ownPricing[c.id] ?? ''}
                placeholder={c.formula}
                spellCheck={false}
                onChange={(e) => set({ ownPricing: { ...form.ownPricing, [c.id]: e.target.value } })}
              />
            </div>
          ))}
        </div>
      )}
      <p className="card-sub" style={{ marginTop: 8 }}>
        {form.contractorMode === 'retail_discount'
          ? 'Contractor pays the admin Retail price minus this %. Set retail prices via "Retail pricing" in the header.'
          : "Contractor uses these per-cabinet formulas (W, D, H in inches); blank falls back to the retail price."}
      </p>
    </div>
  );
}
