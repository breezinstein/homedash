import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryId } from './src/lib/slug.ts';
import { themeType } from './src/lib/themeType.ts';

const darkColors = {
  primary: '#6366f1',
  secondary: '#475569',
  background: '#0a0a0a',
  surface: '#1a1a1a',
  textPrimary: '#ffffff',
  textSecondary: '#a1a1aa',
  border: '#27272a',
  accent: '#8b5cf6',
  success: '#22c55e',
  warning: '#eab308',
  error: '#f87171',
};

const lightColors = {
  ...darkColors,
  background: '#f8fafc',
  surface: '#ffffff',
  textPrimary: '#0f172a',
};

test('categoryId is a stable, URL-safe anchor', () => {
  assert.equal(categoryId('Media'), 'cat-media');
  assert.equal(categoryId('Content & Knowledge'), 'cat-content-knowledge');
  assert.equal(categoryId('  A.I. @ Home  '), 'cat-a-i-home');
  // Same input, same id: the sidebar jump links rely on this.
  assert.equal(categoryId('System'), categoryId('system'));
});

test('themeType trusts the preset name over the colours', () => {
  // A user can hand-edit colours; the chosen preset still says what it is.
  assert.equal(themeType('Default Light', darkColors), 'light');
  assert.equal(themeType('Default Dark', lightColors), 'dark');
  assert.equal(themeType('Catppuccin Mocha', darkColors), 'dark');
});

test('themeType infers from the background when no preset matches', () => {
  assert.equal(themeType('custom', darkColors), 'dark');
  assert.equal(themeType('custom', lightColors), 'light');
  assert.equal(themeType(undefined, { ...darkColors, background: '#fff' }), 'light');
});

import { usageLevel, reserveLevel, cellSpreadLevel, temperatureLevel, expiryLevel, worstLevel } from './src/lib/levels.ts';
import { parseRoute, formatRoute } from './src/lib/route.ts';
import { pushSample, sparkPoints } from './src/lib/history.ts';

test('usage levels switch at 75% and 90%', () => {
  assert.equal(usageLevel(74), 'ok');
  assert.equal(usageLevel(75), 'warn');
  assert.equal(usageLevel(89), 'warn');
  assert.equal(usageLevel(90), 'critical');
  assert.equal(usageLevel(null), undefined);
  assert.equal(usageLevel(Number.NaN), undefined);
});

test('reserve, cell spread, temperature and expiry levels', () => {
  assert.equal(reserveLevel(31), 'ok');
  assert.equal(reserveLevel(30), 'warn');
  assert.equal(reserveLevel(15), 'critical');
  assert.equal(cellSpreadLevel(29), 'ok');
  assert.equal(cellSpreadLevel(34), 'warn');
  assert.equal(cellSpreadLevel(50), 'critical');
  assert.equal(temperatureLevel(71, 70, 85), 'warn');
  assert.equal(temperatureLevel(71, null, null), 'ok');
  assert.equal(expiryLevel(-1), 'critical');
  assert.equal(expiryLevel(9), 'warn');
  assert.equal(expiryLevel(61), 'ok');
  assert.equal(worstLevel('ok', undefined, 'warn'), 'warn');
  assert.equal(worstLevel(undefined), undefined);
});

test('routes map views to paths and back, under a sub-path too', () => {
  assert.deepEqual(parseRoute('/'), { view: 'dashboard', base: '' });
  assert.deepEqual(parseRoute('/monitor'), { view: 'monitor', base: '' });
  assert.deepEqual(parseRoute('/monitor/'), { view: 'monitor', base: '' });
  assert.deepEqual(parseRoute('/settings/monitor-hosts'), { view: 'settings', section: 'monitor-hosts', base: '' });
  assert.deepEqual(parseRoute('/settings'), { view: 'settings', base: '' });
  assert.deepEqual(parseRoute('/proxy/hd/files'), { view: 'files', base: '/proxy/hd' });
  assert.equal(formatRoute({ view: 'dashboard' }), '/');
  assert.equal(formatRoute({ view: 'monitor' }, '/proxy/hd'), '/proxy/hd/monitor');
  assert.equal(formatRoute({ view: 'settings', section: 'servers' }), '/settings/servers');
  for (const path of ['/monitor', '/files', '/settings/appearance', '/']) {
    const r = parseRoute(path);
    assert.equal(formatRoute(r, r.base), path);
  }
});

test('rolling history keeps one window and one sample per timestamp', () => {
  let s = [];
  s = pushSample(s, { t: 0, v: 1 }, 1000);
  s = pushSample(s, { t: 500, v: 2 }, 1000);
  s = pushSample(s, { t: 500, v: 3 }, 1000);
  assert.deepEqual(s.map((x) => x.v), [1, 3]);
  s = pushSample(s, { t: 1600, v: 4 }, 1000);
  assert.deepEqual(s.map((x) => x.t), [1600]);
  const { points, last } = sparkPoints([{ t: 0, v: 0 }, { t: 10, v: 10 }], 100, 20);
  assert.equal(points, '0.0,20.0 100.0,0.0');
  assert.deepEqual(last, [100, 0]);
});

import { collectIssues } from './src/monitor/issues.ts';

test('issues explain a degraded monitor: down sources, hosts, containers and Arr warnings', () => {
  const issues = collectIssues({
    hosts: [{ host: { id: 'a', name: 'alpha' }, status: 'down', error: 'refused' }, { host: { id: 'b', name: 'bravo' }, status: 'ok' }],
    docker: { problems: [{ name: 'immich-ml', image: 'x', state: 'running', health: 'unhealthy' }] },
    ntopng: { status: 'down', error: 'timeout' },
    solar: { status: 'ok' },
    arr: { status: 'ok', instances: [{ name: '', type: 'radarr', status: 'ok', healthWarnings: ['Indexer down'] }] },
  });
  assert.deepEqual(issues.map((i) => i.title), [
    'alpha is down',
    'immich-ml is unhealthy',
    "ntopng isn't answering",
    'Radarr health warning',
  ]);
  assert.equal(issues[2].detail, 'timeout');
  assert.equal(issues[3].detail, 'Indexer down');
  assert.deepEqual(collectIssues(null), []);
});
