/**
 * HomeStatusCard — Home Assistant / smart-home snapshot for the top grid.
 *
 * Driven by the live Home Assistant poller. The hero shows the pressure pump
 * (like the original mock), and the rows surface the key glanceable
 * household metrics: lights on, doors open, unavailable devices, current
 * power, and the lowest battery level.
 */

import { House, Lightbulb, DoorOpen, AlertTriangle, Plug, Battery } from 'lucide-react';
import type { HomeAssistantSnapshot, HomeAssistantMetric, HomeAssistantPump } from '../../types';
import { SourceDot } from './SourceDot';
import { SummaryRow } from './SummaryRow';
import { formatDuration } from '../format';

interface HomeStatusCardProps {
  homeAssistant: HomeAssistantSnapshot | null;
}

function metric(ha: HomeAssistantSnapshot, key: string): HomeAssistantMetric | undefined {
  return ha.metrics.find((m) => m.key === key);
}

/** Hero duration line: timer remaining when running, otherwise stopped/paused. */
function pumpDuration(pump: HomeAssistantPump): string {
  if (pump.running && pump.timerRemaining != null) {
    return `${formatDuration(pump.timerRemaining)} remaining`;
  }
  if (pump.running) {
    if (pump.since) return `Running ${formatDuration((Date.now() - pump.since) / 1000)}`;
    return 'Running indefinitely';
  }
  if (!pump.present) return 'Not configured';
  if (pump.state === 'paused') return 'Paused';
  return 'Stopped';
}

export function HomeStatusCard({ homeAssistant: ha }: HomeStatusCardProps) {
  const down = !ha || ha.status === 'down';
  const unavailableCount = ha?.unavailable?.count ?? 0;
  const lights = ha ? metric(ha, 'lights') : undefined;
  const power = ha ? metric(ha, 'power') : undefined;
  const battery = ha ? metric(ha, 'battery') : undefined;
  const doors = ha ? metric(ha, 'doors') : undefined;

  return (
    <section className="card">
      <div className="card-header">
        <div className="card-title-row">
          <span className="card-icon card-icon-blue">
            <House className="w-4 h-4" />
          </span>
          <div className="title-group">
            <span className="title">Home Status</span>
            <span className="subtitle">{ha?.locationName || 'Home Assistant'}</span>
          </div>
        </div>
        <SourceDot status={down ? 'down' : (ha!.status as any)} />
      </div>

      {down ? (
        <div className="text-[var(--mon-danger)] text-[12px]">{ha?.error || 'Home Assistant unreachable'}</div>
      ) : (
        <div className="summary-body">
          {/* Hero: pressure pump */}
          <div className="summary-gauge">
            <div className="pump-box">
              <div
                className="pump-dot"
                style={{ color: ha.pump.running ? '#38bdf8' : 'var(--mon-text-muted)' }}
              >
                ● PUMP {ha.pump.running ? 'RUNNING' : 'OFF'}
              </div>
              <div className="infinity-symbol" style={{ color: ha.pump.running ? '#ffffff' : 'var(--mon-text-faint)' }}>
                {ha.pump.running
                  ? (ha.pump.timerRemaining != null ? '⏳' : '∞')
                  : '■'}
              </div>
              <div className="pump-duration">⏱ {pumpDuration(ha.pump)}</div>
              <div className="pump-label">{ha.pump.label}</div>
            </div>
          </div>

          {/* Metrics */}
          <div className="summary-list">
            <SummaryRow icon={<Lightbulb className="w-3.5 h-3.5" />} label="Lights on" value={lights ? `${lights.value} lights` : '—'} />
            <SummaryRow
              icon={<DoorOpen className="w-3.5 h-3.5" />}
              label="Doors open"
              value={doors ? `${doors.value} open` : '—'}
              accent={Number(doors?.value) > 0 ? '#ef4444' : undefined}
            />
            <SummaryRow
              icon={<AlertTriangle className="w-3.5 h-3.5" />}
              label="Unavailable devices"
              value={`${unavailableCount} unavailable`}
              accent={unavailableCount > 0 ? '#ef4444' : undefined}
            />
            {power && (
              <SummaryRow icon={<Plug className="w-3.5 h-3.5" />} label={power.label} value={`${power.value} ${power.unit ?? ''}`} />
            )}
            {battery && (
              <SummaryRow
                icon={<Battery className="w-3.5 h-3.5" />}
                label={battery.label}
                value={`${battery.value} ${battery.unit ?? ''}`}
                accent={Number(battery.value) <= 20 ? '#ef4444' : undefined}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
