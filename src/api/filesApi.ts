import type { CopypartyListing } from '../types';

const FILES_BASE = '/api/files';

/**
 * Encode each segment of a virtual file path without encoding the path
 * separators. This ensures filenames with spaces, #, ?, %, etc. produce
 * valid URLs while preserving the directory structure.
 */
function encodeFilePath(path: string): string {
  return path.split('/').map(seg => (seg ? encodeURIComponent(seg) : seg)).join('/');
}

/** List directory contents at the given virtual path. Returns JSON with dirs and files arrays. */
export async function listDirectory(path: string): Promise<CopypartyListing> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(`${FILES_BASE}${encodeFilePath(cleanPath)}`);
  if (!res.ok) throw new Error(`Failed to list directory (${res.status})`);
  return res.json();
}

/** Returns a URL that triggers a direct file download through the proxy. */
export function getFileDownloadUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${FILES_BASE}${encodeFilePath(cleanPath)}`;
}

/**
 * Upload a file to the given directory path using PUT.
 * Uses XMLHttpRequest so upload progress can be reported.
 */
export function uploadFile(
  dirPath: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanDir = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;
    const url = `${FILES_BASE}${encodeFilePath(cleanDir)}${encodeURIComponent(file.name)}`;

    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
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
export async function deleteItem(path: string): Promise<void> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const res = await fetch(`${FILES_BASE}${encodeFilePath(cleanPath)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}
