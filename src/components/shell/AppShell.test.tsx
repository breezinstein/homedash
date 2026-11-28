import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAgent } from '@ui-sdk/react/agent';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Bell, FolderOpen } from 'lucide-react';
import { AppShell, type ShellTool } from './AppShell';

const tools: ShellTool[] = [
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'notifications', label: 'Notifications', icon: Bell, adminOnly: true },
];

function renderShell(props: Partial<Parameters<typeof AppShell>[0]> = {}) {
  const onNavigate = vi.fn();
  render(
    <AppShell
      tools={tools}
      view="dashboard"
      onNavigate={onNavigate}
      categories={['Media']}
      authEnabled
      authenticated
      onSignIn={() => {}}
      onSignOut={() => {}}
      onOpenPalette={() => {}}
      notifications={null}
      serviceCount={4}
      {...props}
    >
      <p>content</p>
    </AppShell>,
  );
  return { onNavigate };
}

const agent = createAgent();

describe('AppShell sidebar states', () => {
  beforeEach(() => localStorage.clear());

  test('expanded → icon rail → floating button → overlay → pinned', async () => {
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse to icons' }));
    expect(localStorage.getItem('homedash-sidebar-mode')).toBe('rail');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Hide sidebar' }));
    expect(localStorage.getItem('homedash-sidebar-mode')).toBe('hidden');
    const fab = screen.getByRole('button', { name: 'Open sidebar' });

    await userEvent.click(fab);
    await userEvent.click(await screen.findByRole('button', { name: 'Keep sidebar open' }));
    expect(localStorage.getItem('homedash-sidebar-mode')).toBe('expanded');
    expect(screen.queryByRole('button', { name: 'Open sidebar' })).toBeNull();
  });

  test('[ switches between the docked state and the floating button', async () => {
    renderShell();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse to icons' }));
    await userEvent.keyboard('[[');
    expect(localStorage.getItem('homedash-sidebar-mode')).toBe('hidden');
    await userEvent.keyboard('[[');
    expect(localStorage.getItem('homedash-sidebar-mode')).toBe('rail');
  });

  test('a /monitor page load starts hidden without changing the saved choice', () => {
    localStorage.setItem('homedash-sidebar-mode', 'expanded');
    renderShell({ startHidden: true, view: 'monitor' });
    expect(screen.getByRole('button', { name: 'Open sidebar' })).toBeTruthy();
    expect(localStorage.getItem('homedash-sidebar-mode')).toBe('expanded');
  });

  test('the alert count reaches the Monitor item and the floating button', () => {
    renderShell({ alertCount: 3, startHidden: true });
    expect(screen.getByRole('button', { name: 'Open sidebar, 3 alerts firing' })).toBeTruthy();
  });

  test('Monitor is a view, not a new tab', async () => {
    const { onNavigate } = renderShell({ alertCount: 2 });
    await userEvent.click(screen.getByRole('button', { name: /Monitor/ }));
    expect(onNavigate).toHaveBeenCalledWith('monitor');
    expect(screen.getByLabelText('2 firing')).toBeTruthy();
  });

  test('an agent can find every control in the sidebar', () => {
    renderShell();
    const components = agent.snapshot().filter((e) => !e.offPage && e.component !== 'more');
    for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
    const labels = components.map((e) => e.label);
    for (const label of ['Collapse to icons', 'Settings', 'Sign out']) {
      expect(labels, `${label} is missing from the snapshot`).toContain(label);
    }
  });
});
