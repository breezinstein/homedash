import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ConfirmProvider, ToastProvider } from './ui';
import { FileSharing } from './FileSharing';
import { listDirectory, uploadFile } from '../api/filesApi';

vi.mock('../api/filesApi', () => ({
  listDirectory: vi.fn(),
  uploadFile: vi.fn(),
  getFileDownloadUrl: (scope: string, path: string) => `/api/files/${scope}${path}`,
  deleteItem: vi.fn(),
  moveItem: vi.fn(),
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ authenticated: true }) }));
vi.mock('../context/DashboardContext', () => ({ useDashboard: () => ({ copyClipToSystemClipboard: vi.fn(async () => true) }) }));

const list = vi.mocked(listDirectory);
const upload = vi.mocked(uploadFile);

function renderFiles() {
  return render(
    <ToastProvider>
      <ConfirmProvider>
        <FileSharing />
      </ConfirmProvider>
    </ToastProvider>,
  );
}

const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;
const file = (name: string) => new File(['x'], name, { type: 'text/plain' });

describe('Files uploads', () => {
  beforeEach(() => {
    list.mockReset();
    upload.mockReset();
    list.mockImplementation(async (_scope, path) => ({
      path,
      dirs: path === '/' ? [{ n: 'sub', ts: 0 }] : [],
      files: [],
    }));
  });

  test('a mixed batch toasts the file that uploaded and keeps the failure until dismissed', async () => {
    upload.mockImplementation(async (_scope, _dir, f, onProgress) => {
      if (f.name === 'a.txt') throw new Error('Disk full');
      onProgress?.(100);
    });
    renderFiles();
    await screen.findByRole('option', { name: /sub/ });
    await userEvent.setup({ pointerEventsCheck: 0 }).upload(fileInput(), [file('a.txt'), file('b.txt')]);

    expect(await screen.findByText('Uploaded b.txt')).toBeTruthy();
    expect(screen.getByText('Disk full')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss a.txt' }));
    await waitFor(() => expect(screen.queryByText('Disk full')).toBeNull());
  });

  test('finishing an upload does not reload a folder the person has left', async () => {
    let finish!: () => void;
    upload.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    renderFiles();
    await screen.findByRole('option', { name: /sub/ });
    await userEvent.setup({ pointerEventsCheck: 0 }).upload(fileInput(), [file('c.txt')]);

    await userEvent.dblClick(screen.getByRole('option', { name: /sub/ }));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(list).toHaveBeenCalledWith('private', '/sub/'));
    const rootLoads = list.mock.calls.filter(([, p]) => p === '/').length;

    finish();
    expect(await screen.findByText('Uploaded c.txt')).toBeTruthy();
    expect(list.mock.calls.filter(([, p]) => p === '/').length).toBe(rootLoads);
  });
});
