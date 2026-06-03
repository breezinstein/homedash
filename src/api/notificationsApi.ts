import type { NotificationBackfill, NtfyMessage } from '../types';

// ntfy subscription client built on fetch + ReadableStream rather than the
// native EventSource API. EventSource cannot attach an Authorization header,
// which is required for basic-auth-protected topics, so we stream the
// newline-delimited JSON endpoint (/<topics>/json) ourselves. This also gives
// us full control over reconnection and resume-from-last-id semantics.

export interface NtfyAuth {
  username: string;
  password: string;
}

export interface ConnectOptions {
  serverUrl: string;
  topics: string[];
  auth?: NtfyAuth;
  /** ntfy `since` value: a duration window, a message id, or 'all'. */
  since?: string;
  signal: AbortSignal;
  onMessage: (msg: NtfyMessage) => void;
  onOpen?: () => void;
}

export class NtfyAuthError extends Error {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'NtfyAuthError';
  }
}

function normaliseBaseUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, '');
}

export function backfillToSince(backfill: NotificationBackfill): string {
  return backfill === 'all' ? 'all' : backfill;
}

function buildAuthHeader(auth?: NtfyAuth): Record<string, string> {
  if (!auth || !auth.username) return {};
  // btoa is fine for the username:password ASCII case ntfy expects.
  const token = btoa(`${auth.username}:${auth.password}`);
  return { Authorization: `Basic ${token}` };
}

/**
 * Open a long-lived subscription to one or more ntfy topics. Resolves when the
 * stream ends or the abort signal fires; rejects on network/HTTP errors so the
 * caller can schedule a reconnect. Throws NtfyAuthError on 401/403.
 */
export async function connectNotificationStream({
  serverUrl,
  topics,
  auth,
  since,
  signal,
  onMessage,
  onOpen,
}: ConnectOptions): Promise<void> {
  const base = normaliseBaseUrl(serverUrl);
  const topicPath = topics.map((t) => encodeURIComponent(t)).join(',');
  const params = new URLSearchParams();
  if (since) params.set('since', since);
  const url = `${base}/${topicPath}/json?${params.toString()}`;

  const res = await fetch(url, {
    headers: { ...buildAuthHeader(auth) },
    signal,
  });

  if (res.status === 401 || res.status === 403) {
    throw new NtfyAuthError();
  }
  if (!res.ok || !res.body) {
    throw new Error(`ntfy stream failed (${res.status})`);
  }

  onOpen?.();

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // Read the stream line by line; each non-empty line is a JSON message.
  // ntfy emits an `open` event first and periodic `keepalive` events that the
  // caller can ignore.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;
      try {
        onMessage(JSON.parse(line) as NtfyMessage);
      } catch {
        // Ignore malformed lines rather than killing the whole stream.
      }
    }
  }
}

/**
 * One-shot connectivity check used by the Settings "Test connection" button.
 * Uses ntfy's poll mode so it returns immediately instead of streaming.
 */
export async function testNotificationConnection({
  serverUrl,
  topics,
  auth,
}: {
  serverUrl: string;
  topics: string[];
  auth?: NtfyAuth;
}): Promise<void> {
  const base = normaliseBaseUrl(serverUrl);
  const topicPath = topics.map((t) => encodeURIComponent(t)).join(',');
  const res = await fetch(`${base}/${topicPath}/json?poll=1`, {
    headers: { ...buildAuthHeader(auth) },
  });
  if (res.status === 401 || res.status === 403) {
    throw new NtfyAuthError();
  }
  if (!res.ok) {
    throw new Error(`Connection failed (${res.status})`);
  }
  // Drain the body so the connection can close cleanly.
  await res.text();
}
