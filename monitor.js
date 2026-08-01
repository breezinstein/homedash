// ---------------------------------------------------------------------------
// Monitor — home lab monitoring aggregation and alert engine.
//
// Single background poller fans out to all configured data sources (Glances
// hosts, Solar Assistant, Emby/Jellyfin, SABnzbd/NZBGet), normalises each
// into a common snapshot, evaluates alert rules, and caches the result for
// the /api/monitor/* endpoints.  Modeled after notifications.js — the poller
// runs independently of any browser; browsers simply pick up the latest
// cached snapshot.
// ---------------------------------------------------------------------------

import { readFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONITOR_CONFIG_DIR = join(__dirname, 'data');
const MONITOR_SNAPSHOT_PATH = join(MONITOR_CONFIG_DIR, 'monitor-snapshot.json');
const MONITOR_ALERTS_PATH = join(MONITOR_CONFIG_DIR, 'monitor-alerts.json');
const DEFAULT_POLL_INTERVAL_MS = 10_000;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_ALERTS = 100;
const NETWORK_PREV_PATH = join(MONITOR_CONFIG_DIR, 'monitor-net-prev.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const round1 = n => (typeof n === 'number' ? Math.round(n * 10) / 10 : null);

// Parse a Glances uptime string (e.g. "7 days, 3:59:51") → { seconds, formatted }.
function parseGlancesUptime(value) {
  if (typeof value !== 'string') return { seconds: null, formatted: null };
  const m = value.match(/(?:(\d+)\s*days?,\s*)?(\d+):(\d+):(\d+)/);
  if (!m) return { seconds: null, formatted: value };
  const days = parseInt(m[1] || '0', 10);
  const hours = parseInt(m[2], 10);
  const mins = parseInt(m[3], 10);
  const secs = parseInt(m[4], 10);
  return { seconds: days * 86400 + hours * 3600 + mins * 60 + secs, formatted: value };
}

function pickRootFs(fsList) {
  if (!Array.isArray(fsList) || fsList.length === 0) return {};
  const root = fsList.find(f => f && f.mnt_point === '/');
  if (root) return root;
  return fsList.slice().sort((a, b) => (b.size || 0) - (a.size || 0))[0] || {};
}

function formatBytes(bytes) {
  if (bytes == null || !Number.isFinite(bytes)) return null;
  if (bytes === 0) return null;
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(mins) {
  if (!Number.isFinite(mins)) return null;
  const total = Math.max(0, Math.round(mins));
  if (total < 1) return '<1m';
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Docker status string parser: "Up 2 hours (healthy)" → health="healthy", state="running".
function parseContainerHealth(statusStr) {
  if (!statusStr || typeof statusStr !== 'string') return { state: 'other', health: 'none' };
  const s = statusStr.toLowerCase();
  if (s.includes('restarting')) return { state: 'restarting', health: 'none' };
  if (s.includes('paused')) return { state: 'paused', health: 'none' };
  if (s.includes('exited') || s.includes('dead')) return { state: s.includes('dead') ? 'dead' : 'exited', health: 'none' };
  if (s.includes('up ')) return { state: 'running', health: s.includes('(healthy)') ? 'healthy' : s.includes('(unhealthy)') ? 'unhealthy' : s.includes('(health: starting)') ? 'starting' : 'none' };
  if (s.includes('(healthy)')) return { state: 'running', health: 'healthy' };
  if (s.includes('(unhealthy)')) return { state: 'running', health: 'unhealthy' };
  return { state: 'other', health: 'none' };
}

// Fetch a URL with Basic auth, returning { ok, status, data, error }.
async function fetchJson(url, username, password) {
  let parsed;
  try { parsed = new URL(url); } catch { return { ok: false, error: 'Invalid URL' }; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { ok: false, error: 'Invalid protocol' };

  const headers = { Accept: 'application/json', 'User-Agent': 'HomeDash/1.0' };
  const user = (username || decodeURIComponent(parsed.username) || '').trim();
  const pass = password ?? decodeURIComponent(parsed.password);
  if (user) {
    headers.Authorization = 'Basic ' + Buffer.from(`${user}:${pass || ''}`).toString('base64');
  }
  const base = `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(base, { headers, signal: controller.signal });
    clearTimeout(timeout);
    if (res.status === 401) return { ok: false, error: 'Authentication required (HTTP 401)' };
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    clearTimeout(timeout);
    return { ok: false, error: err.name === 'AbortError' ? 'Request timed out' : err.message };
  }
}

// Tick representation for progress.
function ticksToSeconds(ticks) {
  if (typeof ticks !== 'number' || ticks <= 0) return null;
  return ticks / 10_000_000; // .NET ticks → seconds
}
function formatTime(seconds) {
  if (seconds == null) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Source fetchers
// ---------------------------------------------------------------------------

async function fetchGlancesHost(host) {
  const targets = [`${host.url}/api/4/all`, `${host.url}/api/3/all`];
  for (const t of targets) {
    const r = await fetchJson(t, host.username, host.password);
    if (!r.ok) {
      if (r.error.includes('404')) continue;
      return { host: { id: host.id, name: host.name }, status: 'down', error: r.error };
    }
    const all = r.data;
    const cpu = all.cpu || {};
    const core = all.core || {};
    const mem = all.mem || {};
    const load = all.load || {};
    const sys = all.system || {};
    const quick = all.quicklook || {};
    const fs = pickRootFs(all.fs);
    const uptime = parseGlancesUptime(all.uptime);
    const rawContainers = Array.isArray(all.containers) ? all.containers
      : (Array.isArray(all.containers?.containers) ? all.containers.containers : []);

    // Network — sum all interfaces if available.
    let rxBps = null, txBps = null;
    if (Array.isArray(all.network)) {
      rxBps = all.network.reduce((s, iface) => s + (typeof iface.rx === 'number' ? iface.rx : 0), 0);
      txBps = all.network.reduce((s, iface) => s + (typeof iface.tx === 'number' ? iface.tx : 0), 0);
      rxBps = rxBps > 0 ? rxBps : null;
      txBps = txBps > 0 ? txBps : null;
    } else if (all.network && typeof all.network.rx === 'number') {
      rxBps = all.network.rx; txBps = all.network.tx ?? null;
    }

    const containers = rawContainers.map(c => {
      const statusStr = c.status || c.Status || '';
      const h = parseContainerHealth(statusStr);
      return {
        name: c.name || '—',
        image: Array.isArray(c.image) ? c.image.join(', ') : (c.image || c.Image || ''),
        state: h.state,
        health: h.health,
        uptime: c.uptime || c.Uptime || null,
        statusStr,
      };
    });

    // Determine host-level status from metrics.
    const cpuPct = round1(cpu.total);
    const memPct = round1(mem.percent);
    const diskPct = round1(fs.percent);
    let hostStatus = 'ok';
    if (cpuPct !== null && cpuPct >= 95) hostStatus = 'degraded';
    if (memPct !== null && memPct >= 95) hostStatus = 'degraded';
    if (diskPct !== null && diskPct >= 95) hostStatus = 'degraded';

    return {
      host: { id: host.id, name: host.name },
      status: hostStatus,
      cpu: {
        percent: cpuPct,
        cores: cpu.cpucore ?? core.log ?? null,
        model: quick.cpu_name || null,
        load: {
          '1m': typeof load.min1 === 'number' ? load.min1 : null,
          '5m': typeof load.min5 === 'number' ? load.min5 : null,
          '15m': typeof load.min15 === 'number' ? load.min15 : null,
        },
      },
      memory: {
        total: mem.total ?? null,
        used: mem.used ?? null,
        percent: memPct,
      },
      disk: {
        total: fs.size ?? null,
        used: fs.used ?? null,
        percent: diskPct,
      },
      network: { rxBps, txBps },
      uptime,
      system: {
        hostname: sys.hostname || 'unknown',
        platform: sys.os_name || 'unknown',
        distro: sys.linux_distro || sys.hr_name || '',
        glancesVersion: typeof all.version === 'string' ? all.version : undefined,
      },
      containers,
    };
  }
  return { host: { id: host.id, name: host.name }, status: 'down', error: 'Glances API not found' };
}

async function fetchSolar(config) {
  if (!config?.solar?.enabled) return null;
  const inv = (config.inverters && config.inverters.length > 0) ? config.inverters[0] : null;
  if (!inv || !inv.url) return null;

  try {
    const targets = [`${inv.url}/api/v1/metrics`];
    for (const t of targets) {
      const r = await fetchJson(t, inv.username, inv.password);
      if (!r.ok) return { status: 'down', error: r.error };
      // Reuse the server.js normalizeInverter logic in simplified form
      const list = Array.isArray(r.data) ? r.data : [];
      const totals = {};
      for (const m of list) {
        if (!m || typeof m.topic !== 'string') continue;
        const slash = m.topic.indexOf('/');
        if (slash === -1 || m.topic.slice(0, slash) !== 'total') continue;
        totals[m.topic.slice(slash + 1)] = m.value;
      }
      const pick = (key) => {
        const v = totals[key];
        if (typeof v === 'number') return v;
        if (typeof v === 'string') { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }
        return v ?? null;
      };
      const batteryRuntime = typeof r.data._batteryRuntime === 'object' ? r.data._batteryRuntime : null;
      return {
        status: 'ok',
        pvPowerW: pick('pv_power'),
        loadPowerW: pick('load_power'),
        gridPowerW: pick('grid_power'),
        batterySocPercent: pick('battery_state_of_charge'),
        batteryPowerW: pick('battery_power'),
        batteryRuntimeMins: batteryRuntime?.minutes ?? null,
      };
    }
    return { status: 'down', error: 'No metrics found' };
  } catch (err) {
    return { status: 'down', error: err.message };
  }
}

async function fetchMedia(mediaConfigs) {
  if (!Array.isArray(mediaConfigs) || mediaConfigs.length === 0) return null;
  const allStreams = [];
  let worstStatus = 'ok';
  let worstError = undefined;

  for (const m of mediaConfigs) {
    try {
      const url = `${m.url}/Sessions`;
      const headers = { Accept: 'application/json', 'User-Agent': 'HomeDash/1.0' };
      // Emby uses api_key query param; Jellyfin accepts it too
      const r = await fetch(`${url}?api_key=${encodeURIComponent(m.apiKey)}`, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!r.ok) {
        worstStatus = 'down';
        worstError = `HTTP ${r.status} from ${m.name}`;
        continue;
      }
      const sessions = await r.json();
      for (const s of Array.isArray(sessions) ? sessions : []) {
        if (!s.NowPlayingItem) continue;
        const play = s.PlayState || {};
        const item = s.NowPlayingItem;
        const runtimeTicks = item.RunTimeTicks;
        const posTicks = play.PositionTicks;
        const runtimeSec = ticksToSeconds(runtimeTicks);
        const posSec = ticksToSeconds(posTicks);
        const pct = runtimeSec && posSec != null ? Math.round((posSec / runtimeSec) * 100) : null;

        // Build subtitle: episode info or year/quality
        let subtitle = '';
        if (item.SeriesName && item.SeasonName) {
          subtitle = `${item.SeasonName} · ${item.Name}`;
        } else if (item.ProductionYear) {
          subtitle = `${item.ProductionYear}`;
          if (item.Width && item.Width >= 3840) subtitle += ' · 4K';
          else if (item.Width && item.Width >= 1920) subtitle += ' · 1080p';
        }

        // Transcode detail
        let transcodeDetail = undefined;
        const ti = s.TranscodingInfo;
        if (ti && (play.PlayMethod === 'Transcode' || ti.IsVideoDirect === false)) {
          const parts = [];
          if (ti.OriginalVideoWidth && ti.Width) {
            parts.push(`${ti.OriginalVideoWidth}p → ${ti.Height}p`);
          }
          if (ti.VideoCodec && ti.TranscodeReasons && ti.TranscodeReasons.length > 0) {
            parts.push(`${ti.VideoCodec} → ${ti.TranscodeReasons[0]}`);
          }
          transcodeDetail = parts.join(' · ') || 'Transcoding';
        }

        allStreams.push({
          server: m.name,
          serverType: m.type,
          user: s.UserName || '—',
          client: s.Client || s.DeviceName || '—',
          title: item.SeriesName || item.Name || '—',
          subtitle: subtitle || undefined,
          progressPercent: pct,
          positionLabel: posSec != null && runtimeSec ? `${formatTime(posSec)} / ${formatTime(runtimeSec)}` : '—',
          playMethod: play.PlayMethod || 'DirectPlay',
          transcodeDetail,
          paused: play.IsPaused || false,
        });
      }
    } catch (err) {
      worstStatus = worstStatus === 'ok' ? 'degraded' : worstStatus;
      worstError = worstError || err.message;
    }
  }

  allStreams.sort((a, b) => (b.progressPercent ?? 0) - (a.progressPercent ?? 0));
  const top = allStreams.slice(0, 8);
  return {
    status: worstStatus,
    error: worstError,
    activeStreams: top.length,
    transcoding: top.filter(s => s.playMethod === 'Transcode').length,
    streams: top,
  };
}

async function fetchUsenet(usenetConfigs) {
  if (!Array.isArray(usenetConfigs) || usenetConfigs.length === 0) return null;
  const instances = [];

  for (const u of usenetConfigs) {
    try {
      if (u.type === 'sabnzbd') {
        const url = `${u.url}/api?mode=queue&output=json&apikey=${encodeURIComponent(u.apiKey || '')}`;
        const r = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!r.ok) { instances.push(instanceError(u, `HTTP ${r.status}`)); continue; }
        const data = await r.json();
        const q = data.queue || {};
        const slots = (Array.isArray(q.slots) ? q.slots : []).slice(0, 6).map(sl => ({
          instance: u.name,
          name: sl.filename || '—',
          percent: Number.isFinite(parseFloat(sl.percentage)) ? parseFloat(sl.percentage) : 0,
          sizeMb: typeof sl.mb === 'number' ? round1(sl.mb) : null,
          remainingMb: typeof sl.mbleft === 'number' ? round1(sl.mbleft) : null,
          status: sl.status || 'Queued',
        }));
        instances.push({
          name: u.name, type: 'sabnzbd', status: 'ok',
          paused: q.paused === true || q.paused === 'true',
          speedBps: typeof q.speed === 'number' ? q.speed : null,
          etaSeconds: typeof q.timeleft === 'string' ? parseDuration(q.timeleft) : null,
          queuedTotal: q.noofslots_total || slots.length,
          slots,
        });
      } else if (u.type === 'nzbget') {
        const headers = { 'Content-Type': 'application/json', 'User-Agent': 'HomeDash/1.0' };
        if (u.username) {
          headers.Authorization = 'Basic ' + Buffer.from(`${u.username}:${u.password || ''}`).toString('base64');
        }
        const body = JSON.stringify({ method: 'status', params: [], id: 1 });
        const r = await fetch(`${u.url}/jsonrpc`, { method: 'POST', headers, body, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!r.ok) { instances.push(instanceError(u, `HTTP ${r.status}`)); continue; }
        const j = await r.json();
        const status = (j.result || {});
        const paused = status.ServerPaused || false;
        const speed = typeof status.DownloadRate === 'number' ? status.DownloadRate : null;

        // Also get groups
        const gBody = JSON.stringify({ method: 'listgroups', params: [], id: 2 });
        const gr = await fetch(`${u.url}/jsonrpc`, { method: 'POST', headers, body: gBody, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        const groups = gr.ok ? ((await gr.json()).result || []) : [];
        const slots = groups.slice(0, 6).map(g => ({
          instance: u.name,
          name: g.NZBName || '—',
          percent: g.FileSizeMB > 0 ? Math.round((1 - (g.RemainingSizeMB || 0) / g.FileSizeMB) * 100) : 0,
          sizeMb: round1(g.FileSizeMB),
          remainingMb: round1(g.RemainingSizeMB),
          status: g.Status || 'QUEUED',
        }));

        instances.push({
          name: u.name, type: 'nzbget', status: 'ok',
          paused, speedBps: speed, etaSeconds: null,
          queuedTotal: groups.length,
          slots,
        });
      }
    } catch (err) {
      instances.push(instanceError(u, err.message));
    }
  }

  const worst = instances.reduce((s, i) => s === 'down' ? 'down' : i.status === 'down' ? 'down' : i.status === 'degraded' ? 'degraded' : s, 'ok');
  return { status: worst, instances };
}

function instanceError(u, error) {
  return { name: u.name, type: u.type, status: 'down', error, paused: false, speedBps: null, etaSeconds: null, queuedTotal: 0, slots: [] };
}

function parseDuration(s) {
  if (typeof s !== 'string') return null;
  const parts = s.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60;
  return null;
}

// ---------------------------------------------------------------------------
// Docker aggregation (from Glances container lists)
// ---------------------------------------------------------------------------

function aggregateDocker(hosts) {
  const allContainers = [];
  for (const h of hosts) {
    if (!Array.isArray(h.containers)) continue;
    for (const c of h.containers) allContainers.push(c);
  }

  const total = allContainers.length;
  const running = allContainers.filter(c => c.state === 'running').length;
  const healthy = allContainers.filter(c => c.health === 'healthy').length;
  const unhealthy = allContainers.filter(c => c.health === 'unhealthy' || c.state === 'dead').length;
  const restarting = allContainers.filter(c => c.state === 'restarting').length;
  const problems = allContainers.filter(c => c.health === 'unhealthy' || c.state === 'restarting' || c.state === 'dead').slice(0, 8);

  const down = hosts.length > 0 && hosts.every(h => h.status === 'down');
  const degraded = hosts.some(h => h.status === 'down' && Array.isArray(h.containers) && h.containers.length > 0);

  return {
    status: down ? 'down' : degraded ? 'degraded' : 'ok',
    total, running, healthy, unhealthy, restarting, problems,
  };
}

// ---------------------------------------------------------------------------
// Alert engine
// ---------------------------------------------------------------------------

let alertState = new Map(); // ruleId → { consecutiveBreachMs, instance }

function evaluateAlerts(rules, snapshot) {
  if (!Array.isArray(rules)) return;
  const firing = [];
  const now = Date.now();

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const value = resolveMetric(rule, snapshot);
    if (value === null || value === undefined) continue;

    const breach = compareMetric(rule.operator, value, rule.threshold);
    let entry = alertState.get(rule.id) || { consecutiveBreachMs: 0, instance: null };

    if (breach) {
      entry.consecutiveBreachMs += snapshot.pollIntervalMs || 10_000;
      if (entry.consecutiveBreachMs >= (rule.forSeconds || 0) * 1000) {
        if (!entry.instance || entry.instance.state === 'resolved') {
          entry.instance = {
            id: rule.id,
            ruleId: rule.id,
            name: rule.name,
            severity: rule.severity || 'warning',
            state: 'firing',
            message: buildAlertMessage(rule, value),
            value: round1(value),
            since: now,
            acked: false,
          };
        } else {
          entry.instance.value = round1(value);
          entry.instance.message = buildAlertMessage(rule, value);
        }
      }
    } else {
      if (entry.instance && entry.instance.state === 'firing') {
        entry.instance.state = 'resolved';
        entry.instance.resolvedAt = now;
      }
      entry.consecutiveBreachMs = 0;
    }
    alertState.set(rule.id, entry);
  }
}

function resolveMetric(rule, snapshot) {
  const { source, host, metric } = rule;

  if (source === 'glances' && metric === 'reachable') {
    const h = host ? snapshot.hosts.find(x => x.host.id === host) : snapshot.hosts[0];
    return h ? (h.status === 'down' ? 0 : 1) : 0;
  }
  if (source === 'docker' && metric === 'unhealthy') return snapshot.docker?.unhealthy ?? null;
  if (source === 'docker' && metric === 'restarting') return snapshot.docker?.restarting ?? null;
  if (source === 'docker' && metric === 'runningRatio') {
    const d = snapshot.docker;
    return d && d.total > 0 ? d.running / d.total : null;
  }
  if (source === 'media' && metric === 'transcoding') return snapshot.media?.transcoding ?? null;
  if (source === 'media' && metric === 'streams') return snapshot.media?.activeStreams ?? null;
  if (source === 'solar' && metric === 'batterySoc') return snapshot.solar?.batterySocPercent ?? null;
  if (source === 'solar' && metric === 'pvPower') return snapshot.solar?.pvPowerW ?? null;

  // Generic numeric metric resolution against hosts
  if (source === 'glances') {
    const h = host ? snapshot.hosts.find(x => x.host.id === host) : snapshot.hosts[0];
    if (!h) return null;
    const parts = metric.split('.');
    let obj = h;
    for (const p of parts) { obj = obj?.[p]; if (obj === undefined || obj === null) return null; }
    return typeof obj === 'number' ? obj : null;
  }

  // Usenet metrics
  if (source === 'usenet') {
    const u = snapshot.usenet;
    if (!u) return null;
    if (metric === 'paused') return u.instances.some(i => i.paused) ? 1 : 0;
    if (metric === 'slots') return u.instances.reduce((s, i) => s + i.queuedTotal, 0);
    if (metric === 'speed') return u.instances.reduce((s, i) => s + (i.speedBps || 0), 0);
    return null;
  }

  return null;
}

function compareMetric(op, value, threshold) {
  switch (op) {
    case '>': return value > threshold;
    case '>=': return value >= threshold;
    case '<': return value < threshold;
    case '<=': return value <= threshold;
    case '==': return value === threshold;
    case '!=': return value !== threshold;
    default: return false;
  }
}

function buildAlertMessage(rule, value) {
  const val = typeof value === 'number' ? round1(value) : value;
  return `${rule.name}: current ${val} ${rule.operator} ${rule.threshold}`;
}

// ---------------------------------------------------------------------------
// Monitor manager
// ---------------------------------------------------------------------------

export class MonitorManager {
  constructor(getConfig, notificationManager) {
    this._getConfig = getConfig;
    this._notificationManager = notificationManager;
    this._cache = null;
    this._timer = null;
    this._running = false;
  }

  start() {
    if (this._running) return;
    const cfg = this._getConfig();
    if (!cfg?.monitoring?.enabled) return;
    this._running = true;
    this._tick();
    this._timer = setInterval(() => this._tick(), cfg.monitoring.pollIntervalSeconds * 1000 || DEFAULT_POLL_INTERVAL_MS);
    console.log('Monitor: poller started');
  }

  stop() {
    this._running = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    console.log('Monitor: poller stopped');
  }

  reconfigure() {
    const wasRunning = this._running;
    this.stop();
    if (wasRunning) this.start();
  }

  async _tick() {
    if (!this._running) return;
    const cfg = this._getConfig();
    if (!cfg?.monitoring?.enabled) { this.stop(); return; }

    const mon = cfg.monitoring;
    const interval = mon.pollIntervalSeconds * 1000 || DEFAULT_POLL_INTERVAL_MS;

    // Fan out
    const hostCfgs = Array.isArray(mon.glancesHosts) ? mon.glancesHosts : [];
    const [hostResults, solarResult, mediaResult, usenetResult] = await Promise.all([
      Promise.all(hostCfgs.map(h => fetchGlancesHost(h))),
      fetchSolar(cfg),
      fetchMedia(mon.media),
      fetchUsenet(mon.usenet),
    ]);

    const docker = aggregateDocker(hostResults);

    // Global status
    const hostDowns = hostResults.filter(h => h.status === 'down').length;
    const hostDegraded = hostResults.filter(h => h.status === 'degraded').length;
    let globalStatus = 'ok';
    if (hostDowns > 0) globalStatus = 'degraded';
    if (hostDowns === hostResults.length && hostResults.length > 0) globalStatus = 'critical';
    if ((docker.unhealthy || 0) > 0 || (docker.restarting || 0) > 0) globalStatus = globalStatus === 'ok' ? 'degraded' : globalStatus;

    const snapshot = {
      timestamp: Date.now(),
      globalStatus,
      hosts: hostResults,
      solar: solarResult,
      docker,
      media: mediaResult,
      usenet: usenetResult,
      alerts: { firing: [], recentlyResolved: [] },
      pollIntervalMs: interval,
    };

    // Alert evaluation
    if (Array.isArray(mon.alerts)) {
      evaluateAlerts(mon.alerts, snapshot);
      const all = [...alertState.values()];
      const firing = all.filter(e => e.instance?.state === 'firing').map(e => e.instance).sort((a, b) => b.since - a.since);
      const resolved = all.filter(e => e.instance?.state === 'resolved').map(e => e.instance).sort((a, b) => (b.resolvedAt || 0) - (a.resolvedAt || 0)).slice(0, 20);
      snapshot.alerts = { firing, recentlyResolved: resolved.slice(0, 10) };

      // Forward to ntfy for new alerts; acked ones don't re-notify.
      for (const f of firing) {
        if (f.notifiedAt || f.acked) continue;
        try {
          if (mon.alerts.find(r => r.id === f.ruleId)?.notify) {
            const prio = f.severity === 'critical' ? 5 : f.severity === 'warning' ? 4 : 2;
            await this._notificationManager.publish?.({
              topic: 'homedash-monitor',
              title: `[${f.severity.toUpperCase()}] ${f.name}`,
              message: f.message,
              priority: prio,
              tags: f.severity === 'critical' ? 'rotating_light' : 'warning',
            }).catch(() => {});
            f.notifiedAt = Date.now();
          }
        } catch { /* ntfy publish is best-effort */ }
      }
    }

    this._cache = snapshot;

    // Persist alerts
    try {
      const allAlerts = [...alertState.values()].filter(e => e.instance).map(e => e.instance);
      await writeFile(MONITOR_ALERTS_PATH, JSON.stringify(allAlerts.slice(0, MAX_ALERTS), null, 2));
    } catch {}
  }

  getOverview() {
    return this._cache || emptyOverview();
  }

  getAlerts() {
    return this._cache?.alerts || { firing: [], recentlyResolved: [] };
  }

  ackAlert(alertId) {
    const entry = alertState.get(alertId);
    if (entry?.instance) entry.instance.acked = true;
  }

  getSnapshotAge() {
    return this._cache ? Date.now() - this._cache.timestamp : null;
  }
}

function emptyOverview() {
  return {
    timestamp: Date.now(),
    globalStatus: 'ok',
    hosts: [],
    solar: null,
    docker: { status: 'ok', total: 0, running: 0, healthy: 0, unhealthy: 0, restarting: 0, problems: [] },
    media: null,
    usenet: null,
    alerts: { firing: [], recentlyResolved: [] },
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
  };
}

// Ensure data directory exists
try {
  mkdirSync(MONITOR_CONFIG_DIR, { recursive: true });
} catch {}

// Load persisted alert state on module init
try {
  if (existsSync(MONITOR_ALERTS_PATH)) {
    const raw = await readFile(MONITOR_ALERTS_PATH, 'utf-8');
    const persisted = JSON.parse(raw);
    for (const a of (Array.isArray(persisted) ? persisted : [])) {
      alertState.set(a.ruleId || a.id, { consecutiveBreachMs: 0, instance: a });
    }
  }
} catch { /* cold start is fine */ }
