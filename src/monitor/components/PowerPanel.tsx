import type { SolarSnapshot, InverterDetail, BatteryDetail } from '../../types';
import { RingGauge } from './RingGauge';
import { batteryCharging, formatRuntime, runtimeLabel } from '../format';

interface PowerPanelProps {
  solar: SolarSnapshot;
}

function fmt(v: number | null, unit = '', decimals = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const n = decimals === 0 ? Math.round(v) : Number(v.toFixed(decimals));
  return `${n}${unit ? '\u202F' + unit : ''}`;
}

function fmtPower(w: number | null): string {
  if (w == null || !Number.isFinite(w)) return '—';
  if (Math.abs(w) >= 1000) return `${(w / 1000).toFixed(2)}\u202FkW`;
  return `${Math.round(w)}\u202FW`;
}

/**
 * Solar detail panel for the power tab. Designed for a 1920×1080 kiosk:
 * fills the whole tab area (no scrolling), with the SOC gauge + inverters
 * in the top section and batteries below. Each device grid stretches to
 * its section and wraps gracefully if more devices are added.
 */
export function PowerPanel({ solar }: PowerPanelProps) {
  const inverters = solar.inverters ?? [];
  const batteries = solar.batteries ?? [];
  const soc = solar.batterySocPercent;
  const runtime = formatRuntime(solar.batteryRuntimeMins);
  const charging = batteryCharging(solar.batteryPowerW);
  const hasInv = inverters.length > 0;
  const hasBat = batteries.length > 0;

  if (!hasInv && !hasBat) {
    return (
      <div className="empty-grid-msg" style={{ padding: 30 }}>
        No per-device solar metrics available.
      </div>
    );
  }

  return (
    <div className="solar-detail">
      {/* Top: SOC gauge + inverters */}
      <div className={hasInv ? 'power-top-row' : 'power-top-row power-top-row-single'}>
        <SocCard soc={soc} runtime={runtime} charging={charging} />
        {hasInv && (
          <div className="solar-section">
            <div className="solar-section-title">Inverters</div>
            <div className="solar-devices-grid">
              {inverters.map(inv => <InverterCard key={inv.id} inv={inv} />)}
            </div>
          </div>
        )}
      </div>

      {/* Bottom: batteries */}
      {hasBat && (
        <div className="solar-section solar-section-batteries">
          <div className="solar-section-title">Batteries</div>
          <div className="solar-devices-grid">
            {batteries.map(b => <BatteryCard key={b.id} b={b} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function SocCard({ soc, runtime, charging }: { soc: number | null; runtime: { text: string; color: string }; charging: boolean }) {
  // SOC is a "low is bad" gauge: green normal, amber ≤ 30%, red ≤ 15%.
  const socColor = soc == null ? '#34d399' : soc <= 15 ? '#ef4444' : soc <= 30 ? '#f59e0b' : '#34d399';
  return (
    <div className="solar-summary-card">
      <div className="solar-summary-label">Battery SOC</div>
      <div style={{ width: 108, height: 108 }}>
        <div className="gauge-box" style={{ width: 108, height: 108 }}>
          <RingGauge percent={soc} size={108} strokeWidth={7} color={socColor} />
          <div className="gauge-val" style={{ fontSize: 22, fontWeight: 800 }}>
            {soc != null ? `${Math.round(soc)}%` : '—'}
          </div>
        </div>
      </div>
      <div className="solar-runtime" style={{ color: runtime.color }}>
        <span className="solar-runtime-label">{runtimeLabel(charging)}</span>
        <span className="solar-runtime-value">{runtime.text}</span>
      </div>
      <div className="solar-runtime-hint">
        {runtime.text !== '—'
          ? charging
            ? 'Time until fully charged at the current charge rate.'
            : 'Charge: battery power · Discharge: 10-min average house load.'
          : 'Not enough load data to estimate runtime yet.'}
      </div>
    </div>
  );
}

function InverterCard({ inv }: { inv: InverterDetail }) {
  // Every bar is relative to the inverter's rated AC output capacity (its max
  // apparent power, e.g. "Max AC output apparent power: 6.00 kVA"), so Load /
  // PV / Grid / Battery all share one consistent scale. We use the rated max
  // rather than the live load apparent power, which is just the current draw.
  const invMax = inv.maxAcOutputApparentPowerVa
    ?? inv.maxAcOutputPowerW
    ?? inv.loadApparentPowerVa
    ?? inv.loadPowerW
    ?? 5000;
  const loadPct = Math.min(100, Math.abs(inv.loadPowerW ?? 0) / Math.max(1, invMax) * 100);

  return (
    <div className="node-card">
      <div className="node-title-row">
        <span className="node-title">
          Inverter {inv.id}
          {inv.serialNumber && <span className="node-os">{inv.serialNumber}</span>}
        </span>
        <span style={{ fontSize: 10, color: '#636372' }}>{inv.deviceMode || ''}</span>
      </div>

      <BarMetric label="Load" value={fmtPower(inv.loadPowerW)}
        pct={loadPct} color={loadPct > 80 ? '#f59e0b' : '#c7c7d0'} />
      <BarMetric label="PV" value={fmtPower(inv.pvPowerW)}
        pct={Math.abs(inv.pvPowerW ?? 0) / Math.max(1, invMax) * 100} color="#fbbf24" />
      <BarMetric label="Grid" value={fmtPower(inv.gridPowerW)}
        pct={Math.abs(inv.gridPowerW ?? 0) / Math.max(1, invMax) * 100}
        color={inv.gridPowerW != null && inv.gridPowerW > 5 ? '#f59e0b' : '#636372'} />
      <BarMetric label="Battery" value={fmtPower(inv.batteryPowerW)}
        pct={Math.abs(inv.batteryPowerW ?? 0) / Math.max(1, invMax) * 100}
        color={inv.batteryPowerW != null && inv.batteryPowerW > 5 ? '#34d399'
          : inv.batteryPowerW != null && inv.batteryPowerW < -5 ? '#ef4444' : '#636372'} />

      <div className="node-footer">
        <span>Batt <b>{fmt(inv.batteryVoltage, 'V')}</b></span>
        <span>AC <b>{fmt(inv.acOutputVoltage, 'V', 0)} · {fmt(inv.acOutputFrequency, 'Hz')}</b></span>
        <span>Temp <b style={{ color: (inv.temperature ?? 0) > 50 ? '#ef4444' : (inv.temperature ?? 0) > 40 ? '#f59e0b' : '#c7c7d0' }}>{fmt(inv.temperature, '°C')}</b></span>
      </div>
    </div>
  );
}

function BatteryCard({ b }: { b: BatteryDetail }) {
  const batSoc = b.stateOfChargePercent;
  const socColor = batSoc != null
    ? batSoc <= 20 ? '#ef4444' : batSoc <= 50 ? '#f59e0b' : '#34d399'
    : '#636372';
  const batCap = b.capacityAh ?? 200;
  const curPct = Math.abs(b.currentA ?? 0) / Math.max(1, batCap * 0.5) * 100;
  const pwrPct = Math.abs(b.powerW ?? 0) / Math.max(1, batCap * 50) * 100;

  return (
    <div className="node-card">
      <div className="node-title-row">
        <span className="node-title">Battery {b.id}</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: socColor }}>
          {batSoc != null ? `${Math.round(batSoc)}%` : '—'}
        </span>
      </div>

      <BarMetric label="Power" value={fmtPower(b.powerW)}
        pct={pwrPct}
        color={b.powerW != null && b.powerW > 5 ? '#34d399'
          : b.powerW != null && b.powerW < -5 ? '#ef4444' : '#636372'} />
      <BarMetric label="Current" value={fmt(b.currentA, 'A')}
        pct={curPct} color="#6366f1" />
      <BarMetric label="Voltage" value={fmt(b.voltage, 'V')}
        pct={Math.abs(b.voltage ?? 0) / 60 * 100} color="#636372" />

      <div className="node-footer">
        <span>Temp <b>{fmt(b.temperature, '°C')}</b></span>
        <span>Cycles <b>{fmt(b.cycles, '', 0)}</b></span>
        <span>Cap <b>{fmt(b.capacityAh, 'Ah', 0)}</b></span>
      </div>
    </div>
  );
}

/* ── Progress-bar metric row ── */

function BarMetric({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div className="metric-row">
      <div className="metric-header">
        <span>{label}</span>
        <span className="metric-val">{value}</span>
      </div>
      <div className="progress-bg">
        <div className="progress-fill" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
