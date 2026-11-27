import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react';
import {
  AlertCircle,
  ChevronRight,
  Download,
  File,
  Folder,
  Globe,
  Home,
  Link2,
  Lock,
  MoreHorizontal,
  RefreshCw,
  Share2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  listDirectory,
  getFileDownloadUrl,
  uploadFile,
  deleteItem,
  moveItem,
  type FileScope,
} from '../api/filesApi';
import type { CopypartyListing, CopypartyFile, CopypartyDir } from '../types';
import { useConfirm, useToast } from './ui';
import { PageHeader, PagePanel } from './shell/PageHeader';
import { Button } from '@ui-sdk/react/button';
import { Listbox, ListboxItem, ListboxItemIcon } from '@ui-sdk/react/listbox';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@ui-sdk/react/menu';
import { Progress, ProgressIndicator, ProgressTrack } from '@ui-sdk/react/progress';
import {
  ScrollArea,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from '@ui-sdk/react/scroll-area';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from '@ui-sdk/react/segmented-control';
import { useDashboard } from '../context/DashboardContext';
import { useAuth } from '../context/AuthContext';

// Web Share API is best-effort; we fall back to clipboard copy when it isn't
// available or the user dismisses the system share sheet.
const canWebShare =
  typeof navigator !== 'undefined' &&
  typeof (navigator as Navigator).share === 'function';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(ts: number): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Phase 3 split the file area into Public (anonymous-readable, used for share
// links) and Private (admin-only working area). Anonymous viewers only ever
// see Public.
export function FileSharing() {
  const { authenticated } = useAuth();
  // Anonymous viewers can only browse public; admins start on private (their
  // working area) but can switch to public to publish/unpublish.
  const initialScope: FileScope = authenticated ? 'private' : 'public';
  const [activeScope, setActiveScope] = useState<FileScope>(initialScope);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Files"
        description={authenticated ? 'Private working area and the public share area.' : 'Public share area, read-only.'}
        actions={
          authenticated ? (
            <SegmentedControl
              aria-label="Area"
              className="ui-seg"
              value={activeScope}
              onValueChange={(value) => { if (value) setActiveScope(value as FileScope); }}
            >
              <SegmentedControlIndicator />
              <SegmentedControlItem value="private" className="ui-seg-item" title="Private area (admins only)">
                <Lock className="size-3.5" aria-hidden="true" /> Private
              </SegmentedControlItem>
              <SegmentedControlItem value="public" className="ui-seg-item" title="Public share area (anyone with the link)">
                <Globe className="size-3.5" aria-hidden="true" /> Public
              </SegmentedControlItem>
            </SegmentedControl>
          ) : (
            <span className="ui-chip" title="Sign in to upload, delete, or publish">
              <Globe className="size-3" aria-hidden="true" />
              Public (read-only)
            </span>
          )
        }
      />
      <PagePanel>
        <ScopePane
          // Remount the pane when the scope changes so its internal navigation
          // state (currentPath) resets cleanly. Cheaper than threading scope
          // changes through every callback.
          key={activeScope}
          scope={activeScope}
        />
      </PagePanel>
    </div>
  );
}

interface ScopePaneProps {
  scope: FileScope;
}

function ScopePane({ scope }: ScopePaneProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const { copyClipToSystemClipboard } = useDashboard();
  const { authenticated } = useAuth();
  // Mirror of the URL path used by listDirectory; '/' is the scope root.
  const [currentPath, setCurrentPath] = useState('/');
  const [listing, setListing] = useState<CopypartyListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (path: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await listDirectory(scope, path);
        setListing(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load directory');
      } finally {
        setLoading(false);
      }
    },
    [scope],
  );

  useEffect(() => {
    load(currentPath);
  }, [currentPath, load]);

  const navigate = (path: string) => setCurrentPath(path);

  // Strip the leading slash and any trailing slash, then split — gives us a
  // clean array for the breadcrumb regardless of how `currentPath` was set.
  const breadcrumbs = currentPath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const scopeRootLabel = scope === 'public' ? 'Public' : 'Private';

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadProgress(0);
    setError(null);
    try {
      await uploadFile(scope, currentPath, file, setUploadProgress);
      await load(currentPath);
      toast.success(`Uploaded ${file.name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (path: string, kind: 'file' | 'folder', displayName: string) => {
    const ok = await confirm({
      title: kind === 'folder' ? 'Delete folder' : 'Delete file',
      message:
        kind === 'folder'
          ? `Delete folder "${displayName}" and all its contents? This cannot be undone.`
          : `Delete "${displayName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteItem(scope, path);
      await load(currentPath);
      toast.success(kind === 'folder' ? 'Folder deleted' : 'File deleted');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      setError(msg);
      toast.error(msg);
    }
  };

  // Publish (private->public) or Unpublish (public->private). Always lands at
  // the scope root with the same item name so admins don't have to think about
  // destination folders for the common case. Refuses to overwrite — the toast
  // tells the admin to remove the existing item first.
  const handleMoveAcrossScope = async (
    sourcePath: string,
    kind: 'file' | 'folder',
    displayName: string,
  ) => {
    const targetScope: FileScope = scope === 'private' ? 'public' : 'private';
    const verb = scope === 'private' ? 'Publish' : 'Unpublish';
    const detail =
      scope === 'private'
        ? `Make "${displayName}" available at /api/files/public/${encodeURIComponent(displayName)}? Anyone with the link can download it.`
        : `Move "${displayName}" back to the private area? Existing share links will stop working.`;
    const ok = await confirm({
      title: `${verb} ${kind}`,
      message: detail,
      confirmLabel: verb,
      tone: scope === 'private' ? 'primary' : 'danger',
    });
    if (!ok) return;
    setError(null);
    try {
      await moveItem(
        { scope, path: sourcePath },
        { scope: targetScope, path: `/${displayName}` },
      );
      await load(currentPath);
      toast.success(scope === 'private' ? `Published ${displayName}` : `Unpublished ${displayName}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Move failed';
      setError(msg);
      toast.error(msg);
    }
  };

  const handleShare = async (filePath: string, fileName: string) => {
    // Share/Copy semantics differ by scope:
    //   - public: copies the absolute share URL (the link admins distribute).
    //   - private: copies the auth-only download URL.
    const relativeUrl = getFileDownloadUrl(scope, filePath);
    let absoluteUrl = relativeUrl;
    try {
      absoluteUrl = new URL(relativeUrl, window.location.origin).toString();
    } catch {
      /* fall back to relative */
    }

    if (scope === 'public' && canWebShare) {
      try {
        await (navigator as Navigator).share({ title: fileName, url: absoluteUrl });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === 'AbortError') return;
      }
    }

    const copied = await copyClipToSystemClipboard(absoluteUrl);
    if (copied) {
      toast.success(scope === 'public' ? 'Share link copied' : 'Link copied (admin-only)');
    } else {
      toast.error('Could not copy link');
    }
  };

  const dirs = listing?.dirs ?? [];
  const files = listing?.files ?? [];
  const isEmpty = Boolean(listing) && dirs.length === 0 && files.length === 0;

  const openEntry = (value: string | null) => {
    if (!value) return;
    const isDir = value.startsWith('dir:');
    const path = value.slice(4);
    if (isDir) {
      navigate(path);
    } else {
      window.open(getFileDownloadUrl(scope, path), '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      <div className="ui-panel-head gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          <Button
            className="ui-btn shrink-0"
            data-variant="ghost"
            data-size="sm"
            onClick={() => navigate('/')}
            title={`${scopeRootLabel} root`}
          >
            <Home className="size-3.5" aria-hidden="true" /> {scopeRootLabel}
          </Button>
          {breadcrumbs.map((segment, i) => {
            const segPath = '/' + breadcrumbs.slice(0, i + 1).join('/') + '/';
            return (
              <span key={segPath} className="flex shrink-0 items-center gap-1">
                <ChevronRight className="size-3 text-[var(--text-tertiary)]" aria-hidden="true" />
                <Button
                  className="ui-btn"
                  data-variant="ghost"
                  data-size="sm"
                  onClick={() => navigate(segPath)}
                >
                  {segment}
                </Button>
              </span>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            className="ui-btn"
            data-variant="ghost"
            data-size="icon"
            onClick={() => load(currentPath)}
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
          {authenticated && (
            <>
              <Button
                className="ui-btn"
                data-variant="primary"
                data-size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadProgress !== null}
              >
                <Upload className="size-3.5" aria-hidden="true" /> Upload
              </Button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
            </>
          )}
        </div>
      </div>

      {uploadProgress !== null && (
        <div className="border-b border-[var(--border-soft)] px-4 py-2">
          <Progress
            value={uploadProgress}
            min={0}
            max={100}
            format={{ style: 'percent', maximumFractionDigits: 0 }}
            aria-label="Upload progress"
          >
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 border-b border-[color-mix(in_srgb,var(--color-error)_35%,transparent)] bg-[var(--danger-soft)] px-4 py-2 text-[var(--color-error)]">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-xs">{error}</span>
          <Button className="ui-btn" data-variant="ghost" data-size="sm" onClick={() => load(currentPath)}>
            Retry
          </Button>
          <Button
            className="ui-btn"
            data-variant="ghost"
            data-size="icon"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <ScrollAreaViewport className="p-3">
          {loading && !listing && (
            <div className="px-3 py-6">
              <Progress value={null} aria-label="Loading folder">
                <ProgressTrack>
                  <ProgressIndicator />
                </ProgressTrack>
              </Progress>
            </div>
          )}

          {!loading && isEmpty && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-3 grid size-14 place-items-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--surface-sunken)]">
                <Folder className="size-6 text-[var(--color-text-secondary)]" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                This {scope} folder is empty
              </p>
              <p className="mt-1 max-w-xs text-xs text-[var(--color-text-secondary)]">
                {!authenticated
                  ? 'No public shares yet.'
                  : scope === 'public'
                    ? 'Publish something from Private, or upload directly here.'
                    : 'Use Upload to add files.'}
              </p>
            </div>
          )}

          {listing && !isEmpty && (
            <Listbox
              aria-label={`${scopeRootLabel} folder contents`}
              className="ui-listbox"
              activation="manual"
              onValueChange={openEntry}
            >
              {dirs.map((dir: CopypartyDir) => {
                const path = currentPath + dir.n + '/';
                return (
                  <ListboxItem key={`dir:${dir.n}`} value={`dir:${path}`} className="ui-list-item">
                    <ListboxItemIcon>
                      <Folder className="size-4 text-[var(--color-accent)]" aria-hidden="true" />
                    </ListboxItemIcon>
                    <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">{dir.n}</span>
                    <span className="shrink-0 text-[11px] text-[var(--color-text-secondary)]">
                      {dir.ts > 0 ? formatDate(dir.ts) : 'Folder'}
                    </span>
                    <Menu
                      onAction={(action) => {
                        if (action === 'delete') void handleDelete(path, 'folder', dir.n);
                        if (action === 'move') void handleMoveAcrossScope(path, 'folder', dir.n);
                      }}
                    >
                      <MenuTrigger
                        aria-label={`Actions for ${dir.n}`}
                        className="ui-btn shrink-0"
                        data-variant="ghost"
                        data-size="icon"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MoreHorizontal className="size-4" aria-hidden="true" />
                      </MenuTrigger>
                      <MenuContent className="ui-popup">
                        <MenuItem value="open" className="ui-menu-item" onClick={(event) => { event.stopPropagation(); navigate(path); }}>
                          <Folder className="size-4" aria-hidden="true" /> Open
                        </MenuItem>
                        {authenticated && (
                          <>
                            <MenuItem value="move" className="ui-menu-item" onClick={(event) => event.stopPropagation()}>
                              <Share2 className="size-4" aria-hidden="true" />
                              {scope === 'private' ? 'Publish to public' : 'Unpublish'}
                            </MenuItem>
                            <MenuSeparator className="ui-menu-separator" />
                            <MenuItem value="delete" className="ui-menu-item" data-tone="danger" onClick={(event) => event.stopPropagation()}>
                              <Trash2 className="size-4" aria-hidden="true" /> Delete folder
                            </MenuItem>
                          </>
                        )}
                      </MenuContent>
                    </Menu>
                  </ListboxItem>
                );
              })}

              {files.map((file: CopypartyFile) => {
                const path = currentPath + file.n;
                return (
                  <ListboxItem key={`file:${file.n}`} value={`file:${path}`} className="ui-list-item">
                    <ListboxItemIcon>
                      <File className="size-4 text-[var(--color-primary)]" aria-hidden="true" />
                    </ListboxItemIcon>
                    <span className="min-w-0 flex-1 truncate text-[0.8125rem]">{file.n}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-[var(--color-text-secondary)]">
                      {formatBytes(file.sz)}
                      {file.ts > 0 ? ` · ${formatDate(file.ts)}` : ''}
                    </span>
                    <Menu
                      onAction={(action) => {
                        if (action === 'share') void handleShare(path, file.n);
                        if (action === 'move') void handleMoveAcrossScope(path, 'file', file.n);
                        if (action === 'delete') void handleDelete(path, 'file', file.n);
                      }}
                    >
                      <MenuTrigger
                        aria-label={`Actions for ${file.n}`}
                        className="ui-btn shrink-0"
                        data-variant="ghost"
                        data-size="icon"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MoreHorizontal className="size-4" aria-hidden="true" />
                      </MenuTrigger>
                      <MenuContent className="ui-popup">
                        <MenuItem
                          value="download"
                          className="ui-menu-item"
                          onClick={(event) => {
                            event.stopPropagation();
                            window.open(getFileDownloadUrl(scope, path), '_blank', 'noopener,noreferrer');
                          }}
                        >
                          <Download className="size-4" aria-hidden="true" /> Download
                        </MenuItem>
                        {(scope === 'public' || authenticated) && (
                          <MenuItem value="share" className="ui-menu-item" onClick={(event) => event.stopPropagation()}>
                            {scope === 'public'
                              ? <Share2 className="size-4" aria-hidden="true" />
                              : <Link2 className="size-4" aria-hidden="true" />}
                            {scope === 'public' ? 'Copy share link' : 'Copy admin link'}
                          </MenuItem>
                        )}
                        {authenticated && (
                          <>
                            <MenuItem value="move" className="ui-menu-item" onClick={(event) => event.stopPropagation()}>
                              <Share2 className="size-4" aria-hidden="true" />
                              {scope === 'private' ? 'Publish to public' : 'Unpublish'}
                            </MenuItem>
                            <MenuSeparator className="ui-menu-separator" />
                            <MenuItem value="delete" className="ui-menu-item" data-tone="danger" onClick={(event) => event.stopPropagation()}>
                              <Trash2 className="size-4" aria-hidden="true" /> Delete file
                            </MenuItem>
                          </>
                        )}
                      </MenuContent>
                    </Menu>
                  </ListboxItem>
                );
              })}
            </Listbox>
          )}
        </ScrollAreaViewport>
        <ScrollAreaScrollbar orientation="vertical">
          <ScrollAreaThumb />
        </ScrollAreaScrollbar>
      </ScrollArea>
    </>
  );
}
