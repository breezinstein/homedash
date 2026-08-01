import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { Plus, Trash2, Activity, Server, Sun, HardDrive, Tv, Download, Clock } from 'lucide-react';
import type {
  MonitoredMedia,
  MonitoredUsenet,
  MonitoringConfig,
  RemoteServer,
} from '../types';

// ---------------------------------------------------------------------------
// MonitoringSettings — read/write config.monitoring from the Settings modal.
// Reuses existing config.servers (RemoteServer) for Glances host selection
// and config.inverters for solar toggle, so URLs/credentials aren't
// duplicated.
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

  // --- Media servers ---
  const [newMedia, setNewMedia] = useState<Partial<MonitoredMedia>>({});

  function addMedia() {
    if (!newMedia.name?.trim() || !newMedia.url?.trim() || !newMedia.apiKey?.trim()) return;
    const entry: MonitoredMedia = {
      id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
      name: newMedia.name!.trim(),
      type: newMedia.type || 'jellyfin',
      url: newMedia.url!.trim(),
      apiKey: newMedia.apiKey!.trim(),
    };
    update({ media: [...(mon.media ?? []), entry] });
    setNewMedia({});
  }

  function removeMedia(id: string) {
    update({ media: (mon.media ?? []).filter((m) => m.id !== id) });
  }

  // --- Usenet downloaders ---
  const [newUsenet, setNewUsenet] = useState<Partial<MonitoredUsenet>>({});

  function addUsenet() {
    if (!newUsenet.name?.trim() || !newUsenet.url?.trim()) return;
    if (newUsenet.type === 'sabnzbd' && !newUsenet.apiKey?.trim()) return;
    if (newUsenet.type === 'nzbget' && !newUsenet.username?.trim()) return;
    const entry: MonitoredUsenet = {
      id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
      name: newUsenet.name!.trim(),
      type: newUsenet.type || 'sabnzbd',
      url: newUsenet.url!.trim(),
      apiKey: newUsenet.type === 'sabnzbd' ? newUsenet.apiKey?.trim() : undefined,
      username: newUsenet.type === 'nzbget' ? newUsenet.username?.trim() : undefined,
      password: newUsenet.type === 'nzbget' ? newUsenet.password?.trim() : undefined,
    };
    update({ usenet: [...(mon.usenet ?? []), entry] });
    setNewUsenet({});
  }

  function removeUsenet(id: string) {
    update({ usenet: (mon.usenet ?? []).filter((u) => u.id !== id) });
  }

  const solarConfigured = (config.inverters ?? []).length > 0;

  return (
    <div className="space-y-6">
      {/* ── Master toggle ────────────────────────── */}
      <SectionCard
        title="Home Lab Monitor"
        description="Background poller that feeds the /monitor full-screen page."
        icon={Activity}
      >
        <ToggleRow
          label="Enable monitoring"
          description="Turn on the background poller. Data is only visible to authenticated users."
          checked={mon.enabled}
          onChange={(v) => update({ enabled: v })}
        />
      </SectionCard>

      {!mon.enabled && (
        <p className="text-xs text-[var(--color-text-secondary)] italic">
          Enable monitoring above to configure data sources.
        </p>
      )}

      {mon.enabled && (
        <>
          {/* ── Poll & UI intervals ───────────────────── */}
          <SectionCard title="Intervals" icon={Clock}>
            <SliderRow
              label="Poll interval"
              value={mon.pollIntervalSeconds}
              min={5}
              max={60}
              step={5}
              unit="s"
              onChange={(v) => update({ pollIntervalSeconds: v })}
            />
            <SliderRow
              label="Tab rotation"
              value={mon.ui?.tabRotationSeconds ?? 15}
              min={0}
              max={60}
              step={5}
              unit="s"
              note="0 = manual tabs only"
              onChange={(v) => update({ ui: { tabRotationSeconds: v } })}
            />
          </SectionCard>

          {/* ── Glances hosts ──────────────────────── */}
          <SectionCard title="Glances Hosts" description="Select servers to aggregate CPU, memory, disk, load, network, and container stats." icon={Server}>
            {servers.length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)]">
                No servers configured yet. Add them in{' '}
                <strong className="text-[var(--color-text-primary)]">Server Stats &gt; Manage Servers</strong> first,
                then return here to select which ones to include in monitoring.
              </p>
            ) : (
              <div className="space-y-2">
                {servers.map((srv) => (
                  <CheckRow
                    key={srv.id}
                    label={srv.name}
                    detail={srv.url}
                    checked={selectedHostIds.has(srv.id)}
                    onChange={() => toggleGlancesHost(srv)}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {/* ── Solar ──────────────────────────────── */}
          <SectionCard title="Solar" description="Battery SOC, PV generation, grid import/export, runtime estimate." icon={Sun}>
            {!solarConfigured ? (
              <p className="text-xs text-[var(--color-text-secondary)]">
                No inverter configured yet. Add one in <strong className="text-[var(--color-text-primary)]">Inverter Monitor &gt; Manage Inverters</strong>.
              </p>
            ) : (
              <ToggleRow
                label="Include solar data"
                description="Polls the Solar Assistant API configured in Inverter Monitor."
                checked={mon.solar?.enabled ?? false}
                onChange={(v) => update({ solar: { enabled: v } })}
              />
            )}
          </SectionCard>

          {/* ── Docker ─────────────────────────────── */}
          <SectionCard title="Docker" description="Container count, health summary, problem list (derived from Glances)." icon={HardDrive}>
            <ToggleRow
              label="Enable Docker monitoring"
              description="Aggregates container health from all selected Glances hosts."
              checked={mon.docker?.enabled ?? true}
              onChange={(v) => update({ docker: { enabled: v } })}
            />
          </SectionCard>

          {/* ── Media servers (Emby / Jellyfin) ────── */}
          <SectionCard title="Media Servers" description="Active streams: user, title, device, progress, direct-play vs transcode." icon={Tv}>
            <div className="space-y-2">
              {(mon.media ?? []).map((m) => (
                <div key={m.id} className="flex items-center justify-between p-2.5 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)]">
                  <div className="min-w-0">
                    <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{m.name}</span>
                    <span className="ml-2 text-[11px] uppercase tracking-[.4px] text-[var(--color-text-secondary)]">{m.type}</span>
                    <p className="text-[11px] text-[var(--color-text-secondary)] truncate">{m.url}</p>
                  </div>
                  <button
                    onClick={() => removeMedia(m.id)}
                    className="p-1.5 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 rounded-lg flex-shrink-0"
                    aria-label={`Remove ${m.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <div className="flex flex-col gap-2 p-2.5 bg-[var(--color-background)] rounded-lg border border-dashed border-[var(--color-border)]">
                <div className="flex gap-2">
                  <select
                    value={newMedia.type || 'jellyfin'}
                    onChange={(e) => setNewMedia({ ...newMedia, type: e.target.value as 'jellyfin' | 'emby' })}
                    className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
                  >
                    <option value="jellyfin">Jellyfin</option>
                    <option value="emby">Emby</option>
                  </select>
                  <input
                    type="text"
                    value={newMedia.name || ''}
                    onChange={(e) => setNewMedia({ ...newMedia, name: e.target.value })}
                    placeholder="Label (e.g. jellyfin-main)"
                    className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50"
                  />
                </div>
                <input
                  type="text"
                  value={newMedia.url || ''}
                  onChange={(e) => setNewMedia({ ...newMedia, url: e.target.value })}
                  placeholder="URL (e.g. http://192.168.1.20:8096)"
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50"
                />
                <input
                  type="password"
                  value={newMedia.apiKey || ''}
                  onChange={(e) => setNewMedia({ ...newMedia, apiKey: e.target.value })}
                  placeholder="API key"
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50"
                />
                <button
                  onClick={addMedia}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 text-xs font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>
          </SectionCard>

          {/* ── Usenet downloaders (SABnzbd / NZBGet) ─ */}
          <SectionCard title="Usenet Downloaders" description="Queue speed, ETA, per-item progress, paused state." icon={Download}>
            <div className="space-y-2">
              {(mon.usenet ?? []).map((u) => (
                <div key={u.id} className="flex items-center justify-between p-2.5 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)]">
                  <div className="min-w-0">
                    <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{u.name}</span>
                    <span className="ml-2 text-[11px] uppercase tracking-[.4px] text-[var(--color-text-secondary)]">{u.type}</span>
                    <p className="text-[11px] text-[var(--color-text-secondary)] truncate">{u.url}</p>
                  </div>
                  <button
                    onClick={() => removeUsenet(u.id)}
                    className="p-1.5 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 rounded-lg flex-shrink-0"
                    aria-label={`Remove ${u.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <div className="flex flex-col gap-2 p-2.5 bg-[var(--color-background)] rounded-lg border border-dashed border-[var(--color-border)]">
                <div className="flex gap-2">
                  <select
                    value={newUsenet.type || 'sabnzbd'}
                    onChange={(e) => setNewUsenet({ ...newUsenet, type: e.target.value as 'sabnzbd' | 'nzbget' })}
                    className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)]"
                  >
                    <option value="sabnzbd">SABnzbd</option>
                    <option value="nzbget">NZBGet</option>
                  </select>
                  <input
                    type="text"
                    value={newUsenet.name || ''}
                    onChange={(e) => setNewUsenet({ ...newUsenet, name: e.target.value })}
                    placeholder="Label (e.g. sab-main)"
                    className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50"
                  />
                </div>
                <input
                  type="text"
                  value={newUsenet.url || ''}
                  onChange={(e) => setNewUsenet({ ...newUsenet, url: e.target.value })}
                  placeholder="URL (e.g. http://192.168.1.21:8080)"
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50"
                />
                {newUsenet.type === 'sabnzbd' || !newUsenet.type ? (
                  <input
                    type="password"
                    value={newUsenet.apiKey || ''}
                    onChange={(e) => setNewUsenet({ ...newUsenet, apiKey: e.target.value })}
                    placeholder="API key"
                    className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50"
                  />
                ) : (
                  <>
                    <input
                      type="text"
                      value={newUsenet.username || ''}
                      onChange={(e) => setNewUsenet({ ...newUsenet, username: e.target.value })}
                      placeholder="Username"
                      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50"
                    />
                    <input
                      type="password"
                      value={newUsenet.password || ''}
                      onChange={(e) => setNewUsenet({ ...newUsenet, password: e.target.value })}
                      placeholder="Password"
                      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50"
                    />
                  </>
                )}
                <button
                  onClick={addUsenet}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 text-xs font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small reusable pieces
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-background)]">
        <Icon className="w-4 h-4 text-[var(--color-primary)]" />
        <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">{title}</span>
        {description && (
          <span className="text-[11px] text-[var(--color-text-secondary)] ml-2 hidden sm:inline">{description}</span>
        )}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
      />
      <div>
        <span className="text-[13px] text-[var(--color-text-primary)]">{label}</span>
        {description && <p className="text-[11px] text-[var(--color-text-secondary)]">{description}</p>}
      </div>
    </label>
  );
}

function CheckRow({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-surface)] cursor-pointer transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
      />
      <div className="min-w-0">
        <span className="text-[13px] text-[var(--color-text-primary)]">{label}</span>
        {detail && <p className="text-[11px] text-[var(--color-text-secondary)] truncate">{detail}</p>}
      </div>
    </label>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  note,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  note?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-[13px] text-[var(--color-text-primary)] w-28 flex-shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[var(--color-primary)]"
      />
      <span className="text-[12px] font-semibold tabular-nums text-[var(--color-text-primary)] w-10 text-right">
        {value}{unit}
      </span>
      {note && <span className="text-[10px] text-[var(--color-text-secondary)] hidden sm:inline">{note}</span>}
    </div>
  );
}

const defaultMonitoring: MonitoringConfig = {
  enabled: false,
  pollIntervalSeconds: 10,
  glancesHosts: [],
  solar: { enabled: false },
  docker: { enabled: true },
  media: [],
  usenet: [],
  ui: { tabRotationSeconds: 15 },
  alerts: [],
};
