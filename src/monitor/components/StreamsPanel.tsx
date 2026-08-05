import type { MediaSnapshot, MediaStream } from '../../types';
import { SourceDot } from './SourceDot';

interface StreamsPanelProps {
  media: MediaSnapshot;
}

// Kiosk: cap visible rows so the card always fits without scrolling.
const MAX_VISIBLE_STREAMS = 3;

/**
 * Redesigned "Active Streams" card. Single-column list of compact stream
 * rows (no more 2-col grid that overflowed), with a "+N more" badge when
 * the stream count exceeds what fits. Child rows are designed to fit the
 * 1920×1080 kiosk cell: title + meta + progress + play-method badge.
 */
export function StreamsPanel({ media }: StreamsPanelProps) {
  const streams = media.streams;
  const visible = streams.slice(0, MAX_VISIBLE_STREAMS);
  const more = streams.length - visible.length;

  return (
    <section className="streams-panel">
      <div className="streams-header">
        <div className="title-group">
          <span className="title">Active Streams</span>
          <span className="subtitle">
            {media.activeStreams} playing · {media.transcoding} transcoding
          </span>
        </div>
        <SourceDot status={media.status} />
      </div>

      {streams.length === 0 ? (
        <div className="streams-empty">No active streams</div>
      ) : (
        <div className="streams-list">
          {visible.map((s, i) => <StreamRow key={i} stream={s} />)}
          {more > 0 && (
            <div className="streams-more">
              <span className="streams-more-badge">+ {more} more</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function StreamRow({ stream: s }: { stream: MediaStream }) {
  const isTranscode = s.playMethod === 'Transcode';
  const badgeClass = isTranscode
    ? 'stream-badge-warn'
    : s.playMethod === 'DirectPlay'
      ? 'stream-badge-info'
      : 'stream-badge-ok';

  const dotColor = s.paused ? '#f1c40f' : isTranscode ? '#e67e22' : '#2ecc71';

  // Build subtitle: "user on device via app · server"
  const parts: string[] = [];
  if (s.user && s.user !== '—') parts.push(s.user);
  if (s.device && s.device !== '—') parts.push(`on ${s.device}`);
  if (s.client && s.client !== '—') parts.push(`via ${s.client}`);
  const userLine = parts.join(' ') || '—';

  return (
    <div className={`stream-row ${isTranscode ? 'stream-row-transcode' : ''} ${s.paused ? 'stream-row-paused' : ''}`}>
      <span className="stream-dot" style={{ background: dotColor }} title={s.paused ? 'Paused' : 'Playing'} />
      <div className="stream-info">
        <div className="stream-title" title={s.title}>
          {s.title}
          {s.subtitle && <span className="stream-title-sub"> — {s.subtitle}</span>}
        </div>
        <div className="stream-meta">
          <span>{userLine}</span>
          <span className="stream-meta-sep">·</span>
          <span>{s.server}</span>
          {s.paused && <span className="stream-paused">PAUSED</span>}
        </div>
        {s.progressPercent != null && (
          <div className="stream-progress">
            <div className="stream-progress-bg">
              <div
                className="stream-progress-fill"
                style={{
                  width: `${Math.min(100, s.progressPercent)}%`,
                  background: isTranscode ? '#e67e22' : '#6c5ce7',
                }}
              />
            </div>
            <span className="stream-position">{s.positionLabel}</span>
          </div>
        )}
      </div>
      <span className={`stream-badge ${badgeClass}`}>
        {s.transcodeDetail || s.playMethod}
      </span>
    </div>
  );
}
