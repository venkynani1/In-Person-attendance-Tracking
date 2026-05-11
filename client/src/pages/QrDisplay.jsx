import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Clock, Download, QrCode, UsersRound } from 'lucide-react';
import { getApiError, trainingAPI } from '../services/api.js';
import { downloadQrAsJpg } from '../utils/qrDownload.js';
import { formatDateTime, getCountdownMessage, getSessionState } from '../utils/session.js';

function QrDisplay() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [training, setTraining] = useState(null);
  const [displaySession, setDisplaySession] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrSrc, setQrSrc] = useState('');
  const [qrDownloadError, setQrDownloadError] = useState('');
  const [downloadingQr, setDownloadingQr] = useState(false);
  const [now, setNow] = useState(() => new Date());

  async function loadDisplay(options = {}) {
    try {
      if (!options.silent) setLoading(true);
      const [trainingResponse, attendanceResponse, sessionsResponse] = await Promise.all([
        trainingAPI.getTraining(id),
        sessionId ? trainingAPI.getSessionAttendance(id, sessionId) : trainingAPI.getAttendance(id),
        sessionId ? trainingAPI.getSessions(id) : Promise.resolve({ data: [] })
      ]);
      setTraining(trainingResponse.data);
      setDisplaySession(sessionId ? sessionsResponse.data.find((session) => session.id === sessionId) || null : null);
      setAttendance(attendanceResponse.data);
      setError('');
    } catch (err) {
      setError(getApiError(err, 'Failed to load QR display.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDisplay();
    const refreshId = window.setInterval(() => loadDisplay({ silent: true }), 15000);
    return () => window.clearInterval(refreshId);
  }, [id, sessionId]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    async function loadQrImage() {
      try {
        const response = sessionId
          ? await trainingAPI.getSessionQrImage(id, sessionId)
          : await trainingAPI.getQrImage(id);
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
        if (active) setError(getApiError(err, 'Failed to load QR code.'));
      }
    }

    loadQrImage();

    return () => {
      active = false;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [id, sessionId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const displayTraining = training && displaySession
    ? {
      ...training,
      trainingName: `${training.trainingName} - Day ${displaySession.dayNumber}`,
      startDateTime: displaySession.startDateTime,
      endDateTime: displaySession.endDateTime,
      manuallyStopped: displaySession.manuallyStopped,
      attendanceOpenedAt: displaySession.attendanceOpenedAt
    }
    : training;
  const sessionState = displayTraining ? getSessionState(displayTraining, now) : null;

  async function handleDownloadQr() {
    try {
      setDownloadingQr(true);
      setQrDownloadError('');
      await downloadQrAsJpg({
        qrSrc,
        trainingName: displayTraining.trainingName
      });
    } catch (err) {
      setQrDownloadError(err.message || 'Failed to download QR code.');
    } finally {
      setDownloadingQr(false);
    }
  }

  return (
    <main className="qr-display-page">
      <Link className="qr-back-link" to={`/training/${id}`}>
        <ArrowLeft size={18} aria-hidden="true" />
        Back to details
      </Link>

      {loading ? (
        <section className="qr-display-card">
          <div className="spinner" />
          <p>Loading QR display...</p>
        </section>
      ) : error ? (
        <section className="qr-display-card">
          <div className="alert error">{error}</div>
        </section>
      ) : displayTraining ? (
        <section className="qr-display-card">
          <div className="qr-display-copy">
            <p className="eyebrow">Live Attendance</p>
            <h1>{displayTraining.trainingName}</h1>
            <p>Scan to mark attendance</p>
            <div className="qr-display-meta">
              <span className={`status-badge ${sessionState.badgeClass}`}>{sessionState.label}</span>
              <span><Clock size={18} aria-hidden="true" />{getCountdownMessage(displayTraining, now)}</span>
              <span><UsersRound size={18} aria-hidden="true" />{attendance.length} present</span>
            </div>
            <div className="qr-display-window">
              {formatDateTime(displayTraining.startDateTime)} to {formatDateTime(displayTraining.endDateTime)}
            </div>
            <div className="qr-display-instruction">
              Enter Employee ID and Name to confirm attendance.
            </div>
          </div>

          <div className="qr-display-code-wrap">
            <div className="qr-display-code">
              {qrSrc ? (
                <img src={qrSrc} alt={`QR code for ${displayTraining.trainingName}`} />
              ) : (
                <div className="qr-loading">
                  <div className="spinner" />
                </div>
              )}
            </div>
            <div className="qr-display-footnote">
              <QrCode size={18} aria-hidden="true" />
              Scan with your phone camera
            </div>
            <button
              className="button button-secondary compact qr-download-button"
              type="button"
              onClick={handleDownloadQr}
              disabled={!qrSrc || downloadingQr}
            >
              <Download size={18} aria-hidden="true" />
              {downloadingQr ? 'Preparing JPG...' : 'Download QR as JPG'}
            </button>
            {qrDownloadError && <div className="qr-download-error">{qrDownloadError}</div>}
          </div>
        </section>
      ) : (
        <section className="qr-display-card">
          <h1>Training not found</h1>
        </section>
      )}
    </main>
  );
}

export default QrDisplay;
