import type { ReactNode } from 'react';
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@ui-sdk/react/dialog';
import { X } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  /** Called on Escape, backdrop press or the close button. */
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  size?: ModalSize;
  dismissOnBackdrop?: boolean;
  dismissOnEscape?: boolean;
  footer?: ReactNode;
  /** Skip the head/body chrome and let children fill the panel. */
  bare?: boolean;
  label?: string;
  children: ReactNode;
}

/**
 * App dialog chrome on ui-sdk Dialog: focus trap, inert background, Escape and
 * backdrop dismissal all come from the primitive; this only draws the panel.
 */
export function Modal({
  onClose,
  title,
  description,
  icon,
  size = 'md',
  dismissOnBackdrop = true,
  dismissOnEscape = true,
  footer,
  bare = false,
  label,
  children,
}: ModalProps) {
  return (
    <Dialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      dismissible={dismissOnEscape}
      closeOnOutsidePress={dismissOnBackdrop}
    >
      <DialogBackdrop className="ui-dialog-backdrop" />
      <DialogContent
        className="ui-dialog flex flex-col"
        data-size={size}
        aria-label={title ? undefined : label}
        initialFocus={bare ? 'content' : undefined}
      >
        {bare ? (
          children
        ) : (
          <>
            <div className="ui-dialog-head">
              {icon ? <div className="mt-0.5 shrink-0">{icon}</div> : null}
              <div className="min-w-0 flex-1">
                {title ? <DialogTitle className="ui-dialog-title">{title}</DialogTitle> : null}
                {description ? (
                  <DialogDescription className="ui-dialog-description">{description}</DialogDescription>
                ) : null}
              </div>
              <DialogClose aria-label="Close" className="ui-dialog-close">
                <X className="size-4" />
              </DialogClose>
            </div>
            <div className="ui-dialog-body flex-1 min-h-0">{children}</div>
            {footer ? <div className="ui-dialog-foot">{footer}</div> : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Panel-shaped dialog for the full-window tools (files, stats, clipboard…):
 * the tool owns its layout, so the dialog only provides the surface and the
 * focus trap.
 */
export function ModalPanel({
  onClose,
  size = 'xl',
  label,
  children,
}: {
  onClose: () => void;
  size?: ModalSize;
  label: string;
  children: ReactNode;
}) {
  return (
    <Modal onClose={onClose} size={size} bare label={label}>
      <div className="flex h-[min(86dvh,52rem)] flex-col">{children}</div>
    </Modal>
  );
}
