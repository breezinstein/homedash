import type { MediaSnapshot, MediaStream } from '../../types';
import { SourceDot } from './SourceDot';

interface StreamsCardProps {
  media: MediaSnapshot;
}

/**
 * Compact media streams panel designed to fit a 1080p screen without
 * scrolling.  Each stream row is a single line with a thin progress bar
 * and play-method badge.  The subtitle includes user, device, client app,
 * and server.
 */
export function StreamsCard({ media }: StreamsCardProps) {
  return (
    <div className="streams-panel">
      {/* Header */}
      <div className="streams-header">
        <div className="title-group">
          <span className="title">Active Streams</span>
          <span className="subtitle">
            {media.activeStreams} playing · {media.transcoding} transcoding
          </span>
        </div>
        <SourceDot status={media.status} />
      </div>

      {/* Stream list */}
      <div className="streams-list">
        {media.streams.length === 0 ? (
          <div className="empty-grid-msg" style={{ padding: '20px 0' }}>
            No active streams
          </div>
        ) : (
          media.streams.map((s, i) => <CompactStreamRow key={i} stream={s} />)
        )}
      </div>
    </div>
  );
}

function CompactStreamRow({ stream: s }: { stream: MediaStream }) {
  const isTranscode = s.playMethod === 'Transcode';

  // Build subtitle: "user on device via app · server"
  const parts: string[] = [];
  if (s.user && s.user !== '—') parts.push(s.user);
  if (s.device && s.device !== '—') parts.push(`on ${s.device}`);
  if (s.client && s.client !== '—') parts.push(`via ${s.client}`);
  const userLine = parts.join(' ') || '—';

  return (
    <div className={`stream-row ${isTranscode ? 'stream-row-transcode' : ''}`}>
      <div className="stream-info">
        <div className="stream-title" title={s.title}>
          {s.title}
          {s.subtitle && (
            <span className="stream-title-sub"> — {s.subtitle}</span>
          )}
        </div>
        <div className="stream-meta">
          <span>{userLine}</span>
          <span> · </span>
          <span>{s.server}</span>
          {s.paused && <span className="stream-paused">PAUSED</span>}
        </div>
        {s.progressPercent != null && (
          <div className="stream-progress">
            <div className="progress-bg" style={{ height: 4 }}>
              <div
                className="progress-fill"
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
      <span
        className={`stream-badge ${isTranscode ? 'stream-badge-warn' : 'stream-badge-ok'}`}
      >
        {s.transcodeDetail || s.playMethod}
      </span>
    </div>
  );
}
