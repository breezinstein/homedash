import { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { FieldRow, Input } from './ui/Field';
import { Button } from './ui/Button';

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
    <Modal
      onClose={onClose}
      dismissOnBackdrop={false}
      size="sm"
      title={category ? 'Rename category' : 'New category'}
      description="Categories group cards on the dashboard and in the sidebar."
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" variant="primary">
            {category ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={handleSubmit}>
        <FieldRow label="Category name">
          <Input
            value={name}
            onValueChange={setName}
            placeholder="Media, Infrastructure, Home…"
            required
            autoFocus
          />
        </FieldRow>
      </form>
    </Modal>
  );
}
