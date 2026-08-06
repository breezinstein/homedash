import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { AlertInstance } from '../../types';
import { SEVERITY_COLORS } from '../constants';
import { stripHtml } from '../format';

interface AlertBannerProps {
  alerts: AlertInstance[];
}

/**
 * Kiosk status strip. Always rendered at a fixed height so the rest of the
 * dashboard never shifts when alerts appear or clear. Shows a subtle "all
 * nominal" state when healthy, and a severity-coloured warning when firing.
 */
export function AlertBanner({ alerts }: AlertBannerProps) {
  const firing = [...alerts]
    .sort(
      (a, b) =>
        (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1) ||
        b.since - a.since,
    );

  if (firing.length === 0) {
    return (
      <div className="alert-strip alert-strip-ok">
        <CheckCircle2 size={14} />
        <span>All systems nominal</span>
      </div>
    );
  }

  const criticals = firing.filter((a) => a.severity === 'critical').length;
  const warnings = firing.filter((a) => a.severity === 'warning').length;
  const color = criticals > 0 ? SEVERITY_COLORS.critical : SEVERITY_COLORS.warning;

  return (
    <div
      className="alert-strip alert-strip-firing"
      style={{ '--alert-color': color } as React.CSSProperties}
    >
      <AlertTriangle size={14} style={{ color, flexShrink: 0 }} />
      <span className="alert-strip-counts">
        {criticals > 0 && (
          <b style={{ color: SEVERITY_COLORS.critical }}>
            ▲ {criticals} CRITICAL{criticals > 1 ? 'S' : ''}
          </b>
        )}
        {criticals > 0 && warnings > 0 && <span className="alert-strip-sep">·</span>}
        {warnings > 0 && (
          <b style={{ color: SEVERITY_COLORS.warning }}>
            {warnings} WARNING{warnings > 1 ? 'S' : ''}
          </b>
        )}
      </span>
      <span className="alert-strip-msg">
        {firing.slice(0, 3).map((a) => stripHtml(a.message)).join('  ·  ')}
      </span>
    </div>
  );
}
