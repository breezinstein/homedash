import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeServerLists, monitoredHosts, normalizeServerUrl } from './serverMerge.js';
import { buildAutoAlertRules, ensureAutoAlertRules } from './monitor.js';

const NOW = new Date('2026-11-27T20:00:00Z');

test('normalizeServerUrl ignores case, default ports and trailing slashes', () => {
  assert.equal(normalizeServerUrl('HTTP://Nas-01.LAN:80/'), 'http://nas-01.lan');
  assert.equal(normalizeServerUrl('https://pve.lan:443//'), 'https://pve.lan');
  assert.equal(normalizeServerUrl('http://cortex.lan:61208/'), 'http://cortex.lan:61208');
  assert.notEqual(normalizeServerUrl('http://a.lan:61208'), normalizeServerUrl('http://a.lan:61209'));
});

test('no overlap: hosts are appended with monitor on, servers get monitor off', () => {
  const config = {
    servers: [{ id: 's1', name: 'nas', url: 'http://nas.lan:61208', createdAt: 'x' }],
    monitoring: { glancesHosts: [{ id: 'h1', name: 'pve', url: 'http://pve.lan:61208', dockerUrl: 'tcp://pve:2375' }] },
  };
  const r = mergeServerLists(config, NOW);
  assert.equal(r.merged, 0);
  assert.equal(r.added, 1);
  assert.equal(config.monitoring.glancesHosts, undefined);
  assert.deepEqual(config.servers.map((s) => [s.id, s.monitor]), [['s1', false], ['h1', true]]);
  assert.equal(config.servers[1].dockerUrl, 'tcp://pve:2375');
  assert.equal(config.metadata.serverMerge.added, 1);
});

test('overlap by URL: one entry, monitor id and login win, alert rules follow the id', () => {
  const config = {
    servers: [{ id: 's1', name: 'NAS', url: 'http://NAS.lan:61208/', username: 'a', password: 'old', createdAt: 'x' }],
    monitoring: {
      glancesHosts: [{ id: 'h1', name: 'nas-01', url: 'http://nas.lan:61208', username: 'a', password: 'new' }],
      alerts: [{ id: 'r1', source: 'glances', metric: 'cpu.percent', host: 's1' }, { id: 'r2', host: 'other' }],
    },
  };
  const r = mergeServerLists(config, NOW);
  assert.equal(config.servers.length, 1);
  assert.equal(r.merged, 1);
  assert.deepEqual(r.conflicts, ['nas-01']);
  const s = config.servers[0];
  assert.equal(s.id, 'h1');
  assert.equal(s.name, 'nas-01');
  assert.equal(s.password, 'new');
  assert.equal(s.monitor, true);
  assert.equal(s.createdAt, 'x');
  assert.equal(config.monitoring.alerts[0].host, 'h1');
  assert.equal(config.monitoring.alerts[1].host, 'other');
});

test('a server without a login takes the monitor login without a conflict', () => {
  const config = {
    servers: [{ id: 's1', name: 'a', url: 'http://a.lan:61208' }],
    monitoring: { glancesHosts: [{ id: 'h1', name: 'a', url: 'http://a.lan:61208', username: 'u', password: 'p' }] },
  };
  const r = mergeServerLists(config, NOW);
  assert.deepEqual(r.conflicts, []);
  assert.equal(config.servers[0].username, 'u');
});

test('running twice changes nothing the second time', () => {
  const config = {
    servers: [{ id: 's1', name: 'a', url: 'http://a.lan' }],
    monitoring: { glancesHosts: [{ id: 'h1', name: 'b', url: 'http://b.lan' }] },
  };
  mergeServerLists(config, NOW);
  const snapshot = JSON.stringify(config);
  const second = mergeServerLists(config, NOW);
  assert.equal(second.changed, false);
  assert.equal(JSON.stringify(config), snapshot);
});

test('an empty glancesHosts list is removed; no servers at all is fine', () => {
  const config = { monitoring: { glancesHosts: [] } };
  const r = mergeServerLists(config, NOW);
  assert.equal(r.changed, true);
  assert.deepEqual(config.servers, []);
  assert.equal('glancesHosts' in config.monitoring, false);
  assert.equal(mergeServerLists({}, NOW).changed, false);
});

test('an id clash with an unrelated server gets a fresh id', () => {
  const config = {
    servers: [{ id: 'h1', name: 'x', url: 'http://x.lan' }],
    monitoring: { glancesHosts: [{ id: 'h1', name: 'y', url: 'http://y.lan' }] },
  };
  mergeServerLists(config, NOW);
  const ids = config.servers.map((s) => s.id);
  assert.equal(new Set(ids).size, 2);
});

test('monitoredHosts and the auto alert rules read the merged list', () => {
  const config = {
    servers: [{ id: 'a', url: 'http://a', monitor: true }, { id: 'b', url: 'http://b', monitor: false }],
    monitoring: { docker: { enabled: false } },
  };
  assert.deepEqual(monitoredHosts(config).map((s) => s.id), ['a']);
  assert.ok(buildAutoAlertRules(config.monitoring, monitoredHosts(config)).some((r) => r.id === 'auto-host-down'));
  assert.ok(ensureAutoAlertRules(config));
  assert.ok(config.monitoring.alerts.some((r) => r.id === 'auto-host-down'));
  const none = { servers: [{ id: 'b', url: 'http://b', monitor: false }], monitoring: { docker: { enabled: false } } };
  ensureAutoAlertRules(none);
  assert.ok(!(none.monitoring.alerts || []).some((r) => r.id === 'auto-host-down'));
});

test('a monitor host without a login keeps the server login, with no conflict', () => {
  const config = {
    servers: [{ id: 's1', name: 'nas', url: 'http://nas.lan:61208', username: 'svc', password: 'secret' }],
    monitoring: { glancesHosts: [{ id: 'h1', name: 'nas', url: 'http://nas.lan:61208' }] },
  };
  const r = mergeServerLists(config, NOW);
  assert.deepEqual(r.conflicts, []);
  assert.equal(config.servers[0].username, 'svc');
  assert.equal(config.servers[0].password, 'secret');
});

test('an overlap whose monitor id belongs to another server gets a fresh id, and rules follow', () => {
  const config = {
    servers: [
      { id: 's1', name: 'a', url: 'http://a.lan' },
      { id: 'h1', name: 'b', url: 'http://b.lan' },
    ],
    monitoring: {
      glancesHosts: [{ id: 'h1', name: 'a', url: 'http://a.lan' }],
      alerts: [{ id: 'r1', host: 'h1' }, { id: 'r2', host: 's1' }],
    },
  };
  mergeServerLists(config, NOW);
  const ids = config.servers.map((s) => s.id);
  assert.equal(new Set(ids).size, 2, `duplicate ids: ${ids}`);
  const merged = config.servers.find((s) => s.url === 'http://a.lan');
  assert.equal(merged.monitor, true);
  assert.notEqual(merged.id, 'h1');
  assert.equal(config.servers.find((s) => s.url === 'http://b.lan').id, 'h1');
  // Rules were evaluated against monitor host ids, so both now point at the merged entry.
  assert.deepEqual(config.monitoring.alerts.map((r) => r.host), [merged.id, merged.id]);
});
