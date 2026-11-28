import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from '@ui-sdk/react/segmented-control';
import { Button, CheckboxField, FieldRow, IconButton, Input, Modal } from '../../ui';

/** Every field a monitored source can have; each kind shows the ones it uses. */
export interface EntityForm {
  id?: string;
  name?: string;
  url?: string;
  host?: string;
  port?: number;
  type?: string;
  apiKey?: string;
  apiSecret?: string;
  token?: string;
  username?: string;
  password?: string;
  ifid?: number;
  insecureTls?: boolean;
}

export type EntityKind = 'media' | 'usenet' | 'arr' | 'seerr' | 'opnsense' | 'ntopng' | 'homeassistant' | 'certificates';

interface KindSpec {
  noun: string;
  types?: { value: string; label: string }[];
  urlPlaceholder?: string;
  apiKey?: string;
  apiKeyHint?: string;
  login?: boolean;
  secret?: boolean;
  token?: boolean;
  ifid?: boolean;
  tls?: boolean;
  hostPort?: boolean;
}

export const KINDS: Record<EntityKind, KindSpec> = {
  media: {
    noun: 'media server',
    types: [{ value: 'jellyfin', label: 'Jellyfin' }, { value: 'emby', label: 'Emby' }],
    urlPlaceholder: 'http://192.168.1.50:8096',
    apiKey: 'API key',
    apiKeyHint: 'In Jellyfin or Emby: Dashboard → Advanced → API Keys.',
  },
  usenet: {
    noun: 'downloader',
    types: [{ value: 'sabnzbd', label: 'SABnzbd' }, { value: 'nzbget', label: 'NZBGet' }],
    urlPlaceholder: 'http://192.168.1.50:8080',
    apiKey: 'API key',
    apiKeyHint: 'SABnzbd uses the API key. NZBGet uses the login below.',
    login: true,
  },
  arr: {
    noun: 'Sonarr or Radarr',
    types: [{ value: 'sonarr', label: 'Sonarr' }, { value: 'radarr', label: 'Radarr' }],
    urlPlaceholder: 'http://192.168.1.50:8989',
    apiKey: 'API key',
    apiKeyHint: 'Settings → General → Security → API Key.',
  },
  seerr: {
    noun: 'request service',
    types: [{ value: 'overseerr', label: 'Overseerr' }, { value: 'jellyseerr', label: 'Jellyseerr' }, { value: 'seerr', label: 'Seerr' }],
    urlPlaceholder: 'http://192.168.1.50:5055',
    apiKey: 'API key',
    apiKeyHint: 'Settings → General → API Key.',
  },
  opnsense: {
    noun: 'OPNsense firewall',
    urlPlaceholder: 'https://192.168.1.1',
    apiKey: 'API key',
    apiKeyHint: 'System → Access → Users → API keys.',
    secret: true,
    tls: true,
  },
  ntopng: {
    noun: 'ntopng',
    urlPlaceholder: 'http://192.168.1.40:3000',
    login: true,
    ifid: true,
    tls: true,
  },
  homeassistant: {
    noun: 'Home Assistant',
    urlPlaceholder: 'http://homeassistant.local:8123',
    token: true,
    tls: true,
  },
  certificates: {
    noun: 'certificate',
    hostPort: true,
  },
};

function Secret({ label, value, onChange, hint, placeholder }: { label: string; value: string; onChange: (v: string) => void; hint?: string; placeholder?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <FieldRow label={label} description={hint}>
      <div className="ui-input-group">
        <Input
          type={shown ? 'text' : 'password'}
          value={value}
          onValueChange={onChange}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
        />
        <IconButton label={shown ? 'Hide' : 'Show'} onClick={() => setShown(!shown)}>
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </IconButton>
      </div>
    </FieldRow>
  );
}

function validUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Add or edit one monitored source. Changes land in the monitor draft, which saves with the section. */
export function EntityDialog({
  kind,
  initial,
  isNew,
  onSave,
  onClose,
}: {
  kind: EntityKind;
  initial: EntityForm;
  isNew: boolean;
  onSave: (form: EntityForm) => void;
  onClose: () => void;
}) {
  const spec = KINDS[kind];
  const [form, setForm] = useState<EntityForm>({ ...(spec.types ? { type: spec.types[0].value } : {}), ...initial });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof EntityForm>(key: K, value: EntityForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return setError('Give it a name so you can tell it apart.');
    if (spec.hostPort) {
      if (!form.host?.trim()) return setError('Enter the host name or IP address.');
    } else if (!form.url?.trim() || !validUrl(form.url)) {
      return setError('Enter a URL that starts with http:// or https://.');
    }
    onSave({ ...form, name: form.name.trim(), url: form.url?.trim(), host: form.host?.trim() });
  };

  return (
    <Modal
      onClose={onClose}
      title={`${isNew ? 'Add' : 'Edit'} ${spec.noun}`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="entity-form">{isNew ? 'Add' : 'Done'}</Button>
        </>
      }
    >
      <form id="entity-form" onSubmit={submit} className="space-y-4">
        {spec.types && (
          <FieldRow label="Type">
            <SegmentedControl
              className="ui-seg justify-self-start"
              aria-label="Type"
              value={form.type}
              onValueChange={(v) => { if (v) set('type', v); }}
            >
              <SegmentedControlIndicator />
              {spec.types.map((t) => (
                <SegmentedControlItem key={t.value} value={t.value} className="ui-seg-item">{t.label}</SegmentedControlItem>
              ))}
            </SegmentedControl>
          </FieldRow>
        )}
        <FieldRow label="Name">
          <Input value={form.name ?? ''} onValueChange={(v) => set('name', v)} placeholder="e.g. living-room" autoFocus />
        </FieldRow>
        {spec.hostPort ? (
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <FieldRow label="Host" description="Name or IP address the certificate is served from.">
              <Input value={form.host ?? ''} onValueChange={(v) => set('host', v)} placeholder="opnsense.lan" className="font-mono" spellCheck={false} />
            </FieldRow>
            <FieldRow label="Port">
              <Input
                inputMode="numeric"
                value={form.port != null ? String(form.port) : ''}
                onValueChange={(v) => set('port', v.trim() ? Number(v.replace(/\D/g, '')) || 443 : undefined)}
                placeholder="443"
                className="font-mono"
              />
            </FieldRow>
          </div>
        ) : (
          <FieldRow label="URL">
            <Input value={form.url ?? ''} onValueChange={(v) => set('url', v)} placeholder={spec.urlPlaceholder} className="font-mono" spellCheck={false} />
          </FieldRow>
        )}
        {spec.apiKey && (
          <Secret label={spec.apiKey} value={form.apiKey ?? ''} onChange={(v) => set('apiKey', v)} hint={spec.apiKeyHint} placeholder="Paste the key" />
        )}
        {spec.secret && <Secret label="API secret" value={form.apiSecret ?? ''} onChange={(v) => set('apiSecret', v)} />}
        {spec.token && (
          <Secret
            label="Long-lived access token"
            value={form.token ?? ''}
            onChange={(v) => set('token', v)}
            hint="In Home Assistant: your profile → Security → Long-lived access tokens."
          />
        )}
        {spec.login && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Username" description="Only if it asks for a login.">
              <Input value={form.username ?? ''} onValueChange={(v) => set('username', v)} autoComplete="off" />
            </FieldRow>
            <Secret label="Password" value={form.password ?? ''} onChange={(v) => set('password', v)} />
          </div>
        )}
        {spec.ifid && (
          <FieldRow label="Interface ID" description="0 is ntopng's default interface.">
            <Input
              inputMode="numeric"
              value={form.ifid != null ? String(form.ifid) : ''}
              onValueChange={(v) => set('ifid', v.trim() === '' ? undefined : Number(v.replace(/\D/g, '')))}
              placeholder="0"
              className="w-24 font-mono"
            />
          </FieldRow>
        )}
        {spec.tls && (
          <CheckboxField
            checked={form.insecureTls === true}
            onCheckedChange={(v) => set('insecureTls', v)}
            label="Accept a self-signed certificate (skips HTTPS verification)"
          />
        )}
        {error ? <p className="ui-error" role="alert">{error}</p> : null}
      </form>
    </Modal>
  );
}
