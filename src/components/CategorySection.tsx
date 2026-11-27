import { useState, useRef, useCallback } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { ServiceCard } from './ServiceCard';
import type { Service } from '../types';
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Edit2,
  FolderPlus,
  GripVertical,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import { useConfirm, useToast } from './ui';
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@ui-sdk/react/collapsible';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@ui-sdk/react/menu';
import { categoryId } from '../lib/slug';

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
  categoryDraggedOver,
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
    serviceIndexByRef,
  } = useDashboard();
  const confirm = useConfirm();
  const toast = useToast();

  const [isDragOver, setIsDragOver] = useState(false);
  const [serviceDragOverIndex, setServiceDragOverIndex] = useState<number | null>(null);
  const draggedServiceRef = useRef<{ index: number; category: string } | null>(null);
  const isCollapsed = collapsedCategories.includes(category);
  const isCategoryDraggedOver = categoryDraggedOver === category;
  const isUncategorized = category === 'Uncategorized';

  const getServiceGlobalIndex = (service: Service) => {
    const cached = serviceIndexByRef.get(service);
    if (cached !== undefined) return cached;
    return config.services.indexOf(service);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('serviceglobalindex')) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX: x, clientY: y } = e;
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
      if (service && service.category !== category) {
        moveServiceToCategory(sourceGlobalIndex, category);
      }
    }
  };

  const handleServiceDragStart = useCallback((e: React.DragEvent, service: Service, localIndex: number) => {
    const globalIndex = serviceIndexByRef.get(service) ?? config.services.indexOf(service);
    e.dataTransfer.setData('serviceglobalindex', globalIndex.toString());
    e.dataTransfer.setData('sourcelocalindex', localIndex.toString());
    e.dataTransfer.setData('sourcecategory', category);
    e.dataTransfer.effectAllowed = 'move';
    draggedServiceRef.current = { index: localIndex, category };
  }, [category, serviceIndexByRef, config.services]);

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
      if (sourceLocalIndex !== targetLocalIndex) {
        reorderServicesInCategory(category, sourceLocalIndex, targetLocalIndex);
      }
    } else {
      moveServiceToCategory(sourceGlobalIndex, category, targetLocalIndex);
    }
  };

  const handleServiceDragEnd = useCallback(() => {
    draggedServiceRef.current = null;
    setServiceDragOverIndex(null);
  }, []);

  const handleAddService = () => {
    addService({
      name: 'New Service',
      url: 'https://example.com',
      icon: '',
      category,
      description: 'Service description',
    });
  };

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

  const handleCategoryAction = async (action: string) => {
    if (action === 'add-service') handleAddService();
    if (action === 'edit') onEditCategory(category);
    if (action === 'up') swapCategory(-1);
    if (action === 'down') swapCategory(1);
    if (action === 'delete') {
      const ok = await confirm({
        title: 'Delete category',
        message: `Delete category "${category}" and all its services? This cannot be undone.`,
        confirmLabel: 'Delete',
        tone: 'danger',
      });
      if (!ok) return;
      deleteCategory(category);
      toast.success(`Category "${category}" deleted`);
    }
  };

  return (
    <section
      id={categoryId(category)}
      className={`scroll-mt-24 rounded-[var(--radius-lg)] transition-shadow ${
        isDragOver || isCategoryDraggedOver ? 'ring-2 ring-[var(--color-primary)] ring-offset-2 ring-offset-[var(--color-background)]' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Collapsible
        open={!isCollapsed}
        onOpenChange={(open) => {
          if (open === isCollapsed) toggleCategoryCollapse(category);
        }}
      >
        <div
          className="group mb-3 flex items-center gap-1.5"
          draggable={isEditMode && !isUncategorized}
          onDragStart={(e) => onCategoryDragStart?.(e, category)}
          onDragOver={(e) => onCategoryDragOver?.(e, category)}
          onDrop={(e) => onCategoryDrop?.(e, category)}
        >
          <CollapsibleTrigger className="flex min-w-0 items-center gap-1.5 rounded-[var(--radius-xs)] py-1 pr-2 text-left text-[0.9375rem] font-semibold tracking-tight text-[var(--color-text-primary)] hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]">
            <ChevronRight
              className={`size-4 shrink-0 text-[var(--color-text-secondary)] transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
              aria-hidden="true"
            />
            <span className="truncate">{category}</span>
            <span className="ui-chip tabular-nums">{services.length}</span>
          </CollapsibleTrigger>

          {isEditMode && !isUncategorized && (
            <div className="ml-auto flex items-center gap-1">
              <Menu onAction={(action) => { void handleCategoryAction(action); }}>
                <MenuTrigger
                  aria-label={`Actions for ${category}`}
                  className="ui-btn"
                  data-variant="ghost"
                  data-size="icon"
                >
                  <MoreHorizontal className="size-4" />
                </MenuTrigger>
                <MenuContent className="ui-popup">
                  <MenuItem value="add-service" className="ui-menu-item">
                    <Plus className="size-4" aria-hidden="true" /> Add service
                  </MenuItem>
                  <MenuItem value="edit" className="ui-menu-item">
                    <Edit2 className="size-4" aria-hidden="true" /> Rename category
                  </MenuItem>
                  <MenuSeparator className="ui-menu-separator" />
                  <MenuItem value="up" className="ui-menu-item" disabled={!canMoveCategoryUp}>
                    <ArrowUp className="size-4" aria-hidden="true" /> Move up
                  </MenuItem>
                  <MenuItem value="down" className="ui-menu-item" disabled={!canMoveCategoryDown}>
                    <ArrowDown className="size-4" aria-hidden="true" /> Move down
                  </MenuItem>
                  <MenuSeparator className="ui-menu-separator" />
                  <MenuItem value="delete" className="ui-menu-item" data-tone="danger">
                    <Trash2 className="size-4" aria-hidden="true" /> Delete category
                  </MenuItem>
                </MenuContent>
              </Menu>
              <span className="hidden cursor-grab p-1.5 text-[var(--text-tertiary)] active:cursor-grabbing sm:block">
                <GripVertical className="size-4" aria-hidden="true" />
              </span>
            </div>
          )}
        </div>

        <CollapsiblePanel>
          <div className={`grid gap-3 ${gridCols}`}>
            {services.map((service, localIndex) => {
              const globalIndex = getServiceGlobalIndex(service);
              return (
                <div
                  key={globalIndex}
                  className={`transition-shadow ${serviceDragOverIndex === localIndex ? 'rounded-[var(--radius-md)] ring-2 ring-[var(--color-accent)]' : ''}`}
                  onDragOver={(e) => handleServiceDragOver(e, localIndex)}
                  onDrop={(e) => handleServiceDrop(e, localIndex)}
                >
                  <ServiceCard
                    service={service}
                    index={globalIndex}
                    localIndex={localIndex}
                    onEdit={onEditService}
                    onDragStart={handleServiceDragStart}
                    onDragEnd={handleServiceDragEnd}
                  />
                  {isEditMode && services.length > 1 && (
                    <div className="mt-1.5 flex items-center gap-1.5 sm:hidden">
                      <button
                        type="button"
                        onClick={() => moveServiceWithin(localIndex, -1)}
                        disabled={localIndex === 0}
                        className="flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-xs)] border border-[var(--color-border)] py-1 text-[11px] text-[var(--color-text-secondary)] disabled:opacity-30"
                        aria-label="Move service up"
                      >
                        <ArrowUp className="size-3" aria-hidden="true" /> Up
                      </button>
                      <button
                        type="button"
                        onClick={() => moveServiceWithin(localIndex, 1)}
                        disabled={localIndex === services.length - 1}
                        className="flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-xs)] border border-[var(--color-border)] py-1 text-[11px] text-[var(--color-text-secondary)] disabled:opacity-30"
                        aria-label="Move service down"
                      >
                        <ArrowDown className="size-3" aria-hidden="true" /> Down
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {services.length === 0 && isEditMode && !isUncategorized && (
              <button
                type="button"
                onClick={handleAddService}
                className="flex min-h-[76px] items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--accent-line)] hover:text-[var(--color-text-primary)]"
              >
                <FolderPlus className="size-4" aria-hidden="true" /> Add the first service
              </button>
            )}
          </div>
        </CollapsiblePanel>
      </Collapsible>
    </section>
  );
}
