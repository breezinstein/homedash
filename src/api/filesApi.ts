import type { CopypartyListing } from '../types';
import { AuthRequiredError } from './http';

const FILES_BASE = '/api/files';

export type FileScope = 'public' | 'private';

/**
 * Encode each segment of a virtual file path without encoding the path
 * separators. This ensures filenames with spaces, #, ?, %, etc. produce
 * valid URLs while preserving the directory structure.
 */
function encodeFilePath(path: string): string {
  return path.split('/').map(seg => (seg ? encodeURIComponent(seg) : seg)).join('/');
}

function scopedUrl(scope: FileScope, path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${FILES_BASE}/${scope}${encodeFilePath(cleanPath)}`;
}

/** List directory contents at the given virtual path. Returns JSON with dirs and files arrays. */
export async function listDirectory(scope: FileScope, path: string): Promise<CopypartyListing> {
  const res = await fetch(scopedUrl(scope, path), { credentials: 'include' });
  if (res.status === 401) throw new AuthRequiredError();
  if (!res.ok) throw new Error(`Failed to list directory (${res.status})`);
  return res.json();
}

/** Returns a URL that triggers a direct file download. For the public scope
 *  this URL is the share link admins distribute. */
export function getFileDownloadUrl(scope: FileScope, path: string): string {
  return scopedUrl(scope, path);
}

/**
 * Upload a file to the given directory path using PUT.
 * Uses XMLHttpRequest so upload progress can be reported.
 */
export function uploadFile(
  scope: FileScope,
  dirPath: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanDir = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;
    const url = `${scopedUrl(scope, cleanDir)}${encodeURIComponent(file.name)}`;

    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.withCredentials = true;
    xhr.setRequestHeader('X-Requested-With', 'HomeDash');

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status === 401) {
        reject(new AuthRequiredError());
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Upload failed: network error'));
    xhr.send(file);
  });
}

/** Delete a file or directory at the given virtual path. */
export async function deleteItem(scope: FileScope, path: string): Promise<void> {
  const res = await fetch(scopedUrl(scope, path), {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'X-Requested-With': 'HomeDash' },
  });
  if (res.status === 401) throw new AuthRequiredError();
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

export interface MoveOptions {
  overwrite?: boolean;
}

/** Move/copy a file or folder between scopes (publish/unpublish) or rename
 *  within a scope. Server uses rename when possible, falls back to copy +
 *  unlink across volumes. */
export async function moveItem(
  from: { scope: FileScope; path: string },
  to: { scope: FileScope; path: string },
  opts: MoveOptions = {},
): Promise<void> {
  const res = await fetch(`${FILES_BASE}/move`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'HomeDash',
    },
    body: JSON.stringify({ from, to, overwrite: !!opts.overwrite }),
  });
  if (res.status === 401) throw new AuthRequiredError();
  if (res.status === 409) throw new Error('Destination already exists');
  if (!res.ok) {
    let body: { error?: string } = {};
    try { body = await res.json(); } catch { /* ignore */ }
    throw new Error(body.error || `Move failed (${res.status})`);
  }
}
