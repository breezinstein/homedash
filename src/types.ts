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
