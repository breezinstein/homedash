import { useState, useEffect, useRef, useCallback } from 'react';
import type { MonitorOverview } from '../types';
import { fetchOverview } from './monitorApi';

interface UseMonitorOverviewResult {
  overview: MonitorOverview | null;
  isLoading: boolean;
  error: string | null;
}

// Poll /api/monitor/overview at half the server poll interval (minimum 2 s,
// maximum 30 s). Pauses when the document is hidden, and applies a gentle
// backoff after consecutive failures so a downed server doesn't hammer.
// The overview endpoint is public, so there is no auth gating here.
export function useMonitorOverview(): UseMonitorOverviewResult {
  const [overview, setOverview] = useState<MonitorOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const failCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef(5000);
  const stoppedRef = useRef(false);

  const poll = useCallback(async () => {
    try {
      const data = await fetchOverview();
      setOverview(data);
      intervalRef.current = Math.max(2000, Math.min(30000, data.pollIntervalMs / 2));
      setError(null);
      failCount.current = 0;
    } catch (err) {
      failCount.current++;
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsLoading(false);
    }

    // Schedule next poll. Backoff: 2^failCount * base, clamped to 60 s.
    if (stoppedRef.current || document.hidden) return;
    const base = intervalRef.current;
    const backoff = failCount.current > 2
      ? Math.min(60000, base * Math.pow(2, failCount.current - 2))
      : base;
    timerRef.current = setTimeout(poll, backoff);
  }, []);

  // Start / stop the poll loop.
  useEffect(() => {
    stoppedRef.current = false;
    poll();
    return () => {
      stoppedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [poll]);

  // Pause when the tab is hidden; resume on focus.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (timerRef.current) clearTimeout(timerRef.current);
        poll();
      } else if (timerRef.current) clearTimeout(timerRef.current);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [poll]);

  return { overview, isLoading, error };
}
