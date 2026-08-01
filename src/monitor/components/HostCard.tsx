import type { HostSnapshot } from '../../types';
import { SourceDot } from './SourceDot';

interface HostCardProps {
  host: HostSnapshot;
}

function barColor(v: number | null): string {
  if (v === null) return 'var(--color-border)';
  if (v >= 90) return 'var(--color-error)';
  if (v >= 75) return 'var(--color-warning)';
  return 'var(--color-primary)';
}

function StatBar({ label, icon, pct, detail }: { label: string; icon: string; pct: number | null; detail?: string }) {
  const val = pct === null ? '—' : `${pct.toFixed(0)}%`;
  return (
    <div className="mb-[9px]">
      <div className="flex justify-between text-[12px] mb-1">
        <span className="text-[var(--color-text-secondary)] flex gap-[6px] items-center">{icon} {label}</span>
        <span className="font-semibold tabular-nums text-[var(--color-text-primary)]">{val}</span>
      </div>
      <div className="h-[7px] rounded-full bg-[var(--color-surface)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%`, backgroundColor: barColor(pct) }}
        />
      </div>
      {detail && <div className="text-[10px] text-[var(--color-text-secondary)] mt-[3px]">{detail}</div>}
    </div>
  );
}

function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function netLabel(bps: number | null): string {
  if (bps == null || !Number.isFinite(bps)) return '—';
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(1)} GB/s`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} MB/s`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} KB/s`;
  return `${Math.round(bps)} B/s`;
}

export function HostCard({ host }: HostCardProps) {
  const down = host.status === 'down';
  const h = host.host;
  const diskDetail = host.disk.total ? `${formatBytes(host.disk.used)} / ${formatBytes(host.disk.total)}` : undefined;
  const load = host.cpu.load;
  const loadLabel = load['1m'] != null ? `${load['1m'].toFixed(1)} · ${load['5m']?.toFixed(1) ?? '—'} · ${load['15m']?.toFixed(1) ?? '—'}` : '—';

  return (
    <section className={`flex flex-col rounded-2xl border p-[14px_16px] bg-[var(--color-surface)] min-h-0 overflow-hidden ${down ? 'opacity-75 border-[color-mix(in_srgb,var(--color-error)_50%,transparent)]' : 'border-[var(--color-border)]'}`}>
      <div className="flex items-center gap-[9px] mb-[11px]">
        <h2 className="text-[14.5px] font-semibold text-[var(--color-text-primary)]">{h.name}</h2>
        <span className="text-[11px] text-[var(--color-text-secondary)]">
          {host.system?.distro || host.system?.platform || ''}
          {host.system?.glancesVersion ? ` · Glances ${host.system.glancesVersion}` : ''}
        </span>
        <div className="ml-auto">
          <SourceDot status={host.status} />
        </div>
      </div>

      <StatBar label="CPU" icon="🖥" pct={host.cpu?.percent ?? null} />
      <StatBar label="Memory" icon="🧠" pct={host.memory?.percent ?? null} />
      <StatBar label="Disk" icon="💾" pct={host.disk?.percent ?? null} detail={diskDetail} />

      {host.error && (
        <div className="text-[var(--color-error)] text-[12px] mt-[6px]">⚠ {host.error}</div>
      )}

      <div className="mt-auto pt-[9px] border-t border-[var(--color-border)] flex gap-4 text-[11px] text-[var(--color-text-secondary)]">
        <span>Load <b className="tabular-nums text-[var(--color-text-primary)] font-semibold">{loadLabel}</b></span>
        <span>Up <b className="tabular-nums text-[var(--color-text-primary)] font-semibold">{host.uptime?.formatted || '—'}</b></span>
        <span className="ml-auto tabular-nums">
          ↓ {netLabel(host.network?.rxBps ?? null)}  ↑ {netLabel(host.network?.txBps ?? null)}
        </span>
      </div>
    </section>
  );
}
