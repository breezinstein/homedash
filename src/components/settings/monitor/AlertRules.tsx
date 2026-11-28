import { useMemo, useState, type FormEvent } from 'react';
import { Bell, BellRing, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@ui-sdk/react/menu';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from '@ui-sdk/react/segmented-control';
import { Switch, SwitchThumb } from '@ui-sdk/react/switch';
import type { AlertRule, RemoteServer, Severity } from '../../../types';
import { newId } from '../../../lib/id';
import { Button, CheckboxField, EmptyState, FieldRow, Input, Modal, SelectField, useConfirm } from '../../ui';

const SOURCE_LABELS: Record<AlertRule['source'], string> = {
  glances: 'Server (Glances)',
  reachability: 'Server reachability',
  solar: 'Solar and battery',
  docker: 'Docker',
  media: 'Media streams',
  usenet: 'Usenet',
  seerr: 'Media requests',
  homeassistant: 'Home Assistant',
  ntopng: 'ntopng',
  certificate: 'TLS certificate',
};

const METRICS: Record<AlertRule['source'], { value: string; label: string }[]> = {
  glances: [
    { value: 'cpu.percent', label: 'CPU %' },
    { value: 'memory.percent', label: 'Memory %' },
    { value: 'disk.percent', label: 'Disk %' },
    { value: 'temperature', label: 'Temperature °C' },
    { value: 'cpu.load.1m', label: 'Load average (1 min)' },
    { value: 'network.rxBps', label: 'Download (bytes/s)' },
    { value: 'network.txBps', label: 'Upload (bytes/s)' },
  ],
  reachability: [{ value: 'reachable', label: 'Reachable (1 yes, 0 no)' }],
  solar: [
    { value: 'battery.soc', label: 'Battery charge %' },
    { value: 'battery.power', label: 'Battery power (W)' },
    { value: 'pv.power', label: 'Solar power (W)' },
    { value: 'grid.power', label: 'Grid power (W)' },
    { value: 'load.percent', label: 'Load % of capacity' },
  ],
  docker: [
    { value: 'docker.unhealthy', label: 'Unhealthy containers' },
    { value: 'docker.restarting', label: 'Restarting containers' },
    { value: 'docker.runningRatio', label: 'Share running (0–1)' },
  ],
  media: [
    { value: 'streams.transcoding', label: 'Transcoding streams' },
    { value: 'streams.count', label: 'Active streams' },
  ],
  usenet: [
    { value: 'downloads.paused', label: 'Downloads paused' },
    { value: 'queue.slots', label: 'Queued items' },
    { value: 'downloads.speed', label: 'Download speed (bytes/s)' },
  ],
  seerr: [
    { value: 'seerr.issues', label: 'Open issues' },
    { value: 'seerr.pending', label: 'Pending requests' },
    { value: 'seerr.failed', label: 'Failed requests' },
  ],
  homeassistant: [
    { value: 'ha.unavailable', label: 'Unavailable devices' },
    { value: 'ha.unavailableRatio', label: 'Share unavailable (0–1)' },
    { value: 'ha.batteryLow', label: 'Lowest battery %' },
    { value: 'ha.doorsOpen', label: 'Doors open' },
    { value: 'ha.entities', label: 'Entity count' },
  ],
  ntopng: [
    { value: 'ntopng.topThroughput', label: 'Busiest host (bytes/s)' },
    { value: 'ntopng.talkerCount', label: 'Top talkers tracked' },
  ],
  certificate: [
    { value: 'cert.daysLeft', label: 'Days until expiry' },
    { value: 'cert.minDaysLeft', label: 'Soonest expiry (days)' },
  ],
};

const OPERATORS: AlertRule['operator'][] = ['>', '>=', '<', '<=', '==', '!='];
const SEVERITY_TONE: Record<Severity, 'danger' | 'warning' | 'info'> = { critical: 'danger', warning: 'warning', info: 'info' };
const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Critical', warning: 'Warning', info: 'Info' };

function newRule(): AlertRule {
  return {
    id: newId(),
    name: '',
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

/** Rules that turn monitor readings into alerts, filterable by severity. */
export function AlertRules({
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
  const confirm = useConfirm();
  const [filter, setFilter] = useState<'all' | Severity>('all');
  const [editing, setEditing] = useState<{ rule: AlertRule; isNew: boolean } | null>(null);
  const shown = useMemo(() => (filter === 'all' ? rules : rules.filter((r) => r.severity === filter)), [rules, filter]);
  const hostName = (id?: string) => (id ? servers.find((s) => s.id === id)?.name ?? 'a removed server' : null);

  const remove = async (rule: AlertRule) => {
    const ok = await confirm({
      title: 'Delete alert rule?',
      message: `“${rule.name}” stops being checked.${rule.id.startsWith('auto-') ? ' It won\'t be created again automatically.' : ''}`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (ok) onRemove(rule.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl aria-label="Show rules" className="ui-seg" value={filter} onValueChange={(v) => { if (v) setFilter(v as typeof filter); }}>
          <SegmentedControlIndicator />
          {(['all', 'critical', 'warning', 'info'] as const).map((sev) => (
            <SegmentedControlItem key={sev} value={sev} className="ui-seg-item">
              {sev === 'all' ? 'All' : SEVERITY_LABEL[sev]}
              <span className="text-[var(--text-tertiary)] tabular-nums">{sev === 'all' ? rules.length : rules.filter((r) => r.severity === sev).length}</span>
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <Button variant="primary" size="sm" className="ml-auto" onClick={() => setEditing({ rule: newRule(), isNew: true })}>
          <Plus className="size-3.5" aria-hidden="true" /> New rule
        </Button>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={Bell} title={rules.length ? 'No rules at this severity' : 'No alert rules yet'} description="Rules compare a reading with a threshold and fire after it holds for the time you set." compact />
      ) : (
        <ul className="ui-panel-section">
          {shown.map((rule) => {
            const metric = METRICS[rule.source]?.find((m) => m.value === rule.metric)?.label ?? rule.metric;
            const host = hostName(rule.host);
            return (
              <li key={rule.id} className="ui-row" data-disabled={rule.enabled ? undefined : ''}>
                <Switch
                  className="ui-switch"
                  checked={rule.enabled}
                  onCheckedChange={(v) => onChange(rules.map((r) => (r.id === rule.id ? { ...r, enabled: v } : r)))}
                  aria-label={`${rule.enabled ? 'Turn off' : 'Turn on'} ${rule.name}`}
                >
                  <SwitchThumb />
                </Switch>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={`truncate font-medium ${rule.enabled ? '' : 'text-[var(--color-text-secondary)] line-through'}`}>{rule.name}</span>
                    <span className="ui-chip" data-tone={SEVERITY_TONE[rule.severity]}>{SEVERITY_LABEL[rule.severity]}</span>
                    {rule.notify && <BellRing className="size-3 shrink-0 text-[var(--color-text-secondary)]" aria-label="Sends a notification" />}
                  </div>
                  <p className="ui-row-dim truncate">
                    {SOURCE_LABELS[rule.source]}{host ? ` · ${host}` : ''} · {metric} <span className="font-mono">{rule.operator} {rule.threshold}</span>
                    {rule.forSeconds > 0 ? ` for ${rule.forSeconds}s` : ''}
                  </p>
                </div>
                <Menu>
                  <MenuTrigger className="ui-btn" data-variant="ghost" data-size="icon" aria-label={`Actions for ${rule.name}`}>
                    <MoreHorizontal className="size-4" />
                  </MenuTrigger>
                  <MenuContent className="ui-popup" align="end">
                    <MenuItem value="edit" className="ui-menu-item" onClick={() => setEditing({ rule: { ...rule }, isNew: false })}>
                      <Pencil className="size-3.5" aria-hidden="true" /> Edit
                    </MenuItem>
                    <MenuItem value="delete" className="ui-menu-item" data-tone="danger" onClick={() => { void remove(rule); }}>
                      <Trash2 className="size-3.5" aria-hidden="true" /> Delete
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <RuleDialog
          rule={editing.rule}
          isNew={editing.isNew}
          servers={servers}
          onClose={() => setEditing(null)}
          onSave={(rule) => {
            onChange(editing.isNew ? [...rules, rule] : rules.map((r) => (r.id === rule.id ? rule : r)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function RuleDialog({ rule, isNew, servers, onSave, onClose }: { rule: AlertRule; isNew: boolean; servers: RemoteServer[]; onSave: (r: AlertRule) => void; onClose: () => void }) {
  const [form, setForm] = useState<AlertRule>(rule);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<AlertRule>) => setForm((f) => ({ ...f, ...patch }));
  const metrics = METRICS[form.source] ?? METRICS.glances;
  const showHost = form.source === 'glances' || form.source === 'reachability';
  const monitored = servers.filter((s) => s.monitor);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name the rule so you recognise it when it fires.');
    if (!Number.isFinite(form.threshold)) return setError('The threshold needs to be a number.');
    onSave({ ...form, name: form.name.trim() });
  };

  return (
    <Modal
      onClose={onClose}
      title={isNew ? 'New alert rule' : 'Edit alert rule'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="rule-form">{isNew ? 'Create rule' : 'Done'}</Button>
        </>
      }
    >
      <form id="rule-form" onSubmit={submit} className="space-y-4">
        <FieldRow label="Name">
          <Input value={form.name} onValueChange={(v) => set({ name: v })} placeholder="e.g. NAS disk nearly full" autoFocus />
        </FieldRow>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Source">
            <SelectField
              ariaLabel="Source"
              value={form.source}
              onValueChange={(v) => {
                const source = v as AlertRule['source'];
                set({ source, metric: METRICS[source]?.[0]?.value ?? '', host: undefined });
              }}
              options={(Object.keys(METRICS) as AlertRule['source'][]).map((s) => ({ value: s, label: SOURCE_LABELS[s] }))}
            />
          </FieldRow>
          <FieldRow label="Reading">
            <SelectField ariaLabel="Reading" value={form.metric} onValueChange={(v) => set({ metric: v })} options={metrics} />
          </FieldRow>
        </div>
        {showHost && (
          <FieldRow label="Server" description="Only servers the monitor polls are listed.">
            <SelectField
              ariaLabel="Server"
              value={form.host ?? '__all'}
              onValueChange={(v) => set({ host: v === '__all' ? undefined : v })}
              options={[{ value: '__all', label: 'Every monitored server' }, ...monitored.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </FieldRow>
        )}
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <FieldRow label="When">
            <SelectField ariaLabel="Comparison" value={form.operator} onValueChange={(v) => set({ operator: v as AlertRule['operator'] })} options={OPERATORS.map((o) => ({ value: o, label: o }))} />
          </FieldRow>
          <FieldRow label="Threshold">
            <Input
              inputMode="decimal"
              value={Number.isFinite(form.threshold) ? String(form.threshold) : ''}
              onValueChange={(v) => set({ threshold: v.trim() === '' ? Number.NaN : Number(v) })}
              className="font-mono"
            />
          </FieldRow>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Severity">
            <SegmentedControl aria-label="Severity" className="ui-seg justify-self-start" value={form.severity} onValueChange={(v) => { if (v) set({ severity: v as Severity }); }}>
              <SegmentedControlIndicator />
              {(['critical', 'warning', 'info'] as const).map((s) => (
                <SegmentedControlItem key={s} value={s} className="ui-seg-item">{SEVERITY_LABEL[s]}</SegmentedControlItem>
              ))}
            </SegmentedControl>
          </FieldRow>
          <FieldRow label="Holds for (seconds)" description="0 fires on the first reading.">
            <Input
              inputMode="numeric"
              value={String(form.forSeconds)}
              onValueChange={(v) => set({ forSeconds: Math.max(0, Number(v.replace(/\D/g, '')) || 0) })}
              className="w-28 font-mono"
            />
          </FieldRow>
        </div>
        <CheckboxField checked={form.notify} onCheckedChange={(v) => set({ notify: v })} label="Send a notification when it starts firing" />
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
      </form>
    </Modal>
  );
}
