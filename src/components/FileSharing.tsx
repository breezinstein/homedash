import { useState, useEffect, useCallback, useMemo } from 'react';
import {
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
  Search,
  Upload,
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
import { EmptyState, InlineAlert, Input, useConfirm, useToast } from './ui';
import { PageHeader, PagePanel } from './shell/PageHeader';
import { Button } from '@ui-sdk/react/button';
import { Listbox, ListboxItem, ListboxItemIcon } from '@ui-sdk/react/listbox';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@ui-sdk/react/menu';
import { Progress, ProgressIndicator, ProgressTrack } from '@ui-sdk/react/progress';
import { FileInput, FileInputDropzone, FileInputTrigger } from '@ui-sdk/react/file-input';
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

interface UploadItem {
  id: string;
  name: string;
  size: number;
  pct: number;
  error?: string;
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
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [query, setQuery] = useState('');
  const uploading = uploads.some((u) => u.pct < 100 && !u.error);

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

  const navigate = (path: string) => {
    setQuery('');
    setCurrentPath(path);
  };

  // Strip the leading slash and any trailing slash, then split — gives us a
  // clean array for the breadcrumb regardless of how `currentPath` was set.
  const breadcrumbs = currentPath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const scopeRootLabel = scope === 'public' ? 'Public' : 'Private';

  // Uploads run one after another into the folder that was open when they were added.
  const enqueueUploads = async (files: File[]) => {
    if (files.length === 0) return;
    const target = currentPath;
    const batch = files.map((f, n) => ({ id: `${Date.now()}-${n}-${f.name}`, name: f.name, size: f.size, pct: 0 }));
    setUploads((prev) => [...prev.filter((u) => u.pct < 100 || u.error), ...batch]);
    setError(null);
    let done = 0;
    for (const [n, file] of files.entries()) {
      const id = batch[n].id;
      try {
        await uploadFile(scope, target, file, (pct) => setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, pct } : u))));
        setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, pct: 100 } : u)));
        done++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, error: msg } : u)));
      }
    }
    await load(target);
    if (done) toast.success(done === 1 ? `Uploaded ${batch[0].name}` : `Uploaded ${done} files`);
    window.setTimeout(() => setUploads((prev) => prev.filter((u) => u.pct < 100 || u.error)), 2500);
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

  const q = query.trim().toLowerCase();
  const dirs = useMemo(() => (listing?.dirs ?? []).filter((d) => !q || d.n.toLowerCase().includes(q)), [listing, q]);
  const files = useMemo(() => (listing?.files ?? []).filter((f) => !q || f.n.toLowerCase().includes(q)), [listing, q]);
  const isEmpty = Boolean(listing) && (listing?.dirs.length ?? 0) === 0 && (listing?.files.length ?? 0) === 0;
  const noMatches = Boolean(listing) && !isEmpty && dirs.length === 0 && files.length === 0;

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
    <FileInput
      multiple
      disabled={!authenticated || uploading}
      value={[]}
      onValueChange={(next) => { void enqueueUploads(next); }}
      className="flex min-h-0 flex-1 flex-col"
    >
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
          {listing && !isEmpty && (
            <span className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-text-secondary)]" aria-hidden="true" />
              <Input value={query} onValueChange={setQuery} placeholder="Search this folder" aria-label="Search this folder" className="h-8 w-48 pl-8 text-xs" />
            </span>
          )}
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
            <FileInputTrigger className="ui-btn" data-variant="primary" data-size="sm">
              <Upload className="size-3.5" aria-hidden="true" /> Upload
            </FileInputTrigger>
          )}
        </div>
      </div>

      {uploads.length > 0 && (
        <ul className="ui-uploads" aria-label="Uploads">
          {uploads.map((u) => (
            <li key={u.id} className="ui-upload">
              <Upload className="size-3.5 shrink-0 text-[var(--color-text-secondary)]" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{u.name}</span>
                  <span className="shrink-0 tabular-nums text-[var(--color-text-secondary)]">
                    {u.error ? 'Failed' : u.pct >= 100 ? 'Done' : `${formatBytes((u.size * u.pct) / 100)} of ${formatBytes(u.size)}`}
                  </span>
                </span>
                {u.error ? (
                  <span className="block text-[11px] text-[var(--color-error)]">{u.error}</span>
                ) : (
                  <Progress value={u.pct} min={0} max={100} aria-label={`Uploading ${u.name}`} className="mt-1">
                    <ProgressTrack><ProgressIndicator /></ProgressTrack>
                  </Progress>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <InlineAlert
          tone="danger"
          className="mx-3 mt-3"
          actions={
            <Button className="ui-btn" data-variant="ghost" data-size="sm" onClick={() => load(currentPath)}>
              Try again
            </Button>
          }
        >
          {error}
        </InlineAlert>
      )}

      <Dropzone enabled={authenticated} folder={breadcrumbs[breadcrumbs.length - 1] ?? scopeRootLabel}>
      <ScrollArea className="min-h-0 flex-1" aria-label="Folder contents">
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
            <EmptyState
              icon={Folder}
              title={`This ${scope} folder is empty`}
              description={!authenticated ? 'Nothing has been shared yet.' : scope === 'public' ? 'Publish something from Private, or drop files here.' : 'Drop files here or use Upload.'}
            />
          )}
          {noMatches && <EmptyState icon={Search} title={`Nothing here matches “${query}”`} compact />}

          {listing && !isEmpty && !noMatches && (
            <div className="ui-file-cols ui-file-head" aria-hidden="true">
              <span />
              <span>Name</span>
              <span className="text-right">Size</span>
              <span>Modified</span>
              <span />
            </div>
          )}

          {listing && !isEmpty && !noMatches && (
            <Listbox
              aria-label={`${scopeRootLabel} folder contents`}
              className="ui-listbox"
              activation="manual"
              onValueChange={openEntry}
            >
              {dirs.map((dir: CopypartyDir) => {
                const path = currentPath + dir.n + '/';
                return (
                  <ListboxItem key={`dir:${dir.n}`} value={`dir:${path}`} className="ui-list-item ui-file-cols">
                    <ListboxItemIcon data-kind="folder">
                      <Folder className="size-4" aria-hidden="true" />
                    </ListboxItemIcon>
                    <span className="min-w-0 truncate text-[0.8125rem] font-medium">{dir.n}</span>
                    <span className="ui-file-meta text-right">Folder</span>
                    <span className="ui-file-meta">{dir.ts > 0 ? formatDate(dir.ts) : '—'}</span>
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
                  <ListboxItem key={`file:${file.n}`} value={`file:${path}`} className="ui-list-item ui-file-cols">
                    <ListboxItemIcon>
                      <File className="size-4" aria-hidden="true" />
                    </ListboxItemIcon>
                    <span className="min-w-0 truncate text-[0.8125rem]">{file.n}</span>
                    <span className="ui-file-meta text-right">{formatBytes(file.sz)}</span>
                    <span className="ui-file-meta">{file.ts > 0 ? formatDate(file.ts) : '—'}</span>
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
      </Dropzone>
    </FileInput>
  );
}

/** Lets files dropped or pasted on the list upload into the open folder. */
function Dropzone({ enabled, folder, children }: { enabled: boolean; folder: string; children: React.ReactNode }) {
  if (!enabled) return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
  return (
    <FileInputDropzone className="ui-dropzone" aria-label={`Drop files to upload to ${folder}`}>
      {children}
      <div className="ui-dropzone-hint" aria-hidden="true">
        <Upload className="size-5" />
        Drop to upload to {folder}
      </div>
    </FileInputDropzone>
  );
}
