import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import type { MonitorOverview } from '../../types';

interface MonitorHeaderProps {
  overview: MonitorOverview | null;
  alertCount: number;
  isLoading: boolean;
  connectionError: string | null;
}

function statusLabel(s: string): string {
  switch (s) {
    case 'ok': return 'All systems normal';
    case 'degraded': return 'Degraded';
    case 'critical': return 'Critical alert';
    default: return 'Unknown';
  }
}

export function MonitorHeader({ overview, alertCount, isLoading, connectionError }: MonitorHeaderProps) {
  const gs = overview?.globalStatus ?? 'ok';

  return (
    <header className="h-[60px] flex items-center gap-4 px-5 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Logo */}
      <div className="w-[34px] h-[34px] rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] grid place-items-center text-[17px]">
        ▣
      </div>
      <div className="flex flex-col">
        <h1 className="text-[16px] font-bold text-[var(--color-text-primary)] leading-tight">HomeLab Monitor</h1>
        <p className="text-[11px] text-[var(--color-text-secondary)]">
          {isLoading ? 'Connecting…' : connectionError ? 'Offline' : `${overview?.hosts.length ?? 0} hosts · solar · docker — live overview`}
        </p>
      </div>

      <div className="flex-1" />

      {/* Global status pill */}
      {!isLoading && (
        <StatusPill status={gs} label={statusLabel(gs)} />
      )}

      {/* Alert bell */}
      <div className="relative w-[38px] h-[38px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] grid place-items-center text-[var(--color-text-secondary)]">
        <Activity className="w-4 h-4" />
        {alertCount > 0 && (
          <span className="absolute -top-[6px] -right-[6px] min-w-[18px] h-[18px] px-[5px] rounded-full bg-[var(--color-error)] text-white text-[10px] font-bold grid place-items-center tabular-nums">
            {alertCount}
          </span>
        )}
      </div>

      {/* Clock */}
      <div className="text-right leading-tight">
        <ClockDisplay />
        <p className="text-[10px] text-[var(--color-text-secondary)]">
          {connectionError ? 'disconnected' : isLoading ? 'loading…' : `poll ${Math.round((overview?.pollIntervalMs ?? 5000) / 1000)}s`}
        </p>
      </div>
    </header>
  );
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const colors: Record<string, string> = {
    ok: 'text-[var(--color-success)] bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] border-[color-mix(in_srgb,var(--color-success)_35%,transparent)]',
    degraded: 'text-[var(--color-warning)] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] border-[color-mix(in_srgb,var(--color-warning)_40%,transparent)]',
    critical: 'text-white bg-[color-mix(in_srgb,var(--color-error)_22%,transparent)] border-[color-mix(in_srgb,var(--color-error)_60%,transparent)]',
  };

  return (
    <div className={`flex items-center gap-2 px-4 py-[6px] rounded-full font-bold text-[12px] tracking-[.5px] uppercase border ${colors[status] || colors.ok} ${status === 'critical' ? 'animate-pulse' : ''}`}
      style={status === 'critical' ? { boxShadow: '0 0 0 0 rgba(239,68,68,.5)', animation: 'pulse 1.6s infinite' } : undefined}>
      <span className={`w-[9px] h-[9px] rounded-full ${status === 'ok' ? 'bg-[var(--color-success)]' : status === 'degraded' ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-error)]'}`}
        style={{ boxShadow: `0 0 8px currentColor` }} />
      {label}
    </div>
  );
}

function ClockDisplay() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = now.toTimeString().slice(0, 8);
  return <span className="text-[17px] font-bold tabular-nums text-[var(--color-text-primary)]">{time}</span>;
}
