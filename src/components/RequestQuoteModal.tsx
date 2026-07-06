import { useState } from 'react';
import { api, ApiError, type OrderLine, type QuoteInput } from '../api/client';
import type { Design } from '../model/types';
import { buildReportPdf } from './reportPdf';

/**
 * Consumer lead-capture modal. Two variants:
 *  - 'quote': "Request a free quote" — sends the design to EXT Cabinets.
 *  - 'design': gates the PDF download — the design report is emailed to the
 *    customer (with an opt-in for a proposal & estimate), and EXT gets the lead.
 * Name, email, phone and address are required in both.
 */
export default function RequestQuoteModal({
  design,
  lines,
  total,
  variant = 'quote',
  onClose,
}: {
  design: Design;
  lines: OrderLine[];
  total: string;
  variant?: 'quote' | 'design';
  onClose: () => void;
}) {
  const [name, setName] = useState(design.client || '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [wantsProposal, setWantsProposal] = useState(true);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [copySent, setCopySent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDesign = variant === 'design';

  function validate(): string | null {
    if (!name.trim()) return 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address.';
    if (phone.trim().replace(/\D/g, '').length < 7) return 'Please enter a valid phone number.';
    if (!address.trim()) return 'Please enter your address.';
    return null;
  }

  async function submit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setStatus('sending');
    setError(null);
    // Snapshot the report as a PDF so the emails include a readable copy of
    // the design; the request still goes out if generation fails.
    const pdf = await buildReportPdf(lines);
    const input: QuoteInput = {
      projectName: design.name || 'Untitled Design',
      contact: { name: name.trim(), email: email.trim(), phone: phone.trim(), address: address.trim() },
      notes,
      total,
      lines,
      design,
      pdf: pdf ?? undefined,
      sendCopy: isDesign,
      wantsProposal: isDesign ? wantsProposal : undefined,
    };
    try {
      const res = await api.requestQuote(input);
      setCopySent(!!res.copySent);
      setStatus('done');
    } catch (e) {
      setStatus('idle');
      setError(e instanceof ApiError ? e.message : 'Could not send your request. Please check your connection and try again.');
    }
  }

  const doneMessage = isDesign ? (
    copySent ? (
      <p>
        ✅ Your design has been emailed to you at <b>{email.trim()}</b>.
        {wantsProposal && <> Additionally, someone from EXT Cabinets will reach out to you regarding your project with a proposal.</>}
      </p>
    ) : (
      <p>
        ✅ We've received your design <b>{design.name || 'Untitled Design'}</b>. Someone from EXT Cabinets will reach out to you at{' '}
        <b>{email.trim()}</b> regarding your project.
      </p>
    )
  ) : (
    <p>
      ✅ Thanks, {name.trim() || 'friend'}! Your design <b>{design.name || 'Untitled Design'}</b> is on its way to our team. We'll
      email you at <b>{email.trim()}</b> with your quote.
    </p>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{isDesign ? 'Get your design PDF' : 'Request a free quote'}</h2>
            <p className="modal-sub">
              {isDesign
                ? 'Enter your details and we’ll email your design report (PDF) straight to your inbox.'
                : 'Send your design to EXT Cabinets — we’ll review it and get back to you with a quote.'}
            </p>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        {status === 'done' ? (
          <div style={{ padding: '8px 4px' }}>
            {doneMessage}
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
                <span>Your name *</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus />
              </label>
              <label className="form-field">
                <span>Email *</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
              </label>
              <label className="form-field">
                <span>Phone *</span>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
              </label>
              <label className="form-field">
                <span>Address *</span>
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, state, ZIP" />
              </label>
              <label className="form-field form-field-wide">
                <span>Anything we should know? (optional)</span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Timeline, questions, special requests…"
                />
              </label>
            </div>
            {isDesign && (
              <label className="check-row" style={{ marginTop: 10 }}>
                <input type="checkbox" checked={wantsProposal} onChange={(e) => setWantsProposal(e.target.checked)} />
                <span>Yes, please also send me a proposal and estimate based off my design.</span>
              </label>
            )}
            <p className="modal-sub" style={{ marginTop: 4 }}>
              {isDesign
                ? `Your design report (${lines.length} item${lines.length === 1 ? '' : 's'}, plan & elevations) will be emailed as a PDF.`
                : `${lines.length} line item${lines.length === 1 ? '' : 's'} will be included${total ? ` · estimated total ${total}` : ''}. Your design file is attached automatically.`}
            </p>
            {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
            <div className="modal-actions">
              <button className="btn-ghost" onClick={onClose} disabled={status === 'sending'}>
                Cancel
              </button>
              <button className="btn-primary" onClick={submit} disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending…' : isDesign ? 'Email me my design' : 'Request quote'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
