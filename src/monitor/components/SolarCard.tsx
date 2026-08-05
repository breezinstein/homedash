import type { SolarSnapshot } from '../../types';
import { SourceDot } from './SourceDot';
import { RingGauge } from './RingGauge';
import { SummaryRow } from './SummaryRow';

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
 * Top-row Power / Solar card. SOC gauge + PV headline on the left, and
 * colour-coded Grid / Load / Battery / Runtime rows on the right. SOC is
 * a "low is bad" gauge: green, amber ≤ 30 %, red ≤ 15 %.
 */
export function SolarCard({ solar }: PowerCardProps) {
  const soc = solar.batterySocPercent;
  const socColor = soc == null ? '#2ecc71' : soc <= 15 ? '#e74c3c' : soc <= 30 ? '#e67e22' : '#2ecc71';

  const batt = solar.batteryPowerW;
  const battCharging = batt != null && batt > 5;
  const battDischarging = batt != null && batt < -5;
  const battSign = battCharging ? '+' : battDischarging ? '-' : '';
  const battVal = batt != null ? formatPower(Math.abs(batt)) : '—';

  const grid = solar.gridPowerW;
  const gridImport = grid != null && grid > 5;
  const gridExport = grid != null && grid < -5;
  const gridVal = gridImport
    ? formatPower(grid)
    : gridExport
      ? formatPower(Math.abs(grid))
      : formatPower(grid);

  const runtime = formatRuntime(solar.batteryRuntimeMins);

  return (
    <section className="card">
      <div className="card-header">
        <div className="card-title-row">
          <span className="card-icon card-icon-green">☀️</span>
          <div className="title-group">
            <span className="title">Power</span>
            <span className="subtitle">Solar Assistant</span>
          </div>
        </div>
        <SourceDot status={solar.status} />
      </div>

      <div className="summary-body">
        {/* Gauge + PV headline */}
        <div className="summary-gauge">
          <div className="gauge-box" style={{ margin: '0 auto' }}>
            <RingGauge percent={soc} size={70} color={socColor} />
            <div className="gauge-val">{soc != null ? `${Math.round(soc)}%` : '—'}</div>
          </div>
          <div className="summary-hero-value">{formatPower(solar.pvPowerW)}</div>
          <div className="summary-hero-label">PV generation</div>
        </div>

        {/* Metrics */}
        <div className="summary-list">
          <SummaryRow
            icon="🔋"
            label="Battery"
            value={`${battSign} ${battVal}`.trim()}
            accent={battCharging ? '#2ecc71' : battDischarging ? '#e74c3c' : undefined}
          />
          <SummaryRow
            icon="🔌"
            label="Grid"
            value={gridVal}
            accent={gridExport ? '#2ecc71' : gridImport ? '#e67e22' : undefined}
          />
          <SummaryRow icon="🏠" label="House load" value={formatPower(solar.loadPowerW)} />
          <SummaryRow icon="⏱" label="Battery runtime" value={runtime.text} accent={runtime.color} />
        </div>
      </div>
    </section>
  );
}
