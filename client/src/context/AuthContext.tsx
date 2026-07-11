import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, setJwtToken, getStoredApiKey } from '../api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithOidc: (slug: string) => void;
  logout: () => Promise<void>;
  isBootstrapMode: boolean;
  bootstrapTokenConfigured: boolean;
  /** True for admin, analyst, and API-key/bootstrap mode (null user) */
  canWrite: boolean;
  /** True for admin and API-key/bootstrap mode (null user) */
  canAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBootstrapMode, setIsBootstrapMode] = useState(false);
  const [bootstrapTokenConfigured, setBootstrapTokenConfigured] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback((token: string) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    // Refresh 2 minutes before 15-minute expiry
    refreshTimer.current = setTimeout(async () => {
      const result = await api.refreshToken();
      if (result?.token) {
        setJwtToken(result.token);
        scheduleRefresh(result.token);
      } else {
        setUser(null);
        setJwtToken(null);
      }
    }, (15 - 2) * 60 * 1000);
  }, []);

  useEffect(() => {
    async function init() {
      // Check for OIDC callback token in URL fragment (# prevents it reaching server logs)
      const urlToken = new URLSearchParams(window.location.hash.slice(1)).get('token');
      if (urlToken) {
        setJwtToken(urlToken);
        window.history.replaceState({}, '', window.location.pathname);
        try {
          const me = await api.getMe();
          setUser(me);
          scheduleRefresh(urlToken);
          setLoading(false);
          return;
        } catch { setJwtToken(null); }
      }

      // Try cookie-based refresh (returning user)
      let result = null;
      try { result = await api.refreshToken(); } catch {}
      if (result?.token) {
        setJwtToken(result.token);
        try {
          const me = await api.getMe();
          setUser(me);
          scheduleRefresh(result.token);
          setLoading(false);
          return;
        } catch { setJwtToken(null); }
      }

      // Legacy API key mode or bootstrap (no users/keys)
      const legacyKey = getStoredApiKey();
      if (legacyKey) {
        setJwtToken(null); // authHeaders will fall back to stored key
        setIsBootstrapMode(false);
        setLoading(false);
        return;
      }

      // Check if bootstrap mode (no auth entities configured on server)
      try {
        const health = await fetch('/api/health').then(r => r.json());
        setIsBootstrapMode(health.bootstrap === true);
        setBootstrapTokenConfigured(health.bootstrap_token_configured === true);
      } catch {}
      setLoading(false);
    }
    init();
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); };
  }, [scheduleRefresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: u } = await api.login(email, password);
    setJwtToken(token);
    setUser(u);
    scheduleRefresh(token);
  }, [scheduleRefresh]);

  const loginWithOidc = useCallback((slug: string) => {
    window.location.href = api.getOidcLoginUrl(slug);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setJwtToken(null);
    setUser(null);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  const canWrite = user === null || user.role === 'admin' || user.role === 'analyst';
  const canAdmin = user === null || user.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithOidc, logout, isBootstrapMode, bootstrapTokenConfigured, canWrite, canAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
