import type { ComponentType, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Pause, Play, XCircle } from 'lucide-react';
import { IconButton } from './Button';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const toneIcon: Record<Tone, ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

interface InlineAlertProps {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** A message inside the page, like “showing last known values”. Danger is announced right away. */
export function InlineAlert({ tone = 'info', title, children, actions, className }: InlineAlertProps) {
  const Icon = toneIcon[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={className ? `ui-alert ${className}` : 'ui-alert'}
      data-tone={tone}
    >
      <Icon className="ui-alert-icon" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? <div className="ui-alert-title">{title}</div> : null}
        {children ? <div className="ui-alert-body">{children}</div> : null}
      </div>
      {actions ? <div className="ui-alert-actions">{actions}</div> : null}
    </div>
  );
}

/** Label/value pairs, like a host's OS, kernel and CPU model. */
export function KeyValueList({ items, className }: { items: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={className ? `ui-kv ${className}` : 'ui-kv'}>
      {items.map(([k, v], i) => (
        <div key={i} className="ui-kv-row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div className="ui-empty" data-compact={compact || undefined}>
      {Icon ? (
        <div className="ui-empty-icon">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      ) : null}
      <p className="ui-empty-title">{title}</p>
      {description ? <p className="ui-empty-text">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

interface LiveBadgeProps {
  intervalMs: number;
  paused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  /** Shown as “stale” when the last poll failed. */
  stale?: boolean;
}

/** How fresh the numbers are, with a pause button when the view polls on its own. */
export function LiveBadge({ intervalMs, paused, onPausedChange, stale }: LiveBadgeProps) {
  const seconds = Math.round(intervalMs / 1000);
  const state = stale ? 'stale' : paused ? 'paused' : 'live';
  return (
    <span className="flex items-center gap-1">
      <span className="ui-chip ui-live" data-state={state} data-tone={state === 'live' ? 'success' : state === 'stale' ? 'warning' : undefined}>
        <span className="ui-live-dot" aria-hidden="true" />
        {state === 'live' ? `Live · every ${seconds}s` : state === 'paused' ? 'Paused' : 'Stale'}
      </span>
      {onPausedChange ? (
        <IconButton label={paused ? 'Resume updates' : 'Pause updates'} onClick={() => onPausedChange(!paused)}>
          {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
        </IconButton>
      ) : null}
    </span>
  );
}
