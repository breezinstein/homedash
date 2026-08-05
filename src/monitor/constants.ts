import type { Severity, SourceStatus } from '../types';

/** Colour per alert severity, shared by the banner and the alerts rail. */
export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#e74c3c',
  warning: '#e67e22',
  info: '#6c5ce7',
};

/** Colour per data-source status, used by SourceDot and status pills. */
export const STATUS_COLORS: Record<SourceStatus, string> = {
  ok: '#2ecc71',
  degraded: '#e67e22',
  down: '#e74c3c',
};
