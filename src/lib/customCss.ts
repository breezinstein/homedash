const CUSTOM_CSS_STYLE_ID = 'homedash-custom-css';

/**
 * Inject (or update/remove) the user's custom CSS. Shared by the dashboard and
 * the standalone /monitor tree so both routes honour the same setting.
 */
export function applyCustomCss(css: string | null | undefined): void {
  if (typeof document === 'undefined') return;

  const value = typeof css === 'string' ? css : '';
  const existing = document.getElementById(CUSTOM_CSS_STYLE_ID) as HTMLStyleElement | null;

  if (!value.trim()) {
    existing?.remove();
    return;
  }

  if (existing) {
    if (existing.textContent !== value) existing.textContent = value;
    return;
  }

  const style = document.createElement('style');
  style.id = CUSTOM_CSS_STYLE_ID;
  style.textContent = value;
  document.head.appendChild(style);
}
