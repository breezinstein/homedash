import type { NotificationsStatus, NtfyMessage } from '../types';

// Client for HomeDash's own notification API. The actual ntfy subscription
// lives on the server (see notifications.js); the browser only reads history
// and receives live updates over a same-origin Server-Sent Events stream.
// This keeps ntfy credentials on the server and lets messages be captured even
// when no dashboard tab is open.

// Use relative URLs for reverse-proxy compatibility (mirrors configApi).
const API_BASE = '';

export class NtfyAuthError extends Error {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'NtfyAuthError';
  }
}

export interface NtfyAuth {
  username: string;
  password: string;
}

// A stored notification as returned by the server: an ntfy message plus the
// server-tracked dismissed flag.
export interface ServerNotification extends NtfyMessage {
  dismissed?: boolean;
}

export interface NotificationsState {
  items: ServerNotification[];
  status: NotificationsStatus;
  error: string | null;
}

// Fetch the current history + connection status from the server.
export async function fetchNotifications(): Promise<NotificationsState> {
  const res = await fetch(`${API_BASE}/api/notifications`);
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json();
}

export interface StreamHandlers {
  onMessage: (msg: ServerNotification) => void;
  onStatus: (status: NotificationsStatus, error: string | null) => void;
  onDismiss: (id: string) => void;
  /** Cleared all when topic is undefined, otherwise just that topic. */
  onClear: (topic?: string) => void;
  onOpen?: () => void;
}

// Open the live SSE stream. Returns the EventSource so the caller can close it.
// EventSource reconnects automatically; onOpen fires on each (re)connection,
// which the caller uses to resync history and avoid gaps.
export function openNotificationStream(handlers: StreamHandlers): EventSource {
  const es = new EventSource(`${API_BASE}/api/notifications/stream`);

  es.addEventListener('open', () => handlers.onOpen?.());

  es.addEventListener('message', (e) => {
    try {
      handlers.onMessage(JSON.parse((e as MessageEvent).data) as ServerNotification);
    } catch {
      /* ignore malformed payloads */
    }
  });

  es.addEventListener('status', (e) => {
    try {
      const { status, error } = JSON.parse((e as MessageEvent).data) as {
        status: NotificationsStatus;
        error: string | null;
      };
      handlers.onStatus(status, error ?? null);
    } catch {
      /* ignore */
    }
  });

  es.addEventListener('dismiss', (e) => {
    try {
      const { id } = JSON.parse((e as MessageEvent).data) as { id: string };
      if (id) handlers.onDismiss(id);
    } catch {
      /* ignore */
    }
  });

  es.addEventListener('clear', (e) => {
    try {
      const { topic } = JSON.parse((e as MessageEvent).data || '{}') as { topic?: string };
      handlers.onClear(topic);
    } catch {
      handlers.onClear();
    }
  });

  return es;
}

// Dismiss a single notification (server-side, broadcast to other tabs).
export async function dismissNotificationOnServer(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/notifications/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
}

// Dismiss all notifications, or just one topic when `topic` is provided
// (server-side, broadcast to other tabs).
export async function clearNotificationsOnServer(topic?: string): Promise<void> {
  await fetch(`${API_BASE}/api/notifications/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(topic ? { topic } : { all: true }),
  });
}

// One-shot connectivity check for the Settings "Test connection" button. The
// server performs the actual probe so credentials never leave it.
export async function testNotificationConnection({
  serverUrl,
  topics,
  auth,
}: {
  serverUrl: string;
  topics: string[];
  auth?: NtfyAuth;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/notifications/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serverUrl,
      topics,
      username: auth?.username,
      password: auth?.password,
    }),
  });
  if (res.status === 401 || res.status === 403) {
    throw new NtfyAuthError();
  }
  if (!res.ok) {
    throw new Error(`Connection failed (${res.status})`);
  }
}
