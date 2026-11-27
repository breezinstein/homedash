import type { ComponentType, ReactNode } from 'react';
import type { Level } from '../../lib/levels';
import { levelTone } from '../../lib/levels';

type Icon = ComponentType<{ className?: string }>;

/** A titled block inside a monitor tab. `flat` sits on the tab surface without a shadow. */
export function MonPanel({
  title,
  icon: IconCmp,
  meta,
  actions,
  children,
  className,
  span,
}: {
  title: ReactNode;
  icon?: Icon;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Span every column of the tab grid. */
  span?: boolean;
}) {
  return (
    <section className={className ? `mv-panel ${className}` : 'mv-panel'} data-span={span || undefined}>
      <header className="mv-panel-head">
        {IconCmp ? <IconCmp className="size-3.5 shrink-0" aria-hidden="true" /> : null}
        <h3 className="mv-panel-title">{title}</h3>
        {meta ? <span className="mv-panel-meta">{meta}</span> : null}
        {actions ? <span className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1">{actions}</span> : null}
      </header>
      {children}
    </section>
  );
}

export function Chip({ tone, children, title }: { tone?: 'success' | 'warning' | 'danger' | 'info' | 'accent'; children: ReactNode; title?: string }) {
  return (
    <span className="ui-chip" data-tone={tone} title={title}>
      {children}
    </span>
  );
}

export function LevelChip({ level, children, title }: { level: Level | undefined; children: ReactNode; title?: string }) {
  return (
    <Chip tone={levelTone(level)} title={title}>
      {children}
    </Chip>
  );
}

export function Dot({ tone }: { tone?: 'success' | 'warning' | 'danger' | 'muted' }) {
  return <span className="mv-dot" data-tone={tone} aria-hidden="true" />;
}

/** One line in a monitor list: a leading dot or icon, a title with a sub-line, and trailing values. */
export function Row({
  lead,
  title,
  sub,
  trail,
  dim,
  children,
}: {
  lead?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  trail?: ReactNode;
  dim?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="mv-row" data-dim={dim || undefined}>
      {lead}
      <div className="mv-row-main">
        <div className="mv-row-title">{title}</div>
        {sub ? <div className="mv-row-sub">{sub}</div> : null}
        {children}
      </div>
      {trail ? <div className="mv-row-trail">{trail}</div> : null}
    </div>
  );
}

export function SectionLabel({ children, count }: { children: ReactNode; count?: ReactNode }) {
  return (
    <h3 className="mv-section">
      {children}
      {count != null ? <span className="mv-section-count">{count}</span> : null}
    </h3>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="mv-empty">{children}</p>;
}

/** "2 days ago" from an ISO timestamp. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** Power with a unit, e.g. "1.12 kW" or "640 W". `signed` adds + for positive values. */
export function formatPower(w: number | null | undefined, signed = false): string {
  if (w == null || !Number.isFinite(w)) return '—';
  const sign = signed && w > 0.5 ? '+' : '';
  if (Math.abs(w) >= 1000) return `${sign}${(w / 1000).toFixed(2)} kW`;
  return `${sign}${Math.round(w)} W`;
}

export function fmt(v: number | null | undefined, unit = '', digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const n = digits === 0 ? Math.round(v).toString() : Number(v.toFixed(digits)).toString();
  return unit ? `${n} ${unit}` : n;
}

/** "1.12 kW" → ["1.12", "kW"], for a headline number with a smaller unit. */
export function splitUnit(text: string): [string, string] {
  const i = text.lastIndexOf(' ');
  return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + 1)];
}
