import { useEffect } from 'react';
import { configApi } from '../api/configApi';
import { applyCustomCss } from '../lib/customCss';
import type { Colors, DashboardConfig } from '../types';

// The /monitor page is its own root tree (no DashboardProvider), so it must
// apply the shared theme colours and custom CSS itself. The public /api/config
// payload includes both `colors` and `settings.customCSS`, so anonymous viewers
// get the same appearance as the main dashboard.

// Key DashboardContext mirrors every saved config into.
const CONFIG_STORAGE_KEY = 'homedash-config';

function applyColors(colors: Colors) {
  const root = document.documentElement;
  Object.entries(colors).forEach(([key, value]) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    root.style.setProperty(`--color-${cssKey}`, value as string);
  });
}

function applyAppearance(config?: Partial<DashboardConfig> | null) {
  if (!config) return;
  if (config.colors) applyColors(config.colors);
  applyCustomCss(config.settings?.customCSS);
}

export function useMonitorTheme() {
  useEffect(() => {
    let cancelled = false;
    let lastModified = 0;

    const load = async () => {
      try {
        const { config, lastModified: modified } = await configApi.getConfig();
        if (cancelled) return;
        lastModified = modified;
        applyAppearance(config);
      } catch {
        // Leave the CSS fallback palette in place on failure.
      }
    };

    // Cheap stat-only probe: the full config is only re-fetched when the
    // dashboard has actually saved new colours or custom CSS.
    const checkForThemeChanges = async () => {
      if (document.hidden) return;
      try {
        const { changed, lastModified: modified } = await configApi.checkForChanges(lastModified);
        if (changed) {
          await load();
        } else {
          lastModified = modified;
        }
      } catch {
        // Retry on the next interval.
      }
    };

    void load();

    // Pick up settings saved from another dashboard tab without waiting for the
    // next poll. The dashboard mirrors every save into localStorage, so the key
    // is only a signal: re-read the server document instead of applying the
    // snapshot, which can be stale (anonymous tabs write local-only copies) or
    // partial/redacted and would otherwise blank the theme.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== CONFIG_STORAGE_KEY) return;
      void checkForThemeChanges();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void checkForThemeChanges();
    };

    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    const pollTimer = window.setInterval(checkForThemeChanges, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}
