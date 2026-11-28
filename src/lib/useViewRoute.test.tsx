import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { View } from './route';
import { setNavGuard } from './navGuard';
import { useViewRoute } from './useViewRoute';

const canOpen = (view: View) => view !== 'clipboard';

function Harness({ onBlocked = () => {} }: { onBlocked?: (v: View) => void }) {
  const { view, section, navigate } = useViewRoute({ canOpen, onBlocked });
  return (
    <div>
      <p data-testid="where">{view}{section ? `:${section}` : ''}</p>
      <button type="button" onClick={() => { void navigate('monitor'); }}>Monitor</button>
      <button type="button" onClick={() => { void navigate('settings'); }}>Settings</button>
      <button type="button" onClick={() => { void navigate('settings', 'monitor-general'); }}>Monitor settings</button>
      <button type="button" onClick={() => { void navigate('clipboard'); }}>Clipboard</button>
    </div>
  );
}

const where = () => screen.getByTestId('where').textContent;

describe('view routing', () => {
  beforeEach(() => window.history.replaceState(null, '', '/monitor'));
  afterEach(() => setNavGuard(null));

  test('a click pushes the path and Back returns to the previous view', async () => {
    render(<Harness />);
    expect(where()).toBe('monitor');
    await userEvent.click(screen.getByRole('button', { name: 'Monitor settings' }));
    expect(where()).toBe('settings:monitor-general');
    expect(window.location.pathname).toBe('/settings/monitor-general');
    window.history.back();
    await waitFor(() => expect(where()).toBe('monitor'));
    expect(window.location.pathname).toBe('/monitor');
  });

  test('Back with unsaved work asks first; staying keeps the view and puts the URL back', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Monitor settings' }));
    const guard = vi.fn(async () => false);
    setNavGuard(guard);
    window.history.back();
    await waitFor(() => expect(guard).toHaveBeenCalledOnce());
    await waitFor(() => expect(window.location.pathname).toBe('/settings/monitor-general'));
    expect(where()).toBe('settings:monitor-general');

    setNavGuard(async () => true);
    window.history.back();
    await waitFor(() => expect(where()).toBe('monitor'));
  });

  test('choosing the view that is already open does nothing and asks nothing', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Monitor settings' }));
    const guard = vi.fn(async () => false);
    setNavGuard(guard);
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(guard).not.toHaveBeenCalled();
    expect(where()).toBe('settings:monitor-general');
  });

  test('a view the person cannot open yet is handed to onBlocked', async () => {
    const onBlocked = vi.fn();
    render(<Harness onBlocked={onBlocked} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clipboard' }));
    expect(onBlocked).toHaveBeenCalledWith('clipboard');
    expect(where()).toBe('monitor');
  });
});
