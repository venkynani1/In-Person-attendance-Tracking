import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ClipboardCheck, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiError } from '../services/api.js';

const initialForm = {
  username: '',
  password: ''
};

function LoginPage() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
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

    try {
      setSubmitting(true);
      await login(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(getApiError(err, 'Could not log in.'));
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
            <p className="eyebrow">Attendance Command Center</p>
            <h1>Welcome back</h1>
            <p className="auth-tagline">Secure QR-based attendance for in-person trainings</p>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}

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
              autoComplete="current-password"
              required
            />
          </label>
          <button className="button button-primary full" type="submit" disabled={submitting}>
            <LogIn size={18} aria-hidden="true" />
            {submitting ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="auth-footnote">
          Need access? <Link to="/signup">Submit a signup request</Link>
        </p>
      </section>
    </main>
  );
}

export default LoginPage;
