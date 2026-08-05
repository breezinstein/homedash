import type { ArrSnapshot, ArrQueueItem, ArrInstance } from '../../types';
import { SourceDot } from './SourceDot';
import { formatMegabytes, parseEtaLabel } from '../format';

interface ArrCardProps { arr: ArrSnapshot; }

// Distinguishing accents so Sonarr vs Radarr is readable at a glance.
const ARR_TYPE_LABEL: Record<string, string> = { sonarr: 'Sonarr', radarr: 'Radarr' };
const ARR_TYPE_COLOR: Record<string, string> = {
  sonarr: '#6c5ce7',   // purple
  radarr: '#e17055',   // orange
};

// Kiosk: show only the top queue items (2 per row), then a "+N more" badge.
const MAX_VISIBLE_QUEUE = 4;

function instanceLabel(inst: { name?: string; type: string }): string {
  const name = (inst.name || '').trim();
  if (name) return name;
  return ARR_TYPE_LABEL[inst.type] || inst.type;
}

/** Friendly label for the queue record status. */
function statusLabel(q: ArrQueueItem): string {
  const s = (q.status || '').toLowerCase();
  const map: Record<string, string> = {
    completed: 'Completed',
    downloading: 'Downloading',
    paused: 'Paused',
    queued: 'Queued',
    importpending: 'Importing',
    importing: 'Importing',
    failedpending: 'Failed',
    failed: 'Failed',
    ignored: 'Ignored',
    warning: 'Warning',
    error: 'Error',
    ok: 'Done',
  };
  if (map[s]) return map[s];
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Queued';
}

export function ArrCard({ arr }: ArrCardProps) {
  const totalQueue = arr.instances.reduce((s, i) => s + i.queueCount, 0);
  const totalWanted = arr.instances.reduce((s, i) => s + i.wantedCount, 0);
  const downInstances = arr.instances.filter(i => i.status === 'down');

  return (
    <section className="flex flex-col rounded-2xl border border-[var(--color-border)] p-[14px_16px] bg-[var(--color-surface)] min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-[9px] mb-[11px]">
        <h2 className="text-[14.5px] font-semibold text-[var(--color-text-primary)]">🎬 Sonarr / Radarr</h2>
        <span className="text-[11px] text-[var(--color-text-secondary)]">
          {arr.instances.length} instance{arr.instances.length !== 1 ? 's' : ''}
        </span>
        <div className="ml-auto flex items-center gap-[9px]">
          <span className="text-[11px] tabular-nums text-[var(--color-text-secondary)]">
            {totalQueue} queue · {totalWanted} wanted
          </span>
          <SourceDot status={arr.status} />
        </div>
      </div>

      {/* Per-instance summary chips */}
      <div className="mb-2 flex flex-wrap gap-[6px]">
        {arr.instances.map(inst => <InstanceChip key={inst.name + inst.type} inst={inst} />)}
      </div>

      {/* Down-instance error detail */}
      {downInstances.map(inst => (
        <div key={`err-${inst.name + inst.type}`} className="mb-2 flex items-start gap-2 text-[11px] text-[var(--color-error)]">
          <span>⚠</span>
          <span className="min-w-0">
            <strong className="font-semibold">{instanceLabel(inst)}:</strong> {inst.error || 'Unreachable'}
          </span>
        </div>
      ))}

      {arr.queue.length === 0 ? (
        <div className="text-[var(--color-text-secondary)] text-[12px] py-1">No active downloads</div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-2 content-start gap-[6px]">
          {arr.queue.slice(0, MAX_VISIBLE_QUEUE).map((q, i) => <QueueRow key={i} item={q} />)}
          {arr.queue.length > MAX_VISIBLE_QUEUE && (
            <div className="col-span-2 justify-self-center text-[11px] font-semibold text-[var(--color-text-secondary)] bg-[var(--color-background)] border border-[var(--color-border)] rounded-full px-[12px] py-[4px]">
              + {arr.queue.length - MAX_VISIBLE_QUEUE} more
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function InstanceChip({ inst }: { inst: ArrInstance }) {
  const down = inst.status === 'down';
  const color = down ? 'var(--color-error)' : (ARR_TYPE_COLOR[inst.type] ?? '#6c5ce7');
  return (
    <div
      className="flex items-center gap-[6px] rounded-lg border px-[8px] py-[4px] text-[11px]"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
      }}
      title={down ? (inst.error || 'Unreachable') : undefined}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="font-semibold text-[var(--color-text-primary)]">{instanceLabel(inst)}</span>
      <span className="text-[var(--color-text-secondary)] tabular-nums">
        {inst.queueCount} queue · {inst.wantedCount} wanted
      </span>
      {!inst.healthOk && (
        <span className="text-[var(--color-warning)]" title={inst.healthWarnings.join('\n')}>
          ⚠ {inst.healthWarnings.length}
        </span>
      )}
    </div>
  );
}

function QueueRow({ item: q }: { item: ArrQueueItem }) {
  const color = ARR_TYPE_COLOR[q.instanceType] ?? '#6c5ce7';
  const pct = q.progressPercent != null ? Math.min(100, Math.max(0, Math.round(q.progressPercent))) : null;
  const done = pct === 100;
  const eta = parseEtaLabel(q.timeLeft);
  const rightLabel = eta ? `${eta} left` : statusLabel(q);

  const meta: string[] = [];
  if (q.quality && q.quality !== '—') meta.push(q.quality);
  const size = formatMegabytes(q.sizeMb);
  if (size) meta.push(size);
  if (q.seriesName && q.seriesName !== q.title) meta.push(q.seriesName);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] p-[8px_10px] bg-[var(--color-background)] text-[12px]">
      <span
        className="mt-[2px] w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: color }}
        title={ARR_TYPE_LABEL[q.instanceType] || q.instanceType}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate" title={q.title}>{q.title}</div>
        <div className="text-[11px] text-[var(--color-text-secondary)] truncate">{meta.join(' · ') || '—'}</div>
        <div className="flex items-center gap-2 mt-[6px]">
          {pct != null ? (
            <>
              <div
                className="flex-1 h-[5px] rounded-full overflow-hidden"
                style={{ backgroundColor: 'color-mix(in srgb, var(--color-border) 70%, transparent)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: done ? 'var(--color-success)' : color }}
                />
              </div>
              <span className="text-[10px] text-[var(--color-text-secondary)] tabular-nums">{pct}%</span>
            </>
          ) : (
            <span className="text-[10px] text-[var(--color-text-secondary)]">{rightLabel}</span>
          )}
        </div>
      </div>
      <span className="text-[10px] text-[var(--color-text-secondary)] tabular-nums flex-shrink-0">{rightLabel}</span>
    </div>
  );
}
