import { useEffect } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { X, Download, Upload, Trash2, RotateCcw, Save, Plus } from 'lucide-react';

interface ServerBackup {
  name: string;
  date: string;
  filename: string;
  serviceCount: number;
}

interface BackupManagerProps {
  onClose: () => void;
}

export function BackupManager({ onClose }: BackupManagerProps) {
  const { backups, createBackup, restoreBackup, deleteBackup, refreshBackups, importConfig, exportConfig } = useDashboard();

  useEffect(() => {
    refreshBackups();
  }, []);

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await importConfig(file);
        onClose();
      }
    };
    input.click();
  };

  const handleRestore = async (backup: ServerBackup) => {
    if (confirm(`Restore configuration from "${backup.name}"? Current configuration will be overwritten.`)) {
      await restoreBackup(backup);
      onClose();
    }
  };

  const handleDelete = async (filename: string) => {
    if (confirm('Delete this backup?')) {
      await deleteBackup(filename);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Backup Manager
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-[var(--color-border)]">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => createBackup()}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-success)] text-white rounded-lg hover:bg-[var(--color-success)]/80 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Backup
            </button>
            <button
              onClick={exportConfig}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Config
            </button>
            <button
              onClick={handleImport}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent)]/80 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import Config
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
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
                  className="flex items-center justify-between p-4 bg-[var(--color-background)] rounded-xl border border-[var(--color-border)]"
                >
                  <div>
                    <h3 className="font-medium text-[var(--color-text-primary)]">
                      {backup.name}
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {formatDate(backup.date)} • {backup.serviceCount} services
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestore(backup)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restore
                    </button>
                    <button
                      onClick={() => handleDelete(backup.filename)}
                      className="p-1.5 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 rounded-lg transition-colors"
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
  );
}
