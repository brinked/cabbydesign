import { useState } from 'react';
import { api, ApiError } from '../api/client';

/** Shown when the URL carries a ?reset=<token> param (from the reset email).
 *  Lets the user set a new password, then returns them to the login screen. */
export default function ResetPassword({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Is it running?');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="brand login-brand">
          Cab<span>Design</span>
        </div>
        <p className="login-sub">Choose a new password</p>
        {error && <div className="warn">{error}</div>}
        {done ? (
          <>
            <p className="login-foot" style={{ marginTop: 0 }}>
              ✅ Your password has been updated. You can now sign in with your new password.
            </p>
            <button type="button" className="btn-primary login-btn" onClick={onDone}>
              Go to sign in
            </button>
          </>
        ) : (
          <>
            <label className="login-field">
              <span>New password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
              />
            </label>
            <label className="login-field">
              <span>Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </label>
            <button className="btn-primary login-btn" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Set new password'}
            </button>
            <button type="button" className="link-btn" onClick={onDone}>
              Cancel
            </button>
          </>
        )}
      </form>
    </div>
  );
}
