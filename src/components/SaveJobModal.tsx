import { useEffect, useState } from 'react';
import { api, ApiError, type ApiUser } from '../api/client';
import { createLocalJob, getLocalJob, updateLocalJob } from '../state/localJobs';
import { useStore } from '../state/store';
import { useSession } from '../state/session';

export default function SaveJobModal() {
  const open = useSession((s) => s.saveJobOpen);
  const openSaveJob = useSession((s) => s.openSaveJob);
  const currentJobId = useSession((s) => s.currentJobId);
  const setCurrentJob = useSession((s) => s.setCurrentJob);
  const setScreen = useSession((s) => s.setScreen);
  const isGuest = useSession((s) => s.status === 'guest');
  const isAdmin = useSession((s) => s.user?.role === 'admin');
  const design = useStore((s) => s.design);
  const setDesignMeta = useStore((s) => s.setDesignMeta);

  const [name, setName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [updateExisting, setUpdateExisting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Admin: dealer/contractor accounts the design can be filed under.
  const [accounts, setAccounts] = useState<ApiUser[]>([]);
  const [saveToId, setSaveToId] = useState(0); // 0 = my own account
  const [savedTo, setSavedTo] = useState<string | null>(null);

  // Prefill from the current design + loaded job each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(design.name || 'Untitled Design');
    setCustomerName(design.client || '');
    setCustomerEmail('');
    setCustomerAddress('');
    setUpdateExisting(currentJobId != null);
    setSaveToId(0);
    setSavedTo(null);
    if (isGuest) {
      // Local jobs only store a name + the design itself.
      if (currentJobId != null) {
        const job = getLocalJob(currentJobId);
        if (job) setName(job.name);
      }
      return;
    }
    // Admins can save the design straight into a dealer/contractor account.
    if (isAdmin) {
      api
        .listDealers()
        .then(({ dealers }) => setAccounts(dealers.filter((d) => d.role !== 'admin' && d.active)))
        .catch(() => setAccounts([]));
    }
    // We don't have the customer fields in `design`; they live on the job row.
    // When updating an existing job, fetch them so edits don't wipe them.
    if (currentJobId != null) {
      api
        .getJob(currentJobId)
        .then(({ job }) => {
          setName(job.name);
          setCustomerName(job.customerName);
          setCustomerEmail(job.customerEmail);
          setCustomerAddress(job.customerAddress);
        })
        .catch(() => {});
    }
  }, [open, currentJobId, design.name, design.client, isGuest, isAdmin]);

  if (!open) return null;

  const saveToAccount = saveToId ? accounts.find((a) => a.id === saveToId) ?? null : null;

  async function save() {
    setError(null);
    setSavedTo(null);
    setBusy(true);
    // Keep design.client in sync with the customer name for the report cover.
    if (customerName.trim() && customerName !== design.client) setDesignMeta({ client: customerName.trim() });
    if (name.trim() && name !== design.name) setDesignMeta({ name: name.trim() });
    if (isGuest) {
      // No account — jobs are stored right in this browser.
      const jobName = name.trim() || 'Untitled Design';
      const d = useStore.getState().design;
      const saved =
        currentJobId != null && updateExisting ? (updateLocalJob(currentJobId, jobName, d) ?? createLocalJob(jobName, d)) : createLocalJob(jobName, d);
      setCurrentJob(saved.id, saved.name);
      setBusy(false);
      openSaveJob(false);
      return;
    }
    const payload = {
      name: name.trim() || 'Untitled Design',
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerAddress: customerAddress.trim(),
      design: useStore.getState().design,
    };
    try {
      if (saveToAccount) {
        // Filing under a dealer/contractor: always a new copy in THEIR account.
        // It isn't the admin's job, so don't track it as the current one.
        await api.createJob({ ...payload, userId: saveToAccount.id });
        setSavedTo(saveToAccount.companyName || saveToAccount.name);
      } else if (currentJobId != null && updateExisting) {
        const { job } = await api.updateJob(currentJobId, payload);
        setCurrentJob(job.id, job.name);
        openSaveJob(false);
        setScreen('jobs');
      } else {
        const { job } = await api.createJob(payload);
        setCurrentJob(job.id, job.name);
        openSaveJob(false);
        setScreen('jobs');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the job.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => openSaveJob(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Save job</h2>
            <p className="modal-sub">
              {isGuest
                ? 'Your job is saved right in this browser — reopen it anytime from Open job.'
                : isAdmin
                  ? 'Store this design to your account, or file it into a dealer or contractor account.'
                  : 'Store this design and its customer details to your account.'}
            </p>
          </div>
          <button className="btn-ghost" onClick={() => openSaveJob(false)}>
            ✕
          </button>
        </div>

        {error && <div className="warn">{error}</div>}
        {savedTo && (
          <div className="ok-inline">
            Saved “{name.trim() || 'Untitled Design'}” to <b>{savedTo}</b>. They'll see it in their saved jobs.
          </div>
        )}

        {isAdmin && (
          <label className="form-field" style={{ marginBottom: 10 }}>
            <span>Save to account</span>
            <select
              value={saveToId}
              onChange={(e) => {
                setSaveToId(Number(e.target.value));
                setSavedTo(null);
              }}
            >
              <option value={0}>My account (admin)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.companyName ? ` — ${a.companyName}` : ''} ({a.role})
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="form-grid">
          <label className="form-field form-field-wide">
            <span>Job name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          {!isGuest && (
            <>
              <label className="form-field">
                <span>Customer name</span>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </label>
              <label className="form-field">
                <span>Customer email</span>
                <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
              </label>
              <label className="form-field form-field-wide">
                <span>Customer address</span>
                <input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
              </label>
            </>
          )}
        </div>

        {currentJobId != null && !saveToAccount && (
          <label className="check-row">
            <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
            <span>Update the currently open job (uncheck to save as a new copy)</span>
          </label>
        )}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={() => openSaveJob(false)}>
            {savedTo ? 'Close' : 'Cancel'}
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : saveToAccount ? 'Save to account' : currentJobId != null && updateExisting ? 'Update job' : 'Save job'}
          </button>
        </div>
      </div>
    </div>
  );
}
