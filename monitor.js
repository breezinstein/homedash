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

import { readFile, writeFile, rename } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

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
const solarSocHistory = new Map();
const opnsenseInterfaceSamples = new Map();

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

function estimateBatteryRuntime(key, soc, batteryPowerW, loadPowerW, pvPowerW) {
  if (!Number.isFinite(soc)) return null;
  const now = Date.now();
  const samples = solarSocHistory.get(key) || [];
  const last = samples[samples.length - 1];
  if (!last || now - last.timestamp >= 5_000) samples.push({ timestamp: now, soc });
  const cutoff = now - 15 * 60_000;
  while (samples.length && samples[0].timestamp < cutoff) samples.shift();
  solarSocHistory.set(key, samples);

  // Primary: SOC trend-based estimate (most accurate, accounts for all losses).
  // Requires at least 3 samples and a consistent trend.
  if (samples.length >= 3 && Number.isFinite(batteryPowerW) && Math.abs(batteryPowerW) > 2) {
    const first = samples[0];
    const latest = samples[samples.length - 1];
    const elapsedMins = (latest.timestamp - first.timestamp) / 60_000;
    const slope = elapsedMins > 0 ? (latest.soc - first.soc) / elapsedMins : 0;
    const charging = batteryPowerW > 0;
    if (Math.abs(slope) >= 0.005 && (slope > 0) === charging) {
      return charging ? (100 - soc) / slope : (soc - 5) / -slope;
    }
  }

  // Fallback: power-based estimate using net battery power.
  // Assumes ~10 kWh usable per 100% SOC for a typical home battery bank.
  const assumedKwhPer100Pct = 10;
  const netBattW = Number.isFinite(batteryPowerW) ? batteryPowerW : 0;
  if (Math.abs(netBattW) > 10) {
    const kwhRemaining = (netBattW > 0 ? (100 - soc) : (soc - 5)) / 100 * assumedKwhPer100Pct;
    const hours = kwhRemaining / (Math.abs(netBattW) / 1000);
    if (hours > 0 && Number.isFinite(hours)) return hours * 60;
  }

  return null;
}

// Docker status string parser. Glances returns simple status strings (not
// the full Docker CLI "Up 2 hours (healthy)" format), so we handle both.
export function parseContainerHealth(statusStr) {
  if (!statusStr || typeof statusStr !== 'string') return { state: 'other', health: 'none' };
  const s = statusStr.toLowerCase().trim();
  // Simple single-word statuses (Glances default format)
  if (s === 'running') return { state: 'running', health: 'none' };
  if (s === 'healthy') return { state: 'running', health: 'healthy' };
  if (s === 'unhealthy') return { state: 'running', health: 'unhealthy' };
  if (s === 'restarting') return { state: 'restarting', health: 'none' };
  if (s === 'paused') return { state: 'paused', health: 'none' };
  if (s === 'exited' || s === 'dead') return { state: s, health: 'none' };
  if (s === 'removing') return { state: 'other', health: 'none' };
  // Docker CLI format: "Up 2 hours (healthy)" etc.
  if (s.includes('restarting')) return { state: 'restarting', health: 'none' };
  if (s.includes('paused')) return { state: 'paused', health: 'none' };
  if (s.includes('exited') || s.includes('dead')) return { state: s.includes('dead') ? 'dead' : 'exited', health: 'none' };
  if (s.startsWith('up ') || s.includes('(healthy)') || s.includes('(unhealthy)') || s.includes('(health: starting)')) {
    return {
      state: 'running',
      health: s.includes('(healthy)') ? 'healthy' : s.includes('(unhealthy)') ? 'unhealthy' : s.includes('(health: starting)') ? 'starting' : 'none',
    };
  }
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

async function fetchOpnsenseJson(url, headers, insecureTls) {
  if (!insecureTls) {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    return response.ok ? response.json() : null;
  }

  return new Promise(resolve => {
    const request = https.get(url, { headers, rejectUnauthorized: false, timeout: FETCH_TIMEOUT_MS }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) return resolve(null);
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(null));
  });
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

    // Network — sum all interfaces if available. Glances v4 uses
    // bytes_recv_rate_per_sec / bytes_sent_rate_per_sec (bytes/s).
    // Older versions or Glances v3 may use rx / tx.
    let rxBps = null, txBps = null;
    if (Array.isArray(all.network)) {
      rxBps = all.network.reduce((s, iface) => s + (
        typeof iface.bytes_recv_rate_per_sec === 'number' ? iface.bytes_recv_rate_per_sec
        : typeof iface.rx === 'number' ? iface.rx
        : 0), 0);
      txBps = all.network.reduce((s, iface) => s + (
        typeof iface.bytes_sent_rate_per_sec === 'number' ? iface.bytes_sent_rate_per_sec
        : typeof iface.tx === 'number' ? iface.tx
        : 0), 0);
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
  // config is the full DashboardConfig; solar settings are under monitoring.solar
  const solarCfg = config?.monitoring?.solar;
  if (!solarCfg?.enabled) return null;
  const inv = (config.inverters && config.inverters.length > 0) ? config.inverters[0] : null;
  if (!inv || !inv.url) return null;

  try {
    const targets = [`${inv.url}/api/v1/metrics`];
    for (const t of targets) {
      const r = await fetchJson(t, inv.username, inv.password);
      if (!r.ok) return { status: 'down', error: r.error };

      const list = Array.isArray(r.data) ? r.data : [];

      // Parse all metrics — group by prefix: total/, inverter_N/, battery_N/
      const totals = {};
      const invGroups = new Map();  // key → { field: value }
      const batGroups = new Map();

      for (const m of list) {
        if (!m || typeof m.topic !== 'string') continue;
        const slash = m.topic.indexOf('/');
        if (slash === -1) continue;
        const prefix = m.topic.slice(0, slash);
        const field = m.topic.slice(slash + 1);
        const val = m.value;

        if (prefix === 'total') {
          totals[field] = val;
        } else if (/^inverter_\d+$/i.test(prefix)) {
          if (!invGroups.has(prefix)) invGroups.set(prefix, { id: prefix.replace(/^inverter_/i, '') });
          invGroups.get(prefix)[field] = val;
        } else if (/^battery_\d+$/i.test(prefix)) {
          if (!batGroups.has(prefix)) batGroups.set(prefix, { id: prefix.replace(/^battery_/i, '') });
          batGroups.get(prefix)[field] = val;
        }
      }

      const pick = (obj, key) => {
        const v = obj[key];
        if (typeof v === 'number') return v;
        if (typeof v === 'string') { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }
        return v ?? null;
      };

      // Build inverter details
      const inverters = [...invGroups.values()].map(g => ({
        id: g.id,
        serialNumber: pick(g, 'serial_number') != null ? String(pick(g, 'serial_number')) : null,
        deviceMode: pick(g, 'device_mode') != null ? String(pick(g, 'device_mode')) : null,
        temperature: pick(g, 'temperature'),
        busVoltage: pick(g, 'bus_voltage'),
        systemPowerW: pick(g, 'system_power'),
        loadPercent: pick(g, 'load_percent'),
        loadPowerW: pick(g, 'load_power'),
        loadApparentPowerVa: pick(g, 'load_apparent_power'),
        acOutputVoltage: pick(g, 'ac_output_voltage'),
        acOutputFrequency: pick(g, 'ac_output_frequency'),
        pvPowerW: pick(g, 'pv_power'),
        pvVoltage: pick(g, 'pv_voltage'),
        pvCurrent: pick(g, 'pv_current'),
        batteryVoltage: pick(g, 'battery_voltage'),
        batteryCurrent: pick(g, 'battery_current'),
        batteryPowerW: pick(g, 'battery_power'),
        batteryPowerFromAcW: pick(g, 'battery_power_from_ac'),
        gridPowerW: pick(g, 'grid_power'),
        gridVoltage: pick(g, 'grid_voltage'),
        gridFrequency: pick(g, 'grid_frequency'),
        generatorPowerW: pick(g, 'generator_power'),
        generatorVoltage: pick(g, 'generator_voltage'),
      })).sort((a, b) => Number(a.id) - Number(b.id));

      // Build battery details — try both 'state_of_charge' and 'soc' field names
      const batteries = [...batGroups.values()].map(g => ({
        id: g.id,
        capacityAh: pick(g, 'capacity'),
        stateOfChargePercent: pick(g, 'state_of_charge') ?? pick(g, 'soc'),
        powerW: pick(g, 'power'),
        currentA: pick(g, 'current'),
        voltage: pick(g, 'voltage'),
        temperature: pick(g, 'temperature'),
        temperatureMos: pick(g, 'temperature_mos'),
        temperatureEnv: pick(g, 'temperature_env'),
        cycles: pick(g, 'cycles') != null ? Math.round(pick(g, 'cycles')) : null,
        chargeCapacityAh: pick(g, 'charge_capacity'),
        cellVoltageHighest: pick(g, 'cell_voltage_highest'),
        cellVoltageLowest: pick(g, 'cell_voltage_lowest'),
        cellVoltageImbalance: pick(g, 'cell_voltage_imbalance'),
        cellTempHighest: pick(g, 'cell_temp_highest'),
        cellTempLowest: pick(g, 'cell_temp_lowest'),
        cellTempAverage: pick(g, 'cell_temp_average'),
      })).sort((a, b) => Number(a.id) - Number(b.id));

      const batterySocPercent = pick(totals, 'battery_state_of_charge');
      const batteryPowerW = pick(totals, 'battery_power');
      const loadPowerW = pick(totals, 'load_power');
      const pvPowerW = pick(totals, 'pv_power');
      return {
        status: 'ok',
        pvPowerW,
        loadPowerW,
        gridPowerW: pick(totals, 'grid_power'),
        batterySocPercent,
        batteryPowerW,
        batteryRuntimeMins: estimateBatteryRuntime(inv.url, batterySocPercent, batteryPowerW, loadPowerW, pvPowerW),
        inverters,
        batteries,
      };
    }
    return { status: 'down', error: 'No metrics found', inverters: [], batteries: [] };
  } catch (err) {
    return { status: 'down', error: err.message, inverters: [], batteries: [] };
  }
}

async function fetchMedia(mediaConfigs) {
  if (!Array.isArray(mediaConfigs) || mediaConfigs.length === 0) return null;
  const allStreams = [];
  let successfulSources = 0;
  let worstError = undefined;

  for (const m of mediaConfigs) {
    try {
      const url = `${m.url}/Sessions`;
      const headers = { Accept: 'application/json', 'User-Agent': 'HomeDash/1.0' };
      // Emby uses api_key query param; Jellyfin accepts it too
      const r = await fetch(`${url}?api_key=${encodeURIComponent(m.apiKey)}`, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!r.ok) {
        worstError = `HTTP ${r.status} from ${m.name}`;
        continue;
      }
      successfulSources++;
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
          client: s.Client || '—',
          device: s.DeviceName || '—',
          title: item.SeriesName || item.Name || '—',
          subtitle: subtitle || undefined,
          progressPercent: pct,
          positionLabel: posSec != null && runtimeSec ? `${formatTime(posSec)} / ${formatTime(runtimeSec)}` : '—',
          playMethod: play.PlayMethod || 'DirectPlay',
          transcodeDetail,
          paused: play.IsPaused || false,
          startedAt: typeof play.StartTimeTicks === 'number' ? ticksToSeconds(play.StartTimeTicks) : null,
        });
      }
    } catch (err) {
      worstError = worstError || err.message;
    }
  }

  allStreams.sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));
  const top = allStreams.slice(0, 8);
  return {
    status: successfulSources === 0 ? 'down' : successfulSources === mediaConfigs.length ? 'ok' : 'degraded',
    error: worstError,
    activeStreams: allStreams.length,
    transcoding: allStreams.filter(s => s.playMethod === 'Transcode').length,
    streams: top,
  };
}

async function fetchUsenet(usenetConfigs) {
  if (!Array.isArray(usenetConfigs) || usenetConfigs.length === 0) return null;
  const instances = [];

  for (const u of usenetConfigs) {
    try {
      if (u.type === 'sabnzbd') {
        // SABnzbd auth: prefer HTTP Basic (username+password), fall back to
        // API key as query param. Both can be present; Basic takes priority.
        const headers = { Accept: 'application/json', 'User-Agent': 'HomeDash/1.0' };
        let url = `${u.url}/api?mode=queue&output=json`;
        if (u.username) {
          headers.Authorization = 'Basic ' + Buffer.from(`${u.username}:${u.password || ''}`).toString('base64');
        } else if (u.apiKey) {
          url += `&apikey=${encodeURIComponent(u.apiKey)}`;
        }
        const r = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
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
// Sonarr / Radarr fetcher — both share the same v3 API shape.
// ---------------------------------------------------------------------------

async function fetchArr(arrConfigs) {
  if (!Array.isArray(arrConfigs) || arrConfigs.length === 0) return null;
  const instances = [];
  const allQueue = [];

  for (const a of arrConfigs) {
    try {
      const headers = { Accept: 'application/json', 'User-Agent': 'HomeDash/1.0', 'X-Api-Key': a.apiKey };
      const base = String(a.url).replace(/\/+$/, '');
      const wantedPath = a.type === 'sonarr' ? '/api/v3/wanted/missing?page=1&pageSize=1' : '/api/v3/wanted/missing?page=1&pageSize=1';
      const [qRes, sysRes, healthRes, wantedRes] = await Promise.all([
        fetch(`${base}/api/v3/queue?page=1&pageSize=6&sortKey=estimatedCompletionTime&sortDirection=ascending`, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }),
        fetch(`${base}/api/v3/system/status`, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }),
        fetch(`${base}/api/v3/health`, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }),
        fetch(`${base}${wantedPath}`, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }),
      ].map(p => p.catch(() => null)));

      if (!qRes?.ok || !sysRes?.ok) {
        const status = qRes?.status || sysRes?.status || 'network error';
        throw new Error(`HTTP ${status}`);
      }

      const queue = await qRes.json().catch(() => ({}));
      const health = healthRes?.ok ? await healthRes.json().catch(() => []) : [];
      const wanted = wantedRes?.ok ? await wantedRes.json().catch(() => ({})) : {};

      const queueRecords = Array.isArray(queue.records) ? queue.records : (Array.isArray(queue) ? queue : []);
      const warnings = Array.isArray(health) ? health.filter(h => h.type === 'warning' || h.type === 'error') : [];
      const queueCount = typeof queue.totalRecords === 'number' ? queue.totalRecords : queueRecords.length;
      const wantedCount = typeof wanted.totalRecords === 'number' ? wanted.totalRecords : 0;

      for (const r of queueRecords.slice(0, 6)) {
        allQueue.push({
          instance: a.name,
          instanceType: a.type,
          title: r.title || '—',
          seriesName: r.series?.title || undefined,
          quality: r.quality?.quality?.name || (typeof r.quality === 'string' ? r.quality : '—'),
          sizeMb: typeof r.size === 'number' ? round1(r.size / 1048576) : null,
          progressPercent: typeof r.size === 'number' && typeof r.sizeleft === 'number' && r.size > 0
            ? Math.round((1 - (r.sizeleft || 0) / r.size) * 100) : null,
          timeLeft: r.timeleft || null,
          status: r.status || r.trackedDownloadStatus || 'queued',
        });
      }

      instances.push({
        name: a.name, type: a.type, status: 'ok',
        queueCount,
        wantedCount,
        healthOk: warnings.length === 0,
        healthWarnings: warnings.map(w => w.message || w.source || 'unknown'),
      });
    } catch (err) {
      instances.push({ name: a.name, type: a.type, status: 'down', error: err.message, queueCount: 0, wantedCount: 0, healthOk: false, healthWarnings: [err.message] });
    }
  }

  allQueue.sort((a, b) => (b.progressPercent ?? 0) - (a.progressPercent ?? 0));
  const worst = instances.reduce((s, i) => s === 'down' ? 'down' : i.status === 'down' ? 'down' : i.status === 'degraded' ? 'degraded' : s, 'ok');
  return { status: worst, instances, queue: allQueue };
}

// ---------------------------------------------------------------------------
// Seerr / Overseerr / Jellyseerr fetcher — surfaces open media issues and
// unattended (pending / failed) requests. All share the Overseerr API shape.
// Auth: X-Api-Key header.
// ---------------------------------------------------------------------------

async function seerrFetchJson(base, path, apiKey) {
  const res = await fetch(`${base}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'HomeDash/1.0', 'X-Api-Key': apiKey || '' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return res.json().catch(() => null);
}

function seerrMediaTitle(media) {
  if (!media || typeof media !== 'object') return 'Unknown';
  return media.title || media.name || 'Unknown';
}

function seerrUserName(user) {
  if (!user || typeof user !== 'object') return '—';
  return user.displayName || user.username || user.email || '—';
}

// Seerr/Overseerr list endpoints return tmdbId but NOT the media title, so we
// resolve real titles from the movie/tv detail endpoints and cache them
// in-memory (keyed by mediaType:tmdbId) to avoid re-fetching full details on
// every poll. A failed lookup caches null so we don't hammer a bad id.
const seerrTitleCache = new Map();
const SEERR_TITLE_TTL_MS = 15 * 60_000;

async function seerrEnrichTitles(base, apiKey, items) {
  const wanted = new Map();
  for (const it of items) {
    if (it.tmdbId == null) continue;
    const type = it.mediaType === 'tv' ? 'tv' : 'movie';
    const key = `${type}:${it.tmdbId}`;
    if (!wanted.has(key)) wanted.set(key, { type, tmdbId: it.tmdbId });
  }
  await Promise.all([...wanted.values()].map(async ({ type, tmdbId }) => {
    const key = `${type}:${tmdbId}`;
    const cached = seerrTitleCache.get(key);
    if (cached && Date.now() - cached.ts < SEERR_TITLE_TTL_MS) return;
    const data = await seerrFetchJson(base, `/api/v1/${type}/${tmdbId}`, apiKey);
    const title = data ? (type === 'tv' ? data.name : data.title) : null;
    seerrTitleCache.set(key, { title, ts: Date.now() });
  }));
}

function seerrApplyTitle(item) {
  if (item.tmdbId == null) return;
  const type = item.mediaType === 'tv' ? 'tv' : 'movie';
  const cached = seerrTitleCache.get(`${type}:${item.tmdbId}`);
  if (cached?.title) item.mediaTitle = cached.title;
}

export async function fetchSeerr(seerrConfigs) {
  if (!Array.isArray(seerrConfigs) || seerrConfigs.length === 0) return null;
  const issues = [];
  const pending = [];
  const failed = [];
  let version;
  let okCount = 0;
  let failCount = 0;
  let lastError;

  for (const s of seerrConfigs) {
    try {
      const base = String(s.url || '').replace(/\/+$/, '');
      const apiKey = s.apiKey || '';
      const [statusRes, issueRes, pendingRes, failedRes] = await Promise.all([
        seerrFetchJson(base, '/api/v1/status', apiKey),
        seerrFetchJson(base, '/api/v1/issue?take=10&filter=open', apiKey),
        seerrFetchJson(base, '/api/v1/request?take=6&filter=pending', apiKey),
        seerrFetchJson(base, '/api/v1/request?take=6&filter=failed', apiKey),
      ]);

      if (!statusRes) throw new Error(`unreachable (${s.name || s.url || 'seerr'})`);

      okCount += 1;
      version = version || statusRes.version || null;

      const myIssues = (Array.isArray(issueRes?.results) ? issueRes.results : []).map((iss) => ({
        id: iss.id,
        issueType: iss.issueType ?? 4,
        status: iss.resolved ? 'resolved' : 'open',
        mediaTitle: seerrMediaTitle(iss.media),
        mediaType: iss.media?.mediaType === 'tv' ? 'tv' : 'movie',
        tmdbId: iss.media?.tmdbId ?? null,
        createdBy: seerrUserName(iss.createdBy),
        createdAt: iss.createdAt || null,
      }));
      const myPending = (Array.isArray(pendingRes?.results) ? pendingRes.results : []).map((req) => ({
        id: req.id,
        status: 'pending',
        mediaTitle: seerrMediaTitle(req.media),
        mediaType: req.media?.mediaType === 'tv' ? 'tv' : 'movie',
        tmdbId: req.media?.tmdbId ?? null,
        is4k: req.is4k === true,
        requestedBy: seerrUserName(req.requestedBy),
        createdAt: req.createdAt || null,
      }));
      const myFailed = (Array.isArray(failedRes?.results) ? failedRes.results : []).map((req) => ({
        id: req.id,
        status: 'failed',
        mediaTitle: seerrMediaTitle(req.media),
        mediaType: req.media?.mediaType === 'tv' ? 'tv' : 'movie',
        tmdbId: req.media?.tmdbId ?? null,
        is4k: req.is4k === true,
        requestedBy: seerrUserName(req.requestedBy),
        createdAt: req.createdAt || null,
      }));

      // Resolve real media titles (list payloads only carry tmdbId).
      await seerrEnrichTitles(base, apiKey, [...myIssues, ...myPending, ...myFailed]);
      for (const it of [...myIssues, ...myPending, ...myFailed]) seerrApplyTitle(it);

      issues.push(...myIssues);
      pending.push(...myPending);
      failed.push(...myFailed);
    } catch (err) {
      failCount += 1;
      lastError = err.message;
    }
  }

  // Status: down if nothing responded; degraded if some instances failed or
  // there is anything that needs attention (open issues, failed requests).
  let status = 'ok';
  if (okCount === 0) status = 'down';
  else if (failCount > 0) status = 'degraded';
  else if (issues.length > 0 || failed.length > 0) status = 'degraded';

  return {
    status,
    error: status === 'down' ? lastError : undefined,
    version,
    issues: issues.slice(0, 8),
    pending: pending.slice(0, 6),
    failed: failed.slice(0, 6),
  };
}

// ---------------------------------------------------------------------------
// OPNSense firewall/router fetcher.
// OPNSense REST API uses HTTP Basic with apiKey:apiSecret as credentials.
// Endpoints vary by plugin; we try the most common ones and degrade gracefully.
// ---------------------------------------------------------------------------

async function fetchOpnsense(opnConfigs) {
  if (!Array.isArray(opnConfigs) || opnConfigs.length === 0) return null;
  const o = opnConfigs[0];
  if (!o || !o.url || !o.apiKey || !o.apiSecret) return null;

  const headers = { Accept: 'application/json', 'User-Agent': 'HomeDash/1.0' };
  headers.Authorization = 'Basic ' + Buffer.from(`${o.apiKey}:${o.apiSecret}`).toString('base64');

  // These endpoints are stable across current OPNsense releases. Interface
  // statistics are byte counters, so per-second rates are derived locally.
  // Insight (NetFlow) top talkers require a POST to /api/insight/service/top
  // with JSON body specifying type and time window.
  async function fetchOpn(path) {
    try {
      return await fetchOpnsenseJson(`${String(o.url).replace(/\/+$/, '')}${path}`, headers, o.insecureTls === true);
    } catch { return null; }
  }

  // Insight POST helper — the top-talkers endpoint expects JSON body
  async function fetchInsightTopTalkers() {
    try {
      const url = `${String(o.url).replace(/\/+$/, '')}/api/insight/service/top`;
      const body = JSON.stringify({ type: 'talker', time: 3600, max: 10 });
      const reqHeaders = { ...headers, 'Content-Type': 'application/json' };
      if (!o.insecureTls) {
        const res = await fetch(url, { method: 'POST', headers: reqHeaders, body, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        return res.ok ? res.json() : null;
      }
      return new Promise(resolve => {
        const u = new URL(url);
        const req = https.request({
          hostname: u.hostname,
          port: u.port || 443,
          path: u.pathname + u.search,
          method: 'POST',
          headers: reqHeaders,
          rejectUnauthorized: false,
          timeout: FETCH_TIMEOUT_MS,
        }, res => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', c => { data += c; });
          res.on('end', () => {
            if (res.statusCode < 200 || res.statusCode >= 300) return resolve(null);
            try { resolve(JSON.parse(data)); } catch { resolve(null); }
          });
        });
        req.on('timeout', () => req.destroy());
        req.on('error', () => resolve(null));
        req.write(body);
        req.end();
      });
    } catch { return null; }
  }

  const [info, resources, activity, traffic, pfStates, dnsmasqLeases, gwStatus, ifConfig, insightTalkers] = await Promise.all([
    fetchOpn('/api/diagnostics/system/systemInformation'),
    fetchOpn('/api/diagnostics/system/systemResources'),
    fetchOpn('/api/diagnostics/activity/getActivity'),
    fetchOpn('/api/diagnostics/traffic/interface'),
    fetchOpn('/api/diagnostics/firewall/pf_states'),
    fetchOpn('/api/dnsmasq/leases/search'),
    fetchOpn('/api/routes/gateway/status'),
    fetchOpn('/api/diagnostics/interface/getInterfaceConfig'),
    fetchInsightTopTalkers(),
  ]);

  // DHCP leases: Dnsmasq is the primary provider on most OPNsense installs.
  // Fall back to Kea if Dnsmasq returns no data.
  let dhcpLeaseCount = null;
  if (dnsmasqLeases && typeof dnsmasqLeases.total === 'number') {
    dhcpLeaseCount = dnsmasqLeases.total;
  } else {
    const keaLeases = await fetchOpn('/api/kea/leases4/search');
    if (keaLeases && typeof keaLeases.total === 'number') dhcpLeaseCount = keaLeases.total;
  }

  const hostname = info?.name || null;
  const version = Array.isArray(info?.versions) ? info.versions[0] || null : null;
  const activityHeaders = Array.isArray(activity?.headers) ? activity.headers : [];
  const loadLine = activityHeaders.find(line => typeof line === 'string' && line.includes('load averages')) || '';
  const uptime = loadLine.match(/up\s+(.+?)\s{2,}\d{2}:\d{2}:\d{2}/)?.[1] || null;
  const cpuLine = activityHeaders.find(line => typeof line === 'string' && line.startsWith('CPU:')) || '';
  const idle = Number(cpuLine.match(/([\d.]+)%\s+idle/)?.[1]);
  const cpuPct = Number.isFinite(idle) ? round1(100 - idle) : null;
  const totalMem = Number(resources?.memory?.total);
  const usedMem = Number(resources?.memory?.used);
  const memPct = Number.isFinite(totalMem) && totalMem > 0 && Number.isFinite(usedMem)
    ? round1((usedMem / totalMem) * 100) : null;

  const now = Date.now();
  // Map device names to per-IP entries and flag running interfaces.
  // Each physical interface appears multiple times in the traffic endpoint
  // (once per IP/MAC) — deduplicate by device, preferring the entry with
  // a routable IP address.
  const deviceStatus = new Map(); // device → { running, ip }
  if (ifConfig && typeof ifConfig === 'object') {
    for (const [dev, cfg] of Object.entries(ifConfig)) {
      if (!cfg || typeof cfg !== 'object') continue;
      const flags = Array.isArray(cfg.flags) ? cfg.flags : [];
      const ipv4 = Array.isArray(cfg.ipv4) ? cfg.ipv4 : [];
      deviceStatus.set(dev, {
        running: flags.includes('running') && flags.includes('up'),
        ip: ipv4.length > 0 ? String(ipv4[0].ipaddr || ipv4[0]) : null,
      });
    }
  }

  // Gateway status maps to interface name via the gateway name.
  // 'none' = online (active), 'down' = offline.
  const gateways = Array.isArray(gwStatus?.items) ? gwStatus.items : [];

  const rawInterfaces = traffic?.interfaces && typeof traffic.interfaces === 'object'
    ? Object.entries(traffic.interfaces) : [];
  // Collect interfaces split by WAN vs LAN, deduplicated by physical device.
  const wanDeviceSeen = new Map();
  const lanDeviceSeen = new Map();
  for (const [key, iface] of rawInterfaces) {
    const dev = iface?.device;
    if (!dev || dev === 'lo0' || dev === 'enc0' || dev === 'pflog0' || dev === 'pfsync0') continue;
    const isWan = /wan/i.test(key) || /wan/i.test(iface?.name || '');
    const target = isWan ? wanDeviceSeen : lanDeviceSeen;
    if (target.has(dev)) {
      if (key.includes('/') && /\d+\.\d+\.\d+\.\d+/.test(key)) target.set(dev, { key, iface });
    } else {
      target.set(dev, { key, iface });
    }
  }

  const buildIfaces = (entries) =>
    [...entries].map(([dev, { key, iface }]) => {
      const ds = deviceStatus.get(dev);
      const viaGateway = gateways.find(g => {
        const gwName = String(g.name || '').toLowerCase();
        const ifName = (iface?.name || '').toLowerCase();
        return gwName.includes(dev.toLowerCase()) || (ifName && gwName.includes(ifName));
      });
      const gwDown = viaGateway && viaGateway.status === 'down';
      const isActive = viaGateway ? viaGateway.status === 'none' : (ds?.running ?? false);
      let ifStatus = 'down';
      if (ds?.running && !gwDown) ifStatus = 'up';
      else if (ds?.running && gwDown) ifStatus = 'degraded';
      const ifDescr = (iface?.name || key).replace(/^\[\w+\]\s*/, '').replace(/\s*\/.+$/, '').trim() || key;
      const counterKey = `${o.id}:${key}`;
      const previous = opnsenseInterfaceSamples.get(counterKey);
      const rxBytes = Number(iface?.['bytes received']);
      const txBytes = Number(iface?.['bytes transmitted']);
      const elapsedSeconds = previous ? (now - previous.timestamp) / 1000 : 0;
      const inBps = previous && elapsedSeconds > 0 && Number.isFinite(rxBytes)
        ? Math.max(0, (rxBytes - previous.rxBytes) / elapsedSeconds) : null;
      const outBps = previous && elapsedSeconds > 0 && Number.isFinite(txBytes)
        ? Math.max(0, (txBytes - previous.txBytes) / elapsedSeconds) : null;
      if (Number.isFinite(rxBytes) && Number.isFinite(txBytes)) {
        opnsenseInterfaceSamples.set(counterKey, { timestamp: now, rxBytes, txBytes });
      }
      return { name: iface?.device || key, description: ifDescr, status: ifStatus, active: isActive, inBps, outBps };
    });

  const wanIfaces = buildIfaces(wanDeviceSeen);
  const lanIfaces = buildIfaces(lanDeviceSeen);

  // Parse Insight NetFlow top talkers
  const netflowTalkers = [];
  if (insightTalkers && Array.isArray(insightTalkers.rows)) {
    for (const row of insightTalkers.rows) {
      if (!row || !row.address) continue;
      const bytesIn = Number.isFinite(Number(row.bytes_in)) ? Number(row.bytes_in) : 0;
      const bytesOut = Number.isFinite(Number(row.bytes_out)) ? Number(row.bytes_out) : 0;
      const totalBytes = bytesIn + bytesOut || Number(row.bytes) || 0;
      const pct = Number.isFinite(Number(row.percent)) ? Number(row.percent)
        : Number.isFinite(Number(row.percentage)) ? Number(row.percentage) : 0;
      netflowTalkers.push({
        address: String(row.address),
        hostname: row.hostname && typeof row.hostname === 'string' ? row.hostname : null,
        bytes: totalBytes,
        percentage: pct,
      });
    }
    netflowTalkers.sort((a, b) => b.bytes - a.bytes);
  }

  if (!hostname && !resources && !activity && !traffic && !pfStates) {
    return { status: 'down', error: 'No data from OPNSense API — check URL, API key, and API secret',
      hostname: null, version: null, uptime: null, cpuPercent: null, memPercent: null, diskPercent: null,
      wanInterfaces: [], lanInterfaces: [], netflowTalkers: [], firewallStates: null, dhcpLeases: null };
  }

  return {
    status: 'ok',
    hostname, version, uptime, cpuPercent: cpuPct, memPercent: memPct, diskPercent: null,
    wanInterfaces: wanIfaces,
    lanInterfaces: lanIfaces,
    netflowTalkers,
    firewallStates: Number.isFinite(Number(pfStates?.current)) ? Number(pfStates.current) : null,
    dhcpLeases: dhcpLeaseCount,
  };
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
  const degraded = !down && hosts.some(h => h.status === 'down') && total > 0;

  return {
    status: down ? 'down' : degraded ? 'degraded' : 'ok',
    total, running, healthy, unhealthy, restarting, problems,
  };
}

// ---------------------------------------------------------------------------
// Alert engine
// ---------------------------------------------------------------------------

let alertState = new Map(); // ruleId[:hostId] → { consecutiveBreachMs, instance }

export function resetAlertStateForTests() {
  alertState = new Map();
}

export function getAlertInstancesForTests() {
  return [...alertState.values()].map(entry => entry.instance).filter(Boolean);
}

export function evaluateAlerts(rules, snapshot) {
  if (!Array.isArray(rules)) return;
  const now = Date.now();
  const evaluated = new Set();

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const hosts = (rule.source === 'glances' || rule.source === 'reachability') && !rule.host
      ? snapshot.hosts : [rule.host ? snapshot.hosts.find(h => h.host.id === rule.host) : null];
    const targets = hosts.length ? hosts : [null];
    for (const host of targets) {
      const key = host ? `${rule.id}:${host.host.id}` : rule.id;
      evaluated.add(key);
      const value = resolveMetric(rule, snapshot, host);
      const entry = alertState.get(key) || { consecutiveBreachMs: 0, instance: null };
      const breach = value !== null && value !== undefined && compareMetric(rule.operator, value, rule.threshold);

      if (breach) {
        entry.consecutiveBreachMs += snapshot.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS;
        if (entry.consecutiveBreachMs >= Math.max(0, rule.forSeconds || 0) * 1000) {
          if (!entry.instance || entry.instance.state === 'resolved') {
            entry.instance = {
              id: key, ruleId: rule.id, name: rule.name, severity: rule.severity || 'warning',
              state: 'firing', message: buildAlertMessage(rule, value, host), value: round1(value),
              since: now, acked: false,
            };
          } else {
            entry.instance.value = round1(value);
            entry.instance.message = buildAlertMessage(rule, value, host);
          }
        }
      } else {
        if (entry.instance?.state === 'firing') {
          entry.instance.state = 'resolved';
          entry.instance.resolvedAt = now;
        }
        entry.consecutiveBreachMs = 0;
      }
      alertState.set(key, entry);
    }
  }

  // Removed/disabled rules must not remain firing after configuration changes.
  for (const [key, entry] of alertState) {
    if (!evaluated.has(key) && entry.instance?.state === 'firing') {
      entry.instance.state = 'resolved';
      entry.instance.resolvedAt = now;
      entry.consecutiveBreachMs = 0;
    }
  }
}

export function resolveMetric(rule, snapshot, targetHost = null) {
  const { source, host, metric } = rule;

  if ((source === 'glances' || source === 'reachability') && metric === 'reachable') {
    const h = targetHost || (host ? snapshot.hosts.find(x => x.host.id === host) : null);
    return h ? (h.status === 'down' ? 0 : 1) : 0;
  }
  if (source === 'docker' && (metric === 'unhealthy' || metric === 'docker.unhealthy')) return snapshot.docker?.unhealthy ?? null;
  if (source === 'docker' && (metric === 'restarting' || metric === 'docker.restarting')) return snapshot.docker?.restarting ?? null;
  if (source === 'docker' && (metric === 'runningRatio' || metric === 'docker.runningRatio')) {
    const d = snapshot.docker;
    return d && d.total > 0 ? d.running / d.total : null;
  }
  if (source === 'media' && (metric === 'transcoding' || metric === 'streams.transcoding')) return snapshot.media?.transcoding ?? null;
  if (source === 'media' && (metric === 'streams' || metric === 'streams.count')) return snapshot.media?.activeStreams ?? null;
  if (source === 'solar' && metric === 'battery.soc') return snapshot.solar?.status === 'ok' ? snapshot.solar.batterySocPercent : null;
  if (source === 'solar' && metric === 'pv.power') return snapshot.solar?.status === 'ok' ? snapshot.solar.pvPowerW : null;
  if (source === 'solar' && metric === 'grid.power') return snapshot.solar?.status === 'ok' ? snapshot.solar.gridPowerW : null;

  // Generic numeric metric resolution against hosts
  if (source === 'glances') {
    const h = targetHost || (host ? snapshot.hosts.find(x => x.host.id === host) : null);
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
    if (metric === 'downloads.paused') return u.instances.some(i => i.paused) ? 1 : 0;
    if (metric === 'queue.slots') return u.instances.reduce((s, i) => s + i.queuedTotal, 0);
    if (metric === 'downloads.speed') return u.instances.reduce((s, i) => s + (i.speedBps || 0), 0);
    return null;
  }

  return null;
}

export function compareMetric(op, value, threshold) {
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

function buildAlertMessage(rule, value, host) {
  const val = typeof value === 'number' ? round1(value) : value;
  const source = host ? `${host.host.name} ` : '';
  return `${source}${rule.name}: ${val} ${rule.operator} ${rule.threshold}`;
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
    this._inFlight = false;
    this._lastCycleDurationMs = null;
    this._waiters = new Set();
  }

  start() {
    if (this._running) return;
    const cfg = this._getConfig();
    if (!cfg?.monitoring?.enabled) return;
    this._running = true;
    this._tick();
    const seconds = Math.max(2, Math.min(60, Number(cfg.monitoring.pollIntervalSeconds) || 10));
    this._timer = setInterval(() => this._tick(), seconds * 1000);
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
    if (!this._running || this._inFlight) return;
    this._inFlight = true;
    const startedAt = Date.now();
    try {
    const cfg = this._getConfig();
    if (!cfg?.monitoring?.enabled) { this.stop(); return; }

    const mon = cfg.monitoring;
    const interval = Math.max(2, Math.min(60, Number(mon.pollIntervalSeconds) || 10)) * 1000;

    // Fan out
    const hostCfgs = Array.isArray(mon.glancesHosts) ? mon.glancesHosts : [];
    const [hostResults, solarResult, mediaResult, usenetResult, arrResult, seerrResult, opnsenseResult] = await Promise.all([
      Promise.all(hostCfgs.map(h => fetchGlancesHost(h))),
      fetchSolar(cfg),
      fetchMedia(mon.media),
      fetchUsenet(mon.usenet),
      fetchArr(mon.arr),
      fetchSeerr(mon.seerr),
      fetchOpnsense(mon.opnsense),
    ]);

    const docker = mon.docker?.enabled === false
      ? { status: 'ok', total: 0, running: 0, healthy: 0, unhealthy: 0, restarting: 0, problems: [] }
      : aggregateDocker(hostResults);

    // Global status
    const hostDowns = hostResults.filter(h => h.status === 'down').length;
    const hostDegraded = hostResults.filter(h => h.status === 'degraded').length;
    let globalStatus = 'ok';
    if (hostDowns > 0) globalStatus = 'degraded';
    if (hostDowns === hostResults.length && hostResults.length > 0) globalStatus = 'critical';
    if ((docker.unhealthy || 0) > 0 || (docker.restarting || 0) > 0) globalStatus = globalStatus === 'ok' ? 'degraded' : globalStatus;
    if ([solarResult, mediaResult, usenetResult, arrResult, seerrResult, opnsenseResult].some(source => source?.status === 'down')) {
      globalStatus = globalStatus === 'ok' ? 'degraded' : globalStatus;
    }

    const snapshot = {
      timestamp: Date.now(),
      globalStatus,
      hosts: hostResults,
      solar: solarResult,
      docker,
      media: mediaResult,
      usenet: usenetResult,
      arr: arrResult,
      seerr: seerrResult,
      opnsense: opnsenseResult,
      alerts: { firing: [], recentlyResolved: [] },
      pollIntervalMs: interval,
      tabRotationSeconds: mon.ui?.tabRotationSeconds ?? 15,
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
            await this._notificationManager.publish({
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

      if (firing.some(alert => alert.severity === 'critical')) globalStatus = 'critical';
      else if (firing.length > 0 && globalStatus === 'ok') globalStatus = 'degraded';
      snapshot.globalStatus = globalStatus;
    }

    this._cache = snapshot;
    this._lastCycleDurationMs = Date.now() - startedAt;
    for (const waiter of this._waiters) waiter(snapshot);
    this._waiters.clear();

    // Persist alerts
    try {
      const allAlerts = [...alertState.values()]
        .filter(e => e.instance)
        .map(e => e.instance)
        .sort((a, b) => (b.resolvedAt || b.since) - (a.resolvedAt || a.since))
        .slice(0, MAX_ALERTS);
      const tempPath = `${MONITOR_ALERTS_PATH}.tmp`;
      await writeFile(tempPath, JSON.stringify(allAlerts, null, 2));
      await rename(tempPath, MONITOR_ALERTS_PATH);
    } catch {}
    } finally {
      this._inFlight = false;
    }
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

  getHealth() {
    return {
      running: this._running,
      polling: this._inFlight,
      snapshotAge: this.getSnapshotAge(),
      lastCycleDurationMs: this._lastCycleDurationMs,
    };
  }

  waitForNextSnapshot(timeoutMs) {
    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        this._waiters.delete(done);
        resolve(this.getOverview());
      }, timeoutMs);
      const done = (snapshot) => {
        clearTimeout(timeout);
        resolve(snapshot);
      };
      this._waiters.add(done);
      this._tick();
    });
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
    arr: null,
    seerr: null,
    opnsense: null,
    alerts: { firing: [], recentlyResolved: [] },
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    tabRotationSeconds: 15,
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
