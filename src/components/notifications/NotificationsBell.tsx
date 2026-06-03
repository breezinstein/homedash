import { Bell } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';

interface NotificationsBellProps {
  onClick: () => void;
  /** Compact variant for the mobile menu row. */
  variant?: 'icon' | 'menu';
}

export function NotificationsBell({ onClick, variant = 'icon' }: NotificationsBellProps) {
  const { config, unreadCount, notificationsStatus } = useDashboard();

  // Hidden entirely unless the feature is enabled in settings.
  if (!config.notifications?.enabled) return null;

  const badge = unreadCount > 99 ? '99+' : String(unreadCount);
  const hasError = notificationsStatus === 'error';

  if (variant === 'menu') {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-2 px-3 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
      >
        <span className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[1rem] h-4 px-1 flex items-center justify-center text-[10px] font-semibold text-white bg-[var(--color-error)] rounded-full">
              {badge}
            </span>
          )}
        </span>
        <span className="text-sm">Notifications</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="relative p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
      title="Notifications"
      aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
    >
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-[1rem] h-4 px-1 flex items-center justify-center text-[10px] font-semibold text-white bg-[var(--color-error)] rounded-full">
          {badge}
        </span>
      )}
      {hasError && unreadCount === 0 && (
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--color-error)]" />
      )}
    </button>
  );
}
