import { useCallback, useEffect, useRef, useState } from 'react';
import { Battery, BatteryCharging, BatteryFull, ChevronDown, CircuitBoard, Plug, Settings2, Sun, UtilityPole, Zap } from 'lucide-react';
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@ui-sdk/react/collapsible';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from '@ui-sdk/react/segmented-control';
import { configApi } from '../api/configApi';
import { useDashboard } from '../context/DashboardContext';
import type { InverterStats, InverterMetric, InverterDevice, BatteryRuntime } from '../types';
import { reserveLevel, usageLevel } from '../lib/levels';
import { toBatteryDetail, toInverterDetail } from '../lib/solarDevices';
import { BatteryCard, InverterCard } from '../monitor/view/PowerTab';
import { PageHeader, PagePanel } from './shell/PageHeader';
import { Button, EmptyState, InlineAlert, KeyValueList, LevelMeter, LiveBadge, StatTile } from './ui';

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
  tone: 'success' | 'warning' | 'danger' | 'info';
  Icon: React.ComponentType<{ className?: string }>;
  headline: string;
  detail: string | null;
}

function runtimeSummary(runtime: BatteryRuntime): RuntimeSummary {
  const { state, minutes, floorSoc, soc } = runtime;
  const nowSuffix = soc !== null ? ` · ${Math.round(soc)}% now` : '';
  const eta = minutes !== null ? formatEta(minutes) : '';
  if (state === 'full') return { tone: 'success', Icon: BatteryFull, headline: 'Battery full', detail: 'Fully charged' };
  if (state === 'charging') {
    return {
      tone: 'success',
      Icon: BatteryCharging,
      headline: minutes !== null ? `Full in about ${formatDuration(minutes)}` : 'Charging',
      detail: minutes !== null ? `Full ${eta}${nowSuffix}` : `Working out the charge rate${nowSuffix}`,
    };
  }
  if (state === 'discharging') {
    const target = floorSoc <= 0 ? 'empty' : `${Math.round(floorSoc)}%`;
    return {
      tone: minutes !== null && minutes <= 30 ? 'danger' : minutes !== null && minutes <= 120 ? 'warning' : 'info',
      Icon: Battery,
      headline: minutes !== null ? `About ${formatDuration(minutes)} until ${target}` : 'Discharging',
      detail: minutes !== null ? `Reaches ${target} ${eta}${nowSuffix}` : `Working out the drain rate${nowSuffix}`,
    };
  }
  if (state === 'idle') return { tone: 'info', Icon: Battery, headline: 'Battery idle', detail: `Holding steady${nowSuffix}` };
  return { tone: 'info', Icon: Battery, headline: 'Estimating how long the battery lasts', detail: soc !== null ? `${Math.round(soc)}% now` : null };
}

/** Every reading a device reports, for the details the cards don't show. */
function AllReadings({ device }: { device: InverterDevice }) {
  const entries = Object.entries(device.metrics);
  if (entries.length === 0) return null;
  return (
    <Collapsible className="ui-panel-section">
      <CollapsibleTrigger className="ui-panel-section-head w-full justify-between text-left" aria-label={`All readings for ${device.label}`}>
        All readings ({entries.length})
        <span data-chevron className="text-[var(--color-text-secondary)]"><ChevronDown className="size-3.5" aria-hidden="true" /></span>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <KeyValueList items={entries.map(([, m]) => [m.name, formatMetric(m)] as [string, string])} className="ui-kv-columns" />
      </CollapsiblePanel>
    </Collapsible>
  );
}

function InverterStatsView({ url, username, password, paused }: { url: string; username?: string; password?: string; paused: boolean }) {
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
      setError(e instanceof Error ? e.message : 'The inverter did not answer.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [url, username, password]);

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

  if (loading && !stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[118px] animate-pulse rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--surface-sunken)]" />
        ))}
      </div>
    );
  }
  if (error && !stats) return <InlineAlert tone="danger" title="Can't read this inverter">{error}</InlineAlert>;
  if (!stats) return null;

  const o = stats.overview;
  const batteryPower = asNumber(o.batteryPower);
  const gridPower = asNumber(o.gridPower);
  const socNum = asNumber(o.batterySoc);
  const loadPercent = asNumber(o.loadPercentage);
  const runtime = o.batteryRuntime ?? null;
  const runtimeInfo = runtime && runtime.soc !== null ? runtimeSummary(runtime) : null;
  const charging = batteryPower !== null && batteryPower > 5;
  const discharging = batteryPower !== null && batteryPower < -5;
  const totals = Object.entries(stats.totals ?? {});
  const energy = totals.filter(([, m]) => /wh$/i.test(m.unit ?? ''));

  return (
    <div className="space-y-4">
      {error && <InlineAlert tone="warning">{error} Showing the last readings from {new Date(stats.timestamp).toLocaleTimeString()}.</InlineAlert>}

      {runtimeInfo && (
        <InlineAlert
          tone={runtimeInfo.tone}
          title={runtimeInfo.headline}
          actions={o.inverterMode ? <span className="ui-chip"><CircuitBoard className="size-3" aria-hidden="true" /> {o.inverterMode}</span> : null}
        >
          {runtimeInfo.detail}
        </InlineAlert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Solar" icon={Sun} value={formatValue(o.pvPower, 'W')} detail="Array output now" />
        <StatTile label="Load" icon={Plug} value={formatValue(o.loadPower, 'W')} detail={loadPercent !== null ? undefined : 'Used by the house now'}>
          {loadPercent !== null ? (
            <LevelMeter label="Of rated capacity" value={loadPercent} level={usageLevel(loadPercent, 80, 95)} />
          ) : null}
        </StatTile>
        <StatTile
          label="Battery"
          icon={charging ? BatteryCharging : Battery}
          chip={<span className="ui-chip" data-tone={charging ? 'success' : discharging ? 'warning' : undefined}>{charging ? 'Charging' : discharging ? 'Discharging' : 'Idle'}</span>}
          value={socNum !== null ? `${Math.round(socNum)}%` : formatValue(o.batteryPower, 'W')}
          detail={[
            batteryPower !== null ? `${batteryPower > 0 ? '+' : ''}${formatValue(batteryPower, 'W')}` : null,
            o.batteryVoltage !== null ? formatValue(o.batteryVoltage, 'V') : null,
            o.batteryCurrent !== null ? formatValue(o.batteryCurrent, 'A') : null,
          ].filter(Boolean).join(' · ')}
        >
          {socNum !== null ? <LevelMeter label="Charge" value={socNum} level={reserveLevel(socNum)} className="ui-meter-bare" /> : null}
        </StatTile>
        <StatTile
          label="Grid"
          icon={UtilityPole}
          value={formatValue(o.gridPower, 'W')}
          detail={[
            gridPower === null ? 'Not reporting' : gridPower < -5 ? 'Exporting' : gridPower > 5 ? 'Importing' : 'Idle',
            asNumber(o.gridVoltage) ? `${formatValue(o.gridVoltage, 'V')} · ${formatValue(o.gridFrequency, 'Hz')}` : null,
          ].filter(Boolean).join(' · ')}
        />
      </div>

      {energy.length > 0 && (
        <section className="ui-panel-section">
          <div className="ui-panel-section-head"><Zap className="size-3.5 text-[var(--color-text-secondary)]" aria-hidden="true" /> Energy counters</div>
          <KeyValueList items={energy.map(([, m]) => [m.name, formatMetric(m)] as [string, string])} className="ui-kv-columns" />
        </section>
      )}
      {totals.length > 0 && (
        <Collapsible className="ui-panel-section">
          <CollapsibleTrigger className="ui-panel-section-head w-full justify-between text-left">
            All totals ({totals.length})
            <span data-chevron className="text-[var(--color-text-secondary)]"><ChevronDown className="size-3.5" aria-hidden="true" /></span>
          </CollapsibleTrigger>
          <CollapsiblePanel>
            <KeyValueList items={totals.map(([, m]) => [m.name, formatMetric(m)] as [string, string])} className="ui-kv-columns" />
          </CollapsiblePanel>
        </Collapsible>
      )}

      {stats.inverters.length > 0 && (
        <section className="space-y-2">
          <h3 className="mv-section">Inverters <span className="mv-section-count">{stats.inverters.length}</span></h3>
          <div className="mv-cards">
            {stats.inverters.map((device) => (
              <div key={device.id} className="space-y-2">
                <InverterCard inv={toInverterDetail(device)} title={device.label} />
                <AllReadings device={device} />
              </div>
            ))}
          </div>
        </section>
      )}

      {stats.batteries.length > 0 && (
        <section className="space-y-2">
          <h3 className="mv-section">Batteries <span className="mv-section-count">{stats.batteries.length}</span></h3>
          <div className="mv-cards">
            {stats.batteries.map((device) => (
              <div key={device.id} className="space-y-2">
                <BatteryCard battery={toBatteryDetail(device)} title={device.label} />
                <AllReadings device={device} />
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="pb-1 text-center text-[10px] text-[var(--color-text-secondary)]">
        Last reading {new Date(stats.timestamp).toLocaleTimeString()}
      </p>
    </div>
  );
}

export function InverterPanel({ onManage }: InverterPanelProps) {
  const { inverters } = useDashboard();
  const [selectedId, setSelectedId] = useState<string | null>(inverters[0]?.id ?? null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (inverters.length === 0) {
      if (selectedId !== null) setSelectedId(null);
    } else if (!inverters.some((s) => s.id === selectedId)) {
      setSelectedId(inverters[0].id);
    }
  }, [inverters, selectedId]);

  const selected = inverters.find((s) => s.id === selectedId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Inverter"
        description="Solar, load, grid and battery readings from Solar Assistant."
        actions={
          <>
            {selected ? <LiveBadge intervalMs={POLL_INTERVAL_MS} paused={paused} onPausedChange={setPaused} /> : null}
            {onManage ? (
              <Button variant="ghost" size="sm" onClick={onManage}>
                <Settings2 className="size-3.5" aria-hidden="true" /> Manage inverters
              </Button>
            ) : null}
          </>
        }
      />
      <PagePanel fill={false}>
        {inverters.length > 1 && (
          <div className="ui-panel-head gap-2 overflow-x-auto">
            <SegmentedControl aria-label="Inverter" className="ui-seg" value={selectedId} onValueChange={(value) => { if (value) setSelectedId(value); }}>
              <SegmentedControlIndicator />
              {inverters.map((inverter) => (
                <SegmentedControlItem key={inverter.id} value={inverter.id} className="ui-seg-item">{inverter.name}</SegmentedControlItem>
              ))}
            </SegmentedControl>
          </div>
        )}
        <div className="p-4">
          {selected ? (
            <InverterStatsView key={selected.id} url={selected.url} username={selected.username} password={selected.password} paused={paused} />
          ) : (
            <EmptyState
              icon={Zap}
              title="No inverter set up yet"
              description="Add a Solar Assistant device to see solar, load and battery readings here and on the monitor."
              action={onManage ? <Button variant="primary" size="sm" onClick={onManage}><Settings2 className="size-3.5" aria-hidden="true" /> Add one in Settings</Button> : null}
            />
          )}
        </div>
      </PagePanel>
    </div>
  );
}
