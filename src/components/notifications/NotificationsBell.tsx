import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import { fetchNotificationsCount } from '../../api/notificationsApi';

interface NotificationsBellProps {
  onClick: () => void;
  /** Compact variant for the mobile menu row. */
  variant?: 'icon' | 'menu';
}

const PUBLIC_POLL_MS = 20000;

export function NotificationsBell({ onClick, variant = 'icon' }: NotificationsBellProps) {
  const { config, unreadCount: adminUnread, notificationsStatus } = useDashboard();
  const { authenticated } = useAuth();
  const [publicUnread, setPublicUnread] = useState(0);
  const [publicHasError, setPublicHasError] = useState(false);
  // Server-reported notifications status for anonymous viewers (we don't
  // have access to the redacted config's `enabled` flag, so we hide the bell
  // when the server says the feature isn't configured).
  const [publicStatus, setPublicStatus] = useState<string>('disabled');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Anonymous-mode polling: poll /api/notifications/count every 20 s so the
  // bell badge reflects the same number an admin would see, without exposing
  // any message content. Authenticated users already get live updates via
  // DashboardContext's SSE subscription, so this loop only runs for
  // unauthenticated viewers.
  useEffect(() => {
    if (authenticated) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await fetchNotificationsCount();
        if (cancelled) return;
        setPublicUnread(data.unread);
        setPublicStatus(data.status);
        setPublicHasError(!data.connected && data.status === 'error');
      } catch {
        if (cancelled) return;
        setPublicHasError(true);
      }
    };
    tick();
    pollRef.current = setInterval(tick, PUBLIC_POLL_MS);
    return () => {
      cancelled = true;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [authenticated]);

  // Visibility:
  //   - admin (or open mode): honour the per-config `enabled` setting.
  //   - anonymous: bell shows when the server has the feature configured
  //     (status != 'disabled'), so anonymous viewers see the badge but no
  //     bell appears on instances that don't use ntfy at all.
  if (authenticated) {
    if (!config.notifications?.enabled) return null;
  } else {
    if (publicStatus === 'disabled') return null;
  }

  const unreadCount = authenticated ? adminUnread : publicUnread;
  const badge = unreadCount > 99 ? '99+' : String(unreadCount);
  const hasError = authenticated ? notificationsStatus === 'error' : publicHasError;

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
