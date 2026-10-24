import { useState } from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import type { EntityFormValues, EntityModalSection } from './monitorSettingsTypes';
import { FormField, TypePicker } from './MonitorSettingsControls';

interface EntityModalDialogProps {
  section: EntityModalSection;
  item: EntityFormValues;
  isNew: boolean;
  onSave: (form: EntityFormValues, isNew: boolean) => void;
  onClose: () => void;
}

export function EntityModalDialog({
  section,
  item,
  isNew,
  onSave,
  onClose,
}: EntityModalDialogProps) {
  const [form, setForm] = useState<EntityFormValues>({ ...item });
  const [showPassword, setShowPassword] = useState(false);

  const setField = <K extends keyof EntityFormValues>(key: K, val: EntityFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const getTitle = () => {
    const action = isNew ? 'Add' : 'Edit';
    switch (section) {
      case 'media':
        return `${action} Media Server`;
      case 'usenet':
        return `${action} Usenet Downloader`;
      case 'arr':
        return `${action} Sonarr / Radarr`;
      case 'seerr':
        return `${action} Seerr Instance`;
      case 'network':
        return form._type === 'opnsense' ? `${action} OPNsense Firewall` : `${action} ntopng Analyser`;
      case 'home':
        return `${action} Home Assistant`;
      case 'certs':
        return `${action} TLS Certificate`;
      default:
        return `${action} Service`;
    }
  };

  return (
    <div className="ms-submodal-overlay">
      <div
        className="ms-submodal-dialog animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="monitor-entity-dialog-title"
      >
        {/* Header */}
        <div className="ms-submodal-header">
          <div className="flex items-center gap-2">
            <span id="monitor-entity-dialog-title" className="text-sm font-bold text-[var(--mon-text)]">{getTitle()}</span>
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

        {/* Form Body */}
        <div className="ms-submodal-body">
          {/* Section-specific Type Pickers */}
          {section === 'media' && (
            <TypePicker
              label="Service Type"
              value={form.type || 'jellyfin'}
              options={[
                { value: 'jellyfin', label: 'Jellyfin', color: '#a855f7' },
                { value: 'emby', label: 'Emby', color: 'var(--mon-ok)' },
              ]}
              onChange={(v) => setField('type', v)}
            />
          )}

          {section === 'usenet' && (
            <TypePicker
              label="Downloader Type"
              value={form.type || 'sabnzbd'}
              options={[
                { value: 'sabnzbd', label: 'SABnzbd', color: 'var(--mon-warn)' },
                { value: 'nzbget', label: 'NZBGet', color: '#3b82f6' },
              ]}
              onChange={(v) => setField('type', v)}
            />
          )}

          {section === 'arr' && (
            <TypePicker
              label="Application Type"
              value={form.type || 'sonarr'}
              options={[
                { value: 'sonarr', label: 'Sonarr (TV Shows)', color: '#38bdf8' },
                { value: 'radarr', label: 'Radarr (Movies)', color: '#fb923c' },
              ]}
              onChange={(v) => setField('type', v)}
            />
          )}

          {section === 'seerr' && (
            <TypePicker
              label="Seerr Variant"
              value={form.type || 'overseerr'}
              options={[
                { value: 'overseerr', label: 'Overseerr', color: '#f97316' },
                { value: 'jellyseerr', label: 'Jellyseerr', color: '#a855f7' },
                { value: 'seerr', label: 'Seerr', color: '#3b82f6' },
              ]}
              onChange={(v) => setField('type', v)}
            />
          )}

          {/* Standard Fields */}
          <FormField label="Friendly Name / Label">
            <input
              type="text"
              className="ms-input"
              placeholder="e.g. main-instance"
              value={form.name ?? ''}
              onChange={(e) => setField('name', e.target.value)}
            />
          </FormField>

          {section === 'certs' ? (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <FormField label="Hostname / IP">
                <input
                  type="text"
                  className="ms-input font-mono text-xs"
                  placeholder="opnsense.lan"
                  value={form.host ?? ''}
                  onChange={(e) => setField('host', e.target.value)}
                />
              </FormField>
              <FormField label="Port">
                <input
                  type="number"
                  className="ms-input font-mono text-xs"
                  placeholder="443"
                  value={form.port ?? ''}
                  onChange={(e) => setField('port', e.target.value ? Number(e.target.value) : 443)}
                />
              </FormField>
            </div>
          ) : (
            <FormField label="Endpoint URL">
              <input
                type="text"
                className="ms-input font-mono text-xs"
                placeholder="http://192.168.1.50:8096"
                value={form.url ?? ''}
                onChange={(e) => setField('url', e.target.value)}
              />
            </FormField>
          )}

          {/* Media / Arr / Seerr API Key */}
          {(section === 'media' || section === 'arr' || section === 'seerr' || (section === 'usenet' && form.type === 'sabnzbd')) && (
            <FormField
              label={section === 'usenet' ? 'API Key (or use Basic Auth below)' : 'API Key'}
              helpText={
                section === 'arr'
                  ? 'Found under Settings → General → Security → API Key'
                  : section === 'media'
                  ? 'Found in Jellyfin/Emby Dashboard → Advanced → API Keys'
                  : undefined
              }
            >
              <div className="ms-input-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="ms-input font-mono text-xs"
                  placeholder="Paste API Key here…"
                  value={form.apiKey ?? ''}
                  onChange={(e) => setField('apiKey', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="ms-input-action-btn"
                  title={showPassword ? 'Hide value' : 'Show value'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </FormField>
          )}

          {/* Usenet / ntopng Basic Auth */}
          {(section === 'usenet' || (section === 'network' && form._type === 'ntopng')) && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <FormField label="Username (Optional)">
                <input
                  type="text"
                  className="ms-input"
                  placeholder="admin"
                  value={form.username ?? ''}
                  onChange={(e) => setField('username', e.target.value)}
                />
              </FormField>

              <FormField label="Password / Token">
                <div className="ms-input-password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="ms-input"
                    placeholder="••••••••"
                    value={form.password ?? ''}
                    onChange={(e) => setField('password', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="ms-input-action-btn"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FormField>
            </div>
          )}

          {/* OPNsense API Key & Secret */}
          {section === 'network' && form._type === 'opnsense' && (
            <>
              <FormField label="API Key">
                <input
                  type="text"
                  className="ms-input font-mono text-xs"
                  placeholder="OPNsense API Key"
                  value={form.apiKey ?? ''}
                  onChange={(e) => setField('apiKey', e.target.value)}
                />
              </FormField>

              <FormField label="API Secret">
                <div className="ms-input-password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="ms-input font-mono text-xs"
                    placeholder="OPNsense API Secret"
                    value={form.apiSecret ?? ''}
                    onChange={(e) => setField('apiSecret', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="ms-input-action-btn"
                    title={showPassword ? 'Hide secret' : 'Show secret'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FormField>
            </>
          )}

          {/* ntopng Interface ID */}
          {section === 'network' && form._type === 'ntopng' && (
            <FormField label="Interface ID (Optional, 0 = default)">
              <input
                type="number"
                className="ms-input font-mono text-xs"
                placeholder="0"
                value={form.ifid ?? ''}
                onChange={(e) => setField('ifid', e.target.value ? Number(e.target.value) : undefined)}
              />
            </FormField>
          )}

          {/* Home Assistant Long-Lived Access Token */}
          {section === 'home' && (
            <FormField
              label="Long-Lived Access Token"
              helpText="Generate under Home Assistant → Profile → Security → Long-Lived Access Tokens"
            >
              <div className="ms-input-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="ms-input font-mono text-xs"
                  placeholder="Bearer token…"
                  value={form.token ?? ''}
                  onChange={(e) => setField('token', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="ms-input-action-btn"
                  title={showPassword ? 'Hide token' : 'Show token'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </FormField>
          )}

          {/* TLS Insecure Checkbox */}
          {(section === 'network' || section === 'home') && (
            <label className="flex items-center gap-2.5 p-3 rounded-lg bg-[var(--mon-surface-2)] border border-[var(--mon-border)] cursor-pointer text-xs text-[var(--mon-text-dim)]">
              <input
                type="checkbox"
                checked={form.insecureTls === true}
                onChange={(e) => setField('insecureTls', e.target.checked)}
                className="w-4 h-4 rounded bg-[var(--mon-panel)] border-[var(--mon-border)] text-indigo-600 focus:ring-0"
              />
              <div>
                <span className="font-semibold text-[var(--mon-text-dim)]">Allow Self-Signed TLS Certificates</span>
                <p className="text-[11px] text-[var(--mon-text-faint)]">
                  Bypasses TLS verification if using a local HTTPS certificate.
                </p>
              </div>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="ms-submodal-footer">
          <button type="button" onClick={onClose} className="ms-btn ms-btn-ghost text-xs">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(form, isNew)}
            disabled={
              !form.name?.trim() ||
              (section === 'certs' ? !form.host?.trim() : !form.url?.trim())
            }
            className="ms-btn ms-btn-primary text-xs"
          >
            <Check className="w-3.5 h-3.5" />
            {isNew ? 'Add Source' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
