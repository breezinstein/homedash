import { useEffect } from 'react';
import { X, Bell, Trash2, RefreshCw, BellOff } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import { ModalShell, useConfirm } from '../ui';
import { NotificationCard } from './NotificationCard';

interface NotificationsPanelProps {
  onClose: () => void;
}

const STATUS_LABEL: Record<string, { label: string; dot: string }> = {
  open: { label: 'Connected', dot: 'bg-[var(--color-success)]' },
  connecting: { label: 'Connecting…', dot: 'bg-[var(--color-warning)]' },
  error: { label: 'Disconnected', dot: 'bg-[var(--color-error)]' },
  disabled: { label: 'Disabled', dot: 'bg-[var(--color-text-secondary)]' },
};

export function NotificationsPanel({ onClose }: NotificationsPanelProps) {
  const {
    notifications,
    notificationsStatus,
    notificationsError,
    markAllNotificationsRead,
    dismissNotification,
    clearAllNotifications,
    reconnectNotifications,
  } = useDashboard();
  const confirm = useConfirm();

  // Opening the panel marks everything as read (and persists lastReadAt).
  useEffect(() => {
    markAllNotificationsRead();
  }, [markAllNotificationsRead]);

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

  return (
    <ModalShell onClose={onClose} ariaLabel="Notifications" className="sm:items-start sm:pt-20">
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] w-full max-w-md shadow-2xl max-h-[90vh] sm:max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[var(--color-text-primary)]" />
            <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
              Notifications
            </h2>
            <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] ml-1">
              <span className={`w-2 h-2 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {notificationsStatus === 'error' && (
              <button
                onClick={reconnectNotifications}
                className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
                title="Reconnect"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-error)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
                title="Clear all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 -m-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {notificationsError && (
          <div className="px-3 sm:px-4 py-2 text-xs text-[var(--color-error)] bg-[var(--color-error)]/10 border-b border-[var(--color-border)]">
            {notificationsError}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[var(--color-background)] flex items-center justify-center">
                <BellOff className="w-7 h-7 text-[var(--color-text-secondary)]" />
              </div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                No notifications yet
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <NotificationCard key={item.id} item={item} onDismiss={dismissNotification} />
            ))
          )}
        </div>
      </div>
    </ModalShell>
  );
}
