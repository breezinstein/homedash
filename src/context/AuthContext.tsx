import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../api/authApi';
import { onAuthRequired } from '../api/http';

interface AuthContextValue {
  // True when the server has an admin credential configured. False = open mode.
  authEnabled: boolean;
  // True when the current browser session holds an admin cookie OR when auth
  // is disabled (open mode treats every viewer as admin, matching pre-auth
  // releases).
  authenticated: boolean;
  // True until the first status fetch resolves; UI can render a tiny splash
  // instead of flickering between modes.
  ready: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  // Set by a 401 from any API call. UI subscribes to open the login modal.
  loginRequired: boolean;
  acknowledgeLoginRequired: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authEnabled, setAuthEnabled] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [ready, setReady] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const status = await authApi.status();
      setAuthEnabled(status.authEnabled);
      setAuthenticated(status.authenticated);
    } catch {
      // Network failure: stay in last known state but mark ready so UI renders.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // A 401 from any API call means our session expired (or auth was just
  // enabled). Flip the flag so the UI opens the login modal.
  useEffect(() => {
    return onAuthRequired(() => {
      setAuthenticated(false);
      setLoginRequired(true);
    });
  }, []);

  const login = useCallback(async (password: string) => {
    const ok = await authApi.login(password);
    if (ok) {
      setAuthenticated(true);
      setLoginRequired(false);
    }
    return ok;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setAuthenticated(false);
  }, []);

  const acknowledgeLoginRequired = useCallback(() => setLoginRequired(false), []);

  const value = useMemo<AuthContextValue>(() => ({
    authEnabled,
    authenticated,
    ready,
    login,
    logout,
    refresh,
    loginRequired,
    acknowledgeLoginRequired,
  }), [authEnabled, authenticated, ready, login, logout, refresh, loginRequired, acknowledgeLoginRequired]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
