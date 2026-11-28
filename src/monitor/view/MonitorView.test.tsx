import { act, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { createAgent } from '@ui-sdk/react/agent';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { HostSnapshot, MonitorOverview } from '../../types';
import { MonitorView } from './MonitorView';
import { AppShell } from '../../components/shell/AppShell';

function host(id: string, name: string, cpu: number, disk: number, status: HostSnapshot['status'] = 'ok'): HostSnapshot {
  return {
    host: { id, name },
    status,
    cpu: { percent: cpu, cores: 4, load: { '1m': 1, '5m': 1, '15m': 1 } },
    memory: { total: 8e9, used: 4e9, percent: 50 },
    disk: { total: 1e12, used: disk * 1e10, percent: disk },
    temperature: { value: 50, label: 'cpu', warning: 70, critical: 85, max: 55 },
    network: { rxBps: 1000, txBps: 2000 },
    uptime: { seconds: 3600, formatted: '1:00' },
    system: { distro: 'Debian 13' },
    containers: [],
  };
}

const overview: MonitorOverview = {
  timestamp: Date.now(),
  globalStatus: 'degraded',
  hosts: [host('a', 'alpha', 20, 30), host('b', 'bravo', 30, 95), host('c', 'charlie', 5, 10, 'down')],
  solar: null,
  docker: { status: 'ok', total: 10, running: 10, healthy: 8, unhealthy: 0, restarting: 0, problems: [] },
  media: null,
  usenet: null,
  arr: null,
  seerr: null,
  opnsense: null,
  ntopng: null,
  homeassistant: null,
  certificates: null,
  alerts: {
    firing: [{ id: 'x', ruleId: 'r', name: 'Disk', severity: 'critical', state: 'firing', message: 'bravo disk at 95%', value: 95, since: Date.now() - 60000, acked: false }],
    recentlyResolved: [],
  },
  pollIntervalMs: 10000,
  tabRotationSeconds: 15,
};

let current: MonitorOverview = overview;
vi.mock('../monitorApi', () => ({
  fetchOverview: vi.fn(async () => current),
  fetchAlerts: vi.fn(async () => current.alerts),
}));

const agent = createAgent();

describe('MonitorView', () => {
  beforeEach(() => {
    current = { ...overview, timestamp: Date.now() };
    localStorage.clear();
    window.history.replaceState(null, '', '/monitor');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('shows the live status, a critical banner and the server tab first', async () => {
    render(<MonitorView onOpenSettings={() => {}} />);
    expect(await screen.findByText('Degraded · 1 firing')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('bravo disk at 95%');
    const tab = screen.getByRole('tab', { name: 'Server' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    const rail = screen.getByRole('complementary', { name: 'Alerts' });
    expect(within(rail).getByText('Needs attention')).toBeTruthy();
    expect(within(rail).getByText('charlie is down')).toBeTruthy();
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('heading', { name: 'alpha' })).toBeTruthy();
  });

  test('orders hosts by what needs attention: down, then critical, then the rest', async () => {
    render(<MonitorView onOpenSettings={() => {}} />);
    await screen.findByRole('heading', { name: 'alpha' });
    const names = screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'));
    expect(names).toEqual(['charlie', 'bravo', 'alpha']);
    await userEvent.click(screen.getByRole('radio', { name: 'Name' }));
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['alpha', 'bravo', 'charlie']);
  });

  test('choosing a tab pauses rotation for a minute', async () => {
    render(<MonitorView onOpenSettings={() => {}} />);
    await screen.findByRole('heading', { name: 'alpha' });
    await userEvent.click(screen.getByRole('tab', { name: /Network/ }));
    expect(screen.getByRole('tab', { name: /Network/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(/Paused · resumes in 60s/)).toBeTruthy();
  });

  test('arrow keys on the tab list move between tabs', async () => {
    render(<MonitorView onOpenSettings={() => {}} />);
    await screen.findByRole('heading', { name: 'alpha' });
    screen.getByRole('tab', { name: 'Server' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Media/ }).getAttribute('aria-selected')).toBe('true');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Home' }).getAttribute('aria-selected')).toBe('true');
  });

  test('rotates to the next tab after the rotation interval', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<MonitorView onOpenSettings={() => {}} />);
    await screen.findByRole('heading', { name: 'alpha' });
    await act(async () => { vi.advanceTimersByTime(16_000); });
    expect(screen.getByRole('tab', { name: /Media/ }).getAttribute('aria-selected')).toBe('true');
  });

  test('settings and kiosk are named buttons', async () => {
    const onOpenSettings = vi.fn();
    render(<MonitorView onOpenSettings={onOpenSettings} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Monitor settings' }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Kiosk' })).toBeTruthy();
  });

  test('an agent can find every control and switch tabs', async () => {
    render(<MonitorView onOpenSettings={() => {}} />);
    await screen.findByRole('heading', { name: 'alpha' });
    const components = agent.snapshot().filter((e) => !e.offPage && e.component !== 'more');
    for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
    const labels = components.map((e) => e.label);
    for (const label of ['Monitor sections', 'Order hosts by', 'Monitor settings']) {
      expect(labels, `${label} is missing from the snapshot`).toContain(label);
    }
    const result = await agent.act({ steps: [{ ref: 'Monitor sections', action: 'setValue', args: ['power'] }] });
    expect(result.ok, result.error?.message).toBe(true);
    expect(screen.getByRole('tab', { name: 'Power' }).getAttribute('aria-selected')).toBe('true');
  });

  test('Kiosk hides the sidebar for now and restores it without changing the saved choice', async () => {
    localStorage.setItem('homedash-sidebar-mode', 'rail');
    render(
      <AppShell tools={[]} view="monitor" onNavigate={() => {}} categories={[]} authEnabled={false} authenticated onSignIn={() => {}} onSignOut={() => {}} onOpenPalette={() => {}} notifications={null} serviceCount={0}>
        <MonitorView onOpenSettings={() => {}} />
      </AppShell>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Kiosk' }));
    expect(screen.getByRole('button', { name: /^Open sidebar/ })).toBeTruthy();
    expect(localStorage.getItem('homedash-sidebar-mode')).toBe('rail');
    await userEvent.click(screen.getByRole('button', { name: 'Exit kiosk' }));
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy();
    expect(localStorage.getItem('homedash-sidebar-mode')).toBe('rail');
  });

  test('a stopped poller reads as off, not as a live status', async () => {
    current = { ...overview, running: false, timestamp: Date.now() - 600_000 };
    render(<MonitorView onOpenSettings={() => {}} />);
    expect(await screen.findByText('Monitor is off')).toBeTruthy();
    expect(screen.getByText("The monitor isn't running")).toBeTruthy();
    expect(screen.queryByText(/Degraded/)).toBeNull();
  });

  test('an old snapshot from a running poller reads as stale', async () => {
    current = { ...overview, running: true, timestamp: Date.now() - 120_000 };
    render(<MonitorView onOpenSettings={() => {}} />);
    expect(await screen.findByText('Stale')).toBeTruthy();
    expect(screen.getByText('No fresh data from the poller')).toBeTruthy();
  });

  test('Docker counts running containers and names the host of each problem', async () => {
    current = {
      ...overview,
      timestamp: Date.now(),
      docker: {
        status: 'ok', total: 10, running: 7, healthy: 5, unhealthy: 2, restarting: 0,
        problems: [
          { name: 'glances', image: 'nicolargo/glances', state: 'running', health: 'unhealthy', host: { id: 'a', name: 'alpha' } },
          { name: 'glances', image: 'nicolargo/glances', state: 'running', health: 'unhealthy', host: { id: 'b', name: 'bravo' } },
        ],
      },
    };
    render(<MonitorView onOpenSettings={() => {}} />);
    expect(await screen.findByRole('meter', { name: 'Running containers' })).toBeTruthy();
    const rail = screen.getByRole('complementary', { name: 'Alerts' });
    expect(within(rail).getByText('glances on alpha is unhealthy')).toBeTruthy();
    expect(within(rail).getByText('glances on bravo is unhealthy')).toBeTruthy();
  });

  test('leaving the monitor mid-kiosk gives the rest of the app its sidebar back', async () => {
    localStorage.setItem('homedash-sidebar-mode', 'rail');
    function Harness() {
      const [onMonitor, setOnMonitor] = useState(true);
      return (
        <AppShell tools={[]} view={onMonitor ? 'monitor' : 'settings'} onNavigate={() => setOnMonitor(false)} categories={[]} authEnabled={false} authenticated onSignIn={() => {}} onSignOut={() => {}} onOpenPalette={() => {}} notifications={null} serviceCount={0}>
          {onMonitor ? <MonitorView onOpenSettings={() => setOnMonitor(false)} /> : <p>Settings page</p>}
        </AppShell>
      );
    }
    render(<Harness />);
    await userEvent.click(await screen.findByRole('button', { name: 'Kiosk' }));
    expect(screen.getByRole('button', { name: /^Open sidebar/ })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Monitor settings' }));
    expect(screen.getByText('Settings page')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Open sidebar/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy();
    expect(localStorage.getItem('homedash-sidebar-mode')).toBe('rail');
  });

  test('warnings with an ok server status read as needing attention', async () => {
    current = {
      ...overview,
      timestamp: Date.now(),
      globalStatus: 'ok',
      hosts: [host('a', 'alpha', 20, 30)],
      alerts: { firing: [], recentlyResolved: [] },
      arr: { status: 'ok', queue: [], instances: [{ name: '', type: 'sonarr', status: 'ok', queueCount: 0, wantedCount: 0, healthOk: false, healthWarnings: ['Indexer down'] }] },
    };
    render(<MonitorView onOpenSettings={() => {}} />);
    expect(await screen.findByText('Needs attention · 1 to check')).toBeTruthy();
    expect(screen.queryByText(/All systems normal/)).toBeNull();
  });
});
