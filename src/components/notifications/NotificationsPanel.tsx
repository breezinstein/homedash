import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, Hash, RefreshCw, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@ui-sdk/react/button';
import { Listbox, ListboxItem, ListboxItemIcon } from '@ui-sdk/react/listbox';
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from '@ui-sdk/react/scroll-area';
import {
  Timeline,
  TimelineConnector,
  TimelineItem,
  TimelineMarker,
  TimelineTime,
} from '@ui-sdk/react/timeline';
import { useNotifications } from '../../context/NotificationsContext';
import type { NotificationItem } from '../../types';
import { EmptyState, InlineAlert, useConfirm } from '../ui';
import { PageHeader, PagePanel } from '../shell/PageHeader';
import { NotificationCard } from './NotificationCard';

interface NotificationsPanelProps {
  /** Jumps to Settings → Notifications. */
  onManage?: () => void;
}

const ALL = '__all';

function dayLabel(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

function priorityTone(p?: number): 'danger' | 'warning' | 'info' | undefined {
  if (p === 5) return 'danger';
  if (p === 4) return 'warning';
  if (p != null && p <= 2) return undefined;
  return 'info';
}

const STATUS_LABEL: Record<string, { label: string; dot: string }> = {
  open: { label: 'Connected', dot: 'bg-[var(--color-success)]' },
  connecting: { label: 'Connecting…', dot: 'bg-[var(--color-warning)]' },
  error: { label: 'Disconnected', dot: 'bg-[var(--color-error)]' },
  disabled: { label: 'Disabled', dot: 'bg-[var(--color-text-secondary)]' },
};

export function NotificationsPanel({ onManage }: NotificationsPanelProps) {
  const {
    notifications,
    notificationsStatus,
    notificationsError,
    markAllNotificationsRead,
    dismissNotification,
    clearAllNotifications,
    clearTopicNotifications,
    reconnectNotifications,
  } = useNotifications();
  const confirm = useConfirm();

  const [topic, setTopic] = useState<string>(ALL);

  // Opening the panel marks everything as read (and persists lastReadAt).
  useEffect(() => {
    markAllNotificationsRead();
  }, [markAllNotificationsRead]);

  // Group notifications by topic while preserving the overall newest-first
  // order: a topic's position is determined by its most recent message.
  const groups = useMemo(() => {
    const byTopic = new Map<string, typeof notifications>();
    for (const item of notifications) {
      const topic = item.topic || 'unknown';
      const bucket = byTopic.get(topic);
      if (bucket) bucket.push(item);
      else byTopic.set(topic, [item]);
    }
    return Array.from(byTopic, ([name, items]) => ({ topic: name, items }));
  }, [notifications]);

  // A topic that empties out (cleared) falls back to every topic.
  useEffect(() => {
    if (topic !== ALL && !groups.some((g) => g.topic === topic)) setTopic(ALL);
  }, [groups, topic]);

  const shown = topic === ALL ? notifications : groups.find((g) => g.topic === topic)?.items ?? [];
  const days = useMemo(() => {
    const out: { label: string; items: NotificationItem[] }[] = [];
    for (const item of shown) {
      const label = dayLabel(item.time);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(item);
      else out.push({ label, items: [item] });
    }
    return out;
  }, [shown]);

  const status = STATUS_LABEL[notificationsStatus] ?? STATUS_LABEL.disabled;

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    const ok = await confirm({
      title: 'Clear all notifications?',
      message: 'This removes them from the dashboard. They may reappear from the server on reconnect.',
      confirmLabel: 'Clear all',
      tone: 'danger',
    });
    if (ok) clearAllNotifications();
  };

  const handleClearTopic = async (name: string) => {
    const ok = await confirm({
      title: `Clear "${name}"?`,
      message: 'This removes all notifications in this topic from the dashboard. They may reappear from the server on reconnect.',
      confirmLabel: 'Clear topic',
      tone: 'danger',
    });
    if (ok) clearTopicNotifications(name);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Notifications"
        description={
          <span className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${status.dot}`} aria-hidden="true" />
            {status.label}
            {notifications.length > 0 ? ` · ${notifications.length} in ${groups.length} ${groups.length === 1 ? 'topic' : 'topics'}` : ''}
          </span>
        }
        actions={
          <>
            {notificationsStatus === 'error' && (
              <Button className="ui-btn" data-variant="ghost" data-size="sm" onClick={reconnectNotifications}>
                <RefreshCw className="size-3.5" aria-hidden="true" /> Reconnect
              </Button>
            )}
            {notifications.length > 0 && (
              <Button className="ui-btn" data-variant="ghost" data-size="sm" onClick={handleClearAll}>
                <Trash2 className="size-3.5" aria-hidden="true" /> Clear all
              </Button>
            )}
            {onManage && (
              <Button
                className="ui-btn"
                data-variant="ghost"
                data-size="icon"
                onClick={onManage}
                aria-label="Notification settings"
              >
                <Settings2 className="size-4" aria-hidden="true" />
              </Button>
            )}
          </>
        }
      />
      <PagePanel>
        {notificationsError && <InlineAlert tone="danger" className="m-3">{notificationsError}</InlineAlert>}

        {notifications.length === 0 ? (
          <EmptyState icon={BellOff} title="No notifications yet" description="Messages from your ntfy topics appear here as they arrive." />
        ) : (
          <div className="ui-notif">
            <nav className="ui-notif-topics" aria-label="Topics">
              <Listbox
                aria-label="Topics"
                className="ui-listbox"
                value={topic}
                onValueChange={(v) => { if (typeof v === 'string') setTopic(v); }}
              >
                <ListboxItem value={ALL} className="ui-list-item">
                  <ListboxItemIcon><Bell className="size-3.5" aria-hidden="true" /></ListboxItemIcon>
                  <span className="min-w-0 flex-1 truncate">All topics</span>
                  <span className="ui-chip tabular-nums">{notifications.length}</span>
                </ListboxItem>
                {groups.map((g) => (
                  <ListboxItem key={g.topic} value={g.topic} className="ui-list-item">
                    <ListboxItemIcon><Hash className="size-3.5" aria-hidden="true" /></ListboxItemIcon>
                    <span className="min-w-0 flex-1 truncate">{g.topic}</span>
                    <span className="ui-chip tabular-nums">{g.items.length}</span>
                  </ListboxItem>
                ))}
              </Listbox>
            </nav>

            <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label={topic === ALL ? 'All notifications' : `Notifications in ${topic}`}>
              <div className="ui-panel-head">
                <span className="ui-panel-title truncate">{topic === ALL ? 'All topics' : topic}</span>
                <span className="ui-chip tabular-nums">{shown.length}</span>
                {topic !== ALL && (
                  <Button className="ui-btn ml-auto" data-variant="ghost" data-size="sm" onClick={() => { void handleClearTopic(topic); }}>
                    <Trash2 className="size-3.5" aria-hidden="true" /> Clear topic
                  </Button>
                )}
              </div>
              <ScrollArea className="min-h-0 flex-1" aria-label="Messages">
                <ScrollAreaViewport className="p-4">
                  {days.map((day) => (
                    <section key={day.label} className="mb-4 last:mb-0">
                      <h3 className="ui-day">{day.label}</h3>
                      <Timeline aria-label={`${day.label}'s notifications`} className="ui-timeline">
                        {day.items.map((item) => (
                          <TimelineItem key={item.id} className="ui-tl-item">
                            <TimelineMarker className="ui-tl-marker" data-tone={priorityTone(item.priority)} />
                            <TimelineConnector className="ui-tl-connector" />
                            <div className="min-w-0">
                              <TimelineTime className="ui-tl-time" dateTime={new Date(item.time * 1000).toISOString()}>
                                {new Date(item.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {topic === ALL ? ` · ${item.topic}` : ''}
                              </TimelineTime>
                              <NotificationCard item={item} onDismiss={dismissNotification} />
                            </div>
                          </TimelineItem>
                        ))}
                      </Timeline>
                    </section>
                  ))}
                </ScrollAreaViewport>
                <ScrollAreaScrollbar orientation="vertical">
                  <ScrollAreaThumb />
                </ScrollAreaScrollbar>
              </ScrollArea>
            </section>
          </div>
        )}
      </PagePanel>
    </div>
  );
}
