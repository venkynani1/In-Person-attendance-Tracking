import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ClipboardCheck, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiError } from '../services/api.js';

const initialForm = {
  username: '',
  password: '',
  confirmPassword: ''
};

function SignupPage() {
  const { user, signup } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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
    setMessage('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      await signup(form);
      setMessage('Request submitted. Please wait for master admin approval.');
      setForm(initialForm);
    } catch (err) {
      setError(getApiError(err, 'Could not submit signup request.'));
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
            <p className="eyebrow">Admin Access</p>
            <h1>Request access</h1>
            <p className="auth-tagline">Signup requests require master admin approval.</p>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}

        <form className="form-panel public-form" onSubmit={handleSubmit}>
          <label>
            <span>Username</span>
            <input name="username" value={form.username} onChange={updateField} autoComplete="username" required />
          </label>
          <label>
            <span>Password</span>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={updateField}
              autoComplete="new-password"
              minLength="8"
              required
            />
          </label>
          <label>
            <span>Confirm password</span>
            <input
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={updateField}
              autoComplete="new-password"
              minLength="8"
              required
            />
          </label>
          <button className="button button-primary full" type="submit" disabled={submitting}>
            <Send size={18} aria-hidden="true" />
            {submitting ? 'Submitting...' : 'Submit Signup Request'}
          </button>
        </form>

        <p className="auth-footnote">
          Already approved? <Link to="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}

export default SignupPage;
