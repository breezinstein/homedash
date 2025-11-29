import { useState, useEffect } from 'react';
import type { Service } from '../types';
import { X, Upload, Link, Image } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

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
    description: ''
  });
  const [iconMode, setIconMode] = useState<'url' | 'upload'>('url');
  const [previewIcon, setPreviewIcon] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

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
        description: ''
      });
    }
  }, [service, config.categoryOrder]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (serviceIndex !== null) {
      updateService(serviceIndex, formData);
    } else {
      addService(formData);
    }
    onClose();
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        // Upload to server
        const url = await uploadIcon(file);
        setFormData({ ...formData, icon: url });
        setPreviewIcon(url);
      } catch (error) {
        console.error('Failed to upload icon:', error);
        // Fallback to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setFormData({ ...formData, icon: base64 });
          setPreviewIcon(base64);
        };
        reader.readAsDataURL(file);
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {service ? 'Edit Service' : 'Add Service'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Icon Preview */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-xl bg-[var(--color-background)] flex items-center justify-center overflow-hidden border-2 border-dashed border-[var(--color-border)]">
              {previewIcon ? (
                <img src={previewIcon} alt="Icon" className="w-12 h-12 object-contain" />
              ) : (
                <Image className="w-8 h-8 text-[var(--color-text-secondary)]" />
              )}
            </div>
          </div>

          {/* Icon Mode Toggle */}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setIconMode('url')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                iconMode === 'url'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-background)] text-[var(--color-text-secondary)]'
              }`}
            >
              <Link className="w-4 h-4" />
              URL
            </button>
            <button
              type="button"
              onClick={() => setIconMode('upload')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                iconMode === 'upload'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-background)] text-[var(--color-text-secondary)]'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
          </div>

          {/* Icon Input */}
          {iconMode === 'url' ? (
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Icon URL
              </label>
              <input
                type="url"
                value={formData.icon}
                onChange={(e) => {
                  setFormData({ ...formData, icon: e.target.value });
                  setPreviewIcon(e.target.value);
                }}
                placeholder="https://example.com/icon.png"
                className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Upload Icon {isUploading && <span className="text-[var(--color-primary)]">(uploading...)</span>}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleIconUpload}
                disabled={isUploading}
                className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-[var(--color-primary)] file:text-white file:cursor-pointer disabled:opacity-50"
              />
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Service Name"
              className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              URL *
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              required
              placeholder="https://service.example.com"
              className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Category *
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              required
              className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
            >
              <option value="">Select Category</option>
              {config.categoryOrder.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description"
              className="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-[var(--color-background)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 transition-colors"
            >
              {service ? 'Save Changes' : 'Add Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
