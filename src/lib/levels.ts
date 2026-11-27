export type Level = 'ok' | 'warn' | 'critical';

/** Higher is worse: CPU, memory, disk, load against a rating. */
export function usageLevel(percent: number | null | undefined, warnAt = 75, criticalAt = 90): Level | undefined {
  if (percent == null || !Number.isFinite(percent)) return undefined;
  if (percent >= criticalAt) return 'critical';
  if (percent >= warnAt) return 'warn';
  return 'ok';
}

/** Lower is worse: battery state of charge. */
export function reserveLevel(percent: number | null | undefined, warnAt = 30, criticalAt = 15): Level | undefined {
  if (percent == null || !Number.isFinite(percent)) return undefined;
  if (percent <= criticalAt) return 'critical';
  if (percent <= warnAt) return 'warn';
  return 'ok';
}

/** Gap between the highest and lowest cell, in millivolts. */
export function cellSpreadLevel(mv: number | null | undefined): Level | undefined {
  return usageLevel(mv, 30, 50);
}

/** A temperature against the sensor's own thresholds when it reports them. */
export function temperatureLevel(
  value: number | null | undefined,
  warning: number | null | undefined = 70,
  critical: number | null | undefined = 85,
): Level | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  if (critical != null && value >= critical) return 'critical';
  if (warning != null && value >= warning) return 'warn';
  return 'ok';
}

/** Days until a certificate expires. */
export function expiryLevel(daysLeft: number | null | undefined): Level | undefined {
  if (daysLeft == null || !Number.isFinite(daysLeft)) return undefined;
  if (daysLeft <= 5) return 'critical';
  if (daysLeft <= 21) return 'warn';
  return 'ok';
}

export function worstLevel(...levels: (Level | undefined)[]): Level | undefined {
  if (levels.includes('critical')) return 'critical';
  if (levels.includes('warn')) return 'warn';
  if (levels.includes('ok')) return 'ok';
  return undefined;
}

/** Chip tone for a level, matching .ui-chip[data-tone]. */
export function levelTone(level: Level | undefined): 'success' | 'warning' | 'danger' | undefined {
  if (level === 'critical') return 'danger';
  if (level === 'warn') return 'warning';
  if (level === 'ok') return 'success';
  return undefined;
}
