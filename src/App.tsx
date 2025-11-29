import { useState } from 'react';
import { DashboardProvider, useDashboard } from './context/DashboardContext';
import { Header, CategorySection, ServiceModal, SettingsModal } from './components';
import type { Service } from './types';
import { Plus, FolderPlus, Search } from 'lucide-react';
import { CategoryModal } from './components/CategoryModal';

function Dashboard() {
  const { config, isEditMode, addCategory, updateCategory, searchQuery } = useDashboard();
  const [showSettings, setShowSettings] = useState(false);
  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  // Filter services based on search query
  const filteredServices = searchQuery
    ? config.services.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : config.services;

  // Group services by category
  const servicesByCategory = config.categoryOrder.reduce((acc, category) => {
    acc[category] = filteredServices.filter(s => s.category === category);
    return acc;
  }, {} as Record<string, Service[]>);

  // Find uncategorized services
  const categorizedCategories = new Set(config.categoryOrder);
  const uncategorizedServices = filteredServices.filter(
    s => !categorizedCategories.has(s.category)
  );

  const handleEditService = (index: number) => {
    setEditingServiceIndex(index);
    setShowServiceModal(true);
  };

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

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <Header onSettingsClick={() => setShowSettings(true)} />

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
        {config.categoryOrder.map((category) => {
          const services = servicesByCategory[category] || [];
          // Hide empty categories when searching
          if (searchQuery && services.length === 0) return null;
          return (
            <CategorySection
              key={category}
              category={category}
              services={services}
              onEditService={handleEditService}
              onEditCategory={handleEditCategory}
            />
          );
        })}

        {/* Uncategorized Services */}
        {uncategorizedServices.length > 0 && (
          <CategorySection
            category="Uncategorized"
            services={uncategorizedServices}
            onEditService={handleEditService}
            onEditCategory={handleEditCategory}
          />
        )}

        {/* No Search Results */}
        {searchQuery && filteredServices.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[var(--color-surface)] flex items-center justify-center">
              <Search className="w-10 h-10 text-[var(--color-text-secondary)]" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
              No Results Found
            </h2>
            <p className="text-[var(--color-text-secondary)]">
              No services match "{searchQuery}"
            </p>
          </div>
        )}

        {/* Empty State */}
        {config.services.length === 0 && !searchQuery && (
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

      {/* Modals */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
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
    </div>
  );
}

function App() {
  return (
    <DashboardProvider>
      <Dashboard />
    </DashboardProvider>
  );
}

export default App;
