// Fetch wrapper for /api/monitor/* endpoints. Reuses the shared http module
// so 401 → AuthRequiredError forwarding and CSRF headers are consistent.
import { apiFetchJson } from '../api/http';
import type { MonitorOverview, AlertInstance, CertificateSnapshot } from '../types';

export async function fetchOverview(): Promise<MonitorOverview> {
  return apiFetchJson<MonitorOverview>('/api/monitor/overview');
}

export async function fetchAlerts(): Promise<{ firing: AlertInstance[]; recentlyResolved: AlertInstance[] }> {
  return apiFetchJson('/api/monitor/alerts');
}

export async function ackAlert(id: string): Promise<void> {
  await apiFetchJson(`/api/monitor/alerts/${encodeURIComponent(id)}/ack`, { method: 'POST' });
}

// Force a re-check of TLS certificate expiry (all, or a subset by id),
// bypassing the throttled cache. Returns the fresh CertificateSnapshot.
export async function refreshCertificates(ids?: string[]): Promise<CertificateSnapshot> {
  return apiFetchJson<CertificateSnapshot>('/api/monitor/certificates/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}
