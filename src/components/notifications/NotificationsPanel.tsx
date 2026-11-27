import { useEffect, useMemo, useState } from 'react';
import { Trash2, RefreshCw, BellOff, ChevronDown, ChevronRight, Settings2 } from 'lucide-react';
import { useNotifications } from '../../context/NotificationsContext';
import { useConfirm } from '../ui';
import { Button, IconButton } from '../ui/Button';
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
              <Button variant="ghost" size="sm" onClick={reconnectNotifications}>
                <RefreshCw className="size-3.5" /> Reconnect
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearAll}>
                <Trash2 className="size-3.5" /> Clear all
              </Button>
            )}
            {onManage && (
              <IconButton label="Notification settings" onClick={onManage}>
                <Settings2 className="size-4" />
              </IconButton>
            )}
          </>
        }
      />
      <PagePanel>
        {notificationsError && (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-error)]/10 px-4 py-2 text-xs text-[var(--color-error)]">
            {notificationsError}
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {notifications.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-3 grid size-14 place-items-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--surface-sunken)]">
                <BellOff className="size-6 text-[var(--color-text-secondary)]" aria-hidden="true" />
              </div>
              <p className="text-sm text-[var(--color-text-secondary)]">No notifications yet</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.topic} className="space-y-2">
                <div className="sticky top-0 z-10 flex items-center gap-2 bg-[var(--color-surface)] px-1 py-1">
                  <button
                    onClick={() => toggleTopic(group.topic)}
                    className="flex min-w-0 items-center gap-1.5 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
                    aria-expanded={!collapsedTopics.has(group.topic)}
                    title={collapsedTopics.has(group.topic) ? 'Expand topic' : 'Collapse topic'}
                  >
                    {collapsedTopics.has(group.topic) ? (
                      <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <h3 className="truncate text-xs font-semibold uppercase tracking-wide">{group.topic}</h3>
                    <span className="shrink-0 rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
                      {group.items.length}
                    </span>
                  </button>
                  <div className="h-px flex-1 bg-[var(--color-border)]" />
                  <IconButton label={`Clear ${group.topic}`} onClick={() => handleClearTopic(group.topic)}>
                    <Trash2 className="size-3.5" />
                  </IconButton>
                </div>
                {!collapsedTopics.has(group.topic) &&
                  group.items.map((item) => (
                    <NotificationCard key={item.id} item={item} onDismiss={dismissNotification} />
                  ))}
              </div>
            ))
          )}
        </div>
      </PagePanel>
    </div>
  );
}
