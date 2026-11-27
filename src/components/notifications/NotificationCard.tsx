import { ExternalLink, Paperclip, X } from 'lucide-react';
import { Button } from '@ui-sdk/react/button';
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

  return (
    <article
      className={`group relative rounded-[var(--radius-md)] border border-l-4 border-[var(--color-border)] ${border} bg-[var(--surface-sunken)] p-3 ${
        item.read ? 'opacity-80' : ''
      }`}
    >
      <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <Button
          className="ui-btn"
          data-variant="ghost"
          data-size="icon"
          onClick={() => onDismiss(item.id)}
          aria-label="Dismiss notification"
        >
          <X className="size-3.5" aria-hidden="true" />
        </Button>
      </div>

      <div className="pr-8">
        <div className="flex flex-wrap items-center gap-2">
          {!item.read && <span className="size-2 shrink-0 rounded-full bg-[var(--color-primary)]" />}
          {displayTitle && (
            <span className="text-[0.8125rem] font-semibold text-[var(--color-text-primary)]">
              {displayTitle}
            </span>
          )}
          {item.click && <ExternalLink className="size-3.5 text-[var(--color-text-secondary)]" aria-hidden="true" />}
        </div>

        {displayBody && (
          <p className="mt-1 whitespace-pre-wrap break-words text-[0.8125rem] text-[var(--color-text-primary)]">
            {displayBody}
          </p>
        )}
      </div>

      {item.attachment && (
        <div className="mt-2">
          {isImage ? (
            <a href={item.attachment.url} target="_blank" rel="noopener noreferrer">
              <img
                src={item.attachment.url}
                alt={item.attachment.name}
                loading="lazy"
                className="max-h-48 w-auto rounded-[var(--radius-sm)] border border-[var(--color-border)]"
              />
            </a>
          ) : (
            <Button
              className="ui-btn"
              data-variant="secondary"
              data-size="sm"
              render={<a href={item.attachment.url} target="_blank" rel="noopener noreferrer" />}
            >
              <Paperclip className="size-3.5" aria-hidden="true" />
              <span className="max-w-[12rem] truncate">{item.attachment.name}</span>
              {formatBytes(item.attachment.size) && (
                <span className="text-[var(--color-text-secondary)]">{formatBytes(item.attachment.size)}</span>
              )}
            </Button>
          )}
        </div>
      )}

      {item.actions && item.actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {item.actions.map((action, i) =>
            action.action === 'view' && action.url ? (
              <Button
                key={action.id ?? i}
                className="ui-btn"
                data-variant="primary"
                data-size="sm"
                render={<a href={action.url} target="_blank" rel="noopener noreferrer" />}
              >
                {action.label}
              </Button>
            ) : action.action === 'http' ? (
              <Button
                key={action.id ?? i}
                className="ui-btn"
                data-variant="secondary"
                data-size="sm"
                onClick={() => handleHttpAction(action)}
              >
                {action.label}
              </Button>
            ) : null,
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
        <span className="ui-chip">{item.topic}</span>
        {item.tags?.map((tag) => (
          <span key={tag} className="ui-chip">{tag}</span>
        ))}
        <span className="ml-auto tabular-nums">{formatTimeAgo(item.time)}</span>
      </div>
    </article>
  );
}
