import { useEffect } from 'react';
import { configApi } from '../api/configApi';
import type { Colors } from '../types';

// The /monitor page is its own root tree (no DashboardProvider), so it must
// apply the shared theme colours itself. The public /api/config payload always
// includes `colors` (unredacted), so anonymous viewers get the same theme as
// the main dashboard. We set the `--color-*` variables, which shared components
// (e.g. LoginModal) and the monitor's `--mon-*` tokens both derive from.

function applyColors(colors: Colors) {
  const root = document.documentElement;
  Object.entries(colors).forEach(([key, value]) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    root.style.setProperty(`--color-${cssKey}`, value as string);
  });
}

export function useMonitorTheme() {
  useEffect(() => {
    let cancelled = false;
    configApi
      .getConfig()
      .then(({ config }) => {
        if (cancelled || !config?.colors) return;
        applyColors(config.colors);
      })
      .catch(() => {
        // Leave the CSS fallback palette in place on failure.
      });
    return () => {
      cancelled = true;
    };
  }, []);
}
