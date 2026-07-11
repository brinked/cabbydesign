import { useState } from 'react';
import { api, ApiError, type AccountType } from '../api/client';
import { useSession } from '../state/session';

/**
 * Sign in / create account dialog for consumers. Opens whenever
 * session.authPrompt is set (e.g. a guest hits Save job or Download PDF).
 * Account types: Homeowner (design & save) and Cabinet Company (can also
 * customize which cabinets, handles and finishes their team sees).
 */
export default function AuthModal() {
  const prompt = useSession((s) => s.authPrompt);
  const closeAuth = useSession((s) => s.closeAuth);
  const login = useSession((s) => s.login);
  const signup = useSession((s) => s.signup);

  const [mode, setMode] = useState<'signin' | 'signup' | 'verify-sent' | 'forgot' | 'forgot-sent'>('signin');
  const [accountType, setAccountType] = useState<AccountType>('homeowner');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  if (!prompt) return null;

  const close = () => {
    setMode('signin');
    setError(null);
    closeAuth();
  };

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      if (err instanceof ApiError && err.message.includes('verify')) {
        setMode('verify-sent');
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not reach the server. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function doSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      const needsVerify = await signup({
        name: name.trim(),
        email: email.trim(),
        password,
        accountType,
        companyName: accountType === 'company' ? companyName.trim() : '',
      });
      if (needsVerify) setMode('verify-sent');
      // else: signed straight in — authPrompt already cleared by the store
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function doForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.forgotPassword(email.trim());
      setMode('forgot-sent');
    } catch {
      setMode('forgot-sent');
    } finally {
      setBusy(false);
    }
  }

  const field = (label: string, value: string, setV: (v: string) => void, type = 'text', placeholder = '') => (
    <label className="form-field form-field-wide">
      <span>{label}</span>
      <input type={type} value={value} onChange={(e) => setV(e.target.value)} placeholder={placeholder} required />
    </label>
  );

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{mode === 'signup' ? 'Create your free account' : mode === 'verify-sent' ? 'Check your email' : mode.startsWith('forgot') ? 'Reset password' : 'Sign in'}</h2>
            <p className="modal-sub">{mode === 'signin' || mode === 'signup' ? prompt : ''}</p>
          </div>
          <button className="btn-ghost" onClick={close}>
            ✕
          </button>
        </div>

        {mode === 'verify-sent' && (
          <div style={{ padding: '4px 2px' }}>
            <p>
              📬 We sent a verification link to <b>{email.trim()}</b>. Click it to activate your account — then come right back,
              your design will be waiting.
            </p>
            <div className="modal-actions">
              <button
                className="btn-ghost"
                disabled={busy || resent}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api.resendVerify(email.trim());
                    setResent(true);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {resent ? 'Sent again ✓' : 'Resend email'}
              </button>
              <button className="btn-primary" onClick={close}>
                Done
              </button>
            </div>
          </div>
        )}

        {mode === 'forgot-sent' && (
          <div style={{ padding: '4px 2px' }}>
            <p>If an account exists for <b>{email.trim()}</b>, a reset link is on its way (valid 1 hour).</p>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => setMode('signin')}>
                Back to sign in
              </button>
            </div>
          </div>
        )}

        {mode === 'forgot' && (
          <form onSubmit={doForgot}>
            <div className="form-grid">{field('Email', email, setEmail, 'email', 'name@example.com')}</div>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setMode('signin')}>
                Back
              </button>
              <button className="btn-primary" type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
            </div>
          </form>
        )}

        {mode === 'signin' && (
          <form onSubmit={doLogin}>
            {error && <div className="warn">{error}</div>}
            <div className="form-grid">
              {field('Email', email, setEmail, 'email', 'name@example.com')}
              {field('Password', password, setPassword, 'password')}
            </div>
            <div className="modal-actions">
              <button type="button" className="link-btn" onClick={() => setMode('forgot')}>
                Forgot password?
              </button>
              <button className="btn-primary" type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </div>
            <p className="login-foot" style={{ marginTop: 10 }}>
              New here?{' '}
              <button type="button" className="link-btn" onClick={() => { setMode('signup'); setError(null); }}>
                Create a free account
              </button>
            </p>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={doSignup}>
            {error && <div className="warn">{error}</div>}
            <div className="auth-type-row">
              <button
                type="button"
                className={`auth-type ${accountType === 'homeowner' ? 'auth-type-active' : ''}`}
                onClick={() => setAccountType('homeowner')}
              >
                <b>🏠 Homeowner</b>
                <span>Design your own kitchen, save projects & download plans.</span>
              </button>
              <button
                type="button"
                className={`auth-type ${accountType === 'company' ? 'auth-type-active' : ''}`}
                onClick={() => setAccountType('company')}
              >
                <b>🏢 Cabinet Company</b>
                <span>Everything homeowners get, plus control which cabinets, handles & finishes appear.</span>
              </button>
            </div>
            <div className="form-grid">
              {field('Your name', name, setName)}
              {accountType === 'company' && field('Company name', companyName, setCompanyName)}
              {field('Email', email, setEmail, 'email', 'name@example.com')}
              {field('Password (8+ characters)', password, setPassword, 'password')}
            </div>
            <div className="modal-actions">
              <button type="button" className="link-btn" onClick={() => { setMode('signin'); setError(null); }}>
                I already have an account
              </button>
              <button className="btn-primary" type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
