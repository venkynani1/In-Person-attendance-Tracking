import axios from 'axios';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

console.log('API_BASE_URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 18000
});

export function getStoredToken() {
  return localStorage.getItem('attendanceAuthToken');
}

export function setStoredToken(token) {
  localStorage.setItem('attendanceAuthToken', token);
}

export function clearStoredToken() {
  localStorage.removeItem('attendanceAuthToken');
}

function isPublicRoute() {
  return (
    window.location.pathname === '/login' ||
    window.location.pathname === '/signup' ||
    window.location.pathname === '/forgot-password' ||
    window.location.pathname === '/reset-password' ||
    window.location.pathname.startsWith('/attend/')
  );
}

function redirectToLogin() {
  if (isPublicRoute()) return;

  window.location.replace('/login');
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearStoredToken();
      window.dispatchEvent(new CustomEvent('attendance-auth-expired'));
      redirectToLogin();
    }

    return Promise.reject(error);
  }
);

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
  getNominations(id) {
    return requestWithRetry(() =>
      api.get(`/api/trainings/${id}/nominations`)
    );
  },
  async uploadNominations(id, formData) {
    await checkHealth();
    return requestWithRetry(
      () => api.post(`/api/trainings/${id}/nominations`, formData),
      { retries: 0 }
    );
  },
  getQrImage(id) {
    return requestWithRetry(() =>
      api.get(`/api/trainings/${id}/qr`, {
        responseType: 'blob'
      })
    );
  },
  exportAttendance(id) {
    return requestWithRetry(() =>
      api.get(`/api/trainings/${id}/export`, {
        responseType: 'blob'
      })
    );
  },
  stopAttendance(id) {
    return requestWithRetry(() =>
      api.patch(`/api/trainings/${id}/stop`)
    );
  },
  deleteTraining(id) {
    return requestWithRetry(() =>
      api.delete(`/api/trainings/${id}`)
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

export const authAPI = {
  login(payload) {
    return requestWithRetry(() =>
      api.post('/api/auth/login', payload),
      { retries: 0 }
    );
  },
  signup(payload) {
    return requestWithRetry(() =>
      api.post('/api/auth/signup', payload),
      { retries: 0 }
    );
  },
  forgotPassword(payload) {
    return requestWithRetry(() =>
      api.post('/api/auth/forgot-password', payload),
      { retries: 0 }
    );
  },
  resetPassword(payload) {
    return requestWithRetry(() =>
      api.post('/api/auth/reset-password', payload),
      { retries: 0 }
    );
  },
  me() {
    return requestWithRetry(() =>
      api.get('/api/auth/me'),
      { retries: 0 }
    );
  }
};

export const adminAPI = {
  getUsers() {
    return requestWithRetry(() =>
      api.get('/api/admin/users')
    );
  },
  getPendingUsers() {
    return requestWithRetry(() =>
      api.get('/api/admin/pending-users')
    );
  },
  approveUser(id) {
    return requestWithRetry(() =>
      api.patch(`/api/admin/users/${id}/approve`)
    );
  },
  rejectUser(id) {
    return requestWithRetry(() =>
      api.patch(`/api/admin/users/${id}/reject`)
    );
  }
};

export function getApiError(error, fallback) {
  return errorMessage(error, fallback);
}
