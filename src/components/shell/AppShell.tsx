import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerTitle } from '@ui-sdk/react/drawer';
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui-sdk/react/tooltip';
import {
  Home,
  LayoutGrid,
  LogIn,
  LogOut,
  Menu,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { Button, IconButton } from '../ui/Button';
import { useShortcutHint } from '@ui-sdk/react/shortcuts';
import { categoryId } from '../../lib/slug';

export interface ShellTool {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Tools that only make sense for a signed-in admin. */
  adminOnly?: boolean;
}

interface ShellProps {
  tools: ShellTool[];
  view: string;
  onNavigate: (view: string) => void;
  categories: string[];
  authEnabled: boolean;
  authenticated: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onOpenPalette: () => void;
  notifications: ReactNode;
  status?: ReactNode;
  serviceCount: number;
  children: ReactNode;
}

const SIDEBAR_KEY = 'homedash-sidebar-collapsed';
const RAIL_QUERY = '(max-width: 1279px)';

function readCollapsedPreference(): boolean | null {
  const stored = localStorage.getItem(SIDEBAR_KEY);
  if (stored === '0') return false;
  if (stored === '1') return true;
  return null;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex min-w-0 items-center ${compact ? 'justify-center' : 'gap-2.5'}`}>
      <div className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-white shadow-[var(--shadow-inset)]">
        <Home className="size-4" aria-hidden="true" />
      </div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[0.9375rem] font-bold tracking-tight text-[var(--color-text-primary)]">HomeDash</div>
          <div className="truncate text-[11px] text-[var(--color-text-secondary)]">Homelab dashboard</div>
        </div>
      )}
    </div>
  );
}

interface NavButtonProps {
  label: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
  rail?: boolean;
  trailing?: ReactNode;
  onClick: () => void;
}

function NavButton({ label, icon: Icon, active, rail, trailing, onClick }: NavButtonProps) {
  if (rail) {
    return (
      <Tooltip>
        <TooltipTrigger
          aria-label={label}
          className="ui-nav-item justify-center px-0"
          data-active={active || undefined}
          onClick={onClick}
        >
          <Icon className="size-4 shrink-0 opacity-85" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent className="ui-tooltip" side="right">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button type="button" onClick={onClick} className="ui-nav-item" data-active={active || undefined}>
      <Icon className="size-4 shrink-0 opacity-85" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

export function AppShell({
  tools,
  view,
  onNavigate,
  categories,
  authEnabled,
  authenticated,
  onSignIn,
  onSignOut,
  onOpenPalette,
  notifications,
  status,
  serviceCount,
  children,
}: ShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const stored = readCollapsedPreference();
    return stored ?? window.matchMedia(RAIL_QUERY).matches;
  });
  const explicitRef = useRef(readCollapsedPreference() !== null);
  const paletteHint = useShortcutHint('mod+k');

  // Below xl the rail starts collapsed; once the person picks a width, keep it.
  useEffect(() => {
    const media = window.matchMedia(RAIL_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      if (!explicitRef.current) setCollapsed(event.matches);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      explicitRef.current = true;
      localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      return next;
    });
  };

  const go = (id: string) => {
    onNavigate(id);
    setNavOpen(false);
  };

  const jumpToCategory = (category: string) => {
    onNavigate('dashboard');
    setNavOpen(false);
    document.getElementById(categoryId(category))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const visibleTools = tools.filter((tool) => !tool.adminOnly || authenticated);

  const sidebar = (rail: boolean) => (
    <>
      <div className={`flex h-14 items-center gap-1 px-3 lg:h-16 ${rail ? 'justify-center' : ''}`}>
        <Brand compact={rail} />
        {!rail && <div className="ml-auto flex items-center gap-0.5">{notifications}</div>}
        {!rail && (
          <IconButton label="Collapse sidebar" onClick={toggleCollapsed}>
            <PanelLeftClose className="size-4" />
          </IconButton>
        )}
      </div>

      {rail && (
        <div className="flex flex-col items-center gap-0.5 px-2 pb-2">
          {notifications}
          <IconButton label="Expand sidebar" onClick={toggleCollapsed}>
            <PanelLeftOpen className="size-4" />
          </IconButton>
        </div>
      )}

      <div className={rail ? 'px-2 pb-3' : 'px-3 pb-3'}>
        {rail ? (
          <IconButton label="Search" hint={paletteHint.text} onClick={onOpenPalette} className="mx-auto">
            <Search className="size-4" />
          </IconButton>
        ) : (
          <button
            type="button"
            onClick={onOpenPalette}
            className="flex h-9 w-full items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--surface-sunken)] px-2.5 text-[0.8125rem] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--color-text-primary)]"
          >
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="ui-kbd">{paletteHint.text}</kbd>
          </button>
        )}
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto pb-4 ${rail ? 'px-2' : 'px-3'}`}>
        {!rail && <div className="ui-nav-label">Workspace</div>}
        <NavButton
          label="Services"
          icon={LayoutGrid}
          rail={rail}
          active={view === 'dashboard'}
          onClick={() => go('dashboard')}
          trailing={<span className="ui-chip tabular-nums">{serviceCount}</span>}
        />
        <NavButton
          label="Monitor"
          icon={Monitor}
          rail={rail}
          onClick={() => window.open('/monitor', '_blank', 'noopener,noreferrer')}
        />

        {rail ? <div className="my-2 border-t border-[var(--border-soft)]" /> : <div className="ui-nav-label mt-4">Tools</div>}
        {visibleTools.map((tool) => (
          <NavButton
            key={tool.id}
            label={tool.label}
            icon={tool.icon}
            rail={rail}
            active={view === tool.id}
            onClick={() => go(tool.id)}
          />
        ))}

        {!rail && categories.length > 0 && (
          <>
            <div className="ui-nav-label mt-4">Categories</div>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => jumpToCategory(category)}
                className="ui-nav-item pl-4 text-[0.8125rem]"
              >
                <span className="size-1.5 shrink-0 rounded-full bg-current opacity-40" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{category}</span>
              </button>
            ))}
          </>
        )}
      </div>

      <div className={`border-t border-[var(--border-soft)] ${rail ? 'p-2' : 'p-3'}`}>
        {!rail && status ? <div className="mb-2 flex">{status}</div> : null}
        {rail ? (
          <div className="flex flex-col items-center gap-1">
            <div className="ui-avatar" aria-hidden="true">{authenticated ? 'AD' : 'AU'}</div>
            {authenticated && (
              <IconButton label="Settings" onClick={() => go('settings')}>
                <Settings className="size-4" />
              </IconButton>
            )}
            {authEnabled && (
              <IconButton label={authenticated ? 'Sign out' : 'Sign in'} onClick={authenticated ? onSignOut : onSignIn}>
                {authenticated ? <LogOut className="size-4" /> : <LogIn className="size-4" />}
              </IconButton>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="ui-avatar" aria-hidden="true">{authenticated ? 'AD' : 'AU'}</div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[0.8125rem] font-semibold text-[var(--color-text-primary)]">
                  {authenticated ? 'Admin' : authEnabled ? 'Viewer' : 'Open access'}
                </div>
                <div className="truncate text-[11px] text-[var(--color-text-secondary)]">
                  {authenticated ? 'Full access' : authEnabled ? 'Read only' : 'No password set'}
                </div>
              </div>
              <IconButton label="Settings" onClick={() => go('settings')} disabled={!authenticated}>
                <Settings className="size-4" />
              </IconButton>
            </div>
            {authEnabled && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 w-full justify-start"
                onClick={authenticated ? onSignOut : onSignIn}
              >
                {authenticated ? <LogOut className="size-3.5" /> : <LogIn className="size-3.5" />}
                {authenticated ? 'Sign out' : 'Sign in'}
              </Button>
            )}
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-dvh" style={{ '--sidebar-w': collapsed ? '72px' : '264px' } as React.CSSProperties}>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-w)] flex-col border-r border-[var(--border-soft)] bg-[var(--shell-bg)] shadow-[var(--shell-shadow)] transition-[width] duration-200 lg:flex">
        {sidebar(collapsed)}
      </aside>

      <div className="lg:pl-[var(--sidebar-w)] lg:transition-[padding] lg:duration-200">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-[var(--border-soft)] bg-[var(--shell-header-bg)] px-3 backdrop-blur-md lg:hidden">
          <Brand />
          <div className="ml-auto flex items-center gap-1">
            {notifications}
            <IconButton label="Menu" onClick={() => setNavOpen(true)}>
              <Menu className="size-5" />
            </IconButton>
          </div>
        </header>

        <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-[1400px] flex-col px-4 pb-10 pt-5 sm:px-6 lg:min-h-dvh lg:px-8 lg:pt-7">
          {children}
        </main>
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
          {sidebar(false)}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
