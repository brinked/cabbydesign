import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { useSession } from '../state/session';

/** Account settings for signed-in users: profile details, email change
 *  (password-confirmed, re-verified for consumer accounts) and password. */
export default function AccountScreen() {
  const user = useSession((s) => s.user);
  const updateAccount = useSession((s) => s.updateAccount);
  const changeEmail = useSession((s) => s.changeEmail);
  const isCompany = user?.role === 'company';

  // details
  const [name, setName] = useState(user?.name ?? '');
  const [companyName, setCompanyName] = useState(user?.companyName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [detailsMsg, setDetailsMsg] = useState<string | null>(null);
  const [detailsErr, setDetailsErr] = useState<string | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);

  // email
  const [newEmail, setNewEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [savingEmail, setSavingEmail] = useState(false);

  // password
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  if (!user) return null;

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setDetailsErr(null);
    setDetailsMsg(null);
    setSavingDetails(true);
    try {
      await updateAccount({ name: name.trim(), companyName: companyName.trim(), phone: phone.trim(), address: address.trim() });
      setDetailsMsg('Details saved.');
    } catch (err) {
      setDetailsErr(err instanceof ApiError ? err.message : 'Could not save. Please try again.');
    } finally {
      setSavingDetails(false);
    }
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailErr(null);
    setEmailMsg(null);
    setSavingEmail(true);
    try {
      const needsVerify = await changeEmail(emailPw, newEmail.trim());
      setEmailMsg(
        needsVerify
          ? `Email updated to ${newEmail.trim()}. We sent a verification link to the new address — you'll need it the next time you sign in.`
          : `Email updated to ${newEmail.trim()}.`
      );
      setNewEmail('');
      setEmailPw('');
    } catch (err) {
      setEmailErr(err instanceof ApiError ? err.message : 'Could not update the email. Please try again.');
    } finally {
      setSavingEmail(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwErr(null);
    setPwMsg(null);
    if (newPw.length < 8) {
      setPwErr('New password must be at least 8 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwErr('New passwords do not match.');
      return;
    }
    setSavingPw(true);
    try {
      await api.changePassword(curPw, newPw);
      setPwMsg('Password changed.');
      setCurPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      setPwErr(err instanceof ApiError ? err.message : 'Could not change the password. Please try again.');
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <main className="screen screen-narrow">
      <div className="screen-head">
        <div>
          <h1>Account</h1>
          <p className="screen-sub">
            Signed in as <b>{user.email}</b>
            {isCompany ? ' · Cabinet Company account' : user.role === 'homeowner' ? ' · Homeowner account' : ''}
          </p>
        </div>
      </div>

      <form className="card account-card" onSubmit={saveDetails}>
        <h2>Your details</h2>
        {detailsErr && <div className="warn">{detailsErr}</div>}
        {detailsMsg && <div className="ok-inline">{detailsMsg}</div>}
        <div className="form-grid">
          <label className="form-field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          {isCompany && (
            <label className="form-field">
              <span>Company name</span>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </label>
          )}
          <label className="form-field">
            <span>Phone</span>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" />
          </label>
          <label className="form-field form-field-wide">
            <span>Address</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, state, ZIP" />
          </label>
        </div>
        <div className="account-actions">
          <button className="btn-primary" type="submit" disabled={savingDetails}>
            {savingDetails ? 'Saving…' : 'Save details'}
          </button>
        </div>
      </form>

      <form className="card account-card" onSubmit={saveEmail}>
        <h2>Email address</h2>
        <p className="card-sub">
          {user.role === 'homeowner' || user.role === 'company'
            ? 'Changing your email sends a verification link to the new address; you stay signed in, and the link is required at your next sign-in.'
            : 'Your sign-in email.'}
        </p>
        {emailErr && <div className="warn">{emailErr}</div>}
        {emailMsg && <div className="ok-inline">{emailMsg}</div>}
        <div className="form-grid">
          <label className="form-field">
            <span>New email</span>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={user.email} required />
          </label>
          <label className="form-field">
            <span>Current password</span>
            <input type="password" autoComplete="current-password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} required />
          </label>
        </div>
        <div className="account-actions">
          <button className="btn-primary" type="submit" disabled={savingEmail}>
            {savingEmail ? 'Updating…' : 'Update email'}
          </button>
        </div>
      </form>

      <form className="card account-card" onSubmit={savePassword}>
        <h2>Password</h2>
        {pwErr && <div className="warn">{pwErr}</div>}
        {pwMsg && <div className="ok-inline">{pwMsg}</div>}
        <div className="form-grid">
          <label className="form-field form-field-wide">
            <span>Current password</span>
            <input type="password" autoComplete="current-password" value={curPw} onChange={(e) => setCurPw(e.target.value)} required />
          </label>
          <label className="form-field">
            <span>New password (8+ characters)</span>
            <input type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
          </label>
          <label className="form-field">
            <span>Confirm new password</span>
            <input type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
          </label>
        </div>
        <div className="account-actions">
          <button className="btn-primary" type="submit" disabled={savingPw}>
            {savingPw ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </form>
    </main>
  );
}
