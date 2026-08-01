import type { UsenetSnapshot, UsenetInstance, UsenetSlot } from '../../types';
import { SourceDot } from './SourceDot';

interface UsenetCardProps {
  usenet: UsenetSnapshot;
}

function formatSpeed(bps: number | null): string {
  if (bps == null || !Number.isFinite(bps)) return '0 B/s';
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(1)} GB/s`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} MB/s`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} KB/s`;
  return `${Math.round(bps)} B/s`;
}

function formatEta(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m left`;
  return '<1m left';
}

export function UsenetCard({ usenet }: UsenetCardProps) {
  return (
    <>
      {usenet.instances.map(inst => (
        <InstanceCard key={inst.name} inst={inst} />
      ))}
    </>
  );
}

function InstanceCard({ inst }: { inst: UsenetInstance }) {
  const stateLabel = inst.status === 'down' ? 'Error' :
    inst.paused ? 'Paused' :
    (inst.speedBps ?? 0) > 0 ? 'Downloading' : 'Idle';

  const stateChipClass = inst.paused ? 'bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)] text-[var(--color-warning)]' :
    (inst.speedBps ?? 0) > 0 ? 'bg-[color-mix(in_srgb,var(--color-success)_14%,transparent)] text-[var(--color-success)]' :
    'bg-[var(--color-surface)] text-[var(--color-text-secondary)]';

  return (
    <section className="flex flex-col rounded-2xl border border-[var(--color-border)] p-[14px_16px] bg-[var(--color-surface)] min-h-0">
      <div className="flex items-center gap-[9px] mb-[11px]">
        <h2 className="text-[14.5px] font-semibold text-[var(--color-text-primary)]">{inst.type === 'sabnzbd' ? '📦 SABnzbd' : '⬇ NZBGet'}</h2>
        <span className={`text-[10px] font-extrabold tracking-[.5px] uppercase px-[8px] py-[3px] rounded-md ml-2 ${stateChipClass}`}>{stateLabel}</span>
        <div className="ml-auto"><SourceDot status={inst.status} /></div>
        <span className="text-[11px] text-[var(--color-text-secondary)]">{inst.name}</span>
      </div>

      {inst.status === 'down' ? (
        <div className="text-[var(--color-error)] text-[12px]">{inst.error || 'Unreachable'}</div>
      ) : (
        <>
          <div className="flex items-baseline gap-[14px] mb-2">
            <span className="text-[24px] font-[750] tabular-nums">{formatSpeed(inst.speedBps)}</span>
            <span className="text-[11px] text-[var(--color-text-secondary)]">
              {inst.paused ? `Paused · ${inst.queuedTotal} items queued` : `${formatEta(inst.etaSeconds)} · ${inst.queuedTotal} items queued`}
            </span>
          </div>

          {inst.slots.length === 0 ? (
            <div className="text-[var(--color-text-secondary)] text-[12px]">
              {inst.paused ? 'Queue paused — no active downloads' : 'Queue empty'}
            </div>
          ) : (
            <>
              {inst.slots.map((sl, i) => <SlotBar key={i} slot={sl} />)}
              {inst.queuedTotal > inst.slots.length && (
                <div className="text-[11px] text-[var(--color-text-secondary)] pt-1 border-t border-[var(--color-border)] mt-2">
                  + {inst.queuedTotal - inst.slots.length} more queued
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function SlotBar({ slot }: { slot: UsenetSlot }) {
  const pct = Math.min(100, Math.max(0, slot.percent));
  return (
    <div className="mb-[9px]">
      <div className="flex justify-between gap-[10px] text-[12px] mb-1">
        <span className="truncate font-medium">{slot.name}</span>
        <span className="text-[var(--color-text-secondary)] tabular-nums flex-shrink-0">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-[7px] rounded-full bg-[var(--color-surface)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct >= 90 ? 'var(--color-success)' : 'var(--color-primary)' }} />
      </div>
      {(slot.sizeMb != null || slot.remainingMb != null || slot.status) && (
        <div className="text-[10px] text-[var(--color-text-secondary)] mt-[3px] tabular-nums">
          {slot.sizeMb != null && slot.remainingMb != null ? `${slot.remainingMb.toFixed(0)} / ${slot.sizeMb.toFixed(0)} MB` : ''}
          {slot.status ? ` · ${slot.status}` : ''}
        </div>
      )}
    </div>
  );
}
