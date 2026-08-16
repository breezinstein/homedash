import { Sun, Battery, Plug, House, Clock } from 'lucide-react';
import type { SolarSnapshot } from '../../types';
import { SourceDot } from './SourceDot';
import { RingGauge } from './RingGauge';
import { SummaryRow } from './SummaryRow';
import { batteryCharging, formatRuntime, runtimeLabel } from '../format';

interface PowerCardProps {
  solar: SolarSnapshot;
}

function formatPower(w: number | null): string {
  if (w == null || !Number.isFinite(w)) return '—';
  if (Math.abs(w) >= 1000) return `${(w / 1000).toFixed(2)} kW`;
  return `${Math.round(w)} W`;
}

/**
 * Top-row Power / Solar card. SOC gauge + PV headline on the left, and
 * colour-coded Grid / Load / Battery / Runtime rows on the right. SOC is
 * a "low is bad" gauge: green, amber ≤ 30 %, red ≤ 15 %.
 */
export function SolarCard({ solar }: PowerCardProps) {
  const soc = solar.batterySocPercent;
  const socColor = soc == null ? 'var(--mon-ok)' : soc <= 15 ? 'var(--mon-danger)' : soc <= 30 ? 'var(--mon-warn)' : 'var(--mon-ok)';

  const batt = solar.batteryPowerW;
  const battCharging = batteryCharging(batt);
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
          <span className="card-icon card-icon-green">
            <Sun className="w-4 h-4" />
          </span>
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
            icon={<Battery className="w-3.5 h-3.5" />}
            label="Battery"
            value={`${battSign} ${battVal}`.trim()}
            accent={battCharging ? 'var(--mon-ok)' : battDischarging ? 'var(--mon-danger)' : undefined}
          />
          <SummaryRow
            icon={<Plug className="w-3.5 h-3.5" />}
            label="Grid"
            value={gridVal}
            accent={gridExport ? 'var(--mon-ok)' : gridImport ? 'var(--mon-warn)' : undefined}
          />
          <SummaryRow icon={<House className="w-3.5 h-3.5" />} label="House load" value={formatPower(solar.loadPowerW)} />
          <SummaryRow icon={<Clock className="w-3.5 h-3.5" />} label={runtimeLabel(battCharging)} value={runtime.text} accent={runtime.color} />
        </div>
      </div>
    </section>
  );
}
