import { useState, useCallback, useMemo } from 'react';
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
  Search,
  Layers,
  ShieldAlert,
  Monitor,
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

type SectionKey = 'categories' | 'appearance' | 'notifications' | 'backups';

interface NavSectionItem {
  key: SectionKey;
  label: string;
  group: 'Dashboard' | 'System';
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const NAV_SECTIONS: NavSectionItem[] = [
  { key: 'categories', label: 'Categories', group: 'Dashboard', icon: Layout, description: 'Organize and reorder service categories' },
  { key: 'appearance', label: 'Appearance', group: 'Dashboard', icon: Palette, description: 'Themes, grid columns, custom colors and CSS' },
  { key: 'notifications', label: 'Notifications', group: 'System', icon: Bell, description: 'ntfy server, browser alerts and inbox' },
  { key: 'backups', label: 'Backups', group: 'System', icon: Database, description: 'Create, restore, import and export configurations' },
];

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { config, setConfig, reorderCategories, addCategory, updateCategory, deleteCategory, backups } = useDashboard();
  const confirm = useConfirm();
  const [active, setActive] = useState<SectionKey>('categories');
  const [searchQuery, setSearchQuery] = useState('');
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

  // Badge/dot per nav section
  const getBadgeForSection = (key: SectionKey): { count?: number; dot?: string } => {
    switch (key) {
      case 'categories':
        return { count: config.categoryOrder.length };
      case 'appearance':
        return { dot: config.theme === 'custom' ? 'var(--color-primary)' : undefined };
      case 'notifications':
        return { dot: config.notifications?.enabled ? 'var(--color-success)' : undefined };
      case 'backups':
        return { count: backups.length || undefined };
      default:
        return {};
    }
  };

  // Search filter over nav sections
  const filteredNavSections = useMemo(() => {
    if (!searchQuery.trim()) return NAV_SECTIONS;
    const q = searchQuery.toLowerCase();
    return NAV_SECTIONS.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.group.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const activeSectionMeta = useMemo(() => {
    return NAV_SECTIONS.find((s) => s.key === active) ?? NAV_SECTIONS[0];
  }, [active]);

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
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] w-full max-w-5xl shadow-2xl max-h-[90vh] sm:max-h-[86vh] flex flex-col overflow-hidden">

          {/* Header */}
          <header className="flex items-center gap-3 p-4 sm:p-5 border-b border-[var(--color-border)] flex-shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center flex-shrink-0 shadow-lg">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] transition-colors">
                  Settings
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Auto-save
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Configure your dashboard — changes apply and save automatically
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] text-[11px] text-[var(--color-text-secondary)]">
                <strong className="text-[var(--color-text-primary)]">{config.categoryOrder.length}</strong> categories
              </span>
              <button
                onClick={onClose}
                className="p-2 -m-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Body layout */}
          <div className="flex flex-1 min-h-0 flex-col sm:flex-row">

            {/* Left Navigation Sidebar */}
            <nav className="sm:w-60 sm:flex-shrink-0 sm:border-r border-[var(--color-border)] bg-[var(--color-background)]/50 sm:overflow-y-auto p-3 sm:p-4 flex sm:flex-col gap-1.5 border-t sm:border-t-0">
              {/* Search Input */}
              <div className="relative mb-1 sm:px-1 flex-shrink-0">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter settings…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '32px' }}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg pr-2.5 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                />
              </div>

              {/* Groups */}
              {(['Dashboard', 'System'] as const).map((groupName) => {
                const groupItems = filteredNavSections.filter((s) => s.group === groupName);
                if (groupItems.length === 0) return null;
                return (
                  <div key={groupName} className="flex flex-col gap-0.5">
                    <div className="hidden sm:block text-[10px] font-bold uppercase tracking-[0.8px] text-[var(--color-text-secondary)] px-2 pt-2 pb-1">
                      {groupName}
                    </div>
                    {groupItems.map((item) => {
                      const { count, dot } = getBadgeForSection(item.key);
                      const isActive = active === item.key;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setActive(item.key)}
                          className={`flex items-center gap-2.5 py-2 px-3 rounded-lg text-sm font-medium transition-all text-left ${
                            isActive
                              ? 'bg-[var(--color-primary)]/10 text-[var(--color-text-primary)] border border-[var(--color-primary)]/40'
                              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] border border-transparent'
                          }`}
                        >
                          <span className={`p-1.5 rounded-md flex-shrink-0 transition-colors ${
                            isActive
                              ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                              : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                          }`}>
                            <Icon className="w-3.5 h-3.5" />
                          </span>
                          <span className="truncate">{item.label}</span>
                          {count != null && count > 0 && (
                            <span className="ml-auto text-[10.5px] font-bold text-[var(--color-text-secondary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-1.5 py-0.5 tabular-nums">
                              {count}
                            </span>
                          )}
                          {dot && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dot, color: dot }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {/* Nav footer: monitoring pointer */}
              <div className="hidden sm:block mt-auto pt-3 border-t border-[var(--color-border)] px-1">
                <div className="p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                  <div className="flex items-center gap-1.5 mb-1 font-semibold text-[var(--color-text-primary)]">
                    <ShieldAlert className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                    Monitoring & hosts
                  </div>
                  Monitoring preferences (hosts, solar, docker, media, alerts…) live on the{' '}
                  <a href="/monitor" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
                    <Monitor className="inline w-3 h-3 -mt-0.5" /> monitor page
                  </a>.
                  Add or edit remote Glances endpoints in <strong className="text-[var(--color-text-primary)]">Server Stats</strong>.
                </div>
              </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[var(--color-surface)]">
              {/* Section Header */}
              <div className="mb-5 pb-4 border-b border-[var(--color-border)] flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
                    <activeSectionMeta.icon className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0" />
                    <span>{activeSectionMeta.label}</span>
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                    {activeSectionMeta.description}
                  </div>
                </div>

                {/* Quick actions */}
                {active === 'categories' && (
                  <button
                    onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 transition-colors text-sm flex-shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Add Category
                  </button>
                )}
                {active === 'backups' && (
                  <button
                    onClick={() => setShowBackupManager(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 transition-colors text-sm flex-shrink-0"
                  >
                    <Database className="w-4 h-4" />
                    Open Backup Manager
                  </button>
                )}
              </div>

              <div className="max-w-3xl">
                {/* ── CATEGORIES ── */}
                {active === 'categories' && (
                  <div className="space-y-2">
                    {config.categoryOrder.length === 0 ? (
                      <div className="text-center py-12 text-[var(--color-text-secondary)]">
                        <Layout className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">No categories yet</p>
                        <p className="text-xs mt-1">Add a category to start grouping your services</p>
                      </div>
                    ) : (
                      config.categoryOrder.map((category, idx) => {
                        const isFirst = idx === 0;
                        const isLast = idx === config.categoryOrder.length - 1;
                        return (
                          <div
                            key={category}
                            draggable
                            onDragStart={() => handleDragStart(category)}
                            onDragOver={(e) => handleDragOver(e, category)}
                            onDragEnd={() => setDraggedCategory(null)}
                            className={`flex items-center justify-between p-3 bg-[var(--color-background)] rounded-xl border sm:cursor-move transition-all ${
                              draggedCategory === category ? 'opacity-50 border-[var(--color-primary)]' : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/40'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <GripVertical className="hidden sm:block w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                              <span className="text-sm text-[var(--color-text-primary)] truncate">{category}</span>
                              <span className="text-xs text-[var(--color-text-secondary)] flex-shrink-0">
                                ({config.services.filter(s => s.category === category).length})
                              </span>
                            </div>
                            <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
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
                                onClick={() => { setEditingCategory(category); setShowCategoryModal(true); }}
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
                      })
                    )}
                  </div>
                )}

                {/* ── APPEARANCE ── */}
                {active === 'appearance' && (
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
                            <div
                              className="w-full rounded-lg mb-2 overflow-hidden"
                              style={{
                                backgroundColor: theme.colors.surface,
                                border: `1px solid ${theme.colors.border}`,
                              }}
                            >
                              <div className="h-1.5 w-full" style={{ backgroundColor: theme.colors.primary }} />
                              <div className="p-1.5 space-y-1">
                                <div className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: theme.colors.textPrimary, opacity: 0.8 }} />
                                <div className="h-1 w-1/2 rounded-full" style={{ backgroundColor: theme.colors.textSecondary, opacity: 0.6 }} />
                                <div className="flex gap-1 pt-0.5">
                                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.colors.primary }} />
                                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
                                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.colors.success }} />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <span className="text-xs font-medium block truncate" style={{ color: theme.colors.textPrimary }}>
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

                {/* ── NOTIFICATIONS ── */}
                {active === 'notifications' && <NotificationsSettings />}

                {/* ── BACKUPS ── */}
                {active === 'backups' && (
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
            </main>
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
