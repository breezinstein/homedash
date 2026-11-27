import { useEffect, useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useBackups } from '../context/BackupsContext';
import { Download, Image, Plus, RotateCcw, Save, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@ui-sdk/react/button';
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@ui-sdk/react/dialog';
import { configApi } from '../api/configApi';
import { useConfirm, useToast } from './ui';

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
  const { backups, createBackup, restoreBackup, deleteBackup, refreshBackups } = useBackups();
  const { importConfig, exportConfig } = useDashboard();
  const confirm = useConfirm();
  const toast = useToast();
  const [iconCacheInfo, setIconCacheInfo] = useState<IconCacheInfo | null>(null);
  const [clearingCache, setClearingCache] = useState(false);

  const loadIconCacheInfo = async () => {
    try {
      const info = await configApi.getIconCacheInfo();
      setIconCacheInfo(info);
    } catch (error) {
      console.error('Failed to load icon cache info:', error);
    }
  };

  useEffect(() => {
    refreshBackups();
    void loadIconCacheInfo();
    // The cache summary is a one-shot read when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (!file) return;
      try {
        await importConfig(file);
        toast.success('Configuration imported');
        onClose();
      } catch {
        toast.error('Import failed — is the file a valid HomeDash config?');
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
    if (!ok) return;
    try {
      await restoreBackup(backup);
      toast.success(`Restored "${backup.name}"`);
      onClose();
    } catch {
      toast.error('Restore failed');
    }
  };

  const handleDelete = async (filename: string) => {
    const ok = await confirm({
      title: 'Delete backup?',
      message: 'This backup will be permanently removed.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteBackup(filename);
      toast.success('Backup deleted');
    } catch {
      toast.error('Failed to delete backup');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogBackdrop className="ui-dialog-backdrop" />
      <DialogContent className="ui-dialog" data-size="lg">
        <div className="ui-dialog-head">
          <div className="min-w-0 flex-1">
            <DialogTitle className="ui-dialog-title">Backups</DialogTitle>
            <DialogDescription className="ui-dialog-description">
              Snapshot the dashboard config, or move it between instances.
            </DialogDescription>
          </div>
          <DialogClose aria-label="Close" className="ui-dialog-close">
            <X className="size-4" aria-hidden="true" />
          </DialogClose>
        </div>

        <div className="ui-dialog-body space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button className="ui-btn" data-variant="primary" data-size="sm" onClick={handleCreateBackup}>
              <Plus className="size-3.5" aria-hidden="true" /> Create backup
            </Button>
            <Button className="ui-btn" data-variant="secondary" data-size="sm" onClick={exportConfig}>
              <Download className="size-3.5" aria-hidden="true" /> Export config
            </Button>
            <Button className="ui-btn" data-variant="secondary" data-size="sm" onClick={handleImport}>
              <Upload className="size-3.5" aria-hidden="true" /> Import config
            </Button>
          </div>

          <section className="ui-panel-section">
            <div className="ui-panel-section-head">
              <Image className="size-3.5 text-[var(--color-primary)]" aria-hidden="true" />
              Icon cache
              <span className="ui-chip ml-auto tabular-nums">
                {iconCacheInfo ? `${iconCacheInfo.count} · ${iconCacheInfo.totalSizeFormatted}` : '…'}
              </span>
            </div>
            <div className="ui-row justify-between">
              <p className="text-xs text-[var(--color-text-secondary)]">
                Cached service icons served from /icons.
              </p>
              <Button
                className="ui-btn"
                data-variant="outline-danger"
                data-size="sm"
                onClick={() => { void handleClearIconCache(); }}
                disabled={clearingCache || !iconCacheInfo || iconCacheInfo.count === 0}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                {clearingCache ? 'Clearing…' : 'Clear cache'}
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Save className="size-3.5 text-[var(--color-text-secondary)]" aria-hidden="true" />
              <h3 className="text-[0.8125rem] font-semibold">Saved backups</h3>
              <span className="ui-chip tabular-nums">{backups.length}</span>
            </div>

            {backups.length === 0 ? (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-3 py-8 text-center">
                <Save className="mx-auto mb-2 size-8 text-[var(--color-text-secondary)] opacity-50" aria-hidden="true" />
                <p className="text-sm text-[var(--color-text-primary)]">No backups yet</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Create a backup to save your current configuration.
                </p>
              </div>
            ) : (
              <div className="ui-panel-section">
                {backups.map((backup) => (
                  <div key={`${backup.name}-${backup.date}`} className="ui-row justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-[0.8125rem] font-medium">{backup.name}</p>
                      <p className="ui-row-dim truncate">
                        {new Date(backup.date).toLocaleString()} · {backup.serviceCount} services
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        className="ui-btn"
                        data-variant="primary"
                        data-size="sm"
                        onClick={() => { void handleRestore(backup); }}
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" /> Restore
                      </Button>
                      <Button
                        className="ui-btn"
                        data-variant="ghost"
                        data-size="icon"
                        onClick={() => { void handleDelete(backup.filename); }}
                        aria-label={`Delete ${backup.name}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
