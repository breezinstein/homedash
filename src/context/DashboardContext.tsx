import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { DashboardConfig, Service } from '../types';
import { configApi } from '../api/configApi';

interface ServerBackup {
  name: string;
  date: string;
  filename: string;
  serviceCount: number;
}

interface DashboardContextType {
  config: DashboardConfig;
  setConfig: (config: DashboardConfig) => void;
  updateService: (index: number, service: Service) => void;
  addService: (service: Service) => void;
  deleteService: (index: number) => void;
  updateCategory: (oldName: string, newName: string) => void;
  addCategory: (name: string) => void;
  deleteCategory: (name: string) => void;
  reorderCategories: (newOrder: string[]) => void;
  backups: ServerBackup[];
  createBackup: (name?: string) => Promise<void>;
  restoreBackup: (backup: ServerBackup) => Promise<void>;
  deleteBackup: (filename: string) => Promise<void>;
  refreshBackups: () => Promise<void>;
  importConfig: (file: File) => Promise<void>;
  exportConfig: () => void;
  isEditMode: boolean;
  setIsEditMode: (mode: boolean) => void;
  collapsedCategories: string[];
  toggleCategoryCollapse: (category: string) => void;
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncError: string | null;
  uploadIcon: (file: File) => Promise<string>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const defaultConfig: DashboardConfig = {
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

const DashboardContext = createContext<DashboardContextType | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<DashboardConfig>(defaultConfig);
  const [backups, setBackups] = useState<ServerBackup[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('homedash-collapsed');
    return saved ? JSON.parse(saved) : [];
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const lastModifiedRef = useRef<number>(0);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  // Load config from server on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { config: serverConfig, lastModified } = await configApi.getConfig();
        setConfigState(serverConfig);
        lastModifiedRef.current = lastModified;
        setLastSyncTime(new Date());
        setSyncError(null);
      } catch (error) {
        console.error('Failed to load config from server:', error);
        setSyncError('Failed to connect to server');
        // Try loading from localStorage as fallback
        const saved = localStorage.getItem('homedash-config');
        if (saved) {
          setConfigState(JSON.parse(saved));
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
    refreshBackups();
  }, []);

  // Poll for changes from server
  useEffect(() => {
    const checkInterval = setInterval(async () => {
      if (isSavingRef.current) return;
      
      try {
        const { changed, lastModified } = await configApi.checkForChanges(lastModifiedRef.current);
        if (changed) {
          setIsSyncing(true);
          const { config: serverConfig } = await configApi.getConfig();
          setConfigState(serverConfig);
          lastModifiedRef.current = lastModified;
          setLastSyncTime(new Date());
          setSyncError(null);
          setIsSyncing(false);
        }
      } catch (error) {
        console.error('Sync check failed:', error);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(checkInterval);
  }, []);

  // Save to server with debounce
  const saveToServer = useCallback(async (newConfig: DashboardConfig) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      isSavingRef.current = true;
      setIsSyncing(true);
      try {
        const { lastModified } = await configApi.saveConfig(newConfig);
        lastModifiedRef.current = lastModified;
        setLastSyncTime(new Date());
        setSyncError(null);
        // Also save to localStorage as backup
        localStorage.setItem('homedash-config', JSON.stringify(newConfig));
      } catch (error) {
        console.error('Failed to save to server:', error);
        setSyncError('Failed to save to server');
        // Save to localStorage anyway
        localStorage.setItem('homedash-config', JSON.stringify(newConfig));
      } finally {
        isSavingRef.current = false;
        setIsSyncing(false);
      }
    }, 500); // Debounce 500ms
  }, []);

  useEffect(() => {
    // Apply colors to CSS variables
    const root = document.documentElement;
    Object.entries(config.colors).forEach(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      root.style.setProperty(`--color-${cssKey}`, value);
    });
  }, [config.colors]);

  const setConfig = (newConfig: DashboardConfig) => {
    const updated = {
      ...newConfig,
      metadata: {
        ...newConfig.metadata,
        lastModified: new Date().toISOString()
      }
    };
    setConfigState(updated);
    saveToServer(updated);
  };

  const refreshBackups = async () => {
    try {
      const serverBackups = await configApi.listBackups();
      setBackups(serverBackups);
    } catch (error) {
      console.error('Failed to load backups:', error);
    }
  };

  const updateService = (index: number, service: Service) => {
    const newServices = [...config.services];
    newServices[index] = service;
    setConfig({ ...config, services: newServices });
  };

  const addService = (service: Service) => {
    const newServices = [...config.services, service];
    const categoryOrder = config.categoryOrder.includes(service.category)
      ? config.categoryOrder
      : [...config.categoryOrder, service.category];
    setConfig({ ...config, services: newServices, categoryOrder });
  };

  const deleteService = (index: number) => {
    const newServices = config.services.filter((_, i) => i !== index);
    setConfig({ ...config, services: newServices });
  };

  const updateCategory = (oldName: string, newName: string) => {
    const newServices = config.services.map(service =>
      service.category === oldName ? { ...service, category: newName } : service
    );
    const newCategoryOrder = config.categoryOrder.map(cat =>
      cat === oldName ? newName : cat
    );
    setConfig({ ...config, services: newServices, categoryOrder: newCategoryOrder });
  };

  const addCategory = (name: string) => {
    if (!config.categoryOrder.includes(name)) {
      setConfig({ ...config, categoryOrder: [...config.categoryOrder, name] });
    }
  };

  const deleteCategory = (name: string) => {
    const newServices = config.services.filter(s => s.category !== name);
    const newCategoryOrder = config.categoryOrder.filter(c => c !== name);
    setConfig({ ...config, services: newServices, categoryOrder: newCategoryOrder });
  };

  const reorderCategories = (newOrder: string[]) => {
    setConfig({ ...config, categoryOrder: newOrder });
  };

  const createBackup = async (name?: string) => {
    try {
      await configApi.createBackup(name);
      await refreshBackups();
    } catch (error) {
      console.error('Failed to create backup:', error);
    }
  };

  const restoreBackup = async (backup: ServerBackup) => {
    try {
      await configApi.restoreBackup(backup.filename);
      const { config: serverConfig, lastModified } = await configApi.getConfig();
      setConfigState(serverConfig);
      setCollapsedCategories(serverConfig.collapsedCategories || []);
      lastModifiedRef.current = lastModified;
    } catch (error) {
      console.error('Failed to restore backup:', error);
    }
  };

  const deleteBackup = async (filename: string) => {
    try {
      await configApi.deleteBackup(filename);
      await refreshBackups();
    } catch (error) {
      console.error('Failed to delete backup:', error);
    }
  };

  const uploadIcon = async (file: File): Promise<string> => {
    const result = await configApi.uploadIcon(file);
    return result.url;
  };

  const importConfig = async (file: File) => {
    const text = await file.text();
    const importedConfig = JSON.parse(text) as DashboardConfig;
    setConfig(importedConfig);
  };

  const exportConfig = () => {
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `homedash-config-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories(prev => {
      const newCollapsed = prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category];
      // Only store in localStorage, don't save to server (UI state only)
      localStorage.setItem('homedash-collapsed', JSON.stringify(newCollapsed));
      return newCollapsed;
    });
  };

  return (
    <DashboardContext.Provider value={{
      config,
      setConfig,
      updateService,
      addService,
      deleteService,
      updateCategory,
      addCategory,
      deleteCategory,
      reorderCategories,
      backups,
      createBackup,
      restoreBackup,
      deleteBackup,
      refreshBackups,
      importConfig,
      exportConfig,
      isEditMode,
      setIsEditMode,
      collapsedCategories,
      toggleCategoryCollapse,
      isLoading,
      isSyncing,
      lastSyncTime,
      syncError,
      uploadIcon,
      searchQuery,
      setSearchQuery
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
