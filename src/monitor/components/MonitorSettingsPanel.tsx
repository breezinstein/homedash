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
  Eye,
  EyeOff,
  Search,
  Zap,
  Layers,
  AlertTriangle,
  Info,
  CheckCircle2,
  Sliders,
  Radio,
} from 'lucide-react';
import { configApi } from '../../api/configApi';
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
  RemoteServer,
  AlertRule,
  Severity,
} from '../../types';

interface MonitorSettingsPanelProps {
  onClose: () => void;
}

type SectionKey =
  | 'general'
  | 'hosts'
  | 'solar'
  | 'docker'
  | 'media'
  | 'usenet'
  | 'arr'
  | 'seerr'
  | 'network'
  | 'home'
  | 'alerts';

interface NavSectionItem {
  key: SectionKey;
  label: string;
  group: 'Core' | 'Media' | 'Infra' | 'Automation';
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  description: string;
}

const NAV_SECTIONS: NavSectionItem[] = [
  { key: 'general', label: 'General Engine', group: 'Core', icon: Activity, accentColor: '#6366f1', description: 'Master switch, poll intervals and kiosk tab rotation' },
  { key: 'hosts', label: 'Glances Hosts', group: 'Core', icon: Server, accentColor: '#3b82f6', description: 'Server metrics (CPU, RAM, load, temperatures & disks)' },
  { key: 'solar', label: 'Solar & Energy', group: 'Core', icon: Sun, accentColor: '#eab308', description: 'Solar Assistant battery, solar PV, grid and house load' },
  { key: 'docker', label: 'Docker Engine', group: 'Core', icon: HardDrive, accentColor: '#06b6d4', description: 'Container health, restarting/unhealthy state monitoring' },
  { key: 'media', label: 'Media Streams', group: 'Media', icon: Tv, accentColor: '#a855f7', description: 'Jellyfin and Emby active playback sessions & transcoding' },
  { key: 'usenet', label: 'Usenet Queues', group: 'Media', icon: Download, accentColor: '#10b981', description: 'SABnzbd & NZBGet queue progress, speed & ETA' },
  { key: 'arr', label: 'Sonarr / Radarr', group: 'Media', icon: Film, accentColor: '#0ea5e9', description: 'Active downloads, queue pipelines & disk health warnings' },
  { key: 'seerr', label: 'Media Requests', group: 'Media', icon: Clapperboard, accentColor: '#f97316', description: 'Overseerr & Jellyseerr pending requests and media issues' },
  { key: 'network', label: 'Network Appliances', group: 'Infra', icon: Shield, accentColor: '#ef4444', description: 'OPNsense multi-WAN firewall & ntopng traffic analytics' },
  { key: 'home', label: 'Home Assistant', group: 'Infra', icon: House, accentColor: '#14b8a6', description: 'Smart-home device reachability, battery and sensors' },
  { key: 'alerts', label: 'Alert Rules', group: 'Automation', icon: Bell, accentColor: '#ec4899', description: 'Real-time telemetry thresholds and firing notifications' },
];

const SOURCE_LABELS: Record<AlertRule['source'], string> = {
  glances: 'Host (Glances)',
  solar: 'Solar / Battery',
  docker: 'Docker',
  media: 'Media streams',
  usenet: 'Usenet',
  seerr: 'Seerr / Overseerr',
  homeassistant: 'Home Assistant',
  ntopng: 'ntopng',
  reachability: 'Host reachability',
};

const METRICS: Record<AlertRule['source'], { value: string; label: string }[]> = {
  glances: [
    { value: 'cpu.percent', label: 'CPU %' },
    { value: 'memory.percent', label: 'Memory %' },
    { value: 'disk.percent', label: 'Disk %' },
    { value: 'temperature', label: 'Temperature °C' },
    { value: 'cpu.load.1m', label: 'Load average (1m)' },
    { value: 'network.rxBps', label: 'Network ↓ (B/s)' },
    { value: 'network.txBps', label: 'Network ↑ (B/s)' },
  ],
  solar: [
    { value: 'battery.soc', label: 'Battery SOC %' },
    { value: 'battery.power', label: 'Battery power (W)' },
    { value: 'pv.power', label: 'PV power (W)' },
    { value: 'grid.power', label: 'Grid power (W)' },
    { value: 'load.percent', label: 'Load % of capacity' },
  ],
  docker: [
    { value: 'docker.unhealthy', label: 'Unhealthy containers' },
    { value: 'docker.restarting', label: 'Restarting containers' },
    { value: 'docker.runningRatio', label: 'Running ratio (0–1)' },
  ],
  media: [
    { value: 'streams.transcoding', label: 'Transcoding streams' },
    { value: 'streams.count', label: 'Active streams' },
  ],
  usenet: [
    { value: 'downloads.paused', label: 'Downloads paused' },
    { value: 'queue.slots', label: 'Queued items' },
    { value: 'downloads.speed', label: 'Download speed (B/s)' },
  ],
  seerr: [
    { value: 'seerr.issues', label: 'Open media issues' },
    { value: 'seerr.pending', label: 'Pending requests' },
    { value: 'seerr.failed', label: 'Failed requests' },
  ],
  homeassistant: [
    { value: 'ha.unavailable', label: 'Devices offline' },
    { value: 'ha.unavailableRatio', label: 'Share of devices offline (0–1)' },
    { value: 'ha.batteryLow', label: 'Lowest battery %' },
    { value: 'ha.doorsOpen', label: 'Doors open' },
    { value: 'ha.entities', label: 'Entity count' },
  ],
  ntopng: [
    { value: 'ntopng.topThroughput', label: 'Busiest host (B/s)' },
    { value: 'ntopng.talkerCount', label: 'Top talkers tracked' },
  ],
  reachability: [
    { value: 'reachable', label: 'Host reachable (0/1)' },
  ],
};

const OPERATORS = ['>', '>=', '<', '<=', '==', '!='] as const;

const SEVERITIES: { value: Severity; label: string; color: string; bg: string }[] = [
  { value: 'critical', label: 'Critical', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.16)' },
  { value: 'warning', label: 'Warning', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.16)' },
  { value: 'info', label: 'Info', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.16)' },
];

export function MonitorSettingsPanel({ onClose }: MonitorSettingsPanelProps) {
  const [draft, setDraft] = useState<DashboardConfig | null>(null);
  const [initialJson, setInitialJson] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<SectionKey>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Submodal state for Add/Edit
  const [entityModal, setEntityModal] = useState<{
    open: boolean;
    section: SectionKey;
    item: any;
    isNew: boolean;
  } | null>(null);

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
    <K extends 'media' | 'usenet' | 'arr' | 'seerr' | 'opnsense' | 'ntopng' | 'homeassistant'>(
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
        return { dot: mon.enabled ? '#10b981' : '#6b7280' };
      case 'hosts':
        return { count: mon.glancesHosts?.length ?? 0 };
      case 'solar':
        return { dot: mon.solar?.enabled ? '#10b981' : '#6b7280' };
      case 'docker':
        return { dot: mon.docker?.enabled !== false ? '#10b981' : '#6b7280' };
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

  // Generic Save entity handler
  const handleSaveEntity = (item: any, isNew: boolean) => {
    if (!entityModal) return;
    const sec = entityModal.section;
    if (sec === 'media') {
      const list = mon.media ?? [];
      if (isNew) {
        setList('media', [...list, { ...item, id: newId() } as MonitoredMedia]);
      } else {
        setList('media', list.map((i) => (i.id === item.id ? item : i)));
      }
    } else if (sec === 'usenet') {
      const list = mon.usenet ?? [];
      if (isNew) {
        setList('usenet', [...list, { ...item, id: newId() } as MonitoredUsenet]);
      } else {
        setList('usenet', list.map((i) => (i.id === item.id ? item : i)));
      }
    } else if (sec === 'arr') {
      const list = mon.arr ?? [];
      if (isNew) {
        setList('arr', [...list, { ...item, id: newId() } as MonitoredArr]);
      } else {
        setList('arr', list.map((i) => (i.id === item.id ? item : i)));
      }
    } else if (sec === 'seerr') {
      const list = mon.seerr ?? [];
      if (isNew) {
        setList('seerr', [...list, { ...item, id: newId() } as MonitoredSeerr]);
      } else {
        setList('seerr', list.map((i) => (i.id === item.id ? item : i)));
      }
    } else if (sec === 'network') {
      if (item._type === 'opnsense') {
        const list = mon.opnsense ?? [];
        const clean = { ...item };
        delete clean._type;
        if (isNew) {
          setList('opnsense', [...list, { ...clean, id: newId() } as MonitoredOpnsense]);
        } else {
          setList('opnsense', list.map((i) => (i.id === item.id ? clean : i)));
        }
      } else {
        const list = mon.ntopng ?? [];
        const clean = { ...item };
        delete clean._type;
        if (isNew) {
          setList('ntopng', [...list, { ...clean, id: newId() } as MonitoredNtopng]);
        } else {
          setList('ntopng', list.map((i) => (i.id === item.id ? clean : i)));
        }
      }
    } else if (sec === 'home') {
      const list = mon.homeassistant ?? [];
      if (isNew) {
        setList('homeassistant', [...list, { ...item, id: newId() } as MonitoredHomeAssistant]);
      } else {
        setList('homeassistant', list.map((i) => (i.id === item.id ? item : i)));
      }
    }
    setEntityModal(null);
  };

  const copyToClipboard = (text: string, label = 'Copied') => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard`);
  };

  if (loading) {
    return (
      <div className="ms-overlay">
        <div className="ms-dialog items-center justify-center p-8">
          <div className="ms-loading">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
            <span className="text-sm text-neutral-300 font-medium">Loading monitor configuration…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ms-overlay" role="dialog" aria-modal="true">
      <div className="ms-dialog">
        {/* Top Header */}
        <header className="ms-header">
          <div className="ms-logo">
            <Activity className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="ms-title-block">
            <div className="flex items-center gap-2.5">
              <span className="ms-title">Monitor Settings</span>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold tracking-wide uppercase ${
                  mon.enabled
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                    : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    mon.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'
                  }`}
                />
                {mon.enabled ? `Live · ${mon.pollIntervalSeconds || 10}s` : 'Paused'}
              </span>
              {hasUnsavedChanges && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
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
          <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-[#1a1a20] border border-[#292934] rounded-lg text-[11px] text-neutral-400">
            <span>
              <strong className="text-neutral-200">{mon.glancesHosts?.length ?? 0}</strong> hosts
            </span>
            <span className="w-1 h-1 rounded-full bg-neutral-600" />
            <span>
              <strong className="text-neutral-200">
                {(mon.media?.length ?? 0) + (mon.usenet?.length ?? 0) + (mon.arr?.length ?? 0)}
              </strong>{' '}
              media sources
            </span>
            <span className="w-1 h-1 rounded-full bg-neutral-600" />
            <span>
              <strong className="text-neutral-200">
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
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg shadow-lg shadow-black/50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
            <CheckCircle2 className="w-4 h-4 text-indigo-200" />
            {toastMsg}
          </div>
        )}

        {/* Body layout */}
        <div className="ms-body">
          {/* Left Navigation Sidebar */}
          <nav className="ms-nav">
            {/* Search Input */}
            <div className="relative mb-2 px-1">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter settings…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px' }}
                className="w-full bg-[#18181f] border border-[#272732] rounded-lg pr-2.5 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-indigo-500"
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
            <div className="mt-auto pt-3 border-t border-[#23232c] px-2 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                <span>Telemetry Engine</span>
                <span className={mon.enabled ? 'text-emerald-400 font-semibold' : 'text-neutral-500'}>
                  {mon.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => updateMonitoring({ enabled: !mon.enabled })}
                className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-2 ${
                  mon.enabled
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20'
                    : 'bg-neutral-800/80 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
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
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Section Header */}
              <div className="ms-section-header">
                <div>
                  <div className="ms-section-title">
                    <activeSectionMeta.icon className="w-5 h-5 text-indigo-400" />
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
                  <div className="p-5 rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/30 via-[#181820] to-[#16161b] flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="p-3 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
                        <Zap className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          Master Telemetry Engine
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              mon.enabled
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                            }`}
                          >
                            {mon.enabled ? 'ACTIVE' : 'IDLE'}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-1 max-w-lg leading-relaxed">
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
                      <Sliders className="w-4 h-4 text-indigo-400" />
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

                      <div className="border-t border-[#23232c]" />

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
                      <Layers className="w-4 h-4 text-indigo-400" />
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
                    <Info className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                    <span>
                      Hosts selected here feed the <strong>Server</strong> tab (CPU, memory, storage, loads,
                      thermals and network IO). Configure remote Glances endpoints in the main dashboard settings under <strong>Server Stats</strong>.
                    </span>
                  </div>

                  {servers.length === 0 ? (
                    <div className="p-8 text-center bg-[#16161c] border border-[#282834] rounded-xl">
                      <Server className="w-10 h-10 text-neutral-500 mx-auto mb-3 opacity-60" />
                      <h4 className="text-sm font-semibold text-neutral-200">No servers configured in Homedash</h4>
                      <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
                        Add your Glances instances in the dashboard settings first. They will automatically appear here for monitoring.
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
                                ? 'bg-indigo-950/20 border-indigo-500/40 shadow-sm shadow-indigo-950/50'
                                : 'bg-[#16161b] border-[#262632] hover:border-[#383848]'
                            }`}
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div
                                className={`p-2.5 rounded-lg flex-shrink-0 ${
                                  isChecked
                                    ? 'bg-indigo-500/20 text-indigo-300'
                                    : 'bg-neutral-800 text-neutral-500'
                                }`}
                              >
                                <Server className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-white truncate flex items-center gap-2">
                                  {srv.name}
                                  {isChecked && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded">
                                      POLLED
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-neutral-400 truncate mt-0.5 font-mono">
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
                        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                          <Sun className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">Solar & Inverter Monitoring</div>
                          <p className="text-xs text-neutral-400 mt-1 max-w-lg">
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
                      <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span>
                        No inverter devices configured yet. Add a Solar Assistant device in the main dashboard settings under <strong>Inverter Monitor</strong> to feed solar data to the monitor hub.
                      </span>
                    </div>
                  ) : (
                    <div className="ms-card">
                      <div className="ms-card-title">Configured Inverters in Homedash</div>
                      <div className="space-y-2">
                        {inverters.map((inv: any) => (
                          <div
                            key={inv.id}
                            className="p-3 rounded-lg bg-[#141419] border border-[#262630] flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <Zap className="w-4 h-4 text-amber-400" />
                              <span className="font-semibold text-white">{inv.name}</span>
                              <span className="text-neutral-500 font-mono">({inv.url})</span>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-bold uppercase">
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
                          <div className="text-sm font-bold text-white">Docker Container Aggregation</div>
                          <p className="text-xs text-neutral-400 mt-1 max-w-lg">
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
                    <Info className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
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
                          typeColor={item.type === 'jellyfin' ? '#a855f7' : '#22c55e'}
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
                          typeColor={item.type === 'sabnzbd' ? '#eab308' : '#3b82f6'}
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
                        <Shield className="w-4 h-4 text-red-400" />
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
                      <div className="p-4 text-center rounded-lg bg-[#141418] border border-[#24242e] text-xs text-neutral-400">
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
                            typeColor="#ef4444"
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
                        <Radio className="w-4 h-4 text-blue-400" />
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
                      <div className="p-4 text-center rounded-lg bg-[#141418] border border-[#24242e] text-xs text-neutral-400">
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
              <div className="flex items-center gap-3 text-red-400 mb-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <h3 className="text-sm font-bold text-white">{confirmDialog.title}</h3>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed pl-8">
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

function SwitchToggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`ms-toggle-wrap ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
      data-checked={checked}
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onChange(!checked);
        }
      }}
    >
      <div className="ms-toggle-track">
        <div className="ms-toggle-thumb" />
      </div>
    </div>
  );
}

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
        <div className="flex items-baseline gap-1 bg-[#141419] px-3 py-1 rounded-lg border border-[#272732]">
          <span className="ms-slider-val text-indigo-400">{value}</span>
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
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                    : 'bg-[#18181f] text-neutral-400 border-[#262632] hover:bg-[#202029] hover:text-neutral-200'
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
          ? 'bg-indigo-950/20 border-indigo-500/30 hover:border-indigo-500/50'
          : 'bg-[#141419] border-[#252530] hover:border-[#333342] opacity-75'
      }`}
    >
      <div className="flex items-center justify-between w-full mb-2">
        <Icon className={`w-4 h-4 ${active ? 'text-indigo-400' : 'text-neutral-500'}`} />
        <span
          className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
            active ? 'bg-indigo-500/25 text-indigo-300' : 'bg-neutral-800 text-neutral-500'
          }`}
        >
          {count}
        </span>
      </div>
      <div className="text-xs font-semibold text-neutral-200">{label}</div>
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
    <div className="p-8 text-center bg-[#15151b] border border-[#242430] rounded-xl flex flex-col items-center justify-center">
      <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-3.5">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-bold text-white mb-1">{title}</h4>
      <p className="text-xs text-neutral-400 max-w-sm mb-4 leading-relaxed">{desc}</p>
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
  typeColor = '#6366f1',
  badgeLabel,
  details,
  onCopy,
  onEdit,
  onDelete,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  type?: string;
  url: string;
  typeColor?: string;
  badgeLabel?: string;
  details?: string;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
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
              className="text-neutral-500 hover:text-neutral-300 p-0.5"
              title="Copy URL"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
          {details && <div className="text-[10px] text-neutral-500 mt-0.5">{details}</div>}
        </div>
      </div>

      <div className="ms-entity-actions">
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
   Entity Add / Edit Dialog Form
   ────────────────────────────────────────────────────────────── */

function EntityModalDialog({
  section,
  item,
  isNew,
  onSave,
  onClose,
}: {
  section: SectionKey;
  item: any;
  isNew: boolean;
  onSave: (form: any, isNew: boolean) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<any>({ ...item });
  const [showPassword, setShowPassword] = useState(false);

  const setField = (key: string, val: any) => {
    setForm((prev: any) => ({ ...prev, [key]: val }));
  };

  const getTitle = () => {
    const action = isNew ? 'Add' : 'Edit';
    switch (section) {
      case 'media':
        return `${action} Media Server`;
      case 'usenet':
        return `${action} Usenet Downloader`;
      case 'arr':
        return `${action} Sonarr / Radarr`;
      case 'seerr':
        return `${action} Seerr Instance`;
      case 'network':
        return form._type === 'opnsense' ? `${action} OPNsense Firewall` : `${action} ntopng Analyser`;
      case 'home':
        return `${action} Home Assistant`;
      default:
        return `${action} Service`;
    }
  };

  return (
    <div className="ms-submodal-overlay">
      <div className="ms-submodal-dialog animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="ms-submodal-header">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{getTitle()}</span>
          </div>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="ms-submodal-body">
          {/* Section-specific Type Pickers */}
          {section === 'media' && (
            <TypePicker
              label="Service Type"
              value={form.type || 'jellyfin'}
              options={[
                { value: 'jellyfin', label: 'Jellyfin', color: '#a855f7' },
                { value: 'emby', label: 'Emby', color: '#22c55e' },
              ]}
              onChange={(v) => setField('type', v)}
            />
          )}

          {section === 'usenet' && (
            <TypePicker
              label="Downloader Type"
              value={form.type || 'sabnzbd'}
              options={[
                { value: 'sabnzbd', label: 'SABnzbd', color: '#eab308' },
                { value: 'nzbget', label: 'NZBGet', color: '#3b82f6' },
              ]}
              onChange={(v) => setField('type', v)}
            />
          )}

          {section === 'arr' && (
            <TypePicker
              label="Application Type"
              value={form.type || 'sonarr'}
              options={[
                { value: 'sonarr', label: 'Sonarr (TV Shows)', color: '#38bdf8' },
                { value: 'radarr', label: 'Radarr (Movies)', color: '#fb923c' },
              ]}
              onChange={(v) => setField('type', v)}
            />
          )}

          {section === 'seerr' && (
            <TypePicker
              label="Seerr Variant"
              value={form.type || 'overseerr'}
              options={[
                { value: 'overseerr', label: 'Overseerr', color: '#f97316' },
                { value: 'jellyseerr', label: 'Jellyseerr', color: '#a855f7' },
                { value: 'seerr', label: 'Seerr', color: '#3b82f6' },
              ]}
              onChange={(v) => setField('type', v)}
            />
          )}

          {/* Standard Fields */}
          <FormField label="Friendly Name / Label">
            <input
              type="text"
              className="ms-input"
              placeholder="e.g. main-instance"
              value={form.name ?? ''}
              onChange={(e) => setField('name', e.target.value)}
            />
          </FormField>

          <FormField label="Endpoint URL">
            <input
              type="text"
              className="ms-input font-mono text-xs"
              placeholder="http://192.168.1.50:8096"
              value={form.url ?? ''}
              onChange={(e) => setField('url', e.target.value)}
            />
          </FormField>

          {/* Media / Arr / Seerr API Key */}
          {(section === 'media' || section === 'arr' || section === 'seerr' || (section === 'usenet' && form.type === 'sabnzbd')) && (
            <FormField
              label={section === 'usenet' ? 'API Key (or use Basic Auth below)' : 'API Key'}
              helpText={
                section === 'arr'
                  ? 'Found under Settings → General → Security → API Key'
                  : section === 'media'
                  ? 'Found in Jellyfin/Emby Dashboard → Advanced → API Keys'
                  : undefined
              }
            >
              <div className="ms-input-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="ms-input font-mono text-xs"
                  placeholder="Paste API Key here…"
                  value={form.apiKey ?? ''}
                  onChange={(e) => setField('apiKey', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="ms-input-action-btn"
                  title={showPassword ? 'Hide value' : 'Show value'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </FormField>
          )}

          {/* Usenet / ntopng Basic Auth */}
          {(section === 'usenet' || (section === 'network' && form._type === 'ntopng')) && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <FormField label="Username (Optional)">
                <input
                  type="text"
                  className="ms-input"
                  placeholder="admin"
                  value={form.username ?? ''}
                  onChange={(e) => setField('username', e.target.value)}
                />
              </FormField>

              <FormField label="Password / Token">
                <div className="ms-input-password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="ms-input"
                    placeholder="••••••••"
                    value={form.password ?? ''}
                    onChange={(e) => setField('password', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="ms-input-action-btn"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FormField>
            </div>
          )}

          {/* OPNsense API Key & Secret */}
          {section === 'network' && form._type === 'opnsense' && (
            <>
              <FormField label="API Key">
                <input
                  type="text"
                  className="ms-input font-mono text-xs"
                  placeholder="OPNsense API Key"
                  value={form.apiKey ?? ''}
                  onChange={(e) => setField('apiKey', e.target.value)}
                />
              </FormField>

              <FormField label="API Secret">
                <div className="ms-input-password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="ms-input font-mono text-xs"
                    placeholder="OPNsense API Secret"
                    value={form.apiSecret ?? ''}
                    onChange={(e) => setField('apiSecret', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="ms-input-action-btn"
                    title={showPassword ? 'Hide secret' : 'Show secret'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FormField>
            </>
          )}

          {/* ntopng Interface ID */}
          {section === 'network' && form._type === 'ntopng' && (
            <FormField label="Interface ID (Optional, 0 = default)">
              <input
                type="number"
                className="ms-input font-mono text-xs"
                placeholder="0"
                value={form.ifid ?? ''}
                onChange={(e) => setField('ifid', e.target.value ? Number(e.target.value) : undefined)}
              />
            </FormField>
          )}

          {/* Home Assistant Long-Lived Access Token */}
          {section === 'home' && (
            <FormField
              label="Long-Lived Access Token"
              helpText="Generate under Home Assistant → Profile → Security → Long-Lived Access Tokens"
            >
              <div className="ms-input-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="ms-input font-mono text-xs"
                  placeholder="Bearer token…"
                  value={form.token ?? ''}
                  onChange={(e) => setField('token', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="ms-input-action-btn"
                  title={showPassword ? 'Hide token' : 'Show token'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </FormField>
          )}

          {/* TLS Insecure Checkbox */}
          {(section === 'network' || section === 'home') && (
            <label className="flex items-center gap-2.5 p-3 rounded-lg bg-[#181820] border border-[#282834] cursor-pointer text-xs text-neutral-300">
              <input
                type="checkbox"
                checked={form.insecureTls === true}
                onChange={(e) => setField('insecureTls', e.target.checked)}
                className="w-4 h-4 rounded bg-[#141418] border-neutral-700 text-indigo-600 focus:ring-0"
              />
              <div>
                <span className="font-semibold text-neutral-200">Allow Self-Signed TLS Certificates</span>
                <p className="text-[11px] text-neutral-500">
                  Bypasses TLS verification if using a local HTTPS certificate.
                </p>
              </div>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="ms-submodal-footer">
          <button type="button" onClick={onClose} className="ms-btn ms-btn-ghost text-xs">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(form, isNew)}
            disabled={!form.name?.trim() || !form.url?.trim()}
            className="ms-btn ms-btn-primary text-xs"
          >
            <Check className="w-3.5 h-3.5" />
            {isNew ? 'Add Source' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  helpText,
  children,
}: {
  label: string;
  helpText?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block">
        {label}
      </label>
      {children}
      {helpText && <p className="text-[11px] text-neutral-500 leading-normal">{helpText}</p>}
    </div>
  );
}

function TypePicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; color: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block">
        {label}
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`p-2.5 rounded-lg border text-xs font-semibold transition-all text-center ${
                isSelected
                  ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-sm'
                  : 'bg-[#181820] border-[#282834] text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: opt.color }}
                />
                {opt.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Alerts Management Section
   ────────────────────────────────────────────────────────────── */

function AlertsSection({
  rules,
  servers,
  onChange,
  onRemove,
}: {
  rules: AlertRule[];
  servers: RemoteServer[];
  onChange: (rules: AlertRule[]) => void;
  onRemove: (id: string) => void;
}) {
  const [filter, setFilter] = useState<'all' | Severity>('all');
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [isNew, setIsNew] = useState(false);

  const filteredRules = useMemo(() => {
    if (filter === 'all') return rules;
    return rules.filter((r) => r.severity === filter);
  }, [rules, filter]);

  const handleToggle = (id: string) => {
    onChange(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const handleSaveRule = (rule: AlertRule) => {
    if (isNew) {
      onChange([...rules, { ...rule, id: newId() }]);
    } else {
      onChange(rules.map((r) => (r.id === rule.id ? rule : r)));
    }
    setEditingRule(null);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          {(['all', 'critical', 'warning', 'info'] as const).map((sev) => {
            const isSelected = filter === sev;
            const count =
              sev === 'all'
                ? rules.length
                : rules.filter((r) => r.severity === sev).length;

            return (
              <button
                key={sev}
                type="button"
                onClick={() => setFilter(sev)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-[#181820] border-[#282834] text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <span className="capitalize">{sev}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-indigo-800 text-indigo-200' : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            setIsNew(true);
            setEditingRule(emptyRule());
          }}
          className="ms-btn ms-btn-primary text-xs py-1.5 px-3"
        >
          <Plus className="w-3.5 h-3.5" /> Create Alert Rule
        </button>
      </div>

      {/* Rules list */}
      {filteredRules.length === 0 ? (
        <div className="p-8 text-center bg-[#16161c] border border-[#282834] rounded-xl text-neutral-400 text-xs">
          No alert rules matching this filter.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRules.map((rule) => {
            const sev = SEVERITIES.find((s) => s.value === rule.severity) ?? SEVERITIES[1];
            const metricLabel =
              METRICS[rule.source]?.find((m) => m.value === rule.metric)?.label ?? rule.metric;

            return (
              <div
                key={rule.id}
                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                  rule.enabled
                    ? 'bg-[#16161b] border-[#282834] hover:border-[#383848]'
                    : 'bg-[#131316] border-[#202028] opacity-60'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="p-2 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: sev.bg, color: sev.color }}
                  >
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold truncate ${
                          rule.enabled ? 'text-white' : 'text-neutral-500 line-through'
                        }`}
                      >
                        {rule.name}
                      </span>
                      <span
                        className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider flex-shrink-0"
                        style={{ backgroundColor: sev.bg, color: sev.color }}
                      >
                        {sev.label}
                      </span>
                      {rule.notify && (
                        <span className="text-[10px] text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Bell className="w-2.5 h-2.5" /> Push
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1 truncate">
                      <strong className="text-neutral-300">{SOURCE_LABELS[rule.source]}</strong> ·{' '}
                      {metricLabel}{' '}
                      <span className="font-mono text-indigo-400 font-bold">
                        {rule.operator} {rule.threshold}
                      </span>
                      {rule.forSeconds > 0 ? ` (sustained for ${rule.forSeconds}s)` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <SwitchToggle
                    checked={rule.enabled}
                    onChange={() => handleToggle(rule.id)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsNew(false);
                      setEditingRule({ ...rule });
                    }}
                    className="ms-icon-btn ms-icon-btn-primary"
                    title="Edit Rule"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(rule.id)}
                    className="ms-icon-btn ms-icon-btn-danger"
                    title="Delete Rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Create Rule Modal */}
      {editingRule && (
        <AlertRuleEditModal
          rule={editingRule}
          isNew={isNew}
          servers={servers}
          onSave={handleSaveRule}
          onClose={() => setEditingRule(null)}
        />
      )}
    </div>
  );
}

function AlertRuleEditModal({
  rule,
  isNew,
  servers,
  onSave,
  onClose,
}: {
  rule: AlertRule;
  isNew: boolean;
  servers: RemoteServer[];
  onSave: (rule: AlertRule) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<AlertRule>({ ...rule });

  const set = (patch: Partial<AlertRule>) => setForm((prev) => ({ ...prev, ...patch }));
  const setSource = (source: AlertRule['source']) => {
    setForm((prev) => ({
      ...prev,
      source,
      metric: METRICS[source]?.[0]?.value ?? '',
      host: undefined,
    }));
  };

  const metrics = METRICS[form.source] ?? METRICS.glances;
  const showHost = form.source === 'glances' || form.source === 'reachability';

  return (
    <div className="ms-submodal-overlay">
      <div className="ms-submodal-dialog max-w-lg animate-in zoom-in-95 duration-150">
        <div className="ms-submodal-header">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-bold text-white">
              {isNew ? 'Create Alert Rule' : 'Edit Alert Rule'}
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="ms-submodal-body">
          <FormField label="Rule Name">
            <input
              type="text"
              className="ms-input"
              placeholder="e.g. High CPU Usage"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Telemetry Source">
              <select
                className="ms-select"
                value={form.source}
                onChange={(e) => setSource(e.target.value as AlertRule['source'])}
              >
                {(Object.keys(METRICS) as AlertRule['source'][]).map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Target Metric">
              <select
                className="ms-select"
                value={form.metric}
                onChange={(e) => set({ metric: e.target.value })}
              >
                {metrics.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {showHost && (
            <FormField label="Target Host">
              <select
                className="ms-select"
                value={form.host || ''}
                onChange={(e) => set({ host: e.target.value || undefined })}
              >
                <option value="">All Monitored Hosts</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Condition Operator">
              <select
                className="ms-select font-mono"
                value={form.operator}
                onChange={(e) => set({ operator: e.target.value as AlertRule['operator'] })}
              >
                {OPERATORS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Threshold Value">
              <input
                type="number"
                step="any"
                className="ms-input font-mono"
                value={form.threshold}
                onChange={(e) => set({ threshold: Number(e.target.value) })}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Severity Level">
              <select
                className="ms-select"
                value={form.severity}
                onChange={(e) => set({ severity: e.target.value as Severity })}
              >
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Sustain Duration (Seconds)">
              <input
                type="number"
                min={0}
                className="ms-input"
                value={form.forSeconds}
                onChange={(e) => set({ forSeconds: Number(e.target.value) })}
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-lg bg-[#181820] border border-[#282834] cursor-pointer text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={form.notify}
              onChange={(e) => set({ notify: e.target.checked })}
              className="w-4 h-4 rounded bg-[#141418] border-neutral-700 text-indigo-600 focus:ring-0"
            />
            <div>
              <span className="font-semibold text-neutral-200">Push Browser / Webhook Notifications</span>
              <p className="text-[11px] text-neutral-500">
                Dispatches a notification when this alert rule starts firing.
              </p>
            </div>
          </label>
        </div>

        <div className="ms-submodal-footer">
          <button type="button" onClick={onClose} className="ms-btn ms-btn-ghost text-xs">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            className="ms-btn ms-btn-primary text-xs"
          >
            <Check className="w-3.5 h-3.5" />
            {isNew ? 'Create Rule' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────── */

function emptyRule(): AlertRule {
  return {
    id: newId(),
    name: 'High CPU Alert',
    enabled: true,
    source: 'glances',
    metric: 'cpu.percent',
    operator: '>=',
    threshold: 90,
    severity: 'warning',
    forSeconds: 60,
    notify: true,
  };
}

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
    ui: { tabRotationSeconds: 15 },
    alerts: [],
  };
}
