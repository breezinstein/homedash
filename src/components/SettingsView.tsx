import { useState, useCallback, useEffect, useMemo, useRef, type ComponentType, type ReactNode } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { useBackups } from '../context/BackupsContext';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bell,
  BellRing,
  Box,
  Check,
  ChevronDown,
  Clapperboard,
  Code2,
  Database,
  Download,
  Edit2,
  Film,
  GripVertical,
  House,
  Layout,
  Lock,
  Moon,
  Palette,
  Plus,
  Search,
  Server,
  Shield,
  Sun,
  Trash2,
  Tv,
  Zap,
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
import { Tabs, TabsList, TabsPanel, TabsTab } from '@ui-sdk/react/tabs';
import { Textarea } from '@ui-sdk/react/textarea';
import { CategoryModal } from './CategoryModal';
import { BackupManager } from './BackupManager';
import { NotificationsSettings } from './notifications/NotificationsSettings';
import { getThemeByName, themePresets } from '../themes';
import type { ThemePreset } from '../themes';
import { applyThemeAttribute, applyThemeColors } from '../lib/theme';
import { useConfirm } from './ui';
import { PageHeader, PagePanel } from './shell/PageHeader';
import { ServersSection } from './settings/ServersSection';
import { InvertersSection } from './settings/InvertersSection';
import { MonitorDraftProvider, MonitorSaveBar, useMonitorDraft } from './settings/monitor/MonitorDraft';
import {
  MonitorAlertsSection,
  MonitorArrSection,
  MonitorCertificatesSection,
  MonitorDockerSection,
  MonitorGeneralSection,
  MonitorHomeSection,
  MonitorMediaSection,
  MonitorNetworkSection,
  MonitorSeerrSection,
  MonitorSolarSection,
  MonitorUsenetSection,
} from './settings/monitor/MonitorSections';

export type SectionKey =
  | 'categories'
  | 'appearance'
  | 'notifications'
  | 'backups'
  | 'servers'
  | 'inverters'
  | 'monitor-general'
  | 'monitor-solar'
  | 'monitor-docker'
  | 'monitor-alerts'
  | 'monitor-media'
  | 'monitor-usenet'
  | 'monitor-arr'
  | 'monitor-seerr'
  | 'monitor-network'
  | 'monitor-home'
  | 'monitor-certs';

type Group = 'Dashboard' | 'Sources' | 'Monitor' | 'Monitor sources';
const GROUPS: Group[] = ['Dashboard', 'Sources', 'Monitor', 'Monitor sources'];

interface NavSectionItem {
  key: SectionKey;
  label: string;
  group: Group;
  icon: ComponentType<{ className?: string }>;
  description: string;
}

const NAV_SECTIONS: NavSectionItem[] = [
  { key: 'categories', label: 'Categories', group: 'Dashboard', icon: Layout, description: 'Organise and reorder service categories.' },
  { key: 'appearance', label: 'Appearance', group: 'Dashboard', icon: Palette, description: 'Theme, grid columns, custom colours and CSS. Used by the dashboard and the monitor.' },
  { key: 'notifications', label: 'Notifications', group: 'Dashboard', icon: BellRing, description: 'ntfy server, browser alerts and the inbox.' },
  { key: 'backups', label: 'Backups', group: 'Dashboard', icon: Database, description: 'Create, restore, import and export the configuration.' },
  { key: 'servers', label: 'Servers', group: 'Sources', icon: Server, description: 'Glances endpoints for Server stats and the monitor.' },
  { key: 'inverters', label: 'Inverters', group: 'Sources', icon: Zap, description: 'Solar Assistant devices for the Inverter view and the monitor’s Power tab.' },
  { key: 'monitor-general', label: 'General', group: 'Monitor', icon: Activity, description: 'Turn the monitor on, and set how often it polls and rotates tabs.' },
  { key: 'monitor-solar', label: 'Solar and energy', group: 'Monitor', icon: Sun, description: 'Battery charge, solar, grid and house load for the Power tab.' },
  { key: 'monitor-docker', label: 'Docker', group: 'Monitor', icon: Box, description: 'Container health across monitored servers.' },
  { key: 'monitor-alerts', label: 'Alert rules', group: 'Monitor', icon: Bell, description: 'When a reading crosses a threshold for long enough, an alert fires.' },
  { key: 'monitor-media', label: 'Media streams', group: 'Monitor sources', icon: Tv, description: 'Jellyfin and Emby playback sessions and transcoding.' },
  { key: 'monitor-usenet', label: 'Usenet queues', group: 'Monitor sources', icon: Download, description: 'SABnzbd and NZBGet speed, queue and time left.' },
  { key: 'monitor-arr', label: 'Sonarr / Radarr', group: 'Monitor sources', icon: Film, description: 'Download queues, missing items and health warnings.' },
  { key: 'monitor-seerr', label: 'Media requests', group: 'Monitor sources', icon: Clapperboard, description: 'Overseerr and Jellyseerr requests and open issues.' },
  { key: 'monitor-network', label: 'Network appliances', group: 'Monitor sources', icon: Shield, description: 'OPNsense WAN links and firewall, ntopng traffic.' },
  { key: 'monitor-home', label: 'Home Assistant', group: 'Monitor sources', icon: House, description: 'The pump, glanceable sensors and unavailable devices.' },
  { key: 'monitor-certs', label: 'TLS certificates', group: 'Monitor sources', icon: Lock, description: 'Watch certificate expiry on your hosts.' },
];

const isMonitorSection = (key: SectionKey) => key.startsWith('monitor-');

interface SettingsViewProps {
  /** Section to open on mount, e.g. the one a tool's “Manage” link points at. */
  initialSection?: SectionKey;
  /** Called when the person picks another section, so the URL can follow. */
  onSectionChange?: (section: SectionKey) => void;
}

export function SettingsView(props: SettingsViewProps) {
  return (
    <MonitorDraftProvider>
      <SettingsBody {...props} />
    </MonitorDraftProvider>
  );
}

function SettingsBody({ initialSection, onSectionChange }: SettingsViewProps) {
  const { config, setConfig, reorderCategories, addCategory, updateCategory, deleteCategory, servers } = useDashboard();
  const { backups } = useBackups();
  const confirm = useConfirm();
  const { mon, dirty } = useMonitorDraft();
  const [active, setActiveState] = useState<SectionKey>(NAV_SECTIONS.some((s) => s.key === initialSection) ? initialSection! : 'categories');
  const setActive = (key: SectionKey) => {
    setActiveState(key);
    onSectionChange?.(key);
  };
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

  const getBadgeForSection = (key: SectionKey): { count?: number; dot?: 'success' | 'warning' } => {
    switch (key) {
      case 'categories': return { count: config.categoryOrder.length };
      case 'appearance': return {};
      case 'servers': return { count: servers.length || undefined };
      case 'inverters': return { count: config.inverters?.length || undefined };
      case 'notifications': return { dot: config.notifications?.enabled ? 'success' : undefined };
      case 'backups': return { count: backups.length || undefined };
      case 'monitor-general': return { dot: mon.enabled ? 'success' : undefined };
      case 'monitor-solar': return { dot: mon.solar?.enabled ? 'success' : undefined };
      case 'monitor-docker': return { dot: mon.docker?.enabled !== false ? 'success' : undefined };
      case 'monitor-alerts': return { count: (mon.alerts ?? []).filter((a) => a.enabled).length || undefined };
      case 'monitor-media': return { count: mon.media?.length || undefined };
      case 'monitor-usenet': return { count: mon.usenet?.length || undefined };
      case 'monitor-arr': return { count: mon.arr?.length || undefined };
      case 'monitor-seerr': return { count: mon.seerr?.length || undefined };
      case 'monitor-network': return { count: ((mon.opnsense?.length ?? 0) + (mon.ntopng?.length ?? 0)) || undefined };
      case 'monitor-home': return { count: mon.homeassistant?.length || undefined };
      case 'monitor-certs': return { count: mon.certificates?.length || undefined };
      default: return {};
    }
  };

  const hasQuery = !!searchQuery.trim();
  const filteredNavSections = useMemo(() => {
    if (!hasQuery) return NAV_SECTIONS;
    const q = searchQuery.toLowerCase();
    return NAV_SECTIONS.filter(
      (s) => s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.group.toLowerCase().includes(q),
    );
  }, [searchQuery, hasQuery]);

  // While filtering, keep the pane on a visible section so the selected tab and the content match.
  const section = useMemo(() => {
    if (hasQuery && filteredNavSections.length === 0) return null;
    return filteredNavSections.find((s) => s.key === active) ?? filteredNavSections[0] ?? null;
  }, [active, filteredNavSections, hasQuery]);

  const jump = (key: string) => {
    setSearchQuery('');
    if (NAV_SECTIONS.some((s) => s.key === key)) setActive(key as SectionKey);
  };

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

  const renderSection = (key: SectionKey): ReactNode => {
    switch (key) {
      case 'servers': return <ServersSection />;
      case 'inverters': return <InvertersSection />;
      case 'notifications': return <NotificationsSettings />;
      case 'monitor-general': return <MonitorGeneralSection onJump={jump} />;
      case 'monitor-solar': return <MonitorSolarSection onJump={jump} />;
      case 'monitor-docker': return <MonitorDockerSection />;
      case 'monitor-alerts': return <MonitorAlertsSection />;
      case 'monitor-media': return <MonitorMediaSection />;
      case 'monitor-usenet': return <MonitorUsenetSection />;
      case 'monitor-arr': return <MonitorArrSection />;
      case 'monitor-seerr': return <MonitorSeerrSection />;
      case 'monitor-network': return <MonitorNetworkSection />;
      case 'monitor-home': return <MonitorHomeSection />;
      case 'monitor-certs': return <MonitorCertificatesSection />;
      default: return null;
    }
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader
          title="Settings"
          description="Dashboard settings save as you change them. Monitor settings save when you press Save."
          actions={dirty ? <span className="ui-chip" data-tone="warning">Unsaved monitor changes</span> : null}
        />
        <PagePanel>
          <Tabs
            orientation="vertical"
            value={section?.key ?? null}
            onValueChange={(next) => { if (next) setActive(next as SectionKey); }}
            className="flex min-h-0 flex-1 flex-col sm:flex-row"
          >
            <div className="ui-settings-nav">
              <div className="relative mb-1 flex-shrink-0 sm:px-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-text-secondary)] sm:left-4" aria-hidden="true" />
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
              <TabsList aria-label="Settings sections" className="ui-settings-tabs">
                {GROUPS.map((groupName) => {
                  const items = filteredNavSections.filter((s) => s.group === groupName);
                  if (items.length === 0) return null;
                  return [
                    <div key={`g-${groupName}`} className="ui-settings-group" aria-hidden="true">{groupName}</div>,
                    ...items.map((item) => {
                      const { count, dot } = getBadgeForSection(item.key);
                      const Icon = item.icon;
                      return (
                        <TabsTab key={item.key} value={item.key} className="ui-settings-tab">
                          <span className="ui-settings-tab-icon"><Icon className="size-3.5" aria-hidden="true" /></span>
                          <span className="min-w-0 truncate">{item.label}</span>
                          {count != null && count > 0 ? <span className="ui-settings-count">{count}</span> : null}
                          {dot ? <span className="ui-settings-dot" data-tone={dot} aria-hidden="true" /> : null}
                        </TabsTab>
                      );
                    }),
                  ];
                })}
              </TabsList>
            </div>

            {!section ? (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                <Search className="mb-3 size-10 text-[var(--color-text-secondary)] opacity-50" aria-hidden="true" />
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Nothing matches “{searchQuery}”</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Try another word, like “theme” or “alerts”.</p>
              </div>
            ) : (
              filteredNavSections.map((item) => (
                <TabsPanel key={item.key} value={item.key} className="ui-settings-panel">
                  {item.key === section.key && (
                    <>
                      <div className="ui-settings-scroll">
                        <div className="mb-5 flex items-start justify-between gap-4 border-b border-[var(--color-border)] pb-4">
                          <div className="min-w-0">
                            <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)] sm:text-lg">
                              <section.icon className="size-5 flex-shrink-0 text-[var(--color-primary)]" />
                              {isMonitorSection(section.key) ? <span className="text-[var(--color-text-secondary)]">Monitor ·</span> : null}
                              <span>{section.label}</span>
                            </h2>
                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{section.description}</p>
                          </div>
                          {section.key === 'categories' && (
                            <Button className="ui-btn flex-shrink-0" data-variant="primary" data-size="sm" onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}>
                              <Plus className="size-4" aria-hidden="true" /> Add category
                            </Button>
                          )}
                          {section.key === 'backups' && (
                            <Button className="ui-btn flex-shrink-0" data-variant="primary" data-size="sm" onClick={() => setShowBackupManager(true)}>
                              <Database className="size-4" aria-hidden="true" /> Open backup manager
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
                          {renderSection(section.key)}
                        </div>
                      </div>
                      {isMonitorSection(section.key) && <MonitorSaveBar />}
                    </>
                  )}
                </TabsPanel>
              ))
            )}
          </Tabs>
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
