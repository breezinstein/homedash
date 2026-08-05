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

  // Show GB used when total is known; server sends only percent currently
  const memDetail = opnsense.memPercent != null
    ? `${Math.round(opnsense.memPercent)}%`
    : '—';

  return (
    <section className="card">
      <div className="card-header">
        <div className="title-group">
          <span className="title">OPNsense</span>
          <span className="subtitle">Multi-WAN</span>
        </div>
        <SourceDot status={opnsense.status as any} />
      </div>

      {opnsense.status === 'down' ? (
        <div className="text-[#e74c3c] text-[12px]">{opnsense.error || 'Unreachable'}</div>
      ) : (
        <div className="power-body">
          {/* Gauge + throughput */}
          <div style={{ textAlign: 'center' }}>
            <div className="gauge-box" style={{ margin: '0 auto' }}>
              <RingGauge
                percent={throughputPct}
                size={70}
                color="#e67e22"
                warnAt={50}
                warnColor="#e67e22"
                criticalAt={80}
                criticalColor="#e74c3c"
              />
              <div className="gauge-val">{Math.round(throughputPct)}%</div>
            </div>
            <div className="power-kw">
              {formatBps(totalBps).replace('/s', '')}
              <span style={{ fontSize: 11, color: '#a0a0a0', fontWeight: 700 }}> Mbps</span>
            </div>
            <div className="power-label">Total Throughput</div>
          </div>

          {/* Data rows */}
          <div className="data-list">
            <div className="data-row">
              <span className="row-label">Active Gateway</span>
              <span className="gateway-pill">
                {activeWan?.description || activeWan?.name || 'WAN1 (Primary)'}
              </span>
            </div>

            {/* Active WAN */}
            {activeWan && (
              <div className="data-row">
                <span className="row-label">
                  {activeWan.description || activeWan.name}
                </span>
                <span className="row-value" style={{ color: '#2ecc71' }}>
                  ● {formatBps((activeWan.inBps ?? 0) + (activeWan.outBps ?? 0)).replace('/s', '')} Mbps
                </span>
              </div>
            )}

            {/* Standby WANs — show ALL, not just the first */}
            {standbyWans.map((iface) => (
              <div className="data-row" key={iface.name}>
                <span className="row-label">{iface.description || iface.name}</span>
                <span className="row-value" style={{ color: '#a0a0a0' }}>
                  ● Standby
                </span>
              </div>
            ))}

            <div className="data-row">
              <span className="row-label">Memory usage</span>
              <span className="row-value">{memDetail}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
