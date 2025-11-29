import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { X, GripVertical, Plus, Trash2, Edit2, Palette, Layout, Database } from 'lucide-react';
import { CategoryModal } from './CategoryModal';
import { BackupManager } from './BackupManager';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { config, setConfig, reorderCategories, addCategory, updateCategory, deleteCategory } = useDashboard();
  const [activeTab, setActiveTab] = useState<'categories' | 'appearance' | 'backups'>('categories');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBackupManager, setShowBackupManager] = useState(false);
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);

  const handleDragStart = (category: string) => {
    setDraggedCategory(category);
  };

  const handleDragOver = (e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    if (draggedCategory && draggedCategory !== targetCategory) {
      const newOrder = [...config.categoryOrder];
      const draggedIndex = newOrder.indexOf(draggedCategory);
      const targetIndex = newOrder.indexOf(targetCategory);
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedCategory);
      reorderCategories(newOrder);
    }
  };

  const handleCategorySave = (oldName: string | null, newName: string) => {
    if (oldName) {
      updateCategory(oldName, newName);
    } else {
      addCategory(newName);
    }
  };

  const handleColorChange = (key: keyof typeof config.colors, value: string) => {
    setConfig({
      ...config,
      colors: {
        ...config.colors,
        [key]: value
      }
    });
  };

  const handleGridChange = (columns: string) => {
    setConfig({ ...config, gridColumns: columns });
  };

  const tabs = [
    { id: 'categories' as const, label: 'Categories', icon: Layout },
    { id: 'appearance' as const, label: 'Appearance', icon: Palette },
    { id: 'backups' as const, label: 'Backups', icon: Database },
  ];

  const colorOptions = [
    { key: 'primary' as const, label: 'Primary' },
    { key: 'accent' as const, label: 'Accent' },
    { key: 'background' as const, label: 'Background' },
    { key: 'surface' as const, label: 'Surface' },
    { key: 'border' as const, label: 'Border' },
    { key: 'textPrimary' as const, label: 'Text Primary' },
    { key: 'textSecondary' as const, label: 'Text Secondary' },
    { key: 'success' as const, label: 'Success' },
    { key: 'warning' as const, label: 'Warning' },
    { key: 'error' as const, label: 'Error' },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Settings
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[var(--color-border)]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Categories Tab */}
            {activeTab === 'categories' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Drag to reorder categories
                  </p>
                  <button
                    onClick={() => {
                      setEditingCategory(null);
                      setShowCategoryModal(true);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Category
                  </button>
                </div>

                <div className="space-y-2">
                  {config.categoryOrder.map((category) => (
                    <div
                      key={category}
                      draggable
                      onDragStart={() => handleDragStart(category)}
                      onDragOver={(e) => handleDragOver(e, category)}
                      onDragEnd={() => setDraggedCategory(null)}
                      className={`flex items-center justify-between p-3 bg-[var(--color-background)] rounded-xl border border-[var(--color-border)] cursor-move transition-opacity ${
                        draggedCategory === category ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        <span className="text-[var(--color-text-primary)]">{category}</span>
                        <span className="text-sm text-[var(--color-text-secondary)]">
                          ({config.services.filter(s => s.category === category).length} services)
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingCategory(category);
                            setShowCategoryModal(true);
                          }}
                          className="p-1.5 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete category "${category}" and all its services?`)) {
                              deleteCategory(category);
                            }
                          }}
                          className="p-1.5 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                {/* Grid Columns */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                    Grid Columns
                  </label>
                  <div className="flex gap-2">
                    {['2', '3', '4', '5'].map((cols) => (
                      <button
                        key={cols}
                        onClick={() => handleGridChange(cols)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          config.gridColumns === cols
                            ? 'bg-[var(--color-primary)] text-white'
                            : 'bg-[var(--color-background)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                        }`}
                      >
                        {cols}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Colors */}
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                    Colors
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {colorOptions.map((option) => (
                      <div key={option.key} className="flex items-center gap-3">
                        <input
                          type="color"
                          value={config.colors[option.key]}
                          onChange={(e) => handleColorChange(option.key, e.target.value)}
                          className="w-10 h-10 rounded-lg border border-[var(--color-border)] cursor-pointer bg-transparent"
                        />
                        <div>
                          <span className="text-sm text-[var(--color-text-primary)]">
                            {option.label}
                          </span>
                          <span className="block text-xs text-[var(--color-text-secondary)]">
                            {config.colors[option.key]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Backups Tab */}
            {activeTab === 'backups' && (
              <div className="space-y-4">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Create and manage configuration backups
                </p>
                <button
                  onClick={() => setShowBackupManager(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 transition-colors"
                >
                  <Database className="w-4 h-4" />
                  Open Backup Manager
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCategoryModal && (
        <CategoryModal
          category={editingCategory}
          onSave={handleCategorySave}
          onClose={() => setShowCategoryModal(false)}
        />
      )}

      {showBackupManager && (
        <BackupManager onClose={() => setShowBackupManager(false)} />
      )}
    </>
  );
}
