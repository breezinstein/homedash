import { Bell, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { AlertInstance, Severity } from '../../types';
import { SEVERITY_COLORS } from '../constants';
import { formatAgo, stripHtml } from '../format';

interface AlertsRailProps {
  firing: AlertInstance[];
  recentlyResolved: AlertInstance[];
}

const SEV_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

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
        <span className="alerts-header-icon">
          <Bell className="w-4 h-4" />
        </span>
        <span className="alerts-title">Alerts</span>
        {firingCount > 0 && (
          <span className="alerts-firing-badge">{firingCount} firing</span>
        )}
      </div>

      {/* Firing — critical first, then by age */}
      <AlertGroup
        title="Firing"
        alerts={[...firing].sort(
          (a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.since - a.since,
        )}
        variant="firing"
      />
      {/* Recently resolved */}
      <AlertGroup
        title="Recently Resolved"
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
        const color = isFiring ? (SEVERITY_COLORS[a.severity] ?? '#f59e0b') : '#34d399';
        const Icon = isFiring ? AlertTriangle : CheckCircle2;
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
            <Icon className="w-4 h-4 flex-shrink-0" />
            <div className="alert-text">
              <span>{stripHtml(a.message)}</span>
              <span className="alert-ago">
                {isFiring ? `${a.severity.toUpperCase()} · ` : ''}
                {formatAgo(a.since)} ago
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
