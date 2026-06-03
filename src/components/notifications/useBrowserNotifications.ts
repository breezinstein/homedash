import { useEffect, useRef } from 'react';
import { useDashboard } from '../../context/DashboardContext';

/**
 * Bridges incoming ntfy messages to the native browser Notification API.
 * Only fires when the feature is enabled and the tab is hidden, so the user
 * is not double-notified while actively looking at the dashboard. Permission
 * is requested lazily on the first eligible message.
 */
export function useBrowserNotifications(enabled: boolean) {
  const { latestNotification } = useDashboard();
  const lastNotifiedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof Notification === 'undefined') return;
    const item = latestNotification;
    if (!item) return;

    // Avoid re-firing for the same message across re-renders.
    if (lastNotifiedIdRef.current === item.id) return;
    lastNotifiedIdRef.current = item.id;

    // Suppress when the tab is focused — the in-app UI already shows it.
    if (document.visibilityState === 'visible') return;

    const fire = () => {
      if (Notification.permission !== 'granted') return;
      const n = new Notification(item.title || item.topic, {
        body: item.message ?? '',
        icon: item.icon || item.attachment?.url,
        tag: item.id,
      });
      if (item.click) {
        n.onclick = () => {
          window.focus();
          window.open(item.click, '_blank', 'noopener,noreferrer');
        };
      } else {
        n.onclick = () => window.focus();
      }
    };

    if (Notification.permission === 'granted') {
      fire();
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then(() => fire());
    }
  }, [enabled, latestNotification]);
}
