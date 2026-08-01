import { useState, useEffect, useCallback, useRef } from 'react';

type MonitorTab = 'infra' | 'media';

interface UseTabRotationOpts {
  rotationSeconds: number;           // 0 = manual tabs only
  pauseDurationSeconds?: number;     // how long to pause after manual switch (default 60)
}

// Driven by `/monitor?tab=media` on load, auto-rotates on the configured
// cadence, and pauses for 60 s after a manual tab click.
export function useTabRotation({ rotationSeconds, pauseDurationSeconds = 60 }: UseTabRotationOpts) {
  const [activeTab, setActiveTab] = useState<MonitorTab>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') === 'media' ? 'media' : 'infra';
  });
  const remain = useRef(rotationSeconds || 60);
  const pausedUntil = useRef(0);

  const switchTab = useCallback((tab: MonitorTab, manual = false) => {
    setActiveTab(tab);
    if (manual) {
      pausedUntil.current = Date.now() + pauseDurationSeconds * 1000;
      remain.current = pauseDurationSeconds;
    } else {
      remain.current = rotationSeconds || 60;
    }
  }, [rotationSeconds, pauseDurationSeconds]);

  // Auto-rotate tick
  useEffect(() => {
    if (rotationSeconds <= 0) return;
    const id = setInterval(() => {
      const now = Date.now();
      if (pausedUntil.current > now) {
        remain.current = Math.ceil((pausedUntil.current - now) / 1000);
        return;
      }
      remain.current--;
      if (remain.current <= 0) {
        setActiveTab(prev => {
          const next = prev === 'infra' ? 'media' : 'infra';
          remain.current = rotationSeconds;
          return next;
        });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [rotationSeconds]);

  return { activeTab, switchTab, remainingSeconds: remain.current };
}
