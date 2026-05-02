import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BadgeCheck, CheckCircle2, Clock, IdCard, Send, Timer, UserRound } from 'lucide-react';
import { attendAPI, getApiError } from '../services/api.js';
import { formatDateTime, getCountdownMessage, getSessionState } from '../utils/session.js';

const initialForm = {
  employeeId: '',
  employeeName: ''
};

function getAttendanceSubmissionKey(trainingId) {
  return `attendance_submitted_${trainingId}`;
}

function hasAttendanceSubmissionLock(trainingId) {
  if (!trainingId) return false;

  try {
    return localStorage.getItem(getAttendanceSubmissionKey(trainingId)) === 'true';
  } catch (error) {
    return false;
  }
}

function setAttendanceSubmissionLock(trainingId) {
  if (!trainingId) return;

  try {
    localStorage.setItem(getAttendanceSubmissionKey(trainingId), 'true');
  } catch (error) {
    // Ignore storage failures so attendance submission itself is not blocked.
  }
}

function AttendPage() {
  const { token } = useParams();
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [now, setNow] = useState(() => new Date());

  async function loadStatus() {
    try {
      const response = await attendAPI.getStatus(token);
      setStatus(response.data);
      if (hasAttendanceSubmissionLock(response.data?.training?.id)) {
        setSubmitted(true);
        setSuccess((current) => current || 'You have already submitted attendance for this session.');
      }
      setError('');
    } catch (err) {
      setError(getApiError(err, 'Could not open this attendance link.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setStatus(null);
    setForm(initialForm);
    setSubmitted(false);
    setShowConfirm(false);
    setError('');
    setSuccess('');
    setLoading(true);
    loadStatus();
    const intervalId = window.setInterval(loadStatus, 30000);
    return () => window.clearInterval(intervalId);
  }, [token]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  function updateField(event) {
    if (submitted) return;
    const { name, value } = event.target;
    const nextValue = name === 'employeeId'
      ? value.replace(/\D/g, '').slice(0, 10)
      : value;

    setForm((current) => ({ ...current, [name]: nextValue }));
  }

  async function submitAttendance() {
    if (submitting || submitted) return;

    setError('');
    setSuccess('');

    if (!/^[0-9]{10}$/.test(form.employeeId)) {
      setError('Employee ID must be exactly 10 digits');
      setShowConfirm(false);
      return;
    }

    try {
      setSubmitting(true);
      setShowConfirm(false);
      await attendAPI.submit(token, {
        employeeId: form.employeeId,
        employeeName: form.employeeName
      });
      setAttendanceSubmissionLock(status?.training?.id);
      setSuccess('Attendance submitted successfully');
      setSubmitted(true);
      await loadStatus();
    } catch (err) {
      const message = getApiError(err, 'Could not submit attendance.');
      setError(
        message === 'Attendance already submitted from this device'
          ? 'You have already submitted attendance for this session.'
          : message.includes('already') ? 'Attendance already submitted' : message
      );
      await loadStatus();
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (submitting || submitted) return;
    if (!/^[0-9]{10}$/.test(form.employeeId)) {
      setError('Employee ID must be exactly 10 digits');
      return;
    }

    setError('');
    setShowConfirm(true);
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
              <div className="closed-state">
                <Clock size={26} aria-hidden="true" />
                <strong>Attendance is closed for this session.</strong>
                <span>{training.manuallyStopped ? 'Attendance closed by admin' : 'Attendance has closed for this training.'}</span>
              </div>
            )}
            {error && <div className="alert error">{error}</div>}
            {success && (
              <div className="success-card">
                <CheckCircle2 size={28} aria-hidden="true" />
                <strong>{success}</strong>
              </div>
            )}

            {!closed && (
              <form className="form-panel public-form" onSubmit={handleSubmit}>
                <label>
                  <span><IdCard size={15} aria-hidden="true" />Employee ID</span>
                  <input
                    name="employeeId"
                    value={form.employeeId}
                    onChange={updateField}
                    disabled={submitted || submitting}
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    required
                  />
                </label>
                <label>
                  <span><UserRound size={15} aria-hidden="true" />Employee name</span>
                  <input name="employeeName" value={form.employeeName} onChange={updateField} disabled={submitted || submitting} required />
                </label>
                <button className="button button-primary full" type="submit" disabled={submitting || submitted}>
                  <Send size={18} aria-hidden="true" />
                  {submitting ? 'Submitting...' : submitted ? 'Attendance Submitted' : 'Submit Attendance'}
                </button>
              </form>
            )}

            {showConfirm && (
              <div className="modal-backdrop" role="presentation">
                <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-submission-title">
                  <h2 id="confirm-submission-title">Confirm Submission</h2>
                  <p>Please verify your Employee ID and Name before submitting. This action cannot be changed later.</p>
                  <dl className="confirmation-details">
                    <div>
                      <dt>Employee ID:</dt>
                      <dd>{form.employeeId}</dd>
                    </div>
                    <div>
                      <dt>Employee Name:</dt>
                      <dd>{form.employeeName}</dd>
                    </div>
                  </dl>
                  <div className="modal-actions">
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => setShowConfirm(false)}
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={submitAttendance}
                      disabled={submitting}
                    >
                      <Send size={18} aria-hidden="true" />
                      {submitting ? 'Submitting...' : 'Confirm & Submit'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default AttendPage;
