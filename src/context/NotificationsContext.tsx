import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  DashboardConfig,
  NotificationItem,
  NotificationsConfig,
  NotificationsStatus,
  NtfyMessage,
} from '../types';
import {
  clearNotificationsOnServer,
  dismissNotificationOnServer,
  fetchNotifications,
  openNotificationStream,
} from '../api/notificationsApi';

export const defaultNotifications: NotificationsConfig = {
  enabled: false,
  serverUrl: '',
  topics: [],
  backfill: '12h',
  maxHistory: 200,
  browserNotifications: false,
};

interface NotificationsContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  notificationsStatus: NotificationsStatus;
  notificationsError: string | null;
  latestNotification: NotificationItem | null;
  markAllNotificationsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAllNotifications: () => void;
  clearTopicNotifications: (topic: string) => void;
  reconnectNotifications: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

interface NotificationsProviderProps {
  children: ReactNode;
  config: DashboardConfig;
  setConfig: (config: DashboardConfig) => void;
}

/**
 * Owns the live ntfy mirror. Kept separate from DashboardContext so incoming
 * messages and read/dismiss state don't re-render every dashboard consumer.
 */
export function NotificationsProvider({ children, config, setConfig }: NotificationsProviderProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsStatus, setNotificationsStatus] = useState<NotificationsStatus>('disabled');
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  // Bumped to force the subscription effect to tear down and reconnect.
  const [reconnectNonce, setReconnectNonce] = useState(0);

  const configRef = useRef(config);
  configRef.current = config;

  const ntfyEnabled = !!config.notifications?.enabled;

  useEffect(() => {
    if (!ntfyEnabled) {
      setNotifications([]);
      setNotificationsStatus('disabled');
      setNotificationsError(null);
      return;
    }

    let closed = false;

    const toItem = (m: NtfyMessage & { dismissed?: boolean }): NotificationItem => {
      const lastReadAt = configRef.current.notifications?.lastReadAt ?? 0;
      return {
        ...m,
        read: m.time * 1000 <= lastReadAt,
        dismissed: !!m.dismissed,
      };
    };

    const resync = async () => {
      try {
        const state = await fetchNotifications();
        if (closed) return;
        setNotifications(state.items.map(toItem));
        setNotificationsStatus(state.status);
        setNotificationsError(state.error);
      } catch {
        // Leave existing state; SSE status events will correct it.
      }
    };

    // Seed immediately, then open the live stream. onOpen re-syncs after any
    // automatic EventSource reconnect so gaps during an outage are filled.
    resync();
    const es = openNotificationStream({
      onOpen: resync,
      onMessage: (m) => {
        setNotifications((prev) =>
          prev.some((n) => n.id === m.id) ? prev : [toItem(m), ...prev]
        );
      },
      onStatus: (status, error) => {
        setNotificationsStatus(status);
        setNotificationsError(error);
      },
      onDismiss: (id) => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, dismissed: true } : n))
        );
      },
      onClear: (topic) => {
        setNotifications((prev) =>
          prev.map((n) =>
            topic && n.topic !== topic ? n : { ...n, dismissed: true }
          )
        );
      },
    });

    return () => {
      closed = true;
      es.close();
    };
  }, [ntfyEnabled, reconnectNonce]);

  const visibleNotifications = useMemo(
    () => notifications.filter(n => !n.dismissed),
    [notifications]
  );

  const unreadCount = useMemo(
    () => visibleNotifications.reduce((acc, n) => acc + (n.read ? 0 : 1), 0),
    [visibleNotifications]
  );

  const latestNotification = visibleNotifications[0] ?? null;

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev =>
      prev.some(n => !n.read) ? prev.map(n => (n.read ? n : { ...n, read: true })) : prev
    );
    const cfg = configRef.current;
    const current = cfg.notifications ?? defaultNotifications;
    setConfig({ ...cfg, notifications: { ...current, lastReadAt: Date.now() } });
  }, [setConfig]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.map((n) => (n.id === id ? { ...n, dismissed: true } : n)));
    void dismissNotificationOnServer(id);
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, dismissed: true, read: true })));
    void clearNotificationsOnServer();
  }, []);

  const clearTopicNotifications = useCallback((topic: string) => {
    setNotifications(prev =>
      prev.map(n => (n.topic === topic ? { ...n, dismissed: true, read: true } : n))
    );
    void clearNotificationsOnServer(topic);
  }, []);

  const reconnectNotifications = useCallback(() => {
    setReconnectNonce(n => n + 1);
  }, []);

  const value = useMemo<NotificationsContextType>(() => ({
    notifications: visibleNotifications,
    unreadCount,
    notificationsStatus,
    notificationsError,
    latestNotification,
    markAllNotificationsRead,
    dismissNotification,
    clearAllNotifications,
    clearTopicNotifications,
    reconnectNotifications,
  }), [
    visibleNotifications, unreadCount, notificationsStatus, notificationsError,
    latestNotification, markAllNotificationsRead, dismissNotification,
    clearAllNotifications, clearTopicNotifications, reconnectNotifications,
  ]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
