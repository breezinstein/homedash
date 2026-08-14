import {
  Zap,
  Gauge,
  Thermometer,
  Droplets,
  Battery,
  DoorOpen,
  Lightbulb,
  ToggleRight,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import type { HomeAssistantSnapshot } from '../../types';
import { SourceDot } from './SourceDot';

interface HomePanelProps {
  homeAssistant: HomeAssistantSnapshot | null;
}

function metricIcon(key: string): React.ComponentType<{ className?: string }> {
  switch (key) {
    case 'power': return Zap;
    case 'energy': return Gauge;
    case 'temperature': return Thermometer;
    case 'humidity': return Droplets;
    case 'battery': return Battery;
    case 'doors': return DoorOpen;
    case 'lights': return Lightbulb;
    case 'switches': return ToggleRight;
    case 'unavailable': return AlertTriangle;
    default: return Activity;
  }
}

/**
 * Home tab — glance-able overview of the most important Home Assistant
 * metrics plus the list of unavailable devices (dropped MQTT etc).
 */
export function HomePanel({ homeAssistant: ha }: HomePanelProps) {
  if (!ha || ha.status === 'down') {
    return (
      <div className="net-v2">
        <div className="net-v2-card" style={{ gridColumn: '1 / -1' }}>
          <div className="net-section-title">Home Assistant</div>
          <div className="text-[var(--mon-text-muted)] text-[12px] py-3 px-1">
            {ha?.error || 'Configure Home Assistant in Monitor Settings to see the overview.'}
          </div>
        </div>
      </div>
    );
  }

  const { metrics, unavailable } = ha;
  const batteryLow = metrics.find((m) => m.key === 'battery' && Number(m.value) <= 20);

  return (
    <div className="net-v2">
      {/* Header strip */}
      <div className="net-v2-card" style={{ gridColumn: '1 / -1' }}>
        <div className="net-section-title">
          {ha.locationName || 'Home Assistant'}
          {ha.version && <span className="net-talker-source">v{ha.version}</span>}
        </div>
        <div className="ha-summary-strip">
          <span className="ha-summary-item">🧩 {ha.entityCount} entities</span>
          <span
            className="ha-summary-item"
            style={unavailable.count > 0 ? { color: '#ef4444' } : { color: '#34d399' }}
          >
            {unavailable.count > 0 ? `⚠ ${unavailable.count} unavailable` : '● all online'}
          </span>
          <SourceDot status={ha.status} />
        </div>
      </div>

      {/* Glanceable metrics */}
      {metrics.length > 0 && (
        <div className="ha-metrics">
          {metrics.map((m) => {
            const Icon = metricIcon(m.key);
            return (
              <div
                className="ha-metric"
                key={m.key}
                style={m.key === 'unavailable' && Number(m.value) > 0 ? { borderColor: 'rgba(239,68,68,0.4)' } : undefined}
              >
                <span className="ha-metric-icon"><Icon className="w-4 h-4" /></span>
                <span className="ha-metric-value" style={m.key === batteryLow?.key ? { color: '#ef4444' } : undefined}>
                  {typeof m.value === 'number' && Number.isFinite(m.value) ? m.value : m.value}
                </span>
                {m.unit && <span className="ha-metric-unit">{m.unit}</span>}
                <span className="ha-metric-label">{m.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Unavailable devices */}
      {unavailable.count > 0 && (
        <div className="net-v2-card" style={{ gridColumn: '1 / -1' }}>
          <div className="net-section-title" style={{ color: '#ef4444' }}>
            Unavailable devices · {unavailable.count}
          </div>
          <div className="ha-unavailable">
            {unavailable.devices.map((d) => (
              <div className="ha-unavail-row" key={d.entityId} title={d.entityId}>
                <span className="ha-unavail-dot" />
                <span className="ha-unavail-name">{d.name}</span>
                <span className="ha-unavail-id">{d.entityId}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
