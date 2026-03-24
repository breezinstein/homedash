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
} from 'lucide-react';
import { listDirectory, getFileDownloadUrl, uploadFile, deleteItem } from '../api/filesApi';
import type { CopypartyListing, CopypartyFile, CopypartyDir } from '../types';

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

export function FileSharing({ onClose }: FileSharingProps) {
  const [currentPath, setCurrentPath] = useState('/shared/');
  const [listing, setListing] = useState<CopypartyListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDirectory(path);
      setListing(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(currentPath);
  }, [currentPath, load]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const navigate = (path: string) => setCurrentPath(path);

  const breadcrumbs = currentPath.split('/').filter(Boolean);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadProgress(0);
    setError(null);
    try {
      await uploadFile(currentPath, file, setUploadProgress);
      await load(currentPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (path: string) => {
    setDeletingPath(path);
    setError(null);
    try {
      await deleteItem(path);
      await load(currentPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingPath(null);
    }
  };

  const isEmpty = listing && listing.dirs.length === 0 && listing.files.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-background)]">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3 bg-[var(--color-surface)] border-b border-[var(--color-border)] shrink-0">
        {/* Title */}
        <span className="text-sm font-semibold text-[var(--color-text-primary)] shrink-0 hidden sm:block">
          File Sharing
        </span>
        <span className="text-[var(--color-border)] hidden sm:block">|</span>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
          <button
            onClick={() => navigate('/shared/')}
            className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors shrink-0"
            title="Root"
          >
            <Home className="w-4 h-4" />
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

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => load(currentPath)}
            disabled={loading}
            className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
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
          <button
            onClick={onClose}
            className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Upload progress bar */}
      {uploadProgress !== null && (
        <div className="h-1 bg-[var(--color-surface)] shrink-0">
          <div
            className="h-full bg-[var(--color-primary)] transition-all duration-100"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1 min-w-0 truncate">{error}</span>
          <button
            onClick={() => load(currentPath)}
            className="underline hover:no-underline shrink-0"
          >
            Retry
          </button>
          <button onClick={() => setError(null)} className="shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        {/* Initial loading */}
        {loading && !listing && (
          <div className="flex items-center justify-center py-24">
            <RefreshCw className="w-8 h-8 text-[var(--color-text-secondary)] animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && isEmpty && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-[var(--color-surface)] flex items-center justify-center">
              <Folder className="w-8 h-8 text-[var(--color-text-secondary)]" />
            </div>
            <p className="text-[var(--color-text-primary)] font-medium mb-1">This folder is empty</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Click Upload to add files
            </p>
          </div>
        )}

        {/* File/folder grid */}
        {listing && !isEmpty && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {listing.dirs.map((dir) => (
              <DirCard
                key={dir.n}
                dir={dir}
                currentPath={currentPath}
                onNavigate={navigate}
                onDelete={handleDelete}
                deleting={deletingPath === currentPath + dir.n + '/'}
              />
            ))}
            {listing.files.map((file) => (
              <FileCard
                key={file.n}
                file={file}
                currentPath={currentPath}
                onDelete={handleDelete}
                deleting={deletingPath === currentPath + file.n}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface DirCardProps {
  dir: CopypartyDir;
  currentPath: string;
  onNavigate: (path: string) => void;
  onDelete: (path: string) => void;
  deleting: boolean;
}

function DirCard({ dir, currentPath, onNavigate, onDelete, deleting }: DirCardProps) {
  const path = currentPath + dir.n + '/';
  return (
    <div
      className="group relative flex flex-col items-center gap-2 p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 transition-colors cursor-pointer"
      onClick={() => onNavigate(path)}
    >
      <Folder className="w-10 h-10 text-[var(--color-accent)]" />
      <span className="text-xs text-[var(--color-text-primary)] text-center break-all line-clamp-2 w-full leading-tight">
        {dir.n}
      </span>
      {dir.ts > 0 && (
        <span className="text-xs text-[var(--color-text-secondary)]">{formatDate(dir.ts)}</span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!window.confirm(`Delete folder "${dir.n}" and all its contents?`)) return;
          onDelete(path);
        }}
        disabled={deleting}
        className="absolute top-1.5 right-1.5 p-1 rounded opacity-0 group-hover:opacity-100 text-[var(--color-text-secondary)] hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-50"
        title="Delete folder"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

interface FileCardProps {
  file: CopypartyFile;
  currentPath: string;
  onDelete: (path: string) => void;
  deleting: boolean;
}

function FileCard({ file, currentPath, onDelete, deleting }: FileCardProps) {
  const filePath = currentPath + file.n;
  const downloadUrl = getFileDownloadUrl(filePath);
  return (
    <div className="group relative flex flex-col items-center gap-2 p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 transition-colors">
      <a
        href={downloadUrl}
        download={file.n}
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col items-center gap-2 w-full"
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
      <button
        onClick={() => {
          if (!window.confirm(`Delete "${file.n}"?`)) return;
          onDelete(filePath);
        }}
        disabled={deleting}
        className="absolute top-1.5 right-1.5 p-1 rounded opacity-0 group-hover:opacity-100 text-[var(--color-text-secondary)] hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-50"
        title="Delete file"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}
