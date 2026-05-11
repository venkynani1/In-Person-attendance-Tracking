import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CircleStop, Download, Eye, Filter, MapPin, MonitorUp, Play, Plus, RefreshCw, Search, Trash2, UserCheck, UsersRound } from 'lucide-react';
import Header from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiError, trainingAPI } from '../services/api.js';
import { buildAttendanceReportFileName } from '../utils/exportFileName.js';
import { formatDateTime, getSessionState } from '../utils/session.js';
import MasterAdminUsers from './MasterAdminUsers.jsx';

function StatusBadge({ training, now }) {
  const sessionState = getSessionState(training, now);
  return <span className={`status-badge ${sessionState.badgeClass}`}>{sessionState.label}</span>;
}

function getDashboardStatus(training, now) {
  const state = getSessionState(training, now);
  if (training.manuallyStopped) return 'stopped';
  return state.key;
}

function AdminDashboard() {
  const { token, user } = useAuth();
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportingId, setExportingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [openingId, setOpeningId] = useState('');
  const [stoppingId, setStoppingId] = useState('');
  const [stopTarget, setStopTarget] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
    if (!token || !user) return;
    loadTrainings();
  }, [token, user]);

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
      link.setAttribute('download', buildAttendanceReportFileName(training));
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

  async function handleOpenAttendance(training) {
    try {
      setOpeningId(training.id);
      setActionMessage('');
      setError('');
      const response = await trainingAPI.openAttendance(training.id);
      setActionMessage(`Attendance opened for ${training.trainingName}.`);
      // Update only the specific training in state instead of refetching all
      setTrainings((prev) =>
        prev.map((t) =>
          t.id === training.id ? response.data : t
        )
      );
    } catch (err) {
      setError(getApiError(err, 'Failed to open attendance.'));
    } finally {
      setOpeningId('');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    try {
      setDeletingId(deleteTarget.id);
      await trainingAPI.deleteTraining(deleteTarget.id);
      setDeleteTarget(null);
      // Remove from state instead of refetching
      setTrainings((prev) =>
        prev.filter((t) => t.id !== deleteTarget.id)
      );
    } catch (err) {
      setError(getApiError(err, 'Failed to delete training.'));
    } finally {
      setDeletingId('');
    }
  }

  async function confirmStop() {
    if (!stopTarget) return;

    try {
      setStoppingId(stopTarget.id);
      setActionMessage('');
      const response = await trainingAPI.stopAttendance(stopTarget.id);
      setStopTarget(null);
      // Update only the specific training instead of refetching all
      setTrainings((prev) =>
        prev.map((t) =>
          t.id === stopTarget.id ? response.data : t
        )
      );
    } catch (err) {
      setError(getApiError(err, 'Failed to stop attendance.'));
    } finally {
      setStoppingId('');
    }
  }

  const openCount = trainings.filter((training) => getSessionState(training, now).key === 'active').length;
  const totalAttendance = trainings.reduce((sum, training) => sum + (training._count?.attendances || 0), 0);
  const closedCount = trainings.filter((training) => getSessionState(training, now).key === 'closed').length;
  const dashboardTitle = user?.role === 'MASTER_ADMIN' ? 'All Trainings' : 'My Trainings';
  const dashboardSubtitle = user?.role === 'MASTER_ADMIN'
    ? 'Monitor every training session across administrators.'
    : 'Manage the trainings you created and track attendance in real time.';
  const filteredTrainings = trainings.filter((training) => {
    const matchesSearch = training.trainingName.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const matchesStatus = statusFilter === 'all' || getDashboardStatus(training, now) === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <Header />
      <main className="container">
        <div className="page-title-row dashboard-hero">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>{dashboardTitle}</h1>
            {user && <p className="page-subtitle account-line">Logged in as <strong>{user.username}</strong></p>}
            <p className="page-subtitle">{dashboardSubtitle}</p>
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
        {actionMessage && <div className="alert success">{actionMessage}</div>}

        {user?.role === 'MASTER_ADMIN' && <MasterAdminUsers />}

        {loading ? (
          <section className="skeleton-grid" aria-label="Loading trainings">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </section>
        ) : trainings.length === 0 ? (
          <section className="empty-state">
            <CalendarClock size={36} aria-hidden="true" />
            <h2>No trainings created yet. Create your first training.</h2>
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
                  <p className="kpi-label">Active</p>
                  <strong>{openCount}</strong>
                </div>
              </article>
              <article className="kpi-card">
                <span className="kpi-icon info"><UsersRound size={20} aria-hidden="true" /></span>
                <div>
                  <p className="kpi-label">Attendance Captured</p>
                  <strong>{totalAttendance}</strong>
                </div>
              </article>
              <article className="kpi-card">
                <span className="kpi-icon warning"><MapPin size={20} aria-hidden="true" /></span>
                <div>
                  <p className="kpi-label">Closed</p>
                  <strong>{closedCount}</strong>
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
              <div className="dashboard-controls">
                <label className="search-control">
                  <Search size={18} aria-hidden="true" />
                  <span className="sr-only">Search by training name</span>
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search training name"
                  />
                </label>
                <label className="filter-control">
                  <Filter size={18} aria-hidden="true" />
                  <span className="sr-only">Filter by status</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="not-started">Not Started</option>
                    <option value="active">Active</option>
                    <option value="closed">Closed</option>
                    <option value="stopped">Stopped</option>
                  </select>
                </label>
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
                    {filteredTrainings.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="center muted">No trainings match the current search or filter.</td>
                      </tr>
                    ) : filteredTrainings.map((training) => {
                      const state = getSessionState(training, now);
                      const canOpen = state.key !== 'active' &&
                        !training.manuallyStopped &&
                        now.getTime() < new Date(training.endDateTime).getTime();
                      const canStop = state.key === 'active' && !training.manuallyStopped;

                      return (
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
                            <Link to={`/training/${training.id}/qr-display`} className="icon-button" title="Open QR display">
                              <MonitorUp size={18} aria-hidden="true" />
                              <span className="sr-only">QR Display</span>
                            </Link>
                            <button
                              className="icon-button"
                              type="button"
                              title="Open attendance"
                              onClick={() => handleOpenAttendance(training)}
                              disabled={!canOpen || openingId === training.id}
                            >
                              <Play size={18} aria-hidden="true" />
                              <span className="sr-only">Open attendance</span>
                            </button>
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
                              title="Stop attendance"
                              onClick={() => setStopTarget(training)}
                              disabled={!canStop || stoppingId === training.id}
                            >
                              <CircleStop size={18} aria-hidden="true" />
                              <span className="sr-only">Stop</span>
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
                      );
                    })}
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

        {stopTarget && (
          <div className="modal-backdrop" role="presentation">
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="stop-training-title">
              <h2 id="stop-training-title">Stop Attendance</h2>
              <p>Stop attendance now? Participants will no longer be able to submit.</p>
              <div className="modal-actions">
                <button className="button button-secondary" type="button" onClick={() => setStopTarget(null)}>
                  Cancel
                </button>
                <button className="button button-danger" type="button" onClick={confirmStop} disabled={stoppingId === stopTarget.id}>
                  <CircleStop size={18} aria-hidden="true" />
                  {stoppingId === stopTarget.id ? 'Stopping...' : 'Stop Attendance'}
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
