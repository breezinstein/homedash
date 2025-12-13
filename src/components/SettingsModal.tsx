import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { X, GripVertical, Plus, Trash2, Edit2, Palette, Layout, Database, Check, ChevronDown, ChevronUp, Sun, Moon } from 'lucide-react';
import { CategoryModal } from './CategoryModal';
import { BackupManager } from './BackupManager';
import { themePresets } from '../themes';
import type { ThemePreset } from '../themes';

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
  const [showCustomColors, setShowCustomColors] = useState(config.theme === 'custom');
  const [themeFilter, setThemeFilter] = useState<'all' | 'dark' | 'light'>('all');

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

  const handleThemeSelect = (theme: ThemePreset) => {
    setConfig({
      ...config,
      theme: theme.name,
      colors: { ...theme.colors },
    });
    setShowCustomColors(false);
  };

  const handleCustomTheme = () => {
    setConfig({ ...config, theme: 'custom' });
    setShowCustomColors(true);
  };

  const filteredThemes = themePresets.filter(
    (theme) => themeFilter === 'all' || theme.type === themeFilter
  );

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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] w-full max-w-2xl shadow-2xl max-h-[90vh] sm:max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[var(--color-border)]">
            <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
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
          <div className="flex border-b border-[var(--color-border)] overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden xs:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            {/* Categories Tab */}
            {activeTab === 'categories' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
                    Drag to reorder categories
                  </p>
                  <button
                    onClick={() => {
                      setEditingCategory(null);
                      setShowCategoryModal(true);
                    }}
                    className="flex items-center justify-center gap-2 px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 transition-colors text-sm"
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
                      className={`flex items-center justify-between p-2.5 sm:p-3 bg-[var(--color-background)] rounded-xl border border-[var(--color-border)] cursor-move transition-opacity ${
                        draggedCategory === category ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <GripVertical className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                        <span className="text-sm text-[var(--color-text-primary)] truncate">{category}</span>
                        <span className="text-xs text-[var(--color-text-secondary)] flex-shrink-0">
                          ({config.services.filter(s => s.category === category).length})
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
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
                  <label className="block text-xs sm:text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                    Grid Columns
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['2', '3', '4', '5'].map((cols) => (
                      <button
                        key={cols}
                        onClick={() => handleGridChange(cols)}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors ${
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

                {/* Theme Selection */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                    Theme
                  </label>
                  
                  {/* Theme Filter */}
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setThemeFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                        themeFilter === 'all'
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-background)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setThemeFilter('dark')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                        themeFilter === 'dark'
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-background)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      Dark
                    </button>
                    <button
                      onClick={() => setThemeFilter('light')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                        themeFilter === 'light'
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-background)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      Light
                    </button>
                  </div>

                  {/* Theme Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 max-h-48 overflow-y-auto">
                    {filteredThemes.map((theme) => (
                      <button
                        key={theme.name}
                        onClick={() => handleThemeSelect(theme)}
                        className={`relative p-2.5 sm:p-3 rounded-xl border transition-all text-left ${
                          config.theme === theme.name
                            ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20'
                            : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                        }`}
                        style={{ backgroundColor: theme.colors.background }}
                      >
                        {/* Color Preview */}
                        <div className="flex gap-1 mb-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: theme.colors.primary }}
                          />
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: theme.colors.accent }}
                          />
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: theme.colors.surface }}
                          />
                        </div>
                        <span
                          className="text-xs sm:text-sm font-medium block truncate"
                          style={{ color: theme.colors.textPrimary }}
                        >
                          {theme.name}
                        </span>
                        <span
                          className="text-xs capitalize"
                          style={{ color: theme.colors.textSecondary }}
                        >
                          {theme.type}
                        </span>
                        {config.theme === theme.name && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Theme Toggle */}
                <div>
                  <button
                    onClick={handleCustomTheme}
                    className={`flex items-center justify-between w-full p-3 rounded-xl border transition-colors ${
                      config.theme === 'custom'
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                        : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-[var(--color-primary)]" />
                      <span className="text-sm text-[var(--color-text-primary)]">Custom Theme</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {config.theme === 'custom' && (
                        <Check className="w-4 h-4 text-[var(--color-primary)]" />
                      )}
                      {showCustomColors ? (
                        <ChevronUp className="w-4 h-4 text-[var(--color-text-secondary)]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
                      )}
                    </div>
                  </button>
                </div>

                {/* Custom Colors (collapsible) */}
                {showCustomColors && (
                  <div className="space-y-3 p-3 bg-[var(--color-background)] rounded-xl border border-[var(--color-border)]">
                    <label className="block text-xs sm:text-sm font-medium text-[var(--color-text-secondary)]">
                      Custom Colors
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {colorOptions.map((option) => (
                        <div key={option.key} className="flex items-center gap-2">
                          <input
                            type="color"
                            value={config.colors[option.key]}
                            onChange={(e) => handleColorChange(option.key, e.target.value)}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-[var(--color-border)] cursor-pointer bg-transparent flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="text-xs sm:text-sm text-[var(--color-text-primary)] block truncate">
                              {option.label}
                            </span>
                            <span className="text-xs text-[var(--color-text-secondary)] hidden sm:block">
                              {config.colors[option.key]}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Backups Tab */}
            {activeTab === 'backups' && (
              <div className="space-y-4">
                <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
                  Create and manage configuration backups
                </p>
                <button
                  onClick={() => setShowBackupManager(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 transition-colors text-sm"
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
