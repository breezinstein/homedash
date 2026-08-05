import { useState } from 'react';
import { Plus, Trash2, Edit2, Bell } from 'lucide-react';
import type { AlertRule, Severity, RemoteServer } from '../types';
import { newId } from '../lib/id';

interface AlertRulesEditorProps {
  rules: AlertRule[];
  servers: RemoteServer[];
  onChange: (rules: AlertRule[]) => void;
  /** Called when a rule is deleted; lets the parent record auto-rule suppression. */
  onRemove?: (id: string) => void;
}

type SourceKey = AlertRule['source'];

const SOURCE_LABELS: Record<SourceKey, string> = {
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

const METRICS: Record<SourceKey, { value: string; label: string }[]> = {
  glances: [
    { value: 'cpu.percent', label: 'CPU %' },
    { value: 'memory.percent', label: 'Memory %' },
    { value: 'disk.percent', label: 'Disk %' },
    { value: 'cpu.load.1m', label: 'Load average (1m)' },
    { value: 'network.rxBps', label: 'Network ↓ (B/s)' },
    { value: 'network.txBps', label: 'Network ↑ (B/s)' },
  ],
  solar: [
    { value: 'battery.soc', label: 'Battery SOC %' },
    { value: 'battery.power', label: 'Battery power (W)' },
    { value: 'pv.power', label: 'PV power (W)' },
    { value: 'grid.power', label: 'Grid power (W)' },
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

const SEVERITIES: { value: Severity; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical', color: '#e74c3c' },
  { value: 'warning', label: 'Warning', color: '#e67e22' },
  { value: 'info', label: 'Info', color: '#6c5ce7' },
];

function emptyRule(): AlertRule {
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
    notify: false,
  };
}

const inputCls =
  'bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)]';
const labelCls = 'text-[11px] font-medium text-[var(--color-text-secondary)]';

/**
 * Manage monitoring alert rules: add / edit / delete / toggle. Each rule is
 * evaluated on every poll by the monitor backend against the configured
 * source metric.
 */
export function AlertRulesEditor({ rules, servers, onChange, onRemove }: AlertRulesEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AlertRule | null>(null);

  const cancel = () => { setEditingId(null); setForm(null); };
  const startEdit = (r: AlertRule) => { setEditingId(r.id); setForm({ ...r }); };
  const startNew = () => { setEditingId('__new__'); setForm(emptyRule()); };

  const save = () => {
    if (!form) return;
    const cleaned: AlertRule = {
      ...form,
      name: form.name.trim() || SOURCE_LABELS[form.source],
      host: form.host || undefined,
      enabled: form.enabled ?? true,
    };
    if (editingId && editingId !== '__new__') {
      onChange(rules.map((r) => (r.id === editingId ? cleaned : r)));
    } else {
      onChange([...rules, { ...cleaned, id: newId() }]);
    }
    cancel();
  };

  const remove = (id: string) => {
    if (onRemove) onRemove(id);
    else onChange(rules.filter((r) => r.id !== id));
  };
  const toggle = (id: string) => onChange(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));

  const activeForm = editingId && form ? form : null;

  return (
    <div className="space-y-2">
      {rules.map((rule) =>
        editingId === rule.id && activeForm ? (
          <RuleForm key={rule.id} form={activeForm} setForm={setForm} servers={servers} onSave={save} onCancel={cancel} />
        ) : (
          <RuleRow key={rule.id} rule={rule} onEdit={startEdit} onRemove={remove} onToggle={toggle} />
        ),
      )}

      {editingId === '__new__' && activeForm ? (
        <RuleForm form={activeForm} setForm={setForm} servers={servers} onSave={save} onCancel={cancel} />
      ) : (
        <button
          onClick={startNew}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--color-background)] border border-dashed border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-primary)] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add alert rule
        </button>
      )}
    </div>
  );
}

function RuleRow({
  rule,
  onEdit,
  onRemove,
  onToggle,
}: {
  rule: AlertRule;
  onEdit: (r: AlertRule) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const sev = SEVERITIES.find((s) => s.value === rule.severity) ?? SEVERITIES[1];
  const metricLabel = METRICS[rule.source]?.find((m) => m.value === rule.metric)?.label ?? rule.metric;

  return (
    <div className="flex items-center justify-between gap-2 p-2.5 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[13px] font-semibold ${rule.enabled ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] line-through'}`}>
            {rule.name}
          </span>
          <span
            className="text-[9px] font-bold uppercase tracking-[.4px] px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ color: sev.color, background: `color-mix(in srgb, ${sev.color} 14%, transparent)` }}
          >
            {sev.label}
          </span>
          {rule.notify && <Bell className="w-3 h-3 text-[var(--color-text-secondary)] flex-shrink-0" />}
        </div>
        <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
          {SOURCE_LABELS[rule.source]} · {metricLabel} {rule.operator} {rule.threshold}
          {rule.forSeconds > 0 ? ` · for ${rule.forSeconds}s` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <label className="cursor-pointer flex items-center" title={rule.enabled ? 'Enabled' : 'Disabled'}>
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={() => onToggle(rule.id)}
            className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-surface)]"
          />
        </label>
        <button onClick={() => onEdit(rule)} className="p-1.5 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg" aria-label="Edit rule">
          <Edit2 className="w-4 h-4" />
        </button>
        <button onClick={() => onRemove(rule.id)} className="p-1.5 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 rounded-lg" aria-label="Remove rule">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function RuleForm({
  form,
  setForm,
  servers,
  onSave,
  onCancel,
}: {
  form: AlertRule;
  setForm: (f: AlertRule) => void;
  servers: RemoteServer[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = (patch: Partial<AlertRule>) => setForm({ ...form, ...patch });
  const setSource = (source: SourceKey) =>
    setForm({ ...form, source, metric: METRICS[source]?.[0]?.value ?? '', host: undefined });

  const metrics = METRICS[form.source] ?? METRICS.glances;
  const showHost = form.source === 'glances' || form.source === 'reachability';
  const field = (label: string, control: React.ReactNode) => (
    <label className="flex flex-col gap-1 min-w-0">
      <span className={labelCls}>{label}</span>
      {control}
    </label>
  );

  return (
    <div className="flex flex-col gap-2 p-2.5 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)]">
      <div className="grid grid-cols-2 gap-2">
        {field('Name', (
          <input className={inputCls} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. High CPU" />
        ))}
        {field('Source', (
          <select className={inputCls} value={form.source} onChange={(e) => setSource(e.target.value as SourceKey)}>
            {(Object.keys(METRICS) as SourceKey[]).map((s) => (
              <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
            ))}
          </select>
        ))}
        {showHost && field('Host', (
          <select className={inputCls} value={form.host || ''} onChange={(e) => set({ host: e.target.value || undefined })}>
            <option value="">All hosts</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        ))}
        {field('Metric', (
          <select className={inputCls} value={form.metric} onChange={(e) => set({ metric: e.target.value })}>
            {metrics.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        ))}
        {field('Operator', (
          <select className={inputCls} value={form.operator} onChange={(e) => set({ operator: e.target.value as AlertRule['operator'] })}>
            {OPERATORS.map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        ))}
        {field('Threshold', (
          <input className={inputCls} type="number" step="any" value={form.threshold} onChange={(e) => set({ threshold: Number(e.target.value) })} />
        ))}
        {field('Severity', (
          <select className={inputCls} value={form.severity} onChange={(e) => set({ severity: e.target.value as Severity })}>
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        ))}
        {field('For (seconds)', (
          <input className={inputCls} type="number" min={0} value={form.forSeconds} onChange={(e) => set({ forSeconds: Number(e.target.value) })} />
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer">
        <input type="checkbox" checked={form.notify} onChange={(e) => set({ notify: e.target.checked })} className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-surface)]" />
        Push a notification when this alert fires
      </label>
      <div className="flex gap-2">
        <button onClick={onSave} className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 text-xs font-medium">
          Save
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
          Cancel
        </button>
      </div>
    </div>
  );
}
