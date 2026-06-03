import { useState } from 'react';
import { X, Eye, EyeOff, Plug } from 'lucide-react';
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
      <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
        Subscribe to a self-hosted ntfy server to receive notifications from your services.
      </p>

      {/* Enable toggle */}
      <label className="flex items-center justify-between p-3 bg-[var(--color-background)] rounded-xl border border-[var(--color-border)]">
        <span className="text-sm text-[var(--color-text-primary)]">Enable notifications</span>
        <input
          type="checkbox"
          checked={current.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
          className="w-4 h-4 accent-[var(--color-primary)]"
        />
      </label>

      {/* Server URL */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
          Server URL
        </label>
        <input
          type="url"
          value={current.serverUrl}
          onChange={(e) => patch({ serverUrl: e.target.value })}
          placeholder="https://ntfy.sh"
          className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
        />
      </div>

      {/* Topics */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
          Topics
        </label>
        {current.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {current.topics.map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-primary)]"
              >
                {topic}
                <button
                  onClick={() => removeTopic(topic)}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-error)]"
                  aria-label={`Remove ${topic}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          type="text"
          value={topicDraft}
          onChange={(e) => setTopicDraft(e.target.value)}
          onKeyDown={handleTopicKeyDown}
          onBlur={addTopic}
          placeholder="Type a topic and press Enter"
          className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
        />
      </div>

      {/* Auth */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Username (optional)
          </label>
          <input
            type="text"
            autoComplete="off"
            value={current.username ?? ''}
            onChange={(e) => patch({ username: e.target.value || undefined })}
            className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Password (optional)
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={current.password ?? ''}
              onChange={(e) => patch({ password: e.target.value || undefined })}
              className="w-full px-3 py-2 pr-10 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Backfill + max history */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            History on connect
          </label>
          <select
            value={current.backfill}
            onChange={(e) => patch({ backfill: e.target.value as NotificationBackfill })}
            className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          >
            {BACKFILL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Max history ({current.maxHistory})
          </label>
          <input
            type="number"
            min={20}
            max={1000}
            value={current.maxHistory}
            onChange={(e) => {
              const n = Number(e.target.value);
              patch({ maxHistory: Number.isFinite(n) ? Math.min(1000, Math.max(20, n)) : 200 });
            }}
            className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>
      </div>

      {/* Browser notifications */}
      <label className="flex items-center justify-between p-3 bg-[var(--color-background)] rounded-xl border border-[var(--color-border)]">
        <span className="text-sm text-[var(--color-text-primary)]">
          Desktop notifications
          <span className="block text-xs text-[var(--color-text-secondary)]">
            Shows a system notification when the tab is in the background. Requires browser permission.
          </span>
        </span>
        <input
          type="checkbox"
          checked={current.browserNotifications}
          onChange={(e) => patch({ browserNotifications: e.target.checked })}
          className="w-4 h-4 accent-[var(--color-primary)] flex-shrink-0"
        />
      </label>

      {/* Test connection */}
      <button
        onClick={handleTest}
        disabled={testing}
        className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 transition-colors text-sm disabled:opacity-60"
      >
        <Plug className="w-4 h-4" />
        {testing ? 'Testing…' : 'Test connection'}
      </button>
    </div>
  );
}
