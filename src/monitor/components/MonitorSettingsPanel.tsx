import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { configApi } from '../../api/configApi';
import { AlertRulesEditor } from '../../components/AlertRulesEditor';
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
} from '../../types';

interface MonitorSettingsPanelProps {
  onClose: () => void;
}

type SectionKey =
  | 'general' | 'hosts' | 'solar' | 'docker' | 'media' | 'usenet'
  | 'arr' | 'seerr' | 'network' | 'home' | 'alerts';

const DEFAULT_ALERTS: MonitoringConfig['alerts'] = [];

/**
 * Monitor settings panel — a full-screen kiosk-styled editor for the
 * background monitor poller. Reads/writes config.monitoring directly through
 * the admin config API (the page's own poller feeds the same data, so a save
 * shows up within one poll cycle). Left rail navigates the sections, each
 * showing a live status badge (on/off, configured counts).
 */
export function MonitorSettingsPanel({ onClose }: MonitorSettingsPanelProps) {
  const [draft, setDraft] = useState<DashboardConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<SectionKey>('general');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    configApi
      .getConfig()
      .then(({ config }) => {
        if (cancelled) return;
        setDraft(config);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load configuration');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const mon: MonitoringConfig | null = draft?.monitoring ?? null;
  const servers: RemoteServer[] = draft?.servers ?? [];

  const updateMonitoring = (patch: Partial<MonitoringConfig>) => {
    if (!draft) return;
    setDraft({ ...draft, monitoring: { ...(draft.monitoring ?? defaultMonitoring()), ...patch } });
  };

  const setList = <K extends 'media' | 'usenet' | 'arr' | 'seerr' | 'opnsense' | 'ntopng' | 'homeassistant'>(
    key: K, list: MonitoringConfig[K],
  ) => updateMonitoring({ [key]: list } as Partial<MonitoringConfig>);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await configApi.saveConfig(draft);
      setSaved(true);
      setTimeout(onClose, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save configuration');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="ms-overlay">
        <div className="ms-shell">
          <div className="ms-loading">
            <span className="ms-logo">▣</span> Loading monitor settings…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ms-overlay">
      <div className="ms-shell">
        {/* Header */}
        <header className="ms-header">
          <div className="ms-logo">▣</div>
          <div className="ms-title-block">
            <div className="ms-title">Monitor Settings</div>
            <div className="ms-subtitle">
              {mon?.enabled
                ? 'Poller on · feeds the tabs on this page'
                : 'Poller off — monitoring is not being collected'}
            </div>
          </div>
          <div className="ms-spacer" />
          {saved && (
            <span className="ms-btn ms-btn-success" style={{ pointerEvents: 'none' }}>
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          <button className="ms-btn ms-btn-primary" onClick={handleSave} disabled={!draft || saving || saved}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button className="ms-btn ms-btn-ghost" onClick={onClose} disabled={saving}>
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        </header>

        {error && !draft && (
          <div className="ms-content">
            <div className="ms-content-inner">
              <div className="ms-error">{error}</div>
            </div>
          </div>
        )}

        {error && draft && (
          <div className="ms-content">
            <div className="ms-content-inner">
              <div className="ms-error">{error}</div>
            </div>
          </div>
        )}

        {!draft && !error && null}

        {draft && !mon && (
          <div className="ms-content">
            <div className="ms-content-inner">
              <div className="ms-hint">
                The monitoring section isn't available in this session. Sign in with the admin
                account to manage data sources, then reopen this panel.
              </div>
            </div>
          </div>
        )}

        {draft && mon && (
          <div className="ms-body">
            {/* Left rail */}
            <nav className="ms-nav">
              <div className="ms-nav-label">Monitor</div>
              <NavItem active={active === 'general'} onClick={() => setActive('general')} icon={Activity} label="General"
                dot={mon.enabled ? '#2ecc71' : '#4a4a50'} />
              <NavItem active={active === 'hosts'} onClick={() => setActive('hosts')} icon={Server} label="Hosts"
                badge={mon.glancesHosts?.length ?? 0} />
              <NavItem active={active === 'solar'} onClick={() => setActive('solar')} icon={Sun} label="Solar"
                dot={mon.solar?.enabled ? '#2ecc71' : '#4a4a50'} />
              <NavItem active={active === 'docker'} onClick={() => setActive('docker')} icon={HardDrive} label="Docker"
                dot={mon.docker?.enabled === false ? '#4a4a50' : '#2ecc71'} />

              <div className="ms-nav-label">Sources</div>
              <NavItem active={active === 'media'} onClick={() => setActive('media')} icon={Tv} label="Media"
                badge={mon.media?.length ?? 0} />
              <NavItem active={active === 'usenet'} onClick={() => setActive('usenet')} icon={Download} label="Usenet"
                badge={mon.usenet?.length ?? 0} />
              <NavItem active={active === 'arr'} onClick={() => setActive('arr')} icon={Film} label="Sonarr / Radarr"
                badge={mon.arr?.length ?? 0} />
              <NavItem active={active === 'seerr'} onClick={() => setActive('seerr')} icon={Clapperboard} label="Seerr"
                badge={mon.seerr?.length ?? 0} />
              <NavItem active={active === 'network'} onClick={() => setActive('network')} icon={Shield} label="Network"
                badge={(mon.opnsense?.length ?? 0) + (mon.ntopng?.length ?? 0)} />
              <NavItem active={active === 'home'} onClick={() => setActive('home')} icon={House} label="Home Assistant"
                badge={mon.homeassistant?.length ?? 0} />

              <div className="ms-nav-label">Watch</div>
              <NavItem active={active === 'alerts'} onClick={() => setActive('alerts')} icon={Bell} label="Alerts"
                badge={(mon.alerts ?? []).filter((a) => a.enabled).length} />
            </nav>

            {/* Content */}
            <div className="ms-content">
              <div className="ms-content-inner">
                {error && <div className="ms-error" style={{ marginBottom: 12 }}>{error}</div>}

                {active === 'general' && (
                  <Section title="General" desc="Master switch and polling behaviour for the background monitor.">
                    <div className="ms-card">
                      <SwitchRow label="Enable monitoring" detail="Collects data for every tab below and feeds alerts."
                        checked={mon.enabled} onChange={(v) => updateMonitoring({ enabled: v })} />
                      <SliderRow label="Poll interval" value={mon.pollIntervalSeconds} min={5} max={60} step={5} unit="s"
                        onChange={(v) => updateMonitoring({ pollIntervalSeconds: v })} />
                      <SliderRow label="Tab rotation" value={mon.ui?.tabRotationSeconds ?? 15} min={0} max={60} step={5} unit="s"
                        note="0 = manual tabs only" onChange={(v) => updateMonitoring({ ui: { ...(mon.ui ?? {}), tabRotationSeconds: v } })} />
                    </div>
                  </Section>
                )}

                {active === 'hosts' && (
                  <Section title="Hosts" desc="Pick the servers (Glances instances) that feed the Server tab: CPU, memory, disk, load, temperature, network and containers.">
                    <div className="ms-card">
                      {servers.length === 0 ? (
                        <p className="ms-row-detail">
                          No servers configured yet. Add Glances instances under the main dashboard's
                          Server Stats first.
                        </p>
                      ) : (
                        servers.map((srv) => (
                          <CheckRow key={srv.id} label={srv.name} detail={srv.url}
                            checked={(mon.glancesHosts ?? []).some((h) => h.id === srv.id)}
                            onChange={() => toggleGlancesHost(srv, mon, updateMonitoring)} />
                        ))
                      )}
                    </div>
                  </Section>
                )}

                {active === 'solar' && (
                  <Section title="Solar" desc="Battery SOC, PV generation, grid import/export, load and the runtime estimate — from the Solar Assistant device configured in Inverter Monitor.">
                    <div className="ms-card">
                      {(draft.inverters ?? []).length === 0 ? (
                        <p className="ms-row-detail">
                          No inverter configured yet. Add a Solar Assistant device under the main
                          dashboard's Inverter Monitor first.
                        </p>
                      ) : (
                        <SwitchRow label="Include solar data" detail="Polls the Solar Assistant API configured in Inverter Monitor."
                          checked={mon.solar?.enabled ?? false} onChange={(v) => updateMonitoring({ solar: { enabled: v } })} />
                      )}
                    </div>
                  </Section>
                )}

                {active === 'docker' && (
                  <Section title="Docker" desc="Container health summary and problem list, aggregated from the selected Glances hosts.">
                    <div className="ms-card">
                      <SwitchRow label="Enable Docker monitoring" detail="Counts running / healthy / unhealthy / restarting containers."
                        checked={mon.docker?.enabled ?? true} onChange={(v) => updateMonitoring({ docker: { enabled: v } })} />
                    </div>
                  </Section>
                )}

                {active === 'media' && (
                  <Section title="Media" desc="Active streams — user, title, device, progress and direct-play vs transcode.">
                    <MsEntityList
                      items={mon.media ?? []} typeOptions={[{ value: 'jellyfin', label: 'Jellyfin' }, { value: 'emby', label: 'Emby' }]}
                      fields={[
                        { key: 'name', label: 'Label', placeholder: 'jellyfin-main' },
                        { key: 'url', label: 'URL', placeholder: 'http://192.168.1.20:8096' },
                        { key: 'apiKey', label: 'API key', placeholder: '', pw: true },
                      ]}
                      onSave={(item, editingId) => {
                        const list = mon.media ?? [];
                        if (editingId) setList('media', list.map((i) => (i.id === editingId ? { ...i, ...item } : i)));
                        else setList('media', [...list, { id: newId(), name: item.name?.trim() || '', type: item.type || 'jellyfin', url: item.url?.trim() || '', apiKey: item.apiKey?.trim() || '' } as MonitoredMedia]);
                      }}
                      onRemove={(id) => setList('media', (mon.media ?? []).filter((m) => m.id !== id))}
                    />
                  </Section>
                )}

                {active === 'usenet' && (
                  <Section title="Usenet" desc="Queue speed, ETA, per-item progress and paused state.">
                    <MsEntityList
                      items={mon.usenet ?? []} typeOptions={[{ value: 'sabnzbd', label: 'SABnzbd' }, { value: 'nzbget', label: 'NZBGet' }]}
                      fields={[
                        { key: 'name', label: 'Label', placeholder: 'sab-main' },
                        { key: 'url', label: 'URL', placeholder: 'http://192.168.1.21:8080' },
                      ]}
                      extraFields={(f, set) => {
                        const t = f.type || 'sabnzbd';
                        if (t === 'sabnzbd') return (
                          <>
                            <FieldInput field={{ key: 'apiKey', label: 'API key (or user/pass)', placeholder: 'optional', pw: true }} value={f.apiKey ?? ''} onChange={(v) => set({ ...f, apiKey: v })} />
                            <FieldInput field={{ key: 'username', label: 'Username (HTTP Basic)', placeholder: 'optional' }} value={f.username ?? ''} onChange={(v) => set({ ...f, username: v })} />
                            <FieldInput field={{ key: 'password', label: 'Password', placeholder: 'optional', pw: true }} value={f.password ?? ''} onChange={(v) => set({ ...f, password: v })} />
                          </>
                        );
                        return (
                          <>
                            <FieldInput field={{ key: 'username', label: 'Username', placeholder: '' }} value={f.username ?? ''} onChange={(v) => set({ ...f, username: v })} />
                            <FieldInput field={{ key: 'password', label: 'Password', placeholder: '', pw: true }} value={f.password ?? ''} onChange={(v) => set({ ...f, password: v })} />
                          </>
                        );
                      }}
                      onSave={(item, editingId) => {
                        const list = mon.usenet ?? [];
                        if (editingId) setList('usenet', list.map((i) => (i.id === editingId ? { ...i, ...item } : i)));
                        else {
                          const t = item.type || 'sabnzbd';
                          const entry: MonitoredUsenet = {
                            id: newId(), name: item.name?.trim() || '', type: t, url: item.url?.trim() || '',
                            apiKey: t === 'sabnzbd' ? item.apiKey?.trim() || undefined : undefined,
                            username: item.username?.trim() || undefined, password: item.password || undefined,
                          };
                          setList('usenet', [...list, entry]);
                        }
                      }}
                      onRemove={(id) => setList('usenet', (mon.usenet ?? []).filter((u) => u.id !== id))}
                    />
                  </Section>
                )}

                {active === 'arr' && (
                  <Section title="Sonarr / Radarr" desc="Active download queue and health warnings.">
                    <MsEntityList
                      items={mon.arr ?? []} typeOptions={[{ value: 'sonarr', label: 'Sonarr' }, { value: 'radarr', label: 'Radarr' }]}
                      fields={[
                        { key: 'name', label: 'Label', placeholder: 'sonarr-main' },
                        { key: 'url', label: 'URL', placeholder: 'http://192.168.1.22:8989' },
                        { key: 'apiKey', label: 'API key', placeholder: '', pw: true },
                      ]}
                      onSave={(item, editingId) => {
                        const list = mon.arr ?? [];
                        if (editingId) setList('arr', list.map((i) => (i.id === editingId ? { ...i, ...item } : i)));
                        else setList('arr', [...list, { id: newId(), name: item.name?.trim() || '', type: item.type || 'sonarr', url: item.url?.trim() || '', apiKey: item.apiKey?.trim() || '' } as MonitoredArr]);
                      }}
                      onRemove={(id) => setList('arr', (mon.arr ?? []).filter((a) => a.id !== id))}
                    />
                  </Section>
                )}

                {active === 'seerr' && (
                  <Section title="Seerr / Overseerr" desc="Open media issues and unattended (pending / failed) requests.">
                    <MsEntityList
                      items={mon.seerr ?? []} typeOptions={[{ value: 'overseerr', label: 'Overseerr' }, { value: 'seerr', label: 'Seerr' }, { value: 'jellyseerr', label: 'Jellyseerr' }]}
                      fields={[
                        { key: 'name', label: 'Label', placeholder: 'overseerr-main' },
                        { key: 'url', label: 'URL', placeholder: 'http://192.168.1.30:5055' },
                        { key: 'apiKey', label: 'API key', placeholder: '', pw: true },
                      ]}
                      onSave={(item, editingId) => {
                        const list = mon.seerr ?? [];
                        if (editingId) setList('seerr', list.map((i) => (i.id === editingId ? { ...i, ...item } : i)));
                        else setList('seerr', [...list, { id: newId(), name: item.name?.trim() || '', type: item.type || 'overseerr', url: item.url?.trim() || '', apiKey: item.apiKey?.trim() || '' } as MonitoredSeerr]);
                      }}
                      onRemove={(id) => setList('seerr', (mon.seerr ?? []).filter((s) => s.id !== id))}
                    />
                  </Section>
                )}

                {active === 'network' && (
                  <Section title="Network" desc="Firewall (OPNsense) and traffic analyser (ntopng) feeding the Network tab.">
                    <div className="ms-card">
                      <div className="ms-card-title">OPNsense</div>
                      <MsEntityList
                        items={mon.opnsense ?? []}
                        fields={[
                          { key: 'name', label: 'Label', placeholder: 'opnsense-main' },
                          { key: 'url', label: 'URL', placeholder: 'http://192.168.1.1' },
                          { key: 'apiKey', label: 'API key', placeholder: '' },
                          { key: 'apiSecret', label: 'API secret', placeholder: '', pw: true },
                        ]}
                        extraFields={(f, set) => (
                          <label className="ms-inline-check">
                            <input type="checkbox" className="ms-check" checked={f.insecureTls === true}
                              onChange={(e) => set({ ...f, insecureTls: e.target.checked })} />
                            Trust a self-signed TLS certificate
                          </label>
                        )}
                        onSave={(item, editingId) => {
                          const list = mon.opnsense ?? [];
                          if (editingId) setList('opnsense', list.map((i) => (i.id === editingId ? { ...i, ...item } : i)));
                          else setList('opnsense', [...list, { id: newId(), name: item.name?.trim() || '', url: item.url?.trim() || '', apiKey: item.apiKey?.trim() || '', apiSecret: item.apiSecret?.trim() || '', insecureTls: item.insecureTls === true } as MonitoredOpnsense]);
                        }}
                        onRemove={(id) => setList('opnsense', (mon.opnsense ?? []).filter((o) => o.id !== id))}
                      />
                    </div>
                    <div className="ms-card">
                      <div className="ms-card-title">ntopng</div>
                      <MsEntityList
                        items={mon.ntopng ?? []}
                        fields={[
                          { key: 'name', label: 'Label', placeholder: 'ntopng-main' },
                          { key: 'url', label: 'URL', placeholder: 'http://192.168.1.40:3000' },
                          { key: 'username', label: 'Username', placeholder: 'admin' },
                          { key: 'password', label: 'Password / API token', placeholder: '', pw: true },
                          { key: 'ifid', label: 'Interface ID', placeholder: '0' },
                        ]}
                        extraFields={(f, set) => (
                          <label className="ms-inline-check">
                            <input type="checkbox" className="ms-check" checked={f.insecureTls === true}
                              onChange={(e) => set({ ...f, insecureTls: e.target.checked })} />
                            Trust a self-signed TLS certificate
                          </label>
                        )}
                        onSave={(item, editingId) => {
                          const list = mon.ntopng ?? [];
                          if (editingId) setList('ntopng', list.map((i) => (i.id === editingId ? { ...i, ...item } : i)));
                          else setList('ntopng', [...list, {
                            id: newId(), name: item.name?.trim() || '', url: item.url?.trim() || '',
                            username: item.username?.trim() || undefined, password: item.password || '',
                            ifid: item.ifid != null && item.ifid !== '' ? Number(item.ifid) : undefined,
                            insecureTls: item.insecureTls === true,
                          } as MonitoredNtopng]);
                        }}
                        onRemove={(id) => setList('ntopng', (mon.ntopng ?? []).filter((x) => x.id !== id))}
                      />
                    </div>
                  </Section>
                )}

                {active === 'home' && (
                  <Section title="Home Assistant" desc="Smart-home glanceable metrics and unavailable-device alerts for the Home tab + status card.">
                    <MsEntityList
                      items={mon.homeassistant ?? []}
                      fields={[
                        { key: 'name', label: 'Label', placeholder: 'home-assistant' },
                        { key: 'url', label: 'URL', placeholder: 'http://homeassistant.local:8123' },
                        { key: 'token', label: 'Long-lived access token', placeholder: '', pw: true },
                      ]}
                      extraFields={(f, set) => (
                        <label className="ms-inline-check">
                          <input type="checkbox" className="ms-check" checked={f.insecureTls === true}
                            onChange={(e) => set({ ...f, insecureTls: e.target.checked })} />
                          Trust a self-signed TLS certificate
                        </label>
                      )}
                      onSave={(item, editingId) => {
                        const list = mon.homeassistant ?? [];
                        if (editingId) setList('homeassistant', list.map((i) => (i.id === editingId ? { ...i, ...item } : i)));
                        else setList('homeassistant', [...list, { id: newId(), name: item.name?.trim() || '', url: item.url?.trim() || '', token: item.token || '', insecureTls: item.insecureTls === true } as MonitoredHomeAssistant]);
                      }}
                      onRemove={(id) => setList('homeassistant', (mon.homeassistant ?? []).filter((x) => x.id !== id))}
                    />
                  </Section>
                )}

                {active === 'alerts' && (
                  <Section title="Alerts" desc="Rules evaluated on every poll. Firing alerts show in the banner + sidebar and can push notifications.">
                    <div className="ms-card">
                      <AlertRulesEditor
                        rules={mon.alerts ?? DEFAULT_ALERTS}
                        servers={servers}
                        onChange={(rules) => updateMonitoring({ alerts: rules })}
                        onRemove={(id) => updateMonitoring({
                          alerts: (mon.alerts ?? []).filter((r) => r.id !== id),
                          suppressedAutoAlerts: [...(mon.suppressedAutoAlerts ?? []), id],
                        })}
                      />
                    </div>
                  </Section>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Nav item ── */

function NavItem({ active, onClick, icon: Icon, label, badge, dot }: {
  active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>;
  label: string; badge?: number; dot?: string;
}) {
  return (
    <button className={`ms-nav-item ${active ? 'active' : ''}`} onClick={onClick} type="button">
      <Icon className="ms-nav-icon" />
      {label}
      {badge != null && badge > 0 ? (
        <span className="ms-nav-badge">{badge}</span>
      ) : dot ? (
        <span className="ms-nav-dot" style={{ backgroundColor: dot }} />
      ) : null}
    </button>
  );
}

/* ── Section heading ── */

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <>
      <div className="ms-section-title">{title}</div>
      {desc && <div className="ms-section-desc">{desc}</div>}
      {children}
    </>
  );
}

/* ── Switch / slider / check rows ── */

function SwitchRow({ label, detail, checked, onChange }: {
  label: string; detail?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="ms-row ms-switch-row" style={{ cursor: 'pointer' }}>
      <input type="checkbox" className="ms-check" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div style={{ minWidth: 0 }}>
        <div className="ms-row-label">{label}</div>
        {detail && <div className="ms-row-detail">{detail}</div>}
      </div>
      <span className="ms-row-spacer" />
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: checked ? '#2ecc71' : '#5a5a60' }}>
        {checked ? 'on' : 'off'}
      </span>
    </label>
  );
}

function CheckRow({ label, detail, checked, onChange }: {
  label: string; detail?: string; checked: boolean; onChange: () => void;
}) {
  return (
    <label className="ms-row" style={{ cursor: 'pointer' }}>
      <input type="checkbox" className="ms-check" checked={checked} onChange={onChange} />
      <div style={{ minWidth: 0 }}>
        <div className="ms-row-label">{label}</div>
        {detail && <div className="ms-row-detail" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</div>}
      </div>
    </label>
  );
}

function SliderRow({ label, value, min, max, step, unit, note, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string; note?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="ms-row">
      <div style={{ minWidth: 110 }}>
        <div className="ms-row-label">{label}</div>
        {note && <div className="ms-row-detail">{note}</div>}
      </div>
      <span className="ms-row-spacer" />
      <input type="range" className="ms-slider" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
      <span className="ms-slider-val">{value}</span>
      {unit && <span className="ms-slider-unit">{unit}</span>}
    </div>
  );
}

/* ── Generic editable entity list (kiosk style) ── */

interface FieldDef { key: string; label: string; placeholder: string; pw?: boolean; }

function FieldInput({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="ms-field-label">{field.label}</div>
      <input type={field.pw ? 'password' : 'text'} className="ms-input" value={value}
        placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function MsEntityList({ items, typeOptions = [], fields, extraFields, onSave, onRemove }: {
  items: any[];
  typeOptions?: { value: string; label: string }[];
  fields: FieldDef[];
  extraFields?: (f: any, set: (f: any) => void) => React.ReactNode;
  onSave: (form: any, editingId: string | null) => void;
  onRemove: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  const startEdit = (item: any) => { setEditingId(item.id); setForm({ ...item }); };
  const save = () => {
    onSave(form, editingId);
    setEditingId(null);
    setForm({});
  };

  return (
    <div>
      {items.map((item) =>
        editingId === item.id ? (
          <div key={item.id} className="ms-form">
            {typeOptions.length > 0 && (
              <div>
                <div className="ms-field-label">Type</div>
                <select className="ms-select" value={form.type || item.type || typeOptions[0]?.value || ''}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}
            {fields.map((f) => (
              <FieldInput key={f.key} field={f} value={form[f.key] ?? item[f.key] ?? ''}
                onChange={(v) => setForm({ ...form, [f.key]: v })} />
            ))}
            {extraFields?.(form, setForm)}
            <div className="ms-form-actions">
              <button className="ms-btn ms-btn-primary" onClick={save} type="button">Save</button>
              <button className="ms-btn ms-btn-ghost" onClick={() => { setEditingId(null); setForm({}); }} type="button">Cancel</button>
            </div>
          </div>
        ) : (
          <div key={item.id} className="ms-entity">
            <div style={{ minWidth: 0 }}>
              <span className="ms-entity-name">{item.name}</span>
              {typeOptions.length > 0 && item.type && (
                <span className="ms-entity-type" style={{ marginLeft: 8 }}>{item.type}</span>
              )}
              <div className="ms-entity-meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.url}</div>
            </div>
            <div className="ms-entity-actions">
              <button className="ms-icon-btn ms-icon-btn-primary" onClick={() => startEdit(item)} aria-label="Edit">
                <Edit2 className="w-4 h-4" />
              </button>
              <button className="ms-icon-btn ms-icon-btn-danger" onClick={() => onRemove(item.id)} aria-label="Remove">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ),
      )}

      {editingId === null && (
        <div className="ms-form" style={{ borderStyle: 'dashed' }}>
          {typeOptions.length > 0 && (
            <div>
              <div className="ms-field-label">Type</div>
              <select className="ms-select" value={form.type || typeOptions[0]?.value || ''}
                onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
          {fields.map((f) => (
            <FieldInput key={f.key} field={f} value={form[f.key] ?? ''}
              onChange={(v) => setForm({ ...form, [f.key]: v })} />
          ))}
          {extraFields?.(form, setForm)}
          <button className="ms-btn ms-btn-primary" onClick={save} type="button" style={{ alignSelf: 'flex-start' }}>
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Helpers ── */

function toggleGlancesHost(srv: RemoteServer, mon: MonitoringConfig, update: (p: Partial<MonitoringConfig>) => void) {
  const hosts = mon.glancesHosts ?? [];
  if (hosts.some((h) => h.id === srv.id)) {
    update({ glancesHosts: hosts.filter((h) => h.id !== srv.id) });
  } else {
    update({ glancesHosts: [...hosts, { id: srv.id, name: srv.name, url: srv.url, username: srv.username, password: srv.password }] });
  }
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
