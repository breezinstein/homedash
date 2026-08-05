import type { AlertInstance } from '../../types';

interface AlertsRailProps {
  firing: AlertInstance[];
  recentlyResolved: AlertInstance[];
  onAck: (id: string) => void;
}

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
 * Right-hand alerts sidebar matching the dashboard mockup.
 * Shows "FIRING" and "RECENTLY RESOLVED" sections with coloured alert boxes.
 */
export function AlertsRail({ firing, recentlyResolved, onAck }: AlertsRailProps) {
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

      {/* Firing */}
      <AlertGroup
        title="FIRING"
        alerts={firing}
        variant="firing"
        onAck={onAck}
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
  onAck,
}: {
  title: string;
  alerts: AlertInstance[];
  variant: 'firing' | 'ok';
  onAck?: (id: string) => void;
}) {
  if (alerts.length === 0) return null;

  return (
    <div>
      <div className="alert-group-title">{title}</div>
      {alerts.map((a) => (
        <div key={a.id} className={`alert-box ${variant}`}>
          <span>{variant === 'firing' ? '⚠️' : '✔'}</span>
          <div className="alert-text">
            <span>{stripHtml(a.message)}</span>
            <span className="alert-ago">{ago(a.since)} ago</span>
          </div>
          {variant === 'firing' && onAck && !a.acked && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAck(a.id);
              }}
              className="alert-ack-btn"
            >
              Ack
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
