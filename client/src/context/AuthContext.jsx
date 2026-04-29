import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authAPI, clearStoredToken, getStoredToken, setStoredToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      const storedToken = getStoredToken();
      setToken(storedToken);

      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await authAPI.me();
        if (active) setUser(response.data.user);
      } catch {
        clearStoredToken();
        if (active) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadUser();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleAuthExpired() {
      setToken(null);
      setUser(null);
      setLoading(false);
    }

    window.addEventListener('attendance-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('attendance-auth-expired', handleAuthExpired);
  }, []);

  async function login(credentials) {
    const response = await authAPI.login(credentials);
    setStoredToken(response.data.token);
    setToken(response.data.token);
    setUser(response.data.user);
    return response.data.user;
  }

  async function signup(payload) {
    const response = await authAPI.signup(payload);
    return response.data;
  }

  function logout() {
    clearStoredToken();
    setToken(null);
    setUser(null);
  }

  const value = useMemo(() => ({
    token,
    user,
    loading,
    login,
    signup,
    logout
  }), [token, user, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
