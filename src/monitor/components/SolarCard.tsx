import type { SolarSnapshot } from '../../types';
import { SourceDot } from './SourceDot';
import { RingGauge } from './RingGauge';

interface PowerCardProps {
  solar: SolarSnapshot;
}

function formatPower(w: number | null): string {
  if (w == null || !Number.isFinite(w)) return '—';
  if (Math.abs(w) >= 1000) return `${(w / 1000).toFixed(2)} kW`;
  return `${Math.round(w)} W`;
}

function formatRuntime(mins: number | null): { text: string; color: string } {
  if (mins == null || !Number.isFinite(mins)) return { text: '—', color: '#808080' };
  const total = Math.max(0, Math.round(mins));
  if (total < 1) return { text: '<1m', color: '#e74c3c' };
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  let text: string;
  if (d > 0) text = `${d}d ${h}h`;
  else if (h > 0) text = `${h}h ${m}m`;
  else text = `${m}m`;
  const color = total < 120 ? '#e74c3c' : total < 240 ? '#e67e22' : '#2ecc71';
  return { text, color };
}

/**
 * Top-row Power card matching the homelab dashboard mockup.
 * Replaces the old SolarCard with a compact 2-column internal grid
 * (gauge + metrics) that fits the 4-card top row.
 */
export function SolarCard({ solar }: PowerCardProps) {
  const soc = solar.batterySocPercent;

  const batt = solar.batteryPowerW;
  const battCharging = batt != null && batt > 5;
  const battDischarging = batt != null && batt < -5;
  const battSign = battCharging ? '+' : battDischarging ? '-' : '';
  const battVal = batt != null ? formatPower(Math.abs(batt)) : '—';

  const grid = solar.gridPowerW;
  const gridImport = grid != null && grid > 5;
  const gridExport = grid != null && grid < -5;
  const gridVal = gridImport
    ? `${formatPower(grid)}`
    : gridExport
      ? `${formatPower(Math.abs(grid))}`
      : formatPower(grid);

  const runtime = formatRuntime(solar.batteryRuntimeMins);

  return (
    <section className="card">
      {/* Header */}
      <div className="card-header">
        <div className="title-group">
          <span className="title">Power</span>
          <span className="subtitle">Solar Assistant</span>
        </div>
        <SourceDot status={solar.status} />
      </div>

      {/* Body: gauge left, metrics right */}
      <div className="power-body">
        {/* Gauge + big number */}
        <div style={{ textAlign: 'center' }}>
          <div className="gauge-box" style={{ margin: '0 auto' }}>
            <RingGauge percent={soc} size={70} />
            <div className="gauge-val">{soc != null ? `${Math.round(soc)}%` : '—'}</div>
          </div>
          <div className="power-kw">{formatPower(solar.pvPowerW)}</div>
          <div className="power-label">PV generation</div>
        </div>

        {/* Data rows */}
        <div className="data-list">
          <DataRow label="Grid" value={gridVal} muted={!gridImport && !gridExport} />
          <DataRow label="Load" value={formatPower(solar.loadPowerW)} />
          <DataRow
            label="Battery"
            value={`${battSign} ${battVal}`}
            accent={battCharging ? 'green' : battDischarging ? 'red' : undefined}
          />
          <DataRow label="Battery runtime" value={runtime.text} runtimeColor={runtime.color} />
        </div>
      </div>
    </section>
  );
}

function DataRow({
  label,
  value,
  muted,
  accent,
  runtimeColor,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: 'green' | 'red';
  runtimeColor?: string;
}) {
  const colorClass =
    accent === 'green' ? 'text-[#2ecc71]' : accent === 'red' ? 'text-[#e74c3c]' : '';
  const style = runtimeColor ? { color: runtimeColor, fontSize: 13, fontWeight: 800 } : undefined;
  return (
    <div className="data-row">
      <span className={`row-label ${muted ? 'opacity-50' : ''}`}>{label}</span>
      <span className={`row-value ${colorClass}`} style={style}>{value}</span>
    </div>
  );
}
