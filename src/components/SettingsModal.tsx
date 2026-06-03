import { useState, useCallback } from 'react';
import { useDashboard } from '../context/DashboardContext';
import {
  X,
  GripVertical,
  Plus,
  Trash2,
  Edit2,
  Palette,
  Layout,
  Database,
  Check,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  ArrowUp,
  ArrowDown,
  Code2,
  Bell,
} from 'lucide-react';
import { CategoryModal } from './CategoryModal';
import { BackupManager } from './BackupManager';
import { NotificationsSettings } from './notifications/NotificationsSettings';
import { themePresets } from '../themes';
import type { ThemePreset } from '../themes';
import type { Colors } from '../types';
import { ModalShell, useConfirm } from './ui';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { config, setConfig, reorderCategories, addCategory, updateCategory, deleteCategory } = useDashboard();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<'categories' | 'appearance' | 'backups' | 'notifications'>('categories');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBackupManager, setShowBackupManager] = useState(false);
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [showCustomColors, setShowCustomColors] = useState(config.theme === 'custom');
  const [themeFilter, setThemeFilter] = useState<'all' | 'dark' | 'light'>('all');
  const [showCustomCSS, setShowCustomCSS] = useState(false);

  // Temporarily apply colors to CSS vars for hover preview without saving.
  const applyColorsToCSSVars = useCallback((colors: Colors) => {
    const root = document.documentElement;
    Object.entries(colors).forEach(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      root.style.setProperty(`--color-${cssKey}`, value as string);
    });
  }, []);

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

  // Touch-friendly reorder: swap with the neighbor in the given direction.
  // This is the only way to reorder categories on mobile, since HTML5
  // drag-and-drop doesn't fire on touch.
  const moveCategory = (category: string, direction: -1 | 1) => {
    const idx = config.categoryOrder.indexOf(category);
    const targetIdx = idx + direction;
    if (idx === -1 || targetIdx < 0 || targetIdx >= config.categoryOrder.length) return;
    const next = [...config.categoryOrder];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    reorderCategories(next);
  };

  const handleCategorySave = (oldName: string | null, newName: string) => {
    if (oldName) {
      updateCategory(oldName, newName);
    } else {
      addCategory(newName);
    }
  };

  const handleDeleteCategory = async (category: string) => {
    const ok = await confirm({
      title: 'Delete category?',
      message: `"${category}" and all its services will be removed. This can't be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (ok) deleteCategory(category);
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
    // Apply immediately so the UI doesn't flicker back from the hover preview
    applyColorsToCSSVars(theme.colors);
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
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'backups' as const, label: 'Backups', icon: Database },
  ];

  const colorOptions = [
    { key: 'primary' as const, label: 'Primary' },
    { key: 'accent' as const, label: 'Accent' },
    { key: 'secondary' as const, label: 'Secondary' },
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
      <ModalShell onClose={onClose} ariaLabel="Settings">
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] w-full max-w-2xl shadow-2xl max-h-[90vh] sm:max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[var(--color-border)]">
            <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
              Settings
            </h2>
            <button
              onClick={onClose}
              className="p-2 -m-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
              aria-label="Close"
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
                <span>{tab.label}</span>
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
                  {config.categoryOrder.map((category, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === config.categoryOrder.length - 1;
                    return (
                      <div
                        key={category}
                        draggable
                        onDragStart={() => handleDragStart(category)}
                        onDragOver={(e) => handleDragOver(e, category)}
                        onDragEnd={() => setDraggedCategory(null)}
                        className={`flex items-center justify-between p-2.5 sm:p-3 bg-[var(--color-background)] rounded-xl border border-[var(--color-border)] sm:cursor-move transition-opacity ${
                          draggedCategory === category ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <GripVertical className="hidden sm:block w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                          <span className="text-sm text-[var(--color-text-primary)] truncate">{category}</span>
                          <span className="text-xs text-[var(--color-text-secondary)] flex-shrink-0">
                            ({config.services.filter(s => s.category === category).length})
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                          {/* Touch-friendly reorder; visible on every screen so it's
                              discoverable, while the drag handle remains the primary
                              affordance on desktop. */}
                          <button
                            onClick={() => moveCategory(category, -1)}
                            disabled={isFirst}
                            className="p-2 sm:p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label={`Move ${category} up`}
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => moveCategory(category, 1)}
                            disabled={isLast}
                            className="p-2 sm:p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label={`Move ${category} down`}
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingCategory(category);
                              setShowCategoryModal(true);
                            }}
                            className="p-2 sm:p-1.5 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-colors"
                            aria-label={`Edit ${category}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category)}
                            className="p-2 sm:p-1.5 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 rounded-lg transition-colors"
                            aria-label={`Delete ${category}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
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
                    {['2', '3', '4', '5', '6'].map((cols) => (
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 max-h-64 overflow-y-auto">
                    {filteredThemes.map((theme) => (
                      <button
                        key={theme.name}
                        onClick={() => handleThemeSelect(theme)}
                        onMouseEnter={() => applyColorsToCSSVars(theme.colors)}
                        onMouseLeave={() => applyColorsToCSSVars(config.colors)}
                        className={`relative p-2.5 sm:p-3 rounded-xl border transition-all text-left ${
                          config.theme === theme.name
                            ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20'
                            : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                        }`}
                        style={{ backgroundColor: theme.colors.background }}
                        title={`Preview ${theme.name}`}
                      >
                        {/* Mini dashboard mockup */}
                        <div
                          className="w-full rounded-lg mb-2 overflow-hidden"
                          style={{
                            backgroundColor: theme.colors.surface,
                            border: `1px solid ${theme.colors.border}`,
                          }}
                        >
                          {/* Primary accent bar */}
                          <div
                            className="h-1.5 w-full"
                            style={{ backgroundColor: theme.colors.primary }}
                          />
                          <div className="p-1.5 space-y-1">
                            {/* Simulated text-primary line */}
                            <div
                              className="h-1.5 w-3/4 rounded-full"
                              style={{ backgroundColor: theme.colors.textPrimary, opacity: 0.8 }}
                            />
                            {/* Simulated text-secondary line */}
                            <div
                              className="h-1 w-1/2 rounded-full"
                              style={{ backgroundColor: theme.colors.textSecondary, opacity: 0.6 }}
                            />
                            {/* Accent dot row */}
                            <div className="flex gap-1 pt-0.5">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.colors.primary }} />
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.colors.success }} />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <span
                              className="text-xs font-medium block truncate"
                              style={{ color: theme.colors.textPrimary }}
                            >
                              {theme.name}
                            </span>
                            <span className="text-xs capitalize flex items-center gap-0.5" style={{ color: theme.colors.textSecondary }}>
                              {theme.type === 'dark' ? <Moon className="w-2.5 h-2.5" /> : <Sun className="w-2.5 h-2.5" />}
                              {theme.type}
                            </span>
                          </div>
                          {config.theme === theme.name && (
                            <div className="w-4 h-4 shrink-0 bg-[var(--color-primary)] rounded-full flex items-center justify-center mt-0.5">
                              <Check className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </div>
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

                {/* Custom CSS */}
                <div>
                  <button
                    onClick={() => setShowCustomCSS((v) => !v)}
                    className={`flex items-center justify-between w-full p-3 rounded-xl border transition-colors ${
                      showCustomCSS
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                        : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-[var(--color-primary)]" />
                      <span className="text-sm text-[var(--color-text-primary)]">Custom CSS</span>
                      {config.settings?.customCSS?.trim() && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-primary)]/20 text-[var(--color-primary)]">
                          active
                        </span>
                      )}
                    </div>
                    {showCustomCSS ? (
                      <ChevronUp className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    )}
                  </button>

                  {showCustomCSS && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        Injected after theme styles. Changes apply live.
                      </p>
                      <textarea
                        value={config.settings?.customCSS ?? ''}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            settings: { ...config.settings, customCSS: e.target.value },
                          })
                        }
                        placeholder={`:root {\n  --color-primary: #ff6b6b;\n}\n\n.my-custom-style { ... }`}
                        spellCheck={false}
                        rows={8}
                        className="w-full bg-[var(--color-background)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-xl p-3 text-xs font-mono resize-y focus:outline-none focus:border-[var(--color-primary)] placeholder:text-[var(--color-text-secondary)]/50"
                      />
                      {config.settings?.customCSS?.trim() && (
                        <button
                          onClick={() =>
                            setConfig({
                              ...config,
                              settings: { ...config.settings, customCSS: '' },
                            })
                          }
                          className="text-xs text-[var(--color-error)] hover:underline"
                        >
                          Clear custom CSS
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && <NotificationsSettings />}

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
      </ModalShell>

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
