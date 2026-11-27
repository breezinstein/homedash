import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastRegion,
  ToastTitle,
  toast as enqueue,
} from '@ui-sdk/react/toast';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'info';

interface ToastInput {
  message: string;
  tone?: ToastTone;
  /** Milliseconds before auto-dismiss. Defaults to 3500. */
  duration?: number;
}

interface ToastContextValue {
  show: (input: ToastInput) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICON = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;

const TONE_COLOR: Record<ToastTone, string> = {
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  info: 'var(--color-primary)',
};

/**
 * Toasts on ui-sdk's queue: the region announces them, stacks them and pauses
 * the timers while hovered. The hook keeps the app's original API so callers
 * only pass a message and a tone.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const value: ToastContextValue = useMemo(() => {
    const show = ({ message, tone = 'info', duration = 3500 }: ToastInput) => {
      enqueue(message, { type: tone, duration });
    };
    return {
      show,
      success: (message, duration) => show({ message, tone: 'success', duration }),
      error: (message, duration) => show({ message, tone: 'error', duration }),
      info: (message, duration) => show({ message, tone: 'info', duration }),
    };
  }, []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRegion
        className="ui-toast-region bottom-3 right-3 sm:bottom-4 sm:right-4"
        side="bottom"
        align="end"
        maxVisible={4}
      >
        {(item) => {
          const tone = (item.type ?? 'info') as ToastTone;
          const Icon = TONE_ICON[tone] ?? Info;
          return (
            <Toast key={item.id} id={item.id} className="ui-toast">
              <div className="mt-0.5 shrink-0" style={{ color: TONE_COLOR[tone] ?? TONE_COLOR.info }}>
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <ToastTitle className="ui-toast-title" />
                <ToastDescription className="ui-toast-description" />
              </div>
              <ToastClose aria-label="Dismiss" className="shrink-0 rounded p-1 text-[var(--color-text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--color-text-primary)]">
                <X className="size-3.5" />
              </ToastClose>
            </Toast>
          );
        }}
      </ToastRegion>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { show: () => {}, success: () => {}, error: () => {}, info: () => {} };
  }
  return ctx;
}
