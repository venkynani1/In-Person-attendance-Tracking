import { useEffect, useState } from 'react';
import { Cloud, LoaderCircle, WifiOff } from 'lucide-react';
import { checkHealth, subscribeBackendStatus } from '../services/api.js';

function BackendWakeBanner() {
  const [status, setStatus] = useState({ state: 'checking', message: 'Checking backend connection...' });

  useEffect(() => {
    const unsubscribe = subscribeBackendStatus(setStatus);
    checkHealth()
      .then(() => setStatus({ state: 'ready' }))
      .catch(() => {
        setStatus({
          state: 'error',
          message: 'Loading...'
        });
      });

    return unsubscribe;
  }, []);

  if (status.state === 'ready') return null;

  const isWaking = status.state === 'checking' || status.state === 'waking';
  const Icon = isWaking ? LoaderCircle : WifiOff;

  return (
    <div className={`backend-banner ${isWaking ? 'waking' : 'error'}`} role="status">
      <Cloud size={18} aria-hidden="true" />
      <span>{status.message}</span>
      <Icon size={18} aria-hidden="true" className={isWaking ? 'spin-icon' : ''} />
    </div>
  );
}

export default BackendWakeBanner;
