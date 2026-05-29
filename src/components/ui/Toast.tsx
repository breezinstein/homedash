import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastInput {
  message: string;
  tone?: ToastTone;
  /** Milliseconds before auto-dismiss. Defaults to 3500. Pass 0 to make it sticky. */
  duration?: number;
}

interface Toast extends Required<Omit<ToastInput, 'duration'>> {
  id: string;
  duration: number;
}

interface ToastContextValue {
  show: (input: ToastInput) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_CONFIG: Record<ToastTone, { icon: typeof CheckCircle2; bg: string; ring: string; text: string }> = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-[var(--color-success)]/15',
    ring: 'border-[var(--color-success)]/40',
    text: 'text-[var(--color-success)]',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-[var(--color-error)]/15',
    ring: 'border-[var(--color-error)]/40',
    text: 'text-[var(--color-error)]',
  },
  info: {
    icon: Info,
    bg: 'bg-[var(--color-primary)]/15',
    ring: 'border-[var(--color-primary)]/40',
    text: 'text-[var(--color-primary)]',
  },
};

/**
 * Lightweight toast provider. Anchored to the top on mobile (where the bottom
 * of the screen is often obscured by the home indicator and gestures) and to
 * the bottom-right on larger screens where there's room.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const toast: Toast = {
        id,
        message: input.message,
        tone: input.tone ?? 'info',
        duration: input.duration ?? 3500,
      };
      setToasts((prev) => [...prev, toast]);
      if (toast.duration > 0) {
        timersRef.current.set(
          id,
          setTimeout(() => remove(id), toast.duration),
        );
      }
    },
    [remove],
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  const value: ToastContextValue = useMemo(() => ({
    show,
    success: (message, duration) => show({ message, tone: 'success', duration }),
    error: (message, duration) => show({ message, tone: 'error', duration }),
    info: (message, duration) => show({ message, tone: 'info', duration }),
  }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed z-[60] flex flex-col gap-2 pointer-events-none
                   top-2 left-2 right-2 sm:top-auto sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0)',
          paddingBottom: 'env(safe-area-inset-bottom, 0)',
        }}
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => {
          const cfg = TONE_CONFIG[toast.tone];
          const Icon = cfg.icon;
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-2 p-3 rounded-xl border bg-[var(--color-surface)] shadow-lg ${cfg.ring}`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}
              >
                <Icon className={`w-4 h-4 ${cfg.text}`} />
              </div>
              <p className="flex-1 text-sm text-[var(--color-text-primary)] leading-snug break-words">
                {toast.message}
              </p>
              <button
                onClick={() => remove(toast.id)}
                className="p-1 -m-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex-shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}
