import type { OpnsenseSnapshot } from '../../types';
import { RingGauge } from './RingGauge';

interface NetworkPanelProps {
  opnsense: OpnsenseSnapshot;
}

function formatBps(bps: number | null): string {
  if (bps == null || !Number.isFinite(bps)) return '—';
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(1)} Gbps`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} Kbps`;
  return `${Math.round(bps)} bps`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

/**
 * Network overview panel: 3-column top row (throughput gauge, WAN, LAN)
 * followed by a full-width Top Talkers table.
 */
export function NetworkPanel({ opnsense }: NetworkPanelProps) {
  const totalIn = opnsense.wanInterfaces
    .filter((i) => i.status === 'up')
    .reduce((s, i) => s + (i.inBps ?? 0), 0);
  const totalOut = opnsense.wanInterfaces
    .filter((i) => i.status === 'up')
    .reduce((s, i) => s + (i.outBps ?? 0), 0);
  const totalBps = totalIn + totalOut;
  const throughputPct = totalBps > 0 ? Math.min(100, (totalBps / 1e9) * 100) : 0;

  // NetFlow top talkers from Insight
  const talkers = opnsense.netflowTalkers ?? [];

  return (
    <div className="net-v2">
      {/* ── Row 1: 3 columns ── */}
      <div className="net-v2-row">
        {/* Column 1: Total Throughput */}
        <div className="net-v2-card">
          <div className="net-section-title">Total Throughput</div>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div className="gauge-box" style={{ margin: '0 auto' }}>
              <RingGauge percent={throughputPct} size={64} color="#e67e22" warnAt={50} criticalAt={80} />
              <div className="gauge-val" style={{ fontSize: 14 }}>{Math.round(throughputPct)}%</div>
            </div>
            <div className="net-throughput-label">
              ↓ {formatBps(totalIn)} · ↑ {formatBps(totalOut)}
            </div>
            <div className="power-label" style={{ marginTop: 2 }}>
              FW: {opnsense.firewallStates != null ? opnsense.firewallStates.toLocaleString() : '—'} states
              {' · '}
              DHCP: {opnsense.dhcpLeases != null ? opnsense.dhcpLeases : '—'} leases
            </div>
          </div>
        </div>

        {/* Column 2: WAN Interfaces */}
        <div className="net-v2-card">
          <div className="net-section-title">WAN Interfaces</div>
          <IfacesTable ifaces={opnsense.wanInterfaces} activeColor="#2ecc71" />
        </div>

        {/* Column 3: LAN Interfaces */}
        <div className="net-v2-card">
          <div className="net-section-title">LAN Interfaces</div>
          <IfacesTable ifaces={opnsense.lanInterfaces} activeColor="#6c5ce7" />
        </div>
      </div>

      {/* ── Row 2: NetFlow Top Talkers ── */}
      {talkers.length > 0 && (
        <div className="net-v2-card" style={{ gridColumn: '1 / -1' }}>
          <div className="net-section-title">Top Talkers · NetFlow (Insight)</div>
          <div className="net-talkers-table">
            {talkers.map((t) => (
              <div className="net-talker-row" key={t.address}>
                <span className="net-talker-name" title={t.address}>
                  {t.hostname || t.address}
                </span>
                <div className="net-talker-bars">
                  <div className="net-talker-bar-group">
                    <span className="net-talker-label">{formatBytes(t.bytes)}</span>
                    <div className="net-talker-bar-bg">
                      <div
                        className="net-talker-bar-fill"
                        style={{ width: `${Math.min(100, t.percentage)}%`, backgroundColor: '#6c5ce7' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback: interface-based talkers when NetFlow unavailable */}
      {talkers.length === 0 && (
        <div className="net-v2-card" style={{ gridColumn: '1 / -1' }}>
          <div className="net-section-title">Top Talkers</div>
          <div className="text-[#a0a0a0] text-[12px] py-3 px-1">
            Enable the os-insight (NetFlow) plugin on OPNsense for per-IP top talkers.
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact interface table for a WAN or LAN column. */
function IfacesTable({
  ifaces,
  activeColor,
}: {
  ifaces: { name: string; description: string; status: string; active: boolean; inBps: number | null; outBps: number | null }[];
  activeColor: string;
}) {
  if (ifaces.length === 0) {
    return <div className="text-[#a0a0a0] text-[11px] py-2">No interfaces</div>;
  }

  const maxIn = Math.max(1, ...ifaces.map((i) => i.inBps ?? 0));
  const maxOut = Math.max(1, ...ifaces.map((i) => i.outBps ?? 0));

  return (
    <div className="net-ifaces-list">
      {ifaces.map((iface) => {
        const statusColor =
          iface.status === 'up' ? '#2ecc71' : iface.status === 'degraded' ? '#e67e22' : '#e74c3c';
        const barColor = iface.active ? '#2ecc71' : activeColor;
        return (
          <div className="net-iface-row" key={iface.name}>
            <div className="net-iface-name">
              <span className="net-iface-dot" style={{ backgroundColor: statusColor }} />
              <span>{iface.description || iface.name}</span>
            </div>
            {/* Download bar */}
            <div className="net-iface-bar-line">
              <span className="net-iface-dir">↓</span>
              <span className="net-iface-bps">{formatBps(iface.inBps)}</span>
              <div className="progress-bg" style={{ height: 3, flex: 1 }}>
                <div className="progress-fill"
                  style={{ width: `${((iface.inBps ?? 0) / maxIn) * 100}%`, backgroundColor: barColor }} />
              </div>
            </div>
            {/* Upload bar */}
            <div className="net-iface-bar-line">
              <span className="net-iface-dir">↑</span>
              <span className="net-iface-bps">{formatBps(iface.outBps)}</span>
              <div className="progress-bg" style={{ height: 3, flex: 1 }}>
                <div className="progress-fill"
                  style={{ width: `${((iface.outBps ?? 0) / maxOut) * 100}%`, backgroundColor: '#6c5ce7' }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
