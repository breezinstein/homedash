import type { AlertInstance, Severity } from '../../types';

interface AlertsRailProps {
  firing: AlertInstance[];
  recentlyResolved: AlertInstance[];
}

const SEV_COLORS: Record<Severity, string> = {
  critical: '#e74c3c',
  warning: '#e67e22',
  info: '#6c5ce7',
};
const SEV_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

function ago(ts: number): string {
  const diff = Math.round((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return `${Math.round(diff / 86400)}d`;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim();
}

/**
 * Right-hand alerts sidebar. Shows "FIRING" (severity-ordered and
 * colour-coded) and "RECENTLY RESOLVED" sections.
 */
export function AlertsRail({ firing, recentlyResolved }: AlertsRailProps) {
  const firingCount = firing.length;

  return (
    <section className="alerts-card">
      {/* Header */}
      <div className="alerts-header">
        <span style={{ fontSize: 16 }}>🔔</span>
        <span className="alerts-title">Alerts</span>
        {firingCount > 0 && (
          <span className="alerts-firing-badge">{firingCount} firing</span>
        )}
      </div>

      {/* Firing — critical first, then by age */}
      <AlertGroup
        title="FIRING"
        alerts={[...firing].sort(
          (a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.since - a.since,
        )}
        variant="firing"
      />

      {/* Recently resolved */}
      <AlertGroup
        title="RECENTLY RESOLVED"
        alerts={recentlyResolved}
        variant="ok"
      />
    </section>
  );
}

function AlertGroup({
  title,
  alerts,
  variant,
}: {
  title: string;
  alerts: AlertInstance[];
  variant: 'firing' | 'ok';
}) {
  if (alerts.length === 0) return null;

  return (
    <div>
      <div className="alert-group-title">{title}</div>
      {alerts.map((a) => {
        const isFiring = variant === 'firing';
        const color = isFiring ? (SEV_COLORS[a.severity] ?? '#e67e22') : '#2ecc71';
        return (
          <div
            key={a.id}
            className="alert-box"
            style={{
              border: `1px solid ${color}`,
              background: `color-mix(in srgb, ${color} 10%, transparent)`,
              color,
            }}
          >
            <span>{isFiring ? '⚠️' : '✔'}</span>
            <div className="alert-text">
              <span>{stripHtml(a.message)}</span>
              <span className="alert-ago">
                {isFiring ? `${a.severity.toUpperCase()} · ` : ''}
                {ago(a.since)} ago
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
