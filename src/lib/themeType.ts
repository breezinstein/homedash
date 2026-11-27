import { getThemeByName } from '../themes.ts';
import type { Colors } from '../types';

function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const linear = [r, g, b].map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/**
 * A preset knows its own type; custom colours fall back to the background.
 * Colours come from the config, so a user who hand-edits them still gets the
 * right chrome.
 */
export function themeType(themeName: string | undefined, colors: Colors): 'light' | 'dark' {
  const preset = themeName ? getThemeByName(themeName) : undefined;
  if (preset) return preset.type;
  return relativeLuminance(colors.background) > 0.5 ? 'light' : 'dark';
}

/**
 * Tags the document so the few places that cannot derive their look from the
 * colour tokens (inset highlights, elev shadows) can follow light or dark.
 * CSS themes bring their own look, so they opt out of the tweak.
 */
export function applyThemeType(themeName: string | undefined, colors: Colors): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.themeType = themeType(themeName, colors);
}
