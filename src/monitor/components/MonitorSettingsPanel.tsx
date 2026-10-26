import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  X,
  Check,
  Activity,
  Server,
  Sun,
  HardDrive,
  Tv,
  Download,
  Film,
  Clapperboard,
  Shield,
  House,
  Bell,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Search,
  Zap,
  Layers,
  AlertTriangle,
  Info,
  CheckCircle2,
  Sliders,
  Radio,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { configApi } from '../../api/configApi';
import { refreshCertificates } from '../monitorApi';
import { copyToClipboard as copyText } from '../../lib/clipboard';
import { applyCustomCss } from '../../lib/customCss';
import { applyThemeAttribute, applyThemeColors } from '../../lib/theme';
import { newId } from '../../lib/id';
import type {
  DashboardConfig,
  MonitoringConfig,
  MonitoredMedia,
  MonitoredUsenet,
  MonitoredArr,
  MonitoredSeerr,
  MonitoredOpnsense,
  MonitoredNtopng,
  MonitoredHomeAssistant,
  MonitoredCertificate,
  RemoteServer,
  CertificateSnapshot,
  CertificateEntry,
} from '../../types';
import type {
  EntityFormValues,
  EntityModalState,
  SectionKey,
} from './monitorSettingsTypes';
import { EntityModalDialog } from './MonitorEntityModal';
import { AlertsSection } from './MonitorAlertsSection';
import { SwitchToggle } from './MonitorSettingsControls';

interface MonitorSettingsPanelProps {
  onClose: () => void;
  certificates?: CertificateSnapshot | null;
}

interface NavSectionItem {
  key: SectionKey;
  label: string;
  group: 'Core' | 'Media' | 'Infra' | 'Automation';
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  description: string;
}

const NAV_SECTIONS: NavSectionItem[] = [
  { key: 'general', label: 'General Engine', group: 'Core', icon: Activity, accentColor: 'var(--mon-accent)', description: 'Master switch, poll intervals and kiosk tab rotation' },
  { key: 'hosts', label: 'Glances Hosts', group: 'Core', icon: Server, accentColor: '#3b82f6', description: 'Server metrics (CPU, RAM, load, temperatures & disks)' },
  { key: 'solar', label: 'Solar & Energy', group: 'Core', icon: Sun, accentColor: 'var(--mon-warn)', description: 'Solar Assistant battery, solar PV, grid and house load' },
  { key: 'docker', label: 'Docker Engine', group: 'Core', icon: HardDrive, accentColor: '#06b6d4', description: 'Container health, restarting/unhealthy state monitoring' },
  { key: 'media', label: 'Media Streams', group: 'Media', icon: Tv, accentColor: '#a855f7', description: 'Jellyfin and Emby active playback sessions & transcoding' },
  { key: 'usenet', label: 'Usenet Queues', group: 'Media', icon: Download, accentColor: 'var(--mon-ok)', description: 'SABnzbd & NZBGet queue progress, speed & ETA' },
  { key: 'arr', label: 'Sonarr / Radarr', group: 'Media', icon: Film, accentColor: '#0ea5e9', description: 'Active downloads, queue pipelines & disk health warnings' },
  { key: 'seerr', label: 'Media Requests', group: 'Media', icon: Clapperboard, accentColor: '#f97316', description: 'Overseerr & Jellyseerr pending requests and media issues' },
  { key: 'network', label: 'Network Appliances', group: 'Infra', icon: Shield, accentColor: 'var(--mon-danger)', description: 'OPNsense multi-WAN firewall & ntopng traffic analytics' },
  { key: 'home', label: 'Home Assistant', group: 'Infra', icon: House, accentColor: '#14b8a6', description: 'Smart-home device reachability, battery and sensors' },
  { key: 'certs', label: 'TLS Certificates', group: 'Infra', icon: Lock, accentColor: '#10b981', description: 'Watch certificate expiry on hosts & services' },
  { key: 'alerts', label: 'Alert Rules', group: 'Automation', icon: Bell, accentColor: '#ec4899', description: 'Real-time telemetry thresholds and firing notifications' },
];

export function MonitorSettingsPanel({ onClose, certificates: liveCerts }: MonitorSettingsPanelProps) {
  const [draft, setDraft] = useState<DashboardConfig | null>(null);
  const [initialJson, setInitialJson] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<SectionKey>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Live certificate snapshot (from the monitor overview poll) merged with
  // per-refresh results so the certs section shows current days-to-expiry.
  const [certRefreshing, setCertRefreshing] = useState<Set<string>>(new Set());
  const [certAllRefreshing, setCertAllRefreshing] = useState(false);
  const [certRefreshError, setCertRefreshError] = useState<string | null>(null);
  // Per-cert refresh results, applied immediately so the UI doesn't wait for
  // the next overview poll. Cleared when a fresh poll snapshot arrives so the
  // server's (fresher) data always wins.
  const [certOverrides, setCertOverrides] = useState<Map<string, CertificateEntry>>(new Map());

  // Submodal state for Add/Edit
  const [entityModal, setEntityModal] = useState<EntityModalState | null>(null);

  // Confirm delete dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Load config
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    configApi
      .getConfig()
      .then(({ config }) => {
        if (cancelled) return;
        setDraft(config);
        setInitialJson(JSON.stringify(config));
        // The monitor's theme hook normally handles this, but re-apply from the
        // latest document when Settings opens so a just-saved theme or custom
        // stylesheet is reflected immediately instead of waiting for the next
        // config poll.
        if (config.colors) applyThemeColors(config.colors);
        applyThemeAttribute(config.theme);
        applyCustomCss(config.settings?.customCSS);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load configuration');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const mon: MonitoringConfig = useMemo(() => {
    return draft?.monitoring ?? defaultMonitoring();
  }, [draft]);

  const servers: RemoteServer[] = draft?.servers ?? [];
  const inverters = draft?.inverters ?? [];

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!draft || !initialJson) return false;
    return JSON.stringify(draft) !== initialJson;
  }, [draft, initialJson]);

  // Show transient toast
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((prev) => (prev === msg ? null : prev)), 2400);
  }, []);

  const updateMonitoring = useCallback((patch: Partial<MonitoringConfig>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        monitoring: {
          ...(prev.monitoring ?? defaultMonitoring()),
          ...patch,
        },
      };
    });
  }, []);

  const setList = useCallback(
    <K extends 'media' | 'usenet' | 'arr' | 'seerr' | 'opnsense' | 'ntopng' | 'homeassistant' | 'certificates'>(
      key: K,
      list: MonitoringConfig[K],
    ) => {
      updateMonitoring({ [key]: list } as Partial<MonitoringConfig>);
    },
    [updateMonitoring],
  );

  const handleSave = async () => {
    if (!draft || saving) return;
    setSaving(true);
    setError(null);
    try {
      await configApi.saveConfig(draft);
      setSaved(true);
      setInitialJson(JSON.stringify(draft));
      showToast('Settings saved successfully!');
      setTimeout(() => {
        setSaved(false);
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcut: Ctrl+S / Cmd+S to save, Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        if (entityModal) {
          setEntityModal(null);
        } else if (confirmDialog) {
          setConfirmDialog(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [entityModal, confirmDialog, handleSave, onClose]);

  // Section badge counts
  const getBadgeForSection = (key: SectionKey): { count?: number; dot?: string } => {
    switch (key) {
      case 'general':
        return { dot: mon.enabled ? 'var(--mon-ok)' : 'var(--mon-text-faint)' };
      case 'hosts':
        return { count: mon.glancesHosts?.length ?? 0 };
      case 'solar':
        return { dot: mon.solar?.enabled ? 'var(--mon-ok)' : 'var(--mon-text-faint)' };
      case 'docker':
        return { dot: mon.docker?.enabled !== false ? 'var(--mon-ok)' : 'var(--mon-text-faint)' };
      case 'media':
        return { count: mon.media?.length ?? 0 };
      case 'usenet':
        return { count: mon.usenet?.length ?? 0 };
      case 'arr':
        return { count: mon.arr?.length ?? 0 };
      case 'seerr':
        return { count: mon.seerr?.length ?? 0 };
      case 'network':
        return { count: (mon.opnsense?.length ?? 0) + (mon.ntopng?.length ?? 0) };
      case 'home':
        return { count: mon.homeassistant?.length ?? 0 };
      case 'certs':
        return { count: mon.certificates?.length ?? 0 };
      case 'alerts':
        return { count: (mon.alerts ?? []).filter((a) => a.enabled).length };
      default:
        return {};
    }
  };

  // Search filter
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

  // Toggle host selection
  const toggleGlancesHost = (srv: RemoteServer) => {
    const hosts = mon.glancesHosts ?? [];
    if (hosts.some((h) => h.id === srv.id)) {
      updateMonitoring({ glancesHosts: hosts.filter((h) => h.id !== srv.id) });
    } else {
      updateMonitoring({
        glancesHosts: [
          ...hosts,
          { id: srv.id, name: srv.name, url: srv.url, username: srv.username, password: srv.password },
        ],
      });
    }
  };

  const selectAllHosts = () => {
    const all = servers.map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
      username: s.username,
      password: s.password,
    }));
    updateMonitoring({ glancesHosts: all });
  };

  const deselectAllHosts = () => {
    updateMonitoring({ glancesHosts: [] });
  };

  // Generic Save entity handler. The modal state is a discriminated union, so
  // the section determines which monitored-list shape the draft belongs to.
  const handleSaveEntity = (item: EntityFormValues, isNew: boolean) => {
    if (!entityModal) return;
    const modal = entityModal;

    if (modal.section === 'media') {
      const list = mon.media ?? [];
      if (isNew) {
        setList('media', [...list, { ...item, id: newId() } as MonitoredMedia]);
      } else {
        setList('media', list.map((i) => (i.id === item.id ? { ...i, ...item } as MonitoredMedia : i)));
      }
    } else if (modal.section === 'usenet') {
      const list = mon.usenet ?? [];
      if (isNew) {
        setList('usenet', [...list, { ...item, id: newId() } as MonitoredUsenet]);
      } else {
        setList('usenet', list.map((i) => (i.id === item.id ? { ...i, ...item } as MonitoredUsenet : i)));
      }
    } else if (modal.section === 'arr') {
      const list = mon.arr ?? [];
      if (isNew) {
        setList('arr', [...list, { ...item, id: newId() } as MonitoredArr]);
      } else {
        setList('arr', list.map((i) => (i.id === item.id ? { ...i, ...item } as MonitoredArr : i)));
      }
    } else if (modal.section === 'seerr') {
      const list = mon.seerr ?? [];
      if (isNew) {
        setList('seerr', [...list, { ...item, id: newId() } as MonitoredSeerr]);
      } else {
        setList('seerr', list.map((i) => (i.id === item.id ? { ...i, ...item } as MonitoredSeerr : i)));
      }
    } else if (modal.section === 'network') {
      const { _type, ...clean } = item;
      if (_type === 'opnsense') {
        const list = mon.opnsense ?? [];
        if (isNew) {
          setList('opnsense', [...list, { ...clean, id: newId() } as MonitoredOpnsense]);
        } else {
          setList('opnsense', list.map((i) => (i.id === item.id ? { ...i, ...clean } as MonitoredOpnsense : i)));
        }
      } else {
        const list = mon.ntopng ?? [];
        if (isNew) {
          setList('ntopng', [...list, { ...clean, id: newId() } as MonitoredNtopng]);
        } else {
          setList('ntopng', list.map((i) => (i.id === item.id ? { ...i, ...clean } as MonitoredNtopng : i)));
        }
      }
    } else if (modal.section === 'home') {
      const list = mon.homeassistant ?? [];
      if (isNew) {
        setList('homeassistant', [...list, { ...item, id: newId() } as MonitoredHomeAssistant]);
      } else {
        setList('homeassistant', list.map((i) => (i.id === item.id ? { ...i, ...item } as MonitoredHomeAssistant : i)));
      }
    } else if (modal.section === 'certs') {
      const list = mon.certificates ?? [];
      if (isNew) {
        setList('certificates', [...list, { ...item, id: newId() } as MonitoredCertificate]);
      } else {
        setList('certificates', list.map((i) => (i.id === item.id ? { ...i, ...item } as MonitoredCertificate : i)));
      }
    }
    setEntityModal(null);
  };

  const copyToClipboard = async (text: string, label = 'Copied') => {
    const ok = await copyText(text);
    showToast(ok ? `${label} copied to clipboard` : 'Copy failed');
  };

  // Map a configured certificate to its live snapshot entry (by id) so the
  // settings list can show days-to-expiry for every configured certificate.
  // Prefers an immediately-applied refresh result over the polled snapshot.
  const liveCertFor = useCallback(
    (item: MonitoredCertificate): CertificateEntry | undefined => {
      return certOverrides.get(item.id) ?? liveCerts?.items?.find((e) => e.id === item.id);
    },
    [certOverrides, liveCerts],
  );

  // When a fresh overview poll arrives, drop any refresh overrides so the
  // server's (fresher) data always wins once the poll cycle catches up.
  useEffect(() => {
    setCertOverrides(new Map());
  }, [liveCerts]);

  // Refresh a single certificate (or all, when `ids` is omitted) on demand,
  // bypassing the throttled cache. The returned snapshot's per-cert entries are
  // applied immediately as overrides so the days-left updates without waiting
  // for the next poll.
  const doRefreshCertificates = useCallback(
    async (ids?: string[]) => {
      setCertRefreshError(null);
      if (ids && ids.length === 1) {
        setCertRefreshing((prev) => new Set(prev).add(ids[0]));
      } else {
        setCertAllRefreshing(true);
      }
      try {
        const snapshot = await refreshCertificates(ids);
        setCertOverrides((prev) => {
          const next = new Map(prev);
          for (const e of snapshot.items) next.set(e.id, e);
          return next;
        });
        showToast(ids && ids.length === 1 ? 'Certificate re-checked' : 'All certificates re-checked');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to refresh certificates';
        setCertRefreshError(msg);
        showToast('Refresh failed');
      } finally {
        setCertRefreshing(new Set());
        setCertAllRefreshing(false);
      }
    },
    [showToast],
  );

  if (loading) {
    return (
      <div className="ms-overlay">
        <div className="ms-dialog items-center justify-center p-8">
          <div className="ms-loading">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--mon-accent)]/20 border-t-[var(--mon-accent)] animate-spin" />
            <span className="text-sm text-[var(--mon-text-dim)] font-medium">Loading monitor configuration…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="ms-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="monitor-settings-title"
    >
      <div className="ms-dialog">
        {/* Top Header */}
        <header className="ms-header">
          <div className="ms-logo">
            <Activity className="w-5 h-5 text-[var(--mon-accent-hover)]" />
          </div>
          <div className="ms-title-block">
            <div className="flex items-center gap-2.5">
              <span id="monitor-settings-title" className="ms-title">Monitor Settings</span>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold tracking-wide uppercase ${
                  mon.enabled
                    ? 'bg-[var(--mon-ok)]/10 text-[var(--mon-ok)] border border-[var(--mon-ok)]/25'
                    : 'bg-[var(--mon-surface-2)] text-[var(--mon-text-muted)] border border-[var(--mon-border)]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    mon.enabled ? 'bg-[var(--mon-ok)] animate-pulse' : 'bg-[var(--mon-border)]'
                  }`}
                />
                {mon.enabled ? `Live · ${mon.pollIntervalSeconds || 10}s` : 'Paused'}
              </span>
              {hasUnsavedChanges && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--mon-warn)]/15 text-[var(--mon-warn)] border border-[var(--mon-warn)]/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--mon-warn)]" />
                  Unsaved changes
                </span>
              )}
            </div>
            <div className="ms-subtitle">
              Configure background pollers, telemetry sources, alerts and kiosk rotation
            </div>
          </div>

          <div className="ms-spacer" />

          {/* Quick Stats Pill */}
          <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-[var(--mon-surface-2)] border border-[var(--mon-border)] rounded-lg text-[11px] text-[var(--mon-text-muted)]">
            <span>
              <strong className="text-[var(--mon-text-dim)]">{mon.glancesHosts?.length ?? 0}</strong> hosts
            </span>
            <span className="w-1 h-1 rounded-full bg-[var(--mon-border)]" />
            <span>
              <strong className="text-[var(--mon-text-dim)]">
                {(mon.media?.length ?? 0) + (mon.usenet?.length ?? 0) + (mon.arr?.length ?? 0)}
              </strong>{' '}
              media sources
            </span>
            <span className="w-1 h-1 rounded-full bg-[var(--mon-border)]" />
            <span>
              <strong className="text-[var(--mon-text-dim)]">
                {(mon.alerts ?? []).filter((a) => a.enabled).length}
              </strong>{' '}
              alert rules
            </span>
          </div>

          {/* Actions */}
          {saved && (
            <span className="ms-btn ms-btn-success text-xs">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}

          <button
            className="ms-btn ms-btn-primary text-xs"
            onClick={handleSave}
            disabled={!draft || saving}
            title="Save changes (Ctrl+S)"
          >
            {saving ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" /> Save changes
              </>
            )}
          </button>

          <button
            className="ms-btn ms-btn-ghost text-xs"
            onClick={onClose}
            title="Close panel (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </header>

        {/* Global Toast */}
        {toastMsg && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[var(--mon-accent)] text-white text-xs font-semibold rounded-lg shadow-lg shadow-black/50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
            <CheckCircle2 className="w-4 h-4 text-white/80" />
            {toastMsg}
          </div>
        )}

        {/* Body layout */}
        <div className="ms-body">
          {/* Left Navigation Sidebar */}
          <nav className="ms-nav">
            {/* Search Input */}
            <div className="relative mb-2 px-1">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--mon-text-faint)] pointer-events-none" />
              <input
                type="text"
                placeholder="Filter settings…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px' }}
                className="w-full bg-[var(--mon-surface-2)] border border-[var(--mon-border)] rounded-lg pr-2.5 py-1.5 text-xs text-[var(--mon-text-dim)] placeholder:text-[var(--mon-text-faint)] focus:outline-none focus:border-[var(--mon-accent)]"
              />
            </div>

            {/* Groups */}
            {(['Core', 'Media', 'Infra', 'Automation'] as const).map((groupName) => {
              const groupItems = filteredNavSections.filter((s) => s.group === groupName);
              if (groupItems.length === 0) return null;

              return (
                <div key={groupName} className="flex flex-col gap-0.5">
                  <div className="ms-nav-group-label">{groupName}</div>
                  {groupItems.map((item) => {
                    const { count, dot } = getBadgeForSection(item.key);
                    const isActive = active === item.key;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.key}
                        className={`ms-nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => setActive(item.key)}
                        type="button"
                      >
                        <div className="ms-nav-icon-wrap">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="truncate">{item.label}</span>

                        {count != null && count > 0 && (
                          <span className="ms-nav-badge">{count}</span>
                        )}
                        {dot && (
                          <span
                            className="ms-nav-dot"
                            style={{ backgroundColor: dot, color: dot }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {/* Engine status footer */}
            <div className="mt-auto pt-3 border-t border-[var(--mon-border-soft)] px-2 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] text-[var(--mon-text-muted)]">
                <span>Telemetry Engine</span>
                <span className={mon.enabled ? 'text-[var(--mon-ok)] font-semibold' : 'text-[var(--mon-text-faint)]'}>
                  {mon.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => updateMonitoring({ enabled: !mon.enabled })}
                className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-2 ${
                  mon.enabled
                    ? 'bg-[var(--mon-ok)]/10 border-[var(--mon-ok)]/25 text-[var(--mon-ok)] hover:bg-[var(--mon-ok)]/20'
                    : 'bg-[var(--mon-surface-2)]/80 border-[var(--mon-border)] text-[var(--mon-text-dim)] hover:bg-[var(--mon-surface-2)]'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                {mon.enabled ? 'Suspend Monitoring' : 'Start Monitoring'}
              </button>
            </div>
          </nav>

          {/* Main Content Area */}
          <main className="ms-content">
            <div className="ms-content-inner">
              {error && (
                <div className="ms-error mb-4">
                  <AlertTriangle className="w-4 h-4 text-[var(--mon-danger)] flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Section Header */}
              <div className="ms-section-header">
                <div>
                  <div className="ms-section-title">
                    <activeSectionMeta.icon className="w-5 h-5 text-[var(--mon-accent-hover)]" />
                    <span>{activeSectionMeta.label}</span>
                  </div>
                  <div className="ms-section-desc">{activeSectionMeta.description}</div>
                </div>

                {/* Section Quick Actions */}
                {active === 'hosts' && servers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllHosts}
                      className="ms-btn ms-btn-secondary text-[11.5px] py-1.5 px-2.5"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllHosts}
                      className="ms-btn ms-btn-ghost text-[11.5px] py-1.5 px-2.5"
                    >
                      Deselect all
                    </button>
                  </div>
                )}

                {active === 'media' && (
                  <button
                    type="button"
                    onClick={() =>
                      setEntityModal({
                        open: true,
                        section: 'media',
                        item: { type: 'jellyfin', name: '', url: '', apiKey: '' },
                        isNew: true,
                      })
                    }
                    className="ms-btn ms-btn-primary text-xs py-1.5 px-3"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Media Server
                  </button>
                )}

                {active === 'usenet' && (
                  <button
                    type="button"
                    onClick={() =>
                      setEntityModal({
                        open: true,
                        section: 'usenet',
                        item: { type: 'sabnzbd', name: '', url: '', apiKey: '' },
                        isNew: true,
                      })
                    }
                    className="ms-btn ms-btn-primary text-xs py-1.5 px-3"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Downloader
                  </button>
                )}

                {active === 'arr' && (
                  <button
                    type="button"
                    onClick={() =>
                      setEntityModal({
                        open: true,
                        section: 'arr',
                        item: { type: 'sonarr', name: '', url: '', apiKey: '' },
                        isNew: true,
                      })
                    }
                    className="ms-btn ms-btn-primary text-xs py-1.5 px-3"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Arr Service
                  </button>
                )}

                {active === 'seerr' && (
                  <button
                    type="button"
                    onClick={() =>
                      setEntityModal({
                        open: true,
                        section: 'seerr',
                        item: { type: 'overseerr', name: '', url: '', apiKey: '' },
                        isNew: true,
                      })
                    }
                    className="ms-btn ms-btn-primary text-xs py-1.5 px-3"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Seerr Service
                  </button>
                )}

                {active === 'home' && (
                  <button
                    type="button"
                    onClick={() =>
                      setEntityModal({
                        open: true,
                        section: 'home',
                        item: { name: 'home-assistant', url: 'http://homeassistant.local:8123', token: '', insecureTls: false },
                        isNew: true,
                      })
                    }
                    className="ms-btn ms-btn-primary text-xs py-1.5 px-3"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Home Assistant
                  </button>
                )}
              </div>

              {/* ── 1. GENERAL ENGINE SECTION ── */}
              {active === 'general' && (
                <div className="space-y-4">
                  {/* Hero Switch Card */}
                  <div className="p-5 rounded-xl border border-[var(--mon-accent)]/30 bg-gradient-to-r from-[var(--mon-surface-2)] via-[var(--mon-surface-2)] to-[var(--mon-surface)] flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="p-3 rounded-xl bg-[var(--mon-accent)]/15 border border-[var(--mon-accent)]/30 text-[var(--mon-accent-hover)]">
                        <Zap className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[var(--mon-text)] flex items-center gap-2">
                          Master Telemetry Engine
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              mon.enabled
                                ? 'bg-[var(--mon-ok)]/20 text-[var(--mon-ok)] border border-[var(--mon-ok)]/30'
                                : 'bg-[var(--mon-surface-2)] text-[var(--mon-text-muted)] border border-[var(--mon-border)]'
                            }`}
                          >
                            {mon.enabled ? 'ACTIVE' : 'IDLE'}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--mon-text-muted)] mt-1 max-w-lg leading-relaxed">
                          Continuously collects data across all configured hosts, power inverters, media servers,
                          download queues, and evaluates alert rules.
                        </p>
                      </div>
                    </div>
                    <SwitchToggle
                      checked={mon.enabled}
                      onChange={(v) => updateMonitoring({ enabled: v })}
                    />
                  </div>

                  {/* Polling & Rotation Settings */}
                  <div className="ms-card">
                    <div className="ms-card-title">
                      <Sliders className="w-4 h-4 text-[var(--mon-accent-hover)]" />
                      Polling & Rotation Parameters
                    </div>

                    <div className="space-y-6 pt-2">
                      <PresetSlider
                        label="Background Polling Interval"
                        detail="Frequency at which the server queries Glances, Docker, Media servers and network endpoints."
                        value={mon.pollIntervalSeconds ?? 10}
                        min={2}
                        max={60}
                        step={1}
                        unit="s"
                        presets={[
                          { label: '5s (Fast)', value: 5 },
                          { label: '10s (Standard)', value: 10 },
                          { label: '15s', value: 15 },
                          { label: '30s', value: 30 },
                          { label: '60s (Low load)', value: 60 },
                        ]}
                        onChange={(v) => updateMonitoring({ pollIntervalSeconds: v })}
                      />

                      <div className="border-t border-[var(--mon-border-soft)]" />

                      <PresetSlider
                        label="Kiosk Tab Auto-Rotation"
                        detail="Automatically cycles through monitor tabs on full-screen kiosk displays (0 disables auto-rotation)."
                        value={mon.ui?.tabRotationSeconds ?? 15}
                        min={0}
                        max={60}
                        step={5}
                        unit="s"
                        presets={[
                          { label: 'Off (Manual)', value: 0 },
                          { label: '10s', value: 10 },
                          { label: '15s (Default)', value: 15 },
                          { label: '30s', value: 30 },
                          { label: '60s', value: 60 },
                        ]}
                        onChange={(v) =>
                          updateMonitoring({
                            ui: { ...(mon.ui ?? {}), tabRotationSeconds: v },
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Telemetry Source Matrix */}
                  <div className="ms-card">
                    <div className="ms-card-title">
                      <Layers className="w-4 h-4 text-[var(--mon-accent-hover)]" />
                      Connected Telemetry Matrix
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      <SourceMatrixChip
                        icon={Server}
                        label="Hosts"
                        count={mon.glancesHosts?.length ?? 0}
                        active={Boolean(mon.glancesHosts?.length)}
                        onClick={() => setActive('hosts')}
                      />
                      <SourceMatrixChip
                        icon={Sun}
                        label="Solar"
                        count={mon.solar?.enabled ? 1 : 0}
                        active={Boolean(mon.solar?.enabled)}
                        onClick={() => setActive('solar')}
                      />
                      <SourceMatrixChip
                        icon={Tv}
                        label="Media"
                        count={mon.media?.length ?? 0}
                        active={Boolean(mon.media?.length)}
                        onClick={() => setActive('media')}
                      />
                      <SourceMatrixChip
                        icon={Download}
                        label="Usenet"
                        count={mon.usenet?.length ?? 0}
                        active={Boolean(mon.usenet?.length)}
                        onClick={() => setActive('usenet')}
                      />
                      <SourceMatrixChip
                        icon={Film}
                        label="Arr Apps"
                        count={mon.arr?.length ?? 0}
                        active={Boolean(mon.arr?.length)}
                        onClick={() => setActive('arr')}
                      />
                      <SourceMatrixChip
                        icon={Shield}
                        label="Network"
                        count={(mon.opnsense?.length ?? 0) + (mon.ntopng?.length ?? 0)}
                        active={Boolean((mon.opnsense?.length ?? 0) + (mon.ntopng?.length ?? 0))}
                        onClick={() => setActive('network')}
                      />
                      <SourceMatrixChip
                        icon={House}
                        label="Home Asst."
                        count={mon.homeassistant?.length ?? 0}
                        active={Boolean(mon.homeassistant?.length)}
                        onClick={() => setActive('home')}
                      />
                      <SourceMatrixChip
                        icon={Bell}
                        label="Alert Rules"
                        count={(mon.alerts ?? []).filter((a) => a.enabled).length}
                        active={Boolean(mon.alerts?.length)}
                        onClick={() => setActive('alerts')}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── 2. GLANCES HOSTS SECTION ── */}
              {active === 'hosts' && (
                <div className="space-y-4">
                  <div className="ms-info-box flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-[var(--mon-accent-hover)] mt-0.5 flex-shrink-0" />
                    <span>
                      Hosts selected here feed the <strong>Server</strong> tab (CPU, memory, storage, loads,
                      thermals and network IO). Add or edit the remote Glances endpoints themselves in <strong>Server Stats</strong> on the main dashboard.
                    </span>
                  </div>

                  {servers.length === 0 ? (
                    <div className="p-8 text-center bg-[var(--mon-surface)] border border-[var(--mon-border)] rounded-xl">
                      <Server className="w-10 h-10 text-[var(--mon-text-faint)] mx-auto mb-3 opacity-60" />
                      <h4 className="text-sm font-semibold text-[var(--mon-text-dim)]">No servers configured in Homedash</h4>
                      <p className="text-xs text-[var(--mon-text-muted)] mt-1 max-w-md mx-auto">
                        Add your Glances instances in <strong>Server Stats</strong> first. They will automatically appear here for monitoring.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {servers.map((srv) => {
                        const isChecked = (mon.glancesHosts ?? []).some((h) => h.id === srv.id);
                        return (
                          <div
                            key={srv.id}
                            onClick={() => toggleGlancesHost(srv)}
                            className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              isChecked
                                ? 'bg-[var(--mon-surface-2)] border-[var(--mon-accent)]/40 shadow-sm'
                                : 'bg-[var(--mon-surface)] border-[var(--mon-border)] hover:border-[var(--mon-border)]'
                            }`}
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div
                                className={`p-2.5 rounded-lg flex-shrink-0 ${
                                  isChecked
                                    ? 'bg-[var(--mon-accent)]/20 text-[var(--mon-accent-hover)]'
                                    : 'bg-[var(--mon-surface-2)] text-[var(--mon-text-faint)]'
                                }`}
                              >
                                <Server className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-[var(--mon-text)] truncate flex items-center gap-2">
                                  {srv.name}
                                  {isChecked && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-[var(--mon-accent)]/20 text-[var(--mon-accent-hover)] rounded">
                                      POLLED
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-[var(--mon-text-muted)] truncate mt-0.5 font-mono">
                                  {srv.url}
                                </div>
                              </div>
                            </div>

                            <SwitchToggle
                              checked={isChecked}
                              onChange={() => toggleGlancesHost(srv)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── 3. SOLAR SECTION ── */}
              {active === 'solar' && (
                <div className="space-y-4">
                  <div className="ms-card">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-3 rounded-xl bg-[var(--mon-warn)]/15 border border-[var(--mon-warn)]/30 text-[var(--mon-warn)]">
                          <Sun className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-[var(--mon-text)]">Solar & Inverter Monitoring</div>
                          <p className="text-xs text-[var(--mon-text-muted)] mt-1 max-w-lg">
                            Polls battery state-of-charge (SOC %), solar PV generation, load, grid import/export, and runtime estimates.
                          </p>
                        </div>
                      </div>
                      <SwitchToggle
                        checked={mon.solar?.enabled ?? false}
                        onChange={(v) => updateMonitoring({ solar: { enabled: v } })}
                      />
                    </div>
                  </div>

                  {inverters.length === 0 ? (
                    <div className="ms-hint flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-[var(--mon-warn)] mt-0.5 flex-shrink-0" />
                      <span>
                        No inverter devices configured yet. Add a Solar Assistant device in the main dashboard settings under <strong>Inverter Monitor</strong> to feed solar data to the monitor hub.
                      </span>
                    </div>
                  ) : (
                    <div className="ms-card">
                      <div className="ms-card-title">Configured Inverters in Homedash</div>
                      <div className="space-y-2">
                        {inverters.map((inv) => (
                          <div
                            key={inv.id}
                            className="p-3 rounded-lg bg-[var(--mon-panel)] border border-[var(--mon-border)] flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <Zap className="w-4 h-4 text-[var(--mon-warn)]" />
                              <span className="font-semibold text-[var(--mon-text)]">{inv.name}</span>
                              <span className="text-[var(--mon-text-faint)] font-mono">({inv.url})</span>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-[var(--mon-ok)]/15 text-[var(--mon-ok)] text-[10px] font-bold uppercase">
                              Linked
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── 4. DOCKER SECTION ── */}
              {active === 'docker' && (
                <div className="space-y-4">
                  <div className="ms-card">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-3 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
                          <HardDrive className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-[var(--mon-text)]">Docker Container Aggregation</div>
                          <p className="text-xs text-[var(--mon-text-muted)] mt-1 max-w-lg">
                            Collects container health metrics across all monitored Glances hosts and surfaces unhealthy, restarting, or dead containers.
                          </p>
                        </div>
                      </div>
                      <SwitchToggle
                        checked={mon.docker?.enabled !== false}
                        onChange={(v) => updateMonitoring({ docker: { enabled: v } })}
                      />
                    </div>
                  </div>

                  <div className="ms-info-box flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-[var(--mon-accent-hover)] mt-0.5 flex-shrink-0" />
                    <span>
                      Docker telemetry works automatically through your configured Glances instances. Ensure Glances has Docker permissions or has the Docker socket mounted.
                    </span>
                  </div>
                </div>
              )}

              {/* ── 5. MEDIA SECTION (Jellyfin / Emby) ── */}
              {active === 'media' && (
                <div className="space-y-4">
                  {(mon.media ?? []).length === 0 ? (
                    <EmptyState
                      icon={Tv}
                      title="No Media Servers Configured"
                      desc="Add Jellyfin or Emby instances to view live user streams, devices, playback progress and transcoding telemetry."
                      actionLabel="Add Jellyfin / Emby"
                      onAction={() =>
                        setEntityModal({
                          open: true,
                          section: 'media',
                          item: { type: 'jellyfin', name: '', url: '', apiKey: '' },
                          isNew: true,
                        })
                      }
                    />
                  ) : (
                    <div className="ms-entity-grid">
                      {(mon.media ?? []).map((item) => (
                        <EntityCard
                          key={item.id}
                          icon={Tv}
                          name={item.name}
                          type={item.type}
                          url={item.url}
                          typeColor={item.type === 'jellyfin' ? '#a855f7' : 'var(--mon-ok)'}
                          badgeLabel={item.type === 'jellyfin' ? 'Jellyfin' : 'Emby'}
                          details={item.apiKey ? 'API Key Configured' : 'No Key'}
                          onCopy={() => copyToClipboard(item.url, 'Media server URL')}
                          onEdit={() =>
                            setEntityModal({
                              open: true,
                              section: 'media',
                              item: { ...item },
                              isNew: false,
                            })
                          }
                          onDelete={() =>
                            setConfirmDialog({
                              title: `Delete ${item.name}?`,
                              message: 'This will stop monitoring streams from this media server.',
                              onConfirm: () =>
                                setList('media', (mon.media ?? []).filter((m) => m.id !== item.id)),
                            })
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── 6. USENET SECTION (SABnzbd / NZBGet) ── */}
              {active === 'usenet' && (
                <div className="space-y-4">
                  {(mon.usenet ?? []).length === 0 ? (
                    <EmptyState
                      icon={Download}
                      title="No Usenet Downloaders Configured"
                      desc="Add SABnzbd or NZBGet instances to track live download speeds, ETA, queued NZBs and paused queue state."
                      actionLabel="Add Downloader"
                      onAction={() =>
                        setEntityModal({
                          open: true,
                          section: 'usenet',
                          item: { type: 'sabnzbd', name: '', url: '', apiKey: '' },
                          isNew: true,
                        })
                      }
                    />
                  ) : (
                    <div className="ms-entity-grid">
                      {(mon.usenet ?? []).map((item) => (
                        <EntityCard
                          key={item.id}
                          icon={Download}
                          name={item.name}
                          type={item.type}
                          url={item.url}
                          typeColor={item.type === 'sabnzbd' ? 'var(--mon-warn)' : '#3b82f6'}
                          badgeLabel={item.type === 'sabnzbd' ? 'SABnzbd' : 'NZBGet'}
                          details={item.apiKey ? 'API Key Auth' : item.username ? 'Basic Auth' : 'No Auth'}
                          onCopy={() => copyToClipboard(item.url, 'Usenet URL')}
                          onEdit={() =>
                            setEntityModal({
                              open: true,
                              section: 'usenet',
                              item: { ...item },
                              isNew: false,
                            })
                          }
                          onDelete={() =>
                            setConfirmDialog({
                              title: `Delete ${item.name}?`,
                              message: 'This will stop monitoring this Usenet downloader queue.',
                              onConfirm: () =>
                                setList('usenet', (mon.usenet ?? []).filter((u) => u.id !== item.id)),
                            })
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── 7. ARR SECTION (Sonarr / Radarr) ── */}
              {active === 'arr' && (
                <div className="space-y-4">
                  {(mon.arr ?? []).length === 0 ? (
                    <EmptyState
                      icon={Film}
                      title="No Sonarr / Radarr Instances Configured"
                      desc="Add Sonarr or Radarr to monitor download activity, import queues and disk storage warnings."
                      actionLabel="Add Sonarr / Radarr"
                      onAction={() =>
                        setEntityModal({
                          open: true,
                          section: 'arr',
                          item: { type: 'sonarr', name: '', url: '', apiKey: '' },
                          isNew: true,
                        })
                      }
                    />
                  ) : (
                    <div className="ms-entity-grid">
                      {(mon.arr ?? []).map((item) => (
                        <EntityCard
                          key={item.id}
                          icon={Film}
                          name={item.name}
                          type={item.type}
                          url={item.url}
                          typeColor={item.type === 'sonarr' ? '#38bdf8' : '#fb923c'}
                          badgeLabel={item.type === 'sonarr' ? 'Sonarr (TV)' : 'Radarr (Movies)'}
                          details={item.apiKey ? 'API Key Configured' : 'No Key'}
                          onCopy={() => copyToClipboard(item.url, 'Arr URL')}
                          onEdit={() =>
                            setEntityModal({
                              open: true,
                              section: 'arr',
                              item: { ...item },
                              isNew: false,
                            })
                          }
                          onDelete={() =>
                            setConfirmDialog({
                              title: `Delete ${item.name}?`,
                              message: 'This will stop monitoring this Arr instance queue.',
                              onConfirm: () =>
                                setList('arr', (mon.arr ?? []).filter((a) => a.id !== item.id)),
                            })
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── 8. SEERR SECTION (Overseerr / Jellyseerr) ── */}
              {active === 'seerr' && (
                <div className="space-y-4">
                  {(mon.seerr ?? []).length === 0 ? (
                    <EmptyState
                      icon={Clapperboard}
                      title="No Seerr / Overseerr Instances Configured"
                      desc="Add Overseerr or Jellyseerr to track pending media requests and open streaming playback issues."
                      actionLabel="Add Seerr Instance"
                      onAction={() =>
                        setEntityModal({
                          open: true,
                          section: 'seerr',
                          item: { type: 'overseerr', name: '', url: '', apiKey: '' },
                          isNew: true,
                        })
                      }
                    />
                  ) : (
                    <div className="ms-entity-grid">
                      {(mon.seerr ?? []).map((item) => (
                        <EntityCard
                          key={item.id}
                          icon={Clapperboard}
                          name={item.name}
                          type={item.type}
                          url={item.url}
                          typeColor="#f97316"
                          badgeLabel={item.type}
                          details={item.apiKey ? 'API Key Configured' : 'No Key'}
                          onCopy={() => copyToClipboard(item.url, 'Seerr URL')}
                          onEdit={() =>
                            setEntityModal({
                              open: true,
                              section: 'seerr',
                              item: { ...item },
                              isNew: false,
                            })
                          }
                          onDelete={() =>
                            setConfirmDialog({
                              title: `Delete ${item.name}?`,
                              message: 'This will stop monitoring requests and issues from this Seerr instance.',
                              onConfirm: () =>
                                setList('seerr', (mon.seerr ?? []).filter((s) => s.id !== item.id)),
                            })
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── 9. NETWORK APPLIANCES SECTION (OPNsense + ntopng) ── */}
              {active === 'network' && (
                <div className="space-y-6">
                  {/* OPNsense Sub-section */}
                  <div className="ms-card">
                    <div className="flex items-center justify-between mb-3">
                      <div className="ms-card-title mb-0">
                        <Shield className="w-4 h-4 text-[var(--mon-danger)]" />
                        OPNsense Firewall (Multi-WAN & Gateways)
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setEntityModal({
                            open: true,
                            section: 'network',
                            item: {
                              _type: 'opnsense',
                              name: 'opnsense-main',
                              url: 'https://192.168.1.1',
                              apiKey: '',
                              apiSecret: '',
                              insecureTls: true,
                            },
                            isNew: true,
                          })
                        }
                        className="ms-btn ms-btn-primary text-xs py-1 px-2.5"
                      >
                        <Plus className="w-3 h-3" /> Add OPNsense
                      </button>
                    </div>

                    {(mon.opnsense ?? []).length === 0 ? (
                      <div className="p-4 text-center rounded-lg bg-[var(--mon-panel)] border border-[var(--mon-border-soft)] text-xs text-[var(--mon-text-muted)]">
                        No OPNsense firewalls configured. Click "+ Add OPNsense" above.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(mon.opnsense ?? []).map((item) => (
                          <EntityCard
                            key={item.id}
                            icon={Shield}
                            name={item.name}
                            type="OPNsense"
                            url={item.url}
                            typeColor="var(--mon-danger)"
                            badgeLabel="OPNsense"
                            details={item.insecureTls ? 'TLS Insecure Allowed' : 'Strict TLS'}
                            onCopy={() => copyToClipboard(item.url, 'OPNsense URL')}
                            onEdit={() =>
                              setEntityModal({
                                open: true,
                                section: 'network',
                                item: { ...item, _type: 'opnsense' },
                                isNew: false,
                              })
                            }
                            onDelete={() =>
                              setConfirmDialog({
                                title: `Delete ${item.name}?`,
                                message: 'This will stop polling gateway & WAN telemetry from this firewall.',
                                onConfirm: () =>
                                  setList(
                                    'opnsense',
                                    (mon.opnsense ?? []).filter((o) => o.id !== item.id),
                                  ),
                              })
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ntopng Sub-section */}
                  <div className="ms-card">
                    <div className="flex items-center justify-between mb-3">
                      <div className="ms-card-title mb-0">
                        <Radio className="w-4 h-4 text-[var(--mon-accent-hover)]" />
                        ntopng (Network Traffic & Top Talkers)
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setEntityModal({
                            open: true,
                            section: 'network',
                            item: {
                              _type: 'ntopng',
                              name: 'ntopng-main',
                              url: 'http://192.168.1.40:3000',
                              username: 'admin',
                              password: '',
                              ifid: 0,
                              insecureTls: false,
                            },
                            isNew: true,
                          })
                        }
                        className="ms-btn ms-btn-primary text-xs py-1 px-2.5"
                      >
                        <Plus className="w-3 h-3" /> Add ntopng
                      </button>
                    </div>

                    {(mon.ntopng ?? []).length === 0 ? (
                      <div className="p-4 text-center rounded-lg bg-[var(--mon-panel)] border border-[var(--mon-border-soft)] text-xs text-[var(--mon-text-muted)]">
                        No ntopng traffic analysers configured. Click "+ Add ntopng" above.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(mon.ntopng ?? []).map((item) => (
                          <EntityCard
                            key={item.id}
                            icon={Radio}
                            name={item.name}
                            type="ntopng"
                            url={item.url}
                            typeColor="#3b82f6"
                            badgeLabel="ntopng"
                            details={`Interface ID: ${item.ifid ?? 'Auto'}`}
                            onCopy={() => copyToClipboard(item.url, 'ntopng URL')}
                            onEdit={() =>
                              setEntityModal({
                                open: true,
                                section: 'network',
                                item: { ...item, _type: 'ntopng' },
                                isNew: false,
                              })
                            }
                            onDelete={() =>
                              setConfirmDialog({
                                title: `Delete ${item.name}?`,
                                message: 'This will stop polling traffic analytics from this instance.',
                                onConfirm: () =>
                                  setList(
                                    'ntopng',
                                    (mon.ntopng ?? []).filter((n) => n.id !== item.id),
                                  ),
                              })
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── 10. HOME ASSISTANT SECTION ── */}
              {active === 'home' && (
                <div className="space-y-4">
                  {(mon.homeassistant ?? []).length === 0 ? (
                    <EmptyState
                      icon={House}
                      title="No Home Assistant Hubs Configured"
                      desc="Connect Home Assistant with a long-lived access token to monitor offline IoT devices, sensor battery levels, door states and glanceable entities."
                      actionLabel="Add Home Assistant"
                      onAction={() =>
                        setEntityModal({
                          open: true,
                          section: 'home',
                          item: {
                            name: 'home-assistant',
                            url: 'http://homeassistant.local:8123',
                            token: '',
                            insecureTls: false,
                          },
                          isNew: true,
                        })
                      }
                    />
                  ) : (
                    <div className="ms-entity-grid">
                      {(mon.homeassistant ?? []).map((item) => (
                        <EntityCard
                          key={item.id}
                          icon={House}
                          name={item.name}
                          type="Home Assistant"
                          url={item.url}
                          typeColor="#14b8a6"
                          badgeLabel="Home Assistant"
                          details={item.token ? 'Token Configured' : 'No Token'}
                          onCopy={() => copyToClipboard(item.url, 'Home Assistant URL')}
                          onEdit={() =>
                            setEntityModal({
                              open: true,
                              section: 'home',
                              item: { ...item },
                              isNew: false,
                            })
                          }
                          onDelete={() =>
                            setConfirmDialog({
                              title: `Delete ${item.name}?`,
                              message: 'This will stop polling metrics from this Home Assistant instance.',
                              onConfirm: () =>
                                setList(
                                  'homeassistant',
                                  (mon.homeassistant ?? []).filter((h) => h.id !== item.id),
                                ),
                            })
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── 10b. TLS CERTIFICATES SECTION ── */}
              {active === 'certs' && (
                <div className="space-y-4">
                  {certRefreshError && (
                    <div className="p-2.5 rounded-lg bg-[var(--mon-danger)]/10 border border-[var(--mon-danger)]/25 text-xs text-[var(--mon-danger)]">
                      {certRefreshError}
                    </div>
                  )}
                  <div className="ms-card">
                    <div className="flex items-center justify-between mb-3">
                      <div className="ms-card-title mb-0">
                        <Lock className="w-4 h-4 text-[var(--mon-ok)]" />
                        TLS Certificates (Expiry Watch)
                        {(mon.certificates ?? []).length > 0 && (
                          <span className="ml-2 text-[10px] font-medium text-[var(--mon-text-faint)]">
                            re-checked ~daily · Refresh to re-verify now
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {(mon.certificates ?? []).length > 0 && (
                          <button
                            type="button"
                            onClick={() => doRefreshCertificates()}
                            disabled={certAllRefreshing}
                            className="ms-btn text-xs py-1 px-2.5"
                          >
                            <RefreshCw className={`w-3 h-3 ${certAllRefreshing ? 'animate-spin' : ''}`} />
                            Refresh All
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setEntityModal({
                              open: true,
                              section: 'certs',
                              item: { name: '', host: '', port: 443 },
                              isNew: true,
                            })
                          }
                          className="ms-btn ms-btn-primary text-xs py-1 px-2.5"
                        >
                          <Plus className="w-3 h-3" /> Add Certificate
                        </button>
                      </div>
                    </div>

                    {(mon.certificates ?? []).length === 0 ? (
                      <div className="p-4 text-center rounded-lg bg-[var(--mon-panel)] border border-[var(--mon-border-soft)] text-xs text-[var(--mon-text-muted)]">
                        No certificates configured. Add a host:port to watch its TLS expiry — you'll be
                        alerted when fewer than 5 days remain.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(mon.certificates ?? []).map((item) => {
                          const live = liveCertFor(item);
                          const days = live?.daysLeft ?? null;
                          const status = live?.status ?? null;
                          let expiryLabel = 'Not checked yet';
                          let expiryColor = 'var(--mon-text-faint)';
                          if (status === 'error') {
                            expiryLabel = 'Unreachable';
                            expiryColor = 'var(--mon-text-faint)';
                          } else if (typeof days === 'number') {
                            if (days < 0) {
                              expiryLabel = 'EXPIRED';
                              expiryColor = 'var(--mon-danger)';
                            } else if (days <= 5) {
                              expiryLabel = `${days} days left`;
                              expiryColor = 'var(--mon-danger)';
                            } else if (days <= 21) {
                              expiryLabel = `${days} days left`;
                              expiryColor = 'var(--mon-warn)';
                            } else {
                              expiryLabel = `${days} days left`;
                              expiryColor = 'var(--mon-ok)';
                            }
                          }
                          const refreshing = certRefreshing.has(item.id);
                          return (
                            <EntityCard
                              key={item.id}
                              icon={Lock}
                              name={item.name}
                              url={`${item.host}:${item.port ?? 443}`}
                              type="#10b981"
                              badgeLabel="TLS"
                              details={`Port ${item.port ?? 443}`}
                              expiry={{ label: expiryLabel, color: expiryColor }}
                              onCopy={() => copyToClipboard(`${item.host}:${item.port ?? 443}`, 'Certificate endpoint')}
                              onRefresh={() => doRefreshCertificates([item.id])}
                              refreshing={refreshing}
                              onEdit={() =>
                                setEntityModal({
                                  open: true,
                                  section: 'certs',
                                  item: { ...item },
                                  isNew: false,
                                })
                              }
                              onDelete={() =>
                                setConfirmDialog({
                                  title: `Delete ${item.name}?`,
                                  message: 'This will stop watching the certificate expiry for this endpoint.',
                                  onConfirm: () =>
                                    setList(
                                      'certificates',
                                      (mon.certificates ?? []).filter((c) => c.id !== item.id),
                                    ),
                                })
                              }
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── 11. ALERTS SECTION ── */}
              {active === 'alerts' && (
                <div className="space-y-4">
                  <AlertsSection
                    rules={mon.alerts ?? []}
                    servers={servers}
                    onChange={(newRules) => updateMonitoring({ alerts: newRules })}
                    onRemove={(id) =>
                      updateMonitoring({
                        alerts: (mon.alerts ?? []).filter((r) => r.id !== id),
                        suppressedAutoAlerts: [...(mon.suppressedAutoAlerts ?? []), id],
                      })
                    }
                  />
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* ── Add / Edit Entity Modal ── */}
      {entityModal && entityModal.open && (
        <EntityModalDialog
          section={entityModal.section}
          item={entityModal.item}
          isNew={entityModal.isNew}
          onSave={handleSaveEntity}
          onClose={() => setEntityModal(null)}
        />
      )}

      {/* ── Confirmation Dialog ── */}
      {confirmDialog && (
        <div className="ms-submodal-overlay">
          <div className="ms-submodal-dialog max-w-md animate-in zoom-in-95 duration-150">
            <div className="p-5">
              <div className="flex items-center gap-3 text-[var(--mon-danger)] mb-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <h3 className="text-sm font-bold text-[var(--mon-text)]">{confirmDialog.title}</h3>
              </div>
              <p className="text-xs text-[var(--mon-text-dim)] leading-relaxed pl-8">
                {confirmDialog.message}
              </p>
            </div>
            <div className="ms-submodal-footer">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="ms-btn ms-btn-ghost text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="ms-btn ms-btn-danger text-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Subcomponents & UI Controls
   ────────────────────────────────────────────────────────────── */

function PresetSlider({
  label,
  detail,
  value,
  min,
  max,
  step,
  unit,
  presets = [],
  onChange,
}: {
  label: string;
  detail?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  presets?: { label: string; value: number }[];
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="ms-row-label">{label}</div>
          {detail && <div className="ms-row-detail">{detail}</div>}
        </div>
        <div className="flex items-baseline gap-1 bg-[var(--mon-panel)] px-3 py-1 rounded-lg border border-[var(--mon-border)]">
          <span className="ms-slider-val text-[var(--mon-accent-hover)]">{value}</span>
          <span className="ms-slider-unit">{unit}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="range"
          className="ms-slider"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>

      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {presets.map((p) => {
            const isSelected = value === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange(p.value)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition-all ${
                  isSelected
                    ? 'bg-[var(--mon-accent)] text-white border-[var(--mon-accent)] shadow-sm'
                    : 'bg-[var(--mon-surface-2)] text-[var(--mon-text-muted)] border-[var(--mon-border)] hover:bg-[var(--mon-surface-2)] hover:text-[var(--mon-text-dim)]'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SourceMatrixChip({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
        active
          ? 'bg-[var(--mon-surface-2)] border-[var(--mon-accent)]/30 hover:border-[var(--mon-accent)]/50'
          : 'bg-[var(--mon-panel)] border-[var(--mon-border)] hover:border-[var(--mon-border)] opacity-75'
      }`}
    >
      <div className="flex items-center justify-between w-full mb-2">
        <Icon className={`w-4 h-4 ${active ? 'text-[var(--mon-accent-hover)]' : 'text-[var(--mon-text-faint)]'}`} />
        <span
          className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
            active ? 'bg-[var(--mon-accent)]/25 text-[var(--mon-accent-hover)]' : 'bg-[var(--mon-surface-2)] text-[var(--mon-text-faint)]'
          }`}
        >
          {count}
        </span>
      </div>
      <div className="text-xs font-semibold text-[var(--mon-text-dim)]">{label}</div>
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  desc,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="p-8 text-center bg-[var(--mon-panel)] border border-[var(--mon-border-soft)] rounded-xl flex flex-col items-center justify-center">
      <div className="p-3.5 rounded-2xl bg-[var(--mon-accent)]/10 border border-[var(--mon-accent)]/20 text-[var(--mon-accent-hover)] mb-3.5">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-bold text-[var(--mon-text)] mb-1">{title}</h4>
      <p className="text-xs text-[var(--mon-text-muted)] max-w-sm mb-4 leading-relaxed">{desc}</p>
      <button type="button" onClick={onAction} className="ms-btn ms-btn-primary text-xs">
        <Plus className="w-3.5 h-3.5" /> {actionLabel}
      </button>
    </div>
  );
}

function EntityCard({
  icon: Icon,
  name,
  url,
  typeColor = 'var(--mon-accent)',
  badgeLabel,
  details,
  expiry,
  onCopy,
  onEdit,
  onDelete,
  onRefresh,
  refreshing = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  type?: string;
  url: string;
  typeColor?: string;
  badgeLabel?: string;
  details?: string;
  expiry?: { label: string; color: string };
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <div className="ms-entity-card">
      <div className="flex items-start gap-3.5 min-w-0">
        <div
          className="p-2.5 rounded-xl flex-shrink-0"
          style={{ backgroundColor: `${typeColor}18`, color: typeColor, border: `1px solid ${typeColor}35` }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="ms-entity-name truncate">{name}</span>
            {badgeLabel && (
              <span
                className="ms-entity-type-badge flex-shrink-0"
                style={{ backgroundColor: `${typeColor}18`, color: typeColor, borderColor: `${typeColor}35` }}
              >
                {badgeLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="ms-entity-meta truncate">{url}</span>
            <button
              type="button"
              onClick={onCopy}
              className="text-[var(--mon-text-faint)] hover:text-[var(--mon-text-dim)] p-0.5"
              title="Copy URL"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
          {(details || expiry) && (
            <div className="flex items-center gap-2 mt-0.5">
              {details && <div className="text-[10px] text-[var(--mon-text-faint)]">{details}</div>}
              {expiry && (
                <div className="text-[10px] font-semibold" style={{ color: expiry.color }}>
                  {expiry.label}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="ms-entity-actions">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="ms-icon-btn ms-icon-btn-primary"
            title={refreshing ? 'Re-checking…' : 'Re-check certificate now'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="ms-icon-btn ms-icon-btn-primary"
          title="Edit configuration"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="ms-icon-btn ms-icon-btn-danger"
          title="Delete service"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────── */

function defaultMonitoring(): MonitoringConfig {
  return {
    enabled: false,
    pollIntervalSeconds: 10,
    glancesHosts: [],
    solar: { enabled: false },
    docker: { enabled: true },
    media: [],
    usenet: [],
    arr: [],
    seerr: [],
    opnsense: [],
    ntopng: [],
    homeassistant: [],
    certificates: [],
    ui: { tabRotationSeconds: 15 },
    alerts: [],
  };
}
