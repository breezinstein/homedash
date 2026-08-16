import { Search } from 'lucide-react';
import type { SeerrSnapshot, SeerrIssue, SeerrRequest } from '../../types';
import { SourceDot } from './SourceDot';

interface SeerrCardProps {
  seerr: SeerrSnapshot;
}

// Overseerr / Seerr issue types: 1 video, 2 audio, 3 subtitles, 4 other.
const ISSUE_TYPE: Record<number, { label: string; color: string }> = {
  1: { label: 'Video', color: 'var(--mon-warn)' },
  2: { label: 'Audio', color: 'var(--mon-warn)' },
  3: { label: 'Subtitles', color: 'var(--mon-accent)' },
  4: { label: 'Other', color: 'var(--mon-text-muted)' },
};

// Kiosk: cap rows per section so the card always fits without scrolling.
const MAX_ROWS_PER_SECTION = 2;

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function SeerrCard({ seerr }: SeerrCardProps) {
  const issueCount = seerr.issues.length;
  const unattended = [...seerr.pending, ...seerr.failed];
  const unattendedCount = unattended.length;

  return (
    <section className="media-card">
      {/* Header */}
      <div className="flex items-center gap-[9px] mb-[11px]">
        <h2 className="text-[14.5px] font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
          <Search className="w-4 h-4 text-[var(--mon-accent)]" />
          Seerr
        </h2>
        <span className="text-[11px] text-[var(--color-text-secondary)]">
          {seerr.version ? `v${seerr.version}` : 'Overseerr / Jellyseerr'}
        </span>
        <div className="ml-auto"><SourceDot status={seerr.status} /></div>
      </div>

      {seerr.status === 'down' ? (
        <div className="text-[var(--color-error)] text-[12px]">{seerr.error || 'Unreachable'}</div>
      ) : (
        <>
          {/* Open media issues */}
          <div className="mb-2">
            <div className="flex items-baseline gap-[6px] mb-[4px]">
              <span className="text-[10px] font-bold uppercase tracking-[.5px] text-[var(--color-text-secondary)]">Issues</span>
              <span className="text-[10px] tabular-nums text-[var(--color-text-secondary)]">{issueCount}</span>
            </div>
            {seerr.issues.length === 0 ? (
              <div className="text-[var(--color-text-secondary)] text-[12px] py-[2px]">No open issues</div>
            ) : (
              <>
                {seerr.issues.slice(0, MAX_ROWS_PER_SECTION).map((iss) => <IssueRow key={iss.id} iss={iss} />)}
                {seerr.issues.length > MAX_ROWS_PER_SECTION && (
                  <div className="text-center text-[10px] font-semibold text-[var(--color-text-secondary)] mt-[4px]">
                    + {seerr.issues.length - MAX_ROWS_PER_SECTION} more issues
                  </div>
                )}
              </>
            )}
          </div>

          {/* Unattended requests */}
          <div>
            <div className="flex items-baseline gap-[6px] mb-[4px]">
              <span className="text-[10px] font-bold uppercase tracking-[.5px] text-[var(--color-text-secondary)]">Unattended</span>
              <span className="text-[10px] tabular-nums text-[var(--color-text-secondary)]">{unattendedCount}</span>
            </div>
            {unattended.length === 0 ? (
              <div className="text-[var(--color-text-secondary)] text-[12px] py-[2px]">No unattended requests</div>
            ) : (
              <>
                {unattended.slice(0, MAX_ROWS_PER_SECTION).map((req, i) => <RequestRow key={`${req.status}-${i}`} req={req} />)}
                {unattended.length > MAX_ROWS_PER_SECTION && (
                  <div className="text-center text-[10px] font-semibold text-[var(--color-text-secondary)] mt-[4px]">
                    + {unattended.length - MAX_ROWS_PER_SECTION} more requests
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function IssueRow({ iss }: { iss: SeerrIssue }) {
  const t = ISSUE_TYPE[iss.issueType] ?? { label: 'Issue', color: 'var(--mon-text-muted)' };
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-[8px] py-[5px] bg-[var(--color-background)] text-[12px] mb-[4px]"
      title={`${iss.mediaTitle} — ${t.label} issue reported by ${iss.createdBy}${iss.createdAt ? ` ${timeAgo(iss.createdAt)}` : ''}`}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
      <span className="font-medium truncate flex-1 min-w-0">{iss.mediaTitle}</span>
      <span
        className="flex-shrink-0 text-[9px] font-extrabold uppercase tracking-[.4px] px-[6px] py-[2px] rounded"
        style={{ color: t.color, background: `color-mix(in srgb, ${t.color} 14%, transparent)` }}
      >
        {t.label}
      </span>
    </div>
  );
}

function RequestRow({ req }: { req: SeerrRequest }) {
  const failed = req.status === 'failed';
  const color = failed ? 'var(--mon-danger)' : 'var(--mon-warn)';
  const label = failed ? 'Failed' : 'Pending';
  const title = `${req.mediaTitle}${req.is4k ? ' (4K)' : ''} — ${label} request by ${req.requestedBy}${req.createdAt ? ` ${timeAgo(req.createdAt)}` : ''}`;
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-[8px] py-[5px] bg-[var(--color-background)] text-[12px] mb-[4px]"
      title={title}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="font-medium truncate flex-1 min-w-0">
        {req.mediaTitle}
        {req.is4k && <span className="text-[10px] text-[var(--color-text-secondary)]"> · 4K</span>}
      </span>
      <span
        className="flex-shrink-0 text-[9px] font-extrabold uppercase tracking-[.4px] px-[6px] py-[2px] rounded"
        style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
      >
        {label}
      </span>
    </div>
  );
}
