import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Container, Cpu, HardDrive, MemoryStick, Search, Server, Settings2 } from 'lucide-react';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from '@ui-sdk/react/segmented-control';
import { configApi } from '../api/configApi';
import { useDashboard } from '../context/DashboardContext';
import type { ServerStats as ServerStatsData } from '../types';
import { usageLevel } from '../lib/levels';
import { PageHeader, PagePanel } from './shell/PageHeader';
import { Button, EmptyState, InlineAlert, Input, KeyValueList, LevelMeter, LiveBadge, SelectField, StatTile } from './ui';

interface ServerStatsProps {
  /** Jumps to Settings → Servers. */
  onManage?: () => void;
}

const POLL_INTERVAL_MS = 3000;
const LOCAL_ID = 'local';
const SEGMENTED_MAX = 4;

type Sort = 'cpu' | 'memory' | 'name';

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function percent(p: number | null | undefined): string {
  return p == null ? '—' : `${p.toFixed(p < 10 ? 1 : 0)}%`;
}

/** Live readings for one server: local (/api/stats) or a Glances endpoint through the proxy. */
function StatsView({ serverUrl, username, password, paused }: { serverUrl?: string; username?: string; password?: string; paused: boolean }) {
  const [stats, setStats] = useState<ServerStatsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('cpu');
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
      setError(e instanceof Error ? e.message : 'The server did not answer.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [serverUrl, username, password]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchStats();
    return () => { mountedRef.current = false; };
  }, [fetchStats]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => { if (!document.hidden) void fetchStats(); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchStats, paused]);

  const containers = useMemo(() => {
    const list = [...(stats?.containers ?? [])];
    const q = query.trim().toLowerCase();
    const filtered = q ? list.filter((c) => c.name.toLowerCase().includes(q) || c.image.toLowerCase().includes(q)) : list;
    filtered.sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name)
        : sort === 'memory' ? (b.memoryUsage ?? -1) - (a.memoryUsage ?? -1)
        : (b.cpuPercent ?? -1) - (a.cpuPercent ?? -1));
    return filtered;
  }, [stats?.containers, query, sort]);

  if (loading && !stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[118px] animate-pulse rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--surface-sunken)]" />
        ))}
      </div>
    );
  }

  if (error && !stats) {
    return <InlineAlert tone="danger" title="Can't read this server">{error}</InlineAlert>;
  }
  if (!stats) return null;

  const load = stats.cpu.load;
  const loadText = typeof load['1m'] === 'number'
    ? `load ${load['1m']!.toFixed(2)}, ${load['5m']?.toFixed(2) ?? '—'}, ${load['15m']?.toFixed(2) ?? '—'}`
    : null;
  const systemRows: [string, string][] = [
    ['Hostname', stats.system.hostname],
    ['OS', `${stats.system.type}${stats.system.release ? ` (${stats.system.release})` : ''}`],
    ['Platform', [stats.system.platform, stats.system.arch].filter(Boolean).join(' · ')],
  ];
  if (stats.system.distro) systemRows.push(['Distribution', stats.system.distro]);
  if (stats.cpu.model) systemRows.push(['CPU model', stats.cpu.model]);
  if (stats.system.nodeVersion) systemRows.push(['Node', stats.system.nodeVersion]);
  if (stats.system.glancesVersion) systemRows.push(['Glances', stats.system.glancesVersion]);
  const upSince = stats.uptime.seconds != null
    ? new Date(stats.timestamp - stats.uptime.seconds * 1000).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="space-y-4">
      {error && (
        <InlineAlert tone="warning">
          {error} Showing the last readings from {new Date(stats.timestamp).toLocaleTimeString()}.
        </InlineAlert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="CPU" icon={Cpu} value={percent(stats.cpu.percent)} level={usageLevel(stats.cpu.percent)} detail={[stats.cpu.cores ? `${stats.cpu.cores} cores` : null, loadText].filter(Boolean).join(' · ')}>
          <LevelMeter label="CPU" value={stats.cpu.percent} className="ui-meter-bare" />
        </StatTile>
        <StatTile label="Memory" icon={MemoryStick} value={percent(stats.memory.percent)} level={usageLevel(stats.memory.percent, 85, 95)} detail={`${formatBytes(stats.memory.used)} of ${formatBytes(stats.memory.total)} used`}>
          <LevelMeter label="Memory" value={stats.memory.percent} level={usageLevel(stats.memory.percent, 85, 95)} className="ui-meter-bare" />
        </StatTile>
        <StatTile
          label="Disk"
          icon={HardDrive}
          value={percent(stats.disk.percent)}
          level={usageLevel(stats.disk.percent)}
          chip={usageLevel(stats.disk.percent) === 'critical' ? <span className="ui-chip" data-tone="danger">Nearly full</span> : usageLevel(stats.disk.percent) === 'warn' ? <span className="ui-chip" data-tone="warning">High</span> : null}
          detail={stats.disk.total === null ? 'Not reported on this platform' : `${formatBytes(stats.disk.used)} of ${formatBytes(stats.disk.total)} · ${formatBytes(stats.disk.free)} free`}
        >
          <LevelMeter label="Disk" value={stats.disk.percent} className="ui-meter-bare" />
        </StatTile>
        <StatTile label="Uptime" icon={Clock} value={stats.uptime.formatted ?? '—'} detail={upSince ? `Up since ${upSince}` : stats.source === 'glances' ? 'Glances endpoint' : 'This host'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <section className="ui-panel-section self-start">
          <div className="ui-panel-section-head">
            <Server className="size-3.5 text-[var(--color-text-secondary)]" aria-hidden="true" />
            System
          </div>
          <KeyValueList items={systemRows} />
        </section>

        {stats.containers && (
          <section className="ui-panel-section min-w-0">
            <div className="ui-panel-section-head flex-wrap">
              <Container className="size-3.5 text-[var(--color-text-secondary)]" aria-hidden="true" />
              Containers
              <span className="ui-chip tabular-nums">{stats.containers.length}</span>
              <span className="ml-auto flex flex-wrap items-center gap-2">
                <span className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-text-secondary)]" aria-hidden="true" />
                  <Input value={query} onValueChange={setQuery} placeholder="Filter" aria-label="Filter containers" className="h-8 w-40 pl-8 text-xs" />
                </span>
                <SegmentedControl aria-label="Sort containers by" className="ui-seg" value={sort} onValueChange={(v) => { if (v) setSort(v as Sort); }}>
                  <SegmentedControlIndicator />
                  <SegmentedControlItem value="cpu" className="ui-seg-item">CPU</SegmentedControlItem>
                  <SegmentedControlItem value="memory" className="ui-seg-item">Memory</SegmentedControlItem>
                  <SegmentedControlItem value="name" className="ui-seg-item">Name</SegmentedControlItem>
                </SegmentedControl>
              </span>
            </div>
            {stats.containers.length === 0 ? (
              <EmptyState title="No running containers" compact />
            ) : containers.length === 0 ? (
              <EmptyState title={`Nothing matches “${query}”`} compact />
            ) : (
              <ul>
                {containers.map((c) => {
                  const running = /running|up/i.test(c.status);
                  return (
                    <li key={`${c.name}-${c.image}`} className="ui-row">
                      <span className="ui-status-dot" data-on={running || undefined} role="img" aria-label={c.status} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.8125rem] font-medium">{c.name}</p>
                        <p className="ui-row-dim truncate font-mono">{c.image}</p>
                      </div>
                      <div className="w-28 shrink-0">
                        <LevelMeter label="CPU" value={c.cpuPercent} valueText={percent(c.cpuPercent)} />
                      </div>
                      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-[var(--color-text-secondary)]">{formatBytes(c.memoryUsage)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>

      <p className="pb-1 text-center text-[10px] text-[var(--color-text-secondary)]">
        Last reading {new Date(stats.timestamp).toLocaleTimeString()}
      </p>
    </div>
  );
}

export function ServerStats({ onManage }: ServerStatsProps) {
  const { servers } = useDashboard();
  const [selectedId, setSelectedId] = useState<string>(LOCAL_ID);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (selectedId !== LOCAL_ID && !servers.some((s) => s.id === selectedId)) setSelectedId(LOCAL_ID);
  }, [servers, selectedId]);

  const selected = servers.find((s) => s.id === selectedId);
  const options = [{ value: LOCAL_ID, label: 'This host' }, ...servers.map((s) => ({ value: s.id, label: s.name }))];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Server stats"
        description="CPU, memory, disk and containers for this host or any Glances server."
        actions={
          <>
            <LiveBadge intervalMs={POLL_INTERVAL_MS} paused={paused} onPausedChange={setPaused} />
            {onManage ? (
              <Button variant="ghost" size="sm" onClick={onManage}>
                <Settings2 className="size-3.5" aria-hidden="true" /> Manage servers
              </Button>
            ) : null}
          </>
        }
      />
      <PagePanel fill={false}>
        <div className="ui-panel-head gap-2 overflow-x-auto">
          {options.length <= SEGMENTED_MAX + 1 ? (
            <SegmentedControl aria-label="Server" className="ui-seg" value={selectedId} onValueChange={(v) => { if (v) setSelectedId(v); }}>
              <SegmentedControlIndicator />
              {options.map((o) => (
                <SegmentedControlItem key={o.value} value={o.value} className="ui-seg-item">
                  {o.value === LOCAL_ID ? <Server className="size-3.5" aria-hidden="true" /> : null}
                  {o.label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          ) : (
            <div className="w-64">
              <SelectField ariaLabel="Server" value={selectedId} onValueChange={setSelectedId} options={options} />
            </div>
          )}
          {selected?.monitor ? <span className="ui-chip" data-tone="info">On the monitor</span> : null}
        </div>
        <div className="p-4">
          <StatsView
            key={selectedId}
            serverUrl={selected?.url}
            username={selected?.username}
            password={selected?.password}
            paused={paused}
          />
        </div>
      </PagePanel>
    </div>
  );
}
