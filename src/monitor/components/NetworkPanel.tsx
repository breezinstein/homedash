import type { OpnsenseSnapshot, NtopngSnapshot, NtopngTalker } from '../../types';
import { RingGauge } from './RingGauge';

interface NetworkPanelProps {
  opnsense?: OpnsenseSnapshot | null;
  ntopng?: NtopngSnapshot | null;
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

/** Compact window label for the DATA counter, e.g. "5d 13h" or "7m". */
function formatWindow(firstSeen: number | null): string | null {
  if (firstSeen == null) return null;
  const secs = Math.max(0, Math.floor(Date.now() / 1000 - firstSeen));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/**
 * Network overview panel: 3-column top row (throughput gauge, WAN, LAN)
 * followed by a full-width Top Talkers table.
 */
export function NetworkPanel({ opnsense, ntopng }: NetworkPanelProps) {
  // Total throughput aggregates every interface (WAN + LAN), not just the WAN.
  const allIfaces = [
    ...(opnsense?.wanInterfaces ?? []),
    ...(opnsense?.lanInterfaces ?? []),
  ];
  const totalIn = allIfaces.reduce((s, i) => s + (i.inBps ?? 0), 0);
  const totalOut = allIfaces.reduce((s, i) => s + (i.outBps ?? 0), 0);
  const totalBps = totalIn + totalOut;
  const throughputPct = totalBps > 0 ? Math.min(100, (totalBps / 1e9) * 100) : 0;

  // ntopng top talkers take precedence; OPNsense NetFlow is the fallback.
  const ntopngTalkers = ntopng?.topTalkers ?? [];
  const netflowTalkers = opnsense?.netflowTalkers ?? [];

  if (!opnsense) {
    return (
      <div className="net-v2">
        <div className="net-v2-card" style={{ gridColumn: '1 / -1' }}>
          <div className="net-section-title">
            Top Talkers · ntopng
            {ntopng?.ifname && <span className="net-talker-source">{ntopng.ifname}</span>}
          </div>
          {ntopngTalkers.length > 0 ? (
            <NtopTalkersTable talkers={ntopngTalkers} />
          ) : (
            <div className="text-[#a0a0a0] text-[12px] py-3 px-1">
              Configure ntopng in Monitor Settings for per-host top talkers.
            </div>
          )}
        </div>
      </div>
    );
  }

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

      {/* ── Row 2: Top Talkers (ntopng preferred, OPNsense NetFlow fallback) ── */}
      {ntopngTalkers.length > 0 && (
        <div className="net-v2-card" style={{ gridColumn: '1 / -1' }}>
          <div className="net-section-title">
            Top Talkers · ntopng
            {ntopng?.ifname && <span className="net-talker-source">{ntopng.ifname}</span>}
            {ntopng?.source === 'community' && <span className="net-talker-source">Community</span>}
          </div>
          <NtopTalkersTable talkers={ntopngTalkers} />
        </div>
      )}

      {ntopngTalkers.length === 0 && netflowTalkers.length > 0 && (
        <div className="net-v2-card" style={{ gridColumn: '1 / -1' }}>
          <div className="net-section-title">Top Talkers · NetFlow (Insight)</div>
          <div className="net-talkers-table">
            {netflowTalkers.map((t) => (
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

      {/* Fallback: interface-based talkers when neither source is available */}
      {ntopngTalkers.length === 0 && netflowTalkers.length === 0 && (
        <div className="net-v2-card" style={{ gridColumn: '1 / -1' }}>
          <div className="net-section-title">Top Talkers</div>
          <div className="text-[#a0a0a0] text-[12px] py-3 px-1">
            Configure ntopng in Monitor Settings for per-host top talkers, or enable the os-insight
            (NetFlow) plugin on OPNsense.
          </div>
        </div>
      )}
    </div>
  );
}

/** Top talker table for ntopng — three columns per row: TX, RX, DATA. */
function NtopTalkersTable({ talkers }: { talkers: NtopngTalker[] }) {
  const maxTx = Math.max(1, ...talkers.map((t) => t.txBps ?? 0));
  const maxRx = Math.max(1, ...talkers.map((t) => t.rxBps ?? 0));
  const maxBytes = Math.max(1, ...talkers.map((t) => t.bytes));
  return (
    <div className="net-talkers-table">
      <div className="net-talker-row net-talker-head">
        <span className="net-talker-name">Host</span>
        <div className="net-talker-trio">
          <span className="net-talker-col-head">TX</span>
          <span className="net-talker-col-head">RX</span>
          <span className="net-talker-col-head">DATA</span>
        </div>
      </div>
      {talkers.map((t) => (
        <div className="net-talker-row" key={t.address}>
          <span className="net-talker-name" title={t.address}>
            {t.name || t.address}
          </span>
          <div className="net-talker-trio">
            <div className="net-talker-col">
              <span className="net-talker-col-label">{formatBps(t.txBps)}</span>
              <div className="net-talker-bar-bg">
                <div
                  className="net-talker-bar-fill"
                  style={{ width: `${Math.min(100, ((t.txBps ?? 0) / maxTx) * 100)}%`, backgroundColor: '#6c5ce7' }}
                />
              </div>
            </div>
            <div className="net-talker-col">
              <span className="net-talker-col-label">{formatBps(t.rxBps)}</span>
              <div className="net-talker-bar-bg">
                <div
                  className="net-talker-bar-fill"
                  style={{ width: `${Math.min(100, ((t.rxBps ?? 0) / maxRx) * 100)}%`, backgroundColor: '#2ecc71' }}
                />
              </div>
            </div>
            <div className="net-talker-col">
              <span className="net-talker-col-label">
                {formatBytes(t.bytes)}
                {formatWindow(t.firstSeen) && (
                  <span className="net-talker-sub">· {formatWindow(t.firstSeen)}</span>
                )}
              </span>
              <div className="net-talker-bar-bg">
                <div
                  className="net-talker-bar-fill"
                  style={{ width: `${Math.min(100, (t.bytes / maxBytes) * 100)}%`, backgroundColor: '#e67e22' }}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
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
