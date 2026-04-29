import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Download, Eye, MapPin, Plus, RefreshCw, Trash2, UserCheck, UsersRound } from 'lucide-react';
import Header from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiError, trainingAPI } from '../services/api.js';
import { formatDateTime, getSessionState } from '../utils/session.js';
import MasterAdminUsers from './MasterAdminUsers.jsx';

function StatusBadge({ training, now }) {
  const sessionState = getSessionState(training, now);
  return <span className={`status-badge ${sessionState.badgeClass}`}>{sessionState.label}</span>;
}

function AdminDashboard() {
  const { token, user } = useAuth();
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportingId, setExportingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [now, setNow] = useState(() => new Date());

  async function loadTrainings() {
    try {
      setLoading(true);
      const response = await trainingAPI.getTrainings();
      setTrainings(response.data);
      setError('');
    } catch (err) {
      setError(getApiError(err, 'Failed to load trainings.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadTrainings();
  }, [token]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  async function handleExport(training) {
    try {
      setExportingId(training.id);
      const response = await trainingAPI.exportAttendance(training.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance-${training.trainingName}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(getApiError(err, 'Failed to export attendance.'));
    } finally {
      setExportingId('');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    try {
      setDeletingId(deleteTarget.id);
      await trainingAPI.deleteTraining(deleteTarget.id);
      setDeleteTarget(null);
      await loadTrainings();
    } catch (err) {
      setError(getApiError(err, 'Failed to delete training.'));
    } finally {
      setDeletingId('');
    }
  }

  const openCount = trainings.filter((training) => getSessionState(training, now).key === 'active').length;
  const totalAttendance = trainings.reduce((sum, training) => sum + (training._count?.attendances || 0), 0);
  const upcomingCount = trainings.filter((training) => getSessionState(training, now).key === 'not-started').length;

  return (
    <div>
      <Header />
      <main className="container">
        <div className="page-title-row">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Training Attendance</h1>
            {user && <p className="page-subtitle account-line">Logged in as <strong>{user.username}</strong></p>}
            <p className="page-subtitle">Monitor active training sessions, attendance capture, and exports from one operational view.</p>
          </div>
          <div className="actions-row">
            <button className="button button-secondary compact" type="button" onClick={loadTrainings}>
              <RefreshCw size={18} aria-hidden="true" />
              Refresh
            </button>
            <Link to="/create" className="button button-primary compact">
              <Plus size={18} aria-hidden="true" />
              Create Training
            </Link>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}

        {user?.role === 'MASTER_ADMIN' && <MasterAdminUsers />}

        {loading ? (
          <section className="empty-state">
            <div className="spinner" />
            <p>Loading trainings. If this is the first request in a while, the Render backend may be waking up.</p>
          </section>
        ) : trainings.length === 0 ? (
          <section className="empty-state">
            <CalendarClock size={36} aria-hidden="true" />
            <h2>No trainings yet</h2>
            <p>Create a training to generate its attendance link and QR code.</p>
            <Link to="/create" className="button button-primary">
              <Plus size={18} aria-hidden="true" />
              Create Training
            </Link>
          </section>
        ) : (
          <>
            <section className="kpi-grid" aria-label="Attendance summary">
              <article className="kpi-card">
                <span className="kpi-icon"><CalendarClock size={20} aria-hidden="true" /></span>
                <div>
                  <p className="kpi-label">Total trainings</p>
                  <strong>{trainings.length}</strong>
                </div>
              </article>
              <article className="kpi-card">
                <span className="kpi-icon success"><UserCheck size={20} aria-hidden="true" /></span>
                <div>
                  <p className="kpi-label">Open sessions</p>
                  <strong>{openCount}</strong>
                </div>
              </article>
              <article className="kpi-card">
                <span className="kpi-icon info"><UsersRound size={20} aria-hidden="true" /></span>
                <div>
                  <p className="kpi-label">Attendance records</p>
                  <strong>{totalAttendance}</strong>
                </div>
              </article>
              <article className="kpi-card">
                <span className="kpi-icon warning"><MapPin size={20} aria-hidden="true" /></span>
                <div>
                  <p className="kpi-label">Upcoming</p>
                  <strong>{upcomingCount}</strong>
                </div>
              </article>
            </section>

            <section className="table-section" aria-label="Training list">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Registry</p>
                  <h2>Training Sessions</h2>
                </div>
              </div>
              <div className="table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>Training</th>
                      <th>Trainer</th>
                      <th>Location</th>
                      <th>Window</th>
                      <th>Status</th>
                      <th>Attendance</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainings.map((training) => (
                      <tr key={training.id}>
                        <td>
                          <strong>{training.trainingName}</strong>
                          {training.description && <span className="muted block table-description">{training.description}</span>}
                        </td>
                        <td>{training.trainerName}</td>
                        <td>{training.location}</td>
                        <td>
                          <span className="block">{formatDateTime(training.startDateTime)}</span>
                          <span className="muted block">to {formatDateTime(training.endDateTime)}</span>
                        </td>
                        <td><StatusBadge training={training} now={now} /></td>
                        <td><strong>{training._count?.attendances || 0}</strong></td>
                        <td>
                          <div className="inline-actions">
                            <Link to={`/training/${training.id}`} className="icon-button" title="View training">
                              <Eye size={18} aria-hidden="true" />
                              <span className="sr-only">View</span>
                            </Link>
                            <button
                              className="icon-button"
                              type="button"
                              title="Download Excel"
                              onClick={() => handleExport(training)}
                              disabled={exportingId === training.id}
                            >
                              <Download size={18} aria-hidden="true" />
                              <span className="sr-only">Download Excel</span>
                            </button>
                            <button
                              className="icon-button danger-action"
                              type="button"
                              title="Delete training"
                              onClick={() => setDeleteTarget(training)}
                              disabled={deletingId === training.id}
                            >
                              <Trash2 size={18} aria-hidden="true" />
                              <span className="sr-only">Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {deleteTarget && (
          <div className="modal-backdrop" role="presentation">
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-training-title">
              <h2 id="delete-training-title">Delete Training</h2>
              <p>Are you sure you want to delete this training and all captured attendance?</p>
              <div className="modal-actions">
                <button className="button button-secondary" type="button" onClick={() => setDeleteTarget(null)}>
                  Cancel
                </button>
                <button className="button button-danger" type="button" onClick={confirmDelete} disabled={deletingId === deleteTarget.id}>
                  <Trash2 size={18} aria-hidden="true" />
                  {deletingId === deleteTarget.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;
