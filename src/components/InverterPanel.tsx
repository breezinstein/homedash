import { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  Sun,
  Zap,
  Battery,
  BatteryCharging,
  BatteryFull,
  Gauge,
  Plug,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Check,
  ArrowLeft,
  Lock,
  CircuitBoard,
  ChevronDown,
} from 'lucide-react';
import { configApi } from '../api/configApi';
import { useDashboard } from '../context/DashboardContext';
import type { InverterServer, InverterStats, InverterMetric, InverterDevice, BatteryRuntime } from '../types';
import { ModalShell, useConfirm } from './ui';

interface InverterPanelProps {
  onClose: () => void;
}

const POLL_INTERVAL_MS = 3000;

// Format a metric value with its unit. Numbers are rounded to a sensible
// precision; strings pass through unchanged.
function formatMetric(m: InverterMetric | undefined): string {
  if (!m || m.value === null || m.value === undefined) return '—';
  if (typeof m.value === 'number') {
    const rounded = Math.abs(m.value) >= 100 ? Math.round(m.value) : Math.round(m.value * 100) / 100;
    return m.unit ? `${rounded} ${m.unit}` : `${rounded}`;
  }
  return m.unit ? `${m.value} ${m.unit}` : `${m.value}`;
}

// Format a raw overview value (number|string|null) with an optional unit.
function formatValue(value: number | string | null, unit = ''): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 100) / 100;
    return unit ? `${rounded} ${unit}` : `${rounded}`;
  }
  return unit ? `${value} ${unit}` : `${value}`;
}

const asNumber = (v: number | string | null): number | null =>
  typeof v === 'number' ? v : (typeof v === 'string' && Number.isFinite(parseFloat(v)) ? parseFloat(v) : null);

function barColor(percent: number | null): string {
  if (percent === null) return 'var(--color-text-secondary)';
  if (percent <= 20) return 'var(--color-error)';
  if (percent <= 40) return 'var(--color-warning)';
  return 'var(--color-success)';
}

// --- Battery runtime estimation -------------------------------------------
// The "time until full / depleted" headline is computed server-side (see
// server.js) from a shared, continuously-polled state-of-charge history, so it
// is warm immediately and survives reloads. The client just renders the
// server-provided `overview.batteryRuntime`.

function formatDuration(mins: number): string {
  if (!Number.isFinite(mins)) return '—';
  const total = Math.max(0, Math.round(mins));
  if (total < 1) return '<1m';
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Absolute clock time the estimate resolves to, e.g. "today 14:25",
// "tomorrow 08:10" or "Sat 7 Jun 14:25" for points further out. Computed at
// render time off the server's `minutes` so it stays accurate as time passes.
function formatEta(minsFromNow: number): string {
  if (!Number.isFinite(minsFromNow)) return '';
  const now = new Date();
  const target = new Date(now.getTime() + Math.max(0, minsFromNow) * 60000);
  const time = target.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDelta = Math.round((startOfDay(target) - startOfDay(now)) / 86400000);
  if (dayDelta <= 0) return `today ${time}`;
  if (dayDelta === 1) return `tomorrow ${time}`;
  const date = target.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${date} ${time}`;
}


function BatteryRuntimeBanner({ runtime }: { runtime: BatteryRuntime }) {
  const { state, minutes, floorSoc, soc } = runtime;
  const nowSuffix = soc !== null ? ` · ${Math.round(soc)}% now` : '';
  const eta = minutes !== null ? formatEta(minutes) : '';

  let accent = 'var(--color-text-primary)';
  let Icon: React.ComponentType<{ className?: string }> = Battery;
  let headline: string;
  let detail: string | null;

  if (state === 'full') {
    accent = 'var(--color-success)';
    Icon = BatteryFull;
    headline = 'Battery full';
    detail = 'Fully charged';
  } else if (state === 'charging') {
    accent = 'var(--color-success)';
    Icon = BatteryCharging;
    headline = minutes !== null ? `Full in ~${formatDuration(minutes)}` : 'Charging';
    detail = minutes !== null ? `Full ${eta}${nowSuffix}` : `Estimating charge rate…${nowSuffix}`;
  } else if (state === 'discharging') {
    const target = floorSoc <= 0 ? 'empty' : `${Math.round(floorSoc)}%`;
    if (minutes !== null && minutes <= 30) accent = 'var(--color-error)';
    else if (minutes !== null && minutes <= 120) accent = 'var(--color-warning)';
    headline = minutes !== null ? `~${formatDuration(minutes)} until ${target}` : 'Discharging';
    detail = minutes !== null ? `To shutdown (${target}) ${eta}${nowSuffix}` : `Estimating drain rate…${nowSuffix}`;
  } else if (state === 'idle') {
    accent = 'var(--color-text-secondary)';
    headline = 'Battery idle';
    detail = `Holding steady${nowSuffix}`;
  } else {
    accent = 'var(--color-text-secondary)';
    headline = 'Estimating runtime…';
    detail = soc !== null ? `${Math.round(soc)}% now` : null;
  }

  return (
    <div
      className="mb-3 flex items-center gap-3 p-3 rounded-xl border"
      style={{ borderColor: accent, backgroundColor: 'var(--color-background)' }}
    >
      <div
        className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0 bg-[var(--color-surface)]"
        style={{ color: accent }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-base font-semibold leading-tight" style={{ color: accent }}>{headline}</p>
        {detail && <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 break-words">{detail}</p>}
      </div>
    </div>
  );
}


interface TileProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

function Tile({ icon: Icon, label, value, sub, accent }: TileProps) {
  return (
    <div className="bg-[var(--color-background)] rounded-xl border border-[var(--color-border)] p-4">
      <div className="flex items-center gap-2 mb-1 text-[var(--color-text-secondary)]">
        <Icon className="w-4 h-4" style={accent ? { color: accent } : undefined} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-semibold text-[var(--color-text-primary)] tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{sub}</p>}
    </div>
  );
}

// Choose the metrics to display for a device card: prefer the live "Status"
// group, falling back to all metrics if the device doesn't label them.
function displayMetrics(device: InverterDevice): [string, InverterMetric][] {
  const entries = Object.entries(device.metrics);
  const status = entries.filter(([, m]) => m.group === 'Status');
  return (status.length ? status : entries);
}

function DeviceCard({ device, icon: Icon }: { device: InverterDevice; icon: React.ComponentType<{ className?: string }> }) {
  const [open, setOpen] = useState(true);
  const metrics = displayMetrics(device);
  // Surface a SOC bar for batteries when available.
  const soc = device.metrics['state_of_charge'];
  const socNum = soc && typeof soc.value === 'number' ? soc.value : null;
  const contentId = `device-card-${device.id}`;

  return (
    <div className="bg-[var(--color-background)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        className="w-full flex items-center gap-2 p-4 text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]/50 transition-colors"
      >
        <Icon className="w-4 h-4 shrink-0 text-[var(--color-text-secondary)]" />
        <span className="text-sm font-semibold flex-1 min-w-0 truncate">{device.label}</span>
        {socNum !== null && (
          <span className="text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]">{socNum.toFixed(1)}%</span>
        )}
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-[var(--color-text-secondary)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div id={contentId} className="px-4 pb-4">
          {socNum !== null && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[var(--color-text-secondary)]">State of charge</span>
                <span className="text-xs font-semibold text-[var(--color-text-primary)] tabular-nums">{socNum.toFixed(1)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--color-surface)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, socNum))}%`, backgroundColor: barColor(socNum) }}
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {metrics.map(([key, m]) => (
              <div key={key} className="flex items-baseline justify-between gap-3 min-w-0">
                <span className="text-xs text-[var(--color-text-secondary)] min-w-0 break-words">{m.name}</span>
                <span className="text-xs font-medium text-[var(--color-text-primary)] tabular-nums text-right break-words">{formatMetric(m)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Renders live metrics for a single inverter device, polling on an interval.
function InverterStatsView({ url, username, password }: { url: string; username?: string; password?: string }) {
  const [stats, setStats] = useState<InverterStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchStats = useCallback(async () => {
    try {
      const data = await configApi.getInverterStats(url, { username, password });
      if (!mountedRef.current) return;
      setStats(data);
      setError(null);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Unable to reach the inverter.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [url, username, password]);

  useEffect(() => {
    mountedRef.current = true;
    fetchStats();
    const id = setInterval(fetchStats, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchStats]);

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

  const o = stats.overview;
  const batteryPower = asNumber(o.batteryPower);
  const gridPower = asNumber(o.gridPower);
  const socNum = asNumber(o.batterySoc);

  // Solar Assistant convention: battery power positive = charging, negative =
  // discharging (battery current sign matches); grid power negative = exporting.
  const batterySub = batteryPower === null
    ? (socNum !== null ? `${formatValue(o.batterySoc, '%')}` : undefined)
    : `${batteryPower > 0 ? 'Charging' : 'Discharging'} ${formatValue(Math.abs(batteryPower), 'W')}`;
  const gridSub = gridPower === null
    ? undefined
    : (gridPower < 0 ? `Exporting ${formatValue(Math.abs(gridPower), 'W')}` : gridPower > 0 ? 'Importing' : 'Idle');

  // The runtime estimate is computed server-side and arrives in the payload.
  const runtime = stats.overview.batteryRuntime ?? null;

  return (
    <>
      {error && (
        <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 text-[var(--color-warning)]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs">{error} (showing last known values)</span>
        </div>
      )}

      {/* Headline: estimated time until the battery is full or depleted. */}
      {runtime && runtime.soc !== null && <BatteryRuntimeBanner runtime={runtime} />}

      {o.inverterMode && (
        <div className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]">
          <CircuitBoard className="w-4 h-4 text-[var(--color-primary)]" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{o.inverterMode}</span>
        </div>
      )}

      {/* Overview tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile icon={Sun} label="Solar (PV)" value={formatValue(o.pvPower, 'W')} accent="var(--color-warning)" />
        <Tile icon={Plug} label="Load" value={formatValue(o.loadPower, 'W')}
          sub={o.loadPercentage !== null ? `${formatValue(o.loadPercentage, '%')} of capacity` : undefined} />
        <Tile icon={Battery} label="Battery" value={socNum !== null ? `${formatValue(o.batterySoc, '%')}` : formatValue(o.batteryPower, 'W')}
          sub={batterySub} accent="var(--color-success)" />
        <Tile icon={Zap} label="Grid" value={formatValue(o.gridPower, 'W')} sub={gridSub} />
      </div>

      {/* Secondary readouts */}
      <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile icon={Gauge} label="AC Output" value={formatValue(o.acOutputVoltage, 'V')}
          sub={o.acOutputFrequency !== null ? `${formatValue(o.acOutputFrequency, 'Hz')}` : undefined} />
        <Tile icon={Battery} label="Battery Voltage" value={formatValue(o.batteryVoltage, 'V')}
          sub={o.batteryCurrent !== null ? `${formatValue(o.batteryCurrent, 'A')}` : undefined} />
        <Tile icon={Gauge} label="Grid Voltage" value={formatValue(o.gridVoltage, 'V')}
          sub={o.gridFrequency !== null ? `${formatValue(o.gridFrequency, 'Hz')}` : undefined} />
        <Tile icon={Zap} label="Generator" value={formatValue(o.generatorPower, 'W')} />
      </div>

      {/* Inverters */}
      {stats.inverters.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4 text-[var(--color-text-secondary)]" />
            Inverters <span className="text-xs font-normal text-[var(--color-text-secondary)]">({stats.inverters.length})</span>
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {stats.inverters.map((d) => (
              <DeviceCard key={d.id} device={d} icon={Zap} />
            ))}
          </div>
        </div>
      )}

      {/* Batteries */}
      {stats.batteries.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
            <Battery className="w-4 h-4 text-[var(--color-text-secondary)]" />
            Batteries <span className="text-xs font-normal text-[var(--color-text-secondary)]">({stats.batteries.length})</span>
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {stats.batteries.map((d) => (
              <DeviceCard key={d.id} device={d} icon={Battery} />
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-center text-[10px] text-[var(--color-text-secondary)]">
        Updated {new Date(stats.timestamp).toLocaleTimeString()} · refreshing every {POLL_INTERVAL_MS / 1000}s
      </p>
    </>
  );
}

// Add/edit form for a Solar Assistant device.
function InverterForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: InverterServer;
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
      return setError('Enter a valid URL, e.g. http://10.1.2.14');
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
          placeholder="Home Inverter"
          className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
          Solar Assistant URL
        </label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://10.1.2.14"
          className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
        />
        <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
          Base URL of your Solar Assistant device. Its REST API (<code>/api/v1/metrics</code>) is read for live PV, load, grid and battery metrics.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Username
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            autoComplete="off"
            className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Password
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
        Use the device password configured in Solar Assistant. Credentials are stored server-side and never exposed to anonymous viewers.
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
          {initial ? 'Save' : 'Add Inverter'}
        </button>
      </div>
    </form>
  );
}

export function InverterPanel({ onClose }: InverterPanelProps) {
  const { inverters, addInverter, updateInverter, deleteInverter } = useDashboard();
  const confirm = useConfirm();
  const [selectedId, setSelectedId] = useState<string | null>(inverters[0]?.id ?? null);
  const [managing, setManaging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Keep a valid selection as inverters are added/removed.
  useEffect(() => {
    if (inverters.length === 0) {
      if (selectedId !== null) setSelectedId(null);
    } else if (!inverters.some(s => s.id === selectedId)) {
      setSelectedId(inverters[0].id);
    }
  }, [inverters, selectedId]);

  // With no devices configured, drop straight into the manage/add view.
  useEffect(() => {
    if (inverters.length === 0) setManaging(true);
  }, [inverters.length]);

  const selected = inverters.find(s => s.id === selectedId);

  const handleDelete = async (inv: InverterServer) => {
    const ok = await confirm({
      title: 'Remove inverter?',
      message: `"${inv.name}" will be removed from your inverter list.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (ok) {
      deleteInverter(inv.id);
      if (editingId === inv.id) setEditingId(null);
    }
  };

  return (
    <ModalShell onClose={onClose} ariaLabel="Inverter Monitor">
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] w-full max-w-2xl shadow-2xl max-h-[90vh] sm:max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            {managing && inverters.length > 0 ? (
              <button
                onClick={() => { setManaging(false); setAdding(false); setEditingId(null); }}
                className="p-1 -m-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                aria-label="Back to metrics"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <Sun className="w-5 h-5 text-[var(--color-primary)]" />
            )}
            <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
              {managing ? 'Manage Inverters' : 'Inverter Monitor'}
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
              {inverters.length === 0 && !adding && (
                <p className="text-sm text-[var(--color-text-secondary)] text-center py-4">
                  No inverters yet. Add a Solar Assistant device to monitor it here.
                </p>
              )}

              {inverters.map((inv) =>
                editingId === inv.id ? (
                  <InverterForm
                    key={inv.id}
                    initial={inv}
                    onSubmit={(name, url, username, password) => {
                      updateInverter(inv.id, { name, url, username, password });
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-3 bg-[var(--color-background)] rounded-xl border border-[var(--color-border)] p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{inv.name}</p>
                        {inv.username && (
                          <Lock className="w-3 h-3 shrink-0 text-[var(--color-text-secondary)]" aria-label="Password protected" />
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] truncate">{inv.url}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditingId(inv.id); setAdding(false); }}
                        className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] rounded-lg transition-colors"
                        aria-label={`Edit ${inv.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(inv)}
                        className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface)] rounded-lg transition-colors"
                        aria-label={`Remove ${inv.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              )}

              {adding ? (
                <InverterForm
                  onSubmit={(name, url, username, password) => {
                    addInverter(name, url, username, password);
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
                  Add Inverter
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Device selector (only meaningful with more than one device) */}
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                {inverters.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => setSelectedId(inv.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedId === inv.id
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-background)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {inv.name}
                  </button>
                ))}
                <button
                  onClick={() => setManaging(true)}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] whitespace-nowrap transition-colors"
                  title="Add or manage inverters"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Manage</span>
                </button>
              </div>

              {selected ? (
                // Remount per device so polling resets cleanly.
                <InverterStatsView
                  key={selected.id}
                  url={selected.url}
                  username={selected.username}
                  password={selected.password}
                />
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)] text-center py-6">
                  Select an inverter to view its metrics.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
