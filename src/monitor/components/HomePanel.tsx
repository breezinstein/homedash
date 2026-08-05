import type { HomeAssistantSnapshot } from '../../types';
import { SourceDot } from './SourceDot';

interface HomePanelProps {
  homeAssistant: HomeAssistantSnapshot | null;
}

function metricIcon(key: string): string {
  switch (key) {
    case 'power': return '⚡';
    case 'energy': return '📊';
    case 'temperature': return '🌡️';
    case 'humidity': return '💧';
    case 'battery': return '🔋';
    case 'doors': return '🚪';
    case 'lights': return '💡';
    case 'switches': return '🔘';
    case 'on': return '✅';
    case 'unavailable': return '⚠️';
    default: return '📈';
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
          <div className="text-[#a0a0a0] text-[12px] py-3 px-1">
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
          <span className="ha-summary-item">✅ {ha.onCount} on</span>
          <span
            className="ha-summary-item"
            style={unavailable.count > 0 ? { color: '#e74c3c' } : { color: '#2ecc71' }}
          >
            {unavailable.count > 0 ? `⚠ ${unavailable.count} unavailable` : '● all online'}
          </span>
          <SourceDot status={ha.status} />
        </div>
      </div>

      {/* Glanceable metrics */}
      {metrics.length > 0 && (
        <div className="ha-metrics">
          {metrics.map((m) => (
            <div
              className="ha-metric"
              key={m.key}
              style={m.key === 'unavailable' && Number(m.value) > 0 ? { borderColor: 'rgba(231,76,60,0.4)' } : undefined}
            >
              <span className="ha-metric-icon">{metricIcon(m.key)}</span>
              <span className="ha-metric-value" style={m.key === batteryLow?.key ? { color: '#e74c3c' } : undefined}>
                {typeof m.value === 'number' && Number.isFinite(m.value) ? m.value : m.value}
              </span>
              {m.unit && <span className="ha-metric-unit">{m.unit}</span>}
              <span className="ha-metric-label">{m.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Unavailable devices */}
      {unavailable.count > 0 && (
        <div className="net-v2-card" style={{ gridColumn: '1 / -1' }}>
          <div className="net-section-title" style={{ color: '#e74c3c' }}>
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
