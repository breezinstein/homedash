import { useState } from 'react';
import { Lock, Pencil, Plus, Server, Trash2 } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import { Button } from '../ui/Button';
import { FieldRow, Input } from '../ui/Field';
import { useConfirm, useToast } from '../ui';

function ServerForm({
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
      return setError('Enter a valid URL, e.g. http://10.1.2.17:61208');
    }
    onSubmit(name.trim(), trimmedUrl, username.trim(), password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--surface-sunken)] p-4">
      <FieldRow label="Name">
        <Input value={name} onValueChange={setName} placeholder="Media server" autoFocus required />
      </FieldRow>
      <FieldRow
        label="Glances URL"
        description="Base URL of a Glances instance (port 61208). Its REST API supplies CPU, memory, disk and containers."
      >
        <Input value={url} onValueChange={setUrl} placeholder="http://10.1.2.17:61208" required />
      </FieldRow>
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldRow label="Username" description="Only if the endpoint is protected.">
          <Input value={username} onValueChange={setUsername} placeholder="glances" autoComplete="off" />
        </FieldRow>
        <FieldRow label="Password">
          <Input value={password} onValueChange={setPassword} type="password" placeholder="••••••••" autoComplete="new-password" />
        </FieldRow>
      </div>
      {error ? <p className="text-xs text-[var(--color-error)]">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm">
          {initial ? 'Save' : 'Add server'}
        </Button>
      </div>
    </form>
  );
}

/** Settings → Remote servers: the Glances endpoints the stats view can read. */
export function RemoteServersSection() {
  const { servers, addServer, updateServer, deleteServer } = useDashboard();
  const confirm = useConfirm();
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Remove server',
      message: `"${name}" will be removed from the server stats list.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    deleteServer(id);
    toast.success(`Removed ${name}`);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Endpoints the <strong className="text-[var(--color-text-primary)]">Server stats</strong> view can read,
        alongside this host. Each one is a Glances web server.
      </p>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--surface-sunken)] px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Server className="size-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">This host</p>
              <p className="truncate text-xs text-[var(--color-text-secondary)]">Read locally, no configuration needed</p>
            </div>
          </div>
          <span className="ui-chip" data-tone="success">Always on</span>
        </div>

        {servers.map((server) =>
          editingId === server.id ? (
            <ServerForm
              key={server.id}
              initial={server}
              onSubmit={(name, url, username, password) => {
                updateServer(server.id, { name, url, username, password });
                setEditingId(null);
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              key={server.id}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--surface-sunken)] px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">{server.name}</p>
                  {server.username ? (
                    <Lock className="size-3 shrink-0 text-[var(--color-text-secondary)]" aria-label="Password protected" />
                  ) : null}
                </div>
                <p className="truncate text-xs text-[var(--color-text-secondary)]">{server.url}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => { setEditingId(server.id); setAdding(false); }} aria-label={`Edit ${server.name}`}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { void handleDelete(server.id, server.name); }} aria-label={`Remove ${server.name}`}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ),
        )}
      </div>

      {adding ? (
        <ServerForm
          onSubmit={(name, url, username, password) => {
            addServer(name, url, username, password);
            setAdding(false);
            toast.success(`Added ${name}`);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" /> Add server
        </Button>
      )}
    </div>
  );
}
