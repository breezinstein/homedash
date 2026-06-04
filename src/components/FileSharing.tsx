import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react';
import {
  X,
  Folder,
  File,
  Upload,
  ChevronRight,
  Home,
  RefreshCw,
  Trash2,
  AlertCircle,
  Share2,
  Globe,
  Lock,
  Link2,
  ArrowDownToLine,
  ArrowUpFromLine,
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
import { ModalShell, useConfirm, useToast } from './ui';
import { useDashboard } from '../context/DashboardContext';
import { useAuth } from '../context/AuthContext';

// Web Share API is best-effort; we fall back to clipboard copy when it isn't
// available or the user dismisses the system share sheet.
const canWebShare =
  typeof navigator !== 'undefined' &&
  typeof (navigator as Navigator).share === 'function';

interface FileSharingProps {
  onClose: () => void;
}

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
// links) and Private (admin-only working area). The modal renders one scope
// at a time on mobile and as side-by-side panes on desktop — anonymous
// viewers only ever see Public.
export function FileSharing({ onClose }: FileSharingProps) {
  const { authenticated } = useAuth();
  // Anonymous viewers can only browse public; admins start on private (their
  // working area) but can switch to public to publish/unpublish.
  const initialScope: FileScope = authenticated ? 'private' : 'public';
  const [activeScope, setActiveScope] = useState<FileScope>(initialScope);

  return (
    <ModalShell onClose={onClose} ariaLabel="File Sharing">
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] w-full max-w-4xl shadow-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col">
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-[var(--color-border)] shrink-0">
          <span className="text-sm font-semibold text-[var(--color-text-primary)] shrink-0">
            File Sharing
          </span>
          {authenticated && (
            <div className="flex items-center bg-[var(--color-background)] rounded-lg p-0.5">
              <button
                onClick={() => setActiveScope('private')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  activeScope === 'private'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
                title="Private area (admins only)"
              >
                <Lock className="w-3.5 h-3.5" />
                Private
              </button>
              <button
                onClick={() => setActiveScope('public')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  activeScope === 'public'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
                title="Public share area (anyone with the link)"
              >
                <Globe className="w-3.5 h-3.5" />
                Public
              </button>
            </div>
          )}
          {!authenticated && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)]"
              title="Sign in to upload, delete, or publish"
            >
              <Globe className="w-3 h-3" />
              Public (read-only)
            </span>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-2 -m-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ScopePane
          // Remount the pane when the scope changes so its internal navigation
          // state (currentPath) resets cleanly. Cheaper than threading scope
          // changes through every callback.
          key={activeScope}
          scope={activeScope}
        />
      </div>
    </ModalShell>
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
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [movingPath, setMovingPath] = useState<string | null>(null);
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

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadProgress(0);
    setError(null);
    try {
      await uploadFile(scope, currentPath, file, setUploadProgress);
      await load(currentPath);
      toast.success(`Uploaded ${file.name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
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
    setDeletingPath(path);
    setError(null);
    try {
      await deleteItem(scope, path);
      await load(currentPath);
      toast.success(kind === 'folder' ? 'Folder deleted' : 'File deleted');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Delete failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setDeletingPath(null);
    }
  };

  // Publish (private->public) or Unpublish (public->private). Always lands at
  // the scope root with the same item name so admins don't have to think about
  // destination folders for the common case; richer placement can be added
  // later. Refuses to overwrite — the toast tells the admin to remove the
  // existing item first.
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
    setMovingPath(sourcePath);
    setError(null);
    try {
      await moveItem(
        { scope, path: sourcePath },
        { scope: targetScope, path: `/${displayName}` },
      );
      await load(currentPath);
      toast.success(scope === 'private' ? `Published ${displayName}` : `Unpublished ${displayName}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Move failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setMovingPath(null);
    }
  };

  const handleShare = async (filePath: string, fileName: string) => {
    // Share/Copy semantics differ by scope:
    //   - public: copies the absolute share URL (the link admins distribute).
    //   - private: copies the auth-only download URL (useful for the admin
    //     to paste into other admin tooling; would 401 for the public).
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

  const isEmpty = listing && listing.dirs.length === 0 && listing.files.length === 0;
  const scopeRootLabel = scope === 'public' ? 'Public' : 'Private';

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors shrink-0"
            title={`${scopeRootLabel} root`}
          >
            <Home className="w-4 h-4" />
            <span className="text-xs font-medium">{scopeRootLabel}</span>
          </button>
          {breadcrumbs.map((segment, i) => {
            const segPath = '/' + breadcrumbs.slice(0, i + 1).join('/') + '/';
            return (
              <span key={segPath} className="flex items-center gap-1 shrink-0">
                <ChevronRight className="w-3 h-3 text-[var(--color-text-secondary)]" />
                <button
                  onClick={() => navigate(segPath)}
                  className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  {segment}
                </button>
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => load(currentPath)}
            disabled={loading}
            className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {authenticated && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadProgress !== null}
                className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 transition-colors text-sm font-medium disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Upload</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleUpload}
              />
            </>
          )}
        </div>
      </div>

      {uploadProgress !== null && (
        <div className="h-1 bg-[var(--color-background)] shrink-0">
          <div
            className="h-full bg-[var(--color-primary)] transition-all duration-100"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1 min-w-0 truncate">{error}</span>
          <button onClick={() => load(currentPath)} className="underline hover:no-underline shrink-0">
            Retry
          </button>
          <button onClick={() => setError(null)} className="shrink-0" aria-label="Dismiss error">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-5">
        {loading && !listing && (
          <div className="flex items-center justify-center py-24">
            <RefreshCw className="w-8 h-8 text-[var(--color-text-secondary)] animate-spin" />
          </div>
        )}

        {!loading && isEmpty && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-[var(--color-background)] flex items-center justify-center">
              <Folder className="w-8 h-8 text-[var(--color-text-secondary)]" />
            </div>
            <p className="text-[var(--color-text-primary)] font-medium mb-1">
              This {scope} folder is empty
            </p>
            {authenticated ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                {scope === 'public'
                  ? 'Publish something from Private, or upload directly here.'
                  : 'Click Upload to add files.'}
              </p>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                No public shares yet.
              </p>
            )}
          </div>
        )}

        {listing && !isEmpty && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {listing.dirs.map((dir) => (
              <DirCard
                key={dir.n}
                dir={dir}
                currentPath={currentPath}
                scope={scope}
                authenticated={authenticated}
                onNavigate={navigate}
                onDelete={(p) => handleDelete(p, 'folder', dir.n)}
                onMoveAcrossScope={(p) => handleMoveAcrossScope(p, 'folder', dir.n)}
                deleting={deletingPath === currentPath + dir.n + '/'}
                moving={movingPath === currentPath + dir.n + '/'}
              />
            ))}
            {listing.files.map((file) => (
              <FileCard
                key={file.n}
                file={file}
                currentPath={currentPath}
                scope={scope}
                authenticated={authenticated}
                onDelete={(p) => handleDelete(p, 'file', file.n)}
                onShare={(p) => handleShare(p, file.n)}
                onMoveAcrossScope={(p) => handleMoveAcrossScope(p, 'file', file.n)}
                deleting={deletingPath === currentPath + file.n}
                moving={movingPath === currentPath + file.n}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

interface DirCardProps {
  dir: CopypartyDir;
  currentPath: string;
  scope: FileScope;
  authenticated: boolean;
  onNavigate: (path: string) => void;
  onDelete: (path: string) => void;
  onMoveAcrossScope: (path: string) => void;
  deleting: boolean;
  moving: boolean;
}

function DirCard({ dir, currentPath, scope, authenticated, onNavigate, onDelete, onMoveAcrossScope, deleting, moving }: DirCardProps) {
  const path = currentPath + dir.n + '/';
  return (
    <div
      className="group relative flex flex-col items-center gap-2 p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 active:bg-[var(--color-background)] transition-colors cursor-pointer"
      onClick={() => onNavigate(path)}
    >
      <Folder className="w-10 h-10 text-[var(--color-accent)]" />
      <span className="text-xs text-[var(--color-text-primary)] text-center break-all line-clamp-2 w-full leading-tight">
        {dir.n}
      </span>
      {dir.ts > 0 && (
        <span className="text-xs text-[var(--color-text-secondary)]">{formatDate(dir.ts)}</span>
      )}
      {authenticated && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onMoveAcrossScope(path); }}
            disabled={moving}
            className="p-1.5 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors disabled:opacity-50"
            title={scope === 'private' ? 'Publish to public area' : 'Unpublish (move back to private)'}
            aria-label={scope === 'private' ? `Publish folder ${dir.n}` : `Unpublish folder ${dir.n}`}
          >
            {scope === 'private' ? <ArrowUpFromLine className="w-3.5 h-3.5" /> : <ArrowDownToLine className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(path); }}
            disabled={deleting}
            className="p-1.5 rounded text-[var(--color-text-secondary)] hover:text-red-400 hover:bg-red-400/10 active:bg-red-400/20 transition-colors disabled:opacity-50"
            title="Delete folder"
            aria-label={`Delete folder ${dir.n}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

interface FileCardProps {
  file: CopypartyFile;
  currentPath: string;
  scope: FileScope;
  authenticated: boolean;
  onDelete: (path: string) => void;
  onShare: (path: string) => void;
  onMoveAcrossScope: (path: string) => void;
  deleting: boolean;
  moving: boolean;
}

function FileCard({ file, currentPath, scope, authenticated, onDelete, onShare, onMoveAcrossScope, deleting, moving }: FileCardProps) {
  const filePath = currentPath + file.n;
  const downloadUrl = getFileDownloadUrl(scope, filePath);
  const shareTitle = scope === 'public'
    ? (canWebShare ? 'Share' : 'Copy share link')
    : 'Copy admin link';
  return (
    <div className="group relative flex flex-col items-center gap-2 p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 transition-colors">
      <a
        href={downloadUrl}
        download={file.n}
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col items-center gap-2 w-full active:scale-[0.98] transition-transform"
        title={`Download ${file.n}`}
      >
        <File className="w-10 h-10 text-[var(--color-primary)]" />
        <span className="text-xs text-[var(--color-text-primary)] text-center break-all line-clamp-2 w-full leading-tight">
          {file.n}
        </span>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xs text-[var(--color-text-secondary)]">{formatBytes(file.sz)}</span>
          {file.ts > 0 && (
            <span className="text-xs text-[var(--color-text-secondary)]">{formatDate(file.ts)}</span>
          )}
        </div>
      </a>
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {/* Share/copy link — public shows a Share icon (public share link),
            private shows a Link icon and only appears for admins (the URL
            is auth-only). Both fall back to clipboard if Web Share is
            unavailable. */}
        {(scope === 'public' || authenticated) && (
          <button
            onClick={(e) => { e.stopPropagation(); onShare(filePath); }}
            className="p-1.5 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 active:bg-[var(--color-primary)]/20 transition-colors"
            title={shareTitle}
            aria-label={`${shareTitle} for ${file.n}`}
          >
            {scope === 'public' ? <Share2 className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
          </button>
        )}
        {authenticated && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveAcrossScope(filePath); }}
              disabled={moving}
              className="p-1.5 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors disabled:opacity-50"
              title={scope === 'private' ? 'Publish to public area' : 'Unpublish (move back to private)'}
              aria-label={scope === 'private' ? `Publish ${file.n}` : `Unpublish ${file.n}`}
            >
              {scope === 'private' ? <ArrowUpFromLine className="w-3.5 h-3.5" /> : <ArrowDownToLine className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(filePath); }}
              disabled={deleting}
              className="p-1.5 rounded text-[var(--color-text-secondary)] hover:text-red-400 hover:bg-red-400/10 active:bg-red-400/20 transition-colors disabled:opacity-50"
              title="Delete file"
              aria-label={`Delete file ${file.n}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
