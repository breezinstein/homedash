import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { configApi } from '../api/configApi';
import { useAuth } from './AuthContext';

export interface ServerBackup {
  name: string;
  date: string;
  filename: string;
  serviceCount: number;
}

interface BackupsContextType {
  backups: ServerBackup[];
  createBackup: (name?: string) => Promise<void>;
  restoreBackup: (backup: ServerBackup) => Promise<void>;
  deleteBackup: (filename: string) => Promise<void>;
  refreshBackups: () => Promise<void>;
}

const BackupsContext = createContext<BackupsContextType | null>(null);

interface BackupsProviderProps {
  children: ReactNode;
  /** Reload the dashboard config after a restore replaces it on disk. */
  onRestored: () => Promise<void>;
}

/**
 * Backup operations and the admin-only backup list. Kept separate from the
 * dashboard config context so backup refreshes don't re-render every service
 * card. Failures are re-thrown so callers can surface an error toast.
 */
export function BackupsProvider({ children, onRestored }: BackupsProviderProps) {
  const { authenticated, authEnabled, ready: authReady } = useAuth();
  const [backups, setBackups] = useState<ServerBackup[]>([]);

  const canWriteRef = useRef(false);
  canWriteRef.current = authReady && (!authEnabled || authenticated);

  const refreshBackups = useCallback(async () => {
    // /api/backups is admin-gated; skip the request entirely when not
    // authenticated so anonymous viewers don't trigger a 401 + login modal.
    if (!canWriteRef.current) {
      setBackups([]);
      return;
    }
    try {
      const serverBackups = await configApi.listBackups();
      setBackups(serverBackups);
    } catch (error) {
      console.error('Failed to load backups:', error);
    }
  }, []);

  // Load once auth has resolved and re-fetch on sign-in/out transitions.
  useEffect(() => {
    if (!authReady) return;
    void refreshBackups();
  }, [authReady, authenticated, refreshBackups]);

  const createBackup = useCallback(async (name?: string) => {
    try {
      await configApi.createBackup(name);
      await refreshBackups();
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw error;
    }
  }, [refreshBackups]);

  const restoreBackup = useCallback(async (backup: ServerBackup) => {
    try {
      await configApi.restoreBackup(backup.filename);
      await onRestored();
    } catch (error) {
      console.error('Failed to restore backup:', error);
      throw error;
    }
  }, [onRestored]);

  const deleteBackup = useCallback(async (filename: string) => {
    try {
      await configApi.deleteBackup(filename);
      await refreshBackups();
    } catch (error) {
      console.error('Failed to delete backup:', error);
      throw error;
    }
  }, [refreshBackups]);

  const value = useMemo<BackupsContextType>(() => ({
    backups,
    createBackup,
    restoreBackup,
    deleteBackup,
    refreshBackups,
  }), [backups, createBackup, restoreBackup, deleteBackup, refreshBackups]);

  return (
    <BackupsContext.Provider value={value}>
      {children}
    </BackupsContext.Provider>
  );
}

export function useBackups() {
  const context = useContext(BackupsContext);
  if (!context) {
    throw new Error('useBackups must be used within a BackupsProvider');
  }
  return context;
}
