import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardProvider, useDashboard } from './context/DashboardContext';
import { Header, CategorySection } from './components';
import { ConfirmProvider, ToastProvider, useToast } from './components/ui';
import type { Service } from './types';
import { Plus, FolderPlus, Search } from 'lucide-react';

// Modals are heavy and only mount when opened; splitting them keeps the
// initial bundle small. The fallback is null because modals already
// render over a transparent backdrop and a flash of "Loading..." would
// be more jarring than nothing for the ~1 RTT it takes to fetch.
const ServiceModal = lazy(() => import('./components/ServiceModal').then(m => ({ default: m.ServiceModal })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const CategoryModal = lazy(() => import('./components/CategoryModal').then(m => ({ default: m.CategoryModal })));
const FileSharing = lazy(() => import('./components/FileSharing').then(m => ({ default: m.FileSharing })));
const ClipboardManager = lazy(() => import('./components/ClipboardManager').then(m => ({ default: m.ClipboardManager })));
const ServerStats = lazy(() => import('./components/ServerStats').then(m => ({ default: m.ServerStats })));

// Bridge: dashboard sync errors surface as toasts. Lives inside both
// providers so it has access to both contexts. Keeps the cross-cutting
// concern out of DashboardContext itself.
function SyncErrorReporter() {
  const { syncError } = useDashboard();
  const toast = useToast();
  useEffect(() => {
    if (syncError) toast.error(syncError);
  }, [syncError, toast]);
  return null;
}

function Dashboard() {
  const { config, isEditMode, addCategory, updateCategory, searchQuery, reorderCategories, isLoading } = useDashboard();
  const [showSettings, setShowSettings] = useState(false);
  const [isFileSharingOpen, setIsFileSharingOpen] = useState(false);
  const [isClipboardOpen, setIsClipboardOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [categoryDraggedOver, setCategoryDraggedOver] = useState<string | null>(null);

  // Global shortcut: Ctrl/Cmd+Shift+C opens the multi-clipboard.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setIsClipboardOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Debounce the query that actually drives filtering/grouping so typing stays
  // snappy on large service lists — the controlled input (in Header) still
  // updates instantly, but the expensive filter+regroup+rerender only runs
  // after the user pauses.
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery), 150);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // Filter services based on search query
  const filteredServices = useMemo(() => {
    if (!debouncedQuery) return config.services;
    const q = debouncedQuery.toLowerCase();
    return config.services.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    );
  }, [config.services, debouncedQuery]);

  // Group services by category
  const { servicesByCategory, uncategorizedServices } = useMemo(() => {
    const byCategory = config.categoryOrder.reduce((acc, category) => {
      acc[category] = [];
      return acc;
    }, {} as Record<string, Service[]>);

    const categoryOrderSet = new Set(config.categoryOrder);
    const uncategorized: Service[] = [];
    for (const service of filteredServices) {
      if (categoryOrderSet.has(service.category)) {
        byCategory[service.category].push(service);
      } else {
        uncategorized.push(service);
      }
    }
    return { servicesByCategory: byCategory, uncategorizedServices: uncategorized };
  }, [filteredServices, config.categoryOrder]);

  const handleEditService = useCallback((index: number) => {
    setEditingServiceIndex(index);
    setShowServiceModal(true);
  }, []);

  const handleEditCategory = (category: string) => {
    setEditingCategory(category);
    setShowCategoryModal(true);
  };

  const handleCategorySave = (oldName: string | null, newName: string) => {
    if (oldName) {
      updateCategory(oldName, newName);
    } else {
      addCategory(newName);
    }
  };

  // Category drag and drop handlers
  const handleCategoryDragStart = (e: React.DragEvent, category: string) => {
    e.dataTransfer.setData('draggedCategory', category);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedCategory(category);
  };

  const handleCategoryDragOver = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    if (draggedCategory && draggedCategory !== category) {
      setCategoryDraggedOver(category);
    }
  };

  const handleCategoryDrop = (e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    const sourceCategory = e.dataTransfer.getData('draggedCategory');
    
    if (sourceCategory && sourceCategory !== targetCategory) {
      const currentOrder = [...config.categoryOrder];
      const sourceIndex = currentOrder.indexOf(sourceCategory);
      const targetIndex = currentOrder.indexOf(targetCategory);
      
      if (sourceIndex !== -1 && targetIndex !== -1) {
        // Remove from source position
        currentOrder.splice(sourceIndex, 1);
        // Insert at target position
        currentOrder.splice(targetIndex, 0, sourceCategory);
        reorderCategories(currentOrder);
      }
    }
    
    setDraggedCategory(null);
    setCategoryDraggedOver(null);
  };

  const handleCategoryDragEnd = () => {
    setDraggedCategory(null);
    setCategoryDraggedOver(null);
  };

  return (
    <div className="min-h-screen min-h-dvh bg-[var(--color-background)]">
      <Header
        onSettingsClick={() => setShowSettings(true)}
        onFileSharingClick={() => setIsFileSharingOpen(true)}
        onClipboardClick={() => setIsClipboardOpen(true)}
        onStatsClick={() => setIsStatsOpen(true)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Edit Mode Actions */}
        {isEditMode && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => {
                setEditingServiceIndex(null);
                setShowServiceModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Service
            </button>
            <button
              onClick={() => {
                setEditingCategory(null);
                setShowCategoryModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent)]/80 transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              Add Category
            </button>
          </div>
        )}

        {/* Categories */}
        <div onDragEnd={handleCategoryDragEnd}>
          {config.categoryOrder.map((category) => {
            const services = servicesByCategory[category] || [];
            // Hide empty categories when searching
            if (debouncedQuery && services.length === 0) return null;
            return (
              <CategorySection
                key={category}
                category={category}
                services={services}
                onEditService={handleEditService}
                onEditCategory={handleEditCategory}
                onCategoryDragStart={handleCategoryDragStart}
                onCategoryDragOver={handleCategoryDragOver}
                onCategoryDrop={handleCategoryDrop}
                categoryDraggedOver={categoryDraggedOver}
              />
            );
          })}
        </div>

        {/* Uncategorized Services */}
        {uncategorizedServices.length > 0 && (
          <CategorySection
            category="Uncategorized"
            services={uncategorizedServices}
            onEditService={handleEditService}
            onEditCategory={handleEditCategory}
          />
        )}

        {/* Initial load skeleton — avoids flashing the empty state before
            the server config arrives. Only shown while nothing is loaded yet. */}
        {isLoading && config.services.length === 0 && (
          <div className="space-y-3" aria-hidden="true">
            <div className="h-6 w-40 rounded-lg bg-[var(--color-surface)] animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[88px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] animate-pulse"
                />
              ))}
            </div>
          </div>
        )}

        {/* No Search Results */}
        {debouncedQuery && filteredServices.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[var(--color-surface)] flex items-center justify-center">
              <Search className="w-10 h-10 text-[var(--color-text-secondary)]" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
              No Results Found
            </h2>
            <p className="text-[var(--color-text-secondary)]">
              No services match "{debouncedQuery}"
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && config.services.length === 0 && !debouncedQuery && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[var(--color-surface)] flex items-center justify-center">
              <Plus className="w-10 h-10 text-[var(--color-text-secondary)]" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
              No Services Yet
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-6">
              Import a configuration file or add services manually
            </p>
            <button
              onClick={() => {
                setEditingServiceIndex(null);
                setShowServiceModal(true);
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Your First Service
            </button>
          </div>
        )}
      </main>

      {/* Modals (lazy-loaded; tiny chunk fetched on first open) */}
      <Suspense fallback={null}>
        {showSettings && (
          <SettingsModal onClose={() => setShowSettings(false)} />
        )}

        {isFileSharingOpen && (
          <FileSharing onClose={() => setIsFileSharingOpen(false)} />
        )}

        {isClipboardOpen && (
          <ClipboardManager onClose={() => setIsClipboardOpen(false)} />
        )}

        {isStatsOpen && (
          <ServerStats onClose={() => setIsStatsOpen(false)} />
        )}

        {showServiceModal && (
          <ServiceModal
            service={editingServiceIndex !== null ? config.services[editingServiceIndex] : null}
            serviceIndex={editingServiceIndex}
            onClose={() => {
              setShowServiceModal(false);
              setEditingServiceIndex(null);
            }}
          />
        )}

        {showCategoryModal && (
          <CategoryModal
            category={editingCategory}
            onSave={handleCategorySave}
            onClose={() => {
              setShowCategoryModal(false);
              setEditingCategory(null);
            }}
          />
        )}
      </Suspense>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <DashboardProvider>
          <SyncErrorReporter />
          <Dashboard />
        </DashboardProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;
