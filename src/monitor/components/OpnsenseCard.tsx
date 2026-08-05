import type { OpnsenseSnapshot } from '../../types';
import { SourceDot } from './SourceDot';
import { RingGauge } from './RingGauge';

interface OpnsenseCardProps {
  opnsense: OpnsenseSnapshot;
}

function formatBps(bps: number | null): string {
  if (bps == null || !Number.isFinite(bps)) return '—';
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(1)} GB/s`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} MB/s`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} KB/s`;
  return `${Math.round(bps)} B/s`;
}

export function OpnsenseCard({ opnsense }: OpnsenseCardProps) {
  // Total throughput across all active WAN interfaces
  const totalIn = opnsense.wanInterfaces
    .filter((i) => i.status === 'up')
    .reduce((s, i) => s + (i.inBps ?? 0), 0);
  const totalOut = opnsense.wanInterfaces
    .filter((i) => i.status === 'up')
    .reduce((s, i) => s + (i.outBps ?? 0), 0);
  const totalBps = totalIn + totalOut;

  // Throughput gauge: arbitrary scale — 1 Gbps ≈ 100 %, capped
  const throughputPct = totalBps > 0 ? Math.min(100, (totalBps / 1e9) * 100) : 0;

  const activeWan = opnsense.wanInterfaces.find((i) => i.active);
  const standbyWans = opnsense.wanInterfaces.filter((i) => !i.active);

  const memDetail = opnsense.memPercent != null
    ? `${Math.round(opnsense.memPercent)}%`
    : '—';

  return (
    <section className="card">
      <div className="card-header">
        <div className="card-title-row">
          <span className="card-icon card-icon-orange">🛡️</span>
          <div className="title-group">
            <span className="title">OPNsense</span>
            <span className="subtitle">Multi-WAN</span>
          </div>
        </div>
        <SourceDot status={opnsense.status as any} />
      </div>

      {opnsense.status === 'down' ? (
        <div className="text-[#e74c3c] text-[12px]">{opnsense.error || 'Unreachable'}</div>
      ) : (
        <div className="summary-body">
          {/* Gauge + throughput headline */}
          <div className="summary-gauge">
            <div className="gauge-box" style={{ margin: '0 auto' }}>
              <RingGauge percent={throughputPct} size={70} color="#e67e22" />
              <div className="gauge-val">{Math.round(throughputPct)}%</div>
            </div>
            <div className="summary-hero-value">{formatBps(totalBps)}</div>
            <div className="summary-hero-label">Throughput</div>
          </div>

          {/* Interfaces + memory */}
          <div className="summary-list">
            <div className="summary-row">
              <span className="summary-row-key">
                <span className="summary-row-icon">🌐</span>
                Active gateway
              </span>
              <span className="gateway-pill">
                {activeWan?.description || activeWan?.name || 'WAN1 (Primary)'}
              </span>
            </div>

            {activeWan && (
              <div className="summary-row">
                <span className="summary-row-key">
                  <span className="summary-row-icon">⬆️</span>
                  {activeWan.description || activeWan.name}
                </span>
                <span className="summary-row-value" style={{ color: '#2ecc71' }}>
                  {formatBps((activeWan.inBps ?? 0) + (activeWan.outBps ?? 0))}
                </span>
              </div>
            )}

            {standbyWans.map((iface) => (
              <div className="summary-row" key={iface.name}>
                <span className="summary-row-key">
                  <span className="summary-row-icon">⏸</span>
                  {iface.description || iface.name}
                </span>
                <span className="summary-row-value" style={{ color: '#a0a0a0' }}>
                  Standby
                </span>
              </div>
            ))}

            <div className="summary-row">
              <span className="summary-row-key">
                <span className="summary-row-icon">🧠</span>
                Memory usage
              </span>
              <span className="summary-row-value">{memDetail}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
