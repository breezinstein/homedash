import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Battery,
  BatteryCharging,
  BatteryFull,
  ChevronDown,
  CircuitBoard,
  Gauge,
  Plug,
  Settings2,
  Sun,
  Zap,
} from 'lucide-react';
import { Button } from '@ui-sdk/react/button';
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@ui-sdk/react/collapsible';
import { Meter, MeterIndicator, MeterTrack, MeterValue } from '@ui-sdk/react/meter';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from '@ui-sdk/react/segmented-control';
import { configApi } from '../api/configApi';
import { useDashboard } from '../context/DashboardContext';
import type { InverterStats, InverterMetric, InverterDevice, BatteryRuntime } from '../types';
import { PageHeader, PagePanel } from './shell/PageHeader';

interface InverterPanelProps {
  /** Jumps to Settings → Inverters. */
  onManage?: () => void;
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

/** The reported percentage decides the meter colour: SOC falls as it drains, load rises. */
function chargeColor(percent: number | null): string {
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

interface RuntimeSummary {
  accent: string;
  Icon: React.ComponentType<{ className?: string }>;
  headline: string;
  detail: string | null;
}

function runtimeSummary(runtime: BatteryRuntime): RuntimeSummary {
  const { state, minutes, floorSoc, soc } = runtime;
  const nowSuffix = soc !== null ? ` · ${Math.round(soc)}% now` : '';
  const eta = minutes !== null ? formatEta(minutes) : '';

  if (state === 'full') {
    return { accent: 'var(--color-success)', Icon: BatteryFull, headline: 'Battery full', detail: 'Fully charged' };
  }
  if (state === 'charging') {
    return {
      accent: 'var(--color-success)',
      Icon: BatteryCharging,
      headline: minutes !== null ? `Full in ~${formatDuration(minutes)}` : 'Charging',
      detail: minutes !== null ? `Full ${eta}${nowSuffix}` : `Estimating charge rate…${nowSuffix}`,
    };
  }
  if (state === 'discharging') {
    const target = floorSoc <= 0 ? 'empty' : `${Math.round(floorSoc)}%`;
    const accent = minutes !== null && minutes <= 30
      ? 'var(--color-error)'
      : minutes !== null && minutes <= 120
        ? 'var(--color-warning)'
        : 'var(--color-text-primary)';
    return {
      accent,
      Icon: Battery,
      headline: minutes !== null ? `~${formatDuration(minutes)} until ${target}` : 'Discharging',
      detail: minutes !== null ? `To shutdown (${target}) ${eta}${nowSuffix}` : `Estimating drain rate…${nowSuffix}`,
    };
  }
  if (state === 'idle') {
    return { accent: 'var(--color-text-secondary)', Icon: Battery, headline: 'Battery idle', detail: `Holding steady${nowSuffix}` };
  }
  return {
    accent: 'var(--color-text-secondary)',
    Icon: Battery,
    headline: 'Estimating runtime…',
    detail: soc !== null ? `${Math.round(soc)}% now` : null,
  };
}

// Choose the metrics to display for a device card: prefer the live "Status"
// group, falling back to all metrics if the device doesn't label them.
function displayMetrics(device: InverterDevice): [string, InverterMetric][] {
  const entries = Object.entries(device.metrics);
  const status = entries.filter(([, m]) => m.group === 'Status');
  return status.length ? status : entries;
}

function DeviceSection({ device, kind }: { device: InverterDevice; kind: 'inverter' | 'battery' }) {
  const metrics = displayMetrics(device);
  const soc = device.metrics['state_of_charge'];
  const socNum = soc && typeof soc.value === 'number' ? soc.value : null;
  const Icon = kind === 'battery' ? Battery : Zap;

  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="ui-panel-section-head w-full justify-between text-left">
        <span className="flex min-w-0 items-center gap-2">
          <Icon className="size-3.5 text-[var(--color-text-secondary)]" aria-hidden="true" />
          <span className="truncate text-[0.8125rem] font-semibold">{device.label}</span>
        </span>
        <span className="flex items-center gap-2">
          {socNum !== null && <span className="ui-chip tabular-nums">{socNum.toFixed(1)}%</span>}
          <span data-chevron className="text-[var(--color-text-secondary)]">
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </span>
        </span>
      </CollapsibleTrigger>
      <CollapsiblePanel className="p-3">
        {socNum !== null && (
          <Meter
            value={socNum}
            min={0}
            max={100}
            format={{ style: 'percent', maximumFractionDigits: 1 }}
            className="mb-3"
            aria-label="State of charge"
          >
            <MeterValue>{`${socNum.toFixed(1)}%`}</MeterValue>
            <MeterTrack>
              <MeterIndicator style={{ backgroundColor: chargeColor(socNum) }} />
            </MeterTrack>
          </Meter>
        )}
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {metrics.map(([key, metric]) => (
            <div key={key} className="flex items-baseline justify-between gap-3 py-0.5">
              <span className="min-w-0 break-words text-xs text-[var(--color-text-secondary)]">{metric.name}</span>
              <span className="break-words text-right text-xs font-medium tabular-nums text-[var(--color-text-primary)]">
                {formatMetric(metric)}
              </span>
            </div>
          ))}
        </div>
      </CollapsiblePanel>
    </Collapsible>
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

  const o = stats.overview;
  const batteryPower = asNumber(o.batteryPower);
  const gridPower = asNumber(o.gridPower);
  const socNum = asNumber(o.batterySoc);
  const loadPercent = asNumber(o.loadPercentage);
  const runtime = stats.overview.batteryRuntime ?? null;

  // Solar Assistant convention: battery power positive = charging, negative =
  // discharging (battery current sign matches); grid power negative = exporting.
  const batterySub = batteryPower === null
    ? (socNum !== null ? formatValue(o.batterySoc, '%') : undefined)
    : `${batteryPower > 0 ? 'Charging' : 'Discharging'} ${formatValue(Math.abs(batteryPower), 'W')}`;
  const gridSub = gridPower === null
    ? undefined
    : (gridPower < 0 ? `Exporting ${formatValue(Math.abs(gridPower), 'W')}` : gridPower > 0 ? 'Importing' : 'Idle');

  const runtimeInfo = runtime && runtime.soc !== null ? runtimeSummary(runtime) : null;
  const RuntimeIcon = runtimeInfo?.Icon;

  const secondary = [
    { icon: Gauge, label: 'AC output', value: formatValue(o.acOutputVoltage, 'V'), sub: o.acOutputFrequency !== null ? formatValue(o.acOutputFrequency, 'Hz') : '' },
    { icon: Battery, label: 'Battery voltage', value: formatValue(o.batteryVoltage, 'V'), sub: o.batteryCurrent !== null ? formatValue(o.batteryCurrent, 'A') : '' },
    { icon: Gauge, label: 'Grid voltage', value: formatValue(o.gridVoltage, 'V'), sub: o.gridFrequency !== null ? formatValue(o.gridFrequency, 'Hz') : '' },
    { icon: Zap, label: 'Generator', value: formatValue(o.generatorPower, 'W'), sub: '' },
  ];

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] px-3 py-2 text-[var(--color-warning)]">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="text-xs">{error} (showing last known values)</span>
        </div>
      )}

      {runtimeInfo && RuntimeIcon && (
        <div className="ui-stat">
          <div className="flex items-center gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-surface)]"
              style={{ color: runtimeInfo.accent }}
            >
              <RuntimeIcon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-semibold leading-tight" style={{ color: runtimeInfo.accent }}>
                {runtimeInfo.headline}
              </p>
              {runtimeInfo.detail && (
                <p className="mt-0.5 break-words text-xs text-[var(--color-text-secondary)]">{runtimeInfo.detail}</p>
              )}
            </div>
            {o.inverterMode && (
              <span className="ui-chip shrink-0">
                <CircuitBoard className="size-3" aria-hidden="true" /> {o.inverterMode}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="ui-stat">
          <div className="ui-stat-head">
            <Sun className="size-4" style={{ color: 'var(--color-warning)' }} aria-hidden="true" />
            <span className="text-[0.8125rem] font-semibold">Solar (PV)</span>
          </div>
          <p className="text-xl font-semibold tabular-nums">{formatValue(o.pvPower, 'W')}</p>
          <p className="ui-stat-detail">Array output right now</p>
        </div>

        <div className="ui-stat">
          <div className="ui-stat-head">
            <Plug className="size-4 text-[var(--color-text-secondary)]" aria-hidden="true" />
            <span className="text-[0.8125rem] font-semibold">Load</span>
          </div>
          <p className="text-xl font-semibold tabular-nums">{formatValue(o.loadPower, 'W')}</p>
          {loadPercent !== null ? (
            <Meter
              value={loadPercent}
              min={0}
              max={100}
              format={{ style: 'percent', maximumFractionDigits: 0 }}
              aria-label="Load"
            >
              <MeterValue>{`${formatValue(o.loadPercentage, '%')} of capacity`}</MeterValue>
              <MeterTrack>
                <MeterIndicator style={{ backgroundColor: loadPercent >= 90 ? 'var(--color-error)' : 'var(--color-primary)' }} />
              </MeterTrack>
            </Meter>
          ) : (
            <p className="ui-stat-detail">Consumption now</p>
          )}
        </div>

        <div className="ui-stat">
          <div className="ui-stat-head">
            <Battery className="size-4" style={{ color: 'var(--color-success)' }} aria-hidden="true" />
            <span className="text-[0.8125rem] font-semibold">Battery</span>
          </div>
          <p className="text-xl font-semibold tabular-nums">
            {socNum !== null ? formatValue(o.batterySoc, '%') : formatValue(o.batteryPower, 'W')}
          </p>
          {socNum !== null ? (
            <Meter
              value={socNum}
              min={0}
              max={100}
              format={{ style: 'percent', maximumFractionDigits: 0 }}
              aria-label="State of charge"
            >
              <MeterValue>{batterySub ?? `${Math.round(socNum)}%`}</MeterValue>
              <MeterTrack>
                <MeterIndicator style={{ backgroundColor: chargeColor(socNum) }} />
              </MeterTrack>
            </Meter>
          ) : (
            <p className="ui-stat-detail">{batterySub ?? 'State of charge'}</p>
          )}
        </div>

        <div className="ui-stat">
          <div className="ui-stat-head">
            <Zap className="size-4 text-[var(--color-text-secondary)]" aria-hidden="true" />
            <span className="text-[0.8125rem] font-semibold">Grid</span>
          </div>
          <p className="text-xl font-semibold tabular-nums">{formatValue(o.gridPower, 'W')}</p>
          <p className="ui-stat-detail">{gridSub ?? 'Not reporting'}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {secondary.map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="ui-stat">
            <div className="ui-stat-head">
              <Icon className="size-4 text-[var(--color-text-secondary)]" aria-hidden="true" />
              <span className="text-[0.75rem] font-semibold">{label}</span>
            </div>
            <p className="text-base font-semibold tabular-nums">{value}</p>
            {sub ? <p className="ui-stat-detail">{sub}</p> : null}
          </div>
        ))}
      </div>

      {stats.inverters.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="size-3.5 text-[var(--color-text-secondary)]" aria-hidden="true" />
            <h3 className="text-[0.8125rem] font-semibold">Inverters</h3>
            <span className="ui-chip tabular-nums">{stats.inverters.length}</span>
          </div>
          <div className="space-y-2">
            {stats.inverters.map((device) => (
              <div key={device.id} className="ui-panel-section overflow-hidden">
                <DeviceSection device={device} kind="inverter" />
              </div>
            ))}
          </div>
        </section>
      )}

      {stats.batteries.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Battery className="size-3.5 text-[var(--color-text-secondary)]" aria-hidden="true" />
            <h3 className="text-[0.8125rem] font-semibold">Batteries</h3>
            <span className="ui-chip tabular-nums">{stats.batteries.length}</span>
          </div>
          <div className="space-y-2">
            {stats.batteries.map((device) => (
              <div key={device.id} className="ui-panel-section overflow-hidden">
                <DeviceSection device={device} kind="battery" />
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="pb-1 text-center text-[10px] text-[var(--color-text-secondary)]">
        Updated {new Date(stats.timestamp).toLocaleTimeString()} · refreshing every {POLL_INTERVAL_MS / 1000}s
      </p>
    </div>
  );
}

export function InverterPanel({ onManage }: InverterPanelProps) {
  const { inverters } = useDashboard();
  const [selectedId, setSelectedId] = useState<string | null>(inverters[0]?.id ?? null);

  // Keep a valid selection as inverters are added/removed.
  useEffect(() => {
    if (inverters.length === 0) {
      if (selectedId !== null) setSelectedId(null);
    } else if (!inverters.some(s => s.id === selectedId)) {
      setSelectedId(inverters[0].id);
    }
  }, [inverters, selectedId]);

  const selected = inverters.find(s => s.id === selectedId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Inverter"
        description="Live PV, load, grid and battery metrics from Solar Assistant."
        actions={
          onManage ? (
            <Button className="ui-btn" data-variant="ghost" data-size="sm" onClick={onManage}>
              <Settings2 className="size-3.5" aria-hidden="true" /> Manage inverters
            </Button>
          ) : null
        }
      />
      <PagePanel fill={false}>
        {inverters.length > 1 && (
          <div className="ui-panel-head gap-2 overflow-x-auto">
            <SegmentedControl
              aria-label="Inverter"
              className="ui-seg"
              value={selectedId}
              onValueChange={(value) => { if (value) setSelectedId(value); }}
            >
              <SegmentedControlIndicator />
              {inverters.map((inverter) => (
                <SegmentedControlItem key={inverter.id} value={inverter.id} className="ui-seg-item">
                  {inverter.name}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </div>
        )}

        <div className="p-4">
          {selected ? (
            // Remount per device so polling resets cleanly.
            <InverterStatsView
              key={selected.id}
              url={selected.url}
              username={selected.username}
              password={selected.password}
            />
          ) : (
            <div className="py-16 text-center">
              <p className="text-sm text-[var(--color-text-secondary)]">No inverter configured yet.</p>
              {onManage ? (
                <Button className="ui-btn mt-4" data-variant="primary" data-size="sm" onClick={onManage}>
                  <Settings2 className="size-3.5" aria-hidden="true" /> Add one in Settings
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </PagePanel>
    </div>
  );
}
