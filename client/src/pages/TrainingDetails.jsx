import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarClock, Check, CircleStop, Copy, Download, ExternalLink, Link2, MapPin, MonitorUp, Play, RefreshCw, Sparkles, Timer, Trash2, Upload, UserX, UsersRound } from 'lucide-react';
import Header from '../components/Header.jsx';
import { getApiError, trainingAPI } from '../services/api.js';
import { buildAttendanceReportFileName } from '../utils/exportFileName.js';
import { downloadQrAsJpg } from '../utils/qrDownload.js';
import { formatDateTime, getCountdownMessage, getSessionState, getSmartSummaryItems } from '../utils/session.js';

function getSessionAttendanceLink(session) {
  if (session?.attendanceLink) return session.attendanceLink;
  if (session?.token) return `${window.location.origin}/attend/${session.token}`;
  return '';
}

function formatSessionDate(value) {
  return new Date(value).toLocaleDateString([], { dateStyle: 'medium' });
}

function formatSessionTime(value) {
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });
}

function getSessionStatusLabel(session, state) {
  if (state.key === 'not-started' && !session.attendanceOpenedAt) return 'Not Opened';
  return state.label;
}

function TrainingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const nominationFileInputRef = useRef(null);
  const [training, setTraining] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedSessionId, setCopiedSessionId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [selectedNominationFile, setSelectedNominationFile] = useState(null);
  const [uploadingNominations, setUploadingNominations] = useState(false);
  const [nominationMessage, setNominationMessage] = useState('');
  const [nominationError, setNominationError] = useState('');
  const [attendanceActionMessage, setAttendanceActionMessage] = useState('');
  const [opening, setOpening] = useState(false);
  const [sessionActionId, setSessionActionId] = useState('');
  const [stopping, setStopping] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [qrSrc, setQrSrc] = useState('');
  const [qrDownloadError, setQrDownloadError] = useState('');
  const [downloadingQr, setDownloadingQr] = useState(false);
  const [selectedQrSession, setSelectedQrSession] = useState(null);
  const [selectedQrSrc, setSelectedQrSrc] = useState('');
  const [loadingSessionQr, setLoadingSessionQr] = useState(false);
  const [sessionQrError, setSessionQrError] = useState('');
  const [now, setNow] = useState(() => new Date());

  async function loadDetails(options = {}) {
    try {
      if (!options.silent) setLoading(true);
      const [trainingResponse, attendanceResponse, sessionsResponse] = await Promise.all([
        trainingAPI.getTraining(id),
        trainingAPI.getAttendance(id),
        trainingAPI.getTrainingSessions(id).catch(() => ({ data: [] }))
      ]);

      const trainingData = trainingResponse.data;
      const responseSessions = Array.isArray(trainingData.sessions) ? trainingData.sessions : [];
      const fetchedSessions = Array.isArray(sessionsResponse.data) ? sessionsResponse.data : [];
      setTraining({
        ...trainingData,
        sessions: responseSessions.length > 0 ? responseSessions : fetchedSessions
      });
      setAttendance(attendanceResponse.data);
      setAccessDenied(false);
      setError('');
    } catch (err) {
      if (err.response?.status === 403) {
        setTraining(null);
        setAttendance([]);
        setAccessDenied(true);
        setError('');
      } else {
        setAccessDenied(false);
        setError(getApiError(err, 'Failed to load training details.'));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetails();
    const refreshId = window.setInterval(() => loadDetails({ silent: true }), 15000);
    return () => window.clearInterval(refreshId);
  }, [id]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    async function loadQrImage() {
      try {
        const response = await trainingAPI.getQrImage(id);
        objectUrl = window.URL.createObjectURL(new Blob([response.data]));
        if (active) {
          setQrSrc((current) => {
            if (current) window.URL.revokeObjectURL(current);
            return objectUrl;
          });
        } else {
          window.URL.revokeObjectURL(objectUrl);
        }
      } catch (err) {
        if (active) {
          if (err.response?.status === 403) {
            setAccessDenied(true);
            setError('');
          } else {
            setError(getApiError(err, 'Failed to load QR code.'));
          }
        }
      }
    }

    loadQrImage();

    return () => {
      active = false;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => () => {
    if (selectedQrSrc) window.URL.revokeObjectURL(selectedQrSrc);
  }, [selectedQrSrc]);

  async function copyLink() {
    await navigator.clipboard.writeText(training.attendanceLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function exportExcel() {
    try {
      setExporting(true);
      const response = await trainingAPI.exportAttendance(id);
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
      setExporting(false);
    }
  }

  async function copySessionLink(session) {
    await navigator.clipboard.writeText(getSessionAttendanceLink(session));
    setCopiedSessionId(session.id);
    window.setTimeout(() => setCopiedSessionId(''), 1800);
  }

  async function handleDownloadQr() {
    try {
      setDownloadingQr(true);
      setQrDownloadError('');
      await downloadQrAsJpg({
        qrSrc,
        trainingName: training.trainingName
      });
    } catch (err) {
      setQrDownloadError(err.message || 'Failed to download QR code.');
    } finally {
      setDownloadingQr(false);
    }
  }

  async function handleDownloadSessionQr(session) {
    let qrObjectUrl = '';

    try {
      setSessionActionId(session.id);
      setQrDownloadError('');
      const response = await trainingAPI.getTrainingSessionQr(id, session.id);
      qrObjectUrl = window.URL.createObjectURL(new Blob([response.data]));
      await downloadQrAsJpg({
        qrSrc: qrObjectUrl,
        trainingName: `${training.trainingName} Day ${session.dayNumber}`
      });
    } catch (err) {
      setQrDownloadError(err.message || 'Failed to download QR code.');
    } finally {
      if (qrObjectUrl) window.URL.revokeObjectURL(qrObjectUrl);
      setSessionActionId('');
    }
  }

  async function viewSessionQr(session) {
    try {
      setSelectedQrSession(session);
      setSelectedQrSrc('');
      setSessionQrError('');
      setLoadingSessionQr(true);
      const response = await trainingAPI.getTrainingSessionQr(id, session.id);
      const qrObjectUrl = window.URL.createObjectURL(new Blob([response.data]));
      setSelectedQrSrc(qrObjectUrl);
    } catch (err) {
      setSessionQrError(getApiError(err, 'Failed to load session QR code.'));
    } finally {
      setLoadingSessionQr(false);
    }
  }

  function closeSessionQr() {
    setSelectedQrSession(null);
    setSelectedQrSrc('');
    setSessionQrError('');
    setLoadingSessionQr(false);
  }

  async function downloadSelectedSessionQr() {
    if (!selectedQrSession) return;

    try {
      setQrDownloadError('');
      await downloadQrAsJpg({
        qrSrc: selectedQrSrc,
        trainingName: `${training.trainingName} Day ${selectedQrSession.dayNumber}`
      });
    } catch (err) {
      setSessionQrError(err.message || 'Failed to download QR code.');
    }
  }

  function handleNominationFileChange(event) {
    const file = event.target.files?.[0] || null;
    setSelectedNominationFile(file);
    setNominationMessage('');
    setNominationError('');
  }

  async function uploadNominations() {
    if (!selectedNominationFile || uploadingNominations) return;

    try {
      setUploadingNominations(true);
      setNominationMessage('');
      setNominationError('');

      const formData = new FormData();
      formData.append('nominationsFile', selectedNominationFile);

      const response = await trainingAPI.uploadNominations(id, formData);
      setNominationMessage('Nominations uploaded successfully');
      setSelectedNominationFile(null);
      if (nominationFileInputRef.current) {
        nominationFileInputRef.current.value = '';
      }
      setTraining((current) => current ? {
        ...current,
        nominatedCount: response.data.nominatedCount ?? current.nominatedCount
      } : current);
      await loadDetails({ silent: true });
    } catch (err) {
      setNominationError(getApiError(err, 'Failed to upload nominations.'));
    } finally {
      setUploadingNominations(false);
    }
  }

  async function openAttendance() {
    try {
      setOpening(true);
      setError('');
      setAttendanceActionMessage('');
      const response = await trainingAPI.openAttendance(id);
      setTraining(response.data);
      setAttendanceActionMessage('Attendance opened successfully. Participants can submit now.');
      await loadDetails({ silent: true });
    } catch (err) {
      setError(getApiError(err, 'Failed to open attendance.'));
    } finally {
      setOpening(false);
    }
  }

  async function openSessionAttendance(session) {
    try {
      setSessionActionId(session.id);
      setError('');
      setAttendanceActionMessage('');
      await trainingAPI.openTrainingSession(id, session.id);
      setAttendanceActionMessage(`Attendance opened for Day ${session.dayNumber}.`);
      await loadDetails({ silent: true });
    } catch (err) {
      setError(getApiError(err, 'Failed to open attendance.'));
    } finally {
      setSessionActionId('');
    }
  }

  async function stopSessionAttendance(session) {
    try {
      setSessionActionId(session.id);
      setError('');
      setAttendanceActionMessage('');
      await trainingAPI.stopTrainingSession(id, session.id);
      setAttendanceActionMessage(`Attendance closed for Day ${session.dayNumber}.`);
      await loadDetails({ silent: true });
    } catch (err) {
      setError(getApiError(err, 'Failed to close attendance.'));
    } finally {
      setSessionActionId('');
    }
  }

  async function stopAttendance() {
    try {
      setStopping(true);
      setAttendanceActionMessage('');
      const response = await trainingAPI.stopAttendance(id);
      setTraining(response.data);
      setShowStopConfirm(false);
      await loadDetails({ silent: true });
    } catch (err) {
      setError(getApiError(err, 'Failed to stop attendance.'));
    } finally {
      setStopping(false);
    }
  }

  async function deleteTraining() {
    try {
      setDeleting(true);
      await trainingAPI.deleteTraining(id);
      navigate('/');
    } catch (err) {
      setError(getApiError(err, 'Failed to delete training.'));
    } finally {
      setDeleting(false);
    }
  }

  const sessionState = training ? getSessionState(training, now) : null;
  const countdownMessage = training ? getCountdownMessage(training, now) : '';
  const summaryItems = training ? getSmartSummaryItems(training, attendance.length, now) : [];
  const canOpenAttendance = Boolean(
    training &&
    sessionState?.key !== 'active' &&
    !training.manuallyStopped &&
    now.getTime() < new Date(training.endDateTime).getTime()
  );
  const canStopAttendance = sessionState?.key === 'active' && !training?.manuallyStopped;
  const sessions = training?.sessions || [];
  const isSeriesTraining = training?.trainingType === 'SERIES' || sessions.length > 1;
  const sortedAttendance = [...attendance].sort((first, second) => {
    const nameComparison = first.employeeName.localeCompare(second.employeeName);
    return nameComparison || first.employeeId.localeCompare(second.employeeId);
  });
  const nominatedCount = training?.nominatedCount || 0;
  const absentCount = nominatedCount > 0 ? Math.max(0, nominatedCount - attendance.length) : 0;

  return (
    <div>
      <Header />
      <main className="container">
        {error && <div className="alert error">{error}</div>}
        {attendanceActionMessage && <div className="alert success">{attendanceActionMessage}</div>}

        {loading ? (
          <section className="empty-state">
            <div className="spinner" />
            <p>Loading training details. The backend may be waking up if it has been idle.</p>
          </section>
        ) : accessDenied ? (
          <section className="empty-state">
            <h2>Access denied</h2>
            <p>You do not have access to this training.</p>
            <Link to="/" className="button button-primary">
              Back to Dashboard
            </Link>
          </section>
        ) : training ? (
          <>
            <section className="training-hero-card">
              <div>
                <p className="eyebrow">Training Details</p>
                <h1>{training.trainingName}</h1>
                <div className="title-meta">
                  <span className={`status-badge ${sessionState.badgeClass}`}>{sessionState.label}</span>
                  <span>{formatDateTime(training.startDateTime)} to {formatDateTime(training.endDateTime)}</span>
                </div>
                <dl className="hero-meta-grid">
                  <div><dt>Trainer</dt><dd>{training.trainerName}</dd></div>
                  <div><dt>Location</dt><dd>{training.location}</dd></div>
                  <div><dt>Countdown</dt><dd>{countdownMessage}</dd></div>
                </dl>
                {training.description && <p className="page-subtitle">{training.description}</p>}
              </div>
              <div className="actions-row">
                <button className="button button-secondary compact" type="button" onClick={loadDetails}>
                  <RefreshCw size={18} aria-hidden="true" />
                  Refresh
                </button>
                <button className="button button-primary compact" type="button" onClick={exportExcel} disabled={exporting}>
                  <Download size={18} aria-hidden="true" />
                  {exporting ? 'Exporting...' : 'Download Report'}
                </button>
                {!isSeriesTraining && canOpenAttendance && (
                  <button className="button button-primary compact" type="button" onClick={openAttendance} disabled={opening}>
                    <Play size={18} aria-hidden="true" />
                    {opening ? 'Opening...' : 'Open Attendance'}
                  </button>
                )}
                {!isSeriesTraining && canStopAttendance && (
                  <button className="button button-danger compact" type="button" onClick={() => setShowStopConfirm(true)}>
                    <CircleStop size={18} aria-hidden="true" />
                    Stop Attendance
                  </button>
                )}
                {!isSeriesTraining && (
                  <Link className="button button-secondary compact" to={`/training/${training.id}/qr-display`} target="_blank">
                    <MonitorUp size={18} aria-hidden="true" />
                    Open QR Display
                  </Link>
                )}
                <button className="button button-danger compact" type="button" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 size={18} aria-hidden="true" />
                  Delete Training
                </button>
              </div>
            </section>

            <section className="kpi-grid details-kpis" aria-label="Training summary">
              <article className="kpi-card">
                <span className="kpi-icon info"><UsersRound size={20} aria-hidden="true" /></span>
                <div>
                  <p className="kpi-label">Nominated Count</p>
                  <strong>{nominatedCount}</strong>
                </div>
              </article>
              <article className="kpi-card">
                <span className="kpi-icon success"><UsersRound size={20} aria-hidden="true" /></span>
                <div>
                  <p className="kpi-label">Present Count</p>
                  <strong>{attendance.length}</strong>
                </div>
              </article>
              <article className="kpi-card">
                <span className="kpi-icon warning"><UserX size={20} aria-hidden="true" /></span>
                <div>
                  <p className="kpi-label">Absent Count</p>
                  <strong>{absentCount}</strong>
                </div>
              </article>
              <article className="kpi-card">
                <span className="kpi-icon"><CalendarClock size={20} aria-hidden="true" /></span>
                <div>
                  <p className="kpi-label">Attendance Captured</p>
                  <strong>{attendance.length}</strong>
                </div>
              </article>
            </section>

            <section className="countdown-strip" aria-live="polite">
              <Timer size={19} aria-hidden="true" />
              <span>{countdownMessage}</span>
            </section>

            <section className="summary-panel" aria-label="Smart Attendance Summary">
              <div className="panel-heading">
                <span className="section-icon"><Sparkles size={18} aria-hidden="true" /></span>
                <h2>Smart Attendance Summary</h2>
              </div>
              <ul>
                {summaryItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="panel nominations-panel" aria-label="Upload nominations">
              <div className="panel-heading">
                <span className="section-icon"><Upload size={18} aria-hidden="true" /></span>
                <h2>Upload Nominations</h2>
              </div>
              {nominationMessage && <div className="alert success">{nominationMessage}</div>}
              {nominationError && <div className="alert error">{nominationError}</div>}
              <div className="upload-row">
                <label className="file-upload-control">
                  <span><Upload size={18} aria-hidden="true" />Nominations Excel</span>
                  <input
                    ref={nominationFileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleNominationFileChange}
                    disabled={uploadingNominations}
                  />
                </label>
                <div className="selected-file" aria-live="polite">
                  <span>Selected file</span>
                  <strong>{selectedNominationFile?.name || 'No file selected'}</strong>
                </div>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={uploadNominations}
                  disabled={!selectedNominationFile || uploadingNominations}
                >
                  <Upload size={18} aria-hidden="true" />
                  {uploadingNominations ? 'Uploading...' : 'Upload Nominations'}
                </button>
              </div>
            </section>

            {!isSeriesTraining && (
            <section className="details-grid">
              <div className="panel">
                <div className="panel-heading">
                  <span className="section-icon"><Link2 size={18} aria-hidden="true" /></span>
                  <h2>Attendance Link</h2>
                </div>
                <div className="copy-row">
                  <input value={training.attendanceLink} readOnly aria-label="Attendance link" />
                  <button className="icon-button" type="button" onClick={copyLink} title="Copy attendance link">
                    {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                    <span className="sr-only">Copy attendance link</span>
                  </button>
                  <Link className="icon-button" to={`/attend/${training.token}`} target="_blank" title="Open attendance form">
                    <ExternalLink size={18} aria-hidden="true" />
                    <span className="sr-only">Open attendance form</span>
                  </Link>
                </div>
                <dl className="meta-list">
                  <div><dt>Start</dt><dd>{formatDateTime(training.startDateTime)}</dd></div>
                  <div><dt>End</dt><dd>{formatDateTime(training.endDateTime)}</dd></div>
                </dl>
              </div>

              <div className="panel qr-panel">
                <div className="panel-heading centered">
                  <h2>QR Code</h2>
                </div>
                {qrSrc ? (
                  <img src={qrSrc} alt={`QR code for ${training.trainingName}`} />
                ) : (
                  <div className="qr-loading">
                    <div className="spinner" />
                  </div>
                )}
                <button
                  className="button button-secondary compact qr-panel-download"
                  type="button"
                  onClick={handleDownloadQr}
                  disabled={!qrSrc || downloadingQr}
                >
                  <Download size={18} aria-hidden="true" />
                  {downloadingQr ? 'Preparing JPG...' : 'Download QR as JPG'}
                </button>
                {qrDownloadError && <div className="alert error qr-download-inline">{qrDownloadError}</div>}
              </div>
            </section>
            )}

            {isSeriesTraining && (
              <section className="table-section daily-sessions-section" aria-label="Daily attendance sessions">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Series</p>
                    <h2>Daily Attendance Sessions</h2>
                  </div>
                </div>
                {qrDownloadError && <div className="alert error">{qrDownloadError}</div>}
                <p className="session-count-debug">Total Sessions: {sessions.length}</p>
                <div className="table-shell">
                  <table className="daily-sessions-table">
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Attendance Count</th>
                        <th>Attendance Link</th>
                        <th>QR</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="center muted">No daily sessions found for this training yet.</td>
                        </tr>
                      ) : sessions.map((session) => {
                        const state = getSessionState(session, now);
                        const attendanceLink = getSessionAttendanceLink(session);
                        const attendanceCount = session.attendanceCount ?? session._count?.attendances ?? session.attendances?.length ?? 0;
                        const canOpenSession = state.key !== 'active' &&
                          !session.manuallyStopped &&
                          now.getTime() <= new Date(session.endDateTime).getTime();
                        const canStopSession = !session.manuallyStopped;

                        return (
                          <tr key={session.id}>
                            <td><strong>Day {session.dayNumber}</strong></td>
                            <td>{formatSessionDate(session.sessionDate)}</td>
                            <td>
                              <span className="block">{formatSessionTime(session.startDateTime)} - {formatSessionTime(session.endDateTime)}</span>
                            </td>
                            <td><span className={`status-badge ${state.badgeClass}`}>{getSessionStatusLabel(session, state)}</span></td>
                            <td><strong>{attendanceCount}</strong></td>
                            <td>
                              <div className="session-link-cell">
                                <input value={attendanceLink} readOnly aria-label={`Day ${session.dayNumber} attendance link`} />
                                <button
                                  className="icon-button"
                                  type="button"
                                  title="Copy attendance link"
                                  onClick={() => copySessionLink(session)}
                                >
                                  {copiedSessionId === session.id ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                                  <span className="sr-only">Copy attendance link</span>
                                </button>
                              </div>
                            </td>
                            <td>
                              <div className="session-button-group">
                                <button
                                  className="button button-secondary compact session-action-button"
                                  type="button"
                                  onClick={() => viewSessionQr(session)}
                                >
                                  <MonitorUp size={17} aria-hidden="true" />
                                  View QR
                                </button>
                                <button
                                  className="button button-secondary compact session-action-button"
                                  type="button"
                                  onClick={() => handleDownloadSessionQr(session)}
                                  disabled={sessionActionId === session.id}
                                >
                                  <Download size={17} aria-hidden="true" />
                                  Download QR as JPG
                                </button>
                              </div>
                            </td>
                            <td>
                              <div className="session-button-group">
                                <button
                                  className="button button-primary compact session-action-button"
                                  type="button"
                                  onClick={() => openSessionAttendance(session)}
                                  disabled={!canOpenSession || sessionActionId === session.id}
                                >
                                  <Play size={17} aria-hidden="true" />
                                  Open Attendance
                                </button>
                                <button
                                  className="button button-danger compact session-action-button"
                                  type="button"
                                  onClick={() => stopSessionAttendance(session)}
                                  disabled={!canStopSession || sessionActionId === session.id}
                                >
                                  <CircleStop size={17} aria-hidden="true" />
                                  Close Attendance
                                </button>
                                <button
                                  className="button button-secondary compact session-action-button"
                                  type="button"
                                  onClick={() => copySessionLink(session)}
                                >
                                  {copiedSessionId === session.id ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                                  Copy Link
                                </button>
                                <Link className="button button-secondary compact session-action-button" to={`/attend/${session.token}`} target="_blank">
                                  <ExternalLink size={17} aria-hidden="true" />
                                  Open Attendance Link
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className="table-section" aria-label="Attendance submissions">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Roster</p>
                  <h2>Attendance Submissions</h2>
                </div>
              </div>
              <div className="table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>Employee ID</th>
                      <th>Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.length === 0 ? (
                      <tr>
                        <td colSpan="2" className="center muted">No attendance submitted yet.</td>
                      </tr>
                    ) : (
                      sortedAttendance.map((entry) => (
                        <tr key={entry.employeeId}>
                          <td><strong>{entry.employeeId}</strong></td>
                          <td>{entry.employeeName}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <section className="empty-state">
            <h2>Training not found</h2>
          </section>
        )}

        {showStopConfirm && (
          <div className="modal-backdrop" role="presentation">
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="stop-attendance-title">
              <h2 id="stop-attendance-title">Stop Attendance</h2>
              <p>Stop attendance now? Participants will no longer be able to submit.</p>
              <div className="modal-actions">
                <button className="button button-secondary" type="button" onClick={() => setShowStopConfirm(false)}>
                  Cancel
                </button>
                <button className="button button-danger" type="button" onClick={stopAttendance} disabled={stopping}>
                  <CircleStop size={18} aria-hidden="true" />
                  {stopping ? 'Stopping...' : 'Stop Attendance'}
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedQrSession && (
          <div className="modal-backdrop" role="presentation">
            <div className="modal session-qr-modal" role="dialog" aria-modal="true" aria-labelledby="session-qr-title">
              <h2 id="session-qr-title">Day {selectedQrSession.dayNumber} QR Code</h2>
              <p>{formatSessionDate(selectedQrSession.sessionDate)} - {formatSessionTime(selectedQrSession.startDateTime)} - {formatSessionTime(selectedQrSession.endDateTime)}</p>
              <div className="session-qr-link">
                <input value={getSessionAttendanceLink(selectedQrSession)} readOnly aria-label="Selected session attendance link" />
                <button className="icon-button" type="button" onClick={() => copySessionLink(selectedQrSession)} title="Copy attendance link">
                  {copiedSessionId === selectedQrSession.id ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                  <span className="sr-only">Copy attendance link</span>
                </button>
              </div>
              <div className="session-qr-preview">
                {loadingSessionQr ? (
                  <div className="qr-loading">
                    <div className="spinner" />
                  </div>
                ) : selectedQrSrc ? (
                  <img src={selectedQrSrc} alt={`QR code for Day ${selectedQrSession.dayNumber}`} />
                ) : (
                  <p className="muted">QR code is not available.</p>
                )}
              </div>
              {sessionQrError && <div className="alert error">{sessionQrError}</div>}
              <div className="modal-actions">
                <button className="button button-secondary" type="button" onClick={closeSessionQr}>
                  Close
                </button>
                <Link className="button button-secondary" to={`/attend/${selectedQrSession.token}`} target="_blank">
                  <ExternalLink size={18} aria-hidden="true" />
                  Open Attendance Link
                </Link>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={downloadSelectedSessionQr}
                  disabled={!selectedQrSrc}
                >
                  <Download size={18} aria-hidden="true" />
                  Download QR as JPG
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="modal-backdrop" role="presentation">
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-training-title">
              <h2 id="delete-training-title">Delete Training</h2>
              <p>Are you sure you want to delete this training and all captured attendance?</p>
              <div className="modal-actions">
                <button className="button button-secondary" type="button" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </button>
                <button className="button button-danger" type="button" onClick={deleteTraining} disabled={deleting}>
                  <Trash2 size={18} aria-hidden="true" />
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default TrainingDetails;
