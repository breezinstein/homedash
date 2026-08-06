interface MonitorProgressProps {
  rotationSeconds: number;
  remainingSeconds: number;
  paused: boolean;
}

/**
 * Thin progress bar pinned to the bottom edge of the kiosk screen showing how
 * far we are through the current auto-rotate interval. Fills from 0 → 100% as
 * the countdown approaches the next tab switch. Hidden entirely when tab
 * rotation is disabled (rotationSeconds <= 0), and dimmed while rotation is
 * paused after a manual tab click.
 */
export function MonitorProgress({ rotationSeconds, remainingSeconds, paused }: MonitorProgressProps) {
  if (rotationSeconds <= 0) return null;

  const total = Math.max(1, rotationSeconds);
  const pct = Math.max(0, Math.min(100, ((total - remainingSeconds) / total) * 100));

  return (
    <div
      className={`monitor-progress${paused ? ' monitor-progress-paused' : ''}`}
      aria-hidden="true"
    >
      <div className="monitor-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
