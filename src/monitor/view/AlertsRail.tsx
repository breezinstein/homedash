import { Bell } from 'lucide-react';
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from '@ui-sdk/react/scroll-area';
import {
  Timeline,
  TimelineConnector,
  TimelineDescription,
  TimelineItem,
  TimelineMarker,
  TimelineTime,
  TimelineTitle,
} from '@ui-sdk/react/timeline';
import type { AlertInstance, Severity } from '../../types';
import { formatAgo, formatDuration, stripHtml } from '../format';
import { Chip } from './parts';

const SEV_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
const SEV_LABEL: Record<Severity, string> = { critical: 'Critical', warning: 'Warning', info: 'Info' };

/** Firing alerts by severity, then recently resolved ones as a timeline. */
export function AlertsRail({ firing, resolved }: { firing: AlertInstance[]; resolved: AlertInstance[] }) {
  const sorted = [...firing].sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.since - a.since);
  return (
    <aside className="mv-rail" aria-label="Alerts">
      <header className="mv-panel-head">
        <Bell className="size-3.5 shrink-0" aria-hidden="true" />
        <h2 className="mv-panel-title">Alerts</h2>
        <span className="ml-auto">
          {firing.length ? <Chip tone="danger">{firing.length} firing</Chip> : <Chip tone="success">All clear</Chip>}
        </span>
      </header>
      <ScrollArea className="mv-rail-scroll" aria-label="Alert list">
        <ScrollAreaViewport>
          {sorted.length > 0 && (
            <>
              <h3 className="mv-section mv-section-pad">Firing</h3>
              <ul className="mv-alerts">
                {sorted.map((a) => (
                  <li key={a.id} className="mv-alert" data-severity={a.severity}>
                    <span className="mv-alert-bar" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="mv-alert-title">{stripHtml(a.message) || a.name}</p>
                      <p className="mv-alert-meta">
                        {SEV_LABEL[a.severity]} · {formatDuration((Date.now() - a.since) / 1000, { compact: true })}
                        {a.acked ? ' · acknowledged' : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {sorted.length === 0 && <p className="mv-empty mv-section-pad">Nothing is firing.</p>}

          {resolved.length > 0 && (
            <>
              <h3 className="mv-section mv-section-pad">Recently resolved</h3>
              <Timeline aria-label="Recently resolved alerts" className="mv-timeline">
                {resolved.map((a) => {
                  const at = a.resolvedAt ?? a.since;
                  return (
                    <TimelineItem key={a.id} className="mv-tl-item">
                      <TimelineMarker className="mv-tl-marker" />
                      <TimelineConnector className="mv-tl-connector" />
                      <TimelineTitle className="mv-tl-title">{stripHtml(a.message) || a.name}</TimelineTitle>
                      <TimelineTime className="mv-tl-time" dateTime={new Date(at).toISOString()}>
                        {formatAgo(at)} ago
                      </TimelineTime>
                      {a.resolvedAt ? (
                        <TimelineDescription className="mv-tl-desc">
                          Fired for {formatDuration((a.resolvedAt - a.since) / 1000, { compact: true })}
                        </TimelineDescription>
                      ) : null}
                    </TimelineItem>
                  );
                })}
              </Timeline>
            </>
          )}
        </ScrollAreaViewport>
        <ScrollAreaScrollbar orientation="vertical">
          <ScrollAreaThumb />
        </ScrollAreaScrollbar>
      </ScrollArea>
    </aside>
  );
}
