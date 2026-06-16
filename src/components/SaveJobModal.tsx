import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useStore } from '../state/store';
import { useSession } from '../state/session';

export default function SaveJobModal() {
  const open = useSession((s) => s.saveJobOpen);
  const openSaveJob = useSession((s) => s.openSaveJob);
  const currentJobId = useSession((s) => s.currentJobId);
  const setCurrentJob = useSession((s) => s.setCurrentJob);
  const setScreen = useSession((s) => s.setScreen);
  const design = useStore((s) => s.design);
  const setDesignMeta = useStore((s) => s.setDesignMeta);

  const [name, setName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [updateExisting, setUpdateExisting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Prefill from the current design + loaded job each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(design.name || 'Untitled Design');
    setCustomerName(design.client || '');
    setCustomerEmail('');
    setCustomerAddress('');
    setUpdateExisting(currentJobId != null);
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
  }, [open, currentJobId, design.name, design.client]);

  if (!open) return null;

  async function save() {
    setError(null);
    setBusy(true);
    // Keep design.client in sync with the customer name for the report cover.
    if (customerName.trim() && customerName !== design.client) setDesignMeta({ client: customerName.trim() });
    if (name.trim() && name !== design.name) setDesignMeta({ name: name.trim() });
    const payload = {
      name: name.trim() || 'Untitled Design',
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerAddress: customerAddress.trim(),
      design: useStore.getState().design,
    };
    try {
      if (currentJobId != null && updateExisting) {
        const { job } = await api.updateJob(currentJobId, payload);
        setCurrentJob(job.id, job.name);
      } else {
        const { job } = await api.createJob(payload);
        setCurrentJob(job.id, job.name);
      }
      openSaveJob(false);
      setScreen('jobs');
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
            <p className="modal-sub">Store this design and its customer details to your account.</p>
          </div>
          <button className="btn-ghost" onClick={() => openSaveJob(false)}>
            ✕
          </button>
        </div>

        {error && <div className="warn">{error}</div>}

        <div className="form-grid">
          <label className="form-field">
            <span>Job name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
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
        </div>

        {currentJobId != null && (
          <label className="check-row">
            <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
            <span>Update the currently open job (uncheck to save as a new copy)</span>
          </label>
        )}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={() => openSaveJob(false)}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : currentJobId != null && updateExisting ? 'Update job' : 'Save job'}
          </button>
        </div>
      </div>
    </div>
  );
}
