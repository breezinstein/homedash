import { useState } from 'react';
import { ChevronDown, Eye, EyeOff, Plug, X } from 'lucide-react';
import { Button } from '@ui-sdk/react/button';
import { Field, FieldLabel } from '@ui-sdk/react/field';
import { Input } from '@ui-sdk/react/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui-sdk/react/select';
import { Switch, SwitchThumb } from '@ui-sdk/react/switch';
import { useDashboard } from '../../context/DashboardContext';
import { useToast } from '../ui';
import type { NotificationBackfill, NotificationsConfig } from '../../types';
import { NtfyAuthError, testNotificationConnection } from '../../api/notificationsApi';

const DEFAULTS: NotificationsConfig = {
  enabled: false,
  serverUrl: '',
  topics: [],
  backfill: '12h',
  maxHistory: 200,
  browserNotifications: false,
};

const BACKFILL_OPTIONS: { value: NotificationBackfill; label: string }[] = [
  { value: '1h', label: 'Last 1 hour' },
  { value: '6h', label: 'Last 6 hours' },
  { value: '12h', label: 'Last 12 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: 'all', label: 'All available' },
];

const TOPIC_RE = /^[a-zA-Z0-9_-]+$/;

export function NotificationsSettings() {
  const { config, setConfig } = useDashboard();
  const toast = useToast();
  const current = config.notifications ?? DEFAULTS;

  const [topicDraft, setTopicDraft] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);

  const patch = (changes: Partial<NotificationsConfig>) => {
    setConfig({ ...config, notifications: { ...current, ...changes } });
  };

  const addTopic = () => {
    const value = topicDraft.trim();
    if (!value) return;
    if (!TOPIC_RE.test(value)) {
      toast.error('Topics may only contain letters, numbers, _ and -');
      return;
    }
    if (current.topics.includes(value)) {
      setTopicDraft('');
      return;
    }
    patch({ topics: [...current.topics, value] });
    setTopicDraft('');
  };

  const removeTopic = (topic: string) => {
    patch({ topics: current.topics.filter((t) => t !== topic) });
  };

  const handleTopicKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTopic();
    }
  };

  const handleTest = async () => {
    if (!current.serverUrl || current.topics.length === 0) {
      toast.error('Set a server URL and at least one topic first');
      return;
    }
    setTesting(true);
    try {
      await testNotificationConnection({
        serverUrl: current.serverUrl,
        topics: current.topics,
        auth: current.username
          ? { username: current.username, password: current.password ?? '' }
          : undefined,
      });
      toast.success('Connection successful');
    } catch (err) {
      if (err instanceof NtfyAuthError) {
        toast.error('Authentication failed — check username and password');
      } else {
        toast.error('Could not reach the ntfy server');
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--color-text-secondary)] sm:text-sm">
        Subscribe to a self-hosted ntfy server to receive notifications from your services.
      </p>

      {/* Enable toggle */}
      <div className="ui-panel-section">
        <div className="ui-row justify-between">
          <span>Enable notifications</span>
          <Switch
            className="ui-switch"
            checked={current.enabled}
            onCheckedChange={(next) => patch({ enabled: next })}
            aria-label="Enable notifications"
          >
            <SwitchThumb />
          </Switch>
        </div>
      </div>

      {/* Server URL */}
      <Field className="ui-field">
        <FieldLabel className="ui-label">Server URL</FieldLabel>
        <Input
          className="ui-input"
          type="url"
          value={current.serverUrl}
          onValueChange={(value) => patch({ serverUrl: value })}
          placeholder="https://ntfy.sh"
        />
      </Field>

      {/* Topics */}
      <Field className="ui-field">
        <FieldLabel className="ui-label">Topics</FieldLabel>
        {current.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {current.topics.map((topic) => (
              <span key={topic} className="ui-chip">
                {topic}
                <Button
                  type="button"
                  className="ui-btn"
                  data-variant="ghost"
                  data-size="icon"
                  style={{ width: 16, height: 16 }}
                  onClick={() => removeTopic(topic)}
                  aria-label={`Remove ${topic}`}
                >
                  <X className="size-3" aria-hidden="true" />
                </Button>
              </span>
            ))}
          </div>
        )}
        <Input
          className="ui-input"
          type="text"
          value={topicDraft}
          onValueChange={setTopicDraft}
          onKeyDown={handleTopicKeyDown}
          onBlur={addTopic}
          placeholder="Type a topic and press Enter"
        />
      </Field>

      {/* Auth */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field className="ui-field">
          <FieldLabel className="ui-label">Username (optional)</FieldLabel>
          <Input
            className="ui-input"
            type="text"
            autoComplete="off"
            value={current.username ?? ''}
            onValueChange={(value) => patch({ username: value || undefined })}
          />
        </Field>
        <Field className="ui-field">
          <FieldLabel className="ui-label">Password (optional)</FieldLabel>
          <div className="relative">
            <Input
              className="ui-input"
              style={{ paddingRight: 40 }}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={current.password ?? ''}
              onValueChange={(value) => patch({ password: value || undefined })}
            />
            <Button
              type="button"
              className="ui-btn"
              data-variant="ghost"
              data-size="icon"
              style={{ position: 'absolute', right: 4, top: '50%', translate: '0 -50%', width: 26, height: 26 }}
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </Field>
      </div>

      {/* Backfill + max history */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field className="ui-field">
          <FieldLabel className="ui-label">History on connect</FieldLabel>
          <Select
            value={current.backfill}
            onValueChange={(next) => {
              if (next) patch({ backfill: next });
            }}
            items={BACKFILL_OPTIONS}
          >
            <SelectTrigger className="ui-select-trigger" aria-label="History on connect">
              <SelectValue />
              <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
            </SelectTrigger>
            <SelectContent className="ui-popup">
              {BACKFILL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="ui-menu-item">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field className="ui-field">
          <FieldLabel className="ui-label">Max history ({current.maxHistory})</FieldLabel>
          <Input
            className="ui-input"
            type="number"
            min={20}
            max={1000}
            value={String(current.maxHistory)}
            onValueChange={(next) => {
              const n = Number(next);
              patch({ maxHistory: Number.isFinite(n) ? Math.min(1000, Math.max(20, n)) : 200 });
            }}
          />
        </Field>
      </div>

      {/* Browser notifications */}
      <div className="ui-panel-section">
        <div className="ui-row justify-between">
          <div className="min-w-0">
            <div>Desktop notifications</div>
            <div className="ui-row-dim">
              Shows a system notification when the tab is in the background. Requires browser permission.
            </div>
          </div>
          <Switch
            className="ui-switch"
            checked={current.browserNotifications}
            onCheckedChange={(next) => patch({ browserNotifications: next })}
            aria-label="Desktop notifications"
          >
            <SwitchThumb />
          </Switch>
        </div>
      </div>

      {/* Test connection */}
      <Button
        className="ui-btn"
        data-variant="primary"
        onClick={handleTest}
        disabled={testing}
      >
        <Plug className="size-4" aria-hidden="true" />
        {testing ? 'Testing…' : 'Test connection'}
      </Button>
    </div>
  );
}
