import { useState, useEffect } from 'react';
import { Activity, Settings } from 'lucide-react';
import type { MonitorOverview } from '../../types';

interface MonitorHeaderProps {
  overview: MonitorOverview | null;
  isLoading: boolean;
  connectionError: string | null;
  onSettings?: () => void;
}

function statusLabel(s: string): string {
  switch (s) {
    case 'ok':
      return 'All systems normal';
    case 'degraded':
      return 'Degraded';
    case 'critical':
      return 'Critical alert';
    default:
      return 'Unknown';
  }
}

export function MonitorHeader({
  overview,
  isLoading,
  connectionError,
  onSettings,
}: MonitorHeaderProps) {
  const gs = overview?.globalStatus ?? 'ok';

  return (
    <header className="monitor-header">
      {/* Logo */}
      <div className="monitor-logo">
        <Activity className="w-5 h-5" strokeWidth={2.25} />
      </div>
      <div className="monitor-title-group">
        <h1 className="monitor-title">Homelab Dashboard</h1>
        <p className="monitor-subtitle">
          {isLoading
            ? 'Connecting…'
            : connectionError
              ? 'Offline'
              : `${overview?.hosts.length ?? 0} hosts · solar · docker — live overview`}
        </p>
      </div>

      <div style={{ flex: 1 }} />

      {/* Settings */}
      {onSettings && (
        <button
          className="monitor-settings-btn"
          onClick={onSettings}
          aria-label="Monitor settings"
          title="Monitor settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      )}

      {/* Global status pill */}
      {!isLoading && <StatusPill status={gs} label={statusLabel(gs)} />}

      {/* Clock */}
      <div className="monitor-clock">
        <ClockDisplay />
        <p className="monitor-poll">
          {connectionError
            ? 'disconnected'
            : isLoading
              ? 'loading…'
              : `poll ${Math.round((overview?.pollIntervalMs ?? 5000) / 1000)}s`}
        </p>
      </div>
    </header>
  );
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const variant =
    status === 'ok'
      ? 'status-pill--ok'
      : status === 'degraded'
        ? 'status-pill--degraded'
        : 'status-pill--critical';

  return (
    <div className={`status-pill ${variant}`}>
      <span className="status-pill-dot" />
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
  return <span className="clock-time">{time}</span>;
}
