import { useState } from 'react';
import { api } from '../api/client';
import { ApiError, useSession } from '../state/session';

export default function Login() {
  const login = useSession((s) => s.login);
  const continueAsGuest = useSession((s) => s.continueAsGuest);
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Is it running?');
    } finally {
      setBusy(false);
    }
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Is it running?');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'forgot') {
    return (
      <div className="login-screen">
        <form className="login-card" onSubmit={sendReset}>
          <div className="brand login-brand">
            Cab<span>Design</span>
          </div>
          <p className="login-sub">Reset your password</p>
          {error && <div className="warn">{error}</div>}
          {sent ? (
            <>
              <p className="login-foot" style={{ marginTop: 0 }}>
                If an account exists for <b>{email.trim()}</b>, a reset link is on its way. Check your inbox (and spam) — the
                link expires in 1 hour.
              </p>
              <button
                type="button"
                className="btn-primary login-btn"
                onClick={() => {
                  setMode('login');
                  setSent(false);
                }}
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <label className="login-field">
                <span>Email</span>
                <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
              </label>
              <button className="btn-primary login-btn" type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
              <button type="button" className="link-btn" onClick={() => setMode('login')}>
                Back to sign in
              </button>
            </>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="brand login-brand">
          Cab<span>Design</span>
        </div>
        <p className="login-sub">Design your dream indoor or outdoor kitchen</p>
        <button
          type="button"
          className="btn-primary login-btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await continueAsGuest();
            } finally {
              setBusy(false);
            }
          }}
        >
          Start designing — no account needed
        </button>
        <p className="login-foot" style={{ marginTop: 4, marginBottom: 14 }}>
          Build with EXT custom HDPE cabinets or NewAge Products modular outdoor kitchens (stainless steel &amp; aluminum), see
          live pricing, and print your plan. Your design saves in this browser.
        </p>
        <p className="login-sub" style={{ marginTop: 0 }}>
          Dealer / pro sign in
        </p>
        {error && <div className="warn">{error}</div>}
        <label className="login-field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
          />
        </label>
        <label className="login-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button className="btn-primary login-btn" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" className="link-btn" onClick={() => { setMode('forgot'); setError(null); }}>
          Forgot password?
        </button>
        <p className="login-foot">Dealer access is managed by your CabDesign administrator.</p>
      </form>
    </div>
  );
}
