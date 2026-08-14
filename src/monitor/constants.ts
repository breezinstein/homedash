import type { Severity, SourceStatus } from '../types';

/** Colour per alert severity, shared by the banner and the alerts rail. */
export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: '#ef4444',
  warning: '#f59e0b',
  info: '#6366f1',
};

/** Colour per data-source status, used by SourceDot and status pills. */
export const STATUS_COLORS: Record<SourceStatus, string> = {
  ok: '#34d399',
  degraded: '#f59e0b',
  down: '#ef4444',
};
