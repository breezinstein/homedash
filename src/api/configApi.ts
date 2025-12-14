// Use relative URLs for reverse proxy compatibility
const API_BASE = '';

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
    const res = await fetch(`${API_BASE}/api/config`, {
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
    const res = await fetch(`${API_BASE}/api/backups`);
    if (!res.ok) throw new Error('Failed to list backups');
    return res.json();
  },

  // Create backup
  async createBackup(name?: string): Promise<{ success: boolean; filename: string }> {
    const res = await fetch(`${API_BASE}/api/backups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error('Failed to create backup');
    return res.json();
  },

  // Restore backup
  async restoreBackup(filename: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/api/backups/restore/${filename}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to restore backup');
    return res.json();
  },

  // Delete backup
  async deleteBackup(filename: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/api/backups/${filename}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete backup');
    return res.json();
  },

  // Upload icon
  async uploadIcon(file: File): Promise<{ url: string }> {
    const res = await fetch(`${API_BASE}/api/upload-icon?name=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file
    });
    if (!res.ok) throw new Error('Failed to upload icon');
    return res.json();
  },

  // Proxy and cache an external icon
  async proxyIcon(url: string): Promise<{ cached: boolean; url: string }> {
    const res = await fetch(`${API_BASE}/api/icons/proxy?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error('Failed to proxy icon');
    return res.json();
  },

  // Get icon cache info
  async getIconCacheInfo(): Promise<{ count: number; totalSize: number; totalSizeFormatted: string }> {
    const res = await fetch(`${API_BASE}/api/icons/cache-info`);
    if (!res.ok) throw new Error('Failed to get cache info');
    return res.json();
  },

  // Clear icon cache
  async clearIconCache(): Promise<{ success: boolean; deletedCount: number }> {
    const res = await fetch(`${API_BASE}/api/icons/cache`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to clear cache');
    return res.json();
  }
};
