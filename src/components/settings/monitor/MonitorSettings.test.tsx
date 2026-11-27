import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAgent } from '@ui-sdk/react/agent';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { DashboardConfig, RemoteServer } from '../../../types';
import { canLeave } from '../../../lib/navGuard';
import { ConfirmProvider, ToastProvider } from '../../ui';
import { MonitorDraftProvider, MonitorSaveBar } from './MonitorDraft';
import { MonitorGeneralSection } from './MonitorSections';
import { ServersSection } from '../ServersSection';

const servers: RemoteServer[] = [
  { id: 'h1', name: 'nas', url: 'http://nas.lan:61208', createdAt: '', monitor: true },
  { id: 's2', name: 'laptop', url: 'http://laptop.lan:61208', createdAt: '', monitor: false },
];

const dashboard = {
  config: {
    monitoring: { enabled: true, pollIntervalSeconds: 10, ui: { tabRotationSeconds: 15 }, alerts: [] },
    metadata: { serverMerge: { at: '', merged: 1, added: 0, conflicts: ['nas'], dismissed: false } },
    servers,
  } as unknown as DashboardConfig,
  setConfig: vi.fn(),
  servers,
  inverters: [],
  addServer: vi.fn(),
  updateServer: vi.fn(),
  deleteServer: vi.fn(),
};

vi.mock('../../../context/DashboardContext', () => ({ useDashboard: () => dashboard }));
vi.mock('../../../monitor/monitorApi', () => ({ fetchOverview: vi.fn(async () => ({ certificates: null })), refreshCertificates: vi.fn() }));

function renderGeneral() {
  return render(
    <ToastProvider>
      <ConfirmProvider>
        <MonitorDraftProvider>
          <MonitorGeneralSection onJump={() => {}} />
          <MonitorSaveBar />
        </MonitorDraftProvider>
      </ConfirmProvider>
    </ToastProvider>,
  );
}

const agent = createAgent();

describe('monitor settings draft', () => {
  beforeEach(() => vi.clearAllMocks());

  test('edits stay staged until Save, which writes config.monitoring once', async () => {
    renderGeneral();
    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save.hasAttribute('data-disabled') || save.hasAttribute('disabled')).toBe(true);

    await userEvent.click(screen.getByRole('switch', { name: 'Run the monitor' }));
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    expect(dashboard.setConfig).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(dashboard.setConfig).toHaveBeenCalledOnce();
    const saved = dashboard.setConfig.mock.calls[0][0] as DashboardConfig;
    expect(saved.monitoring?.enabled).toBe(false);
    expect(saved.servers).toBe(servers);
  });

  test('Ctrl+S saves and Discard drops the draft', async () => {
    renderGeneral();
    // The poll presets come first; the rotation presets repeat 30s and 60s.
    await userEvent.click(screen.getAllByRole('radio', { name: '30s' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByText('Unsaved changes')).toBeNull();

    await userEvent.click(screen.getAllByRole('radio', { name: '60s' })[0]);
    await userEvent.keyboard('{Control>}s{/Control}');
    expect(dashboard.setConfig).toHaveBeenCalledOnce();
  });

  test('leaving with unsaved changes asks first', async () => {
    renderGeneral();
    await userEvent.click(screen.getByRole('switch', { name: 'Run the monitor' }));
    const leaving = canLeave();
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(await leaving).toBe(false);

    const again = canLeave();
    await userEvent.click(await screen.findByRole('button', { name: 'Discard changes' }));
    expect(await again).toBe(true);
    await waitFor(() => expect(screen.queryByText('Unsaved changes')).toBeNull());
  });

  test('an agent can find and change the general settings', async () => {
    renderGeneral();
    const components = agent.snapshot().filter((e) => !e.offPage && e.component !== 'more');
    for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
    const labels = components.map((e) => e.label);
    for (const label of ['Run the monitor', 'Poll every', 'Rotate tabs every']) {
      expect(labels, `${label} is missing from the snapshot`).toContain(label);
    }
    const result = await agent.act({ steps: [{ ref: 'Run the monitor', action: 'setChecked', args: [false] }] });
    expect(result.ok, result.error?.message).toBe(true);
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });
});

describe('Servers', () => {
  test('one list, a monitor switch per server and the merge notice', async () => {
    render(
      <ToastProvider>
        <ConfirmProvider>
          <ServersSection />
        </ConfirmProvider>
      </ToastProvider>,
    );
    expect(screen.getByText('Remote servers and monitor hosts are now one list')).toBeTruthy();
    expect(screen.getByText(/nas had different logins/)).toBeTruthy();

    const laptop = screen.getByRole('switch', { name: 'Show laptop on the monitor' });
    expect(laptop.getAttribute('aria-checked')).toBe('false');
    await userEvent.click(laptop);
    expect(dashboard.updateServer).toHaveBeenCalledWith('s2', { monitor: true });

    const notice = screen.getByText('Remote servers and monitor hosts are now one list').closest('.ui-alert') as HTMLElement;
    await userEvent.click(within(notice).getByRole('button', { name: 'Dismiss' }));
    const calls = dashboard.setConfig.mock.calls;
    const cfg = calls[calls.length - 1]?.[0] as DashboardConfig;
    expect(cfg.metadata.serverMerge?.dismissed).toBe(true);
  });
});
