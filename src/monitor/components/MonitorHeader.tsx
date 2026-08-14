import { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
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
      <div className="monitor-logo">▣</div>
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
  const dotColor =
    status === 'ok'
      ? '#2ecc71'
      : status === 'degraded'
        ? '#e67e22'
        : '#e74c3c';
  const borderColor =
    status === 'ok'
      ? 'rgba(46,204,113,.35)'
      : status === 'degraded'
        ? 'rgba(230,126,34,.4)'
        : 'rgba(231,76,60,.6)';
  const bgColor =
    status === 'ok'
      ? 'rgba(46,204,113,.1)'
      : status === 'degraded'
        ? 'rgba(230,126,34,.1)'
        : 'rgba(231,76,60,.22)';

  return (
    <div
      className="status-pill"
      style={{
        color: dotColor,
        backgroundColor: bgColor,
        borderColor: borderColor,
        animation: status === 'critical' ? 'pulse 1.6s infinite' : undefined,
        boxShadow:
          status === 'critical'
            ? '0 0 0 0 rgba(239,68,68,.5)'
            : undefined,
      }}
    >
      <span
        className="status-pill-dot"
        style={{ backgroundColor: dotColor, boxShadow: `0 0 8px ${dotColor}` }}
      />
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
