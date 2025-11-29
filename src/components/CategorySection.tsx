import { useState } from 'react';
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
}

export function CategorySection({ 
  category, 
  services, 
  onEditService,
  onEditCategory 
}: CategorySectionProps) {
  const { 
    config, 
    isEditMode, 
    deleteCategory, 
    collapsedCategories, 
    toggleCategoryCollapse,
    addService
  } = useDashboard();
  
  const [isDragOver, setIsDragOver] = useState(false);
  const isCollapsed = collapsedCategories.includes(category);

  const getServiceGlobalIndex = (service: Service) => {
    return config.services.findIndex(
      s => s.name === service.name && s.url === service.url
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    // Handle service drop to move between categories
    const sourceIndex = parseInt(e.dataTransfer.getData('serviceIndex'));
    if (!isNaN(sourceIndex)) {
      const service = config.services[sourceIndex];
      if (service && service.category !== category) {
        // Update service category
        const updatedService = { ...service, category };
        const newServices = [...config.services];
        newServices[sourceIndex] = updatedService;
        // This would need to be handled by context
      }
    }
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

  return (
    <div 
      className={`mb-6 ${isDragOver ? 'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-background)] rounded-xl' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-3 group">
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
            <div className="p-1.5 text-[var(--color-text-secondary)] cursor-grab">
              <GripVertical className="w-4 h-4" />
            </div>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div className={`grid ${gridCols} gap-4`}>
          {services.map((service) => (
            <ServiceCard
              key={`${service.name}-${service.url}`}
              service={service}
              index={getServiceGlobalIndex(service)}
              onEdit={onEditService}
            />
          ))}
        </div>
      )}
    </div>
  );
}
