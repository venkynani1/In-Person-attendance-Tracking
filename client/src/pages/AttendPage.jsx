import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BadgeCheck, Clock, IdCard, Send, Timer, UserRound } from 'lucide-react';
import { attendAPI, getApiError } from '../services/api.js';
import { formatDateTime, getCountdownMessage, getSessionState } from '../utils/session.js';

const initialForm = {
  employeeId: '',
  employeeName: ''
};

function AttendPage() {
  const { token } = useParams();
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [now, setNow] = useState(() => new Date());

  async function loadStatus() {
    try {
      const response = await attendAPI.getStatus(token);
      setStatus(response.data);
      setError('');
    } catch (err) {
      setError(getApiError(err, 'Could not open this attendance link.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
    const intervalId = window.setInterval(loadStatus, 30000);
    return () => window.clearInterval(intervalId);
  }, [token]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      setSubmitting(true);
      const response = await attendAPI.submit(token, {
        employeeId: form.employeeId,
        employeeName: form.employeeName
      });
      setSuccess(response.data.message);
      setForm(initialForm);
      await loadStatus();
    } catch (err) {
      setError(getApiError(err, 'Could not submit attendance.'));
      await loadStatus();
    } finally {
      setSubmitting(false);
    }
  }

  const training = status?.training;
  const sessionState = training ? getSessionState(training, now) : null;
  const countdownMessage = training ? getCountdownMessage(training, now) : '';
  const closed = sessionState?.key !== 'active';

  return (
    <main className="public-page">
      <section className="public-panel">
        {loading ? (
          <div className="empty-state public">
            <div className="spinner" />
            <p>Opening attendance form. The backend may be waking up on Render Free.</p>
          </div>
        ) : error && !training ? (
          <div className="alert error">{error}</div>
        ) : (
          <>
            <div className="public-heading">
              <span className="public-mark" aria-hidden="true">
                <BadgeCheck size={30} />
              </span>
              <div>
                <p className="eyebrow">Attendance</p>
                <h1>{training.trainingName}</h1>
                <div className="title-meta public-meta">
                  <span className={`status-badge ${sessionState.badgeClass}`}>{sessionState.label}</span>
                  <span>{training.trainerName} at {training.location}</span>
                </div>
              </div>
            </div>

            {training.description && <p className="description">{training.description}</p>}

            <div className="time-window">
              <Clock size={18} aria-hidden="true" />
              <span>{formatDateTime(training.startDateTime)} to {formatDateTime(training.endDateTime)}</span>
            </div>

            <div className="countdown-strip public-countdown" aria-live="polite">
              <Timer size={18} aria-hidden="true" />
              <span>{countdownMessage}</span>
            </div>

            {sessionState.key === 'not-started' && (
              <div className="alert warning">Attendance has not opened yet.</div>
            )}
            {sessionState.key === 'closed' && (
              <div className="alert error">Attendance has closed for this training.</div>
            )}
            {error && <div className="alert error">{error}</div>}
            {success && <div className="alert success">{success}</div>}

            {!closed && (
              <form className="form-panel public-form" onSubmit={handleSubmit}>
                <label>
                  <span><IdCard size={15} aria-hidden="true" />Employee ID</span>
                  <input name="employeeId" value={form.employeeId} onChange={updateField} required />
                </label>
                <label>
                  <span><UserRound size={15} aria-hidden="true" />Employee name</span>
                  <input name="employeeName" value={form.employeeName} onChange={updateField} required />
                </label>
                <button className="button button-primary full" type="submit" disabled={submitting}>
                  <Send size={18} aria-hidden="true" />
                  {submitting ? 'Submitting...' : 'Submit Attendance'}
                </button>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default AttendPage;
