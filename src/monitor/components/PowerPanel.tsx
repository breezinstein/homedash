import type { SolarSnapshot } from '../../types';
import { RingGauge } from './RingGauge';

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
 * Solar detail panel showing per-inverter and per-battery cards
 * in a node-card grid, similar to the server monitoring layout.
 * Only dynamic / changing metrics are shown.
 */
export function PowerPanel({ solar }: PowerPanelProps) {
  const inverters = solar.inverters ?? [];
  const batteries = solar.batteries ?? [];
  const soc = solar.batterySocPercent;
  const runtime = formatRuntime(solar.batteryRuntimeMins);

  return (
    <div className="solar-detail">
      {/* ── Row 1: SOC gauge | Inverters ── */}
      <div className="power-v2-row">
        {/* SOC gauge */}
        <div className="solar-summary-card" style={{ textAlign: 'center' }}>
          <div style={{ margin: '0 auto', width: 90, height: 90 }}>
            <div className="gauge-box" style={{ width: 90, height: 90 }}>
              <RingGauge percent={soc} size={90} strokeWidth={5} warnAt={30} criticalAt={15} />
              <div className="gauge-val" style={{ fontSize: 20, fontWeight: 800 }}>
                {soc != null ? `${Math.round(soc)}%` : '—'}
              </div>
            </div>
          </div>
          <div className="solar-runtime" style={{ color: runtime.color }}>
            <span className="solar-runtime-label">Est. Runtime</span>
            <span className="solar-runtime-value">{runtime.text}</span>
          </div>
          <div className="solar-runtime-hint">
            {runtime.text !== '—'
              ? 'Time to full charge or depletion based on current rate.'
              : 'Based on SOC trend over last 15 min.'}
          </div>
        </div>

        {/* Inverters — auto-fill grid */}
        <div className="solar-cards-flex">
          {inverters.map((inv) => {
            // Each inverter's load bar is relative to its own apparent-power capacity
            const invCapacity = inv.loadApparentPowerVa ?? inv.loadPowerW ?? 5000;
            const loadPct = Math.min(100, Math.abs(inv.loadPowerW ?? 0) / Math.max(1, invCapacity) * 100);
            const pvMax = Math.max(1, Math.abs(inv.pvPowerW ?? 0), Math.abs(inv.loadPowerW ?? 0));
            return (
              <div key={inv.id} className="node-card">
                <div className="node-title-row">
                  <span className="node-title">
                    Inverter {inv.id}
                    {inv.serialNumber && <span className="node-os">{inv.serialNumber}</span>}
                  </span>
                  <span style={{ fontSize: 10, color: '#808080' }}>{inv.deviceMode || ''}</span>
                </div>

                <BarMetric label="Load" value={fmtPower(inv.loadPowerW)}
                  pct={loadPct} color={loadPct > 80 ? '#e67e22' : '#e0e0e0'} />
                <BarMetric label="PV" value={fmtPower(inv.pvPowerW)}
                  pct={Math.abs(inv.pvPowerW ?? 0) / pvMax * 100} color="#f1c40f" />
                <BarMetric label="Grid" value={fmtPower(inv.gridPowerW)}
                  pct={Math.abs(inv.gridPowerW ?? 0) / Math.max(1, invCapacity) * 100}
                  color={inv.gridPowerW != null && inv.gridPowerW > 5 ? '#e67e22' : '#808080'} />
                <BarMetric label="Battery" value={fmtPower(inv.batteryPowerW)}
                  pct={Math.abs(inv.batteryPowerW ?? 0) / Math.max(1, pvMax) * 100}
                  color={inv.batteryPowerW != null && inv.batteryPowerW > 5 ? '#2ecc71'
                    : inv.batteryPowerW != null && inv.batteryPowerW < -5 ? '#e74c3c' : '#808080'} />

                <div className="node-footer">
                  <span>Batt <b>{fmt(inv.batteryVoltage, 'V')}</b></span>
                  <span>AC <b>{fmt(inv.acOutputVoltage, 'V', 0)} · {fmt(inv.acOutputFrequency, 'Hz')}</b></span>
                  <span>Temp <b style={{ color: (inv.temperature ?? 0) > 50 ? '#e74c3c' : (inv.temperature ?? 0) > 40 ? '#e67e22' : '#e0e0e0' }}>{fmt(inv.temperature, '°C')}</b></span>
                </div>
              </div>
            );
          })}
          {inverters.length === 0 && (
            <div className="empty-grid-msg">No inverter data</div>
          )}
        </div>
      </div>

      {/* ── Batteries — auto-fill grid ── */}
      {batteries.length > 0 && (
        <div className="solar-cards-flex">
          {batteries.map((b) => {
            const batSoc = b.stateOfChargePercent;
            const socColor = batSoc != null
              ? batSoc <= 20 ? '#e74c3c' : batSoc <= 50 ? '#e67e22' : '#2ecc71'
              : '#808080';
            const batCap = b.capacityAh ?? 200;
            const curPct = Math.abs(b.currentA ?? 0) / Math.max(1, batCap * 0.5) * 100;
            const pwrPct = Math.abs(b.powerW ?? 0) / Math.max(1, batCap * 50) * 100;
            return (
              <div key={b.id} className="node-card">
                <div className="node-title-row">
                  <span className="node-title">Battery {b.id}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: socColor }}>
                    {batSoc != null ? `${Math.round(batSoc)}%` : '—'}
                  </span>
                </div>

                <BarMetric label="Power" value={fmtPower(b.powerW)}
                  pct={pwrPct}
                  color={b.powerW != null && b.powerW > 5 ? '#2ecc71'
                    : b.powerW != null && b.powerW < -5 ? '#e74c3c' : '#808080'} />
                <BarMetric label="Current" value={fmt(b.currentA, 'A')}
                  pct={curPct} color="#6c5ce7" />
                <BarMetric label="Voltage" value={fmt(b.voltage, 'V')}
                  pct={Math.abs(b.voltage ?? 0) / 60 * 100} color="#808080" />

                <div className="node-footer">
                  <span>Temp <b>{fmt(b.temperature, '°C')}</b></span>
                  <span>Cycles <b>{fmt(b.cycles, '', 0)}</b></span>
                  <span>Cap <b>{fmt(b.capacityAh, 'Ah', 0)}</b></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {inverters.length === 0 && batteries.length === 0 && (
        <div className="empty-grid-msg" style={{ padding: 30 }}>
          No per-device solar metrics available.
        </div>
      )}
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
