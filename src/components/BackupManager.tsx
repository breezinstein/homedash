import { useEffect, useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { X, Download, Upload, Trash2, RotateCcw, Save, Plus, Image } from 'lucide-react';
import { configApi } from '../api/configApi';
import { ModalShell, useConfirm, useToast } from './ui';

interface ServerBackup {
  name: string;
  date: string;
  filename: string;
  serviceCount: number;
}

interface IconCacheInfo {
  count: number;
  totalSize: number;
  totalSizeFormatted: string;
}

interface BackupManagerProps {
  onClose: () => void;
}

export function BackupManager({ onClose }: BackupManagerProps) {
  const { backups, createBackup, restoreBackup, deleteBackup, refreshBackups, importConfig, exportConfig } = useDashboard();
  const confirm = useConfirm();
  const toast = useToast();
  const [iconCacheInfo, setIconCacheInfo] = useState<IconCacheInfo | null>(null);
  const [clearingCache, setClearingCache] = useState(false);

  useEffect(() => {
    refreshBackups();
    loadIconCacheInfo();
  }, []);

  const loadIconCacheInfo = async () => {
    try {
      const info = await configApi.getIconCacheInfo();
      setIconCacheInfo(info);
    } catch (error) {
      console.error('Failed to load icon cache info:', error);
    }
  };

  const handleClearIconCache = async () => {
    const ok = await confirm({
      title: 'Clear icon cache?',
      message: 'All cached icons will be removed. They will be re-downloaded the next time they are needed.',
      confirmLabel: 'Clear cache',
      tone: 'danger',
    });
    if (!ok) return;

    setClearingCache(true);
    try {
      await configApi.clearIconCache();
      await loadIconCacheInfo();
      toast.success('Icon cache cleared');
    } catch (error) {
      console.error('Failed to clear icon cache:', error);
      toast.error('Failed to clear icon cache');
    } finally {
      setClearingCache(false);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          await importConfig(file);
          toast.success('Configuration imported');
          onClose();
        } catch {
          toast.error('Import failed — is the file a valid HomeDash config?');
        }
      }
    };
    input.click();
  };

  const handleCreateBackup = async () => {
    try {
      await createBackup();
      toast.success('Backup created');
    } catch {
      toast.error('Failed to create backup');
    }
  };

  const handleRestore = async (backup: ServerBackup) => {
    const ok = await confirm({
      title: 'Restore from backup?',
      message: `Your current configuration will be replaced with "${backup.name}". This can't be undone.`,
      confirmLabel: 'Restore',
      tone: 'danger',
    });
    if (ok) {
      try {
        await restoreBackup(backup);
        toast.success(`Restored "${backup.name}"`);
        onClose();
      } catch {
        toast.error('Restore failed');
      }
    }
  };

  const handleDelete = async (filename: string) => {
    const ok = await confirm({
      title: 'Delete backup?',
      message: 'This backup will be permanently removed.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (ok) {
      try {
        await deleteBackup(filename);
        toast.success('Backup deleted');
      } catch {
        toast.error('Failed to delete backup');
      }
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <ModalShell onClose={onClose} ariaLabel="Backup manager">
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] w-full max-w-2xl shadow-2xl max-h-[90vh] sm:max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Backup Manager
          </h2>
          <button
            onClick={onClose}
            className="p-2 -m-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-[var(--color-border)]">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCreateBackup}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-success)] text-white rounded-lg hover:bg-[var(--color-success)]/80 active:bg-[var(--color-success)]/80 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Create Backup
            </button>
            <button
              onClick={exportConfig}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 active:bg-[var(--color-primary)]/80 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Export Config
            </button>
            <button
              onClick={handleImport}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent)]/80 active:bg-[var(--color-accent)]/80 transition-colors text-sm"
            >
              <Upload className="w-4 h-4" />
              Import Config
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Icon Cache Section */}
          <div className="p-4 bg-[var(--color-background)] rounded-xl border border-[var(--color-border)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center flex-shrink-0">
                  <Image className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-[var(--color-text-primary)]">Icon Cache</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {iconCacheInfo
                      ? `${iconCacheInfo.count} icons • ${iconCacheInfo.totalSizeFormatted}`
                      : 'Loading...'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClearIconCache}
                disabled={clearingCache || !iconCacheInfo || iconCacheInfo.count === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--color-error)] hover:bg-[var(--color-error)]/10 active:bg-[var(--color-error)]/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-start sm:self-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {clearingCache ? 'Clearing...' : 'Clear Cache'}
              </button>
            </div>
          </div>

          {/* Backups Section */}
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Backups</h3>
            {backups.length === 0 ? (
              <div className="text-center py-8 text-[var(--color-text-secondary)]">
                <Save className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No backups yet</p>
                <p className="text-sm">Create a backup to save your current configuration</p>
              </div>
            ) : (
              <div className="space-y-3">
                {backups.map((backup) => (
                  <div
                    key={`${backup.name}-${backup.date}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 bg-[var(--color-background)] rounded-xl border border-[var(--color-border)]"
                  >
                    <div className="min-w-0">
                      <h3 className="font-medium text-[var(--color-text-primary)] truncate">
                        {backup.name}
                      </h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {formatDate(backup.date)} • {backup.serviceCount} services
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleRestore(backup)}
                        className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 active:bg-[var(--color-primary)]/80 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restore
                      </button>
                      <button
                        onClick={() => handleDelete(backup.filename)}
                        className="p-2 sm:p-1.5 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 active:bg-[var(--color-error)]/10 rounded-lg transition-colors"
                        aria-label="Delete backup"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
