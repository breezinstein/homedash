import { useState, useEffect } from 'react';
import { Button } from '@ui-sdk/react/button';
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@ui-sdk/react/dialog';
import { Field, FieldLabel } from '@ui-sdk/react/field';
import { Input } from '@ui-sdk/react/input';
import { X } from 'lucide-react';

interface CategoryModalProps {
  category: string | null;
  onSave: (oldName: string | null, newName: string) => void;
  onClose: () => void;
}

export function CategoryModal({ category, onSave, onClose }: CategoryModalProps) {
  const [name, setName] = useState('');

  useEffect(() => {
    setName(category || '');
  }, [category]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(category, name.trim());
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      dismissible
      closeOnOutsidePress={false}
    >
      <DialogBackdrop className="ui-dialog-backdrop" />
      <DialogContent className="ui-dialog" data-size="sm">
        <div className="ui-dialog-head">
          <div className="min-w-0 flex-1">
            <DialogTitle className="ui-dialog-title">
              {category ? 'Rename category' : 'New category'}
            </DialogTitle>
            <DialogDescription className="ui-dialog-description">
              Categories group cards on the dashboard and in the sidebar.
            </DialogDescription>
          </div>
          <DialogClose aria-label="Close" className="ui-dialog-close">
            <X className="size-4" aria-hidden="true" />
          </DialogClose>
        </div>
        <div className="ui-dialog-body">
          <form id="category-form" onSubmit={handleSubmit}>
            <Field className="ui-field">
              <FieldLabel className="ui-label">Category name</FieldLabel>
              <Input
                className="ui-input"
                value={name}
                onValueChange={setName}
                placeholder="Media, Infrastructure, Home…"
                required
                autoFocus
              />
            </Field>
          </form>
        </div>
        <div className="ui-dialog-foot">
          <DialogClose className="ui-btn" data-variant="secondary">
            Cancel
          </DialogClose>
          <Button type="submit" form="category-form" className="ui-btn" data-variant="primary">
            {category ? 'Save' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
