import { useState, useEffect, useCallback, useRef } from 'react';

export type MonitorTab = 'home' | 'server' | 'media' | 'network' | 'power';

interface UseTabRotationOpts {
  rotationSeconds: number;           // 0 = manual tabs only
  pauseDurationSeconds?: number;     // how long to pause after manual switch (default 60)
}

const TAB_ORDER: MonitorTab[] = ['home', 'server', 'media', 'network', 'power'];

// Whether a keydown landed in something the user is typing into. Arrow keys
// switch tabs only when the focus is not in an editable control, so keyboard
// navigation never fights the form/settings inputs.
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

/**
 * Auto-rotates through server → media → network on the configured cadence,
 * pausing for `pauseDurationSeconds` after a manual tab click.  Uses the
 * overview's `tabRotationSeconds` (default 15 s) as the rotation interval.
 * ArrowLeft / ArrowRight also move between tabs and count as a manual switch
 * (so auto-rotation holds on the tab you land on).
 */
export function useTabRotation({
  rotationSeconds,
  pauseDurationSeconds = 60,
}: UseTabRotationOpts) {
  const [activeTab, setActiveTab] = useState<MonitorTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    return t === 'home' ? 'home' : t === 'media' ? 'media' : t === 'network' ? 'network' : t === 'power' ? 'power' : 'server';
  });
  const [remainingSeconds, setRemainingSeconds] = useState(rotationSeconds || 0);
  const pausedUntil = useRef(0);

  const switchTab = useCallback(
    (tab: MonitorTab, manual = false) => {
      setActiveTab(tab);
      if (manual) {
        pausedUntil.current = Date.now() + pauseDurationSeconds * 1000;
        setRemainingSeconds(pauseDurationSeconds);
      } else {
        setRemainingSeconds(rotationSeconds || 0);
      }
    },
    [rotationSeconds, pauseDurationSeconds],
  );

  // Auto-rotate tick
  useEffect(() => {
    if (rotationSeconds <= 0) {
      setRemainingSeconds(0);
      return;
    }
    setRemainingSeconds(rotationSeconds);
    const id = setInterval(() => {
      const now = Date.now();
      if (pausedUntil.current > now) {
        setRemainingSeconds(Math.ceil((pausedUntil.current - now) / 1000));
        return;
      }
      setRemainingSeconds((prev) => {
        if (prev > 1) return prev - 1;
        setActiveTab((prevTab) => {
          const idx = TAB_ORDER.indexOf(prevTab);
          return TAB_ORDER[(idx + 1) % TAB_ORDER.length];
        });
        return rotationSeconds;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [rotationSeconds]);

  // Keyboard navigation: ArrowLeft / ArrowRight step through the tabs,
  // wrapping around. Counts as a manual switch so auto-rotation holds.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; // browser shortcuts / OS binds
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      const idx = TAB_ORDER.indexOf(activeTab);
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const next = TAB_ORDER[(idx + delta + TAB_ORDER.length) % TAB_ORDER.length];
      switchTab(next, true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, switchTab]);

  return {
    activeTab,
    switchTab,
    remainingSeconds,
    isPaused: pausedUntil.current > Date.now(),
  };
}
