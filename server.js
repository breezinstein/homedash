import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync, unlinkSync, rmSync, createReadStream, createWriteStream, statfsSync } from 'fs';
import { readFile, writeFile, stat } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join, basename, extname, resolve, sep } from 'path';
import crypto from 'crypto';
import os from 'os';
import { NotificationManager } from './notifications.js';
import {
  authEnabled,
  optionalAuth,
  requireAuth,
  csrfGuard,
  registerAuthRoutes,
  startupLogLine as authStartupLogLine,
} from './auth.js';
import { redactConfigForPublic, mergePrivateSections } from './configRedaction.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SHARED_FILES_DIR = process.env.SHARED_FILES_DIR || join(__dirname, '..', 'shared-files');

const app = express();
const PORT = 3001;
const CONFIG_PATH = join(__dirname, 'data', 'config.json');
const BACKUPS_DIR = join(__dirname, 'data', 'backups');
const ICONS_CACHE_DIR = join(__dirname, 'data', 'icons');
const NOTIFICATIONS_PATH = join(__dirname, 'data', 'notifications.json');

// Single server-side ntfy subscription shared by all dashboard clients.
const notificationManager = new NotificationManager(NOTIFICATIONS_PATH);

// In-memory config cache. The config file is read once at startup, then
// served from memory; PUT updates both the file and the cache atomically.
// Polling clients (every syncInterval) compare against `cache.mtimeMs`
// without touching the filesystem, which is the dominant request shape.
const configCache = {
  config: null,        // parsed object
  mtimeMs: 0,          // last known mtime in milliseconds
  serialized: null,    // pre-serialised JSON body (response payload)
};

async function refreshConfigCache() {
  try {
    const [raw, stats] = await Promise.all([
      readFile(CONFIG_PATH, 'utf-8'),
      stat(CONFIG_PATH),
    ]);
    configCache.config = JSON.parse(raw);
    configCache.mtimeMs = stats.mtimeMs;
    configCache.serialized = raw;
  } catch (e) {
    // Leave previous cache state in place on failure.
    console.error('Failed to refresh config cache:', e.message);
  }
}

// Track file modification time for change detection (mirrors cache for
// any code paths still using it directly).
let lastModified = 0;

app.use(cors());
// gzip text-ish responses. The default filter skips images / already
// compressed payloads, so the cached-icons /icons static mount is
// unaffected. Server-Sent Events must never be buffered/compressed, so the
// /api/notifications/stream response (Content-Type: text/event-stream) is
// explicitly excluded.
app.use(compression({
  filter: (req, res) => {
    if (res.getHeader('Content-Type') === 'text/event-stream') return false;
    return compression.filter(req, res);
  },
}));
app.use(express.json({ limit: '10mb' }));

// CSRF defence-in-depth: SameSite=Lax on the session cookie blocks cross-site
// form posts; the X-Requested-With check below blocks the remaining
// state-changing paths from third-party origins.
app.use(csrfGuard);
// Populate req.authenticated for every request so route handlers can render
// public/redacted vs. admin responses uniformly. Does NOT reject anyone.
app.use(optionalAuth);

// Auth endpoints (/api/auth/status, /api/auth/login, /api/auth/logout).
registerAuthRoutes(app);

// Ensure data directory exists (with error handling for disk space issues)
try {
  mkdirSync(join(__dirname, 'data'), { recursive: true });
  mkdirSync(BACKUPS_DIR, { recursive: true });
  mkdirSync(ICONS_CACHE_DIR, { recursive: true });
  mkdirSync(SHARED_FILES_DIR, { recursive: true });
} catch (error) {
  console.error('Warning: Could not create data directories:', error.message);
  // Continue anyway - the app can still work without icon caching
}

// Default config
const defaultConfig = {
  services: [],
  collapsedCategories: [],
  gridColumns: "3",
  theme: "dark",
  settings: {
    timezone: "UTC",
    customCSS: "",
    autoSync: true,
    syncInterval: 30000
  },
  metadata: {
    version: "1.0.0",
    lastModified: new Date().toISOString(),
    backupEnabled: true,
    lastBackup: new Date().toISOString(),
    backupCadenceMinutes: 60,
    configHash: ""
  },
  categoryOrder: [],
  clips: [],
  colors: {
    primary: "#6366f1",
    secondary: "#475569",
    background: "#0a0a0a",
    surface: "#1a1a1a",
    textPrimary: "#ffffff",
    textSecondary: "#a1a1aa",
    border: "#27272a",
    accent: "#8b5cf6",
    success: "#22c55e",
    warning: "#eab308",
    error: "#f87171"
  }
};

// Initialize config file if it doesn't exist
if (!existsSync(CONFIG_PATH)) {
  writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
  console.log('Created default config.json');
}

// Update last modified time
function updateLastModified() {
  try {
    const stats = statSync(CONFIG_PATH);
    lastModified = stats.mtimeMs;
    configCache.mtimeMs = stats.mtimeMs;
  } catch (e) {
    lastModified = 0;
  }
}
updateLastModified();
// Prime the in-memory cache (best effort; route handlers will refresh
// on demand if this fails for any reason).
refreshConfigCache();

// Start the server-side ntfy subscription: load any persisted history, then
// apply the current notifications config. Runs independently of any browser,
// so messages are captured even when no dashboard tab is open.
(async () => {
  await notificationManager.load();
  if (configCache.config === null) await refreshConfigCache();
  notificationManager.reconfigure(configCache.config?.notifications);
})();

// GET /api/config - Read config (served from in-memory cache when fresh).
// Anonymous viewers receive a redacted projection that omits secrets and
// admin-only sections (notifications, servers, clips, restore metadata).
// Admin sessions receive the full document.
app.get('/api/config', async (req, res) => {
  try {
    const stats = await stat(CONFIG_PATH);
    if (configCache.config === null || stats.mtimeMs !== configCache.mtimeMs) {
      await refreshConfigCache();
    }
    const payload = req.authenticated
      ? configCache.config
      : redactConfigForPublic(configCache.config);
    res.json({
      config: payload,
      lastModified: configCache.mtimeMs,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read config' });
  }
});

// PUT /api/config - Write config (admin only). Missing private sections in
// the incoming body are preserved from the on-disk config so a save from a
// browser that loaded the redacted view never silently clears secrets.
app.put('/api/config', requireAuth, async (req, res) => {
  try {
    if (configCache.config === null) await refreshConfigCache();
    const incoming = req.body || {};
    const merged = mergePrivateSections(incoming, configCache.config || {});
    const config = {
      ...merged,
      metadata: {
        ...(merged.metadata || {}),
        lastModified: new Date().toISOString()
      }
    };
    const serialized = JSON.stringify(config, null, 2);
    await writeFile(CONFIG_PATH, serialized);
    const stats = await stat(CONFIG_PATH);
    lastModified = stats.mtimeMs;
    configCache.config = config;
    configCache.mtimeMs = stats.mtimeMs;
    configCache.serialized = serialized;
    // Re-apply notifications config (no-op unless a connection-relevant field
    // actually changed, so routine saves don't drop the upstream stream).
    notificationManager.reconfigure(config.notifications);
    res.json({ success: true, lastModified });
  } catch (error) {
    res.status(500).json({ error: 'Failed to write config' });
  }
});

// GET /api/config/check - Check if config changed (cheap stat-only path)
app.get('/api/config/check', async (req, res) => {
  try {
    const clientLastModified = parseFloat(req.query.since) || 0;
    const stats = await stat(CONFIG_PATH);
    const changed = stats.mtimeMs > clientLastModified;
    res.json({ changed, lastModified: stats.mtimeMs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check config' });
  }
});

// GET /api/backups - List backups (admin)
app.get('/api/backups', requireAuth, (req, res) => {
  try {
    const files = readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const filePath = join(BACKUPS_DIR, f);
        const stats = statSync(filePath);
        const data = JSON.parse(readFileSync(filePath, 'utf-8'));
        return {
          name: f.replace('.json', ''),
          date: stats.mtime.toISOString(),
          filename: f,
          serviceCount: data.services?.length || 0
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(files);
  } catch (error) {
    res.json([]);
  }
});

// POST /api/backups - Create backup (admin)
app.post('/api/backups', requireAuth, (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = req.body.name || `backup-${timestamp}`;
    const filename = `${name.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`;
    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    writeFileSync(join(BACKUPS_DIR, filename), JSON.stringify(config, null, 2));
    res.json({ success: true, filename });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// Resolve a user-supplied backup filename to an absolute path inside
// BACKUPS_DIR. Returns null if the resolved path escapes the directory
// (path traversal guard) or if the filename is otherwise invalid.
function resolveBackupPath(rawName) {
  if (typeof rawName !== 'string' || !rawName) return null;
  // Reject anything that isn't a plain filename — no slashes, no ..
  const name = basename(rawName);
  if (name !== rawName) return null;
  if (name === '.' || name === '..') return null;
  if (!name.endsWith('.json')) return null;
  const resolved = resolve(join(BACKUPS_DIR, name));
  const base = resolve(BACKUPS_DIR);
  if (!resolved.startsWith(base + sep)) return null;
  return resolved;
}

// POST /api/backups/restore/:filename - Restore backup (admin)
app.post('/api/backups/restore/:filename', requireAuth, (req, res) => {
  try {
    const backupPath = resolveBackupPath(req.params.filename);
    if (!backupPath) return res.status(400).json({ error: 'Invalid filename' });
    if (!existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    const backup = readFileSync(backupPath, 'utf-8');
    writeFileSync(CONFIG_PATH, backup);
    updateLastModified();
    refreshConfigCache().then(() => {
      notificationManager.reconfigure(configCache.config?.notifications);
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// DELETE /api/backups/:filename - Delete backup (admin)
app.delete('/api/backups/:filename', requireAuth, (req, res) => {
  try {
    const backupPath = resolveBackupPath(req.params.filename);
    if (!backupPath) return res.status(400).json({ error: 'Invalid filename' });
    if (existsSync(backupPath)) {
      unlinkSync(backupPath);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete backup' });
  }
});

// Serve uploaded icons
app.use('/uploads', express.static(join(__dirname, 'data', 'uploads')));

// Serve cached icons
app.use('/icons', express.static(ICONS_CACHE_DIR));

// GET /api/icons/proxy - Proxy and cache external icon (admin: outbound
// fetcher = SSRF vector, so it must not be reachable anonymously)
app.get('/api/icons/proxy', requireAuth, async (req, res) => {
  try {
    const iconUrl = req.query.url;
    if (!iconUrl) {
      return res.status(400).json({ error: 'URL parameter required' });
    }

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(iconUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Create a hash of the URL for the filename
    const urlHash = crypto.createHash('md5').update(iconUrl).digest('hex');
    
    // Try to determine extension from URL
    let ext = extname(parsedUrl.pathname).toLowerCase();
    if (!ext || !['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp'].includes(ext)) {
      ext = '.png'; // Default to png
    }
    
    const cachedFilename = `${urlHash}${ext}`;
    const cachedPath = join(ICONS_CACHE_DIR, cachedFilename);

    // Check if already cached
    if (existsSync(cachedPath)) {
      return res.json({ 
        cached: true, 
        url: `/icons/${cachedFilename}` 
      });
    }

    // Fetch the icon with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    let response;
    try {
      response = await fetch(iconUrl, {
        headers: {
          'User-Agent': 'HomeDash/1.0',
          'Accept': 'image/*'
        },
        signal: controller.signal
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      console.error('Icon fetch error:', fetchError.message);
      // Return original URL as fallback - let client try directly
      return res.json({ 
        cached: false, 
        url: iconUrl,
        fallback: true 
      });
    }
    clearTimeout(timeout);

    if (!response.ok) {
      // Return original URL as fallback
      return res.json({ 
        cached: false, 
        url: iconUrl,
        fallback: true 
      });
    }

    // Get content type and adjust extension if needed
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('svg')) {
      ext = '.svg';
    } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
      ext = '.jpg';
    } else if (contentType.includes('gif')) {
      ext = '.gif';
    } else if (contentType.includes('webp')) {
      ext = '.webp';
    } else if (contentType.includes('ico') || contentType.includes('x-icon')) {
      ext = '.ico';
    }

    const finalFilename = `${urlHash}${ext}`;
    const finalPath = join(ICONS_CACHE_DIR, finalFilename);

    // Save to cache
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(finalPath, buffer);

    res.json({ 
      cached: false, 
      url: `/icons/${finalFilename}` 
    });
  } catch (error) {
    console.error('Icon proxy error:', error.message);
    // Return original URL as fallback instead of error
    const iconUrl = req.query.url;
    res.json({ 
      cached: false, 
      url: iconUrl,
      fallback: true,
      error: error.message 
    });
  }
});

// GET /api/icons/cache-info - Get cache statistics (admin)
app.get('/api/icons/cache-info', requireAuth, (req, res) => {
  try {
    const files = readdirSync(ICONS_CACHE_DIR);
    let totalSize = 0;
    
    files.forEach(file => {
      const stats = statSync(join(ICONS_CACHE_DIR, file));
      totalSize += stats.size;
    });

    res.json({
      count: files.length,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize)
    });
  } catch (error) {
    res.json({ count: 0, totalSize: 0, totalSizeFormatted: '0 B' });
  }
});

// DELETE /api/icons/cache - Clear icon cache (admin)
app.delete('/api/icons/cache', requireAuth, (req, res) => {
  try {
    const files = readdirSync(ICONS_CACHE_DIR);
    let deletedCount = 0;

    files.forEach(file => {
      try {
        unlinkSync(join(ICONS_CACHE_DIR, file));
        deletedCount++;
      } catch (e) {
        console.error(`Failed to delete ${file}:`, e.message);
      }
    });

    res.json({ success: true, deletedCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ---------------------------------------------------------------------------
// Server stats — report live metrics for the host machine HomeDash runs on,
// gathered entirely from Node built-ins (os / fs). No external dependencies
// and no SSH; this surfaces the homelab box's own CPU, memory, disk, uptime
// and system info (mirroring Termix's "Server Stats" view).
// ---------------------------------------------------------------------------

// Aggregate idle/total CPU jiffies across all cores.
function cpuTimesSnapshot() {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    for (const value of Object.values(cpu.times)) total += value;
    idle += cpu.times.idle;
  }
  return { idle, total };
}

// Sample CPU usage over a short window. os.loadavg() is unavailable/zero on
// some platforms (Windows), so we derive instantaneous usage from two
// snapshots of per-core busy time.
function sampleCpuUsage(windowMs = 150) {
  return new Promise((resolve) => {
    const start = cpuTimesSnapshot();
    setTimeout(() => {
      const end = cpuTimesSnapshot();
      const idleDelta = end.idle - start.idle;
      const totalDelta = end.total - start.total;
      const usage = totalDelta > 0 ? 1 - idleDelta / totalDelta : 0;
      resolve(Math.max(0, Math.min(1, usage)));
    }, windowMs);
  });
}

// Disk usage for the filesystem hosting the app. statfsSync is available in
// Node 18.15+/20; guarded so an unsupported platform degrades to nulls.
function getDiskStats() {
  try {
    const target = process.platform === 'win32'
      ? `${process.cwd().split(sep)[0]}${sep}`
      : '/';
    const s = statfsSync(target);
    const total = s.blocks * s.bsize;
    const free = s.bavail * s.bsize;
    const used = total - free;
    return {
      total,
      used,
      free,
      percent: total > 0 ? Math.round((used / total) * 1000) / 10 : null,
    };
  } catch {
    return { total: null, used: null, free: null, percent: null };
  }
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (!parts.length) parts.push(`${Math.floor(seconds)}s`);
  return parts.join(' ');
}

// GET /api/stats - Live host metrics (CPU, memory, disk, uptime, system).
// Admin only: leaks hostname/OS/kernel/load + reachable container list.
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const cpuUsage = await sampleCpuUsage(150);
    const cpus = os.cpus();
    const load = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const uptime = os.uptime();

    res.json({
      cpu: {
        percent: Math.round(cpuUsage * 1000) / 10,
        cores: cpus.length,
        model: cpus[0]?.model?.trim() || null,
        load: { '1m': load[0], '5m': load[1], '15m': load[2] },
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        percent: totalMem > 0 ? Math.round((usedMem / totalMem) * 1000) / 10 : null,
      },
      disk: getDiskStats(),
      uptime: {
        seconds: Math.floor(uptime),
        formatted: formatUptime(uptime),
      },
      system: {
        hostname: os.hostname(),
        platform: process.platform,
        arch: process.arch,
        release: os.release(),
        type: os.type(),
        nodeVersion: process.version,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Stats error:', error.message);
    res.status(500).json({ error: 'Failed to collect server stats' });
  }
});

// Parse a Glances uptime string (e.g. "7 days, 3:59:51" or "3:59:51") into
// seconds + keep the human-readable string for display.
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

// Pick the most relevant filesystem from the Glances fs list: prefer root "/",
// otherwise the largest mounted filesystem.
function pickRootFs(fsList) {
  if (!Array.isArray(fsList) || fsList.length === 0) return {};
  const root = fsList.find(f => f && f.mnt_point === '/');
  if (root) return root;
  return fsList.slice().sort((a, b) => (b.size || 0) - (a.size || 0))[0] || {};
}

const round1 = n => (typeof n === 'number' ? Math.round(n * 10) / 10 : null);

// Transform a Glances `/api/4/all` payload into the ServerStats shape used by the
// frontend, adding a `containers` array (Docker/Podman) and `source: 'glances'`.
function normalizeGlances(all) {
  const cpu = all.cpu || {};
  const core = all.core || {};
  const mem = all.mem || {};
  const load = all.load || {};
  const sys = all.system || {};
  const quick = all.quicklook || {};
  const fs = pickRootFs(all.fs);
  const uptime = parseGlancesUptime(all.uptime);
  // Glances v4 returns a flat container list; v3's /all nests it under
  // { version, version_podman, containers: [...] }.
  const containers = Array.isArray(all.containers)
    ? all.containers
    : (Array.isArray(all.containers?.containers) ? all.containers.containers : []);

  return {
    cpu: {
      percent: round1(cpu.total),
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
      free: mem.free ?? null,
      percent: round1(mem.percent),
    },
    disk: {
      total: fs.size ?? null,
      used: fs.used ?? null,
      free: fs.free ?? null,
      percent: round1(fs.percent),
    },
    uptime,
    system: {
      hostname: sys.hostname || 'unknown',
      platform: sys.os_name || 'unknown',
      arch: sys.platform || '',
      release: sys.os_version || '',
      type: sys.os_name || '',
      distro: sys.linux_distro || sys.hr_name || '',
      glancesVersion: typeof all.version === 'string' ? all.version : undefined,
    },
    containers: containers.map(c => {
      const image = c.image ?? c.Image;
      const mem = c.memory || {};
      return {
        name: c.name || '—',
        image: Array.isArray(image) ? image.join(', ') : (image || ''),
        status: c.status || c.Status || '',
        cpuPercent: round1(typeof c.cpu_percent === 'number' ? c.cpu_percent : c.cpu?.total),
        memoryUsage: typeof c.memory_usage === 'number' ? c.memory_usage
          : (typeof mem.usage === 'number' ? mem.usage : null),
        memoryLimit: typeof c.memory_limit === 'number' ? c.memory_limit
          : (typeof mem.limit === 'number' ? mem.limit : null),
        uptime: c.uptime || c.Uptime || null,
        engine: c.engine || null,
      };
    }),
    source: 'glances',
    timestamp: Date.now(),
  };
}

// GET /api/stats/remote?url=<glancesBase> - Proxy + normalize stats from a Glances
// instance (REST API on port 61208). The browser can't reach private-network hosts
// directly (CORS / mixed content), so the server fetches `${base}/api/4/all` on its
// behalf and maps the response into the ServerStats shape (incl. Docker containers).
// Supports password-protected instances via HTTP Basic auth: credentials may be sent
// in the `x-glances-username` / `x-glances-password` headers or embedded in the URL
// (http://user:pass@host). Falls back to the Glances v3 API for older instances.
// Admin only: this is an open outbound proxy (SSRF) and forwards Basic-auth creds.
app.get('/api/stats/remote', requireAuth, async (req, res) => {
  const raw = req.query.url;
  if (!raw || typeof raw !== 'string') {
    return res.status(400).json({ error: 'url parameter required' });
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only http/https URLs are supported' });
  }

  // Basic auth credentials: prefer dedicated headers, fall back to URL userinfo.
  const username = (req.get('x-glances-username') || decodeURIComponent(parsed.username) || '').trim();
  const password = req.get('x-glances-password') ?? decodeURIComponent(parsed.password);
  const reqHeaders = { Accept: 'application/json', 'User-Agent': 'HomeDash/1.0' };
  if (username) {
    reqHeaders.Authorization = 'Basic ' + Buffer.from(`${username}:${password || ''}`).toString('base64');
  }

  // Rebuild the base from host only (drops any userinfo) so credentials never leak
  // into the request path / logs.
  const base = `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`;
  const targets = /\/api\/\d+$/.test(base)
    ? [`${base}/all`]
    : [`${base}/api/4/all`, `${base}/api/3/all`];

  let lastError = 'Unable to reach remote server';
  for (const target of targets) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(target, { headers: reqHeaders, signal: controller.signal });
      clearTimeout(timeout);
      if (response.status === 404) {
        lastError = 'Glances API not found (is Glances web server running?)';
        continue; // try the next API version
      }
      if (response.status === 401) {
        return res.status(502).json({ error: 'Authentication required or invalid credentials (HTTP 401)' });
      }
      if (!response.ok) {
        return res.status(502).json({ error: `Glances responded with ${response.status}` });
      }
      const data = await response.json();
      return res.json(normalizeGlances(data));
    } catch (error) {
      clearTimeout(timeout);
      lastError = error.name === 'AbortError' ? 'Request timed out' : 'Unable to reach Glances instance';
    }
  }
  res.status(502).json({ error: lastError });
});

// Resolve a URL sub-path (relative to /api/files) to a real filesystem path.
// Returns null if the resolved path escapes SHARED_FILES_DIR (path traversal guard).
function resolveSharedPath(urlSubPath) {
  // Express does not URL-decode req.path, so filenames with spaces or other
  // special characters arrive percent-encoded (e.g. "%20"). Decode each segment
  // before touching the filesystem. The traversal guard below still catches any
  // "../" that decoding might reveal.
  let decoded;
  try {
    decoded = urlSubPath
      .split('/')
      .map(seg => (seg ? decodeURIComponent(seg) : seg))
      .join('/');
  } catch {
    return null; // malformed percent-encoding
  }
  // The UI prefixes paths with '/shared' (the virtual root name) — strip it.
  // Use a lookahead so that only the segment '/shared' is stripped, not '/sharedsomething'.
  const local = decoded.replace(/^\/shared(?=\/|$)/, '') || '/';
  const resolved = resolve(join(SHARED_FILES_DIR, local));
  const base = resolve(SHARED_FILES_DIR);
  if (resolved !== base && !resolved.startsWith(base + sep)) return null;
  return resolved;
}

// GET /api/files/* - list directory (?ls) or download file
// Admin only in Phase 1; Phase 3 will introduce public/private scopes.
app.get('/api/files{/*path}', requireAuth, (req, res) => {
  const subPath = req.path.slice('/api/files'.length) || '/';
  const fsPath = resolveSharedPath(subPath);
  if (!fsPath) return res.status(403).json({ error: 'Forbidden' });

  try {
    if (!existsSync(fsPath)) return res.status(404).json({ error: 'Not found' });
    const stat = statSync(fsPath);

    if (stat.isDirectory()) {
      const entries = readdirSync(fsPath, { withFileTypes: true });
      const dirs = [], files = [];
      for (const entry of entries) {
        try {
          const s = statSync(join(fsPath, entry.name));
          const ts = Math.floor(s.mtimeMs / 1000);
          if (entry.isDirectory()) {
            dirs.push({ n: entry.name, ts });
          } else if (entry.isFile()) {
            files.push({ n: entry.name, sz: s.size, ts, ext: extname(entry.name).slice(1) });
          }
        } catch { /* skip unreadable entries */ }
      }
      return res.json({ dirs, files, path: subPath });
    } else {
      // File download — escape backslash and double-quote in the filename to
      // prevent Content-Disposition header injection (RFC 6266).
      const safeName = basename(fsPath).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
      res.setHeader('Content-Length', String(stat.size));
      createReadStream(fsPath).pipe(res);
    }
  } catch (err) {
    console.error('File server error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/files/* - upload a file (admin)
app.put('/api/files{/*path}', requireAuth, (req, res) => {
  const subPath = req.path.slice('/api/files'.length) || '/';
  if (subPath.endsWith('/')) return res.status(400).json({ error: 'Path must point to a file' });
  const fsPath = resolveSharedPath(subPath);
  if (!fsPath) return res.status(403).json({ error: 'Forbidden' });

  try {
    mkdirSync(dirname(fsPath), { recursive: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create directory' });
  }

  const ws = createWriteStream(fsPath);
  req.pipe(ws);
  ws.on('finish', () => res.json({ success: true }));
  ws.on('error', (err) => {
    console.error('Upload error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Upload failed' });
  });
  req.on('error', (err) => {
    console.error('Request error during upload:', err.message);
    ws.destroy();
    if (!res.headersSent) res.status(500).json({ error: 'Upload failed' });
  });
});

// DELETE /api/files/* - delete a file or directory (admin)
app.delete('/api/files{/*path}', requireAuth, (req, res) => {
  const subPath = req.path.slice('/api/files'.length) || '/';
  const fsPath = resolveSharedPath(subPath);
  if (!fsPath) return res.status(403).json({ error: 'Forbidden' });

  // Protect the root shared directory itself
  if (resolve(fsPath) === resolve(SHARED_FILES_DIR)) {
    return res.status(403).json({ error: 'Cannot delete root directory' });
  }

  try {
    if (!existsSync(fsPath)) return res.status(404).json({ error: 'Not found' });
    const stat = statSync(fsPath);
    if (stat.isDirectory()) {
      rmSync(fsPath, { recursive: true, force: true });
    } else {
      unlinkSync(fsPath);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err.message);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ---------------------------------------------------------------------------
// Notifications (ntfy) — the upstream subscription lives in the
// NotificationManager (server-side). Browsers read history here and receive
// live updates over a same-origin SSE stream, so ntfy credentials never reach
// the client and messages are captured even with no tab open.
// ---------------------------------------------------------------------------

// GET /api/notifications - current history + connection status (admin)
app.get('/api/notifications', requireAuth, (req, res) => {
  res.json(notificationManager.getState());
});

// GET /api/notifications/count - public unread count + connection state.
// Used by the always-visible header bell so anonymous viewers can see "there
// are pending alerts" without exposing message content. Reads lastReadAt
// from the server-side config so the count reflects the admin's most recent
// panel visit (same value the authenticated panel uses).
app.get('/api/notifications/count', (req, res) => {
  const lastReadAt = configCache.config?.notifications?.lastReadAt ?? 0;
  res.json(notificationManager.getCount(lastReadAt));
});

// GET /api/notifications/stream - Server-Sent Events: live messages + status (admin)
app.get('/api/notifications/stream', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering (nginx)
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  notificationManager.addClient(res);

  // Comment heartbeat keeps idle connections (and proxies) from timing out.
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* client gone */ }
  }, 25000);
  req.on('close', () => clearInterval(heartbeat));
});

// POST /api/notifications/test - server-side connectivity check (admin)
app.post('/api/notifications/test', requireAuth, async (req, res) => {
  try {
    await notificationManager.test(req.body || {});
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'AUTH') {
      return res.status(401).json({ error: 'Authentication failed' });
    }
    res.status(502).json({ error: err.message || 'Connection failed' });
  }
});

// POST /api/notifications/dismiss - dismiss one ({ id }), a whole topic
// ({ topic }), or all ({ all: true }) — admin
app.post('/api/notifications/dismiss', requireAuth, (req, res) => {
  const { id, all, topic } = req.body || {};
  if (all) {
    notificationManager.clear();
    return res.json({ success: true });
  }
  if (topic) {
    notificationManager.clear(topic);
    return res.json({ success: true });
  }
  if (!id) return res.status(400).json({ error: 'id required' });
  notificationManager.dismiss(id);
  res.json({ success: true });
});

// Serve static files in production
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

// POST /api/upload-icon - Upload icon file (admin)
app.post('/api/upload-icon', requireAuth, express.raw({ type: 'image/*', limit: '5mb' }), (req, res) => {
  try {
    const uploadsDir = join(__dirname, 'data', 'uploads');
    mkdirSync(uploadsDir, { recursive: true });
    
    // Sanitize filename to prevent path traversal attacks
    const rawName = String(req.query.name || 'icon.png');
    const safeName = basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${Date.now()}-${safeName || 'icon.png'}`;
    writeFileSync(join(uploadsDir, filename), req.body);
    res.json({ url: `/uploads/${filename}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload icon' });
  }
});

// SPA fallback - serve index.html for all non-API routes
if (existsSync(distPath)) {
  app.get('/{*splat}', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n🚀 Config API server running on http://localhost:${PORT}`);
  console.log(`📁 Config file: ${CONFIG_PATH}`);
  console.log(`💾 Backups dir: ${BACKUPS_DIR}`);
  console.log(authStartupLogLine());
  console.log('');
});
