import type { OpnsenseSnapshot } from '../../types';
import { SourceDot } from './SourceDot';

interface OpnsenseCardProps { opnsense: OpnsenseSnapshot; }

function formatBps(bps: number | null): string {
  if (bps == null || !Number.isFinite(bps)) return '—';
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(1)} Gbps`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} Kbps`;
  return `${Math.round(bps)} bps`;
}

export function OpnsenseCard({ opnsense }: OpnsenseCardProps) {
  return (
    <section className="flex flex-col rounded-2xl border border-[var(--color-border)] p-[14px_16px] bg-[var(--color-surface)] min-h-0 overflow-hidden">
      <div className="flex items-center gap-[9px] mb-[11px]">
        <h2 className="text-[14.5px] font-semibold text-[var(--color-text-primary)]">🛡 OPNSense</h2>
        <span className="text-[11px] text-[var(--color-text-secondary)]">{opnsense.hostname || '—'}</span>
        <div className="ml-auto"><SourceDot status={opnsense.status as any} /></div>
      </div>

      {opnsense.status === 'down' ? (
        <div className="text-[var(--color-error)] text-[12px]">{opnsense.error || 'Unreachable'}</div>
      ) : (
        <div className="space-y-[6px] text-[12px]">
          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">Version</span>
            <span className="tabular-nums">{opnsense.version || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">Uptime</span>
            <span className="tabular-nums">{opnsense.uptime || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">CPU</span>
            <span className="tabular-nums font-semibold">{opnsense.cpuPercent != null ? `${opnsense.cpuPercent}%` : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">Memory</span>
            <span className="tabular-nums font-semibold">{opnsense.memPercent != null ? `${opnsense.memPercent}%` : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">Firewall states</span>
            <span className="tabular-nums">{opnsense.firewallStates != null ? opnsense.firewallStates.toLocaleString() : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">DHCP leases</span>
            <span className="tabular-nums">{opnsense.dhcpLeases != null ? opnsense.dhcpLeases : '—'}</span>
          </div>

          {opnsense.wanInterfaces.length > 0 && (
            <div className="border-t border-[var(--color-border)] pt-2 mt-2">
              <div className="text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1">WAN Interfaces</div>
              {opnsense.wanInterfaces.map((iface, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${iface.status === 'up' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-error)]'}`} />
                    <span>{iface.description || iface.name}</span>
                  </div>
                  <span className="tabular-nums text-[11px] text-[var(--color-text-secondary)]">
                    ↓ {formatBps(iface.inBps)}  ↑ {formatBps(iface.outBps)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
