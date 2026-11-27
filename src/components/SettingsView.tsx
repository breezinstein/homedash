import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useBackups } from '../context/BackupsContext';
import {
  GripVertical,
  Plus,
  Trash2,
  Edit2,
  Palette,
  Layout,
  Database,
  Check,
  ChevronDown,
  Sun,
  Server,
  Moon,
  ArrowUp,
  ArrowDown,
  Code2,
  Bell,
  Search,
  ShieldAlert,
  Monitor,
} from 'lucide-react';
import { Button } from '@ui-sdk/react/button';
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@ui-sdk/react/collapsible';
import { Field, FieldLabel } from '@ui-sdk/react/field';
import { Input } from '@ui-sdk/react/input';
import { Radio, RadioGroup } from '@ui-sdk/react/radio';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from '@ui-sdk/react/segmented-control';
import { Separator } from '@ui-sdk/react/separator';
import { Textarea } from '@ui-sdk/react/textarea';
import { CategoryModal } from './CategoryModal';
import { BackupManager } from './BackupManager';
import { NotificationsSettings } from './notifications/NotificationsSettings';
import { getThemeByName, themePresets } from '../themes';
import type { ThemePreset } from '../themes';
import { applyThemeAttribute, applyThemeColors } from '../lib/theme';
import { useConfirm } from './ui';
import { PageHeader, PagePanel } from './shell/PageHeader';
import { RemoteServersSection } from './settings/RemoteServersSection';
import { InvertersSection } from './settings/InvertersSection';

export type SectionKey = 'categories' | 'appearance' | 'notifications' | 'backups' | 'servers' | 'inverters';

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
  { key: 'servers', label: 'Remote servers', group: 'System', icon: Server, description: 'Glances endpoints for the server stats view' },
  { key: 'inverters', label: 'Inverters', group: 'System', icon: Sun, description: 'Solar Assistant devices for the inverter view' },
  { key: 'notifications', label: 'Notifications', group: 'System', icon: Bell, description: 'ntfy server, browser alerts and inbox' },
  { key: 'backups', label: 'Backups', group: 'System', icon: Database, description: 'Create, restore, import and export configurations' },
];

interface SettingsViewProps {
  /** Section to open on mount, e.g. the one a tool's “Manage” link points at. */
  initialSection?: SectionKey;
}

export function SettingsView({ initialSection }: SettingsViewProps) {
  const { config, setConfig, reorderCategories, addCategory, updateCategory, deleteCategory } = useDashboard();
  const { backups } = useBackups();
  const confirm = useConfirm();
  const [active, setActive] = useState<SectionKey>(initialSection ?? 'categories');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBackupManager, setShowBackupManager] = useState(false);
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [showCustomColors, setShowCustomColors] = useState(config.theme === 'custom');
  const [themeFilter, setThemeFilter] = useState<'all' | 'dark' | 'light'>('all');
  const [showCustomCSS, setShowCustomCSS] = useState(false);

  // Hovering a preset previews both its colour tokens and its scoped CSS
  // (fonts, frames, panel styling), not just the colours.
  const applyThemePreview = useCallback((theme?: ThemePreset | null) => {
    const target = theme ?? config;
    applyThemeColors(target.colors);
    applyThemeAttribute(theme?.name ?? config.theme);
  }, [config]);

  // If the modal closes while a theme card is hovered, restore the saved
  // appearance instead of leaving the preview active.
  const latestAppearanceRef = useRef({ colors: config.colors, theme: config.theme });
  latestAppearanceRef.current = { colors: config.colors, theme: config.theme };
  useEffect(() => () => {
    applyThemeColors(latestAppearanceRef.current.colors);
    applyThemeAttribute(latestAppearanceRef.current.theme);
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
    applyThemeColors(theme.colors);
    applyThemeAttribute(theme.name);
  };

  const handleCustomTheme = () => {
    setConfig({ ...config, theme: 'custom' });
    setShowCustomColors(true);
    applyThemeAttribute('custom');
  };

  const filteredThemes = themePresets.filter(
    (theme) => themeFilter === 'all' || theme.type === themeFilter
  );
  const activeThemeName = getThemeByName(config.theme)?.name;

  // Badge/dot per nav section
  const getBadgeForSection = (key: SectionKey): { count?: number; dot?: string } => {
    switch (key) {
      case 'categories':
        return { count: config.categoryOrder.length };
      case 'appearance':
        return { dot: config.theme === 'custom' ? 'var(--color-primary)' : undefined };
      case 'servers':
        return { count: config.servers?.length || undefined };
      case 'inverters':
        return { count: config.inverters?.length || undefined };
      case 'notifications':
        return { dot: config.notifications?.enabled ? 'var(--color-success)' : undefined };
      case 'backups':
        return { count: backups.length || undefined };
      default:
        return {};
    }
  };

  // Search filter over nav sections
  const hasQuery = !!searchQuery.trim();
  const filteredNavSections = useMemo(() => {
    if (!hasQuery) return NAV_SECTIONS;
    const q = searchQuery.toLowerCase();
    return NAV_SECTIONS.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.group.toLowerCase().includes(q),
    );
  }, [searchQuery, hasQuery]);

  // The section to render in the main pane. While searching, keep the pane in
  // sync with the visible sidebar: if the previously-active section was
  // filtered out, fall back to the first match so the header/content still
  // correspond to a highlighted nav item; if nothing matches (or no query),
  // the sidebar drives a "no results" empty state instead of stale content.
  const section = useMemo(() => {
    if (hasQuery && filteredNavSections.length === 0) return null;
    if (!hasQuery) return NAV_SECTIONS.find((s) => s.key === active) ?? NAV_SECTIONS[0];
    return filteredNavSections.find((s) => s.key === active) ?? filteredNavSections[0] ?? null;
  }, [active, filteredNavSections, hasQuery]);

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

  // Monitoring pointer. Rendered in the sidebar footer on desktop (sm+), and
  // above the content on mobile where that footer is hidden — so the pointer
  // that says where Servers/hosts are configured never disappears.
  const monitoringPointer = (
    <div className="ui-panel-section p-3 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
      <div className="mb-1 flex items-center gap-1.5 font-semibold text-[var(--color-text-primary)]">
        <ShieldAlert className="size-3.5 text-[var(--color-primary)]" aria-hidden="true" />
        Monitoring & hosts
      </div>
      Monitoring preferences (hosts, solar, docker, media, alerts…) live on the{' '}
      <a href="/monitor" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
        <Monitor className="inline size-3 -mt-0.5" aria-hidden="true" /> monitor page
      </a>.
      Remote Glances endpoints are managed in{' '}
      <button
        type="button"
        onClick={() => setActive('servers')}
        className="font-semibold text-[var(--color-primary)] hover:underline"
      >
        Remote servers
      </button>
      ; Solar Assistant devices in{' '}
      <button
        type="button"
        onClick={() => setActive('inverters')}
        className="font-semibold text-[var(--color-primary)] hover:underline"
      >
        Inverters
      </button>
      .
    </div>
  );

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader
          title="Settings"
          description="Changes apply and save automatically."
          actions={
            <>
              <span className="ui-chip" data-tone="success">
                <span className="size-1.5 rounded-full bg-[var(--color-success)]" aria-hidden="true" /> Auto-save
              </span>
              <span className="ui-chip">{config.categoryOrder.length} categories</span>
            </>
          }
        />
        <PagePanel>
          {/* Body layout */}
          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">

            {/* Left Navigation Sidebar */}
            <nav className="flex gap-1.5 overflow-x-auto border-t border-[var(--color-border)] bg-[var(--color-background)]/50 p-3 sm:w-60 sm:flex-shrink-0 sm:flex-col sm:overflow-y-auto sm:border-t-0 sm:border-r sm:p-4">
              {/* Search Input */}
              <div className="relative mb-1 flex-shrink-0 sm:px-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-text-secondary)]" aria-hidden="true" />
                <Input
                  className="ui-input"
                  type="text"
                  aria-label="Filter settings"
                  placeholder="Filter settings…"
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  style={{ paddingLeft: 32, fontSize: '0.75rem', minHeight: 32 }}
                />
              </div>

              {/* Groups */}
              {(['Dashboard', 'System'] as const).map((groupName) => {
                const groupItems = filteredNavSections.filter((s) => s.group === groupName);
                if (groupItems.length === 0) return null;
                return (
                  <div key={groupName} className="flex flex-col gap-0.5">
                    <div className="hidden px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.8px] text-[var(--color-text-secondary)] sm:block">
                      {groupName}
                    </div>
                    {groupItems.map((item) => {
                      const { count, dot } = getBadgeForSection(item.key);
                      const isActive = section?.key === item.key;
                      const Icon = item.icon;
                      return (
                        <Button
                          key={item.key}
                          type="button"
                          className="ui-btn flex-shrink-0 whitespace-nowrap sm:w-full"
                          data-variant="ghost"
                          data-size="sm"
                          data-nav
                          data-active={isActive || undefined}
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => setActive(item.key)}
                        >
                          <span
                            className={`flex-shrink-0 rounded-md p-1.5 transition-colors ${
                              isActive
                                ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                                : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'
                            }`}
                          >
                            <Icon className="size-3.5" />
                          </span>
                          <span className="min-w-0 truncate">{item.label}</span>
                          {count != null && count > 0 && (
                            <span className="ml-auto rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums text-[var(--color-text-secondary)]">
                              {count}
                            </span>
                          )}
                          {dot && (
                            <span
                              className="ml-auto size-1.5 rounded-full"
                              style={{ backgroundColor: dot, color: dot }}
                              aria-hidden="true"
                            />
                          )}
                        </Button>
                      );
                    })}
                  </div>
                );
              })}

              {/* Nav footer: monitoring pointer (desktop; mobile gets it above content) */}
              <div className="mt-auto hidden px-1 pt-3 sm:block">
                <Separator className="mb-3" />
                {monitoringPointer}
              </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto bg-[var(--color-surface)] p-4 sm:p-6">
              {/* Monitoring pointer — above the content on mobile where the
                  sidebar footer is hidden, so it never disappears. */}
              {!!section && (
                <div className="mb-5 sm:hidden">{monitoringPointer}</div>
              )}

              {!section ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Search className="mb-3 size-10 text-[var(--color-text-secondary)] opacity-50" aria-hidden="true" />
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    No settings match "{searchQuery}"
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Try a different search term</p>
                </div>
              ) : (
                <>
                  {/* Section Header */}
                  <div className="mb-5 flex items-start justify-between gap-4 border-b border-[var(--color-border)] pb-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)] sm:text-lg">
                        <section.icon className="size-5 flex-shrink-0 text-[var(--color-primary)]" />
                        <span>{section.label}</span>
                      </div>
                      <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        {section.description}
                      </div>
                    </div>

                    {/* Quick actions */}
                    {section.key === 'categories' && (
                      <Button
                        className="ui-btn flex-shrink-0"
                        data-variant="primary"
                        data-size="sm"
                        onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        Add Category
                      </Button>
                    )}
                    {section.key === 'backups' && (
                      <Button
                        className="ui-btn flex-shrink-0"
                        data-variant="primary"
                        data-size="sm"
                        onClick={() => setShowBackupManager(true)}
                      >
                        <Database className="size-4" aria-hidden="true" />
                        Open Backup Manager
                      </Button>
                    )}
                  </div>

                  <div className="max-w-3xl">
                    {/* ── CATEGORIES ── */}
                    {section.key === 'categories' && (
                      config.categoryOrder.length === 0 ? (
                        <div className="py-12 text-center text-[var(--color-text-secondary)]">
                          <Layout className="mx-auto mb-3 size-10 opacity-50" aria-hidden="true" />
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">No categories yet</p>
                          <p className="mt-1 text-xs">Add a category to start grouping your services</p>
                        </div>
                      ) : (
                        <div className="ui-panel-section">
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
                                className={`ui-row justify-between transition-opacity sm:cursor-move ${
                                  draggedCategory === category ? 'opacity-50' : ''
                                }`}
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <GripVertical className="hidden size-4 flex-shrink-0 text-[var(--color-text-secondary)] sm:block" aria-hidden="true" />
                                  <span className="truncate">{category}</span>
                                  <span className="flex-shrink-0 text-xs text-[var(--color-text-secondary)]">
                                    ({config.services.filter((s) => s.category === category).length})
                                  </span>
                                </div>
                                <div className="flex flex-shrink-0 items-center gap-0.5 sm:gap-1">
                                  <Button
                                    className="ui-btn"
                                    data-variant="ghost"
                                    data-size="icon"
                                    onClick={() => moveCategory(category, -1)}
                                    disabled={isFirst}
                                    aria-label={`Move ${category} up`}
                                  >
                                    <ArrowUp className="size-4" aria-hidden="true" />
                                  </Button>
                                  <Button
                                    className="ui-btn"
                                    data-variant="ghost"
                                    data-size="icon"
                                    onClick={() => moveCategory(category, 1)}
                                    disabled={isLast}
                                    aria-label={`Move ${category} down`}
                                  >
                                    <ArrowDown className="size-4" aria-hidden="true" />
                                  </Button>
                                  <Button
                                    className="ui-btn"
                                    data-variant="ghost"
                                    data-size="icon"
                                    style={{ color: 'var(--color-primary)' }}
                                    onClick={() => { setEditingCategory(category); setShowCategoryModal(true); }}
                                    aria-label={`Edit ${category}`}
                                  >
                                    <Edit2 className="size-4" aria-hidden="true" />
                                  </Button>
                                  <Button
                                    className="ui-btn"
                                    data-variant="ghost"
                                    data-size="icon"
                                    style={{ color: 'var(--color-error)' }}
                                    onClick={() => handleDeleteCategory(category)}
                                    aria-label={`Delete ${category}`}
                                  >
                                    <Trash2 className="size-4" aria-hidden="true" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    )}

                    {/* ── APPEARANCE ── */}
                    {section.key === 'appearance' && (
                      <div className="space-y-6">
                        {/* Grid Columns */}
                        <Field className="ui-field">
                          <FieldLabel className="ui-label">Grid Columns</FieldLabel>
                          <SegmentedControl
                            className="ui-seg justify-self-start"
                            value={config.gridColumns}
                            onValueChange={(next) => {
                              if (next) handleGridChange(next);
                            }}
                            aria-label="Grid Columns"
                          >
                            <SegmentedControlIndicator />
                            {['2', '3', '4', '5', '6'].map((cols) => (
                              <SegmentedControlItem key={cols} value={cols} className="ui-seg-item">
                                {cols}
                              </SegmentedControlItem>
                            ))}
                          </SegmentedControl>
                        </Field>

                        {/* Theme Selection */}
                        <div>
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <span className="ui-label">Theme</span>
                            <SegmentedControl
                              className="ui-seg"
                              value={themeFilter}
                              onValueChange={(next) => {
                                if (next) setThemeFilter(next);
                              }}
                              aria-label="Filter themes"
                            >
                              <SegmentedControlIndicator />
                              <SegmentedControlItem value="all" className="ui-seg-item">All</SegmentedControlItem>
                              <SegmentedControlItem value="dark" className="ui-seg-item">
                                <Moon className="size-3.5" aria-hidden="true" />
                                Dark
                              </SegmentedControlItem>
                              <SegmentedControlItem value="light" className="ui-seg-item">
                                <Sun className="size-3.5" aria-hidden="true" />
                                Light
                              </SegmentedControlItem>
                            </SegmentedControl>
                          </div>

                          <RadioGroup
                            className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 sm:gap-3"
                            name="theme"
                            value={config.theme}
                            onValueChange={(next) => {
                              if (!next) return;
                              const theme = getThemeByName(next);
                              if (theme) handleThemeSelect(theme);
                            }}
                            aria-label="Theme"
                          >
                            {filteredThemes.map((theme) => (
                              <Radio
                                key={theme.name}
                                value={theme.name}
                                onMouseEnter={() => applyThemePreview(theme)}
                                onMouseLeave={() => applyThemePreview(null)}
                                title={`Preview ${theme.name}`}
                                className={`relative rounded-xl border p-2.5 text-left transition-all sm:p-3 ${
                                  activeThemeName === theme.name
                                    ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20'
                                    : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                                }`}
                                style={{ backgroundColor: theme.colors.background }}
                              >
                                <div
                                  className="mb-2 w-full overflow-hidden rounded-lg"
                                  style={{
                                    backgroundColor: theme.colors.surface,
                                    border: `1px solid ${theme.colors.border}`,
                                  }}
                                >
                                  <div className="h-1.5 w-full" style={{ backgroundColor: theme.colors.primary }} />
                                  <div className="space-y-1 p-1.5">
                                    <div className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: theme.colors.textPrimary, opacity: 0.8 }} />
                                    <div className="h-1 w-1/2 rounded-full" style={{ backgroundColor: theme.colors.textSecondary, opacity: 0.6 }} />
                                    <div className="flex gap-1 pt-0.5">
                                      <div className="size-2.5 rounded-full" style={{ backgroundColor: theme.colors.primary }} />
                                      <div className="size-2.5 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
                                      <div className="size-2.5 rounded-full" style={{ backgroundColor: theme.colors.success }} />
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-start justify-between gap-1">
                                  <div className="min-w-0">
                                    <span className="block truncate text-xs font-medium" style={{ color: theme.colors.textPrimary }}>
                                      {theme.name}
                                    </span>
                                    <span className="flex items-center gap-0.5 text-xs capitalize" style={{ color: theme.colors.textSecondary }}>
                                      {theme.type === 'dark' ? <Moon className="size-2.5" aria-hidden="true" /> : <Sun className="size-2.5" aria-hidden="true" />}
                                      {theme.type}
                                    </span>
                                  </div>
                                  {activeThemeName === theme.name && (
                                    <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]">
                                      <Check className="size-2.5 text-white" aria-hidden="true" />
                                    </div>
                                  )}
                                </div>
                              </Radio>
                            ))}
                          </RadioGroup>
                        </div>

                        {/* Custom Theme */}
                        <Collapsible
                          className="ui-panel-section"
                          open={showCustomColors}
                          onOpenChange={(open) => {
                            setShowCustomColors(open);
                            if (open) handleCustomTheme();
                          }}
                        >
                          <CollapsibleTrigger
                            className="ui-panel-section-head w-full justify-between text-left"
                            style={{ borderBottomWidth: showCustomColors ? undefined : 0 }}
                          >
                            <span className="flex items-center gap-2">
                              <Palette className="size-4 text-[var(--color-primary)]" aria-hidden="true" />
                              Custom Theme
                              {config.theme === 'custom' && (
                                <Check className="size-4 text-[var(--color-primary)]" aria-hidden="true" />
                              )}
                            </span>
                            <span data-chevron className="text-[var(--color-text-secondary)]">
                              <ChevronDown className="size-4" aria-hidden="true" />
                            </span>
                          </CollapsibleTrigger>
                          <CollapsiblePanel className="space-y-3 p-3">
                            <div className="ui-label">Custom Colors</div>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                              {colorOptions.map((option) => (
                                <div key={option.key} className="flex items-center gap-2">
                                  <Input
                                    type="color"
                                    className="ui-input flex-shrink-0 cursor-pointer"
                                    style={{ width: 34, height: 34, minHeight: 34, padding: 0 }}
                                    value={config.colors[option.key]}
                                    onValueChange={(value) => handleColorChange(option.key, value)}
                                    aria-label={option.label}
                                  />
                                  <div className="min-w-0">
                                    <span className="block truncate text-xs text-[var(--color-text-primary)]">
                                      {option.label}
                                    </span>
                                    <span className="hidden text-xs text-[var(--color-text-secondary)] sm:block">
                                      {config.colors[option.key]}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CollapsiblePanel>
                        </Collapsible>

                        {/* Custom CSS */}
                        <Collapsible
                          className="ui-panel-section"
                          open={showCustomCSS}
                          onOpenChange={setShowCustomCSS}
                        >
                          <CollapsibleTrigger
                            className="ui-panel-section-head w-full justify-between text-left"
                            style={{ borderBottomWidth: showCustomCSS ? undefined : 0 }}
                          >
                            <span className="flex items-center gap-2">
                              <Code2 className="size-4 text-[var(--color-primary)]" aria-hidden="true" />
                              Custom CSS
                              {!!config.settings?.customCSS?.trim() && (
                                <span className="ui-chip" data-tone="accent">active</span>
                              )}
                            </span>
                            <span data-chevron className="text-[var(--color-text-secondary)]">
                              <ChevronDown className="size-4" aria-hidden="true" />
                            </span>
                          </CollapsibleTrigger>
                          <CollapsiblePanel className="space-y-2 p-3">
                            <p className="text-xs text-[var(--color-text-secondary)]">
                              Injected after the selected theme. Custom CSS can override theme
                              variables on :root without !important, including --color-* and the
                              theme-specific --theme-* / --st-* tokens. Component rules may need
                              matching specificity. Changes apply live to the dashboard and the
                              /monitor page, including its settings panel. Clear this field if you
                              previously pasted a full theme here.
                            </p>
                            <Textarea
                              className="ui-textarea font-mono"
                              value={config.settings?.customCSS ?? ''}
                              onValueChange={(value) =>
                                setConfig({
                                  ...config,
                                  settings: { ...config.settings, customCSS: value },
                                })
                              }
                              placeholder={`:root {\n  --color-primary: #ff6b6b;\n  --theme-primary: #ff6b6b;\n}\n\n.my-custom-style { ... }`}
                              spellCheck={false}
                              rows={8}
                            />
                            {!!config.settings?.customCSS?.trim() && (
                              <Button
                                className="ui-btn"
                                data-variant="ghost"
                                data-size="sm"
                                style={{ color: 'var(--color-error)' }}
                                onClick={() =>
                                  setConfig({
                                    ...config,
                                    settings: { ...config.settings, customCSS: '' },
                                  })
                                }
                              >
                                Clear custom CSS
                              </Button>
                            )}
                          </CollapsiblePanel>
                        </Collapsible>
                      </div>
                    )}

                    {/* ── SERVERS / INVERTERS / NOTIFICATIONS ── */}
                    {section.key === 'servers' && <RemoteServersSection />}
                    {section.key === 'inverters' && <InvertersSection />}
                    {section.key === 'notifications' && <NotificationsSettings />}

                    {/* ── BACKUPS ── */}
                    {section.key === 'backups' && (
                      <div className="space-y-4">
                        <p className="text-xs text-[var(--color-text-secondary)] sm:text-sm">
                          Create and manage configuration backups. Use the Open Backup Manager button above to create, restore, import, or export.
                        </p>
                        {backups.length === 0 ? (
                          <div className="text-xs text-[var(--color-text-secondary)]">
                            No backups yet — create one to capture your current configuration.
                          </div>
                        ) : (
                          <ul className="ui-panel-section">
                            {backups.map((b) => (
                              <li
                                key={`${b.name}-${b.date}`}
                                className="ui-row justify-between gap-3"
                              >
                                <span className="truncate">{b.name}</span>
                                <span className="ui-row-dim flex-shrink-0 tabular-nums">
                                  {new Date(b.date).toLocaleString()} <span className="opacity-70">· {b.serviceCount} services</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </main>
          </div>
        </PagePanel>
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
