import { useEffect, useState } from 'react';
import { pushSample, sparkPoints, type Sample } from '../../lib/history';

const HOUR = 60 * 60 * 1000;

// Kept outside React so a view can unmount (switching to Files and back) without
// losing the last hour. It lives as long as the page does.
const store = new Map<string, Sample[]>();
const listeners = new Set<() => void>();

/** Record one reading per key at time `at`. Unchanged `at` values are ignored by pushSample. */
export function recordSamples(at: number, values: Record<string, number | null | undefined>, windowMs = HOUR) {
  let changed = false;
  for (const [key, v] of Object.entries(values)) {
    if (v == null || !Number.isFinite(v)) continue;
    store.set(key, pushSample(store.get(key) ?? [], { t: at, v }, windowMs));
    changed = true;
  }
  if (changed) listeners.forEach((fn) => fn());
}

/** The rolling series for a key; re-renders when new samples land. */
export function useSeries(key: string): Sample[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return store.get(key) ?? [];
}

interface SparklineProps {
  series: Sample[];
  /** Floor and ceiling for the scale; the data widens them when it goes past. */
  min?: number;
  max?: number;
  windowMs?: number;
  tone?: 'primary' | 'warning' | 'success' | 'muted' | 'danger';
  className?: string;
}

/** A small trend line with an area fill and a dot on the latest reading. Decorative. */
export function Sparkline({ series, min, max, windowMs = HOUR, tone = 'primary', className }: SparklineProps) {
  const w = 120;
  const h = 30;
  const now = series.length ? series[series.length - 1].t : Date.now();
  const { points, first, last, baseline } = sparkPoints(series, w, h, { min, max, windowMs, now });
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={className ? `ui-spark ${className}` : 'ui-spark'}
      data-tone={tone}
      aria-hidden="true"
    >
      <line className="ui-spark-base" x1="0" x2={w} y1={baseline} y2={baseline} />
      {series.length > 1 && first && last && (
        <>
          <polygon className="ui-spark-area" points={`${first[0].toFixed(1)},${baseline} ${points} ${last[0].toFixed(1)},${baseline}`} />
          <polyline className="ui-spark-line" points={points} />
        </>
      )}
      {last && <circle className="ui-spark-dot" cx={last[0]} cy={last[1]} r="2.2" />}
    </svg>
  );
}
