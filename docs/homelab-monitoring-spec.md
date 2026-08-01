# Home Lab Monitoring Page (`/monitor`) — Technical Specification

Status: Draft
Author: —
Last updated: 2026-08-01

---

## 1. Summary

Add a full-screen, glanceable home lab monitoring page served at the `/monitor`
subpath. The page aggregates three data sources that HomeDash already knows how
to talk to, plus a new alerting layer:

| Source | Data | Existing support |
|---|---|---|
| Glances (REST API, port 61208) | CPU, memory, disk, load, uptime, network, container list per host | `GET /api/stats/remote` proxy + `normalizeGlances()` in `server.js` |
| Solar Assistant | PV power, battery state of charge, grid import/export, load, multi-inverter and multi-battery support | `GET /api/inverter/metrics` proxy in `server.js` |
| Docker | Container count (running/total), health status, restarting/unhealthy containers | Partial: container list arrives via Glances; direct socket access is new |
| Emby / Jellyfin | Active streams: user, title, device, progress, direct-play vs transcode | New: `GET {base}/Sessions` proxy (shared API shape) |
| SABnzbd / NZBGet | Active downloads: queue, speed, ETA, per-item progress, paused state | New: SABnzbd queue API + NZBGet JSON-RPC proxy |

Media and usenet sources live on a second **Media & Downloads** tab with
automatic tab rotation for kiosk displays (see §4).

Alerts are evaluated **server-side** against configurable threshold rules,
surfaced on the page (banner + alerts rail), and optionally forwarded to the
existing ntfy notification pipeline.

The page is designed for wall-mounted / kiosk displays: dark theme, no chrome,
auto-refresh, readable at 2 m.

---

## 2. Goals and non-goals

### Goals
- Single URL (`/monitor`) that renders a full-screen status board with no
  interaction required.
- N Glances hosts shown as metric cards (CPU / mem / disk / load / uptime /
  network), with per-source reachability status.
- Solar summary card (PV generation, battery SOC, grid, house load, battery
  runtime) reusing the existing Solar Assistant proxy.
- Docker summary card: running/total container count, unhealthy count,
  restarting count, and a short list of problem containers.
- Server-side alert rules with severity, debounce (must breach for N seconds),
  firing/resolved lifecycle, and optional ntfy forwarding.
- Media tab: active Emby/Jellyfin streams (who/what/where, progress,
  direct-play vs transcode) and SABnzbd/NZBGet queues (speed, ETA, per-item
  progress), presented on an auto-rotating tab for kiosk displays.
- Works with existing auth: page requires a session when auth is enabled.

### Non-goals (v1)
- Historical time-series storage or graphs (no InfluxDB/Prometheus). At most,
  in-memory ring buffers for sparklines (phase 3).
- Alert silencing/schedules, on-call rotation, or escalation chains.
- Playback control, library browsing, or download management (pause/resume
  buttons are v2+; v1 is read-only visibility).
- Log-based alerting.
- Editing monitoring config from the UI (config file only in v1; UI editor is
  a follow-up).
- Mobile-specific layout (responsive down to desktop-ish widths only).

---

## 3. Current state (building blocks)

Everything below already exists and is reused, not rebuilt:

- `server.js`
  - `GET /api/stats/remote?url=…` — authenticated Glances proxy with Basic-auth
    forwarding, 8 s timeout, v3/v4 API fallback. `normalizeGlances()` returns
    `{ cpu, memory, disk, uptime, system, containers[], source: 'glances' }`.
    Each container has `name, image, status, cpuPercent, memoryUsage,
    memoryLimit, uptime, engine`.
  - `GET /api/inverter/metrics` — authenticated Solar Assistant proxy;
    `normalizeInverter()` produces totals + per-device metrics including
    `overview.batteryRuntime`.
  - `NotificationManager` (`notifications.js`) — ntfy subscription/publish,
    SSE stream at `/api/notifications/stream`, persistence in
    `data/notifications.json`.
  - SPA fallback: in production, unknown non-API paths serve `dist/index.html`
    (lines ~1495–1521), so `/monitor` deep-links already work.
- Frontend
  - No router; `src/main.tsx` mounts `App`. Vite dev server serves
    `index.html` for `/monitor` automatically (SPA mode).
  - Theme system: CSS variables `--color-*` driven by `themes.ts` presets and
    `DashboardContext`; `ServerStats` and `InverterPanel` demonstrate the
    polling + stat-bar idioms used by this page.
  - `types.ts` holds `RemoteServer`, `InverterServer`, `NotificationsConfig`.

### Gap analysis
1. No aggregation endpoint: the browser currently polls each source
   individually. A wall display needs one snapshot endpoint.
2. No routing: the app is single-view (modals). `/monitor` needs a separate
   root render.
3. No alert evaluation anywhere in the stack.
5. No media server (Emby/Jellyfin) or usenet downloader (SABnzbd/NZBGet)
   visibility anywhere in the app.
4. Docker health is only incidentally available via Glances' container status
   strings; there is no first-class health model.

---

## 4. UX overview

Mockup: [docs/mockups/monitor.html](mockups/monitor.html) (static, open in a
browser; toggle between "normal" and "alerting" states in the top-right).

Layout (≥1600 px target, scales down gracefully):

```
┌──────────────────────────────────────────────────────────────────────┐
│ ▣ HomeLab Monitor   ● ALL SYSTEMS NORMAL      🔔 0   14:32:08  ↻ 3s │
├──────────────────────────────────────────────────────────────────────┤
│ ▲ CRITICAL: pve-01 unreachable for 2m  ·  WARNING: 1 container …     │  ← only when firing
├──────────────────────────────────────────────────────────────────────┤
│ [⬡ Infrastructure ●]  [🎬 Media & Downloads]            ⟳ rotate 8s  │
├────────────────────────────┬─────────────────────┬───────────────────┤
│ pve-01          ● ok       │  SOLAR              │  ALERTS        🔔3 │
│ CPU  ▓▓▓░░ 42%            │  PV      3.42 kW    │  ● crit  pve-01 …  │
│ MEM  ▓▓▓▓░ 68%            │  Battery  78% ▲ chg │  ● warn  nextcloud…│
│ DISK ▓▓▓▓ 71%  4.2T/6T    │  Grid    -0.31 kW   │  ● warn  pve-02 …  │
│ Load 1.9 2.1 2.0  Up 12d  │  Load     1.10 kW   │  ─ resolved ─      │
│ Net  ↓ 84 MB/s ↑ 12 MB/s  │  Runtime  6h 40m    │  ✓ disk latency …  │
├────────────────────────────┼─────────────────────┤  ✓ high cpu …      │
│ pve-02          ● ok       │  DOCKER             │                   │
│ …                          │  ▢ 23/25 running    │                   │
├────────────────────────────┤  ⚠ 1 unhealthy      │                   │
│ nas-01          ▲ degraded │  ↻ 1 restarting     │                   │
│ …                          │  nextcloud  unhlthy │                   │
└────────────────────────────┴─────────────────────┴───────────────────┘
```

Behaviour:
- Polls `GET /api/monitor/overview` every 5 s (configurable 2–30 s).
- Global status pill: `ok` (all sources fine, no firing alerts) → `degraded`
  (warnings firing or a non-critical source down) → `critical`.
- Critical alerts pin a banner strip under the header (pulse animation).
- Values colour-shift: warn ≥ warning threshold, crit ≥ critical threshold
  (same idiom as `barColor()` in `ServerStats.tsx`).
- Kiosk polish (phase 4): hide cursor after 5 s idle, `?theme=` override,
  auto-reload on config hash change.

### Tabs and auto-rotation

Two tabs share the page: **Infrastructure** (the grid above) and **Media &
Downloads** (active streams + usenet queues). The tab strip sits directly
under the alert banner so it is visible in every state, and shows a countdown
ring for the auto-rotation.

- Tabs rotate every `monitoring.ui.tabRotationSeconds` (default 15 s,
  `0` disables rotation entirely).
- A manual tab switch pauses rotation for 60 s; the countdown ring shows
  "paused · resumes in Ns" and then resumes automatically — kiosk operators
  can glance at one tab without it yanking away.
- `?tab=media` deep-links a specific tab (used by the header shortcut and
  bookmarkable kiosk configs).
- The header, alert banner, and global status pill are shared across tabs;
  only the content grid swaps. A critical alert therefore stays visible
  regardless of which tab is showing.

---

## 5. Architecture

### 5.1 Routing

Add a pathname branch in `src/main.tsx` — no `react-router` dependency:

```ts
const isMonitor = window.location.pathname.replace(/\/+$/, '').endsWith('/monitor');
createRoot(...).render(<StrictMode>{isMonitor ? <MonitorApp /> : <App />}</StrictMode>);
```

- Dev: Vite SPA fallback serves `index.html` for `/monitor`.
- Prod: existing `express.static(dist)` + catch-all `sendFile(index.html)`
  in `server.js` covers it. No server routing change needed.
- A "Monitor" header button (icon `MonitorGauge` / `Activity`) is added to the
  main dashboard linking to `/monitor` (new tab). Phase 3 may add it to the
  PWA manifest shortcuts.

### 5.2 Backend: new `monitor.js` module

Keep `server.js` slim by extracting monitoring into `monitor.js` (same pattern
as `notifications.js`, `auth.js`).

#### Background poller (the key decision)

A single server-side poller fetches all sources on a fixed cadence
(default 10 s, `monitoring.pollIntervalSeconds`) and caches the latest
snapshot. `GET /api/monitor/overview` serves the cached snapshot in O(1).

Why not fan-out per request: wall displays and multiple operators would
multiply load against Glances/Solar Assistant, and a slow source would make
every client wait. A warm cache also means alerts evaluate against one
consistent snapshot, not per-client views.

```
┌────────────┐   every 10s   ┌──────────────────────────────┐
│  Poller    │──────────────▶│ fan-out (Promise.allSettled) │
└────────────┘               │  • glances hosts ×N          │
                             │  • solar assistant           │
                             │  • docker (via glances|sock) │
                             └──────────────┬───────────────┘
                                            ▼
                              normalise → snapshot cache ──▶ /api/monitor/overview
                                            ▼
                                     alert engine ──▶ ntfy (optional)
```

#### Endpoints (all `requireAuth` except `/healthz`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/monitor/overview` | Latest aggregated snapshot (see 5.3). Query `?wait=1` long-polls up to one poll cycle for fresher data. |
| GET | `/api/monitor/alerts` | Active + recently resolved alerts (ring buffer, default 100). |
| POST | `/api/monitor/alerts/:id/ack` | Acknowledge a firing alert (stays visible, stops re-notifying). |
| GET | `/api/monitor/healthz` | Anonymous-safe liveness for the monitor module itself (poll loop alive, last cycle duration). |

SSRF posture matches the existing Glances proxy: target URLs come only from
server-side config (`monitoring.glancesHosts`), never from query parameters,
so the new endpoint is **not** an open proxy — strictly safer than
`/api/stats/remote`.

#### Docker data strategy

- **v1 (default):** derive Docker summary from each Glances host's
  `containers[]` (already proxied and normalised). Health is parsed from the
  Docker status string Glances passes through (`Up 2 hours (healthy)` →
  `healthy`; `(unhealthy)` → `unhealthy`; `Restarting` → `restarting`).
  Zero new dependencies; works wherever Glances' docker plugin is enabled.
- **v1.1 (optional, per host):** direct Docker Engine API via mounted socket
  (`/var/run/docker.sock`) or TCP, using raw HTTP over `undici`/`net` (no
  `dockerode` dependency needed — `GET /containers/json?all=1` and
  `GET /containers/{id}/json` are sufficient). Selected when the host entry
  sets `dockerSocket` / `dockerUrl`. Gives authoritative
  `State.Health.Status` and works on hosts without Glances.

#### Media servers (Emby / Jellyfin)

Both expose active sessions with the same response shape (Jellyfin forked
Emby's API), so one normaliser covers both:
`GET {base}/Sessions` with the API key as `api_key` query param (Emby also
accepts the `X-Emby-Token` header; Jellyfin accepts both). The response is an
array; entries with a `NowPlayingItem` are active streams. Fields used:
`UserName`, `Client`, `DeviceName`, `NowPlayingItem.Name` / `SeriesName` /
`RunTimeTicks`, `PlayState.PositionTicks` / `IsPaused`, `PlayMethod`
(`DirectPlay` | `DirectStream` | `Transcode`), and `TranscodingInfo`
(target resolution, codecs, bitrate) when transcoding. Progress is
`PositionTicks / RunTimeTicks`. 8 s timeout, per-server `allSettled` like
every other source.

#### Usenet downloaders (SABnzbd / NZBGet)

- **SABnzbd:** `GET {base}/api?mode=queue&output=json&apikey=…` →
  `queue.paused`, `queue.speed`, `queue.timeleft`, `queue.noofslots_total`,
  `queue.slots[]` (`filename`, `percentage`, `mb`, `mbleft`, `status`).
- **NZBGet:** JSON-RPC 2.0 `POST {base}/jsonrpc` with HTTP Basic auth —
  methods `status` (`DownloadRate` bytes/s, `ServerPaused`) and `listgroups`
  (`NZBName`, `FileSizeMB`, `RemainingSizeMB`, `Status`).

Both normalise into `UsenetSnapshot`; when multiple instances are configured
their queues merge and each slot is tagged with its instance name.

### 5.3 Data model (additions to `src/types.ts`, mirrored in JSDoc)

```ts
export type SourceStatus = 'ok' | 'degraded' | 'down';
export type Severity = 'info' | 'warning' | 'critical';

export interface MonitoredHost {          // Glances host
  id: string;
  name: string;
  url: string;                            // e.g. http://192.168.1.10:61208
  username?: string;
  password?: string;                      // stored in config.json, redacted for public
  dockerSocket?: string;                  // optional v1.1 direct socket
  dockerUrl?: string;                     // optional v1.1 TCP endpoint
}

export interface ContainerHealth {
  name: string;
  image: string;
  state: 'running' | 'exited' | 'restarting' | 'paused' | 'dead' | 'other';
  health: 'healthy' | 'unhealthy' | 'starting' | 'none';
  uptime?: string | null;
}

export interface HostSnapshot {
  host: { id: string; name: string };
  status: SourceStatus;
  error?: string;
  cpu: { percent: number | null; cores: number | null; load: { '1m': number|null; '5m': number|null; '15m': number|null } };
  memory: { total: number|null; used: number|null; percent: number|null };
  disk: { total: number|null; used: number|null; percent: number|null };
  network: { rxBps: number|null; txBps: number|null };   // summed interfaces
  uptime: { seconds: number|null; formatted: string|null };
  containers: ContainerHealth[];
}

export interface SolarSnapshot {
  status: SourceStatus;
  error?: string;
  pvPowerW: number | null;
  loadPowerW: number | null;
  gridPowerW: number | null;               // + import, − export
  batterySocPercent: number | null;
  batteryPowerW: number | null;            // + charging, − discharging
  batteryRuntimeMins: number | null;
}

export interface DockerSummary {
  status: SourceStatus;                    // down if every docker-bearing source is down
  total: number;
  running: number;
  healthy: number;
  unhealthy: number;
  restarting: number;
  problems: ContainerHealth[];             // unhealthy/restarting/dead, max 8
}

export interface MediaStream {
  server: string;                          // instance name, e.g. "jellyfin-main"
  serverType: 'emby' | 'jellyfin';
  user: string;
  client: string;                          // e.g. "Firefox", "Android TV"
  title: string;                           // movie name or series name
  subtitle?: string;                       // "S04E03 · Cibola Burn", "2024 · 4K HDR"
  progressPercent: number | null;
  positionLabel: string;                   // "24:01 / 46:12"
  playMethod: 'DirectPlay' | 'DirectStream' | 'Transcode';
  transcodeDetail?: string;                // "4K → 1080p · HEVC → H.264"
  paused: boolean;
}

export interface MediaSnapshot {
  status: SourceStatus;                    // down if every media server is down
  error?: string;
  activeStreams: number;
  transcoding: number;
  streams: MediaStream[];                  // max 8, most recently started first
}

export interface UsenetSlot {
  instance: string;                        // e.g. "sab-main"
  name: string;                            // NZB name / filename
  percent: number;
  sizeMb: number | null;
  remainingMb: number | null;
  status: string;                          // Downloading, Queued, Extracting, …
}

export interface UsenetInstance {
  name: string;
  type: 'sabnzbd' | 'nzbget';
  status: SourceStatus;
  error?: string;
  paused: boolean;
  speedBps: number | null;
  etaSeconds: number | null;
  queuedTotal: number;
  slots: UsenetSlot[];                     // active + next queued, max 6
}

export interface UsenetSnapshot {
  status: SourceStatus;                    // worst of instances
  instances: UsenetInstance[];
}

export interface AlertInstance {
  id: string;                              // `${ruleId}` — one open instance per rule
  ruleId: string;
  name: string;
  severity: Severity;
  state: 'firing' | 'resolved';
  message: string;                         // "pve-01 cpu 96.2% >= 90% for 60s"
  value: number | string | null;
  since: number;                           // epoch ms
  resolvedAt?: number;
  acked: boolean;
  notifiedAt?: number;
}

export interface MonitorOverview {
  timestamp: number;
  globalStatus: 'ok' | 'degraded' | 'critical';
  hosts: HostSnapshot[];
  solar: SolarSnapshot | null;             // null when disabled
  docker: DockerSummary;
  media: MediaSnapshot | null;             // null when no media servers configured
  usenet: UsenetSnapshot | null;           // null when no downloaders configured
  alerts: { firing: AlertInstance[]; recentlyResolved: AlertInstance[] };
  pollIntervalMs: number;
}
```

### 5.4 Config schema (`DashboardConfig.monitoring`)

```ts
export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  source: 'glances' | 'solar' | 'docker' | 'reachability';
  host?: string;                           // host id; omit = any host
  metric: string;                          // see metric registry below
  operator: '>' | '>=' | '<' | '<=' | '==' | '!=';
  threshold: number;
  severity: Severity;
  forSeconds: number;                      // consecutive breach time before firing
  notify: boolean;                         // forward to ntfy
}

export interface MonitoredMedia {
  id: string;
  name: string;
  type: 'emby' | 'jellyfin';
  url: string;                             // e.g. http://192.168.1.20:8096
  apiKey: string;                          // redacted from public config responses
}

export interface MonitoredUsenet {
  id: string;
  name: string;
  type: 'sabnzbd' | 'nzbget';
  url: string;                             // e.g. http://192.168.1.21:8080
  apiKey?: string;                         // SABnzbd
  username?: string;                       // NZBGet HTTP Basic auth
  password?: string;
}

export interface MonitoringConfig {
  enabled: boolean;
  pollIntervalSeconds: number;             // default 10, clamp 2..60
  glancesHosts: MonitoredHost[];
  solar: { enabled: boolean };             // reuses existing `inverters[]` entry
  docker: { enabled: boolean };
  media: MonitoredMedia[];                 // empty array disables the media card/tab
  usenet: MonitoredUsenet[];
  ui: { tabRotationSeconds: number };      // default 15, 0 = manual tabs only
  alerts: AlertRule[];
}
```

Credentials live in `data/config.json` exactly like `RemoteServer` today;
`configRedaction.js` gains a rule so `monitoring.glancesHosts[*].password` is
stripped from unauthenticated `/api/config` responses (extend the existing
redaction list — the `servers` array is already handled this way).

**Metric registry** (dot paths resolved against a host/solar/docker snapshot):

| Metric | Source | Unit |
|---|---|---|
| `cpu.percent` | glances | % |
| `memory.percent` | glances | % |
| `disk.percent` | glances | % |
| `load.1m` | glances | load |
| `battery.soc` | solar | % |
| `pv.power` | solar | W |
| `grid.power` | solar | W |
| `docker.unhealthy` | docker | count |
| `docker.restarting` | docker | count |
| `docker.runningRatio` | docker | 0–1 |
| `streams.count` | media | count |
| `streams.transcoding` | media | count |
| `downloads.speed` | usenet | B/s |
| `downloads.paused` | usenet | 0/1 |
| `queue.slots` | usenet | count |
| `reachable` | reachability | 0/1 (synthetic) |

Ship commented default rules in the example config: cpu ≥ 90 % for 120 s
(warning), mem ≥ 95 % (warning), disk ≥ 90 % (warning), host unreachable for
60 s (critical), `docker.unhealthy ≥ 1` (warning), `battery.soc ≤ 15 %`
(critical), `streams.transcoding ≥ 4` (warning), `downloads.paused == 1` for
1800 s (info).

### 5.5 Alert engine

Runs after every poll cycle, inside `monitor.js`. ~150 LOC, no dependencies.

State per rule: `{ consecutiveBreachMs, instance?: AlertInstance }`.

1. **Evaluate** each enabled rule against the snapshot (first matching host if
   `host` omitted → evaluate per host, instance id becomes `ruleId:hostId`).
2. **Debounce:** breach must persist for `forSeconds` (accumulated across
   consecutive cycles) before transitioning to `firing`. Prevents flapping on
   a single 10 s spike. Optionally add 10 % hysteresis on release for
   percentage metrics (v1: release as soon as the condition clears once).
3. **Fire:** create/refresh `AlertInstance`, append to ring buffer
   (`data/monitor-alerts.json`, max 100, same persistence idiom as
   notifications), and if `rule.notify`, publish to ntfy via the existing
   `NotificationManager` publish path with priority mapped from severity
   (info→2, warning→4, critical→5) and tags `rotating_light` / `warning`.
4. **Resolve:** when the condition clears, set `state: 'resolved'`,
   `resolvedAt`, optionally notify with `white_check_mark`.
5. **Ack:** `acked: true` suppresses repeat notifications for that instance
   (it still renders in the panel).

Alert history survives restarts via the JSON file; only `firing`/`resolved`
instances are stored, never raw metric history.

### 5.6 Frontend (`src/monitor/`)

```
src/monitor/
  MonitorApp.tsx          // root: providers (Auth, Toast), polling loop, layout grid
  monitorApi.ts           // fetch wrapper mirroring src/api/http.ts idioms
  useMonitorOverview.ts   // poll hook: setInterval + visibilitychange pause
  components/
    MonitorHeader.tsx     // title, global status pill, clock, alert bell, last-updated
    TabBar.tsx            // tab buttons + rotation countdown ring
    StreamsCard.tsx       // active Emby/Jellyfin sessions w/ progress + play-method badges
    UsenetCard.tsx        // per-instance queue: speed, ETA, per-slot progress bars
  useTabRotation.ts       // auto-rotate timer; 60s pause after a manual switch
    AlertBanner.tsx       // pinned strip for critical alerts (pulse)
    HostCard.tsx          // one Glances host: stat bars (reuses barColor idiom), load, net, uptime
    SolarCard.tsx         // PV/battery/grid/load + SOC ring + runtime
    DockerCard.tsx        // running donut/counts + problem list
    AlertsRail.tsx        // firing list w/ ack buttons + recently resolved
    SourceDot.tsx         // per-source reachability dot w/ tooltip
```

Key behaviours:
- `useMonitorOverview` polls `/api/monitor/overview` every
  `overview.pollIntervalMs / 2` (default 5 s), pauses when
  `document.hidden`, and applies a simple backoff (2×, max 60 s) after three
  consecutive failures, surfacing a "connection lost" header state.
- `useTabRotation` swaps the visible tab on the configured cadence, resets to
  a 60 s pause on manual tab clicks, honours `?tab=` deep-links, and keeps
  the header/banner mounted across tab switches so alerts never disappear.
- Auth: on 401 the page renders the existing `LoginModal` full-screen (reuse,
  do not duplicate).
- Theming: reuse the active dashboard theme via the same CSS variables; force
  dark-type presets on this route only if `?theme=` is absent (kiosk default).
- Full-screen layout: CSS grid, `100dvh`, no scroll at ≥1080p; below that,
  columns stack and the page scrolls.
- No new runtime dependencies. Icons from `lucide-react`. Numbers use
  `tabular-nums`.

---

## 6. Security

- All `/api/monitor/*` endpoints behind `requireAuth` (session cookie), except
  anonymous-safe `/healthz` which leaks only poll-loop liveness.
- Glances/Solar credentials stay server-side; config redaction extended to
  `monitoring.*` (mirroring `servers` handling in `configRedaction.js`).
- No user-supplied URLs: fan-out targets come exclusively from config, so the
  aggregation endpoint does not widen the existing SSRF surface.
- Media/usenet API keys and NZBGet Basic credentials are stored server-side
  only, covered by the same config redaction as Glances passwords; normalised
  snapshots contain no credentials.
- Per-source fetch timeout 8 s (matches existing proxy); `Promise.allSettled`
  so one dead host can't poison the snapshot.
- CSRF: ack endpoint is a POST under the existing `csrfGuard`
  (`X-Requested-With` header set by the fetch wrapper).

## 7. Performance and reliability

- Snapshot endpoint is O(1) (serves cache); expected payload 5–20 KB gzipped
  for 3 hosts.
- Fan-out parallelism bounded by host count; worst-case cycle time =
  8 s timeout; poll loop skips a cycle if the previous one is still running
  (guard flag).
- Solar Assistant is the slowest source; it is queried in parallel, never
  serially.
- Poll loop starts lazily on server boot only when `monitoring.enabled` and at
  least one source is configured; config PUT triggers a poller restart with
  the new settings.
- Ring buffers are bounded; alert JSON is rewritten atomically
  (tmp + rename, same as notifications).

## 8. Implementation phases

### Phase 1 — Read-only board (no alert engine)
1. `monitor.js`: poller, fan-out, normalisers (Glances → `HostSnapshot`,
   container health parsing, solar → `SolarSnapshot`, docker aggregation),
   `GET /api/monitor/overview`. Config schema + redaction.
2. Routing branch in `main.tsx`; `MonitorApp` shell with header, host cards,
   solar card, docker card; polling hook; login gating.
3. Header link from main dashboard to `/monitor`.
4. Client-side threshold colouring only (no server alerts yet).

**Exit criteria:** `/monitor` renders live data for ≥2 Glances hosts, solar,
and docker counts; page deep-links and reloads correctly in dev and in the
production Docker image.

### Phase 2 — Alerts
5. Alert engine + `AlertRule` evaluation, persistence, ring buffer.
6. `/api/monitor/alerts` + ack endpoint; `AlertsRail`, `AlertBanner`, header
   bell with firing count.
7. ntfy forwarding with severity mapping; ack suppresses repeats.
8. Default rules in example config + README section.

**Exit criteria:** killing a container with a healthcheck raises a warning on
the page within ~2 poll cycles and (when `notify`) an ntfy message; stopping a
Glances host raises a critical banner; resolving clears both.

### Phase 3 — Media, Usenet, and tabs
9. `MediaSnapshot` / `UsenetSnapshot` pollers + normalisers for Emby,
   Jellyfin, SABnzbd, and NZBGet; config schema + redaction for API keys.
10. Tab bar with auto-rotation (countdown ring, 60 s pause on manual switch,
    `?tab=` deep-link) in `MonitorApp`.
11. `StreamsCard` (active sessions, progress, direct-play/transcode badges)
    and `UsenetCard` (speed, ETA, per-slot progress) on the media tab.
12. Media/usenet alert metrics + default rules (transcode count, paused
    queue).

**Exit criteria:** the media tab shows live Emby/Jellyfin sessions and
SABnzbd/NZBGet queues; tabs auto-rotate on the configured cadence and pause
after manual interaction; a paused queue fires the info alert.

### Phase 4 — Polish (optional, prioritised later)
13. In-memory sparkline history (last 60 samples) for CPU/mem on host cards.
14. Direct Docker socket strategy for hosts without Glances.
15. Kiosk mode: cursor auto-hide, `?theme=` param, PWA shortcut, screen
    wake-lock toggle.
16. Sound on new critical alert (opt-in).
17. Monitoring config editor in `SettingsModal`.
18. Recently-completed rails (SABnzbd history, Jellyfin recently played) on
    the media tab.

## 9. Testing plan

- **Unit (node --test, matches `__rt_test.js` idiom):**
  - container status-string parser (healthy/unhealthy/restarting/exited),
  - alert engine: breach accumulation, fire, resolve, ack-suppresses-notify,
    per-host fan-out of hostless rules,
  - `SolarSnapshot` normaliser against a recorded Solar Assistant payload.
- **Integration:** spin server with a fixture config + nock-style stubbed
  Glances/Solar endpoints; assert snapshot shape and alert transitions.
- **Manual:** `npm run dev` against real lab; verify 401 flow, deep link,
  reload, theme switching; run production `docker build` and confirm
  `/monitor` fallback works behind the bundled static server.
- **Load:** 5 concurrent pollers of `/api/monitor/overview` for 10 min —
  upstream request rate must stay at 1× poll cadence (cache hit path).

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Glances v3/v4 payload drift | Normaliser already handles both; add fixture tests. |
| Container health absent when containers lack healthchecks | `health: 'none'` is explicit; default rules only alert on `unhealthy`/`restarting`. |
| Alert flapping on spiky metrics | `forSeconds` debounce; document hysteresis as follow-up. |
| Solar endpoint latency stalls the cycle | Parallel fan-out + 8 s timeout + `allSettled`; source shows `down`, page keeps rendering. |
| Secrets in config | Same posture as existing `RemoteServer`; redaction extended; README security note updated. |
| `server.js` bloat | All new logic isolated in `monitor.js`; `server.js` gains ~20 lines of wiring. |

## 11. Open questions

1. Should the page be anonymously viewable (read-only "status page" mode)
   behind a config flag? Default: no.
2. Do we want per-host mute/maintenance windows in v2?
3. Is 10 s server poll + 5 s client poll acceptable, or do we want SSE push
5. Should rotation pause persist until reload (kiosk operators may pin a tab
   deliberately), or always resume after 60 s?
6. Do we want usenet history / recently-played rails on the media tab, or
   keep it strictly "right now"?
   (reuse `/api/notifications/stream` infrastructure) for the overview?
4. Which hosts get the optional direct-docker strategy — is mounting the
   docker socket into the HomeDash container acceptable for this deployment?
