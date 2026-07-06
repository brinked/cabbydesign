import { useEffect, useState } from 'react';
import { api, ApiError, type JobSummary } from '../api/client';
import { deleteLocalJob, getLocalJob, listLocalJobs, renameLocalJob } from '../state/localJobs';
import { useStore } from '../state/store';
import { useSession } from '../state/session';

function fmtDate(iso: string): string {
  // SQLite datetime is 'YYYY-MM-DD HH:MM:SS' (UTC); local jobs use ISO strings.
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

/** Shared row shape for account jobs and browser-local (guest) jobs. */
interface Row {
  id: number;
  name: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  updatedAt: string;
}

export default function JobsScreen() {
  const [jobs, setJobs] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const loadDesign = useStore((s) => s.loadDesign);
  const setScreen = useSession((s) => s.setScreen);
  const setCurrentJob = useSession((s) => s.setCurrentJob);
  const openSaveJob = useSession((s) => s.openSaveJob);
  const currentJobId = useSession((s) => s.currentJobId);
  const isGuest = useSession((s) => s.status === 'guest');

  async function refresh() {
    if (isGuest) {
      setJobs(listLocalJobs().map((j) => ({ id: j.id, name: j.name, customerName: '', customerEmail: '', customerAddress: '', updatedAt: j.updatedAt })));
      return;
    }
    try {
      const { jobs } = await api.listJobs();
      setJobs(jobs as JobSummary[]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load jobs.');
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest]);

  async function openJob(j: Row) {
    if (isGuest) {
      const job = getLocalJob(j.id);
      if (!job) {
        setError('Could not open that job.');
        return;
      }
      loadDesign(job.design);
      setCurrentJob(job.id, job.name);
      setScreen('design');
      return;
    }
    try {
      const { job } = await api.getJob(j.id);
      loadDesign(job.design);
      setCurrentJob(job.id, job.name);
      setScreen('design');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open job.');
    }
  }

  async function rename(j: Row) {
    const name = prompt('Rename job', j.name);
    if (name == null || !name.trim()) return;
    if (isGuest) {
      renameLocalJob(j.id, name.trim());
      if (currentJobId === j.id) setCurrentJob(j.id, name.trim());
      refresh();
      return;
    }
    try {
      const { job } = await api.getJob(j.id);
      await api.updateJob(j.id, {
        name: name.trim(),
        customerName: j.customerName,
        customerEmail: j.customerEmail,
        customerAddress: j.customerAddress,
        design: job.design,
      });
      if (currentJobId === j.id) setCurrentJob(j.id, name.trim());
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not rename job.');
    }
  }

  async function remove(j: Row) {
    if (!confirm(`Delete “${j.name}”? This cannot be undone.`)) return;
    if (isGuest) {
      deleteLocalJob(j.id);
      if (currentJobId === j.id) setCurrentJob(null, null);
      refresh();
      return;
    }
    try {
      await api.deleteJob(j.id);
      if (currentJobId === j.id) setCurrentJob(null, null);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete job.');
    }
  }

  const shown = (jobs ?? []).filter((j) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      j.name.toLowerCase().includes(q) ||
      j.customerName.toLowerCase().includes(q) ||
      j.customerEmail.toLowerCase().includes(q)
    );
  });

  return (
    <main className="screen">
      <div className="screen-head">
        <div>
          <h1>My Jobs</h1>
          <p className="screen-sub">
            {isGuest ? 'Designs saved in this browser. Open one to keep working on it.' : 'Saved designs with customer details. Open one to keep working on it.'}
          </p>
        </div>
        <div className="screen-head-actions">
          <button className="btn-primary" onClick={() => openSaveJob(true)}>
            Save current design…
          </button>
        </div>
      </div>

      {error && <div className="warn">{error}</div>}

      <input
        className="search-input"
        placeholder={isGuest ? 'Search jobs…' : 'Search by job, customer, or email…'}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {jobs === null ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="muted">{jobs.length === 0 ? 'No saved jobs yet — use “Save job” in the designer to keep a copy of your work.' : 'No jobs match your search.'}</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Job</th>
              {!isGuest && (
                <>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Address</th>
                </>
              )}
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((j) => (
              <tr key={j.id} className={currentJobId === j.id ? 'row-active' : ''}>
                <td>
                  <b>{j.name}</b>
                  {currentJobId === j.id && <span className="pill"> open</span>}
                </td>
                {!isGuest && (
                  <>
                    <td>{j.customerName || '—'}</td>
                    <td>{j.customerEmail || '—'}</td>
                    <td>{j.customerAddress || '—'}</td>
                  </>
                )}
                <td>{fmtDate(j.updatedAt)}</td>
                <td className="row-actions">
                  <button className="btn-ghost" onClick={() => openJob(j)}>
                    Open
                  </button>
                  <button className="btn-ghost" onClick={() => rename(j)}>
                    Rename
                  </button>
                  <button className="btn-danger-ghost" onClick={() => remove(j)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
