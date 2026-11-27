import {
  Activity,
  AlertTriangle,
  Battery,
  DoorOpen,
  Droplets,
  Gauge,
  House,
  Lightbulb,
  Thermometer,
  Timer,
  ToggleRight,
  Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { HomeAssistantPump, HomeAssistantSnapshot } from '../../types';
import { KeyValueList, RingMeter } from '../../components/ui';
import { formatDuration } from '../format';
import { Chip, Dot, Empty, MonPanel, SectionLabel } from './parts';

const UNAVAILABLE_SHOWN = 18;

const METRIC_ICON: Record<string, ComponentType<{ className?: string }>> = {
  power: Zap,
  energy: Gauge,
  temperature: Thermometer,
  humidity: Droplets,
  battery: Battery,
  doors: DoorOpen,
  lights: Lightbulb,
  switches: ToggleRight,
  unavailable: AlertTriangle,
};

function metricTone(key: string, value: number | string | null): 'danger' | 'warning' | undefined {
  const n = Number(value);
  if (key === 'battery' && Number.isFinite(n)) return n <= 10 ? 'danger' : n <= 20 ? 'warning' : undefined;
  if (key === 'unavailable' && n > 0) return 'danger';
  if (key === 'doors' && n > 0) return 'warning';
  return undefined;
}

/** Home Assistant at a glance: the pump, the auto-picked readings and what has dropped off. */
export function HomeTab({ ha }: { ha: HomeAssistantSnapshot | null }) {
  if (!ha) return <Empty>Connect Home Assistant in Settings → Home Assistant to see your home here.</Empty>;
  if (ha.status === 'down') return <Empty>Home Assistant isn't answering{ha.error ? `: ${ha.error}` : '.'}</Empty>;

  const online = ha.entityCount - ha.unavailable.count;
  const pct = ha.entityCount ? (online / ha.entityCount) * 100 : null;

  return (
    <div className="mv-stack">
      <div className="mv-grid-2">
        {ha.pump.present ? <PumpPanel pump={ha.pump} /> : null}
        <MonPanel
          title="Home Assistant"
          icon={House}
          actions={ha.unavailable.count ? <Chip tone="warning">{ha.unavailable.count} unavailable</Chip> : <Chip tone="success">All online</Chip>}
          span={!ha.pump.present}
        >
          <KeyValueList
            items={[
              ['Location', ha.locationName || '—'],
              ['Version', ha.version || '—'],
              ['Entities', `${ha.entityCount} tracked · ${ha.onCount} on`],
              ['Online', pct != null ? `${online} of ${ha.entityCount} (${pct.toFixed(1)}%)` : '—'],
            ]}
          />
        </MonPanel>
      </div>

      {ha.metrics.length > 0 && (
        <>
          <SectionLabel>At a glance</SectionLabel>
          <div className="mv-metrics">
            {ha.metrics.map((m) => {
              const Icon = METRIC_ICON[m.key] ?? Activity;
              const tone = metricTone(m.key, m.value);
              return (
                <div key={m.key} className="mv-metric" data-tone={tone}>
                  <span className="mv-metric-label">
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{m.label}</span>
                  </span>
                  <span className="mv-metric-value">
                    {typeof m.value === 'number' ? Number(m.value.toFixed(1)).toLocaleString() : m.value ?? '—'}
                    {m.unit ? <small>{m.unit}</small> : null}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {ha.unavailable.count > 0 && (
        <>
          <SectionLabel count={ha.unavailable.count}>Unavailable devices</SectionLabel>
          <ul className="mv-panel mv-unavail">
            {ha.unavailable.devices.slice(0, UNAVAILABLE_SHOWN).map((d) => (
              <li key={d.entityId} className="mv-unavail-item" title={d.entityId}>
                <Dot tone="danger" />
                <span className="min-w-0">
                  <span className="mv-row-title">{d.name}</span>
                  <span className="mv-row-sub mv-mono">{d.entityId}</span>
                </span>
              </li>
            ))}
          </ul>
          {ha.unavailable.count > UNAVAILABLE_SHOWN && (
            <p className="mv-legend">+{ha.unavailable.count - Math.min(UNAVAILABLE_SHOWN, ha.unavailable.devices.length)} more unavailable</p>
          )}
        </>
      )}
    </div>
  );
}

function PumpPanel({ pump }: { pump: HomeAssistantPump }) {
  const timed = pump.running && pump.timerRemaining != null && pump.timerDuration;
  const left = pump.timerRemaining ?? 0;
  const status = pump.running ? 'Running' : pump.state === 'paused' ? 'Paused' : 'Off';
  const headline = pump.running
    ? timed ? `${formatDuration(left, { compact: false })}` : pump.since ? formatDuration((Date.now() - pump.since) / 1000) : 'No timer'
    : status;
  const detail = pump.running
    ? timed
      ? `Left on a ${formatDuration(pump.timerDuration ?? 0, { compact: true })} timer${pump.since ? ` · started ${new Date(pump.since).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`
      : 'Running with no timer'
    : 'Not running';
  return (
    <MonPanel
      title={pump.name || 'Pump'}
      icon={Timer}
      actions={<Chip tone={pump.running ? 'success' : undefined}>{status}</Chip>}
    >
      <div className="mv-pump">
        <RingMeter
          label="Pump timer left"
          size="lg"
          value={timed ? left : pump.running ? 100 : 0}
          max={timed ? pump.timerDuration ?? 100 : 100}
          valueText={timed ? `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : pump.running ? '∞' : '—'}
          level="info"
        />
        <div className="min-w-0">
          <p className="ui-tile-value">{headline}</p>
          <p className="ui-tile-detail">{detail}</p>
          <p className="ui-tile-detail mv-faint">{pump.label}</p>
        </div>
      </div>
    </MonPanel>
  );
}
