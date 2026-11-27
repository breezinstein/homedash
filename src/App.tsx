import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardProvider, useDashboard } from './context/DashboardContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CategorySection } from './components';
import { ConfirmProvider, ToastProvider, useToast } from './components/ui';
import { AppShell, type ShellTool } from './components/shell/AppShell';
import { CommandPalette, type PaletteAction } from './components/CommandPalette';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Field';
import { useBrowserNotifications } from './components/notifications/useBrowserNotifications';
import { NotificationsBell } from './components/notifications/NotificationsBell';
import { useShortcut } from '@ui-sdk/react/shortcuts';
import type { Service } from './types';
import {
  Activity,
  Bell,
  Clipboard,
  CloudOff,
  FolderOpen,
  FolderPlus,
  LayoutGrid,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sun,
} from 'lucide-react';

const ServiceModal = lazy(() => import('./components/ServiceModal').then(m => ({ default: m.ServiceModal })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const CategoryModal = lazy(() => import('./components/CategoryModal').then(m => ({ default: m.CategoryModal })));
const FileSharing = lazy(() => import('./components/FileSharing').then(m => ({ default: m.FileSharing })));
const ClipboardManager = lazy(() => import('./components/ClipboardManager').then(m => ({ default: m.ClipboardManager })));
const ServerStats = lazy(() => import('./components/ServerStats').then(m => ({ default: m.ServerStats })));
const InverterPanel = lazy(() => import('./components/InverterPanel').then(m => ({ default: m.InverterPanel })));
const NotificationsPanel = lazy(() => import('./components/notifications/NotificationsPanel').then(m => ({ default: m.NotificationsPanel })));
const LoginModal = lazy(() => import('./components/LoginModal').then(m => ({ default: m.LoginModal })));

function SyncErrorReporter() {
  const { syncError } = useDashboard();
  const toast = useToast();
  useEffect(() => {
    if (syncError) toast.error(syncError);
  }, [syncError, toast]);
  return null;
}

function SyncStatus() {
  const { isSyncing, syncError } = useDashboard();
  if (syncError) {
    return (
      <span className="ui-chip" data-tone="danger" title={syncError}>
        <CloudOff className="size-3" aria-hidden="true" /> Offline
      </span>
    );
  }
  if (isSyncing) {
    return (
      <span className="ui-chip" title="Saving to the server">
        <RefreshCw className="size-3 animate-spin" aria-hidden="true" /> Syncing
      </span>
    );
  }
  return null;
}

function Dashboard() {
  const {
    config,
    isEditMode,
    addCategory,
    updateCategory,
    searchQuery,
    setSearchQuery,
    reorderCategories,
    isLoading,
    setIsEditMode,
  } = useDashboard();
  const { authEnabled, authenticated, loginRequired, acknowledgeLoginRequired, logout } = useAuth();

  const [showSettings, setShowSettings] = useState(false);
  const [isFileSharingOpen, setIsFileSharingOpen] = useState(false);
  const [isClipboardOpen, setIsClipboardOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isInverterOpen, setIsInverterOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [categoryDraggedOver, setCategoryDraggedOver] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const canEdit = authenticated;

  // A 401 from any request flips loginRequired: surface the sign-in dialog and
  // drop every privileged surface so the page snaps back to an anonymous state.
  useEffect(() => {
    if (!loginRequired) return;
    setShowLoginModal(true);
    setIsEditMode(false);
    setShowSettings(false);
    setIsClipboardOpen(false);
    setIsStatsOpen(false);
    setIsNotificationsOpen(false);
    setShowServiceModal(false);
    setShowCategoryModal(false);
    setPaletteOpen(false);
  }, [loginRequired, setIsEditMode]);

  const openClipboard = useCallback(() => {
    if (authEnabled && !authenticated) {
      setShowLoginModal(true);
    } else {
      setIsClipboardOpen((prev) => !prev);
    }
  }, [authEnabled, authenticated]);

  useShortcut('mod+k', () => setPaletteOpen(true), { description: 'Search services and actions' });
  useShortcut('mod+shift+c', openClipboard, { description: 'Clipboard' });
  useShortcut('/', () => document.getElementById('service-filter')?.focus(), {
    description: 'Filter services',
  });

  useBrowserNotifications(config.notifications?.browserNotifications ?? false);

  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery), 150);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const filteredServices = useMemo(() => {
    if (!debouncedQuery) return config.services;
    const q = debouncedQuery.toLowerCase();
    return config.services.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    );
  }, [config.services, debouncedQuery]);

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
    if (oldName) updateCategory(oldName, newName);
    else addCategory(newName);
  };

  const openAddService = () => {
    setEditingServiceIndex(null);
    setShowServiceModal(true);
  };

  const openAddCategory = () => {
    setEditingCategory(null);
    setShowCategoryModal(true);
  };

  const handleCategoryDragStart = (e: React.DragEvent, category: string) => {
    e.dataTransfer.setData('draggedCategory', category);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedCategory(category);
  };

  const handleCategoryDragOver = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    if (draggedCategory && draggedCategory !== category) setCategoryDraggedOver(category);
  };

  const handleCategoryDrop = (e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    const sourceCategory = e.dataTransfer.getData('draggedCategory');

    if (sourceCategory && sourceCategory !== targetCategory) {
      const currentOrder = [...config.categoryOrder];
      const sourceIndex = currentOrder.indexOf(sourceCategory);
      const targetIndex = currentOrder.indexOf(targetCategory);

      if (sourceIndex !== -1 && targetIndex !== -1) {
        currentOrder.splice(sourceIndex, 1);
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

  const tools: ShellTool[] = [
    { id: 'files', label: 'File sharing', icon: FolderOpen, onSelect: () => setIsFileSharingOpen(true) },
    { id: 'stats', label: 'Server stats', icon: Activity, onSelect: () => setIsStatsOpen(true), adminOnly: true },
    { id: 'inverter', label: 'Inverter', icon: Sun, onSelect: () => setIsInverterOpen(true), adminOnly: true },
    { id: 'clipboard', label: 'Clipboard', icon: Clipboard, onSelect: openClipboard, adminOnly: true },
    { id: 'notifications', label: 'Notifications', icon: Bell, onSelect: () => setIsNotificationsOpen(true), adminOnly: true },
    { id: 'settings', label: 'Settings', icon: Settings, onSelect: () => setShowSettings(true), adminOnly: true },
  ];

  const paletteActions: PaletteAction[] = [
    ...(canEdit ? [{ id: 'add-service', label: 'Add service', icon: Plus, run: openAddService }] : []),
    ...(canEdit ? [{ id: 'add-category', label: 'Add category', icon: FolderPlus, run: openAddCategory }] : []),
    ...(canEdit
      ? [{
          id: 'toggle-edit',
          label: isEditMode ? 'Leave edit mode' : 'Enter edit mode',
          icon: Pencil,
          run: () => setIsEditMode(!isEditMode),
        }]
      : []),
    ...tools.map((tool) => ({ id: tool.id, label: tool.label, icon: tool.icon, run: tool.onSelect })),
    { id: 'monitor', label: 'Open monitor', icon: LayoutGrid, run: () => window.open('/monitor', '_blank', 'noopener,noreferrer') },
    ...(authEnabled
      ? [{
          id: 'auth',
          label: authenticated ? 'Sign out' : 'Sign in',
          icon: authenticated ? LogOut : LogIn,
          run: authenticated ? () => { void logout(); } : () => setShowLoginModal(true),
        }]
      : []),
  ];

  const editActions = isEditMode && canEdit ? (
    <div className="hidden items-center gap-1.5 sm:flex">
      <Button variant="primary" size="sm" onClick={openAddService}>
        <Plus className="size-3.5" /> Service
      </Button>
      <Button variant="secondary" size="sm" onClick={openAddCategory}>
        <FolderPlus className="size-3.5" /> Category
      </Button>
    </div>
  ) : null;

  const hasResults = filteredServices.length > 0;

  return (
    <AppShell
      tools={tools}
      categories={config.categoryOrder}
      isEditMode={isEditMode}
      canEdit={canEdit}
      onToggleEditMode={setIsEditMode}
      onOpenPalette={() => setPaletteOpen(true)}
      authEnabled={authEnabled}
      authenticated={authenticated}
      onSignIn={() => setShowLoginModal(true)}
      onSignOut={() => { void logout(); }}
      onSettings={() => setShowSettings(true)}
      status={<SyncStatus />}
      editActions={editActions}
      serviceCount={config.services.length}
      notifications={<NotificationsBell onClick={authenticated ? () => setIsNotificationsOpen(true) : () => setShowLoginModal(true)} />}
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-2xl">
            Your services
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {config.services.length} services in {config.categoryOrder.length} categories
            {debouncedQuery ? ` · filtered by “${debouncedQuery}”` : ''}
          </p>
        </div>
        <div className="ml-auto w-full sm:w-64">
          <Input
            id="service-filter"
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder="Filter services…  /"
            aria-label="Filter services"
            className="h-9 text-[0.8125rem]"
          />
        </div>
      </div>

      <div onDragEnd={handleCategoryDragEnd} className="space-y-7">
        {config.categoryOrder.map((category) => {
          const services = servicesByCategory[category] || [];
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

      {uncategorizedServices.length > 0 && (
        <div className="mt-7">
          <CategorySection
            category="Uncategorized"
            services={uncategorizedServices}
            onEditService={handleEditService}
            onEditCategory={handleEditCategory}
          />
        </div>
      )}

      {isLoading && config.services.length === 0 && (
        <div className="space-y-3" aria-hidden="true">
          {Array.from({ length: 2 }).map((_, section) => (
            <div key={section} className="space-y-3">
              <div className="h-5 w-32 animate-pulse rounded-md bg-[var(--color-surface)]" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((__, i) => (
                  <div key={i} className="h-[76px] animate-pulse rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {debouncedQuery && !hasResults && (
        <div className="mx-auto max-w-sm py-16 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <Search className="size-6 text-[var(--color-text-secondary)]" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">No matches</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Nothing matches “{debouncedQuery}”. Clear the filter to see everything again.
          </p>
          <Button variant="secondary" className="mt-4" onClick={() => setSearchQuery('')}>
            Clear filter
          </Button>
        </div>
      )}

      {!isLoading && config.services.length === 0 && !debouncedQuery && (
        <div className="mx-auto max-w-sm py-16 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <Plus className="size-6 text-[var(--color-text-secondary)]" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">No services yet</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Import a configuration file from Settings, or add your first service.
          </p>
          <Button variant="primary" className="mt-4" onClick={openAddService} disabled={!canEdit}>
            <Plus className="size-4" /> Add your first service
          </Button>
        </div>
      )}

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          actions={paletteActions}
          onEditService={handleEditService}
        />
      )}

      <Suspense fallback={null}>
        {showSettings && authenticated && <SettingsModal onClose={() => setShowSettings(false)} />}
        {isFileSharingOpen && <FileSharing onClose={() => setIsFileSharingOpen(false)} />}
        {isClipboardOpen && authenticated && <ClipboardManager onClose={() => setIsClipboardOpen(false)} />}
        {isStatsOpen && authenticated && <ServerStats onClose={() => setIsStatsOpen(false)} />}
        {isInverterOpen && authenticated && <InverterPanel onClose={() => setIsInverterOpen(false)} />}
        {isNotificationsOpen && authenticated && <NotificationsPanel onClose={() => setIsNotificationsOpen(false)} />}
        {showServiceModal && authenticated && (
          <ServiceModal
            service={editingServiceIndex !== null ? config.services[editingServiceIndex] : null}
            serviceIndex={editingServiceIndex}
            onClose={() => {
              setShowServiceModal(false);
              setEditingServiceIndex(null);
            }}
          />
        )}
        {showCategoryModal && authenticated && (
          <CategoryModal
            category={editingCategory}
            onSave={handleCategorySave}
            onClose={() => {
              setShowCategoryModal(false);
              setEditingCategory(null);
            }}
          />
        )}
        {showLoginModal && (
          <LoginModal
            forced={loginRequired}
            onClose={() => {
              setShowLoginModal(false);
              acknowledgeLoginRequired();
            }}
          />
        )}
      </Suspense>
    </AppShell>
  );
}

function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <DashboardProvider>
            <SyncErrorReporter />
            <Dashboard />
          </DashboardProvider>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;
