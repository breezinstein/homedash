import type { Severity, SourceStatus } from '../types';

/** Colour per alert severity, shared by the banner and the alerts rail.
 *  Theme tokens so the kiosk follows the dashboard palette (incl. light). */
export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: 'var(--mon-danger)',
  warning: 'var(--mon-warn)',
  info: 'var(--mon-accent)',
};

/** Colour per data-source status, used by SourceDot and status pills. */
export const STATUS_COLORS: Record<SourceStatus, string> = {
  ok: 'var(--mon-ok)',
  degraded: 'var(--mon-warn)',
  down: 'var(--mon-danger)',
};
