import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Modal } from './ui/Modal';
import { FieldRow, Input } from './ui/Field';
import { Button } from './ui/Button';

interface LoginModalProps {
  onClose?: () => void;
  /** When true the dialog cannot be dismissed: a 401 forced the sign-in. */
  forced?: boolean;
}

export function LoginModal({ onClose, forced = false }: LoginModalProps) {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const ok = await login(password);
      if (!ok) {
        setError('That password is not right.');
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
    <Modal
      onClose={() => { if (!forced) onClose?.(); }}
      dismissOnBackdrop={false}
      dismissOnEscape={!forced}
      size="sm"
      icon={<div className="grid size-9 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--color-primary)]"><Lock className="size-4" /></div>}
      title="Sign in"
      description="Enter the admin password to manage services, settings and files."
      footer={
        <>
          {!forced && (
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
          )}
          <Button type="submit" form="login-form" variant="primary" disabled={submitting || !password}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </>
      }
    >
      <form id="login-form" onSubmit={handleSubmit}>
        <FieldRow label="Admin password" error={error}>
          <Input
            ref={inputRef}
            value={password}
            onValueChange={setPassword}
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            disabled={submitting}
            invalid={Boolean(error)}
          />
        </FieldRow>
      </form>
    </Modal>
  );
}
