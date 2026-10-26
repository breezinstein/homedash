import { useMemo, useState } from 'react';
import { Bell, Check, Edit2, Plus, Trash2, X } from 'lucide-react';
import type { AlertRule, RemoteServer, Severity } from '../../types';
import { newId } from '../../lib/id';
import { FormField, SwitchToggle } from './MonitorSettingsControls';

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
  certificate: 'TLS Certificate',
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
  certificate: [
    { value: 'cert.daysLeft', label: 'Days until expiry' },
    { value: 'cert.minDaysLeft', label: 'Most-expiring cert (days)' },
  ],
};

const OPERATORS = ['>', '>=', '<', '<=', '==', '!='] as const;

const SEVERITIES: { value: Severity; label: string; color: string; bg: string }[] = [
  {
    value: 'critical',
    label: 'Critical',
    color: 'var(--mon-danger)',
    bg: 'color-mix(in srgb, var(--mon-danger) 16%, transparent)',
  },
  {
    value: 'warning',
    label: 'Warning',
    color: 'var(--mon-warn)',
    bg: 'color-mix(in srgb, var(--mon-warn) 16%, transparent)',
  },
  {
    value: 'info',
    label: 'Info',
    color: 'var(--mon-accent)',
    bg: 'color-mix(in srgb, var(--mon-accent) 16%, transparent)',
  },
];

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

export function AlertsSection({
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
                    ? 'bg-[var(--mon-accent)] border-[var(--mon-accent)] text-white'
                    : 'bg-[var(--mon-surface-2)] border-[var(--mon-border)] text-[var(--mon-text-muted)] hover:text-[var(--mon-text-dim)]'
                }`}
              >
                <span className="capitalize">{sev}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-black/15' : 'bg-[var(--mon-surface-2)] text-[var(--mon-text-muted)]'
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
        <div className="p-8 text-center bg-[var(--mon-surface)] border border-[var(--mon-border)] rounded-xl text-[var(--mon-text-muted)] text-xs">
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
                    ? 'bg-[var(--mon-surface)] border-[var(--mon-border)] hover:border-[var(--mon-border)]'
                    : 'bg-[var(--mon-bg)] border-[var(--mon-border)] opacity-60'
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
                          rule.enabled ? 'text-[var(--mon-text)]' : 'text-[var(--mon-text-faint)] line-through'
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
                        <span className="text-[10px] text-[var(--mon-text-muted)] bg-[var(--mon-surface-2)] px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Bell className="w-2.5 h-2.5" /> Push
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--mon-text-muted)] mt-1 truncate">
                      <strong className="text-[var(--mon-text-dim)]">{SOURCE_LABELS[rule.source]}</strong> ·{' '}
                      {metricLabel}{' '}
                      <span className="font-mono text-[var(--mon-accent-hover)] font-bold">
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
      <div
        className="ms-submodal-dialog max-w-lg animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-rule-dialog-title"
      >
        <div className="ms-submodal-header">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[var(--mon-accent-hover)]" />
            <span id="alert-rule-dialog-title" className="text-sm font-bold text-[var(--mon-text)]">
              {isNew ? 'Create Alert Rule' : 'Edit Alert Rule'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--mon-text-muted)] hover:text-[var(--mon-text)] p-1"
            aria-label="Close"
          >
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

          <label className="flex items-center gap-2.5 p-3 rounded-lg bg-[var(--mon-surface-2)] border border-[var(--mon-border)] cursor-pointer text-xs text-[var(--mon-text-dim)]">
            <input
              type="checkbox"
              checked={form.notify}
              onChange={(e) => set({ notify: e.target.checked })}
              className="w-4 h-4 rounded bg-[var(--mon-panel)] border-[var(--mon-border)] text-[var(--mon-accent)] focus:ring-0"
            />
            <div>
              <span className="font-semibold text-[var(--mon-text-dim)]">Push Browser / Webhook Notifications</span>
              <p className="text-[11px] text-[var(--mon-text-faint)]">
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
