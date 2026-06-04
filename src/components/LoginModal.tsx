import { useEffect, useRef, useState } from 'react';
import { Lock, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginModalProps {
  onClose?: () => void;
  // When true, the modal cannot be dismissed (used when a 401 forces sign-in).
  forced?: boolean;
}

export function LoginModal({ onClose, forced = false }: LoginModalProps) {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (forced) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [forced, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const ok = await login(password);
      if (!ok) {
        setError('Invalid password');
        setPassword('');
        inputRef.current?.focus();
      } else {
        onClose?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={() => { if (!forced) onClose?.(); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Sign in</h2>
          </div>
          {!forced && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Enter the admin password to manage services, settings, and files.
          </p>
          <div>
            <label htmlFor="homedash-admin-password" className="sr-only">Admin password</label>
            <input
              id="homedash-admin-password"
              ref={inputRef}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
              disabled={submitting}
            />
          </div>
          {error && (
            <p className="text-sm text-[var(--color-error)]" role="alert">{error}</p>
          )}
          <div className="flex items-center justify-end gap-2">
            {!forced && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary)]/80 disabled:opacity-50 transition-colors"
              disabled={submitting || !password}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
