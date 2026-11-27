import { useState, type ComponentType, type ReactNode } from 'react';
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerTitle } from '@ui-sdk/react/drawer';
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from '@ui-sdk/react/segmented-control';
import { Home, LayoutGrid, LogIn, LogOut, Menu, Monitor, Search, Settings, X } from 'lucide-react';
import { IconButton } from '../ui/Button';
import { useShortcutHint } from '@ui-sdk/react/shortcuts';
import { categoryId } from '../../lib/slug';
import { Button } from '../ui/Button';

export interface ShellTool {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onSelect: () => void;
  /** Tools that only make sense for a signed-in admin. */
  adminOnly?: boolean;
}

interface ShellProps {
  tools: ShellTool[];
  categories: string[];
  isEditMode: boolean;
  canEdit: boolean;
  onToggleEditMode: (edit: boolean) => void;
  onOpenPalette: () => void;
  authEnabled: boolean;
  authenticated: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onSettings: () => void;
  notifications: ReactNode;
  editActions?: ReactNode;
  status?: ReactNode;
  serviceCount: number;
  children: ReactNode;
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-9 place-items-center rounded-[10px] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-white shadow-[var(--shadow-inset)]">
        <Home className="size-4" aria-hidden="true" />
      </div>
      <div className="leading-tight">
        <div className="text-[0.9375rem] font-bold tracking-tight text-[var(--color-text-primary)]">HomeDash</div>
        <div className="text-[11px] text-[var(--color-text-secondary)]">Homelab dashboard</div>
      </div>
    </div>
  );
}

function EditModeToggle({
  isEditMode,
  onToggleEditMode,
  canEdit,
}: {
  isEditMode: boolean;
  onToggleEditMode: (edit: boolean) => void;
  canEdit: boolean;
}) {
  if (!canEdit) return null;
  return (
    <SegmentedControl
      aria-label="Mode"
      className="ui-seg"
      value={isEditMode ? 'edit' : 'view'}
      onValueChange={(value) => {
        if (value) onToggleEditMode(value === 'edit');
      }}
    >
      <SegmentedControlIndicator />
      <SegmentedControlItem value="view" className="ui-seg-item">
        View
      </SegmentedControlItem>
      <SegmentedControlItem value="edit" className="ui-seg-item">
        Edit
      </SegmentedControlItem>
    </SegmentedControl>
  );
}

function NavLink({
  label,
  icon: Icon,
  onClick,
  active,
  trailing,
}: {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onClick: () => void;
  active?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className="ui-nav-item" data-active={active || undefined}>
      {Icon ? <Icon className="size-4 shrink-0 opacity-80" /> : <span className="size-1.5 shrink-0 rounded-full bg-current opacity-40" />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

export function AppShell({
  tools,
  categories,
  isEditMode,
  canEdit,
  onToggleEditMode,
  onOpenPalette,
  authEnabled,
  authenticated,
  onSignIn,
  onSignOut,
  onSettings,
  notifications,
  editActions,
  status,
  serviceCount,
  children,
}: ShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const paletteHint = useShortcutHint('mod+k');

  const jumpToCategory = (category: string) => {
    document.getElementById(categoryId(category))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setNavOpen(false);
  };

  const visibleTools = tools.filter((tool) => !tool.adminOnly || authenticated);

  const navContent = (
    <>
      <div className="flex h-14 items-center px-3 lg:h-16">
        <Brand />
        {status ? <div className="ml-auto hidden lg:block">{status}</div> : null}
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => { onOpenPalette(); setNavOpen(false); }}
          className="flex h-9 w-full items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--surface-sunken)] px-2.5 text-[0.8125rem] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--color-text-primary)]"
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="ui-kbd">{paletteHint.text}</kbd>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <div className="ui-nav-label">Workspace</div>
        <NavLink label="Services" icon={LayoutGrid} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} active={!navOpen} trailing={<span className="ui-chip">{serviceCount}</span>} />
        <NavLink label="Monitor" icon={Monitor} onClick={() => window.open('/monitor', '_blank', 'noopener,noreferrer')} />

        {categories.length > 0 && (
          <>
            <div className="ui-nav-label mt-4">Categories</div>
            {categories.map((category) => (
              <NavLink key={category} label={category} onClick={() => jumpToCategory(category)} />
            ))}
          </>
        )}

        <div className="ui-nav-label mt-4">Tools</div>
        {visibleTools.map((tool) => (
          <NavLink
            key={tool.id}
            label={tool.label}
            icon={tool.icon}
            onClick={() => { tool.onSelect(); setNavOpen(false); }}
          />
        ))}
      </div>

      <div className="border-t border-[var(--border-soft)] p-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="ui-avatar" aria-hidden="true">{authenticated ? 'AD' : 'AU'}</div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[0.8125rem] font-semibold text-[var(--color-text-primary)]">
              {authenticated ? 'Admin' : authEnabled ? 'Viewer' : 'Open access'}
            </div>
            <div className="truncate text-[11px] text-[var(--color-text-secondary)]">
              {authenticated ? 'Full access' : authEnabled ? 'Read only' : 'No password set'}
            </div>
          </div>
          <IconButton label="Settings" onClick={onSettings} disabled={!authenticated}>
            <Settings className="size-4" />
          </IconButton>
        </div>
        <div className="flex items-center gap-2">
          <div className="lg:hidden">
            <EditModeToggle isEditMode={isEditMode} onToggleEditMode={onToggleEditMode} canEdit={canEdit} />
          </div>
          {authEnabled && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={authenticated ? onSignOut : onSignIn}
            >
              {authenticated ? <LogOut className="size-3.5" /> : <LogIn className="size-3.5" />}
              {authenticated ? 'Sign out' : 'Sign in'}
            </Button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-[var(--border-soft)] bg-[var(--shell-bg)] shadow-[var(--shell-shadow)] lg:flex">
        {navContent}
      </aside>

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 border-b border-[var(--border-soft)] bg-[var(--shell-header-bg)] backdrop-blur-md">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-5 lg:h-16 lg:px-8">
            <div className="lg:hidden">
              <Brand />
            </div>

            <div className="hidden items-center gap-2 text-[0.8125rem] text-[var(--color-text-secondary)] lg:flex">
              <span className="font-medium text-[var(--color-text-primary)]">Services</span>
              <span className="text-[var(--text-tertiary)]">/</span>
              <span>{serviceCount} entries</span>
              {status ? <span className="ml-1">{status}</span> : null}
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              {editActions}
              <div className="hidden lg:block">
                <EditModeToggle isEditMode={isEditMode} onToggleEditMode={onToggleEditMode} canEdit={canEdit} />
              </div>
              <IconButton label="Search" hint={paletteHint.text} onClick={onOpenPalette}>
                <Search className="size-4" />
              </IconButton>
              {notifications}
              <div className="lg:hidden">
                <IconButton label="Menu" onClick={() => setNavOpen(true)}>
                  <Menu className="size-5" />
                </IconButton>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
      </div>

      <Drawer open={navOpen} onOpenChange={setNavOpen}>
        <DrawerBackdrop className="ui-dialog-backdrop" />
        <DrawerContent className="ui-drawer">
          <DrawerTitle className="sr-only">Navigation</DrawerTitle>
          <div className="absolute right-2 top-3 z-10">
            <DrawerClose aria-label="Close menu" className="ui-dialog-close">
              <X className="size-4" />
            </DrawerClose>
          </div>
          {navContent}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
