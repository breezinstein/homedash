import { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  Activity,
  Cpu,
  MemoryStick,
  HardDrive,
  Clock,
  Server,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { configApi } from '../api/configApi';
import type { ServerStats as ServerStatsData } from '../types';
import { ModalShell } from './ui';

interface ServerStatsProps {
  onClose: () => void;
}

const POLL_INTERVAL_MS = 3000;

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Pick a bar colour based on utilisation so high load reads as warning/danger.
function barColor(percent: number | null): string {
  if (percent === null) return 'var(--color-text-secondary)';
  if (percent >= 90) return 'var(--color-error)';
  if (percent >= 75) return 'var(--color-warning)';
  return 'var(--color-primary)';
}

interface StatBarProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  percent: number | null;
  detail: string;
}

function StatBar({ icon: Icon, label, percent, detail }: StatBarProps) {
  const value = percent ?? 0;
  return (
    <div className="bg-[var(--color-background)] rounded-xl border border-[var(--color-border)] p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
          <Icon className="w-4 h-4 text-[var(--color-text-secondary)]" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm font-semibold text-[var(--color-text-primary)] tabular-nums">
          {percent === null ? '—' : `${percent.toFixed(1)}%`}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--color-surface)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: barColor(percent) }}
        />
      </div>
      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{detail}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
      <span className="text-xs font-medium text-[var(--color-text-primary)] text-right break-all">
        {value}
      </span>
    </div>
  );
}

export function ServerStats({ onClose }: ServerStatsProps) {
  const [stats, setStats] = useState<ServerStatsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchStats = useCallback(async () => {
    try {
      const data = await configApi.getStats();
      if (!mountedRef.current) return;
      setStats(data);
      setError(null);
    } catch {
      if (!mountedRef.current) return;
      setError('Unable to reach the server for stats.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchStats();
    const id = setInterval(fetchStats, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchStats]);

  const cpuDetail = stats
    ? `${stats.cpu.cores ?? '?'} cores${
        stats.cpu.load['1m'] ? ` · load ${stats.cpu.load['1m'].toFixed(2)}, ${stats.cpu.load['5m'].toFixed(2)}, ${stats.cpu.load['15m'].toFixed(2)}` : ''
      }`
    : '';
  const memDetail = stats
    ? `${formatBytes(stats.memory.used)} / ${formatBytes(stats.memory.total)} used`
    : '';
  const diskDetail = stats
    ? stats.disk.total === null
      ? 'Not available on this platform'
      : `${formatBytes(stats.disk.used)} / ${formatBytes(stats.disk.total)} used · ${formatBytes(stats.disk.free)} free`
    : '';

  return (
    <ModalShell onClose={onClose} ariaLabel="Server Stats">
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] w-full max-w-2xl shadow-2xl max-h-[90vh] sm:max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
              Server Stats
            </h2>
            {!loading && !error && (
              <RefreshCw className="w-3.5 h-3.5 text-[var(--color-text-secondary)] animate-spin [animation-duration:3s]" />
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 -m-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-3 sm:p-4 overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 text-[var(--color-error)]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {loading && !stats ? (
            <div className="space-y-3" aria-hidden="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[92px] rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] animate-pulse"
                />
              ))}
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <StatBar icon={Cpu} label="CPU" percent={stats.cpu.percent} detail={cpuDetail} />
                <StatBar icon={MemoryStick} label="Memory" percent={stats.memory.percent} detail={memDetail} />
                <StatBar icon={HardDrive} label="Disk" percent={stats.disk.percent} detail={diskDetail} />
                <div className="bg-[var(--color-background)] rounded-xl border border-[var(--color-border)] p-4 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1 text-[var(--color-text-primary)]">
                    <Clock className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    <span className="text-sm font-medium">Uptime</span>
                  </div>
                  <p className="text-xl font-semibold text-[var(--color-text-primary)]">
                    {stats.uptime.formatted ?? '—'}
                  </p>
                </div>
              </div>

              {/* System info */}
              <div className="mt-4 bg-[var(--color-background)] rounded-xl border border-[var(--color-border)] p-4">
                <div className="flex items-center gap-2 mb-2 text-[var(--color-text-primary)]">
                  <Server className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <span className="text-sm font-medium">System</span>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  <InfoRow label="Hostname" value={stats.system.hostname} />
                  <InfoRow label="OS" value={`${stats.system.type} (${stats.system.release})`} />
                  <InfoRow label="Platform" value={`${stats.system.platform} · ${stats.system.arch}`} />
                  {stats.cpu.model && <InfoRow label="CPU model" value={stats.cpu.model} />}
                  <InfoRow label="Node" value={stats.system.nodeVersion} />
                </div>
              </div>

              <p className="mt-3 text-center text-[10px] text-[var(--color-text-secondary)]">
                Updated {new Date(stats.timestamp).toLocaleTimeString()} · refreshing every {POLL_INTERVAL_MS / 1000}s
              </p>
            </>
          ) : null}
        </div>
      </div>
    </ModalShell>
  );
}
