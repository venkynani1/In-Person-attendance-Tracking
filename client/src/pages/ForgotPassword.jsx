import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ClipboardCheck, Copy, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { authAPI, getApiError } from '../services/api.js';

function ForgotPassword() {
  const { user } = useAuth();
  const [username, setUsername] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setResetLink('');
    setCopied(false);

    try {
      setSubmitting(true);
      const response = await authAPI.forgotPassword({ username });
      const appUrl = window.location.origin;
      setResetLink(`${appUrl}/reset-password?token=${encodeURIComponent(response.data.token)}`);
    } catch (err) {
      setError(getApiError(err, 'Could not verify this account.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyResetLink() {
    if (!resetLink) return;

    await navigator.clipboard.writeText(resetLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-heading">
          <span className="brand-mark" aria-hidden="true">
            <ClipboardCheck size={22} />
          </span>
          <div>
            <p className="eyebrow">Account Recovery</p>
            <h1>Forgot password</h1>
            <p className="auth-tagline">Generate a secure reset link for approved accounts.</p>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}
        {resetLink && (
          <div className="alert success">
            <p>Use this reset link (valid for 15 minutes):</p>
            <div className="copy-row">
              <input value={resetLink} readOnly aria-label="Reset password link" />
              <button className="icon-button" type="button" onClick={copyResetLink} title="Copy reset link">
                <Copy size={18} aria-hidden="true" />
                <span className="sr-only">Copy reset link</span>
              </button>
            </div>
            {copied && <p className="auth-tagline">Copied!</p>}
          </div>
        )}

        <form className="form-panel public-form" onSubmit={handleSubmit}>
          <label>
            <span>Username</span>
            <input
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <button className="button button-primary full" type="submit" disabled={submitting}>
            <KeyRound size={18} aria-hidden="true" />
            {submitting ? 'Checking...' : 'Continue'}
          </button>
        </form>

        <p className="auth-footnote">
          Remembered it? <Link to="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}

export default ForgotPassword;
