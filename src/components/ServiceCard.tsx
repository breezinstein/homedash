import { useState } from 'react';
import type { Service } from '../types';
import { ExternalLink, Edit2, Trash2, GripVertical } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

interface ServiceCardProps {
  service: Service;
  index: number;
  onEdit: (index: number) => void;
}

export function ServiceCard({ service, index, onEdit }: ServiceCardProps) {
  const { isEditMode, deleteService } = useDashboard();
  const [imgError, setImgError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleClick = () => {
    if (!isEditMode) {
      window.open(service.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('serviceIndex', index.toString());
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      className={`group relative bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 transition-all duration-200 ${
        isEditMode ? 'cursor-move' : 'cursor-pointer hover:border-[var(--color-primary)] hover:shadow-lg hover:shadow-[var(--color-primary)]/10'
      } ${isDragging ? 'opacity-50' : ''}`}
      onClick={handleClick}
      draggable={isEditMode}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {isEditMode && (
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(index);
            }}
            className="p-1.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 transition-colors"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this service?')) {
                deleteService(index);
              }
            }}
            className="p-1.5 bg-[var(--color-error)] text-white rounded-lg hover:bg-[var(--color-error)]/80 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isEditMode && (
        <div className="absolute top-2 left-2 text-[var(--color-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-4 h-4" />
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-lg bg-[var(--color-background)] flex items-center justify-center flex-shrink-0 overflow-hidden">
          {!imgError && service.icon ? (
            <img
              src={service.icon}
              alt={service.name}
              className="w-8 h-8 object-contain"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center text-white font-bold text-sm">
              {service.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[var(--color-text-primary)] truncate">
              {service.name}
            </h3>
            {!isEditMode && (
              <ExternalLink className="w-3.5 h-3.5 text-[var(--color-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] truncate">
            {service.description}
          </p>
        </div>
      </div>
    </div>
  );
}
