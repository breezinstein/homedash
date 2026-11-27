// One list of Glances servers.
//
// `config.servers` (Server stats) and the legacy `config.monitoring.glancesHosts`
// (the monitor) both held Glances endpoints. They are merged into `servers`,
// where `monitor: true` marks the ones the monitor polls. The merge is
// idempotent: once `glancesHosts` is gone it does nothing, so it is safe to run
// on every load, save and backup restore.

/** Comparable form of a Glances base URL: lower-case host, default port and trailing slash dropped. */
export function normalizeServerUrl(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase();
    const port = u.port && !((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443'))
      ? `:${u.port}` : '';
    const path = u.pathname.replace(/\/+$/, '');
    return `${u.protocol}//${host}${port}${path}`;
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, '');
  }
}

/** The servers the monitor polls. */
export function monitoredHosts(config) {
  const servers = Array.isArray(config?.servers) ? config.servers : [];
  return servers.filter((s) => s && s.monitor === true && typeof s.url === 'string' && s.url);
}

function sameLogin(a, b) {
  return (a.username || '') === (b.username || '') && (a.password || '') === (b.password || '');
}

/**
 * Fold `monitoring.glancesHosts` into `servers`. Mutates `config`.
 * Returns what happened so callers can log it and decide whether to persist.
 */
export function mergeServerLists(config, now = new Date()) {
  const result = { changed: false, merged: 0, added: 0, conflicts: [] };
  if (!config || typeof config !== 'object') return result;
  const mon = config.monitoring;
  const hosts = mon && Array.isArray(mon.glancesHosts) ? mon.glancesHosts : null;

  const servers = Array.isArray(config.servers) ? config.servers.map((s) => ({ ...s })) : [];
  for (const s of servers) {
    if (typeof s.monitor !== 'boolean') { s.monitor = false; result.changed = true; }
  }

  if (!hosts) {
    if (result.changed) config.servers = servers;
    return result;
  }

  const renamedIds = new Map();
  const usedIds = new Set(servers.map((s) => s.id));

  for (const host of hosts) {
    if (!host || typeof host.url !== 'string' || !host.url) continue;
    const key = normalizeServerUrl(host.url);
    const idx = servers.findIndex((s) => normalizeServerUrl(s.url) === key);
    const docker = {};
    if (host.dockerSocket) docker.dockerSocket = host.dockerSocket;
    if (host.dockerUrl) docker.dockerUrl = host.dockerUrl;

    if (idx >= 0) {
      const existing = servers[idx];
      const hasServerLogin = Boolean(existing.username || existing.password);
      if (hasServerLogin && !sameLogin(existing, host)) result.conflicts.push(host.name || existing.name || host.url);
      // The monitor host's id wins: alert rules and the poll snapshot use it.
      const id = host.id || existing.id;
      if (existing.id && existing.id !== id) renamedIds.set(existing.id, id);
      usedIds.delete(existing.id);
      usedIds.add(id);
      servers[idx] = {
        ...existing,
        ...docker,
        id,
        name: host.name || existing.name,
        username: host.username || undefined,
        password: host.password || undefined,
        monitor: true,
      };
      if (!servers[idx].username) delete servers[idx].username;
      if (!servers[idx].password) delete servers[idx].password;
      result.merged++;
    } else {
      let id = host.id || `srv-${Math.random().toString(36).slice(2, 10)}`;
      while (usedIds.has(id)) id = `${id}-m`;
      usedIds.add(id);
      const added = {
        id,
        name: host.name || host.url,
        url: host.url,
        createdAt: now.toISOString(),
        monitor: true,
        ...docker,
      };
      if (host.username) added.username = host.username;
      if (host.password) added.password = host.password;
      servers.push(added);
      result.added++;
    }
  }

  if (renamedIds.size > 0 && Array.isArray(mon.alerts)) {
    mon.alerts = mon.alerts.map((rule) => (rule && renamedIds.has(rule.host) ? { ...rule, host: renamedIds.get(rule.host) } : rule));
  }

  config.servers = servers;
  delete mon.glancesHosts;
  config.metadata = {
    ...(config.metadata || {}),
    serverMerge: {
      at: now.toISOString(),
      merged: result.merged,
      added: result.added,
      conflicts: result.conflicts,
      dismissed: false,
    },
  };
  result.changed = true;
  return result;
}
