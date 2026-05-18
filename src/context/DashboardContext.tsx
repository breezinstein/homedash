import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import type { Clip, DashboardConfig, Service } from '../types';
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
  moveServiceToCategory: (serviceIndex: number, targetCategory: string, targetPosition?: number) => void;
  reorderServicesInCategory: (category: string, fromIndex: number, toIndex: number) => void;
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
  serviceIndexByRef: Map<Service, number>;
  clips: Clip[];
  addClip: (label: string, content: string) => void;
  updateClip: (id: string, patch: Partial<Pick<Clip, 'label' | 'content' | 'pinned'>>) => void;
  deleteClip: (id: string) => void;
  toggleClipPin: (id: string) => void;
  reorderClips: (newOrder: Clip[]) => void;
  copyClipToSystemClipboard: (content: string) => Promise<boolean>;
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
    // Settings value is configurable; clamp to a sensible floor so a bad
    // value can't hammer the server. Default of 5000ms matches prior behaviour.
    const configured = config.settings?.syncInterval;
    const pollMs = Math.max(1000, typeof configured === 'number' && configured > 0 ? configured : 5000);
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
    }, pollMs);

    return () => clearInterval(checkInterval);
  }, [config.settings?.syncInterval]);

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

  const moveServiceToCategory = (serviceIndex: number, targetCategory: string, targetPosition?: number) => {
    const service = config.services[serviceIndex];
    if (!service) return;

    // Update service category
    const updatedService = { ...service, category: targetCategory };
    
    // Get services in target category (excluding the moving service if it's already there)
    const targetCategoryServices = config.services.filter(
      (s, i) => s.category === targetCategory && i !== serviceIndex
    );
    
    // Get all other services
    const otherServices = config.services.filter(
      (s, i) => s.category !== targetCategory && i !== serviceIndex
    );

    // Insert service at target position or at end
    let newTargetCategoryServices: Service[];
    if (targetPosition !== undefined && targetPosition >= 0) {
      newTargetCategoryServices = [
        ...targetCategoryServices.slice(0, targetPosition),
        updatedService,
        ...targetCategoryServices.slice(targetPosition)
      ];
    } else {
      newTargetCategoryServices = [...targetCategoryServices, updatedService];
    }

    // Rebuild services array maintaining category order
    const newServices: Service[] = [];
    for (const category of config.categoryOrder) {
      if (category === targetCategory) {
        newServices.push(...newTargetCategoryServices);
      } else {
        newServices.push(...otherServices.filter(s => s.category === category));
      }
    }
    // Add any uncategorized services
    const categorized = new Set(config.categoryOrder);
    newServices.push(...otherServices.filter(s => !categorized.has(s.category)));

    // Ensure target category exists in categoryOrder
    const categoryOrder = config.categoryOrder.includes(targetCategory)
      ? config.categoryOrder
      : [...config.categoryOrder, targetCategory];

    setConfig({ ...config, services: newServices, categoryOrder });
  };

  const reorderServicesInCategory = (category: string, fromIndex: number, toIndex: number) => {
    // Get services in this category with their original indices
    const categoryServices = config.services
      .map((s, i) => ({ service: s, originalIndex: i }))
      .filter(({ service }) => service.category === category);

    if (fromIndex < 0 || fromIndex >= categoryServices.length) return;
    if (toIndex < 0 || toIndex >= categoryServices.length) return;
    if (fromIndex === toIndex) return;

    // Reorder within category
    const [moved] = categoryServices.splice(fromIndex, 1);
    categoryServices.splice(toIndex, 0, moved);

    // Rebuild the full services array
    const newServices: Service[] = [];
    let categoryIndex = 0;
    
    for (const original of config.services) {
      if (original.category === category) {
        // Use the reordered service at this position
        newServices.push(categoryServices[categoryIndex].service);
        categoryIndex++;
      } else {
        newServices.push(original);
      }
    }

    setConfig({ ...config, services: newServices });
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

  const clips: Clip[] = config.clips ?? [];

  // O(1) lookup of a service's global index, rebuilt only when the
  // services array reference changes. Replaces the per-render O(n)
  // `findIndex` that CategorySection used for every rendered card.
  const serviceIndexByRef = useMemo(() => {
    const map = new Map<Service, number>();
    config.services.forEach((service, idx) => map.set(service, idx));
    return map;
  }, [config.services]);

  const setClips = (next: Clip[]) => {
    setConfig({ ...config, clips: next });
  };

  const generateClipId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const addClip = (label: string, content: string) => {
    const now = new Date().toISOString();
    const newClip: Clip = {
      id: generateClipId(),
      label: label.trim() || 'Untitled',
      content,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    setClips([newClip, ...clips]);
  };

  const updateClip = (id: string, patch: Partial<Pick<Clip, 'label' | 'content' | 'pinned'>>) => {
    const next = clips.map(c =>
      c.id === id
        ? { ...c, ...patch, updatedAt: new Date().toISOString() }
        : c
    );
    setClips(next);
  };

  const deleteClip = (id: string) => {
    setClips(clips.filter(c => c.id !== id));
  };

  const toggleClipPin = (id: string) => {
    const target = clips.find(c => c.id === id);
    if (!target) return;
    updateClip(id, { pinned: !target.pinned });
  };

  const reorderClips = (newOrder: Clip[]) => {
    setClips(newOrder);
  };

  const copyClipToSystemClipboard = async (content: string): Promise<boolean> => {
    // Async clipboard API is only available in secure contexts. Fall back to
    // the deprecated execCommand path for plain-HTTP homelab setups.
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(content);
        return true;
      } catch {
        // fall through to fallback
      }
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = content;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
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
      moveServiceToCategory,
      reorderServicesInCategory,
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
      setSearchQuery,
      serviceIndexByRef,
      clips,
      addClip,
      updateClip,
      deleteClip,
      toggleClipPin,
      reorderClips,
      copyClipToSystemClipboard,
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
