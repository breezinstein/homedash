// Fetch wrapper for /api/monitor/* endpoints. Reuses the shared http module
// so 401 → AuthRequiredError forwarding and CSRF headers are consistent.
import { apiFetchJson, AuthRequiredError } from '../api/http';
import type { MonitorOverview, AlertInstance } from '../types';

export { AuthRequiredError };

export async function fetchOverview(): Promise<MonitorOverview> {
  return apiFetchJson<MonitorOverview>('/api/monitor/overview');
}

export async function fetchAlerts(): Promise<{ firing: AlertInstance[]; recentlyResolved: AlertInstance[] }> {
  return apiFetchJson('/api/monitor/alerts');
}

export async function ackAlert(id: string): Promise<void> {
  await apiFetchJson(`/api/monitor/alerts/${encodeURIComponent(id)}/ack`, { method: 'POST' });
}
