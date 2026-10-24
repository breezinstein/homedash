import { useEffect, useRef, type ReactNode } from 'react';
import { useBodyScrollLock } from './useBodyScrollLock';

interface ModalShellProps {
  /** Called when the user wants to close (Esc, backdrop tap, X button). */
  onClose: () => void;
  /** Suppress backdrop dismiss while a sub-form is dirty. */
  dismissOnBackdrop?: boolean;
  /** Suppress Escape dismiss. */
  dismissOnEscape?: boolean;
  /** Extra classes for the outer fixed container (e.g. alignment). */
  className?: string;
  /** Optional aria label for screen readers. */
  ariaLabel?: string;
  /** ID of the element that names the dialog (preferred over ariaLabel). */
  labelledBy?: string;
  /** Stacking level; use a higher value for sign-in over other dialogs. */
  zIndex?: number;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Shared modal scaffolding: backdrop, body-scroll lock, Escape-to-close,
 * tap-on-backdrop-to-close, initial focus, focus trapping and focus restore.
 * Children render the modal card inside.
 *
 * The fixed inset container is also the backdrop — a mousedown that doesn't
 * bubble up from the card (i.e. target === currentTarget) calls onClose.
 */
export function ModalShell({
  onClose,
  dismissOnBackdrop = true,
  dismissOnEscape = true,
  className = '',
  ariaLabel,
  labelledBy,
  zIndex = 50,
  children,
}: ModalShellProps) {
  useBodyScrollLock(true);

  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    restoreFocusRef.current = previouslyFocused instanceof HTMLElement ? previouslyFocused : null;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const getFocusable = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // Respect an input's autoFocus/effect focus; otherwise focus the first
    // control so keyboard users start inside the dialog.
    if (!dialog.contains(document.activeElement)) {
      const first = getFocusable()[0];
      (first ?? dialog).focus();
    }

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialog.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener('keydown', handleTab);
    return () => {
      dialog.removeEventListener('keydown', handleTab);
      restoreFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    if (!dismissOnEscape) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [dismissOnEscape, onClose]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dismissOnBackdrop) return;
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      ref={dialogRef}
      className={`fixed inset-0 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm ${className}`}
      style={{ zIndex }}
      onMouseDown={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      tabIndex={-1}
    >
      {children}
    </div>
  );
}
