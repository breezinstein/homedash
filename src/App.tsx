import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DashboardProvider, useDashboard } from './context/DashboardContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CategorySection } from './components';
import { ConfirmProvider, ToastProvider, useToast } from './components/ui';
import { AppShell, type ShellTool } from './components/shell/AppShell';
import { PageHeader } from './components/shell/PageHeader';
import { CommandPalette, type PaletteAction } from './components/CommandPalette';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Field';
import { EditModeToggle } from './components/ui/EditModeToggle';
import { useBrowserNotifications } from './components/notifications/useBrowserNotifications';
import { NotificationsBell } from './components/notifications/NotificationsBell';
import { useShortcut } from '@ui-sdk/react/shortcuts';
import { formatRoute, parseRoute, type View } from './lib/route';
import { canLeave, guardPopState } from './lib/navGuard';
import { useFiringAlerts } from './monitor/useFiringAlerts';
import type { Service } from './types';
import type { SectionKey as SettingsSection } from './components/SettingsView';
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
const SettingsView = lazy(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })));
const CategoryModal = lazy(() => import('./components/CategoryModal').then(m => ({ default: m.CategoryModal })));
const FileSharing = lazy(() => import('./components/FileSharing').then(m => ({ default: m.FileSharing })));
const ClipboardManager = lazy(() => import('./components/ClipboardManager').then(m => ({ default: m.ClipboardManager })));
const ServerStats = lazy(() => import('./components/ServerStats').then(m => ({ default: m.ServerStats })));
const InverterPanel = lazy(() => import('./components/InverterPanel').then(m => ({ default: m.InverterPanel })));
const NotificationsPanel = lazy(() => import('./components/notifications/NotificationsPanel').then(m => ({ default: m.NotificationsPanel })));
const LoginModal = lazy(() => import('./components/LoginModal').then(m => ({ default: m.LoginModal })));
const MonitorView = lazy(() => import('./monitor/view/MonitorView').then(m => ({ default: m.MonitorView })));

const initialRoute = parseRoute(window.location.pathname);

const ADMIN_VIEWS: View[] = ['stats', 'inverter', 'clipboard', 'notifications', 'settings'];

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

function ViewLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-20 text-sm text-[var(--color-text-secondary)]">
      Loading…
    </div>
  );
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

  const [view, setView] = useState<View>(initialRoute.view);
  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [categoryDraggedOver, setCategoryDraggedOver] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<string | undefined>(initialRoute.section);
  const alertCount = useFiringAlerts();

  const canEdit = authenticated;

  // The path the app last settled on, to put back when a guard keeps the person on the page.
  const pathRef = useRef(window.location.pathname);

  const navigate = useCallback(async (next: string, section?: string) => {
    const target = next as View;
    if (ADMIN_VIEWS.includes(target) && !authenticated) {
      setShowLoginModal(true);
      return;
    }
    if (!(await canLeave())) return;
    setView(target);
    setSettingsSection(target === 'settings' ? section : undefined);
    const path = formatRoute({ view: target, section: target === 'settings' ? section : undefined }, initialRoute.base);
    if (path !== window.location.pathname) window.history.pushState(null, '', path);
    pathRef.current = path;
    window.scrollTo({ top: 0 });
  }, [authenticated]);

  // Back and forward move between views.
  useEffect(() => {
    const onPop = () => {
      const target = window.location.pathname;
      void guardPopState(
        pathRef.current,
        () => {
          const route = parseRoute(target);
          pathRef.current = target;
          setView(route.view);
          setSettingsSection(route.section);
        },
        (stay) => window.history.pushState(null, '', stay),
      );
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // A 401 from any request flips loginRequired: surface the sign-in dialog and
  // drop every privileged surface so the page snaps back to an anonymous state.
  useEffect(() => {
    if (!loginRequired) return;
    setShowLoginModal(true);
    setIsEditMode(false);
    setView('dashboard');
    window.history.replaceState(null, '', formatRoute({ view: 'dashboard' }, initialRoute.base)); pathRef.current = window.location.pathname;
    setShowServiceModal(false);
    setShowCategoryModal(false);
    setPaletteOpen(false);
  }, [loginRequired, setIsEditMode]);

  // Losing the session while on an admin view falls back to the dashboard.
  useEffect(() => {
    if (authEnabled && !authenticated && ADMIN_VIEWS.includes(view)) {
      setView('dashboard');
      window.history.replaceState(null, '', formatRoute({ view: 'dashboard' }, initialRoute.base)); pathRef.current = window.location.pathname;
    }
  }, [authEnabled, authenticated, view]);

  useShortcut('mod+k', () => setPaletteOpen(true), { description: 'Search services and views' });
  useShortcut('mod+shift+c', () => navigate('clipboard'), { description: 'Clipboard' });
  useShortcut('/', () => {
    if (view !== 'dashboard') navigate('dashboard');
    requestAnimationFrame(() => document.getElementById('service-filter')?.focus());
  }, { description: 'Filter services' });

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
    { id: 'files', label: 'Files', icon: FolderOpen },
    { id: 'stats', label: 'Server stats', icon: Activity, adminOnly: true },
    { id: 'inverter', label: 'Inverter', icon: Sun, adminOnly: true },
    { id: 'clipboard', label: 'Clipboard', icon: Clipboard, adminOnly: true },
    { id: 'notifications', label: 'Notifications', icon: Bell, adminOnly: true },
    { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
  ];

  const paletteActions: PaletteAction[] = [
    ...(canEdit ? [{ id: 'add-service', label: 'Add service', icon: Plus, run: openAddService }] : []),
    ...(canEdit ? [{ id: 'add-category', label: 'Add category', icon: FolderPlus, run: openAddCategory }] : []),
    ...(canEdit
      ? [{
          id: 'toggle-edit',
          label: isEditMode ? 'Leave edit mode' : 'Enter edit mode',
          icon: Pencil,
          run: () => { navigate('dashboard'); setIsEditMode(!isEditMode); },
        }]
      : []),
    ...tools
      .filter((tool) => !tool.adminOnly || authenticated)
      .map((tool) => ({ id: tool.id, label: tool.label, icon: tool.icon, run: () => navigate(tool.id) })),
    { id: 'monitor', label: 'Monitor', icon: LayoutGrid, run: () => navigate('monitor') },
    ...(authEnabled
      ? [{
          id: 'auth',
          label: authenticated ? 'Sign out' : 'Sign in',
          icon: authenticated ? LogOut : LogIn,
          run: authenticated ? () => { void logout(); } : () => setShowLoginModal(true),
        }]
      : []),
  ];

  const hasResults = filteredServices.length > 0;

  return (
    <AppShell
      tools={tools}
      view={view}
      onNavigate={navigate}
      categories={config.categoryOrder}
      authEnabled={authEnabled}
      authenticated={authenticated}
      onSignIn={() => setShowLoginModal(true)}
      onSignOut={() => { void logout(); }}
      onOpenPalette={() => setPaletteOpen(true)}
      status={<SyncStatus />}
      serviceCount={config.services.length}
      alertCount={alertCount}
      startHidden={initialRoute.view === 'monitor'}
      notifications={
        <NotificationsBell
          onClick={authenticated ? () => navigate('notifications') : () => setShowLoginModal(true)}
          active={view === 'notifications'}
        />
      }
    >
      {view === 'dashboard' && (
        <>
          <PageHeader
            title="Your services"
            description={
              <>
                {config.services.length} services in {config.categoryOrder.length} categories
                {debouncedQuery ? ` · filtered by “${debouncedQuery}”` : ''}
              </>
            }
            actions={
              <>
                {isEditMode && canEdit && (
                  <>
                    <Button variant="primary" size="sm" onClick={openAddService}>
                      <Plus className="size-3.5" /> Service
                    </Button>
                    <Button variant="secondary" size="sm" onClick={openAddCategory}>
                      <FolderPlus className="size-3.5" /> Category
                    </Button>
                  </>
                )}
                <EditModeToggle isEditMode={isEditMode} onToggleEditMode={setIsEditMode} canEdit={canEdit} />
              </>
            }
          >
            <div className="mt-2 w-full sm:w-64">
              <Input
                id="service-filter"
                value={searchQuery}
                onValueChange={setSearchQuery}
                placeholder="Filter services…  /"
                aria-label="Filter services"
                className="h-9 text-[0.8125rem]"
              />
            </div>
          </PageHeader>

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
        </>
      )}

      {view !== 'dashboard' && (
        <Suspense fallback={<ViewLoading />}>
          {view === 'monitor' && <MonitorView onOpenSettings={() => navigate('settings', 'monitor-general')} />}
          {view === 'files' && <FileSharing />}
          {view === 'stats' && authenticated && (
            <ServerStats onManage={() => navigate('settings', 'servers')} />
          )}
          {view === 'inverter' && authenticated && (
            <InverterPanel onManage={() => navigate('settings', 'inverters')} />
          )}
          {view === 'clipboard' && authenticated && <ClipboardManager />}
          {view === 'notifications' && authenticated && (
            <NotificationsPanel onManage={() => navigate('settings', 'notifications')} />
          )}
          {view === 'settings' && authenticated && (
            <SettingsView
              key={settingsSection ?? 'default'}
              initialSection={settingsSection as SettingsSection | undefined}
              onSectionChange={(section) => {
                const path = formatRoute({ view: 'settings', section }, initialRoute.base);
                if (path !== window.location.pathname) window.history.replaceState(null, '', path);
                pathRef.current = path;
              }}
            />
          )}
        </Suspense>
      )}

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          actions={paletteActions}
          onEditService={handleEditService}
        />
      )}

      <Suspense fallback={null}>
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
