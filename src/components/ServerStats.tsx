import { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  Activity,
  Cpu,
  MemoryStick,
  HardDrive,
  Clock,
  Server,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Check,
  ArrowLeft,
  Container,
  Lock,
} from 'lucide-react';
import { configApi } from '../api/configApi';
import { useDashboard } from '../context/DashboardContext';
import type { RemoteServer, ServerStats as ServerStatsData } from '../types';
import { ModalShell, useConfirm } from './ui';

interface ServerStatsProps {
  onClose: () => void;
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

// Add/edit form for a remote server.
function ServerForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: RemoteServer;
  onSubmit: (name: string, url: string, username: string, password: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [username, setUsername] = useState(initial?.username ?? '');
  const [password, setPassword] = useState(initial?.password ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!name.trim()) return setError('Name is required.');
    if (!trimmedUrl) return setError('URL is required.');
    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return setError('URL must start with http:// or https://');
      }
    } catch {
      return setError('Enter a valid URL, e.g. http://10.1.2.17:61208');
    }
    onSubmit(name.trim(), trimmedUrl, username.trim(), password);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[var(--color-background)] rounded-xl border border-[var(--color-border)] p-4 space-y-3">
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Media Server"
          className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
          Glances URL
        </label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://10.1.2.17:61208"
          className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
        />
        <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
          Base URL of a Glances instance (web server on port 61208). Its REST API is read for CPU, memory, disk and Docker containers.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Username <span className="font-normal opacity-70">(optional)</span>
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="glances"
            autoComplete="off"
            className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Password <span className="font-normal opacity-70">(optional)</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>
      </div>
      <p className="text-[10px] text-[var(--color-text-secondary)]">
        Set these only if the Glances web server is password-protected (started with <code>--password</code>).
      </p>
      {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] text-white text-sm rounded-lg hover:bg-[var(--color-primary)]/80 transition-colors"
        >
          <Check className="w-4 h-4" />
          {initial ? 'Save' : 'Add Server'}
        </button>
      </div>
    </form>
  );
}

export function ServerStats({ onClose }: ServerStatsProps) {
  const { servers, addServer, updateServer, deleteServer } = useDashboard();
  const confirm = useConfirm();
  const [selectedId, setSelectedId] = useState<string>(LOCAL_ID);
  const [managing, setManaging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // If the selected remote server is deleted, fall back to local.
  useEffect(() => {
    if (selectedId !== LOCAL_ID && !servers.some(s => s.id === selectedId)) {
      setSelectedId(LOCAL_ID);
    }
  }, [servers, selectedId]);

  const selectedServer = servers.find(s => s.id === selectedId);
  const selectedUrl = selectedId === LOCAL_ID ? undefined : selectedServer?.url;

  const handleDelete = async (server: RemoteServer) => {
    const ok = await confirm({
      title: 'Remove server?',
      message: `"${server.name}" will be removed from your server list.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (ok) {
      deleteServer(server.id);
      if (editingId === server.id) setEditingId(null);
    }
  };

  return (
    <ModalShell onClose={onClose} ariaLabel="Server Stats">
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] w-full max-w-2xl shadow-2xl max-h-[90vh] sm:max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            {managing ? (
              <button
                onClick={() => { setManaging(false); setAdding(false); setEditingId(null); }}
                className="p-1 -m-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                aria-label="Back to stats"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <Activity className="w-5 h-5 text-[var(--color-primary)]" />
            )}
            <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
              {managing ? 'Manage Servers' : 'Server Stats'}
            </h2>
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
          {managing ? (
            <div className="space-y-3">
              {servers.length === 0 && !adding && (
                <p className="text-sm text-[var(--color-text-secondary)] text-center py-4">
                  No remote servers yet. Add a Glances instance (port 61208) to monitor it here.
                </p>
              )}

              {servers.map((server) =>
                editingId === server.id ? (
                  <ServerForm
                    key={server.id}
                    initial={server}
                    onSubmit={(name, url, username, password) => {
                      updateServer(server.id, { name, url, username, password });
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div
                    key={server.id}
                    className="flex items-center justify-between gap-3 bg-[var(--color-background)] rounded-xl border border-[var(--color-border)] p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{server.name}</p>
                        {server.username && (
                          <Lock className="w-3 h-3 shrink-0 text-[var(--color-text-secondary)]" aria-label="Password protected" />
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] truncate">{server.url}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditingId(server.id); setAdding(false); }}
                        className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] rounded-lg transition-colors"
                        aria-label={`Edit ${server.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(server)}
                        className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface)] rounded-lg transition-colors"
                        aria-label={`Remove ${server.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              )}

              {adding ? (
                <ServerForm
                  onSubmit={(name, url, username, password) => {
                    addServer(name, url, username, password);
                    setAdding(false);
                  }}
                  onCancel={() => setAdding(false)}
                />
              ) : (
                <button
                  onClick={() => { setAdding(true); setEditingId(null); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-primary)] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Server
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Server selector */}
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                <button
                  onClick={() => setSelectedId(LOCAL_ID)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedId === LOCAL_ID
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-background)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <Server className="w-3.5 h-3.5" />
                  This Server
                </button>
                {servers.map((server) => (
                  <button
                    key={server.id}
                    onClick={() => setSelectedId(server.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedId === server.id
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-background)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {server.name}
                  </button>
                ))}
                <button
                  onClick={() => setManaging(true)}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] whitespace-nowrap transition-colors"
                  title="Add or manage servers"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Manage</span>
                </button>
              </div>

              {/* Remount StatsView per server so polling resets cleanly. */}
              <StatsView
                key={selectedId}
                serverUrl={selectedUrl}
                username={selectedServer?.username}
                password={selectedServer?.password}
              />
            </>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
