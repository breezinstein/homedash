import { useEffect, useRef, useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { NotificationsBell } from './notifications/NotificationsBell';
import { 
  Settings, 
  Eye, 
  Edit3, 
  Home,
  Search,
  X,
  Menu,
  FolderOpen,
  Clipboard,
  RefreshCw,
  CloudOff,
  Activity,
} from 'lucide-react';

interface HeaderProps {
  onSettingsClick: () => void;
  onFileSharingClick: () => void;
  onClipboardClick: () => void;
  onStatsClick: () => void;
  onNotificationsClick: () => void;
}

export function Header({ onSettingsClick, onFileSharingClick, onClipboardClick, onStatsClick, onNotificationsClick }: HeaderProps) {
  const { isEditMode, setIsEditMode, searchQuery, setSearchQuery, isSyncing, syncError } = useDashboard();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuToggleRef = useRef<HTMLButtonElement>(null);

  // Global keyboard shortcuts: Ctrl/Cmd+K focuses search.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const desktop = searchInputRef.current;
        if (desktop && desktop.offsetParent !== null) {
          desktop.focus();
          desktop.select();
          return;
        }
        // Fall back to mobile search — open the menu so the input is mounted.
        setMobileMenuOpen(true);
        // Defer focus until the input is in the DOM.
        setTimeout(() => {
          mobileSearchInputRef.current?.focus();
          mobileSearchInputRef.current?.select();
        }, 0);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close mobile menu on outside click or Escape.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (mobileMenuRef.current?.contains(target)) return;
      if (mobileMenuToggleRef.current?.contains(target)) return;
      setMobileMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-50 bg-[var(--color-surface)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main header row */}
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] flex items-center justify-center">
              <Home className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">HomeDash</h1>
              <p className="text-xs text-[var(--color-text-secondary)] hidden sm:block">Homelab Dashboard</p>
            </div>

            {/* Sync status: subtle spinner while saving/syncing, error chip if
                the server is unreachable. Stays out of the way otherwise. */}
            {syncError ? (
              <span
                className="flex items-center gap-1 text-[var(--color-error)]"
                title={syncError}
              >
                <CloudOff className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">Offline</span>
              </span>
            ) : isSyncing ? (
              <span className="flex items-center gap-1 text-[var(--color-text-secondary)]" title="Syncing…">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-xs hidden sm:inline">Syncing…</span>
              </span>
            ) : null}
          </div>

          {/* Desktop Controls */}
          <div className="hidden md:flex items-center gap-2">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search services... (Ctrl+K)"
                className="w-48 lg:w-64 pl-9 pr-8 py-1.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* View/Edit Toggle */}
            <div className="flex items-center bg-[var(--color-background)] rounded-lg p-1">
              <button
                onClick={() => setIsEditMode(false)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  !isEditMode
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span className="hidden lg:inline">View</span>
              </button>
              <button
                onClick={() => setIsEditMode(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  isEditMode
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <Edit3 className="w-4 h-4" />
                <span className="hidden lg:inline">Edit</span>
              </button>
            </div>

            {/* Files */}
            <button
              onClick={onFileSharingClick}
              className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
              title="File Sharing"
            >
              <FolderOpen className="w-5 h-5" />
            </button>

            {/* Server Stats */}
            <button
              onClick={onStatsClick}
              className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
              title="Server Stats"
            >
              <Activity className="w-5 h-5" />
            </button>

            {/* Clipboard */}
            <button
              onClick={onClipboardClick}
              className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
              title="Clipboard (Ctrl+Shift+C)"
            >
              <Clipboard className="w-5 h-5" />
            </button>

            {/* Notifications */}
            <NotificationsBell onClick={onNotificationsClick} />

            {/* Settings */}
            <button
              onClick={onSettingsClick}
              className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile Controls */}
          <div className="flex md:hidden items-center gap-2">
            {/* View/Edit Toggle - Compact */}
            <div className="flex items-center bg-[var(--color-background)] rounded-lg p-0.5">
              <button
                onClick={() => setIsEditMode(false)}
                className={`p-1.5 rounded-md transition-all ${
                  !isEditMode
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text-secondary)]'
                }`}
                title="View Mode"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsEditMode(true)}
                className={`p-1.5 rounded-md transition-all ${
                  isEditMode
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text-secondary)]'
                }`}
                title="Edit Mode"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>

            {/* Notifications — surfaced directly in the bar (not buried in the
                menu) so the unread badge is always visible on mobile. */}
            <NotificationsBell onClick={onNotificationsClick} />

            {/* Menu Toggle */}
            <button
              ref={mobileMenuToggleRef}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] active:bg-[var(--color-border)] rounded-lg transition-colors"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div ref={mobileMenuRef} className="md:hidden py-3 border-t border-[var(--color-border)] space-y-3">
            {/* Mobile Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
              <input
                ref={mobileSearchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search services..."
                className="w-full pl-9 pr-8 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Mobile Files Button */}
            <button
              onClick={() => {
                onFileSharingClick();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
            >
              <FolderOpen className="w-5 h-5" />
              <span className="text-sm">File Sharing</span>
            </button>

            {/* Mobile Clipboard Button */}
            <button
              onClick={() => {
                onClipboardClick();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
            >
              <Clipboard className="w-5 h-5" />
              <span className="text-sm">Clipboard</span>
            </button>

            {/* Mobile Server Stats Button */}
            <button
              onClick={() => {
                onStatsClick();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
            >
              <Activity className="w-5 h-5" />
              <span className="text-sm">Server Stats</span>
            </button>

            {/* Mobile Settings Button */}
            <button
              onClick={() => {
                onSettingsClick();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5" />
              <span className="text-sm">Settings</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
