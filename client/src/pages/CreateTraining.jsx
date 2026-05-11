import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarClock, MapPin, Save, UserRound } from 'lucide-react';
import Header from '../components/Header.jsx';
import { getApiError, trainingAPI } from '../services/api.js';

const initialForm = {
  trainingName: '',
  trainerName: '',
  location: '',
  description: '',
  trainingType: 'SINGLE',
  startDateTime: '',
  endDateTime: '',
  startDate: '',
  numberOfDays: '2',
  dailyStartTime: '',
  dailyEndTime: ''
};

function toIsoDateTime(value) {
  return new Date(value).toISOString();
}

function CreateTraining() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    try {
      setSubmitting(true);
      const payload = form.trainingType === 'SERIES'
        ? {
          trainingName: form.trainingName,
          trainerName: form.trainerName,
          location: form.location,
          description: form.description,
          trainingType: 'SERIES',
          startDate: form.startDate,
          numberOfDays: Number(form.numberOfDays),
          dailyStartTime: form.dailyStartTime,
          dailyEndTime: form.dailyEndTime
        }
        : {
          trainingName: form.trainingName,
          trainerName: form.trainerName,
          location: form.location,
          description: form.description,
          trainingType: 'SINGLE',
          startDateTime: toIsoDateTime(form.startDateTime),
          endDateTime: toIsoDateTime(form.endDateTime)
        };
      const response = await trainingAPI.createTraining(payload);
      navigate(`/training/${response.data.id}`);
    } catch (err) {
      setError(getApiError(err, 'Could not create training.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Header />
      <main className="container narrow">
        <button className="text-button" type="button" onClick={() => navigate('/')}>
          <ArrowLeft size={18} aria-hidden="true" />
          Back
        </button>
        <div className="page-title">
          <p className="eyebrow">New Training</p>
          <h1>Create Training</h1>
          <p className="page-subtitle">Set the session details and attendance capture window.</p>
        </div>

        {error && <div className="alert error">{error}</div>}

        <form className="form-panel enterprise-form" onSubmit={handleSubmit}>
          <section className="form-section">
            <div className="form-section-title">
              <span className="section-icon"><CalendarClock size={18} aria-hidden="true" /></span>
              <h2>Session Profile</h2>
            </div>
            <label>
              <span>Training name</span>
              <input name="trainingName" value={form.trainingName} onChange={updateField} required />
            </label>
            <label>
              <span>Description optional</span>
              <textarea name="description" value={form.description} onChange={updateField} rows="3" />
            </label>
            <label>
              <span>Training type</span>
              <select name="trainingType" value={form.trainingType} onChange={updateField}>
                <option value="SINGLE">Single Day Training</option>
                <option value="SERIES">Series Training</option>
              </select>
            </label>
          </section>

          <section className="form-section">
            <div className="form-section-title">
              <span className="section-icon"><UserRound size={18} aria-hidden="true" /></span>
              <h2>Ownership</h2>
            </div>
            <div className="form-grid two">
              <label>
                <span>Trainer name</span>
                <input name="trainerName" value={form.trainerName} onChange={updateField} required />
              </label>
              <label>
                <span>Location</span>
                <input name="location" value={form.location} onChange={updateField} required />
              </label>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-title">
              <span className="section-icon"><MapPin size={18} aria-hidden="true" /></span>
              <h2>Attendance Window</h2>
            </div>
            {form.trainingType === 'SINGLE' ? (
              <div className="form-grid two">
                <label>
                  <span>Start date and time</span>
                  <input
                    name="startDateTime"
                    type="datetime-local"
                    value={form.startDateTime}
                    onChange={updateField}
                    required
                  />
                </label>
                <label>
                  <span>End date and time</span>
                  <input
                    name="endDateTime"
                    type="datetime-local"
                    value={form.endDateTime}
                    onChange={updateField}
                    required
                  />
                </label>
              </div>
            ) : (
              <div className="form-grid two">
                <label>
                  <span>Start date</span>
                  <input
                    name="startDate"
                    type="date"
                    value={form.startDate}
                    onChange={updateField}
                    required
                  />
                </label>
                <label>
                  <span>Number of days</span>
                  <input
                    name="numberOfDays"
                    type="number"
                    min="2"
                    value={form.numberOfDays}
                    onChange={updateField}
                    required
                  />
                </label>
                <label>
                  <span>Daily start time</span>
                  <input
                    name="dailyStartTime"
                    type="time"
                    value={form.dailyStartTime}
                    onChange={updateField}
                    required
                  />
                </label>
                <label>
                  <span>Daily end time</span>
                  <input
                    name="dailyEndTime"
                    type="time"
                    value={form.dailyEndTime}
                    onChange={updateField}
                    required
                  />
                </label>
              </div>
            )}
          </section>

          <div className="form-actions">
            <button className="button button-secondary" type="button" onClick={() => navigate('/')}>
              Cancel
            </button>
            <button className="button button-primary" type="submit" disabled={submitting}>
              <Save size={18} aria-hidden="true" />
              {submitting ? 'Creating...' : 'Create Training'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default CreateTraining;
