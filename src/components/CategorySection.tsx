import { useState, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { ServiceCard } from './ServiceCard';
import type { Service } from '../types';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useConfirm, useToast } from './ui';

interface CategorySectionProps {
  category: string;
  services: Service[];
  onEditService: (index: number) => void;
  onEditCategory: (category: string) => void;
  onCategoryDragStart?: (e: React.DragEvent, category: string) => void;
  onCategoryDragOver?: (e: React.DragEvent, category: string) => void;
  onCategoryDrop?: (e: React.DragEvent, category: string) => void;
  categoryDraggedOver?: string | null;
}

export function CategorySection({ 
  category, 
  services, 
  onEditService,
  onEditCategory,
  onCategoryDragStart,
  onCategoryDragOver,
  onCategoryDrop,
  categoryDraggedOver
}: CategorySectionProps) {
  const { 
    config, 
    isEditMode, 
    deleteCategory, 
    collapsedCategories, 
    toggleCategoryCollapse,
    addService,
    moveServiceToCategory,
    reorderServicesInCategory,
    reorderCategories,
    serviceIndexByRef
  } = useDashboard();
  const confirm = useConfirm();
  const toast = useToast();
  
  const [isDragOver, setIsDragOver] = useState(false);
  const [serviceDragOverIndex, setServiceDragOverIndex] = useState<number | null>(null);
  const draggedServiceRef = useRef<{ index: number; category: string } | null>(null);
  const isCollapsed = collapsedCategories.includes(category);
  const isCategoryDraggedOver = categoryDraggedOver === category;

  // Look up the service's index in `config.services` from the precomputed
  // ref→index map (O(1)). Falls back to indexOf for the rare case of a
  // freshly added service whose ref isn't in the map yet.
  const getServiceGlobalIndex = (service: Service) => {
    const cached = serviceIndexByRef.get(service);
    if (cached !== undefined) return cached;
    return config.services.indexOf(service);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const dragType = e.dataTransfer.types.includes('serviceglobalindex') ? 'service' : null;
    if (dragType === 'service') {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only set drag over false if leaving the container, not entering a child
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
      setServiceDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setServiceDragOverIndex(null);
    
    const sourceGlobalIndex = parseInt(e.dataTransfer.getData('serviceglobalindex'));
    
    if (!isNaN(sourceGlobalIndex)) {
      const service = config.services[sourceGlobalIndex];
      if (service) {
        if (service.category !== category) {
          // Moving to different category - add at end
          moveServiceToCategory(sourceGlobalIndex, category);
        }
      }
    }
  };

  const handleServiceDragStart = (e: React.DragEvent, service: Service, localIndex: number) => {
    const globalIndex = getServiceGlobalIndex(service);
    e.dataTransfer.setData('serviceglobalindex', globalIndex.toString());
    e.dataTransfer.setData('sourcelocalindex', localIndex.toString());
    e.dataTransfer.setData('sourcecategory', category);
    e.dataTransfer.effectAllowed = 'move';
    draggedServiceRef.current = { index: localIndex, category };
  };

  const handleServiceDragOver = (e: React.DragEvent, targetLocalIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setServiceDragOverIndex(targetLocalIndex);
  };

  const handleServiceDrop = (e: React.DragEvent, targetLocalIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setServiceDragOverIndex(null);

    const sourceGlobalIndex = parseInt(e.dataTransfer.getData('serviceglobalindex'));
    const sourceLocalIndex = parseInt(e.dataTransfer.getData('sourcelocalindex'));
    const sourceCategory = e.dataTransfer.getData('sourcecategory');

    if (isNaN(sourceGlobalIndex)) return;

    if (sourceCategory === category) {
      // Reordering within same category
      if (sourceLocalIndex !== targetLocalIndex) {
        reorderServicesInCategory(category, sourceLocalIndex, targetLocalIndex);
      }
    } else {
      // Moving from different category
      moveServiceToCategory(sourceGlobalIndex, category, targetLocalIndex);
    }
  };

  const handleServiceDragEnd = () => {
    draggedServiceRef.current = null;
    setServiceDragOverIndex(null);
  };

  const handleAddService = () => {
    const newService: Service = {
      name: 'New Service',
      url: 'https://example.com',
      icon: '',
      category: category,
      description: 'Service description'
    };
    addService(newService);
  };

  // Category position in the canonical order array.
  const categoryIdx = config.categoryOrder.indexOf(category);
  const canMoveCategoryUp = categoryIdx > 0;
  const canMoveCategoryDown = categoryIdx !== -1 && categoryIdx < config.categoryOrder.length - 1;

  const swapCategory = (direction: -1 | 1) => {
    if (categoryIdx === -1) return;
    const next = [...config.categoryOrder];
    const target = categoryIdx + direction;
    if (target < 0 || target >= next.length) return;
    [next[categoryIdx], next[target]] = [next[target], next[categoryIdx]];
    reorderCategories(next);
  };

  const moveCategoryUp = () => swapCategory(-1);
  const moveCategoryDown = () => swapCategory(1);

  const moveServiceWithin = (fromLocalIdx: number, direction: -1 | 1) => {
    const toLocalIdx = fromLocalIdx + direction;
    if (toLocalIdx < 0 || toLocalIdx >= services.length) return;
    reorderServicesInCategory(category, fromLocalIdx, toLocalIdx);
  };

  const gridCols = {
    '2': 'grid-cols-1 sm:grid-cols-2',
    '3': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    '4': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    '5': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
    '6': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
  }[config.gridColumns] || 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  const handleCategoryDragStart = (e: React.DragEvent) => {
    if (onCategoryDragStart) {
      onCategoryDragStart(e, category);
    }
  };

  const handleCategoryDragOver = (e: React.DragEvent) => {
    if (onCategoryDragOver) {
      onCategoryDragOver(e, category);
    }
  };

  const handleCategoryDrop = (e: React.DragEvent) => {
    if (onCategoryDrop) {
      onCategoryDrop(e, category);
    }
  };

  return (
    <div 
      className={`mb-6 transition-all ${isDragOver || isCategoryDraggedOver ? 'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-background)] rounded-xl' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div 
        className="flex items-center justify-between mb-3 group"
        draggable={isEditMode}
        onDragStart={handleCategoryDragStart}
        onDragOver={handleCategoryDragOver}
        onDrop={handleCategoryDrop}
      >
        <button
          onClick={() => toggleCategoryCollapse(category)}
          className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
          {category}
          <span className="text-sm font-normal text-[var(--color-text-secondary)]">
            ({services.length})
          </span>
        </button>

        {isEditMode && (
          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => moveCategoryUp()}
              disabled={!canMoveCategoryUp}
              className="p-2 -m-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] active:bg-[var(--color-border)] rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
              title="Move category up"
              aria-label="Move category up"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => moveCategoryDown()}
              disabled={!canMoveCategoryDown}
              className="p-2 -m-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] active:bg-[var(--color-border)] rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
              title="Move category down"
              aria-label="Move category down"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <button
              onClick={handleAddService}
              className="p-2 -m-0.5 text-[var(--color-success)] hover:bg-[var(--color-success)]/10 active:bg-[var(--color-success)]/20 rounded-lg transition-colors"
              title="Add Service"
              aria-label="Add service"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEditCategory(category)}
              className="p-2 -m-0.5 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 active:bg-[var(--color-primary)]/20 rounded-lg transition-colors"
              title="Edit Category"
              aria-label="Edit category"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: 'Delete category',
                  message: `Delete category "${category}" and all its services? This cannot be undone.`,
                  confirmLabel: 'Delete',
                  tone: 'danger',
                });
                if (!ok) return;
                deleteCategory(category);
                toast.success(`Category "${category}" deleted`);
              }}
              className="p-2 -m-0.5 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 active:bg-[var(--color-error)]/20 rounded-lg transition-colors"
              title="Delete Category"
              aria-label="Delete category"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="hidden sm:flex p-1.5 text-[var(--color-text-secondary)] cursor-grab active:cursor-grabbing">
              <GripVertical className="w-4 h-4" />
            </div>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div className={`grid ${gridCols} gap-4`}>
          {services.map((service, localIndex) => (
            <div
              key={`${service.name}-${service.url}`}
              className={`transition-all ${serviceDragOverIndex === localIndex ? 'ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-background)] rounded-xl' : ''}`}
              onDragOver={(e) => handleServiceDragOver(e, localIndex)}
              onDrop={(e) => handleServiceDrop(e, localIndex)}
            >
              <ServiceCard
                service={service}
                index={getServiceGlobalIndex(service)}
                onEdit={onEditService}
                onDragStart={(e) => handleServiceDragStart(e, service, localIndex)}
                onDragEnd={handleServiceDragEnd}
              />
              {isEditMode && services.length > 1 && (
                <div className="flex sm:hidden items-center gap-2 mt-2">
                  <button
                    onClick={() => moveServiceWithin(localIndex, -1)}
                    disabled={localIndex === 0}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] active:bg-[var(--color-border)] rounded-lg text-xs disabled:opacity-30 disabled:pointer-events-none transition-colors border border-[var(--color-border)]"
                    aria-label="Move service up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                    Up
                  </button>
                  <button
                    onClick={() => moveServiceWithin(localIndex, 1)}
                    disabled={localIndex === services.length - 1}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] active:bg-[var(--color-border)] rounded-lg text-xs disabled:opacity-30 disabled:pointer-events-none transition-colors border border-[var(--color-border)]"
                    aria-label="Move service down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    Down
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
