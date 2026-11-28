import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerTitle } from '@ui-sdk/react/drawer';
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui-sdk/react/tooltip';
import { useShortcut, useShortcutHint } from '@ui-sdk/react/shortcuts';
import {
  Activity,
  Home,
  LayoutGrid,
  LogIn,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftDashed,
  PanelLeftOpen,
  Pin,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { Button, IconButton } from '../ui/Button';
import { categoryId } from '../../lib/slug';

export interface ShellTool {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Tools that only make sense for a signed-in admin. */
  adminOnly?: boolean;
}

/** Expanded sidebar, the 72 px icon rail, or hidden behind the floating button. */
export type SidebarMode = 'expanded' | 'rail' | 'hidden';

interface ShellContextValue {
  mode: SidebarMode;
  /** `persist: false` changes the sidebar for now only, like Kiosk, leaving the saved choice alone. */
  setMode: (mode: SidebarMode, opts?: { persist?: boolean }) => void;
}

const ShellContext = createContext<ShellContextValue>({ mode: 'expanded', setMode: () => {} });

/** Lets a view (the monitor's Kiosk button) change how the sidebar shows. */
export function useShell() {
  return useContext(ShellContext);
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
  /** Firing monitor alerts, shown on the Monitor item and the floating button. */
  alertCount?: number;
  /** Start hidden for this page load without changing the saved choice (`/monitor` on a wall display). */
  startHidden?: boolean;
  children: ReactNode;
}

const MODE_KEY = 'homedash-sidebar-mode';
const LEGACY_KEY = 'homedash-sidebar-collapsed';
const RAIL_QUERY = '(max-width: 1279px)';
const IDLE_MS = 5000;

function readStoredMode(): SidebarMode | null {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === 'expanded' || stored === 'rail' || stored === 'hidden') return stored;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === '1') return 'rail';
    if (legacy === '0') return 'expanded';
  } catch {
    // Storage blocked: fall back to the width-based default.
  }
  return null;
}

function storeMode(mode: SidebarMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Not persisted; the choice still applies for this visit.
  }
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex min-w-0 items-center ${compact ? 'justify-center' : 'gap-2.5'}`}>
      <div className="ui-brand-mark">
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
  badge?: number;
  onClick: () => void;
}

function NavButton({ label, icon: Icon, active, rail, trailing, badge, onClick }: NavButtonProps) {
  if (rail) {
    const name = badge ? `${label}, ${badge} firing` : label;
    return (
      <Tooltip>
        <TooltipTrigger
          aria-label={name}
          className="ui-nav-item relative justify-center px-0"
          data-active={active || undefined}
          aria-current={active ? 'page' : undefined}
          onClick={onClick}
        >
          <Icon className="size-4 shrink-0 opacity-85" aria-hidden="true" />
          {badge ? <span className="ui-nav-badge" aria-hidden="true">{badge > 99 ? '99+' : badge}</span> : null}
        </TooltipTrigger>
        <TooltipContent className="ui-tooltip" side="right">
          {name}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-nav-item"
      data-active={active || undefined}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="size-4 shrink-0 opacity-85" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge ? (
        <span className="ui-chip tabular-nums" data-tone="danger" aria-label={`${badge} firing`}>{badge}</span>
      ) : trailing}
    </button>
  );
}

/** The bottom-left button that stands in for a hidden sidebar. */
function FloatingNav({ alertCount, idleFade, onOpen, hint }: { alertCount: number; idleFade: boolean; onOpen: () => void; hint: string }) {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    if (!idleFade) {
      setIdle(false);
      return;
    }
    let timer = window.setTimeout(() => setIdle(true), IDLE_MS);
    const wake = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), IDLE_MS);
    };
    window.addEventListener('pointermove', wake);
    window.addEventListener('keydown', wake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('keydown', wake);
    };
  }, [idleFade]);

  const label = alertCount ? `Open sidebar, ${alertCount} alerts firing` : 'Open sidebar';
  return (
    <Tooltip>
      <TooltipTrigger className="ui-fab" data-idle={idle || undefined} aria-label={label} onClick={onOpen}>
        <span className="ui-brand-mark">
          <Home className="size-4" aria-hidden="true" />
        </span>
        {alertCount ? <span className="ui-fab-badge" aria-hidden="true">{alertCount > 99 ? '99+' : alertCount}</span> : null}
      </TooltipTrigger>
      <TooltipContent className="ui-tooltip" side="right">
        Open sidebar <kbd className="ui-kbd">{hint}</kbd>
      </TooltipContent>
    </Tooltip>
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
  alertCount = 0,
  startHidden = false,
  children,
}: ShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const [mode, setModeState] = useState<SidebarMode>(() => {
    if (startHidden) return 'hidden';
    return readStoredMode() ?? (window.matchMedia(RAIL_QUERY).matches ? 'rail' : 'expanded');
  });
  const explicitRef = useRef(readStoredMode() !== null);
  const lastDockedRef = useRef<SidebarMode>(mode === 'hidden' ? (readStoredMode() === 'expanded' ? 'expanded' : 'rail') : mode);
  const paletteHint = useShortcutHint('mod+k');
  const sidebarHint = useShortcutHint('[');

  const setMode = useCallback((next: SidebarMode, opts: { persist?: boolean } = {}) => {
    const persist = opts.persist ?? true;
    if (persist) {
      explicitRef.current = true;
      storeMode(next);
    }
    if (next !== 'hidden') lastDockedRef.current = next;
    setModeState(next);
    setNavOpen(false);
  }, []);

  // Below xl the rail is the default until the person picks a width.
  useEffect(() => {
    const media = window.matchMedia(RAIL_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      if (!explicitRef.current) setModeState(event.matches ? 'rail' : 'expanded');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useShortcut('[', () => setMode(mode === 'hidden' ? lastDockedRef.current : 'hidden'), {
    description: 'Show or hide the sidebar',
  });

  const go = (id: string) => {
    onNavigate(id);
    setNavOpen(false);
  };

  const jumpToCategory = (category: string) => {
    onNavigate('dashboard');
    setNavOpen(false);
    requestAnimationFrame(() => {
      document.getElementById(categoryId(category))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const visibleTools = tools.filter((tool) => !tool.adminOnly || authenticated);
  const shell = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  // `drawer` is the overlay opened from the floating button or the phone menu.
  const sidebar = (rail: boolean, drawer = false) => (
    <>
      <div className={`flex h-14 items-center gap-1 px-3 lg:h-16 ${rail ? 'justify-center' : ''}`}>
        <Brand compact={rail} />
        {!rail && <div className="ml-auto flex items-center gap-0.5">{notifications}</div>}
        {!rail && !drawer && (
          <IconButton label="Collapse to icons" onClick={() => setMode('rail')}>
            <PanelLeftClose className="size-4" />
          </IconButton>
        )}
        {drawer && mode === 'hidden' && (
          <span className="hidden lg:inline-flex">
            <IconButton label="Keep sidebar open" onClick={() => setMode('expanded')}>
              <Pin className="size-4" />
            </IconButton>
          </span>
        )}
      </div>

      {rail && (
        <div className="flex flex-col items-center gap-0.5 px-2 pb-2">
          {notifications}
          <IconButton label="Expand sidebar" onClick={() => setMode('expanded')}>
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
            onClick={() => { setNavOpen(false); onOpenPalette(); }}
            className="flex h-9 w-full items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--surface-sunken)] px-2.5 text-[0.8125rem] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--color-text-primary)]"
          >
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="ui-kbd">{paletteHint.text}</kbd>
          </button>
        )}
      </div>

      <nav aria-label="Main" className={`min-h-0 flex-1 overflow-y-auto pb-4 ${rail ? 'px-2' : 'px-3'}`}>
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
          icon={Activity}
          rail={rail}
          active={view === 'monitor'}
          badge={alertCount}
          onClick={() => go('monitor')}
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
      </nav>

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
            <IconButton label="Hide sidebar" hint={sidebarHint.text} onClick={() => setMode('hidden')}>
              <PanelLeftDashed className="size-4" />
            </IconButton>
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

  const width = mode === 'expanded' ? '264px' : mode === 'rail' ? '72px' : '0px';

  return (
    <ShellContext.Provider value={shell}>
      <div className="min-h-dvh" data-sidebar={mode} style={{ '--sidebar-w': width } as React.CSSProperties}>
        {mode !== 'hidden' && (
          <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-w)] flex-col border-r border-[var(--border-soft)] bg-[var(--shell-bg)] shadow-[var(--shell-shadow)] transition-[width] duration-200 lg:flex">
            {sidebar(mode === 'rail')}
          </aside>
        )}

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

          <main
            className={`mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full flex-col px-4 pb-10 pt-5 sm:px-6 lg:min-h-dvh lg:px-8 lg:pt-7 ${view === 'monitor' ? '' : 'max-w-[1400px]'}`}
          >
            {children}
          </main>
        </div>

        {mode === 'hidden' && (
          <div className="ui-fab-wrap hidden lg:block">
            <FloatingNav
              alertCount={alertCount}
              idleFade={view === 'monitor'}
              onOpen={() => setNavOpen(true)}
              hint={sidebarHint.text}
            />
          </div>
        )}

        <Drawer open={navOpen} onOpenChange={setNavOpen}>
          <DrawerBackdrop className="ui-dialog-backdrop" />
          <DrawerContent className="ui-drawer">
            <DrawerTitle className="sr-only">Navigation</DrawerTitle>
            <div className="absolute right-2 top-3 z-10 lg:hidden">
              <DrawerClose aria-label="Close menu" className="ui-dialog-close">
                <X className="size-4" />
              </DrawerClose>
            </div>
            {sidebar(false, true)}
          </DrawerContent>
        </Drawer>
      </div>
    </ShellContext.Provider>
  );
}
