import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

/** Every view's first row: title, optional subtitle, then actions on the right. */
export function PageHeader({ title, description, actions, children }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-start gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * The surface a tool view sits on: one bordered panel. `fill` makes it take the
 * rest of the viewport (browsers, lists); without it the panel hugs its content
 * and the page scrolls instead.
 */
export function PagePanel({
  children,
  className = '',
  fill = true,
}: {
  children: ReactNode;
  className?: string;
  fill?: boolean;
}) {
  return (
    <div
      className={`flex ${fill ? 'min-h-0 flex-1' : 'flex-none'} flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </div>
  );
}
