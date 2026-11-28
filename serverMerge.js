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

  // Alert rules point at monitor host ids (that is what the poller reports),
  // so whenever a host ends up under another id its rules follow it.
  const renamedIds = new Map();
  const taken = (id, exceptIdx) => servers.some((s, k) => k !== exceptIdx && s.id === id);
  const fresh = (base, exceptIdx) => {
    let id = base || `srv-${Math.random().toString(36).slice(2, 10)}`;
    while (taken(id, exceptIdx)) id = `${id}-m`;
    return id;
  };

  for (const host of hosts) {
    if (!host || typeof host.url !== 'string' || !host.url) continue;
    const key = normalizeServerUrl(host.url);
    const idx = servers.findIndex((s) => normalizeServerUrl(s.url) === key);
    const docker = {};
    if (host.dockerSocket) docker.dockerSocket = host.dockerSocket;
    if (host.dockerUrl) docker.dockerUrl = host.dockerUrl;
    const hostHasLogin = Boolean(host.username || host.password);

    if (idx >= 0) {
      const existing = servers[idx];
      const serverHasLogin = Boolean(existing.username || existing.password);
      // Only a monitor login replaces the server's; a host without one keeps
      // the working credentials Server stats already had.
      // Field by field: a monitor username or password replaces the server's
      // own, and anything the monitor host leaves out keeps the working value.
      const differs = (field) => Boolean(host[field]) && Boolean(existing[field]) && host[field] !== existing[field];
      if (hostHasLogin && serverHasLogin && (differs('username') || differs('password'))) {
        result.conflicts.push(host.name || existing.name || host.url);
      }
      // The monitor host's id wins unless another server already has it.
      const id = fresh(host.id || existing.id, idx);
      if (existing.id && existing.id !== id) renamedIds.set(existing.id, id);
      if (host.id && host.id !== id) renamedIds.set(host.id, id);
      const merged = { ...existing, ...docker, id, name: host.name || existing.name, monitor: true };
      if (host.username) merged.username = host.username;
      if (host.password) merged.password = host.password;
      servers[idx] = merged;
      result.merged++;
    } else {
      const id = fresh(host.id, -1);
      if (host.id && host.id !== id) renamedIds.set(host.id, id);
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
