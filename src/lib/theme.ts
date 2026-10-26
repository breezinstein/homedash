import type { Colors } from '../types';
import { getThemeCssId } from '../themes';

const THEME_COLOR_STYLE_ID = 'homedash-theme-colors';
const CUSTOM_CSS_STYLE_ID = 'homedash-custom-css';

function colorVarName(key: string): string {
  return `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
}

/**
 * Activate the optional scoped stylesheet for a theme preset. Plain colour
 * themes (and the "custom" theme) have no cssTheme, so the attribute is
 * removed and only the colour tokens apply.
 */
export function applyThemeAttribute(themeName: string | null | undefined): void {
  if (typeof document === 'undefined') return;

  const cssTheme = getThemeCssId(themeName);
  if (cssTheme) {
    document.documentElement.dataset.theme = cssTheme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

/**
 * Apply the active colour tokens through a layered stylesheet rather than
 * inline styles. This keeps the cascade predictable:
 *
 *   base < config colours < theme defaults < theme tokens < custom CSS
 *
 * The custom CSS element is intentionally unlayered, so a normal
 * `:root { --color-primary: … }` override wins without `!important`.
 */
export function applyThemeColors(colors: Colors): void {
  if (typeof document === 'undefined') return;

  const declarations = Object.entries(colors)
    .map(([key, value]) => `${colorVarName(key)}: ${value};`)
    .join('\n');

  let style = document.getElementById(THEME_COLOR_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = THEME_COLOR_STYLE_ID;
    const customCss = document.getElementById(CUSTOM_CSS_STYLE_ID);
    if (customCss?.parentNode) customCss.parentNode.insertBefore(style, customCss);
    else document.head.appendChild(style);
  }
  style.textContent = `@layer homedash-config-colors {\n:root {\n${declarations}\n}\n}`;

  // Remove any legacy inline colour variables from earlier versions; inline
  // declarations would otherwise beat both layered theme tokens and custom CSS.
  const root = document.documentElement;
  for (const key of Object.keys(colors)) {
    root.style.removeProperty(colorVarName(key));
  }
}
