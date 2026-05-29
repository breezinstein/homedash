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
}

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
