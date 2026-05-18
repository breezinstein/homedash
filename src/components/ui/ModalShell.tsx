import { useEffect, type ReactNode } from 'react';
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
  children: ReactNode;
}

/**
 * Shared modal scaffolding: backdrop, body-scroll lock, Escape-to-close,
 * tap-on-backdrop-to-close. Children render the modal card inside.
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
  children,
}: ModalShellProps) {
  useBodyScrollLock(true);

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
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm ${className}`}
      onMouseDown={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
