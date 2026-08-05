import type { OpnsenseSnapshot } from '../../types';
import { SourceDot } from './SourceDot';
import { RingGauge } from './RingGauge';

interface OpnsenseCardProps {
  opnsense: OpnsenseSnapshot;
}

function formatBps(bytesPerSec: number | null): string {
  if (bytesPerSec == null || !Number.isFinite(bytesPerSec)) return '—';
  const bits = bytesPerSec * 8; // bytes/sec → bits/sec
  if (bits >= 1e9) return `${(bits / 1e9).toFixed(1)} Gbps`;
  if (bits >= 1e6) return `${(bits / 1e6).toFixed(1)} Mbps`;
  if (bits >= 1e3) return `${(bits / 1e3).toFixed(1)} Kbps`;
  return `${Math.round(bits)} bps`;
}

export function OpnsenseCard({ opnsense }: OpnsenseCardProps) {
  // Total throughput aggregates every interface (WAN + LAN), not just the WAN.
  const allIfaces = [
    ...(opnsense.wanInterfaces ?? []),
    ...(opnsense.lanInterfaces ?? []),
  ];
  const totalIn = allIfaces.reduce((s, i) => s + (i.inBps ?? 0), 0);
  const totalOut = allIfaces.reduce((s, i) => s + (i.outBps ?? 0), 0);
  const totalBps = totalIn + totalOut;

  // Honest saturation: real bit rate vs. the sum of negotiated link speeds.
  // Falls back to a 1 Gbps reference only if OPNsense reports no line rates.
  const capacity = opnsense.totalLinkCapacityBps;
  const denominator = capacity && capacity > 0 ? capacity : 1e9;
  const throughputPct = totalBps > 0 ? Math.min(100, ((totalBps * 8) / denominator) * 100) : 0;

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
              <RingGauge percent={throughputPct} size={70} warnAt={50} criticalAt={80} />
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
                  <span className="summary-row-icon">📶</span>
                  {activeWan.description || activeWan.name}
                </span>
                <span className="summary-row-value" style={{ color: '#2ecc71', fontSize: 11 }}>
                  ↓ {formatBps(activeWan.inBps ?? 0)} · ↑ {formatBps(activeWan.outBps ?? 0)}
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
