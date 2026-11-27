import { useState, type FormEvent } from 'react';
import { Lock, MoreHorizontal, Pencil, Plus, Server, Trash2 } from 'lucide-react';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@ui-sdk/react/menu';
import { Switch, SwitchThumb } from '@ui-sdk/react/switch';
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@ui-sdk/react/collapsible';
import { ChevronDown } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import type { RemoteServer } from '../../types';
import { Button, EmptyState, FieldRow, InlineAlert, Input, Modal, SwitchField, useConfirm, useToast } from '../ui';

interface ServerFormValues {
  name: string;
  url: string;
  username: string;
  password: string;
  monitor: boolean;
  dockerSocket: string;
  dockerUrl: string;
}

function ServerDialog({ initial, isNew, onSave, onClose }: { initial: ServerFormValues; isNew: boolean; onSave: (v: ServerFormValues) => void; onClose: () => void }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ServerFormValues>(k: K, v: ServerFormValues[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Give the server a name.');
    try {
      const u = new URL(form.url.trim());
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return setError('The URL needs to start with http:// or https://.');
    } catch {
      return setError('Enter the Glances address, for example http://10.1.2.17:61208.');
    }
    onSave({ ...form, name: form.name.trim(), url: form.url.trim() });
  };

  return (
    <Modal
      onClose={onClose}
      title={isNew ? 'Add server' : `Edit ${initial.name}`}
      description="A Glances web server. Server stats can show any of them; the monitor polls the ones switched on."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="server-form">{isNew ? 'Add server' : 'Save'}</Button>
        </>
      }
    >
      <form id="server-form" onSubmit={submit} className="space-y-4">
        <FieldRow label="Name">
          <Input value={form.name} onValueChange={(v) => set('name', v)} placeholder="nas-01" autoFocus />
        </FieldRow>
        <FieldRow label="Glances URL" description="Glances listens on port 61208 by default.">
          <Input value={form.url} onValueChange={(v) => set('url', v)} placeholder="http://10.1.2.17:61208" className="font-mono" spellCheck={false} />
        </FieldRow>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Username" description="Only if Glances asks for a login.">
            <Input value={form.username} onValueChange={(v) => set('username', v)} autoComplete="off" />
          </FieldRow>
          <FieldRow label="Password">
            <Input type="password" value={form.password} onValueChange={(v) => set('password', v)} autoComplete="new-password" />
          </FieldRow>
        </div>
        <SwitchField
          checked={form.monitor}
          onCheckedChange={(v) => set('monitor', v)}
          label="Show on the monitor"
          description="The monitor polls it in the background and checks its alert rules."
        />
        <Collapsible className="ui-panel-section" defaultOpen={!!(form.dockerSocket || form.dockerUrl)}>
          <CollapsibleTrigger className="ui-panel-section-head w-full justify-between text-left">
            Docker (optional)
            <span data-chevron className="text-[var(--color-text-secondary)]"><ChevronDown className="size-4" aria-hidden="true" /></span>
          </CollapsibleTrigger>
          <CollapsiblePanel className="space-y-3 p-3">
            <p className="text-xs text-[var(--color-text-secondary)]">Leave both empty to read containers through Glances.</p>
            <FieldRow label="Docker socket">
              <Input value={form.dockerSocket} onValueChange={(v) => set('dockerSocket', v)} placeholder="/var/run/docker.sock" className="font-mono" spellCheck={false} />
            </FieldRow>
            <FieldRow label="Docker URL">
              <Input value={form.dockerUrl} onValueChange={(v) => set('dockerUrl', v)} placeholder="tcp://10.1.2.17:2375" className="font-mono" spellCheck={false} />
            </FieldRow>
          </CollapsiblePanel>
        </Collapsible>
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
      </form>
    </Modal>
  );
}

const blank: ServerFormValues = { name: '', url: '', username: '', password: '', monitor: true, dockerSocket: '', dockerUrl: '' };

function toForm(s: RemoteServer): ServerFormValues {
  return {
    name: s.name,
    url: s.url,
    username: s.username ?? '',
    password: s.password ?? '',
    monitor: s.monitor === true,
    dockerSocket: s.dockerSocket ?? '',
    dockerUrl: s.dockerUrl ?? '',
  };
}

/** Settings → Sources → Servers: one list of Glances endpoints for Server stats and the monitor. */
export function ServersSection() {
  const { config, setConfig, servers, addServer, updateServer, deleteServer } = useDashboard();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<{ server: RemoteServer | null } | null>(null);
  const merge = config.metadata?.serverMerge;
  const showMerge = merge && !merge.dismissed && merge.merged + merge.added > 0;
  const polled = servers.filter((s) => s.monitor).length;

  const dismissMerge = () => {
    if (!merge) return;
    setConfig({ ...config, metadata: { ...config.metadata, serverMerge: { ...merge, dismissed: true } } });
  };

  const remove = async (s: RemoteServer) => {
    const ok = await confirm({
      title: `Remove ${s.name}?`,
      message: s.monitor ? 'It leaves Server stats and the monitor stops polling it.' : 'It leaves the Server stats list.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    deleteServer(s.id);
    toast.success(`Removed ${s.name}`);
  };

  return (
    <div className="space-y-4">
      {showMerge && (
        <InlineAlert
          tone={merge.conflicts.length ? 'warning' : 'info'}
          title="Remote servers and monitor hosts are now one list"
          actions={<Button size="sm" variant="ghost" onClick={dismissMerge}>Dismiss</Button>}
        >
          {merge.merged > 0 ? `${merge.merged} matched by URL and were combined. ` : ''}
          {merge.added > 0 ? `${merge.added} monitor-only hosts were added. ` : ''}
          {merge.conflicts.length > 0
            ? `${merge.conflicts.join(', ')} had different logins in the two lists, so the monitor's login was kept. Check Server stats still reads ${merge.conflicts.length === 1 ? 'it' : 'them'}.`
            : 'A backup of the old layout was saved first.'}
        </InlineAlert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {servers.length} {servers.length === 1 ? 'server' : 'servers'} · {polled} on the monitor
        </p>
        <Button size="sm" variant="primary" className="ml-auto" onClick={() => setEditing({ server: null })}>
          <Plus className="size-3.5" aria-hidden="true" /> Add server
        </Button>
      </div>

      <ul className="ui-panel-section">
        <li className="ui-row">
          <span className="ui-row-icon"><Server className="size-4" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <span className="block truncate font-medium">This host</span>
            <p className="ui-row-dim">Read directly by Server stats. Add it below to put it on the monitor.</p>
          </div>
          <span className="ui-chip" data-tone="success">Always on</span>
        </li>
        {servers.map((s) => (
          <li key={s.id} className="ui-row">
            <Switch
              className="ui-switch"
              checked={s.monitor === true}
              onCheckedChange={(v) => updateServer(s.id, { monitor: v })}
              aria-label={`Show ${s.name} on the monitor`}
            >
              <SwitchThumb />
            </Switch>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-medium">{s.name}</span>
                {s.username ? <Lock className="size-3 shrink-0 text-[var(--color-text-secondary)]" aria-label="Uses a login" /> : null}
                {s.monitor ? <span className="ui-chip" data-tone="info">Monitor</span> : <span className="ui-chip">Server stats only</span>}
              </div>
              <p className="ui-row-dim truncate font-mono">{s.url}{s.dockerSocket || s.dockerUrl ? ` · Docker ${s.dockerSocket || s.dockerUrl}` : ''}</p>
            </div>
            <Menu>
              <MenuTrigger className="ui-btn" data-variant="ghost" data-size="icon" aria-label={`Actions for ${s.name}`}>
                <MoreHorizontal className="size-4" />
              </MenuTrigger>
              <MenuContent className="ui-popup" align="end">
                <MenuItem value="edit" className="ui-menu-item" onClick={() => setEditing({ server: s })}>
                  <Pencil className="size-3.5" aria-hidden="true" /> Edit
                </MenuItem>
                <MenuSeparator className="ui-menu-separator" />
                <MenuItem value="delete" className="ui-menu-item" data-tone="danger" onClick={() => { void remove(s); }}>
                  <Trash2 className="size-3.5" aria-hidden="true" /> Remove
                </MenuItem>
              </MenuContent>
            </Menu>
          </li>
        ))}
      </ul>
      {servers.length === 0 && <EmptyState icon={Server} title="No other servers yet" description="Add a Glances endpoint to see it in Server stats or on the monitor." compact />}

      {editing && (
        <ServerDialog
          isNew={!editing.server}
          initial={editing.server ? toForm(editing.server) : blank}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            if (editing.server) {
              updateServer(editing.server.id, v);
              toast.success(`Saved ${v.name}`);
            } else {
              addServer(v.name, v.url, v.username, v.password, { monitor: v.monitor, dockerSocket: v.dockerSocket, dockerUrl: v.dockerUrl });
              toast.success(`Added ${v.name}`);
            }
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
