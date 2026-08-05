export interface Service {
  name: string;
  url: string;
  icon: string;
  category: string;
  description: string;
}

export interface Settings {
  timezone: string;
  customCSS: string;
  autoSync: boolean;
  syncInterval: number;
}

export interface Metadata {
  version: string;
  lastModified: string;
  backupEnabled: boolean;
  lastBackup: string;
  backupCadenceMinutes: number;
  configHash: string;
  restoredFrom?: string;
  restoredAt?: string;
}

export interface Colors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
}

export interface DashboardConfig {
  services: Service[];
  collapsedCategories: string[];
  gridColumns: string;
  theme: string;
  settings: Settings;
  metadata: Metadata;
  categoryOrder: string[];
  colors: Colors;
  clips?: Clip[];
  servers?: RemoteServer[];
  inverters?: InverterServer[];
  notifications?: NotificationsConfig;
  monitoring?: MonitoringConfig;
}

// How long of a history window to request from ntfy on first connect.
export type NotificationBackfill = '1h' | '6h' | '12h' | '24h' | 'all';

// User-configured connection to a self-hosted ntfy server. Persisted as part
// of DashboardConfig. Credentials, when present, are stored in plain text in
// data/config.json (consistent with RemoteServer); see README security note.
export interface NotificationsConfig {
  enabled: boolean;
  serverUrl: string;          // e.g. https://ntfy.sh
  topics: string[];           // subscribed topic names
  username?: string;
  password?: string;
  backfill: NotificationBackfill;
  maxHistory: number;         // cap on in-memory items
  browserNotifications: boolean;
  // Epoch ms of the last time the user opened the panel. Persisted so the
  // unread badge survives reloads even though message history is not stored.
  lastReadAt?: number;
}

// A single action button attached to an ntfy message.
export interface NtfyAction {
  id?: string;
  action: 'view' | 'http' | 'broadcast';
  label: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  clear?: boolean;
}

// An attachment reference on an ntfy message.
export interface NtfyAttachment {
  name: string;
  url: string;
  type?: string;
  size?: number;
  expires?: number;
}

// Raw message as delivered by ntfy's /json stream endpoint.
export interface NtfyMessage {
  id: string;
  time: number;               // epoch seconds
  event: 'open' | 'keepalive' | 'message' | 'poll_request';
  topic: string;
  message?: string;
  title?: string;
  tags?: string[];
  priority?: 1 | 2 | 3 | 4 | 5;
  click?: string;
  actions?: NtfyAction[];
  attachment?: NtfyAttachment;
  icon?: string;
  content_type?: string;
}

// An NtfyMessage augmented with client-only UI state. Held in memory only.
export interface NotificationItem extends NtfyMessage {
  read: boolean;
  dismissed: boolean;
}

export type NotificationsStatus =
  | 'disabled'
  | 'connecting'
  | 'open'
  | 'error';

// A remote HomeDash instance whose server stats can be viewed.
export interface RemoteServer {
  id: string;
  name: string;
  url: string;
  username?: string;
  password?: string;
  createdAt: string;
}

export interface Clip {
  id: string;
  label: string;
  content: string;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Backup {
  name: string;
  date: string;
  data: DashboardConfig;
}

// ---------------------------------------------------------------------------
// Monitoring types — used by the /monitor page and monitor.js backend.
// ---------------------------------------------------------------------------

export type SourceStatus = 'ok' | 'degraded' | 'down';
export type Severity = 'info' | 'warning' | 'critical';

export interface MonitoredHost {
  id: string;
  name: string;
  url: string;
  username?: string;
  password?: string;
  dockerSocket?: string;
  dockerUrl?: string;
}

export interface MonitoredMedia {
  id: string;
  name: string;
  type: 'emby' | 'jellyfin';
  url: string;
  apiKey: string;
}

export interface MonitoredUsenet {
  id: string;
  name: string;
  type: 'sabnzbd' | 'nzbget';
  url: string;
  // SABnzbd can use API key OR username/password (HTTP Basic).
  // NZBGet always uses username/password (HTTP Basic).
  apiKey?: string;
  username?: string;
  password?: string;
}

export interface MonitoredArr {
  id: string;
  name: string;
  type: 'sonarr' | 'radarr';
  url: string;
  apiKey: string;
}

export interface MonitoredSeerr {
  id: string;
  name: string;
  type: 'seerr' | 'overseerr' | 'jellyseerr';
  url: string;
  apiKey: string;
}

export interface MonitoredOpnsense {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  apiSecret: string;
  insecureTls?: boolean;
}

// ntopng — network traffic analyser. Basic-auth (username/password) or an API
// token as the password. `ifid` is optional; when omitted the first actively
// monitored interface is used.
export interface MonitoredNtopng {
  id: string;
  name: string;
  url: string;
  username?: string;
  password?: string;
  ifid?: number;
  insecureTls?: boolean;
}

// Home Assistant — smart-home REST API. Auth via a long-lived access token
// (Profile → Security → Long-lived access tokens).
export interface MonitoredHomeAssistant {
  id: string;
  name: string;
  url: string;
  token: string;
  insecureTls?: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  source: 'glances' | 'solar' | 'docker' | 'media' | 'usenet' | 'seerr' | 'reachability';
  host?: string;
  metric: string;
  operator: '>' | '>=' | '<' | '<=' | '==' | '!=';
  threshold: number;
  severity: Severity;
  forSeconds: number;
  notify: boolean;
}

export interface MonitoringConfig {
  enabled: boolean;
  pollIntervalSeconds: number;
  glancesHosts: MonitoredHost[];
  solar: { enabled: boolean };
  docker: { enabled: boolean };
  media: MonitoredMedia[];
  usenet: MonitoredUsenet[];
  arr: MonitoredArr[];
  seerr: MonitoredSeerr[];
  opnsense: MonitoredOpnsense[];
  ntopng: MonitoredNtopng[];
  homeassistant: MonitoredHomeAssistant[];
  ui: { tabRotationSeconds: number };
  alerts: AlertRule[];
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
  network: { rxBps: number|null; txBps: number|null };
  uptime: { seconds: number|null; formatted: string|null };
  system?: { hostname?: string; platform?: string; distro?: string; glancesVersion?: string };
  containers: ContainerHealth[];
}

export interface SolarSnapshot {
  status: SourceStatus;
  error?: string;
  pvPowerW: number | null;
  loadPowerW: number | null;
  gridPowerW: number | null;
  batterySocPercent: number | null;
  batteryPowerW: number | null;
  batteryRuntimeMins: number | null;
  inverters: InverterDetail[];
  batteries: BatteryDetail[];
}

/** Per-inverter metrics from Solar Assistant. */
export interface InverterDetail {
  id: string;
  serialNumber: string | null;
  deviceMode: string | null;       // e.g. "Solar/Grid"
  temperature: number | null;
  busVoltage: number | null;
  systemPowerW: number | null;
  loadPercent: number | null;
  loadPowerW: number | null;
  loadApparentPowerVa: number | null;
  acOutputVoltage: number | null;
  acOutputFrequency: number | null;
  pvPowerW: number | null;
  pvVoltage: number | null;
  pvCurrent: number | null;
  batteryVoltage: number | null;
  batteryCurrent: number | null;
  batteryPowerW: number | null;
  batteryPowerFromAcW: number | null;
  gridPowerW: number | null;
  gridVoltage: number | null;
  gridFrequency: number | null;
  generatorPowerW: number | null;
  generatorVoltage: number | null;
}

/** Per-battery (BMS) metrics from Solar Assistant. */
export interface BatteryDetail {
  id: string;
  capacityAh: number | null;
  stateOfChargePercent: number | null;
  powerW: number | null;
  currentA: number | null;
  voltage: number | null;
  temperature: number | null;
  temperatureMos: number | null;
  temperatureEnv: number | null;
  cycles: number | null;
  chargeCapacityAh: number | null;
  cellVoltageHighest: number | null;
  cellVoltageLowest: number | null;
  cellVoltageImbalance: number | null;
  cellTempHighest: number | null;
  cellTempLowest: number | null;
  cellTempAverage: number | null;
}

export interface DockerSummary {
  status: SourceStatus;
  total: number;
  running: number;
  healthy: number;
  unhealthy: number;
  restarting: number;
  problems: ContainerHealth[];
}

export interface MediaStream {
  server: string;
  serverType: 'emby' | 'jellyfin';
  user: string;
  client: string;
  device: string;
  title: string;
  subtitle?: string;
  progressPercent: number | null;
  positionLabel: string;
  playMethod: 'DirectPlay' | 'DirectStream' | 'Transcode';
  transcodeDetail?: string;
  paused: boolean;
}

export interface MediaSnapshot {
  status: SourceStatus;
  error?: string;
  activeStreams: number;
  transcoding: number;
  streams: MediaStream[];
}

export interface UsenetSlot {
  instance: string;
  name: string;
  percent: number;
  sizeMb: number | null;
  remainingMb: number | null;
  status: string;
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
  slots: UsenetSlot[];
}

export interface UsenetSnapshot {
  status: SourceStatus;
  instances: UsenetInstance[];
}

// Sonarr/Radarr queue item
export interface ArrQueueItem {
  instance: string;
  instanceType: 'sonarr' | 'radarr';
  title: string;
  seriesName?: string;         // Sonarr only
  quality: string;
  sizeMb: number | null;
  progressPercent: number | null;
  timeLeft: string | null;
  status: string;
}

export interface ArrInstance {
  name: string;
  type: 'sonarr' | 'radarr';
  status: SourceStatus;
  error?: string;
  queueCount: number;
  wantedCount: number;          // missing episodes/movies
  healthOk: boolean;
  healthWarnings: string[];
}

export interface ArrSnapshot {
  status: SourceStatus;
  instances: ArrInstance[];
  queue: ArrQueueItem[];        // merged queue across all instances
}

// Seerr / Overseerr / Jellyseerr — open media issues and unattended requests.
export interface SeerrIssue {
  id: number;
  issueType: number;            // 1 video, 2 audio, 3 subtitles, 4 other
  status: 'open' | 'resolved';
  mediaTitle: string;
  mediaType: 'movie' | 'tv';
  createdBy: string;
  createdAt: string | null;
}

export interface SeerrRequest {
  id: number;
  status: 'pending' | 'failed'; // pending approval, or failed processing
  mediaTitle: string;
  mediaType: 'movie' | 'tv';
  is4k: boolean;
  requestedBy: string;
  createdAt: string | null;
}

export interface SeerrSnapshot {
  status: SourceStatus;
  error?: string;
  version?: string;
  issues: SeerrIssue[];
  pending: SeerrRequest[];
  failed: SeerrRequest[];
}

// OPNSense firewall/router
export interface OpnsenseInterfaceStats {
  name: string;
  description: string;
  status: string;               // up / down / no carrier
  active: boolean;              // this WAN is the current default gateway
  inBps: number | null;         // live receive rate, bytes/sec
  outBps: number | null;        // live transmit rate, bytes/sec
  speedBps: number | null;      // negotiated link speed, bits/sec (OPNsense "line rate")
}

/** NetFlow / Insight top talker entry from OPNsense. */
export interface NetFlowTalker {
  address: string;
  hostname: string | null;
  bytes: number;
  percentage: number;
}

export interface OpnsenseSnapshot {
  status: SourceStatus;
  error?: string;
  hostname: string | null;
  version: string | null;
  uptime: string | null;
  cpuPercent: number | null;
  memPercent: number | null;
  diskPercent: number | null;
  wanInterfaces: OpnsenseInterfaceStats[];
  lanInterfaces: OpnsenseInterfaceStats[];
  netflowTalkers: NetFlowTalker[];
  firewallStates: number | null;
  dhcpLeases: number | null;
  totalLinkCapacityBps: number | null; // sum of negotiated link speeds, bits/sec
}

/** Top talker entry from ntopng. */
export interface NtopngTalker {
  address: string;
  name: string | null;
  txBps: number | null;         // live upload rate (host sent)
  rxBps: number | null;         // live download rate (host received)
  throughputBps: number | null; // combined live rate (tx + rx); null if unknown
  bytes: number;                // total cumulative traffic
  bytesSent: number;            // cumulative bytes sent
  bytesRcvd: number;            // cumulative bytes received
  firstSeen: number | null;     // epoch seconds when ntopng started counting this host
}

export interface NtopngSnapshot {
  status: SourceStatus;
  error?: string;
  ifid: number | null;
  ifname: string | null;
  source: 'pro' | 'community' | null; // which ntopng endpoint produced the data
  topTalkers: NtopngTalker[];
}

/** One glance-able Home Assistant metric (auto-discovered). */
export interface HomeAssistantMetric {
  key: string;
  label: string;
  value: number | string | null;
  unit: string | null;
}

export interface HomeAssistantUnavailableDevice {
  entityId: string;
  name: string;
}

/** Pressure pump status for the Home Status card hero. */
export interface HomeAssistantPump {
  present: boolean;   // a pump entity was found in Home Assistant
  running: boolean;
  name: string;
  state: string;      // raw HA state, e.g. 'on' | 'off' | 'active' | 'idle'
  since: number | null; // epoch ms of the last state change (when running)
  timerRemaining: number | null; // seconds left on timer.pressure_pump_timer (when active)
  timerDuration: number | null;  // total timer duration in seconds
  label: string;      // display label, e.g. 'PRESSURE PUMP'
}

export interface HomeAssistantSnapshot {
  status: SourceStatus;
  error?: string;
  version: string | null;
  locationName: string | null;
  entityCount: number;
  onCount: number;
  unavailable: {
    count: number;
    devices: HomeAssistantUnavailableDevice[];
  };
  metrics: HomeAssistantMetric[];
  pump: HomeAssistantPump;
}

export interface AlertInstance {
  id: string;
  ruleId: string;
  name: string;
  severity: Severity;
  state: 'firing' | 'resolved';
  message: string;
  value: number | string | null;
  since: number;
  resolvedAt?: number;
  acked: boolean;
  notifiedAt?: number;
}

export interface MonitorOverview {
  timestamp: number;
  globalStatus: 'ok' | 'degraded' | 'critical';
  hosts: HostSnapshot[];
  solar: SolarSnapshot | null;
  docker: DockerSummary;
  media: MediaSnapshot | null;
  usenet: UsenetSnapshot | null;
  arr: ArrSnapshot | null;
  seerr: SeerrSnapshot | null;
  opnsense: OpnsenseSnapshot | null;
  ntopng: NtopngSnapshot | null;
  homeassistant: HomeAssistantSnapshot | null;
  alerts: { firing: AlertInstance[]; recentlyResolved: AlertInstance[] };
  pollIntervalMs: number;
  tabRotationSeconds: number;
}

// Copyparty file-sharing types
export interface CopypartyFile {
  n: string;   // filename
  sz: number;  // size in bytes
  ts: number;  // Unix timestamp (seconds)
  ext?: string;
}

export interface CopypartyDir {
  n: string;   // directory name
  ts: number;  // Unix timestamp (seconds)
}

export interface CopypartyListing {
  files: CopypartyFile[];
  dirs: CopypartyDir[];
  path: string;
}

// Live host metrics returned by GET /api/stats
export interface ServerStats {
  cpu: {
    percent: number | null;
    cores: number | null;
    model: string | null;
    load: { '1m': number | null; '5m': number | null; '15m': number | null };
  };
  memory: {
    total: number | null;
    used: number | null;
    free: number | null;
    percent: number | null;
  };
  disk: {
    total: number | null;
    used: number | null;
    free: number | null;
    percent: number | null;
  };
  uptime: {
    seconds: number | null;
    formatted: string | null;
  };
  system: {
    hostname: string;
    platform: string;
    arch: string;
    release: string;
    type: string;
    nodeVersion?: string;     // local host only
    distro?: string;          // Glances: linux distribution
    glancesVersion?: string;  // Glances instances only
  };
  containers?: ContainerStat[];
  source?: 'local' | 'glances';
  timestamp: number;
}

// A single Docker/Podman container reported by a Glances instance.
export interface ContainerStat {
  name: string;
  image: string;
  status: string;
  cpuPercent: number | null;
  memoryUsage: number | null;
  memoryLimit: number | null;
  uptime: string | null;
  engine: string | null;
}

// A configured Solar Assistant device (stored in config.json under `inverters`).
export interface InverterServer {
  id: string;
  name: string;
  url: string;
  username?: string;
  password?: string;
  createdAt: string;
}

// A single normalized metric from the Solar Assistant API.
export interface InverterMetric {
  name: string;
  value: number | string | null;
  unit: string;
  group: string;
}

// A discovered device (inverter_N / battery_N) with its metric map.
export interface InverterDevice {
  id: string;
  label: string;
  metrics: Record<string, InverterMetric>;
}

// Server-computed battery runtime estimate (overview.batteryRuntime).
export type BatteryRuntimeState = 'charging' | 'discharging' | 'idle' | 'full' | 'calculating' | 'unknown';

export interface BatteryRuntime {
  state: BatteryRuntimeState;
  minutes: number | null;
  floorSoc: number;
  soc: number | null;
}

// Normalized inverter metrics returned by GET /api/inverter/metrics
export interface InverterStats {
  source: 'solar-assistant';
  overview: {
    pvPower: number | string | null;
    loadPower: number | string | null;
    gridPower: number | string | null;
    batteryPower: number | string | null;
    batterySoc: number | string | null;
    batteryVoltage: number | string | null;
    batteryCurrent: number | string | null;
    batteryTemperature: number | string | null;
    loadPercentage: number | string | null;
    acOutputVoltage: number | string | null;
    acOutputFrequency: number | string | null;
    gridVoltage: number | string | null;
    gridFrequency: number | string | null;
    generatorPower: number | string | null;
    inverterMode: string | null;
    batteryRuntime?: BatteryRuntime;
  };
  totals: Record<string, InverterMetric>;
  inverters: InverterDevice[];
  batteries: InverterDevice[];
  other: Record<string, InverterMetric>;
  timestamp: number;
}
