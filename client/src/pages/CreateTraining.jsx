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
  startDateTime: '',
  endDateTime: ''
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
      const response = await trainingAPI.createTraining({
        ...form,
        startDateTime: toIsoDateTime(form.startDateTime),
        endDateTime: toIsoDateTime(form.endDateTime)
      });
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
