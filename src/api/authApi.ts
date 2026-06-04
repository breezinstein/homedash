import { apiFetch, apiFetchJson } from './http';

export interface AuthStatus {
  authEnabled: boolean;
  authenticated: boolean;
}

export const authApi = {
  async status(): Promise<AuthStatus> {
    return apiFetchJson<AuthStatus>('/api/auth/status');
  },

  // Returns true on success, false when the password is rejected. Throws on
  // throttle (429) or unexpected errors so the caller can surface them.
  async login(password: string): Promise<boolean> {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.status === 204) return true;
    if (res.status === 401) return false;
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After') || '';
      throw new Error(`Too many failed attempts. Retry after ${retryAfter}s.`);
    }
    throw new Error(`Login failed (${res.status})`);
  },

  async logout(): Promise<void> {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  },
};
