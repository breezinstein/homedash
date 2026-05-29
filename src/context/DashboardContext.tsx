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
  // Always-current snapshot of config so memoized callbacks can read the
  // latest state without taking `config` as a dependency (which would make
  // every handler — and therefore the context value — change each render).
  const configRef = useRef(config);
  configRef.current = config;

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

    const poll = async () => {
      // Skip work while the tab is hidden — nobody is looking and it just
      // burns requests/CPU. A visibilitychange listener triggers an immediate
      // catch-up poll when the tab becomes visible again.
      if (isSavingRef.current || document.hidden) return;

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
    };

    const checkInterval = setInterval(poll, pollMs);
    // Catch up immediately when the user returns to the tab.
    const onVisibility = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(checkInterval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
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

  // All mutators below read the live config from `configRef` rather than the
  // `config` closure, so they can be wrapped in useCallback with stable
  // identities. This keeps the context value (and therefore every consumer,
  // e.g. each ServiceCard) from re-rendering on unrelated state changes.
  const setConfig = useCallback((newConfig: DashboardConfig) => {
    const updated = {
      ...newConfig,
      metadata: {
        ...newConfig.metadata,
        lastModified: new Date().toISOString()
      }
    };
    setConfigState(updated);
    saveToServer(updated);
  }, [saveToServer]);

  const refreshBackups = useCallback(async () => {
    try {
      const serverBackups = await configApi.listBackups();
      setBackups(serverBackups);
    } catch (error) {
      console.error('Failed to load backups:', error);
    }
  }, []);

  const updateService = useCallback((index: number, service: Service) => {
    const cfg = configRef.current;
    const newServices = [...cfg.services];
    newServices[index] = service;
    setConfig({ ...cfg, services: newServices });
  }, [setConfig]);

  const addService = useCallback((service: Service) => {
    const cfg = configRef.current;
    const newServices = [...cfg.services, service];
    const categoryOrder = cfg.categoryOrder.includes(service.category)
      ? cfg.categoryOrder
      : [...cfg.categoryOrder, service.category];
    setConfig({ ...cfg, services: newServices, categoryOrder });
  }, [setConfig]);

  const deleteService = useCallback((index: number) => {
    const cfg = configRef.current;
    const newServices = cfg.services.filter((_, i) => i !== index);
    setConfig({ ...cfg, services: newServices });
  }, [setConfig]);

  const updateCategory = useCallback((oldName: string, newName: string) => {
    const cfg = configRef.current;
    const newServices = cfg.services.map(service =>
      service.category === oldName ? { ...service, category: newName } : service
    );
    const newCategoryOrder = cfg.categoryOrder.map(cat =>
      cat === oldName ? newName : cat
    );
    setConfig({ ...cfg, services: newServices, categoryOrder: newCategoryOrder });
  }, [setConfig]);

  const addCategory = useCallback((name: string) => {
    const cfg = configRef.current;
    if (!cfg.categoryOrder.includes(name)) {
      setConfig({ ...cfg, categoryOrder: [...cfg.categoryOrder, name] });
    }
  }, [setConfig]);

  const deleteCategory = useCallback((name: string) => {
    const cfg = configRef.current;
    const newServices = cfg.services.filter(s => s.category !== name);
    const newCategoryOrder = cfg.categoryOrder.filter(c => c !== name);
    setConfig({ ...cfg, services: newServices, categoryOrder: newCategoryOrder });
  }, [setConfig]);

  const reorderCategories = useCallback((newOrder: string[]) => {
    setConfig({ ...configRef.current, categoryOrder: newOrder });
  }, [setConfig]);

  const moveServiceToCategory = useCallback((serviceIndex: number, targetCategory: string, targetPosition?: number) => {
    const cfg = configRef.current;
    const service = cfg.services[serviceIndex];
    if (!service) return;

    // Update service category
    const updatedService = { ...service, category: targetCategory };
    
    // Get services in target category (excluding the moving service if it's already there)
    const targetCategoryServices = cfg.services.filter(
      (s, i) => s.category === targetCategory && i !== serviceIndex
    );
    
    // Get all other services
    const otherServices = cfg.services.filter(
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
    for (const category of cfg.categoryOrder) {
      if (category === targetCategory) {
        newServices.push(...newTargetCategoryServices);
      } else {
        newServices.push(...otherServices.filter(s => s.category === category));
      }
    }
    // Add any uncategorized services
    const categorized = new Set(cfg.categoryOrder);
    newServices.push(...otherServices.filter(s => !categorized.has(s.category)));

    // Ensure target category exists in categoryOrder
    const categoryOrder = cfg.categoryOrder.includes(targetCategory)
      ? cfg.categoryOrder
      : [...cfg.categoryOrder, targetCategory];

    setConfig({ ...cfg, services: newServices, categoryOrder });
  }, [setConfig]);

  const reorderServicesInCategory = useCallback((category: string, fromIndex: number, toIndex: number) => {
    const cfg = configRef.current;
    // Get services in this category with their original indices
    const categoryServices = cfg.services
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
    
    for (const original of cfg.services) {
      if (original.category === category) {
        // Use the reordered service at this position
        newServices.push(categoryServices[categoryIndex].service);
        categoryIndex++;
      } else {
        newServices.push(original);
      }
    }

    setConfig({ ...cfg, services: newServices });
  }, [setConfig]);

  const createBackup = useCallback(async (name?: string) => {
    try {
      await configApi.createBackup(name);
      await refreshBackups();
    } catch (error) {
      console.error('Failed to create backup:', error);
    }
  }, [refreshBackups]);

  const restoreBackup = useCallback(async (backup: ServerBackup) => {
    try {
      await configApi.restoreBackup(backup.filename);
      const { config: serverConfig, lastModified } = await configApi.getConfig();
      setConfigState(serverConfig);
      setCollapsedCategories(serverConfig.collapsedCategories || []);
      lastModifiedRef.current = lastModified;
    } catch (error) {
      console.error('Failed to restore backup:', error);
    }
  }, []);

  const deleteBackup = useCallback(async (filename: string) => {
    try {
      await configApi.deleteBackup(filename);
      await refreshBackups();
    } catch (error) {
      console.error('Failed to delete backup:', error);
    }
  }, [refreshBackups]);

  const uploadIcon = useCallback(async (file: File): Promise<string> => {
    const result = await configApi.uploadIcon(file);
    return result.url;
  }, []);

  const clips: Clip[] = useMemo(() => config.clips ?? [], [config.clips]);

  // O(1) lookup of a service's global index, rebuilt only when the
  // services array reference changes. Replaces the per-render O(n)
  // `findIndex` that CategorySection used for every rendered card.
  const serviceIndexByRef = useMemo(() => {
    const map = new Map<Service, number>();
    config.services.forEach((service, idx) => map.set(service, idx));
    return map;
  }, [config.services]);

  const setClips = useCallback((next: Clip[]) => {
    setConfig({ ...configRef.current, clips: next });
  }, [setConfig]);

  const generateClipId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const addClip = useCallback((label: string, content: string) => {
    const now = new Date().toISOString();
    const newClip: Clip = {
      id: generateClipId(),
      label: label.trim() || 'Untitled',
      content,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    setClips([newClip, ...(configRef.current.clips ?? [])]);
  }, [setClips]);

  const updateClip = useCallback((id: string, patch: Partial<Pick<Clip, 'label' | 'content' | 'pinned'>>) => {
    const next = (configRef.current.clips ?? []).map(c =>
      c.id === id
        ? { ...c, ...patch, updatedAt: new Date().toISOString() }
        : c
    );
    setClips(next);
  }, [setClips]);

  const deleteClip = useCallback((id: string) => {
    setClips((configRef.current.clips ?? []).filter(c => c.id !== id));
  }, [setClips]);

  const toggleClipPin = useCallback((id: string) => {
    const target = (configRef.current.clips ?? []).find(c => c.id === id);
    if (!target) return;
    updateClip(id, { pinned: !target.pinned });
  }, [updateClip]);

  const reorderClips = useCallback((newOrder: Clip[]) => {
    setClips(newOrder);
  }, [setClips]);

  const copyClipToSystemClipboard = useCallback(async (content: string): Promise<boolean> => {
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
  }, []);

  const importConfig = useCallback(async (file: File) => {
    const text = await file.text();
    const importedConfig = JSON.parse(text) as DashboardConfig;
    setConfig(importedConfig);
  }, [setConfig]);

  const exportConfig = useCallback(() => {
    const dataStr = JSON.stringify(configRef.current, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `homedash-config-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const toggleCategoryCollapse = useCallback((category: string) => {
    setCollapsedCategories(prev => {
      const newCollapsed = prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category];
      // Only store in localStorage, don't save to server (UI state only)
      localStorage.setItem('homedash-collapsed', JSON.stringify(newCollapsed));
      return newCollapsed;
    });
  }, []);

  // Memoize the context value so it only changes when a piece of state it
  // exposes actually changes. All callbacks above have stable identities, so
  // the dependency list is just the reactive values.
  const value = useMemo<DashboardContextType>(() => ({
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
  }), [
    config, setConfig, updateService, addService, deleteService, updateCategory,
    addCategory, deleteCategory, reorderCategories, moveServiceToCategory,
    reorderServicesInCategory, backups, createBackup, restoreBackup, deleteBackup,
    refreshBackups, importConfig, exportConfig, isEditMode, collapsedCategories,
    toggleCategoryCollapse, isLoading, isSyncing, lastSyncTime, syncError, uploadIcon,
    searchQuery, serviceIndexByRef, clips, addClip, updateClip, deleteClip,
    toggleClipPin, reorderClips, copyClipToSystemClipboard,
  ]);

  return (
    <DashboardContext.Provider value={value}>
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
