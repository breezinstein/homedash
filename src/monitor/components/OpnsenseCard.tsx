import { Shield, Globe, Signal, Pause, Cpu } from 'lucide-react';
import type { OpnsenseSnapshot } from '../../types';
import { SourceDot } from './SourceDot';
import { RingGauge } from './RingGauge';
import { formatBitRate } from '../format';
import { activeWanSaturation } from '../wan';

interface OpnsenseCardProps {
  opnsense: OpnsenseSnapshot;
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

  const { wan: activeWan, wanInBps: wanIn, wanOutBps: wanOut, percent: throughputPct } =
    activeWanSaturation(opnsense);
  const standbyWans = opnsense.wanInterfaces.filter((i) => !i.active);

  const memDetail = opnsense.memPercent != null
    ? `${Math.round(opnsense.memPercent)}%`
    : '—';

  return (
    <section className="card">
      <div className="card-header">
        <div className="card-title-row">
          <span className="card-icon card-icon-orange">
            <Shield className="w-4 h-4" />
          </span>
          <div className="title-group">
            <span className="title">OPNsense</span>
            <span className="subtitle">Multi-WAN</span>
          </div>
        </div>
        <SourceDot status={opnsense.status as any} />
      </div>

      {opnsense.status === 'down' ? (
        <div className="text-[var(--mon-danger)] text-[12px]">{opnsense.error || 'Unreachable'}</div>
      ) : (
        <div className="summary-body">
          {/* Gauge + throughput headline */}
          <div className="summary-gauge">
            <div className="gauge-box" style={{ margin: '0 auto' }}>
              <RingGauge percent={throughputPct} size={70} warnAt={50} criticalAt={80} />
              <div className="gauge-val">{Math.round(throughputPct)}%</div>
            </div>
            <div className="summary-hero-value">{formatBitRate(activeWan ? (wanIn ?? 0) + (wanOut ?? 0) : totalBps)}</div>
            <div className="summary-hero-label">WAN Throughput</div>
          </div>

          {/* Interfaces + memory */}
          <div className="summary-list">
            <div className="summary-row">
              <span className="summary-row-key">
                <span className="summary-row-icon"><Globe className="w-3.5 h-3.5" /></span>
                Active gateway
              </span>
              <span className="gateway-pill">
                {activeWan?.description || activeWan?.name || 'WAN1 (Primary)'}
              </span>
            </div>

            {activeWan && (
              <div className="summary-row">
                <span className="summary-row-key">
                  <span className="summary-row-icon"><Signal className="w-3.5 h-3.5" /></span>
                  {activeWan.description || activeWan.name}
                </span>
                <span className="summary-row-value" style={{ color: '#34d399', fontSize: 11 }}>
                  ↓ {formatBitRate(activeWan.inBps ?? 0)} · ↑ {formatBitRate(activeWan.outBps ?? 0)}
                </span>
              </div>
            )}

            {standbyWans.map((iface) => (
              <div className="summary-row" key={iface.name}>
                <span className="summary-row-key">
                  <span className="summary-row-icon"><Pause className="w-3.5 h-3.5" /></span>
                  {iface.description || iface.name}
                </span>
                <span className="summary-row-value" style={{ color: 'var(--mon-text-muted)' }}>
                  Standby
                </span>
              </div>
            ))}

            <div className="summary-row">
              <span className="summary-row-key">
                <span className="summary-row-icon"><Cpu className="w-3.5 h-3.5" /></span>
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
