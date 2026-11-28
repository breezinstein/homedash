import { useEffect, useState } from 'react';
import { fetchAlerts } from './monitorApi';

const POLL_MS = 30_000;

/** How many monitor alerts are firing, for the sidebar and the floating button. */
export function useFiringAlerts(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const { firing } = await fetchAlerts();
        if (!cancelled) setCount(firing.length);
      } catch {
        // Keep the last count; the monitor view shows connection problems.
      }
    };
    void load();
    const id = window.setInterval(load, POLL_MS);
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return count;
}
