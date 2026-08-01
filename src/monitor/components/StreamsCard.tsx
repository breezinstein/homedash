import type { MediaSnapshot, MediaStream } from '../../types';
import { SourceDot } from './SourceDot';

interface StreamsCardProps {
  media: MediaSnapshot;
}

export function StreamsCard({ media }: StreamsCardProps) {
  return (
    <section className="flex flex-col rounded-2xl border border-[var(--color-border)] p-[14px_16px] bg-[var(--color-surface)] min-h-0 overflow-hidden">
      <div className="flex items-center gap-[9px] mb-[11px]">
        <h2 className="text-[14.5px] font-semibold text-[var(--color-text-primary)]">🎬 Active Streams</h2>
        <span className="text-[11px] text-[var(--color-text-secondary)]">
          {media.activeStreams} playing · {media.transcoding} transcoding
        </span>
        <div className="ml-auto"><SourceDot status={media.status} /></div>
      </div>

      <div className="overflow-y-auto flex flex-col gap-[10px] flex-1">
        {media.streams.length === 0 ? (
          <div className="text-[var(--color-text-secondary)] text-[12px] py-[10px]">No active streams</div>
        ) : (
          media.streams.map((s, i) => <StreamRow key={i} stream={s} />)
        )}
      </div>
    </section>
  );
}

function StreamRow({ stream: s }: { stream: MediaStream }) {
  const isTranscode = s.playMethod === 'Transcode';

  return (
    <div className="flex items-center gap-[13px] rounded-xl border border-[var(--color-border)] p-[11px_13px] bg-[var(--color-surface)]">
      {/* Thumbnail placeholder */}
      <div className="w-[46px] h-[62px] rounded-lg flex-shrink-0 bg-gradient-to-br from-[#312e81] to-[#1e1b4b] grid place-items-center text-[20px] border border-[var(--color-border)]">
        🎬
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold truncate">
          {s.title}
          {s.subtitle && <span className="text-[var(--color-text-secondary)] font-medium ml-1">{s.subtitle}</span>}
        </div>
        <div className="text-[11px] text-[var(--color-text-secondary)] mt-[2px]">{s.user} · {s.client} · {s.server}</div>
        {s.progressPercent != null && (
          <div className="flex items-center gap-[10px] mt-[7px]">
            <div className="flex-1 h-[7px] rounded-full bg-[var(--color-surface)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${Math.min(100, s.progressPercent)}%` }} />
            </div>
            <span className="text-[11px] text-[var(--color-text-secondary)] tabular-nums flex-shrink-0">{s.positionLabel}</span>
          </div>
        )}
      </div>

      {/* Play method badge */}
      <span className={`flex-shrink-0 text-[10px] font-extrabold tracking-[.5px] uppercase px-[8px] py-[3px] rounded-md ${isTranscode ? 'bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)] text-[var(--color-warning)]' : 'bg-[color-mix(in_srgb,var(--color-success)_14%,transparent)] text-[var(--color-success)]'}`}>
        {s.transcodeDetail || s.playMethod}
      </span>
    </div>
  );
}
