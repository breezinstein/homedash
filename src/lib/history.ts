/** A point in a rolling series: when it was read and its value. */
export interface Sample {
  t: number;
  v: number;
}

/**
 * Append a reading and drop everything older than the window. Readings with
 * the same timestamp as the last one replace it, so re-renders of one poll
 * don't stack duplicates.
 */
export function pushSample(series: Sample[], sample: Sample, windowMs: number): Sample[] {
  if (!Number.isFinite(sample.v)) return series;
  const cutoff = sample.t - windowMs;
  const kept = series.filter((s) => s.t >= cutoff && s.t < sample.t);
  kept.push(sample);
  return kept;
}

/** Points for an SVG polyline across width × height, with a shared min/max. */
export function sparkPoints(
  series: Sample[],
  width: number,
  height: number,
  opts: { min?: number; max?: number; windowMs?: number; now?: number } = {},
): { points: string; first: [number, number] | null; last: [number, number] | null; baseline: number } {
  if (series.length === 0) return { points: '', first: null, last: null, baseline: height };
  const values = series.map((s) => s.v);
  const lo = Math.min(opts.min ?? Math.min(...values), ...values);
  const hiRaw = Math.max(opts.max ?? Math.max(...values), ...values);
  const hi = hiRaw === lo ? lo + 1 : hiRaw;
  const end = opts.now ?? series[series.length - 1].t;
  const start = opts.windowMs ? end - opts.windowMs : series[0].t;
  const span = Math.max(1, end - start);
  const y = (v: number) => height - ((v - lo) / (hi - lo)) * height;
  const coords = series.map((s) => [((s.t - start) / span) * width, y(s.v)] as [number, number]);
  return {
    points: coords.map(([x, yy]) => `${x.toFixed(1)},${yy.toFixed(1)}`).join(' '),
    first: coords[0],
    last: coords[coords.length - 1],
    baseline: Math.min(height, Math.max(0, y(Math.max(lo, Math.min(0, hi))))),
  };
}
