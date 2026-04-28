import axios from 'axios';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

console.log('API_BASE_URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 18000
});

const backendListeners = new Set();

export function subscribeBackendStatus(listener) {
  backendListeners.add(listener);
  return () => backendListeners.delete(listener);
}

function publishBackendStatus(status) {
  backendListeners.forEach((listener) => listener(status));
}

function isRetryable(error) {
  if (!error.response) return true;
  return [502, 503, 504].includes(error.response.status);
}

function errorMessage(error, fallback = 'Request failed. Please try again.') {
  return (
    error.response?.data?.error ||
    error.response?.data?.message ||
    error.message ||
    fallback
  );
}

async function requestWithRetry(operation, options = {}) {
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 3000;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await operation();
      publishBackendStatus({ state: 'ready' });
      return result;
    } catch (error) {
      const canRetry = attempt < retries && isRetryable(error);

      if (!canRetry) {
        publishBackendStatus({
          state: 'error',
          message: errorMessage(error)
        });
        throw error;
      }

      publishBackendStatus({
        state: 'retrying',
        message: 'Retrying connection...'
      });

      await new Promise((resolve) =>
        setTimeout(resolve, retryDelayMs)
      );
    }
  }

  throw new Error('Request retry failed.');
}

export async function checkHealth() {
  return requestWithRetry(
    () => api.get('/api/health'),
    { retries: 3, retryDelayMs: 3000 }
  );
}

export const trainingAPI = {
  async createTraining(payload) {
    await checkHealth();
    return requestWithRetry(() =>
      api.post('/api/trainings', payload)
    );
  },
  getTrainings() {
    return requestWithRetry(() =>
      api.get('/api/trainings')
    );
  },
  getTraining(id) {
    return requestWithRetry(() =>
      api.get(`/api/trainings/${id}`)
    );
  },
  getAttendance(id) {
    return requestWithRetry(() =>
      api.get(`/api/trainings/${id}/attendance`)
    );
  },
  getQrUrl(id) {
    return `${API_BASE_URL}/api/trainings/${id}/qr`;
  },
  exportAttendance(id) {
    return requestWithRetry(() =>
      api.get(`/api/trainings/${id}/export`, {
        responseType: 'blob'
      })
    );
  }
};

export const attendAPI = {
  getStatus(token) {
    return requestWithRetry(() =>
      api.get(`/api/attend/${token}/status`)
    );
  },
  async submit(token, payload) {
    await checkHealth();
    return requestWithRetry(() =>
      api.post(`/api/attend/${token}`, payload)
    );
  }
};

export function getApiError(error, fallback) {
  return errorMessage(error, fallback);
}