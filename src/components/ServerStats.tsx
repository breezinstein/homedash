import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Container,
  Cpu,
  HardDrive,
  MemoryStick,
  Server,
  Settings2,
} from 'lucide-react';
import { Button } from '@ui-sdk/react/button';
import { Meter, MeterIndicator, MeterTrack, MeterValue } from '@ui-sdk/react/meter';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from '@ui-sdk/react/segmented-control';
import { configApi } from '../api/configApi';
import { useDashboard } from '../context/DashboardContext';
import type { ServerStats as ServerStatsData } from '../types';
import { PageHeader, PagePanel } from './shell/PageHeader';

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

/** Utilisation reads as warning above 75% and danger above 90%. */
function usageColor(percent: number | null): string {
  if (percent === null) return 'var(--color-text-secondary)';
  if (percent >= 90) return 'var(--color-error)';
  if (percent >= 75) return 'var(--color-warning)';
  return 'var(--color-primary)';
}

function percentLabel(percent: number | null): string {
  return percent === null ? '—' : `${percent.toFixed(1)}%`;
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--surface-sunken)]" />
        ))}
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-error)_35%,transparent)] bg-[var(--danger-soft)] px-3 py-2 text-[var(--color-error)]">
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (!stats) return null;

  const systemRows: Array<[string, string]> = [
    ['Hostname', stats.system.hostname],
    ['OS', `${stats.system.type}${stats.system.release ? ` (${stats.system.release})` : ''}`],
    ['Platform', [stats.system.platform, stats.system.arch].filter(Boolean).join(' · ')],
  ];
  if (stats.system.distro) systemRows.push(['Distribution', stats.system.distro]);
  if (stats.cpu.model) systemRows.push(['CPU model', stats.cpu.model]);
  if (stats.system.nodeVersion) systemRows.push(['Node', stats.system.nodeVersion]);
  if (stats.system.glancesVersion) systemRows.push(['Glances', stats.system.glancesVersion]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] px-3 py-2 text-[var(--color-warning)]">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="text-xs">{error} (showing last known values)</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([
          { icon: Cpu, label: 'CPU', percent: stats.cpu.percent, detail: cpuDetail },
          { icon: MemoryStick, label: 'Memory', percent: stats.memory.percent, detail: memDetail },
          { icon: HardDrive, label: 'Disk', percent: stats.disk.percent, detail: diskDetail },
        ] as const).map(({ icon: Icon, label, percent, detail }) => (
          <div key={label} className="ui-stat">
            <div className="ui-stat-head">
              <Icon className="size-4 text-[var(--color-text-secondary)]" aria-hidden="true" />
              <span className="text-[0.8125rem] font-semibold">{label}</span>
            </div>
            <Meter
              value={percent ?? 0}
              min={0}
              max={100}
              format={{ style: 'percent', maximumFractionDigits: 1 }}
              aria-label={label}
            >
              <MeterValue>{percentLabel(percent)}</MeterValue>
              <MeterTrack>
                <MeterIndicator style={{ backgroundColor: usageColor(percent) }} />
              </MeterTrack>
            </Meter>
            <p className="ui-stat-detail">{detail}</p>
          </div>
        ))}

        <div className="ui-stat">
          <div className="ui-stat-head">
            <Clock className="size-4 text-[var(--color-text-secondary)]" aria-hidden="true" />
            <span className="text-[0.8125rem] font-semibold">Uptime</span>
          </div>
          <p className="text-xl font-semibold tabular-nums text-[var(--color-text-primary)]">
            {stats.uptime.formatted ?? '—'}
          </p>
          <p className="ui-stat-detail">
            {stats.source === 'glances' ? 'Remote Glances instance' : 'This host'}
          </p>
        </div>
      </div>

      <section className="ui-panel-section">
        <div className="ui-panel-section-head">
          <Server className="size-3.5 text-[var(--color-text-secondary)]" aria-hidden="true" />
          System
        </div>
        <div>
          {systemRows.map(([label, value]) => (
            <div key={label} className="ui-row justify-between">
              <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
              <span className="break-all text-right text-xs font-medium">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {stats.containers && (
        <section className="ui-panel-section">
          <div className="ui-panel-section-head">
            <Container className="size-3.5 text-[var(--color-text-secondary)]" aria-hidden="true" />
            Containers
            <span className="ui-chip ml-auto tabular-nums">{stats.containers.length}</span>
          </div>
          {stats.containers.length === 0 ? (
            <p className="px-3 py-4 text-xs text-[var(--color-text-secondary)]">No running containers.</p>
          ) : (
            <div>
              {stats.containers.map((container, index) => {
                const running = /running|up/i.test(container.status);
                return (
                  <div key={`${container.name}-${index}`} className="ui-row justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: running ? 'var(--color-success)' : 'var(--color-text-secondary)' }}
                          title={container.status}
                        />
                        <span className="truncate text-[0.8125rem] font-medium">{container.name}</span>
                      </div>
                      <p className="ui-row-dim truncate">{container.image}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-right tabular-nums">
                      <div>
                        <p className="text-xs font-medium">{percentLabel(container.cpuPercent)}</p>
                        <p className="text-[10px] text-[var(--color-text-secondary)]">CPU</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium">{formatBytes(container.memoryUsage)}</p>
                        <p className="text-[10px] text-[var(--color-text-secondary)]">MEM</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <p className="pb-1 text-center text-[10px] text-[var(--color-text-secondary)]">
        Updated {new Date(stats.timestamp).toLocaleTimeString()} · refreshing every {POLL_INTERVAL_MS / 1000}s
      </p>
    </div>
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
            <Button className="ui-btn" data-variant="ghost" data-size="sm" onClick={onManage}>
              <Settings2 className="size-3.5" aria-hidden="true" /> Manage servers
            </Button>
          ) : null
        }
      />
      <PagePanel fill={false}>
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

        <div className="p-4">
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
