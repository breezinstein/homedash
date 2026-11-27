import { useCallback, useEffect, useState, type ComponentType } from 'react';
import {
  Bell,
  Clapperboard,
  Copy,
  Download,
  Film,
  House,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Server,
  Shield,
  Sun,
  Trash2,
  Tv,
} from 'lucide-react';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@ui-sdk/react/menu';
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack } from '@ui-sdk/react/slider';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from '@ui-sdk/react/segmented-control';
import { Field, FieldDescription, FieldLabel } from '@ui-sdk/react/field';
import { useDashboard } from '../../../context/DashboardContext';
import type { CertificateEntry, MonitoringConfig } from '../../../types';
import { newId } from '../../../lib/id';
import { copyToClipboard } from '../../../lib/clipboard';
import { expiryLevel, levelTone } from '../../../lib/levels';
import { fetchOverview, refreshCertificates } from '../../../monitor/monitorApi';
import { Button, EmptyState, InlineAlert, SwitchField, useConfirm, useToast } from '../../ui';
import { EntityDialog, KINDS, type EntityForm, type EntityKind } from './EntityDialog';
import { AlertRules } from './AlertRules';
import { useMonitorDraft } from './MonitorDraft';

type Icon = ComponentType<{ className?: string }>;

function SliderField({
  label,
  description,
  value,
  min,
  max,
  step,
  unit,
  presets,
  format,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  presets: { value: number; label: string }[];
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const text = format ? format(value) : `${value} ${unit}`;
  return (
    <Field className="ui-field">
      <div className="flex items-baseline justify-between gap-3">
        <FieldLabel className="ui-label">{label}</FieldLabel>
        <span className="text-sm font-semibold tabular-nums">{text}</span>
      </div>
      <Slider
        className="ui-slider"
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : (v as number))}
        format={format ? (v: number) => format(v) : { style: 'unit', unit: 'second' }}
      >
        <SliderControl className="ui-slider-control">
          <SliderTrack className="ui-slider-track">
            <SliderIndicator className="ui-slider-indicator" />
            <SliderThumb className="ui-slider-thumb" />
          </SliderTrack>
        </SliderControl>
      </Slider>
      <SegmentedControl
        aria-label={`${label} presets`}
        className="ui-seg justify-self-start"
        value={presets.some((p) => p.value === value) ? String(value) : null}
        onValueChange={(v) => { if (v != null) onChange(Number(v)); }}
      >
        <SegmentedControlIndicator />
        {presets.map((p) => (
          <SegmentedControlItem key={p.value} value={String(p.value)} className="ui-seg-item">{p.label}</SegmentedControlItem>
        ))}
      </SegmentedControl>
      <FieldDescription className="ui-description">{description}</FieldDescription>
    </Field>
  );
}

/** Settings → Monitor → General: master switch, polling and tab rotation. */
export function MonitorGeneralSection({ onJump }: { onJump: (key: string) => void }) {
  const { mon, update } = useMonitorDraft();
  const { servers } = useDashboard();
  const polled = servers.filter((s) => s.monitor).length;
  const sources: { key: string; label: string; icon: Icon; count: number }[] = [
    { key: 'servers', label: 'Servers', icon: Server, count: polled },
    { key: 'monitor-solar', label: 'Solar', icon: Sun, count: mon.solar?.enabled ? 1 : 0 },
    { key: 'monitor-media', label: 'Media', icon: Tv, count: mon.media?.length ?? 0 },
    { key: 'monitor-usenet', label: 'Usenet', icon: Download, count: mon.usenet?.length ?? 0 },
    { key: 'monitor-arr', label: 'Sonarr / Radarr', icon: Film, count: mon.arr?.length ?? 0 },
    { key: 'monitor-seerr', label: 'Requests', icon: Clapperboard, count: mon.seerr?.length ?? 0 },
    { key: 'monitor-network', label: 'Network', icon: Shield, count: (mon.opnsense?.length ?? 0) + (mon.ntopng?.length ?? 0) },
    { key: 'monitor-home', label: 'Home Assistant', icon: House, count: mon.homeassistant?.length ?? 0 },
    { key: 'monitor-certs', label: 'Certificates', icon: Lock, count: mon.certificates?.length ?? 0 },
    { key: 'monitor-alerts', label: 'Alert rules', icon: Bell, count: (mon.alerts ?? []).filter((a) => a.enabled).length },
  ];

  return (
    <div className="space-y-6">
      <div className="ui-panel-section px-3 py-1">
        <SwitchField
          checked={mon.enabled}
          onCheckedChange={(v) => update({ enabled: v })}
          label="Run the monitor"
          description="Polls every source below in the background and checks alert rules, even with no browser open."
        />
      </div>
      <SliderField
        label="Poll every"
        description="How often the server reads each source. Shorter means fresher numbers and more requests."
        value={mon.pollIntervalSeconds ?? 10}
        min={2}
        max={60}
        step={1}
        unit="s"
        presets={[{ value: 5, label: '5s' }, { value: 10, label: '10s' }, { value: 15, label: '15s' }, { value: 30, label: '30s' }, { value: 60, label: '60s' }]}
        onChange={(v) => update({ pollIntervalSeconds: v })}
      />
      <SliderField
        label="Rotate tabs every"
        description="On a wall display the monitor moves to the next tab on its own. Clicking a tab pauses this for a minute."
        value={mon.ui?.tabRotationSeconds ?? 15}
        min={0}
        max={60}
        step={5}
        unit="s"
        format={(v) => (v === 0 ? 'Off' : `${v}s`)}
        presets={[{ value: 0, label: 'Off' }, { value: 10, label: '10s' }, { value: 15, label: '15s' }, { value: 30, label: '30s' }, { value: 60, label: '60s' }]}
        onChange={(v) => update({ ui: { ...(mon.ui ?? {}), tabRotationSeconds: v } })}
      />
      <div>
        <div className="ui-label mb-2">What the monitor reads</div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
          {sources.map(({ key, label, icon: I, count }) => (
            <button key={key} type="button" className="ui-source-chip" data-on={count > 0 || undefined} onClick={() => onJump(key)}>
              <I className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <span className="tabular-nums">{count}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MonitorSolarSection({ onJump }: { onJump: (key: string) => void }) {
  const { mon, update } = useMonitorDraft();
  const { inverters } = useDashboard();
  return (
    <div className="space-y-4">
      <div className="ui-panel-section px-3 py-1">
        <SwitchField
          checked={mon.solar?.enabled ?? false}
          onCheckedChange={(v) => update({ solar: { enabled: v } })}
          label="Read solar and battery data"
          description="Battery charge, solar, grid and house load for the Power tab, from the Solar Assistant devices in Sources → Inverters."
        />
      </div>
      {inverters.length === 0 ? (
        <InlineAlert tone="warning" actions={<Button size="sm" onClick={() => onJump('inverters')}>Add an inverter</Button>}>
          No Solar Assistant device is set up yet, so there's nothing to read.
        </InlineAlert>
      ) : (
        <ul className="ui-panel-section">
          {inverters.map((inv) => (
            <li key={inv.id} className="ui-row">
              <Sun className="size-4 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{inv.name}</span>
              <span className="ui-row-dim truncate font-mono">{inv.url}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MonitorDockerSection() {
  const { mon, update } = useMonitorDraft();
  return (
    <div className="space-y-4">
      <div className="ui-panel-section px-3 py-1">
        <SwitchField
          checked={mon.docker?.enabled !== false}
          onCheckedChange={(v) => update({ docker: { enabled: v } })}
          label="Watch Docker containers"
          description="Counts running, unhealthy and restarting containers on every monitored server through Glances."
        />
      </div>
      <p className="text-xs text-[var(--color-text-secondary)]">
        Glances needs access to Docker on each server, for example with the Docker socket mounted. A server can also name its own Docker socket or URL in Sources → Servers.
      </p>
    </div>
  );
}

const LIST_KEY: Record<Exclude<EntityKind, 'certificates'>, 'media' | 'usenet' | 'arr' | 'seerr' | 'opnsense' | 'ntopng' | 'homeassistant'> = {
  media: 'media',
  usenet: 'usenet',
  arr: 'arr',
  seerr: 'seerr',
  opnsense: 'opnsense',
  ntopng: 'ntopng',
  homeassistant: 'homeassistant',
};

const KIND_ICON: Record<EntityKind, Icon> = {
  media: Tv,
  usenet: Download,
  arr: Film,
  seerr: Clapperboard,
  opnsense: Shield,
  ntopng: Radio,
  homeassistant: House,
  certificates: Lock,
};

function typeLabel(kind: EntityKind, type?: string) {
  return KINDS[kind].types?.find((t) => t.value === type)?.label;
}

function credentialLabel(item: EntityForm, kind: EntityKind) {
  if (kind === 'homeassistant') return item.token ? 'Token set' : 'No token';
  if (kind === 'opnsense') return item.apiKey && item.apiSecret ? 'Key and secret set' : 'Missing key or secret';
  if (item.apiKey) return 'API key set';
  if (item.username) return 'Login set';
  return 'No credentials';
}

/** One list of monitored sources with add, edit, copy URL and delete. */
function SourceList({ kind, title, addLabel, emptyText }: { kind: Exclude<EntityKind, 'certificates'>; title?: string; addLabel: string; emptyText: string }) {
  const { mon, setList } = useMonitorDraft();
  const confirm = useConfirm();
  const toast = useToast();
  const key = LIST_KEY[kind];
  const items = (mon[key] ?? []) as unknown as EntityForm[];
  const [editing, setEditing] = useState<{ item: EntityForm; isNew: boolean } | null>(null);
  const I = KIND_ICON[kind];

  const save = (form: EntityForm) => {
    const next = editing?.isNew
      ? [...items, { ...form, id: newId() }]
      : items.map((i) => (i.id === form.id ? { ...i, ...form } : i));
    setList(key, next as unknown as MonitoringConfig[typeof key]);
    setEditing(null);
  };

  const remove = async (item: EntityForm) => {
    const ok = await confirm({ title: `Remove ${item.name}?`, message: 'The monitor stops reading it once you save.', confirmLabel: 'Remove', tone: 'danger' });
    if (ok) setList(key, items.filter((i) => i.id !== item.id) as unknown as MonitoringConfig[typeof key]);
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        {title ? <h3 className="ui-label">{title}</h3> : null}
        <Button size="sm" variant={items.length ? 'secondary' : 'primary'} className="ml-auto" onClick={() => setEditing({ item: {}, isNew: true })}>
          <Plus className="size-3.5" aria-hidden="true" /> {addLabel}
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={I} title={emptyText} compact />
      ) : (
        <ul className="ui-panel-section">
          {items.map((item) => (
            <li key={item.id} className="ui-row">
              <span className="ui-row-icon"><I className="size-4" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-medium">{item.name}</span>
                  {typeLabel(kind, item.type) ? <span className="ui-chip">{typeLabel(kind, item.type)}</span> : null}
                </div>
                <p className="ui-row-dim truncate">
                  <span className="font-mono">{item.url}</span> · {credentialLabel(item, kind)}{item.insecureTls ? ' · self-signed allowed' : ''}
                </p>
              </div>
              <Menu>
                <MenuTrigger className="ui-btn" data-variant="ghost" data-size="icon" aria-label={`Actions for ${item.name}`}>
                  <MoreHorizontal className="size-4" />
                </MenuTrigger>
                <MenuContent className="ui-popup" align="end">
                  <MenuItem value="edit" className="ui-menu-item" onClick={() => setEditing({ item: { ...item }, isNew: false })}>
                    <Pencil className="size-3.5" aria-hidden="true" /> Edit
                  </MenuItem>
                  <MenuItem
                    value="copy"
                    className="ui-menu-item"
                    onClick={() => { void copyToClipboard(item.url ?? '').then((ok) => (ok ? toast.success('URL copied') : toast.error('Copy failed'))); }}
                  >
                    <Copy className="size-3.5" aria-hidden="true" /> Copy URL
                  </MenuItem>
                  <MenuSeparator className="ui-menu-separator" />
                  <MenuItem value="delete" className="ui-menu-item" data-tone="danger" onClick={() => { void remove(item); }}>
                    <Trash2 className="size-3.5" aria-hidden="true" /> Remove
                  </MenuItem>
                </MenuContent>
              </Menu>
            </li>
          ))}
        </ul>
      )}
      {editing && <EntityDialog kind={kind} initial={editing.item} isNew={editing.isNew} onSave={save} onClose={() => setEditing(null)} />}
    </section>
  );
}

export function MonitorMediaSection() {
  return <SourceList kind="media" addLabel="Add media server" emptyText="Add Jellyfin or Emby to see who is watching what." />;
}
export function MonitorUsenetSection() {
  return <SourceList kind="usenet" addLabel="Add downloader" emptyText="Add SABnzbd or NZBGet to follow download speed and queues." />;
}
export function MonitorArrSection() {
  return <SourceList kind="arr" addLabel="Add Sonarr or Radarr" emptyText="Add Sonarr or Radarr to see their queue, missing items and health." />;
}
export function MonitorSeerrSection() {
  return <SourceList kind="seerr" addLabel="Add request service" emptyText="Add Overseerr or Jellyseerr to see pending requests and open issues." />;
}
export function MonitorHomeSection() {
  return <SourceList kind="homeassistant" addLabel="Add Home Assistant" emptyText="Connect Home Assistant to see the pump, sensors and unavailable devices." />;
}
export function MonitorNetworkSection() {
  return (
    <div className="space-y-6">
      <SourceList kind="opnsense" title="OPNsense" addLabel="Add OPNsense" emptyText="Add OPNsense for WAN links, firewall states and NetFlow talkers." />
      <SourceList kind="ntopng" title="ntopng" addLabel="Add ntopng" emptyText="Add ntopng for live per-device traffic." />
    </div>
  );
}

/** Certificates to watch, with each one's live days-left and a re-check button. */
export function MonitorCertificatesSection() {
  const { mon, setList } = useMonitorDraft();
  const confirm = useConfirm();
  const toast = useToast();
  const items = (mon.certificates ?? []) as unknown as EntityForm[];
  const [editing, setEditing] = useState<{ item: EntityForm; isNew: boolean } | null>(null);
  const [live, setLive] = useState<Map<string, CertificateEntry>>(new Map());
  const [busy, setBusy] = useState<string | 'all' | null>(null);

  const merge = useCallback((entries: CertificateEntry[]) => {
    setLive((prev) => {
      const next = new Map(prev);
      for (const e of entries) next.set(e.id, e);
      return next;
    });
  }, []);

  useEffect(() => {
    fetchOverview().then((o) => merge(o.certificates?.items ?? [])).catch(() => {});
  }, [merge]);

  const recheck = async (ids?: string[]) => {
    setBusy(ids?.[0] ?? 'all');
    try {
      const snap = await refreshCertificates(ids);
      merge(snap.items);
      toast.success(ids ? 'Certificate checked' : 'All certificates checked');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The check failed');
    } finally {
      setBusy(null);
    }
  };

  const save = (form: EntityForm) => {
    const next = editing?.isNew ? [...items, { ...form, port: form.port ?? 443, id: newId() }] : items.map((i) => (i.id === form.id ? { ...i, ...form } : i));
    setList('certificates', next as unknown as MonitoringConfig['certificates']);
    setEditing(null);
  };

  const remove = async (item: EntityForm) => {
    const ok = await confirm({ title: `Stop watching ${item.name}?`, message: 'Its expiry alert goes away once you save.', confirmLabel: 'Remove', tone: 'danger' });
    if (ok) setList('certificates', items.filter((i) => i.id !== item.id) as unknown as MonitoringConfig['certificates']);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-[var(--color-text-secondary)]">Checked about once a day. An alert fires when 5 or fewer days are left.</p>
        <span className="ml-auto flex gap-2">
          {items.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => { void recheck(); }} disabled={busy !== null}>
              <RefreshCw className={`size-3.5 ${busy === 'all' ? 'animate-spin' : ''}`} aria-hidden="true" /> Check all now
            </Button>
          )}
          <Button size="sm" variant={items.length ? 'secondary' : 'primary'} onClick={() => setEditing({ item: { port: 443 }, isNew: true })}>
            <Plus className="size-3.5" aria-hidden="true" /> Add certificate
          </Button>
        </span>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Lock} title="Add a host and port to watch its certificate expiry." compact />
      ) : (
        <ul className="ui-panel-section">
          {items.map((item) => {
            const entry = item.id ? live.get(item.id) : undefined;
            const days = entry?.daysLeft ?? null;
            const status = entry?.status === 'error' ? 'Check failed' : days == null ? 'Not checked yet' : days < 0 ? 'Expired' : `${days} days left`;
            const tone = entry?.status === 'error' ? 'danger' : levelTone(expiryLevel(days));
            return (
              <li key={item.id} className="ui-row">
                <span className="ui-row-icon"><Lock className="size-4" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.name}</span>
                  <p className="ui-row-dim truncate font-mono">{item.host}:{item.port ?? 443}{entry?.status === 'error' && entry.error ? ` · ${entry.error}` : ''}</p>
                </div>
                <span className="ui-chip" data-tone={tone}>{status}</span>
                <Menu>
                  <MenuTrigger className="ui-btn" data-variant="ghost" data-size="icon" aria-label={`Actions for ${item.name}`}>
                    <MoreHorizontal className="size-4" />
                  </MenuTrigger>
                  <MenuContent className="ui-popup" align="end">
                    <MenuItem value="check" className="ui-menu-item" disabled={busy !== null} onClick={() => { if (item.id) void recheck([item.id]); }}>
                      <RefreshCw className="size-3.5" aria-hidden="true" /> Check now
                    </MenuItem>
                    <MenuItem value="edit" className="ui-menu-item" onClick={() => setEditing({ item: { ...item }, isNew: false })}>
                      <Pencil className="size-3.5" aria-hidden="true" /> Edit
                    </MenuItem>
                    <MenuSeparator className="ui-menu-separator" />
                    <MenuItem value="delete" className="ui-menu-item" data-tone="danger" onClick={() => { void remove(item); }}>
                      <Trash2 className="size-3.5" aria-hidden="true" /> Remove
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </li>
            );
          })}
        </ul>
      )}
      {editing && <EntityDialog kind="certificates" initial={editing.item} isNew={editing.isNew} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

export function MonitorAlertsSection() {
  const { mon, update } = useMonitorDraft();
  const { servers } = useDashboard();
  return (
    <AlertRules
      rules={mon.alerts ?? []}
      servers={servers}
      onChange={(alerts) => update({ alerts })}
      onRemove={(id) =>
        update({
          alerts: (mon.alerts ?? []).filter((r) => r.id !== id),
          suppressedAutoAlerts: [...(mon.suppressedAutoAlerts ?? []), id],
        })
      }
    />
  );
}

