import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@ui-sdk/react/alert-dialog';
import { AlertTriangle, Trash2 } from 'lucide-react';

type Tone = 'danger' | 'primary';

export interface ConfirmOptions {
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
 * Themed replacement for window.confirm(), built on ui-sdk Alert Dialog so the
 * question is modal, focus-trapped and answers with a value.
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ message: 'Delete this clip?' })) { ... }
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm: ConfirmFn = useCallback((opts) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const settle = (value: boolean) => {
    if (!pending) return;
    pending.resolve(value);
    setPending(null);
  };

  const tone: Tone = pending?.tone ?? 'danger';
  const Icon = tone === 'danger' ? Trash2 : AlertTriangle;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <AlertDialog
          open
          onOpenChange={(open, details) => {
            if (!open) settle(details.returnValue === 'confirm');
          }}
        >
          <AlertDialogBackdrop className="ui-dialog-backdrop" />
          <AlertDialogContent className="ui-dialog" data-size="sm">
            <div className="flex items-start gap-3 px-5 pt-5">
              <div
                className="grid size-9 shrink-0 place-items-center rounded-full"
                style={{
                  backgroundColor: tone === 'danger' ? 'var(--danger-soft)' : 'var(--accent-soft)',
                  color: tone === 'danger' ? 'var(--color-error)' : 'var(--color-primary)',
                }}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <AlertDialogTitle className="ui-dialog-title">
                  {pending.title ?? 'Are you sure?'}
                </AlertDialogTitle>
                <AlertDialogDescription className="ui-dialog-description break-words">
                  {pending.message}
                </AlertDialogDescription>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 p-5 sm:flex-row sm:justify-end">
              <AlertDialogClose className="ui-btn sm:flex-none" data-variant="secondary">
                {pending.cancelLabel ?? 'Cancel'}
              </AlertDialogClose>
              <AlertDialogClose
                value="confirm"
                className="ui-btn sm:flex-none"
                data-variant={tone === 'danger' ? 'danger' : 'primary'}
              >
                {pending.confirmLabel ?? 'Confirm'}
              </AlertDialogClose>
            </div>
          </AlertDialogContent>
        </AlertDialog>
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
