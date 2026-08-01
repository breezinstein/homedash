import type { SolarSnapshot } from '../../types';
import { SourceDot } from './SourceDot';

interface SolarCardProps {
  solar: SolarSnapshot;
}

function formatPower(w: number | null): string {
  if (w == null || !Number.isFinite(w)) return '—';
  if (Math.abs(w) >= 1000) return `${(w / 1000).toFixed(2)} kW`;
  return `${Math.round(w)} W`;
}

function formatRuntime(mins: number | null): string {
  if (mins == null || !Number.isFinite(mins)) return '—';
  const total = Math.max(0, Math.round(mins));
  if (total < 1) return '<1m';
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function SolarCard({ solar }: SolarCardProps) {
  const soc = solar.batterySocPercent;
  const socColor = soc != null
    ? soc <= 20 ? 'var(--color-error)' : soc <= 40 ? 'var(--color-warning)' : 'var(--color-success)'
    : 'var(--color-border)';

  const batt = solar.batteryPowerW;
  const battCharging = batt != null && batt > 5;
  const battDischarging = batt != null && batt < -5;
  const battLabel = battCharging ? `${formatPower(batt)} charging` : battDischarging ? `${formatPower(Math.abs(batt))} discharging` : formatPower(batt);

  const grid = solar.gridPowerW;
  const gridImport = grid != null && grid > 5;
  const gridExport = grid != null && grid < -5;

  return (
    <section className="flex flex-col rounded-2xl border border-[var(--color-border)] p-[14px_16px] bg-[var(--color-surface)] min-h-0 flex-[1.15]">
      <div className="flex items-center gap-[9px] mb-[11px]">
        <h2 className="text-[14.5px] font-semibold text-[var(--color-text-primary)]">☀️ Solar</h2>
        <span className="text-[11px] text-[var(--color-text-secondary)]">Solar Assistant</span>
        <div className="ml-auto"><SourceDot status={solar.status} /></div>
      </div>

      <div className="flex items-center gap-[18px] mb-3">
        {/* SOC ring */}
        <div
          className="w-[86px] h-[86px] rounded-full flex-shrink-0 relative grid place-items-center"
          style={{
            background: `conic-gradient(${socColor} ${soc ?? 0}%, var(--color-surface) 0)`,
          }}
        >
          <div className="absolute w-[64px] h-[64px] rounded-full bg-[var(--color-surface)]" />
          <span className="relative font-bold text-[16px] tabular-nums">{soc != null ? `${Math.round(soc)}%` : '—'}</span>
        </div>

        <div>
          <div className="text-[30px] font-[750] tabular-nums">{formatPower(solar.pvPowerW)}</div>
          <div className="text-[11px] text-[var(--color-text-secondary)] mt-[2px]">PV generation</div>
        </div>
      </div>

      <KvRow label="🔋 Battery" value={battLabel} color={battCharging ? 'text-[var(--color-success)]' : battDischarging ? 'text-[var(--color-error)]' : 'text-[var(--color-text-primary)]'} />
      <KvRow label="🔌 Grid" value={gridImport ? `${formatPower(grid)} importing` : gridExport ? `${formatPower(Math.abs(grid))} exporting` : formatPower(grid)} color={gridImport ? 'text-[var(--color-warning)]' : gridExport ? 'text-[var(--color-gray-400)]' : undefined} />
      <KvRow label="🏠 House load" value={formatPower(solar.loadPowerW)} />
      <KvRow label="⏱ Battery runtime" value={formatRuntime(solar.batteryRuntimeMins)} />
    </section>
  );
}

function KvRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between py-[7px] border-t border-[var(--color-border)] text-[12.5px]">
      <span className="text-[var(--color-text-secondary)] flex items-center gap-[7px]">{label}</span>
      <span className={`font-semibold tabular-nums ${color || 'text-[var(--color-text-primary)]'}`}>{value}</span>
    </div>
  );
}
