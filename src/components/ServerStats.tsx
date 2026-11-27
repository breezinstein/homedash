import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Clock,
  Server,
  AlertTriangle,
  Container,
  Settings2,
} from 'lucide-react';
import { configApi } from '../api/configApi';
import { useDashboard } from '../context/DashboardContext';
import type { ServerStats as ServerStatsData } from '../types';
import { PageHeader, PagePanel } from './shell/PageHeader';
import { Button } from './ui/Button';
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from '@ui-sdk/react/segmented-control';

interface ServerStatsProps {
  /** Jumps to Settings → Remote servers. */
  onManage?: () => void;
}

const POLL_INTERVAL_MS = 3000;
const LOCAL_ID = 'local';

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

// Renders live stats for a single server, polling on an interval. `serverUrl`
// is undefined for the local host (uses /api/stats) or a base URL for a remote
// Glances instance (proxied via /api/stats/remote). `username`/`password` carry
// optional Basic-auth credentials for protected Glances instances.
function StatsView({ serverUrl, username, password }: { serverUrl?: string; username?: string; password?: string }) {
  const [stats, setStats] = useState<ServerStatsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchStats = useCallback(async () => {
    try {
      const data = serverUrl
        ? await configApi.getRemoteStats(serverUrl, { username, password })
        : await configApi.getStats();
      if (!mountedRef.current) return;
      setStats(data);
      setError(null);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Unable to reach the server for stats.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [serverUrl, username, password]);

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
        typeof stats.cpu.load['1m'] === 'number' &&
        typeof stats.cpu.load['5m'] === 'number' &&
        typeof stats.cpu.load['15m'] === 'number'
          ? ` · load ${stats.cpu.load['1m']!.toFixed(2)}, ${stats.cpu.load['5m']!.toFixed(2)}, ${stats.cpu.load['15m']!.toFixed(2)}`
          : ''
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

  if (loading && !stats) {
    return (
      <div className="space-y-3" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-[92px] rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 text-[var(--color-error)]">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <>
      {error && (
        <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 text-[var(--color-warning)]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs">{error} (showing last known values)</span>
        </div>
      )}
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
          <InfoRow label="OS" value={`${stats.system.type}${stats.system.release ? ` (${stats.system.release})` : ''}`} />
          {stats.system.distro && <InfoRow label="Distribution" value={stats.system.distro} />}
          <InfoRow label="Platform" value={[stats.system.platform, stats.system.arch].filter(Boolean).join(' · ')} />
          {stats.cpu.model && <InfoRow label="CPU model" value={stats.cpu.model} />}
          {stats.system.nodeVersion && <InfoRow label="Node" value={stats.system.nodeVersion} />}
          {stats.system.glancesVersion && <InfoRow label="Glances" value={stats.system.glancesVersion} />}
        </div>
      </div>

      {/* Docker containers (Glances instances only) */}
      {stats.containers && (
        <div className="mt-4 bg-[var(--color-background)] rounded-xl border border-[var(--color-border)] p-4">
          <div className="flex items-center gap-2 mb-3 text-[var(--color-text-primary)]">
            <Container className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <span className="text-sm font-medium">Containers</span>
            <span className="text-xs text-[var(--color-text-secondary)]">({stats.containers.length})</span>
          </div>
          {stats.containers.length === 0 ? (
            <p className="text-xs text-[var(--color-text-secondary)]">No running containers.</p>
          ) : (
            <div className="space-y-2">
              {stats.containers.map((c, i) => {
                const running = /running|up/i.test(c.status);
                return (
                  <div
                    key={`${c.name}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: running ? 'var(--color-success)' : 'var(--color-text-secondary)' }}
                          title={c.status}
                        />
                        <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{c.name}</span>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)] truncate">{c.image}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <div className="tabular-nums">
                        <p className="text-xs font-medium text-[var(--color-text-primary)]">
                          {c.cpuPercent === null ? '—' : `${c.cpuPercent.toFixed(1)}%`}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-secondary)]">CPU</p>
                      </div>
                      <div className="tabular-nums">
                        <p className="text-xs font-medium text-[var(--color-text-primary)]">{formatBytes(c.memoryUsage)}</p>
                        <p className="text-[10px] text-[var(--color-text-secondary)]">MEM</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-center text-[10px] text-[var(--color-text-secondary)]">
        Updated {new Date(stats.timestamp).toLocaleTimeString()} · refreshing every {POLL_INTERVAL_MS / 1000}s
      </p>
    </>
  );
}

export function ServerStats({ onManage }: ServerStatsProps) {
  const { servers } = useDashboard();
  const [selectedId, setSelectedId] = useState<string>(LOCAL_ID);

  // If the selected remote server is deleted, fall back to local.
  useEffect(() => {
    if (selectedId !== LOCAL_ID && !servers.some(s => s.id === selectedId)) {
      setSelectedId(LOCAL_ID);
    }
  }, [servers, selectedId]);

  const selectedServer = servers.find(s => s.id === selectedId);
  const selectedUrl = selectedId === LOCAL_ID ? undefined : selectedServer?.url;


  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Server stats"
        description="Live CPU, memory, disk and containers for this host or a Glances endpoint."
        actions={
          onManage ? (
            <Button variant="ghost" size="sm" onClick={onManage}>
              <Settings2 className="size-3.5" /> Manage servers
            </Button>
          ) : null
        }
      />
      <PagePanel>
        <div className="ui-panel-head gap-2 overflow-x-auto">
          <SegmentedControl
            aria-label="Server"
            className="ui-seg"
            value={selectedId}
            onValueChange={(value) => { if (value) setSelectedId(value); }}
          >
            <SegmentedControlIndicator />
            <SegmentedControlItem value={LOCAL_ID} className="ui-seg-item">
              <Server className="size-3.5" aria-hidden="true" /> This host
            </SegmentedControlItem>
            {servers.map((server) => (
              <SegmentedControlItem key={server.id} value={server.id} className="ui-seg-item">
                {server.name}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {/* Remount StatsView per server so polling resets cleanly. */}
          <StatsView
            key={selectedId}
            serverUrl={selectedUrl}
            username={selectedServer?.username}
            password={selectedServer?.password}
          />
        </div>
      </PagePanel>
    </div>
  );
}
