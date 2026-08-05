import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { Plus, Trash2, Edit2, Activity, Server, Sun, HardDrive, Tv, Download, Clock, Shield, Film, Clapperboard, Bell, Radar, House } from 'lucide-react';
import type {
  MonitoredMedia,
  MonitoredUsenet,
  MonitoredArr,
  MonitoredSeerr,
  MonitoredOpnsense,
  MonitoredNtopng,
  MonitoredHomeAssistant,
  MonitoringConfig,
  RemoteServer,
  AlertRule,
} from '../types';
import { AlertRulesEditor } from './AlertRulesEditor';
import { newId } from '../lib/id';

// ---------------------------------------------------------------------------
// MonitoringSettings — read/write config.monitoring from the Settings modal.
// ---------------------------------------------------------------------------

export function MonitoringSettings() {
  const { config, setConfig } = useDashboard();
  const mon: MonitoringConfig = config.monitoring ?? defaultMonitoring;

  const update = (patch: Partial<MonitoringConfig>) =>
    setConfig({ ...config, monitoring: { ...mon, ...patch } });

  // --- Glances hosts ---
  const servers: RemoteServer[] = config.servers ?? [];
  const selectedHostIds = new Set((mon.glancesHosts ?? []).map((h) => h.id));

  function toggleGlancesHost(srv: RemoteServer) {
    const hosts = mon.glancesHosts ?? [];
    if (selectedHostIds.has(srv.id)) {
      update({ glancesHosts: hosts.filter((h) => h.id !== srv.id) });
    } else {
      update({
        glancesHosts: [
          ...hosts,
          { id: srv.id, name: srv.name, url: srv.url, username: srv.username, password: srv.password },
        ],
      });
    }
  }

  const solarConfigured = (config.inverters ?? []).length > 0;

  // --- Editable list state hooks ---
  const [editMediaId, setEditMediaId] = useState<string | null>(null);
  const [mediaForm, setMediaForm] = useState<Partial<MonitoredMedia>>({});
  const [editUsenetId, setEditUsenetId] = useState<string | null>(null);
  const [usenetForm, setUsenetForm] = useState<Partial<MonitoredUsenet>>({});
  const [editArrId, setEditArrId] = useState<string | null>(null);
  const [arrForm, setArrForm] = useState<Partial<MonitoredArr>>({});
  const [editSeerrId, setEditSeerrId] = useState<string | null>(null);
  const [seerrForm, setSeerrForm] = useState<Partial<MonitoredSeerr>>({});
  const [editOpnId, setEditOpnId] = useState<string | null>(null);
  const [opnForm, setOpnForm] = useState<Partial<MonitoredOpnsense>>({});
  const [editNtopId, setEditNtopId] = useState<string | null>(null);
  const [ntopForm, setNtopForm] = useState<Partial<MonitoredNtopng>>({});
  const [editHaId, setEditHaId] = useState<string | null>(null);
  const [haForm, setHaForm] = useState<Partial<MonitoredHomeAssistant>>({});

  // --- CRUD helpers ---
  function startEdit(item: any, setEditId: (v: string | null) => void, setForm: (v: any) => void) {
    setEditId(item.id);
    setForm({ ...item });
  }
  function cancelEdit(setEditId: (v: string | null) => void, setForm: (v: any) => void) {
    setEditId(null);
    setForm({});
  }
  function saveEdit(
    editingId: string | null,
    form: any,
    list: any[],
    _key: string,
    saveFn: (l: any[]) => void,
    setEditId: (v: string | null) => void,
    setForm: (v: any) => void,
    factory: (f: any) => any,
  ) {
    if (editingId) {
      saveFn(list.map((i) => (i.id === editingId ? { ...i, ...form } : i)));
    } else {
      const entry = factory(form);
      saveFn([...list, entry]);
    }
    setEditId(null);
    setForm({});
  }

  const mediaList = mon.media ?? [];
  const usenetList = mon.usenet ?? [];
  const arrList = mon.arr ?? [];
  const seerrList = mon.seerr ?? [];
  const opnList = mon.opnsense ?? [];
  const ntopList = mon.ntopng ?? [];
  const haList = mon.homeassistant ?? [];

  return (
    <div className="space-y-6">
      <SectionCard title="Home Lab Monitor" description="Background poller that feeds the /monitor full-screen page." icon={Activity} defaultOpen>
        <ToggleRow label="Enable monitoring" description="Turn on the background poller. Data is only visible to authenticated users."
          checked={mon.enabled} onChange={(v) => update({ enabled: v })} />
      </SectionCard>

      {!mon.enabled && (
        <p className="text-xs text-[var(--color-text-secondary)] italic">Enable monitoring above to configure data sources.</p>
      )}

      {mon.enabled && (
        <>
          <SectionCard title="Intervals" icon={Clock} defaultOpen>
            <SliderRow label="Poll interval" value={mon.pollIntervalSeconds} min={5} max={60} step={5} unit="s"
              onChange={(v) => update({ pollIntervalSeconds: v })} />
            <SliderRow label="Tab rotation" value={mon.ui?.tabRotationSeconds ?? 15} min={0} max={60} step={5} unit="s"
              note="0 = manual tabs only" onChange={(v) => update({ ui: { tabRotationSeconds: v } })} />
          </SectionCard>

          {/* Glances hosts */}
          <SectionCard title="Glances Hosts" description="Select servers to aggregate CPU, memory, disk, load, network, and container stats." icon={Server}>
            {servers.length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)]">No servers configured yet. Add them in <strong className="text-[var(--color-text-primary)]">Server Stats → Manage Servers</strong> first.</p>
            ) : (
              <div className="space-y-2">
                {servers.map((srv) => (
                  <CheckRow key={srv.id} label={srv.name} detail={srv.url} checked={selectedHostIds.has(srv.id)} onChange={() => toggleGlancesHost(srv)} />
                ))}
              </div>
            )}
          </SectionCard>

          {/* Solar */}
          <SectionCard title="Solar" description="Battery SOC, PV generation, grid import/export, runtime estimate." icon={Sun}>
            {!solarConfigured ? (
              <p className="text-xs text-[var(--color-text-secondary)]">No inverter configured yet. Add one in <strong className="text-[var(--color-text-primary)]">Inverter Monitor → Manage Inverters</strong>.</p>
            ) : (
              <ToggleRow label="Include solar data" description="Polls the Solar Assistant API configured in Inverter Monitor."
                checked={mon.solar?.enabled ?? false} onChange={(v) => update({ solar: { enabled: v } })} />
            )}
          </SectionCard>

          {/* Docker */}
          <SectionCard title="Docker" description="Container count, health summary, problem list (derived from Glances)." icon={HardDrive}>
            <ToggleRow label="Enable Docker monitoring" description="Aggregates container health from all selected Glances hosts."
              checked={mon.docker?.enabled ?? true} onChange={(v) => update({ docker: { enabled: v } })} />
          </SectionCard>

          {/* Media Servers */}
          <SectionCard title="Media Servers" description="Active streams: user, title, device, progress, direct-play vs transcode." icon={Tv}>
            <EntityList
              items={mediaList} editingId={editMediaId} form={mediaForm} setForm={setMediaForm}
              onStartEdit={(item) => startEdit(item, setEditMediaId, setMediaForm)}
              onCancel={() => cancelEdit(setEditMediaId, setMediaForm)}
              onSave={() => saveEdit(editMediaId, mediaForm, mediaList, 'media',
                (l) => update({ media: l as MonitoredMedia[] }), setEditMediaId, setMediaForm,
                (f) => ({ id: newId(), name: f.name?.trim() || '', type: f.type || 'jellyfin', url: f.url?.trim() || '', apiKey: f.apiKey?.trim() || '' }))}
              onRemove={(id) => update({ media: mediaList.filter((m) => m.id !== id) })}
              typeField="type" typeOptions={[{ value: 'jellyfin', label: 'Jellyfin' }, { value: 'emby', label: 'Emby' }]}
              fields={[
                { key: 'name', label: 'Label', placeholder: 'jellyfin-main', helper: 'Display name shown on the dashboard.' },
                { key: 'url', label: 'URL', placeholder: 'http://192.168.1.20:8096', helper: 'Base URL of the Emby / Jellyfin server.' },
                { key: 'apiKey', label: 'API key', placeholder: '', pw: true, helper: 'API key from Dashboard → Advanced in Jellyfin, or a user token in Emby.' },
              ]}
            />
          </SectionCard>

          {/* Usenet */}
          <SectionCard title="Usenet Downloaders" description="Queue speed, ETA, per-item progress, paused state." icon={Download}>
            <EntityList
              items={usenetList} editingId={editUsenetId} form={usenetForm} setForm={setUsenetForm}
              onStartEdit={(item) => startEdit(item, setEditUsenetId, setUsenetForm)}
              onCancel={() => cancelEdit(setEditUsenetId, setUsenetForm)}
              onSave={() => saveEdit(editUsenetId, usenetForm, usenetList, 'usenet',
                (l) => update({ usenet: l as MonitoredUsenet[] }), setEditUsenetId, setUsenetForm,
                (f) => {
                  const t = f.type || 'sabnzbd';
                  return { id: newId(), name: f.name?.trim() || '', type: t, url: f.url?.trim() || '',
                    apiKey: t === 'sabnzbd' ? f.apiKey?.trim() || undefined : undefined,
                    username: f.username?.trim() || undefined, password: f.password?.trim() || undefined };
                })}
              onRemove={(id) => update({ usenet: usenetList.filter((u) => u.id !== id) })}
              typeField="type" typeOptions={[{ value: 'sabnzbd', label: 'SABnzbd' }, { value: 'nzbget', label: 'NZBGet' }]}
              fields={[
                { key: 'name', label: 'Label', placeholder: 'sab-main', helper: 'Display name shown on the dashboard.' },
                { key: 'url', label: 'URL', placeholder: 'http://192.168.1.21:8080', helper: 'Base URL of the SABnzbd / NZBGet instance.' },
              ]}
              extraFields={(f, set) => {
                const t = (f.type || (editUsenetId ? usenetList.find(u => u.id === editUsenetId)?.type : 'sabnzbd')) || 'sabnzbd';
                if (t === 'sabnzbd') return (
                  <>
                    <input type="password" value={f.apiKey || ''} onChange={e => set({ ...f, apiKey: e.target.value })} placeholder="API key (or use user/pass below)"
                      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50" />
                    <input type="text" value={f.username || ''} onChange={e => set({ ...f, username: e.target.value })} placeholder="Username (HTTP Basic)"
                      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50" />
                    <input type="password" value={f.password || ''} onChange={e => set({ ...f, password: e.target.value })} placeholder="Password"
                      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50" />
                  </>);
                return (
                  <>
                    <input type="text" value={f.username || ''} onChange={e => set({ ...f, username: e.target.value })} placeholder="Username"
                      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50" />
                    <input type="password" value={f.password || ''} onChange={e => set({ ...f, password: e.target.value })} placeholder="Password"
                      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50" />
                  </>);
              }}
            />
          </SectionCard>

          {/* Sonarr / Radarr */}
          <SectionCard title="Sonarr / Radarr" description="Active downloads queue, health warnings." icon={Film}>
            <EntityList
              items={arrList} editingId={editArrId} form={arrForm} setForm={setArrForm}
              onStartEdit={(item) => startEdit(item, setEditArrId, setArrForm)}
              onCancel={() => cancelEdit(setEditArrId, setArrForm)}
              onSave={() => saveEdit(editArrId, arrForm, arrList, 'arr',
                (l) => update({ arr: l as MonitoredArr[] }), setEditArrId, setArrForm,
                (f) => ({ id: newId(), name: f.name?.trim() || '', type: f.type || 'sonarr', url: f.url?.trim() || '', apiKey: f.apiKey?.trim() || '' }))}
              onRemove={(id) => update({ arr: arrList.filter((a) => a.id !== id) })}
              typeField="type" typeOptions={[{ value: 'sonarr', label: 'Sonarr' }, { value: 'radarr', label: 'Radarr' }]}
              fields={[
                { key: 'name', label: 'Label', placeholder: 'sonarr-main', helper: 'Display name shown on the dashboard.' },
                { key: 'url', label: 'URL', placeholder: 'http://192.168.1.22:8989', helper: 'Base URL of the Sonarr / Radarr instance.' },
                { key: 'apiKey', label: 'API key', placeholder: '', pw: true, helper: 'Found in Sonarr/Radarr under Settings → General.' },
              ]}
            />
          </SectionCard>

          {/* Seerr / Overseerr */}
          <SectionCard title="Seerr / Overseerr" description="Open media issues and unattended (pending / failed) requests." icon={Clapperboard}>
            <EntityList
              items={seerrList} editingId={editSeerrId} form={seerrForm} setForm={setSeerrForm}
              onStartEdit={(item) => startEdit(item, setEditSeerrId, setSeerrForm)}
              onCancel={() => cancelEdit(setEditSeerrId, setSeerrForm)}
              onSave={() => saveEdit(editSeerrId, seerrForm, seerrList, 'seerr',
                (l) => update({ seerr: l as MonitoredSeerr[] }), setEditSeerrId, setSeerrForm,
                (f) => ({ id: newId(), name: f.name?.trim() || '', type: f.type || 'overseerr', url: f.url?.trim() || '', apiKey: f.apiKey?.trim() || '' }))}
              onRemove={(id) => update({ seerr: seerrList.filter((s) => s.id !== id) })}
              typeField="type" typeOptions={[{ value: 'overseerr', label: 'Overseerr' }, { value: 'seerr', label: 'Seerr' }, { value: 'jellyseerr', label: 'Jellyseerr' }]}
              fields={[
                { key: 'name', label: 'Label', placeholder: 'overseerr-main', helper: 'Display name shown on the dashboard.' },
                { key: 'url', label: 'URL', placeholder: 'http://192.168.1.30:5055', helper: 'Base URL of the Overseerr / Seerr / Jellyseerr instance.' },
                { key: 'apiKey', label: 'API key', placeholder: '', pw: true, helper: 'Found in the app under Settings → General → API Key.' },
              ]}
            />
          </SectionCard>

          {/* OPNSense */}
          <SectionCard title="OPNSense" description="Firewall: WAN status, bandwidth, CPU/mem, firewall states, DHCP leases." icon={Shield}>
            <EntityList
              items={opnList} editingId={editOpnId} form={opnForm} setForm={setOpnForm}
              onStartEdit={(item) => startEdit(item, setEditOpnId, setOpnForm)}
              onCancel={() => cancelEdit(setEditOpnId, setOpnForm)}
              onSave={() => saveEdit(editOpnId, opnForm, opnList, 'opnsense',
                (l) => update({ opnsense: l as MonitoredOpnsense[] }), setEditOpnId, setOpnForm,
                (f) => ({ id: newId(), name: f.name?.trim() || '', url: f.url?.trim() || '', apiKey: f.apiKey?.trim() || '', apiSecret: f.apiSecret?.trim() || '', insecureTls: f.insecureTls === true }))}
              onRemove={(id) => update({ opnsense: opnList.filter((o) => o.id !== id) })}
              typeField="" typeOptions={[]}
              fields={[
                { key: 'name', label: 'Label', placeholder: 'opnsense-main', helper: 'Display name shown on the dashboard.' },
                { key: 'url', label: 'URL', placeholder: 'http://192.168.1.1', helper: 'Base URL of the OPNsense web UI.' },
                { key: 'apiKey', label: 'API key', placeholder: '', helper: 'OPNsense API key (pair with the secret below).' },
                { key: 'apiSecret', label: 'API secret', placeholder: '', pw: true, helper: 'OPNsense API secret; used as the Basic-auth password.' },
              ]}
              extraFields={(f, set) => (
                <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <input type="checkbox" checked={f.insecureTls === true} onChange={e => set({ ...f, insecureTls: e.target.checked })} />
                  Trust a self-signed TLS certificate
                </label>
              )}
            />
          </SectionCard>

          {/* ntopng */}
          <SectionCard title="ntopng" description="Network traffic analyser: per-host Top Talkers on the Network tab." icon={Radar}>
            <EntityList
              items={ntopList} editingId={editNtopId} form={ntopForm} setForm={setNtopForm}
              onStartEdit={(item) => startEdit(item, setEditNtopId, setNtopForm)}
              onCancel={() => cancelEdit(setEditNtopId, setNtopForm)}
              onSave={() => saveEdit(editNtopId, ntopForm, ntopList, 'ntopng',
                (l) => update({ ntopng: l as MonitoredNtopng[] }), setEditNtopId, setNtopForm,
                (f) => ({
                  id: newId(),
                  name: f.name?.trim() || '', url: f.url?.trim() || '',
                  username: f.username?.trim() || '', password: f.password || '',
                  ifid: f.ifid != null && f.ifid !== '' ? Number(f.ifid) : undefined,
                  insecureTls: f.insecureTls === true,
                }))}
              onRemove={(id) => update({ ntopng: ntopList.filter((x) => x.id !== id) })}
              typeField="" typeOptions={[]}
              fields={[
                { key: 'name', label: 'Label', placeholder: 'ntopng-main', helper: 'Display name shown on the dashboard.' },
                { key: 'url', label: 'URL', placeholder: 'http://192.168.1.40:3000', helper: 'Base URL of the ntopng web UI (default port 3000).' },
                { key: 'username', label: 'Username', placeholder: 'admin', helper: 'ntopng login user (Basic auth).' },
                { key: 'password', label: 'Password / API token', placeholder: '', pw: true, helper: 'ntopng password, or an API token created via Users → API Token.' },
                { key: 'ifid', label: 'Interface ID', placeholder: '0', helper: 'Optional. Which monitored interface to use; defaults to the first one.' },
              ]}
              extraFields={(f, set) => (
                <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <input type="checkbox" checked={f.insecureTls === true} onChange={e => set({ ...f, insecureTls: e.target.checked })} />
                  Trust a self-signed TLS certificate
                </label>
              )}
            />
          </SectionCard>

          {/* Home Assistant */}
          <SectionCard title="Home Assistant" description="Smart home: glanceable metrics and unavailable device alerts on the Home tab + status card." icon={House}>
            <EntityList
              items={haList} editingId={editHaId} form={haForm} setForm={setHaForm}
              onStartEdit={(item) => startEdit(item, setEditHaId, setHaForm)}
              onCancel={() => cancelEdit(setEditHaId, setHaForm)}
              onSave={() => saveEdit(editHaId, haForm, haList, 'homeassistant',
                (l) => update({ homeassistant: l as MonitoredHomeAssistant[] }), setEditHaId, setHaForm,
                (f) => ({ id: newId(), name: f.name?.trim() || '', url: f.url?.trim() || '', token: f.token || '', insecureTls: f.insecureTls === true }))}
              onRemove={(id) => update({ homeassistant: haList.filter((x) => x.id !== id) })}
              typeField="" typeOptions={[]}
              fields={[
                { key: 'name', label: 'Label', placeholder: 'home-assistant', helper: 'Display name shown on the dashboard.' },
                { key: 'url', label: 'URL', placeholder: 'http://homeassistant.local:8123', helper: 'Base URL of the Home Assistant instance.' },
                { key: 'token', label: 'Long-lived access token', placeholder: '', pw: true, helper: 'Profile → Security → Long-lived access tokens → Create Token.' },
              ]}
              extraFields={(f, set) => (
                <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <input type="checkbox" checked={f.insecureTls === true} onChange={e => set({ ...f, insecureTls: e.target.checked })} />
                  Trust a self-signed TLS certificate
                </label>
              )}
            />
          </SectionCard>

          {/* Alert rules */}
          <SectionCard title="Alerts" description="Rules evaluated on every poll; firing alerts show in the banner + sidebar and can push notifications." icon={Bell}>
            <AlertRulesEditor
              rules={mon.alerts ?? []}
              servers={servers}
              onChange={(rules) => update({ alerts: rules })}
              onRemove={(id) => update({
                alerts: (mon.alerts ?? []).filter((r) => r.id !== id),
                suppressedAutoAlerts: [...(mon.suppressedAutoAlerts ?? []), id],
              })}
            />
          </SectionCard>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EntityList — generic Add / Edit / Remove list for any monitored source
// ---------------------------------------------------------------------------

interface FieldDef { key: string; label: string; placeholder: string; pw?: boolean; helper?: string; }
interface TypeOpt { value: string; label: string; }

/** Labelled input with an optional helper hint, used by EntityList forms. */
function FieldInput({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-[var(--color-text-secondary)]">{field.label}</label>
      <input type={field.pw ? 'password' : 'text'} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50" />
      {field.helper && <p className="text-[10px] text-[var(--color-text-secondary)]/70">{field.helper}</p>}
    </div>
  );
}

function EntityList({
  items, editingId, form, setForm, onStartEdit, onCancel, onSave, onRemove,
  typeField, typeOptions, fields, extraFields,
}: {
  items: any[];
  editingId: string | null;
  form: any;
  setForm: (f: any) => void;
  onStartEdit: (item: any) => void;
  onCancel: () => void;
  onSave: () => void;
  onRemove: (id: string) => void;
  typeField: string;
  typeOptions: TypeOpt[];
  fields: FieldDef[];
  extraFields?: (f: any, set: (f: any) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {items.map((item: any) =>
        editingId === item.id ? (
          <div key={item.id} className="flex flex-col gap-2 p-2.5 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)]">
            {typeOptions.length > 0 && (
              <select value={(form as any)[typeField] || item[typeField] || ''} onChange={e => setForm({ ...form, [typeField]: e.target.value } as any)}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)]">
                {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
            {fields.map(f => (
              <FieldInput key={f.key} field={f} value={(form as any)[f.key] ?? item[f.key] ?? ''}
                onChange={(v) => setForm({ ...form, [f.key]: v } as any)} />
            ))}
            {extraFields?.(form, setForm)}
            <div className="flex gap-2">
              <button onClick={onSave} className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 text-xs font-medium">Save</button>
              <button onClick={onCancel} className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Cancel</button>
            </div>
          </div>
        ) : (
          <div key={item.id} className="flex items-center justify-between p-2.5 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)]">
            <div className="min-w-0">
              <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{item.name}</span>
              {typeField && item[typeField] && <span className="ml-2 text-[11px] uppercase tracking-[.4px] text-[var(--color-text-secondary)]">{item[typeField]}</span>}
              <p className="text-[11px] text-[var(--color-text-secondary)] truncate">{item.url}</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => onStartEdit(item)} className="p-1.5 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg" aria-label="Edit">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => onRemove(item.id)} className="p-1.5 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 rounded-lg" aria-label="Remove">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      )}

      {!editingId && (
        <div className="flex flex-col gap-2 p-2.5 bg-[var(--color-background)] rounded-lg border border-dashed border-[var(--color-border)]">
          {typeOptions.length > 0 && (
            <select value={(form as any)[typeField] || typeOptions[0]?.value || ''} onChange={e => setForm({ ...form, [typeField]: e.target.value } as any)}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)]">
              {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {fields.map(f => (
            <FieldInput key={f.key} field={f} value={(form as any)[f.key] || ''}
              onChange={(v) => setForm({ ...form, [f.key]: v } as any)} />
          ))}
          {extraFields?.(form, setForm)}
          <button onClick={() => { setForm({} as any); onSave(); }}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 text-xs font-medium">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small reusable pieces
// ---------------------------------------------------------------------------

function SectionCard({ title, description, icon: Icon, children, defaultOpen = false }: {
  title: string; description?: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-surface)] transition-colors cursor-pointer text-left">
        <Icon className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0" />
        <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{title}</span>
        {description && <span className="text-[11px] text-[var(--color-text-secondary)] ml-2 hidden sm:inline">{description}</span>}
        <span className="ml-auto text-[var(--color-text-secondary)] text-[10px]">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="p-3">{children}</div>}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]" />
      <div><span className="text-[13px] text-[var(--color-text-primary)]">{label}</span>
        {description && <p className="text-[11px] text-[var(--color-text-secondary)]">{description}</p>}</div>
    </label>
  );
}

function CheckRow({ label, detail, checked, onChange }: {
  label: string; detail?: string; checked: boolean; onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-surface)] cursor-pointer transition-colors">
      <input type="checkbox" checked={checked} onChange={onChange}
        className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]" />
      <div className="min-w-0"><span className="text-[13px] text-[var(--color-text-primary)]">{label}</span>
        {detail && <p className="text-[11px] text-[var(--color-text-secondary)] truncate">{detail}</p>}</div>
    </label>
  );
}

function SliderRow({ label, value, min, max, step, unit, note, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string; note?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-[13px] text-[var(--color-text-primary)] w-28 flex-shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[var(--color-primary)]" />
      <span className="text-[12px] font-semibold tabular-nums text-[var(--color-text-primary)] w-10 text-right">{value}{unit}</span>
      {note && <span className="text-[10px] text-[var(--color-text-secondary)] hidden sm:inline">{note}</span>}
    </div>
  );
}

const DEFAULT_ALERT_RULES: AlertRule[] = [
  { id: 'host-cpu-high', name: 'High CPU', enabled: true, source: 'glances', metric: 'cpu.percent', operator: '>=', threshold: 90, severity: 'warning', forSeconds: 120, notify: false },
  { id: 'host-memory-high', name: 'High memory', enabled: true, source: 'glances', metric: 'memory.percent', operator: '>=', threshold: 95, severity: 'warning', forSeconds: 120, notify: false },
  { id: 'host-disk-high', name: 'High disk usage', enabled: true, source: 'glances', metric: 'disk.percent', operator: '>=', threshold: 90, severity: 'warning', forSeconds: 120, notify: false },
  { id: 'host-unreachable', name: 'Host unreachable', enabled: true, source: 'reachability', metric: 'reachable', operator: '==', threshold: 0, severity: 'critical', forSeconds: 60, notify: true },
  { id: 'docker-unhealthy', name: 'Unhealthy Docker container', enabled: true, source: 'docker', metric: 'docker.unhealthy', operator: '>=', threshold: 1, severity: 'warning', forSeconds: 60, notify: false },
  { id: 'battery-low', name: 'Low battery', enabled: true, source: 'solar', metric: 'battery.soc', operator: '<=', threshold: 15, severity: 'critical', forSeconds: 60, notify: true },
  { id: 'stream-transcoding', name: 'High transcode count', enabled: true, source: 'media', metric: 'streams.transcoding', operator: '>=', threshold: 4, severity: 'warning', forSeconds: 60, notify: false },
  { id: 'downloads-paused', name: 'Downloads paused', enabled: true, source: 'usenet', metric: 'downloads.paused', operator: '==', threshold: 1, severity: 'info', forSeconds: 1800, notify: false },
  { id: 'seerr-issues', name: 'Seerr open issues', enabled: true, source: 'seerr', metric: 'seerr.issues', operator: '>=', threshold: 1, severity: 'warning', forSeconds: 60, notify: false },
];

const defaultMonitoring: MonitoringConfig = {
  enabled: false, pollIntervalSeconds: 10, glancesHosts: [], solar: { enabled: false }, docker: { enabled: true },
  media: [], usenet: [], arr: [], seerr: [], opnsense: [], ntopng: [], homeassistant: [], ui: { tabRotationSeconds: 15 }, alerts: DEFAULT_ALERT_RULES,
};
