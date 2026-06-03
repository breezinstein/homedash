import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { EventEmitter } from 'events';

// Cap on how long to wait between reconnect attempts.
const RECONNECT_MAX = 30000;

export function backfillToSince(backfill) {
  return backfill === 'all' ? 'all' : (backfill || '12h');
}

// Owns the single, server-side subscription to the user's ntfy server.
//
// Moving the connection here (rather than letting each browser tab talk to
// ntfy directly) means:
//   - ntfy credentials never leave the server,
//   - messages are captured even when no dashboard tab is open,
//   - there is exactly one upstream connection regardless of how many tabs
//     are viewing the dashboard.
//
// Browsers receive history via GET /api/notifications and live updates via the
// same-origin SSE endpoint GET /api/notifications/stream.
export class NotificationManager extends EventEmitter {
  constructor(storePath) {
    super();
    this.storePath = storePath;
    this.items = [];            // newest first; each is an ntfy message + { dismissed }
    this.status = 'disabled';   // disabled | connecting | open | error
    this.error = null;
    this.lastEventId = null;    // resume point for reconnects
    this.maxHistory = 200;
    this.config = null;
    this.appliedSig = undefined;
    this.controller = null;
    this.retryTimer = null;
    this.attempt = 0;
    this.stopped = true;
    this.sseClients = new Set();
    this.persistTimer = null;
  }

  // Load persisted history so it survives a server restart.
  async load() {
    try {
      const raw = await readFile(this.storePath, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.items)) this.items = data.items;
      this.lastEventId = data.lastEventId ?? null;
    } catch {
      // No store yet (first run) — start empty.
    }
  }

  // Debounced write so a burst of messages does not thrash the disk.
  schedulePersist() {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persist();
    }, 500);
  }

  async persist() {
    try {
      await mkdir(dirname(this.storePath), { recursive: true });
      await writeFile(
        this.storePath,
        JSON.stringify({ items: this.items, lastEventId: this.lastEventId })
      );
    } catch (e) {
      console.error('Failed to persist notifications:', e.message);
    }
  }

  getState() {
    return { items: this.items, status: this.status, error: this.error };
  }

  setStatus(status, error = null) {
    this.status = status;
    this.error = error;
    this.broadcast('status', { status, error });
  }

  // --- SSE fan-out -------------------------------------------------------
  addClient(res) {
    this.sseClients.add(res);
    res.on('close', () => this.sseClients.delete(res));
    // Greet the new client with the current connection status.
    this.sendSse(res, 'status', { status: this.status, error: this.error });
  }

  sendSse(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  broadcast(event, data) {
    for (const res of this.sseClients) {
      try {
        this.sendSse(res, event, data);
      } catch {
        this.sseClients.delete(res);
      }
    }
  }

  // --- Lifecycle ---------------------------------------------------------
  // Apply a (possibly new) notifications config. Only tears down and
  // reconnects the upstream stream when a connection-relevant field changes,
  // so routine config saves (e.g. editing a service) do not drop the stream.
  reconfigure(notif) {
    const sig = JSON.stringify({
      enabled: notif?.enabled,
      serverUrl: notif?.serverUrl,
      topics: notif?.topics,
      username: notif?.username,
      password: notif?.password,
      backfill: notif?.backfill,
    });

    this.maxHistory = Math.max(20, notif?.maxHistory || 200);

    if (sig === this.appliedSig) {
      // Nothing connection-relevant changed; just honour a new history cap.
      if (this.items.length > this.maxHistory) {
        this.items = this.items.slice(0, this.maxHistory);
        this.schedulePersist();
      }
      this.config = notif;
      return;
    }

    this.appliedSig = sig;
    this.config = notif;
    this.stop();

    if (this.items.length > this.maxHistory) {
      this.items = this.items.slice(0, this.maxHistory);
      this.schedulePersist();
    }

    const enabled =
      !!notif?.enabled &&
      !!notif?.serverUrl &&
      Array.isArray(notif?.topics) &&
      notif.topics.length > 0;

    if (!enabled) {
      this.setStatus('disabled', null);
      return;
    }

    this.stopped = false;
    this.attempt = 0;
    this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.controller) this.controller.abort();
    this.controller = null;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  scheduleRetry() {
    if (this.stopped) return;
    this.attempt += 1;
    const base = Math.min(RECONNECT_MAX, 1000 * 2 ** (this.attempt - 1));
    const delay = base / 2 + Math.random() * (base / 2); // jitter
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  async connect() {
    if (this.stopped) return;
    const notif = this.config;
    const base = String(notif.serverUrl).replace(/\/+$/, '');
    const topicPath = notif.topics.map((t) => encodeURIComponent(t)).join(',');
    const since = this.lastEventId ?? backfillToSince(notif.backfill);
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    const url = `${base}/${topicPath}/json?${params.toString()}`;

    const headers = {};
    if (notif.username) {
      headers.Authorization =
        'Basic ' + Buffer.from(`${notif.username}:${notif.password || ''}`).toString('base64');
    }

    this.controller = new AbortController();
    this.setStatus('connecting');

    try {
      const res = await fetch(url, { headers, signal: this.controller.signal });

      if (res.status === 401 || res.status === 403) {
        // Do not retry on auth failure; the user must fix credentials.
        this.setStatus('error', 'Authentication failed — check username and password.');
        return;
      }
      if (!res.ok || !res.body) {
        throw new Error(`ntfy stream failed (${res.status})`);
      }

      this.attempt = 0;
      this.setStatus('open', null);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // ntfy emits newline-delimited JSON: an initial `open` event, periodic
      // `keepalive` events, and `message` events we care about.
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          try {
            this.handleMessage(JSON.parse(line));
          } catch {
            // Ignore malformed lines rather than dropping the stream.
          }
        }
      }

      // Stream ended cleanly (server closed the connection); reconnect.
      if (!this.stopped) {
        this.setStatus('connecting');
        this.scheduleRetry();
      }
    } catch (err) {
      if (this.stopped || this.controller?.signal.aborted) return;
      this.setStatus('error', err.message || 'Connection failed');
      this.scheduleRetry();
    }
  }

  handleMessage(msg) {
    if (!msg || msg.event !== 'message') return;
    this.lastEventId = msg.id;
    if (this.items.some((n) => n.id === msg.id)) return;
    const item = { ...msg, dismissed: false };
    this.items = [item, ...this.items].slice(0, this.maxHistory);
    this.schedulePersist();
    this.broadcast('message', item);
  }

  dismiss(id) {
    let changed = false;
    this.items = this.items.map((n) => {
      if (n.id === id && !n.dismissed) {
        changed = true;
        return { ...n, dismissed: true };
      }
      return n;
    });
    if (changed) {
      this.schedulePersist();
      this.broadcast('dismiss', { id });
    }
    return changed;
  }

  clear() {
    this.items = this.items.map((n) => (n.dismissed ? n : { ...n, dismissed: true }));
    this.schedulePersist();
    this.broadcast('clear', {});
  }

  // One-shot connectivity check for the Settings "Test connection" button.
  // Runs server-side so credentials are never exposed to the browser.
  async test({ serverUrl, topics, username, password }) {
    const base = String(serverUrl || '').replace(/\/+$/, '');
    const topicPath = (topics || []).map((t) => encodeURIComponent(t)).join(',');
    const headers = {};
    if (username) {
      headers.Authorization =
        'Basic ' + Buffer.from(`${username}:${password || ''}`).toString('base64');
    }
    const res = await fetch(`${base}/${topicPath}/json?poll=1`, { headers });
    if (res.status === 401 || res.status === 403) {
      const e = new Error('Authentication failed');
      e.code = 'AUTH';
      throw e;
    }
    if (!res.ok) {
      throw new Error(`Connection failed (${res.status})`);
    }
    await res.text();
  }
}
