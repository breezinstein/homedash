import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ModalShell } from './ModalShell';

type Tone = 'danger' | 'primary';

interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingConfirm extends ConfirmOptions {
  resolve: (v: boolean) => void;
}

/**
 * Themed replacement for window.confirm(). Used via the `useConfirm()` hook:
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ message: 'Delete this clip?' })) { ... }
 *
 * Looks and behaves like the rest of the app (dark theme, backdrop dismiss,
 * Escape cancels, body scroll lock, focus-trapped enough for thumb use).
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  const confirm: ConfirmFn = useCallback((opts) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  useEffect(() => {
    if (pending) {
      const t = setTimeout(() => confirmBtnRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [pending]);

  const settle = (value: boolean) => {
    if (!pending) return;
    pending.resolve(value);
    setPending(null);
  };

  const tone: Tone = pending?.tone ?? 'danger';
  const confirmColor =
    tone === 'danger'
      ? 'bg-[var(--color-error)] hover:bg-[var(--color-error)]/80'
      : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ModalShell onClose={() => settle(false)} ariaLabel={pending.title ?? 'Confirm'}>
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] w-full max-w-sm shadow-2xl">
            <div className="p-5 flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  tone === 'danger' ? 'bg-[var(--color-error)]/15' : 'bg-[var(--color-primary)]/15'
                }`}
              >
                <AlertTriangle
                  className={`w-5 h-5 ${
                    tone === 'danger'
                      ? 'text-[var(--color-error)]'
                      : 'text-[var(--color-primary)]'
                  }`}
                />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-[var(--color-text-primary)]">
                  {pending.title ?? 'Are you sure?'}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1 break-words">
                  {pending.message}
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 p-4 pt-2 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => settle(false)}
                className="flex-1 px-4 py-2.5 sm:py-2 bg-[var(--color-background)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-border)] active:bg-[var(--color-border)] transition-colors text-sm font-medium"
              >
                {pending.cancelLabel ?? 'Cancel'}
              </button>
              <button
                type="button"
                ref={confirmBtnRef}
                onClick={() => settle(true)}
                className={`flex-1 px-4 py-2.5 sm:py-2 text-white rounded-lg transition-colors text-sm font-medium ${confirmColor}`}
              >
                {pending.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    return (opts: ConfirmOptions) =>
      Promise.resolve(window.confirm(typeof opts.message === 'string' ? opts.message : 'Are you sure?'));
  }
  return ctx;
}
