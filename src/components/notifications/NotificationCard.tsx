import { ExternalLink, X, Paperclip } from 'lucide-react';
import type { NotificationItem, NtfyAction } from '../../types';
import { useToast } from '../ui';

interface NotificationCardProps {
  item: NotificationItem;
  onDismiss: (id: string) => void;
}

// Maps ntfy priority (1 lowest … 5 highest) to a left-border accent colour.
const PRIORITY_BORDER: Record<number, string> = {
  1: 'border-l-[var(--color-text-secondary)]',
  2: 'border-l-[var(--color-text-secondary)]',
  3: 'border-l-[var(--color-primary)]',
  4: 'border-l-[var(--color-warning)]',
  5: 'border-l-[var(--color-error)]',
};

function formatTimeAgo(epochSeconds: number): string {
  const diff = Date.now() - epochSeconds * 1000;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatBytes(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

interface StructuredMessage {
  heading?: string;
  body?: string;
}

// Some services (e.g. Emby webhooks) publish a JSON document as the message
// body rather than human-readable text. Detect that case and pull out a
// sensible heading + body so the card does not show a wall of raw JSON.
// Returns null for plain-text messages, which are rendered as-is.
function parseStructuredMessage(message?: string): StructuredMessage | null {
  if (!message) return null;
  const trimmed = message.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;

  const obj = data as Record<string, unknown>;
  const pick = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = obj[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  };

  const heading = pick('Title', 'title', 'subject', 'name', 'Name');
  const body = pick('Description', 'description', 'Overview', 'overview', 'message', 'Message', 'body', 'text');

  // Only treat it as structured if we recovered something readable; otherwise
  // fall back to a pretty-printed dump so no information is lost.
  if (heading || body) return { heading, body };
  return { body: JSON.stringify(obj, null, 2) };
}

export function NotificationCard({ item, onDismiss }: NotificationCardProps) {
  const toast = useToast();
  const border = PRIORITY_BORDER[item.priority ?? 3] ?? PRIORITY_BORDER[3];
  const isImage = item.attachment?.type?.startsWith('image/');
  const structured = parseStructuredMessage(item.message);
  // When the JSON body carries its own title, prefer it only if the ntfy
  // message has no title of its own.
  const displayTitle = item.title || structured?.heading;
  const displayBody = structured ? structured.body : item.message;

  const handleHttpAction = async (action: NtfyAction) => {
    if (!action.url) return;
    try {
      const res = await fetch(action.url, {
        method: action.method || 'POST',
        headers: action.headers,
        body: action.body,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`${action.label}: sent`);
    } catch {
      // Cross-origin requests are commonly blocked by CORS for homelab targets.
      toast.error(`${action.label} failed (network or CORS)`);
    }
  };

  const handleBodyClick = () => {
    if (item.click) window.open(item.click, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className={`relative rounded-xl border border-[var(--color-border)] border-l-4 ${border} bg-[var(--color-background)] p-3 ${
        item.read ? 'opacity-80' : ''
      }`}
    >
      <button
        onClick={() => onDismiss(item.id)}
        className="absolute top-2 right-2 p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] rounded-md transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>

      <div
        className={item.click ? 'cursor-pointer pr-6' : 'pr-6'}
        onClick={item.click ? handleBodyClick : undefined}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {!item.read && (
            <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] flex-shrink-0" />
          )}
          {displayTitle && (
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              {displayTitle}
            </span>
          )}
          {item.click && <ExternalLink className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />}
        </div>

        {displayBody && (
          <p className="mt-1 text-sm text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
            {displayBody}
          </p>
        )}
      </div>

      {/* Attachment */}
      {item.attachment && (
        <div className="mt-2">
          {isImage ? (
            <a href={item.attachment.url} target="_blank" rel="noopener noreferrer">
              <img
                src={item.attachment.url}
                alt={item.attachment.name}
                loading="lazy"
                className="max-h-48 w-auto rounded-lg border border-[var(--color-border)]"
              />
            </a>
          ) : (
            <a
              href={item.attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-primary)] hover:border-[var(--color-primary)] transition-colors"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span className="truncate max-w-[12rem]">{item.attachment.name}</span>
              {formatBytes(item.attachment.size) && (
                <span className="text-[var(--color-text-secondary)]">
                  {formatBytes(item.attachment.size)}
                </span>
              )}
            </a>
          )}
        </div>
      )}

      {/* Action buttons */}
      {item.actions && item.actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {item.actions.map((action, i) =>
            action.action === 'view' && action.url ? (
              <a
                key={action.id ?? i}
                href={action.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-primary)] text-white rounded-lg text-xs hover:bg-[var(--color-primary)]/80 transition-colors"
              >
                {action.label}
              </a>
            ) : action.action === 'http' ? (
              <button
                key={action.id ?? i}
                onClick={() => handleHttpAction(action)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg text-xs hover:border-[var(--color-primary)] transition-colors"
              >
                {action.label}
              </button>
            ) : null
          )}
        </div>
      )}

      {/* Footer: topic, tags, time */}
      <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-[var(--color-text-secondary)]">
        <span className="px-1.5 py-0.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">
          {item.topic}
        </span>
        {item.tags?.map((tag) => (
          <span
            key={tag}
            className="px-1.5 py-0.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]"
          >
            {tag}
          </span>
        ))}
        <span className="ml-auto">{formatTimeAgo(item.time)}</span>
      </div>
    </div>
  );
}
