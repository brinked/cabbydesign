import { useState } from 'react';
import { api, ApiError, type OrderInput, type OrderLine } from '../api/client';
import type { Design } from '../model/types';

/** Modal for submitting a project to EXT Cabinets for review. Collects customer
 *  details + notes, then emails the order (with the design attached). */
export default function SubmitOrderModal({
  design,
  lines,
  total,
  showPricing,
  onClose,
}: {
  design: Design;
  lines: OrderLine[];
  total: string;
  showPricing: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(design.client || '');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setStatus('sending');
    setError(null);
    const input: OrderInput = {
      projectName: design.name || 'Untitled Design',
      notes,
      customer: { name, email, address },
      showPricing,
      total,
      lines,
      design,
    };
    try {
      await api.submitOrder(input);
      setStatus('done');
    } catch (e) {
      setStatus('idle');
      setError(e instanceof ApiError ? e.message : 'Could not submit the order. Please try again.');
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>Submit order for review</h2>
            <p className="modal-sub">Sends this design to EXT Cabinets along with the customer details below.</p>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        {status === 'done' ? (
          <div style={{ padding: '8px 4px' }}>
            <p>✅ Your order for <b>{design.name || 'Untitled Design'}</b> has been submitted. The EXT Cabinets team will review it and follow up by email.</p>
            <div className="modal-actions">
              <button className="btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="form-grid">
              <label className="form-field">
                <span>Customer name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" />
              </label>
              <label className="form-field">
                <span>Customer email</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
              </label>
              <label className="form-field form-field-wide">
                <span>Customer address</span>
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, state" />
              </label>
              <label className="form-field form-field-wide">
                <span>Notes for EXT Cabinets</span>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything we should know — timeline, special requests, questions…"
                />
              </label>
            </div>
            <p className="modal-sub" style={{ marginTop: 4 }}>
              {lines.length} line item{lines.length === 1 ? '' : 's'} will be included{showPricing && total ? ` · total ${total}` : ''}. The full design file is attached automatically.
            </p>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <div className="modal-actions">
              <button className="btn-ghost" onClick={onClose} disabled={status === 'sending'}>
                Cancel
              </button>
              <button className="btn-primary" onClick={submit} disabled={status === 'sending'}>
                {status === 'sending' ? 'Submitting…' : 'Submit order'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
