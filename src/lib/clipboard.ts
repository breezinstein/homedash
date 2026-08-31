// Clipboard helper with a storybook-safe fallback.
//
// navigator.clipboard.writeText() only exists in secure contexts (https or
// localhost) and REQUIRES user activation; on an insecure origin (e.g. the
// dashboard served over plain http://<lan-ip>:3001) it is `undefined`, so
// calling it throws and the copy silently does nothing. This helper prefers the
// async Clipboard API when available, then falls back to the legacy
// document.execCommand('copy') technique, and reports success/failure so the
// caller can surface feedback instead of leaving the click silent.
export async function copyToClipboard(value: string): Promise<boolean> {
  const text = String(value ?? '');

  // Preferred path — async Clipboard API (secure contexts only, and only works
  // while the document is focused).
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path.
    }
  }

  // Legacy fallback — works in insecure contexts and older browsers.
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      const selection = document.getSelection();
      const prevRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (prevRange && selection) {
        selection.removeAllRanges();
        selection.addRange(prevRange);
      }
      return ok;
    } catch {
      return false;
    }
  }

  return false;
}
