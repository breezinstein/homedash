import { AlertTriangle } from 'lucide-react';
import type { AlertInstance } from '../../types';

interface AlertBannerProps {
  alerts: AlertInstance[];
}

export function AlertBanner({ alerts }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  const criticals = alerts.filter(a => a.severity === 'critical');
  const warnings = alerts.filter(a => a.severity === 'warning');

  return (
    <div className="flex items-center gap-3 px-5 py-[9px] bg-gradient-to-r from-[color-mix(in_srgb,var(--color-error)_16%,transparent)] to-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] border-b border-[color-mix(in_srgb,var(--color-error)_40%,transparent)] text-[13px] overflow-hidden whitespace-nowrap">
      <AlertTriangle className="w-4 h-4 text-[var(--color-error)] flex-shrink-0" />
      {criticals.length > 0 && (
        <span className="text-[var(--color-error)] font-bold">
          ▲ {criticals.length} CRITICAL{alerts.filter(a => a.severity === 'critical').length > 1 ? 'S' : ''}
        </span>
      )}
      {warnings.length > 0 && (
        <span className="text-[var(--color-warning)] font-bold">
          {criticals.length > 0 && <span className="text-[var(--color-text-secondary)] mx-1">·</span>}
          {warnings.length} WARNING{warnings.length > 1 ? 'S' : ''}
        </span>
      )}
      <span className="text-[var(--color-text-secondary)] truncate">
        {alerts.slice(0, 3).map(a => a.message.replace(/<[^>]+>/g, '')).join('  ·  ')}
      </span>
    </div>
  );
}
