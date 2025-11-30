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
  GripVertical 
} from 'lucide-react';

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
    reorderServicesInCategory
  } = useDashboard();
  
  const [isDragOver, setIsDragOver] = useState(false);
  const [serviceDragOverIndex, setServiceDragOverIndex] = useState<number | null>(null);
  const draggedServiceRef = useRef<{ index: number; category: string } | null>(null);
  const isCollapsed = collapsedCategories.includes(category);
  const isCategoryDraggedOver = categoryDraggedOver === category;

  const getServiceGlobalIndex = (service: Service) => {
    return config.services.findIndex(
      s => s.name === service.name && s.url === service.url
    );
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

  const gridCols = {
    '2': 'grid-cols-1 sm:grid-cols-2',
    '3': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    '4': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    '5': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
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
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleAddService}
              className="p-1.5 text-[var(--color-success)] hover:bg-[var(--color-success)]/10 rounded-lg transition-colors"
              title="Add Service"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEditCategory(category)}
              className="p-1.5 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-colors"
              title="Edit Category"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete category "${category}" and all its services?`)) {
                  deleteCategory(category);
                }
              }}
              className="p-1.5 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 rounded-lg transition-colors"
              title="Delete Category"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="p-1.5 text-[var(--color-text-secondary)] cursor-grab active:cursor-grabbing">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
