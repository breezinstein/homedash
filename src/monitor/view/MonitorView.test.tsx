import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createAgent } from '@ui-sdk/react/agent';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { HostSnapshot, MonitorOverview } from '../../types';
import { MonitorView } from './MonitorView';

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

vi.mock('../monitorApi', () => ({
  fetchOverview: vi.fn(async () => overview),
  fetchAlerts: vi.fn(async () => overview.alerts),
}));

const agent = createAgent();

describe('MonitorView', () => {
  beforeEach(() => {
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
});
