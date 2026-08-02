import type { ArrSnapshot, ArrQueueItem } from '../../types';
import { SourceDot } from './SourceDot';

interface ArrCardProps { arr: ArrSnapshot; }

export function ArrCard({ arr }: ArrCardProps) {
  return (
    <section className="flex flex-col rounded-2xl border border-[var(--color-border)] p-[14px_16px] bg-[var(--color-surface)] min-h-0 overflow-hidden">
      <div className="flex items-center gap-[9px] mb-[11px]">
        <h2 className="text-[14.5px] font-semibold text-[var(--color-text-primary)]">🎬 Sonarr / Radarr</h2>
        <span className="text-[11px] text-[var(--color-text-secondary)]">{arr.instances.length} instance{arr.instances.length !== 1 ? 's' : ''}</span>
        <div className="ml-auto"><SourceDot status={arr.status} /></div>
      </div>

      {arr.instances.map(inst => (
        <div key={inst.name} className="mb-2 flex items-center gap-2 text-[12px]">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${inst.status === 'ok' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-error)]'}`} />
          <span className="font-semibold text-[var(--color-text-primary)]">{inst.name}</span>
          <span className="text-[var(--color-text-secondary)] ml-auto">{inst.queueCount} in queue</span>
          {!inst.healthOk && <span className="text-[var(--color-warning)] text-[10px]">⚠ health</span>}
        </div>
      ))}

      {arr.queue.length === 0 ? (
        <div className="text-[var(--color-text-secondary)] text-[12px] py-1">No active downloads</div>
      ) : (
        <div className="overflow-y-auto flex-1 space-y-[6px]">
          {arr.queue.map((q, i) => <QueueRow key={i} item={q} />)}
        </div>
      )}
    </section>
  );
}

function QueueRow({ item: q }: { item: ArrQueueItem }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] p-[8px_10px] bg-[var(--color-surface)] text-[12px]">
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{q.title}</div>
        <div className="text-[11px] text-[var(--color-text-secondary)]">{q.instance} · {q.quality}{q.seriesName ? ` · ${q.seriesName}` : ''}</div>
        {q.progressPercent != null && (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-[5px] rounded-full bg-[var(--color-surface)] overflow-hidden">
              <div className="h-full bg-[var(--color-primary)]" style={{ width: `${Math.min(100, q.progressPercent)}%` }} />
            </div>
            <span className="text-[10px] text-[var(--color-text-secondary)] tabular-nums">{q.progressPercent}%</span>
          </div>
        )}
      </div>
      <span className="text-[10px] text-[var(--color-text-secondary)] tabular-nums flex-shrink-0">{q.timeLeft || q.status}</span>
    </div>
  );
}
