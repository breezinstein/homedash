import type { OpnsenseSnapshot, NtopngSnapshot, NtopngTalker } from '../../types';
import { RingGauge } from './RingGauge';
import { formatBitRate, formatBytes, formatWindow } from '../format';
import { activeWanSaturation } from '../wan';

interface NetworkPanelProps {
  opnsense?: OpnsenseSnapshot | null;
  ntopng?: NtopngSnapshot | null;
}

/**
 * Network overview panel: 3-column top row (throughput gauge, WAN, LAN)
 * followed by a full-width Top Talkers table.
 */
export function NetworkPanel({ opnsense, ntopng }: NetworkPanelProps) {
  // Gauge = active WAN uplink saturation (see wan.ts). When opnsense is
  // unconfigured the panel renders an ntopng-only view, so saturation is zeroed.
  const sat = opnsense
    ? activeWanSaturation(opnsense)
    : { wan: undefined, wanInBps: null, wanOutBps: null, percent: 0 };
  const activeWan = sat.wan;
  const wanIn = sat.wanInBps;
  const wanOut = sat.wanOutBps;
  const throughputPct = sat.percent;

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
            <div className="text-[var(--mon-text-muted)] text-[12px] py-3 px-1">
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
        {/* Column 1: WAN Uplink saturation */}
        <div className="net-v2-card">
          <div className="net-section-title">WAN Uplink</div>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div className="gauge-box" style={{ margin: '0 auto' }}>
              <RingGauge percent={throughputPct} size={64} warnAt={50} criticalAt={80} />
              <div className="gauge-val" style={{ fontSize: 14 }}>{Math.round(throughputPct)}%</div>
            </div>
            <div className="net-throughput-label">
              ↓ {formatBitRate(wanIn ?? 0)} · ↑ {formatBitRate(wanOut ?? 0)}
            </div>
            <div className="power-label" style={{ marginTop: 2 }}>
              {activeWan?.description || activeWan?.name || 'WAN'} link
              {/* speedBps is already bits/sec; formatBitRate expects bytes/sec */}
              {activeWan?.speedBps ? ` · ${formatBitRate(activeWan.speedBps / 8)}` : ''}
              {' · '}
              FW: {opnsense.firewallStates != null ? opnsense.firewallStates.toLocaleString() : '—'} states
              {' · '}
              DHCP: {opnsense.dhcpLeases != null ? opnsense.dhcpLeases : '—'} leases
            </div>
          </div>
        </div>

        {/* Column 2: WAN Interfaces */}
        <div className="net-v2-card">
          <div className="net-section-title">WAN Interfaces</div>
          <IfacesTable ifaces={opnsense.wanInterfaces} activeColor="var(--mon-ok)" />
        </div>

        {/* Column 3: LAN Interfaces */}
        <div className="net-v2-card">
          <div className="net-section-title">LAN Interfaces</div>
          <IfacesTable ifaces={opnsense.lanInterfaces} activeColor="var(--mon-accent)" />
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
                        style={{ width: `${Math.min(100, t.percentage)}%`, backgroundColor: 'var(--mon-accent)' }}
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
          <div className="text-[var(--mon-text-muted)] text-[12px] py-3 px-1">
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
  const MAX_VISIBLE_TALKERS = 8;
  const visible = talkers.slice(0, MAX_VISIBLE_TALKERS);
  const more = talkers.length - visible.length;
  const maxTx = Math.max(1, ...visible.map((t) => t.txBps ?? 0));
  const maxRx = Math.max(1, ...visible.map((t) => t.rxBps ?? 0));
  const maxBytes = Math.max(1, ...visible.map((t) => t.bytes));
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
      {visible.map((t) => (
        <div className="net-talker-row" key={t.address}>
          <span className="net-talker-name" title={t.address}>
            {t.name || t.address}
          </span>
          <div className="net-talker-trio">
            <div className="net-talker-col">
              <span className="net-talker-col-label">{formatBitRate(t.txBps)}</span>
              <div className="net-talker-bar-bg">
                <div
                  className="net-talker-bar-fill"
                  style={{ width: `${Math.min(100, ((t.txBps ?? 0) / maxTx) * 100)}%`, backgroundColor: 'var(--mon-accent)' }}
                />
              </div>
            </div>
            <div className="net-talker-col">
              <span className="net-talker-col-label">{formatBitRate(t.rxBps)}</span>
              <div className="net-talker-bar-bg">
                <div
                  className="net-talker-bar-fill"
                  style={{ width: `${Math.min(100, ((t.rxBps ?? 0) / maxRx) * 100)}%`, backgroundColor: 'var(--mon-ok)' }}
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
                  style={{ width: `${Math.min(100, (t.bytes / maxBytes) * 100)}%`, backgroundColor: 'var(--mon-warn)' }}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
      {more > 0 && (
        <div className="net-talker-more">
          <span className="net-talker-more-badge">+ {more} more</span>
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
    return <div className="text-[var(--mon-text-muted)] text-[11px] py-2">No interfaces</div>;
  }

  const maxIn = Math.max(1, ...ifaces.map((i) => i.inBps ?? 0));
  const maxOut = Math.max(1, ...ifaces.map((i) => i.outBps ?? 0));

  return (
    <div className="net-ifaces-list">
      {ifaces.map((iface) => {
        const statusColor =
          iface.status === 'up' ? 'var(--mon-ok)' : iface.status === 'degraded' ? 'var(--mon-warn)' : 'var(--mon-danger)';
        const barColor = iface.active ? 'var(--mon-ok)' : activeColor;
        return (
          <div className="net-iface-row" key={iface.name}>
            <div className="net-iface-name">
              <span className="net-iface-dot" style={{ backgroundColor: statusColor }} />
              <span>{iface.description || iface.name}</span>
            </div>
            {/* Download bar */}
            <div className="net-iface-bar-line">
              <span className="net-iface-dir">↓</span>
              <span className="net-iface-bps">{formatBitRate(iface.inBps)}</span>
              <div className="progress-bg" style={{ height: 3, flex: 1 }}>
                <div className="progress-fill"
                  style={{ width: `${((iface.inBps ?? 0) / maxIn) * 100}%`, backgroundColor: barColor }} />
              </div>
            </div>
            {/* Upload bar */}
            <div className="net-iface-bar-line">
              <span className="net-iface-dir">↑</span>
              <span className="net-iface-bps">{formatBitRate(iface.outBps)}</span>
              <div className="progress-bg" style={{ height: 3, flex: 1 }}>
                <div className="progress-fill"
                  style={{ width: `${((iface.outBps ?? 0) / maxOut) * 100}%`, backgroundColor: 'var(--mon-accent)' }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
