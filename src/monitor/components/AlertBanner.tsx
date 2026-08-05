import { AlertTriangle } from 'lucide-react';
import type { AlertInstance } from '../../types';

interface AlertBannerProps {
  alerts: AlertInstance[];
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').trim();
}

export function AlertBanner({ alerts }: AlertBannerProps) {
  const criticals = alerts.filter((a) => a.severity === 'critical');
  const warnings = alerts.filter((a) => a.severity === 'warning');
  if (alerts.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 20px',
        background:
          criticals.length > 0
            ? 'rgba(231,76,60,0.14)'
            : 'rgba(230,126,34,0.1)',
        borderBottom: `1px solid ${
          criticals.length > 0
            ? 'rgba(231,76,60,0.35)'
            : 'rgba(230,126,34,0.3)'
        }`,
        fontSize: 13,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <AlertTriangle
        size={16}
        style={{
          color: criticals.length > 0 ? '#e74c3c' : '#e67e22',
          flexShrink: 0,
        }}
      />
      {criticals.length > 0 && (
        <span style={{ color: '#e74c3c', fontWeight: 700 }}>
          ▲ {criticals.length} CRITICAL{criticals.length > 1 ? 'S' : ''}
        </span>
      )}
      {warnings.length > 0 && (
        <span style={{ color: '#e67e22', fontWeight: 700 }}>
          {criticals.length > 0 && (
            <span style={{ color: '#a0a0a0', margin: '0 4px' }}>·</span>
          )}
          {warnings.length} WARNING{warnings.length > 1 ? 'S' : ''}
        </span>
      )}
      <span style={{ color: '#a0a0a0', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {[...alerts]
          .sort((a, b) => {
            const rank = (s: string) => (s === 'critical' ? 0 : s === 'warning' ? 1 : 2);
            return rank(a.severity) - rank(b.severity);
          })
          .slice(0, 3)
          .map((a) => stripHtml(a.message))
          .join('  ·  ')}
      </span>
    </div>
  );
}
