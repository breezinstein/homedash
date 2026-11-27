import { useState } from 'react';
import { Pencil, Plus, Sun, Trash2 } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import { Button } from '@ui-sdk/react/button';
import { Field, FieldDescription, FieldLabel } from '@ui-sdk/react/field';
import { Input } from '@ui-sdk/react/input';
import { useConfirm, useToast } from '../ui';

function InverterForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: { name: string; url: string; username?: string; password?: string };
  onSubmit: (name: string, url: string, username: string, password: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [username, setUsername] = useState(initial?.username ?? '');
  const [password, setPassword] = useState(initial?.password ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!name.trim()) return setError('Name is required.');
    if (!trimmedUrl) return setError('URL is required.');
    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return setError('URL must start with http:// or https://');
      }
    } catch {
      return setError('Enter a valid URL, e.g. http://10.1.2.14');
    }
    onSubmit(name.trim(), trimmedUrl, username.trim(), password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--surface-sunken)] p-4">
      <Field className="ui-field">
        <FieldLabel className="ui-label">Name</FieldLabel>
        <Input className="ui-input" value={name} onValueChange={setName} placeholder="Home inverter" autoFocus required />
      </Field>
      <Field className="ui-field">
        <FieldLabel className="ui-label">Solar Assistant URL</FieldLabel>
        <Input className="ui-input" value={url} onValueChange={setUrl} placeholder="http://10.1.2.14" required />
        <FieldDescription className="ui-description">Base URL of the device. Its /api/v1/metrics endpoint is read for live PV, load, grid and battery data.</FieldDescription>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field className="ui-field">
        <FieldLabel className="ui-label">Username</FieldLabel>
        <Input className="ui-input" value={username} onValueChange={setUsername} placeholder="admin" autoComplete="off" />
      </Field>
        <Field className="ui-field">
        <FieldLabel className="ui-label">Password</FieldLabel>
        <Input className="ui-input" value={password} onValueChange={setPassword} type="password" placeholder="••••••••" autoComplete="new-password" />
      </Field>
      </div>
      {error ? <p className="text-xs text-[var(--color-error)]">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" className="ui-btn" data-variant="ghost" data-size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="ui-btn" data-variant="primary" data-size="sm">
          {initial ? 'Save' : 'Add inverter'}
        </Button>
      </div>
    </form>
  );
}

/** Settings → Inverters: the Solar Assistant devices the inverter view reads. */
export function InvertersSection() {
  const { inverters, addInverter, updateInverter, deleteInverter } = useDashboard();
  const confirm = useConfirm();
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Remove inverter',
      message: `"${name}" will be removed from the inverter view.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    deleteInverter(id);
    toast.success(`Removed ${name}`);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Solar Assistant devices shown in the <strong className="text-[var(--color-text-primary)]">Inverter</strong> view.
      </p>

      <div className="space-y-2">
        {inverters.length === 0 && !adding && (
          <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-3 py-6 text-center text-sm text-[var(--color-text-secondary)]">
            No inverters yet. Add the Solar Assistant URL to see live PV, load, grid and battery data.
          </p>
        )}

        {inverters.map((inverter) =>
          editingId === inverter.id ? (
            <InverterForm
              key={inverter.id}
              initial={inverter}
              onSubmit={(name, url, username, password) => {
                updateInverter(inverter.id, { name, url, username, password });
                setEditingId(null);
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              key={inverter.id}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--surface-sunken)] px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Sun className="size-4 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">{inverter.name}</p>
                  <p className="truncate text-xs text-[var(--color-text-secondary)]">{inverter.url}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button className="ui-btn" data-variant="ghost" data-size="sm" onClick={() => { setEditingId(inverter.id); setAdding(false); }} aria-label={`Edit ${inverter.name}`}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button className="ui-btn" data-variant="ghost" data-size="sm" onClick={() => { void handleDelete(inverter.id, inverter.name); }} aria-label={`Remove ${inverter.name}`}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ),
        )}
      </div>

      {adding ? (
        <InverterForm
          onSubmit={(name, url, username, password) => {
            addInverter(name, url, username, password);
            setAdding(false);
            toast.success(`Added ${name}`);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button className="ui-btn" data-variant="secondary" data-size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" /> Add inverter
        </Button>
      )}
    </div>
  );
}
