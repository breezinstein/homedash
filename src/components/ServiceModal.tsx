import { useState, useEffect, useRef } from 'react';
import type { Service } from '../types';
import { Image, Link2, Upload } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { Modal } from './ui/Modal';
import { FieldRow, Input, SelectField } from './ui/Field';
import { Button } from './ui/Button';
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from '@ui-sdk/react/segmented-control';

interface ServiceModalProps {
  service: Service | null;
  serviceIndex: number | null;
  onClose: () => void;
}

export function ServiceModal({ service, serviceIndex, onClose }: ServiceModalProps) {
  const { config, updateService, addService, uploadIcon } = useDashboard();
  const [formData, setFormData] = useState<Service>({
    name: '',
    url: '',
    icon: '',
    category: '',
    description: '',
  });
  const [iconMode, setIconMode] = useState<'url' | 'upload'>('url');
  const [previewIcon, setPreviewIcon] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (service) {
      setFormData(service);
      setPreviewIcon(service.icon);
    } else {
      setFormData({
        name: '',
        url: '',
        icon: '',
        category: config.categoryOrder[0] || '',
        description: '',
      });
      setPreviewIcon('');
    }
  }, [service, config.categoryOrder]);

  const setField = <K extends keyof Service>(key: K, value: Service[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (serviceIndex !== null) updateService(serviceIndex, formData);
    else addService(formData);
    onClose();
  };

  const handleIconUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const url = await uploadIcon(file);
      setFormData((prev) => ({ ...prev, icon: url }));
      setPreviewIcon(url);
    } catch (error) {
      console.error('Failed to upload icon:', error);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setFormData((prev) => ({ ...prev, icon: base64 }));
        setPreviewIcon(base64);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      dismissOnBackdrop={false}
      size="md"
      title={service ? 'Edit service' : 'Add service'}
      description={service ? 'Update where this card points and how it looks.' : 'Name it, point it at a URL, pick a category.'}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="service-form" variant="primary">
            {service ? 'Save changes' : 'Add service'}
          </Button>
        </>
      }
    >
      <form id="service-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-sunken)]">
            {previewIcon ? (
              <img src={previewIcon} alt="" className="size-10 object-contain" />
            ) : (
              <Image className="size-6 text-[var(--text-tertiary)]" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <SegmentedControl
              aria-label="Icon source"
              className="ui-seg"
              value={iconMode}
              onValueChange={(value) => { if (value) setIconMode(value as 'url' | 'upload'); }}
            >
              <SegmentedControlIndicator />
              <SegmentedControlItem value="url" className="ui-seg-item">
                <Link2 className="size-3.5" aria-hidden="true" /> URL
              </SegmentedControlItem>
              <SegmentedControlItem value="upload" className="ui-seg-item">
                <Upload className="size-3.5" aria-hidden="true" /> Upload
              </SegmentedControlItem>
            </SegmentedControl>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {iconMode === 'url' ? 'Paste a direct image URL.' : 'PNG, SVG or WebP up to 2 MB.'}
            </p>
          </div>
        </div>

        {iconMode === 'url' ? (
          <FieldRow label="Icon URL">
            <Input
              value={formData.icon}
              onValueChange={(value) => {
                setField('icon', value);
                setPreviewIcon(value);
              }}
              placeholder="https://example.com/icon.png"
              type="url"
            />
          </FieldRow>
        ) : (
          <FieldRow label={isUploading ? 'Uploading…' : 'Icon file'}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              disabled={isUploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleIconUpload(file);
              }}
              className="ui-input text-xs file:mr-3 file:rounded-md file:border-0 file:bg-[var(--accent-soft)] file:px-2.5 file:py-1 file:text-[var(--color-primary)]"
            />
          </FieldRow>
        )}

        <FieldRow label="Name">
          <Input
            value={formData.name}
            onValueChange={(value) => setField('name', value)}
            required
            placeholder="Service name"
          />
        </FieldRow>

        <FieldRow label="URL">
          <Input
            value={formData.url}
            onValueChange={(value) => setField('url', value)}
            required
            type="url"
            placeholder="https://service.example.com"
          />
        </FieldRow>

        <FieldRow label="Category">
          <SelectField
            value={formData.category}
            onValueChange={(value) => setField('category', value)}
            placeholder="Select a category"
            ariaLabel="Category"
            options={config.categoryOrder.map((cat) => ({ value: cat, label: cat }))}
          />
        </FieldRow>

        <FieldRow label="Description">
          <Input
            value={formData.description}
            onValueChange={(value) => setField('description', value)}
            placeholder="Brief description"
          />
        </FieldRow>
      </form>
    </Modal>
  );
}
