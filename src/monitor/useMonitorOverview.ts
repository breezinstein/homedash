import { useState, useEffect, useRef, useCallback } from 'react';
import type { MonitorOverview } from '../types';
import { fetchOverview, AuthRequiredError } from './monitorApi';

interface UseMonitorOverviewResult {
  overview: MonitorOverview | null;
  isLoading: boolean;
  error: string | null;
  authRequired: boolean;
}

// Poll /api/monitor/overview at half the server poll interval (minimum 2 s,
// maximum 30 s). Pauses when the document is hidden, and applies a gentle
// backoff after consecutive failures so a downed server doesn't hammer.
export function useMonitorOverview(): UseMonitorOverviewResult {
  const [overview, setOverview] = useState<MonitorOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const failCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    try {
      const data = await fetchOverview();
      setOverview(data);
      setError(null);
      failCount.current = 0;
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        setAuthRequired(true);
        return;
      }
      failCount.current++;
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsLoading(false);
    }

    // Schedule next poll. Backoff: 2^failCount * base, clamped to 60 s.
    const base = overview?.pollIntervalMs
      ? Math.max(2000, Math.min(30000, overview.pollIntervalMs / 2))
      : 5000;
    const backoff = failCount.current > 2
      ? Math.min(60000, base * Math.pow(2, failCount.current - 2))
      : base;
    timerRef.current = setTimeout(poll, backoff);
  }, []);

  // Start / stop the poll loop.
  useEffect(() => {
    poll();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [poll]);

  // Pause when the tab is hidden; resume on focus.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        if (timerRef.current) clearTimeout(timerRef.current);
        poll();
      }
    };
    const onHide = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onVis();
      else onHide();
    });
    return () => {
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [poll]);

  return { overview, isLoading, error, authRequired };
}
