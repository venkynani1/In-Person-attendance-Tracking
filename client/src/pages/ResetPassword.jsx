import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { authAPI, getApiError } from '../services/api.js';

const initialForm = {
  newPassword: '',
  confirmPassword: ''
};

function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (user) {
    return <Navigate to="/" replace />;
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or expired token');
      return;
    }

    if (form.newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      await authAPI.resetPassword({
        token,
        newPassword: form.newPassword
      });
      navigate('/login', {
        replace: true,
        state: { message: 'Password updated successfully. Please login.' }
      });
    } catch (err) {
      setError(getApiError(err, 'Could not reset password.'));
    } finally {
      setSubmitting(false);
    }
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
            <h1>Reset password</h1>
            <p className="auth-tagline">Create a new password using your secure reset token.</p>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}

        <form className="form-panel public-form" onSubmit={handleSubmit}>
          <label>
            <span>New Password</span>
            <input
              name="newPassword"
              type="password"
              value={form.newPassword}
              onChange={updateField}
              autoComplete="new-password"
              minLength="6"
              required
            />
          </label>
          <label>
            <span>Confirm Password</span>
            <input
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={updateField}
              autoComplete="new-password"
              minLength="6"
              required
            />
          </label>
          <button className="button button-primary full" type="submit" disabled={submitting}>
            <KeyRound size={18} aria-hidden="true" />
            {submitting ? 'Updating...' : 'Reset Password'}
          </button>
        </form>

        <p className="auth-footnote">
          Need to start over? <Link to="/forgot-password">Forgot Password</Link>
        </p>
      </section>
    </main>
  );
}

export default ResetPassword;
