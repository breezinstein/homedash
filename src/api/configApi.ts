import type { ServerStats } from '../types';
import { apiFetch } from './http';

// Use relative URLs for reverse proxy compatibility
const API_BASE = '';

// Dedupe in-flight icon proxy requests. Many service cards can share the
// same external icon URL (or the same card can re-mount under StrictMode),
// which previously meant N concurrent requests to the same endpoint.
// Resolved results are also cached for the life of the page so subsequent
// re-renders skip the network entirely.
type ProxyIconResult = { cached: boolean; url: string };
const inFlightIconRequests = new Map<string, Promise<ProxyIconResult>>();
const resolvedIconResults = new Map<string, ProxyIconResult>();

function proxyIconCoalesced(url: string): Promise<ProxyIconResult> {
  const resolved = resolvedIconResults.get(url);
  if (resolved) return Promise.resolve(resolved);
  const existing = inFlightIconRequests.get(url);
  if (existing) return existing;
  // Icons are a public, read-only concern: use plain fetch (with credentials
  // so a logged-in admin still gets any future scoped behaviour) rather than
  // apiFetch, so a stray 401 here never hijacks the login modal.
  const promise = fetch(`${API_BASE}/api/icons/proxy?url=${encodeURIComponent(url)}`, {
    credentials: 'include',
  })
    .then(res => {
      if (!res.ok) throw new Error('Failed to proxy icon');
      return res.json() as Promise<ProxyIconResult>;
    })
    .then(result => {
      resolvedIconResults.set(url, result);
      inFlightIconRequests.delete(url);
      return result;
    })
    .catch(err => {
      inFlightIconRequests.delete(url);
      throw err;
    });
  inFlightIconRequests.set(url, promise);
  return promise;
}

export interface ApiResponse<T> {
  success?: boolean;
  error?: string;
  data?: T;
}

export const configApi = {
  // Get config from server
  async getConfig(): Promise<{ config: any; lastModified: number }> {
    const res = await fetch(`${API_BASE}/api/config`);
    if (!res.ok) throw new Error('Failed to fetch config');
    return res.json();
  },

  // Save config to server
  async saveConfig(config: any): Promise<{ success: boolean; lastModified: number }> {
    const res = await apiFetch(`${API_BASE}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error('Failed to save config');
    return res.json();
  },

  // Check if config changed on server
  async checkForChanges(since: number): Promise<{ changed: boolean; lastModified: number }> {
    const res = await fetch(`${API_BASE}/api/config/check?since=${since}`);
    if (!res.ok) throw new Error('Failed to check config');
    return res.json();
  },

  // List backups
  async listBackups(): Promise<Array<{ name: string; date: string; filename: string; serviceCount: number }>> {
    const res = await apiFetch(`${API_BASE}/api/backups`);
    if (!res.ok) throw new Error('Failed to list backups');
    return res.json();
  },

  // Create backup
  async createBackup(name?: string): Promise<{ success: boolean; filename: string }> {
    const res = await apiFetch(`${API_BASE}/api/backups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error('Failed to create backup');
    return res.json();
  },

  // Restore backup
  async restoreBackup(filename: string): Promise<{ success: boolean }> {
    const res = await apiFetch(`${API_BASE}/api/backups/restore/${filename}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to restore backup');
    return res.json();
  },

  // Delete backup
  async deleteBackup(filename: string): Promise<{ success: boolean }> {
    const res = await apiFetch(`${API_BASE}/api/backups/${filename}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete backup');
    return res.json();
  },

  // Upload icon
  async uploadIcon(file: File): Promise<{ url: string }> {
    const res = await apiFetch(`${API_BASE}/api/upload-icon?name=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file
    });
    if (!res.ok) throw new Error('Failed to upload icon');
    return res.json();
  },

  // Proxy and cache an external icon
  async proxyIcon(url: string): Promise<{ cached: boolean; url: string }> {
    return proxyIconCoalesced(url);
  },

  // Get icon cache info
  async getIconCacheInfo(): Promise<{ count: number; totalSize: number; totalSizeFormatted: string }> {
    const res = await apiFetch(`${API_BASE}/api/icons/cache-info`);
    if (!res.ok) throw new Error('Failed to get cache info');
    return res.json();
  },

  // Clear icon cache
  async clearIconCache(): Promise<{ success: boolean; deletedCount: number }> {
    const res = await apiFetch(`${API_BASE}/api/icons/cache`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to clear cache');
    return res.json();
  },

  // Get live server stats for the host machine
  async getStats(): Promise<ServerStats> {
    const res = await apiFetch(`${API_BASE}/api/stats`);
    if (!res.ok) throw new Error('Failed to fetch server stats');
    return res.json();
  },

  // Get live server stats from a remote Glances instance (proxied by our server).
  // Optional Basic-auth credentials are sent via headers (kept out of the URL/query
  // so they aren't logged) for password-protected Glances instances.
  async getRemoteStats(
    url: string,
    auth?: { username?: string; password?: string }
  ): Promise<ServerStats> {
    const headers: Record<string, string> = {};
    if (auth?.username) {
      headers['X-Glances-Username'] = auth.username;
      headers['X-Glances-Password'] = auth.password ?? '';
    }
    const res = await apiFetch(
      `${API_BASE}/api/stats/remote?url=${encodeURIComponent(url)}`,
      { headers }
    );
    if (!res.ok) {
      let message = 'Failed to fetch remote server stats';
      try {
        const body = await res.json();
        if (body?.error) message = body.error;
      } catch { /* ignore parse errors */ }
      throw new Error(message);
    }
    return res.json();
  }
};
