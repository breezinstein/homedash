import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from '@ui-sdk/react/segmented-control';

interface EditModeToggleProps {
  isEditMode: boolean;
  onToggleEditMode: (edit: boolean) => void;
  canEdit: boolean;
}

export function EditModeToggle({ isEditMode, onToggleEditMode, canEdit }: EditModeToggleProps) {
  if (!canEdit) return null;
  return (
    <SegmentedControl
      aria-label="Mode"
      className="ui-seg"
      value={isEditMode ? 'edit' : 'view'}
      onValueChange={(value) => {
        if (value) onToggleEditMode(value === 'edit');
      }}
    >
      <SegmentedControlIndicator />
      <SegmentedControlItem value="view" className="ui-seg-item">
        View
      </SegmentedControlItem>
      <SegmentedControlItem value="edit" className="ui-seg-item">
        Edit
      </SegmentedControlItem>
    </SegmentedControl>
  );
}
