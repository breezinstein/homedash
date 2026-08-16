import { useEffect } from 'react';
import { configApi } from '../api/configApi';
import type { Colors } from '../types';

// The /monitor page is its own root tree (no DashboardProvider), so it must
// apply the shared theme colours itself. The public /api/config payload always
// includes `colors` (unredacted), so anonymous viewers get the same theme as
// the main dashboard. We set the `--color-*` variables (consumed by shared
// components like LoginModal) and derive a light/dark hint attribute from the
// background colour's perceived brightness for any remaining monochrome rules.

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function isLightBackground(color: string): boolean {
  const rgb = hexToRgb(color);
  if (!rgb) return false;
  const [r, g, b] = rgb;
  // Perceived brightness (YIQ) — used to pick dark vs light text/overlays.
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

function applyColors(colors: Colors) {
  const root = document.documentElement;
  Object.entries(colors).forEach(([key, value]) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    root.style.setProperty(`--color-${cssKey}`, value as string);
  });
  root.setAttribute('data-monitor-theme', isLightBackground(colors.background) ? 'light' : 'dark');
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
