import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, QrCode, UsersRound } from 'lucide-react';
import { getApiError, trainingAPI } from '../services/api.js';
import { formatDateTime, getCountdownMessage, getSessionState } from '../utils/session.js';

function QrDisplay() {
  const { id } = useParams();
  const [training, setTraining] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrSrc, setQrSrc] = useState('');
  const [now, setNow] = useState(() => new Date());

  async function loadDisplay(options = {}) {
    try {
      if (!options.silent) setLoading(true);
      const [trainingResponse, attendanceResponse] = await Promise.all([
        trainingAPI.getTraining(id),
        trainingAPI.getAttendance(id)
      ]);
      setTraining(trainingResponse.data);
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
        if (active) setError(getApiError(err, 'Failed to load QR code.'));
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

  const sessionState = training ? getSessionState(training, now) : null;

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
      ) : training ? (
        <section className="qr-display-card">
          <div className="qr-display-copy">
            <p className="eyebrow">Live Attendance</p>
            <h1>{training.trainingName}</h1>
            <p>Scan to mark attendance</p>
            <div className="qr-display-meta">
              <span className={`status-badge ${sessionState.badgeClass}`}>{sessionState.label}</span>
              <span><Clock size={18} aria-hidden="true" />{getCountdownMessage(training, now)}</span>
              <span><UsersRound size={18} aria-hidden="true" />{attendance.length} present</span>
            </div>
            <div className="qr-display-window">
              {formatDateTime(training.startDateTime)} to {formatDateTime(training.endDateTime)}
            </div>
            <div className="qr-display-instruction">
              Enter Employee ID and Name to confirm attendance.
            </div>
          </div>

          <div className="qr-display-code-wrap">
            <div className="qr-display-code">
              {qrSrc ? (
                <img src={qrSrc} alt={`QR code for ${training.trainingName}`} />
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
