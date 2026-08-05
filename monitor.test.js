import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseContainerHealth,
  evaluateAlerts,
  resetAlertStateForTests,
  getAlertInstancesForTests,
} from './monitor.js';

function snapshot(hosts = []) {
  return {
    pollIntervalMs: 10_000,
    hosts,
    solar: null,
    docker: { unhealthy: 0, restarting: 0, total: 0, running: 0 },
    media: null,
    usenet: null,
  };
}

function host(id, percent, status = 'ok') {
  return {
    host: { id, name: id }, status,
    cpu: { percent, load: { '1m': 0, '5m': 0, '15m': 0 } },
    memory: { percent: 0 }, disk: { percent: 0 }, containers: [],
  };
}

test('parses Docker health and lifecycle status strings', () => {
  assert.deepEqual(parseContainerHealth('Up 2 hours (healthy)'), { state: 'running', health: 'healthy' });
  assert.deepEqual(parseContainerHealth('Up 2 hours (unhealthy)'), { state: 'running', health: 'unhealthy' });
  assert.deepEqual(parseContainerHealth('Restarting (1) 10 seconds ago'), { state: 'restarting', health: 'none' });
  assert.deepEqual(parseContainerHealth('Exited (0) 2 minutes ago'), { state: 'exited', health: 'none' });
});

test('fans an unscoped Glances rule out to every host and resolves it', () => {
  resetAlertStateForTests();
  const rule = {
    id: 'cpu-high', name: 'High CPU', enabled: true, source: 'glances',
    metric: 'cpu.percent', operator: '>=', threshold: 90, severity: 'warning', forSeconds: 20,
  };
  const first = snapshot([host('alpha', 95), host('beta', 91)]);
  evaluateAlerts([rule], first);
  evaluateAlerts([rule], first);

  const firing = getAlertInstancesForTests();
  assert.equal(firing.length, 2);
  assert.deepEqual(firing.map(alert => alert.id).sort(), ['cpu-high:alpha', 'cpu-high:beta']);
  assert.ok(firing.every(alert => alert.state === 'firing'));

  const resolved = snapshot([host('alpha', 10), host('beta', 10)]);
  evaluateAlerts([rule], resolved);
  assert.ok(getAlertInstancesForTests().every(alert => alert.state === 'resolved'));
});

test('unreachable host satisfies the synthetic reachability rule', () => {
  resetAlertStateForTests();
  const rule = {
    id: 'reachable', name: 'Host unreachable', enabled: true, source: 'reachability',
    metric: 'reachable', operator: '==', threshold: 0, severity: 'critical', forSeconds: 0,
  };
  evaluateAlerts([rule], snapshot([host('alpha', 0, 'down')]));
  assert.equal(getAlertInstancesForTests()[0].state, 'firing');
  evaluateAlerts([rule], snapshot([host('alpha', 0, 'ok')]));
  assert.equal(getAlertInstancesForTests()[0].state, 'resolved');
});
