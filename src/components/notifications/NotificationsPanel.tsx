import { useEffect, useMemo, useState } from 'react';
import { BellOff, ChevronRight, RefreshCw, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@ui-sdk/react/button';
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@ui-sdk/react/collapsible';
import { ScrollArea, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport } from '@ui-sdk/react/scroll-area';
import { Separator } from '@ui-sdk/react/separator';
import { useNotifications } from '../../context/NotificationsContext';
import { useConfirm } from '../ui';
import { PageHeader, PagePanel } from '../shell/PageHeader';
import { NotificationCard } from './NotificationCard';

interface NotificationsPanelProps {
  /** Jumps to Settings → Notifications. */
  onManage?: () => void;
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

  // Topics the user has collapsed. Expanded by default.
  const [collapsedTopics, setCollapsedTopics] = useState<Set<string>>(new Set());

  const toggleTopic = (topic: string) => {
    setCollapsedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };

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
    return Array.from(byTopic, ([topic, items]) => ({ topic, items }));
  }, [notifications]);

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

  const handleClearTopic = async (topic: string) => {
    const ok = await confirm({
      title: `Clear "${topic}"?`,
      message: 'This removes all notifications in this topic from the dashboard. They may reappear from the server on reconnect.',
      confirmLabel: 'Clear topic',
      tone: 'danger',
    });
    if (ok) clearTopicNotifications(topic);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Notifications"
        description={
          <span className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${status.dot}`} aria-hidden="true" />
            {status.label}
            {notifications.length > 0 ? ` · ${notifications.length} shown` : ''}
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
        {notificationsError && (
          <div className="border-b border-[color-mix(in_srgb,var(--color-error)_35%,transparent)] bg-[var(--danger-soft)] px-4 py-2 text-xs text-[var(--color-error)]">
            {notificationsError}
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1">
          <ScrollAreaViewport className="p-4">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 grid size-14 place-items-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--surface-sunken)]">
                  <BellOff className="size-6 text-[var(--color-text-secondary)]" aria-hidden="true" />
                </div>
                <p className="text-sm text-[var(--color-text-secondary)]">No notifications yet</p>
              </div>
            ) : (
              <div className="space-y-5">
                {groups.map((group) => {
                  const collapsed = collapsedTopics.has(group.topic);
                  return (
                    <Collapsible key={group.topic} open={!collapsed} onOpenChange={() => toggleTopic(group.topic)}>
                      <div className="mb-2 flex items-center gap-2">
                        <CollapsibleTrigger
                          className="ui-btn"
                          data-variant="ghost"
                          data-size="sm"
                          title={collapsed ? 'Expand topic' : 'Collapse topic'}
                        >
                          <ChevronRight
                            className={`size-3.5 transition-transform ${collapsed ? '' : 'rotate-90'}`}
                            aria-hidden="true"
                          />
                          <span className="text-[0.6875rem] font-semibold uppercase tracking-wider">{group.topic}</span>
                          <span className="ui-chip tabular-nums">{group.items.length}</span>
                        </CollapsibleTrigger>
                        <Separator className="flex-1" />
                        <Button
                          className="ui-btn"
                          data-variant="ghost"
                          data-size="icon"
                          onClick={() => { void handleClearTopic(group.topic); }}
                          aria-label={`Clear ${group.topic}`}
                          title={`Clear ${group.topic}`}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                      <CollapsiblePanel className="space-y-2">
                        {group.items.map((item) => (
                          <NotificationCard key={item.id} item={item} onDismiss={dismissNotification} />
                        ))}
                      </CollapsiblePanel>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </ScrollAreaViewport>
          <ScrollAreaScrollbar orientation="vertical">
            <ScrollAreaThumb />
          </ScrollAreaScrollbar>
        </ScrollArea>
      </PagePanel>
    </div>
  );
}
