import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import {
  parseContainerHealth,
  evaluateAlerts,
  resetAlertStateForTests,
  getAlertInstancesForTests,
  fetchSeerr,
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

// ---------------------------------------------------------------------------
// Seerr / Overseerr fetcher tests — mock the Overseerr-style API.
// ---------------------------------------------------------------------------

function seerrMockServer() {
  // Real Overseerr/Seerr list payloads carry tmdbId but NOT the title; the
  // title must be resolved from the movie/tv detail endpoints.
  const issues = [
    { id: 1, issueType: 3, resolved: false, createdAt: '2026-08-04T00:00:00.000Z',
      media: { mediaType: 'movie', tmdbId: 693134 }, createdBy: { displayName: 'Alice' } },
    { id: 2, issueType: 1, resolved: false, createdAt: '2026-08-05T00:00:00.000Z',
      media: { mediaType: 'tv', tmdbId: 95396 }, createdBy: { username: 'bob' } },
  ];
  const pending = [
    { id: 10, status: 0, is4k: true, createdAt: '2026-08-05T00:00:00.000Z',
      media: { mediaType: 'movie', tmdbId: 414906 }, requestedBy: { displayName: 'Alice' } },
  ];
  const failed = [
    { id: 11, status: 1, is4k: false, createdAt: '2026-08-05T00:00:00.000Z',
      media: { mediaType: 'tv', tmdbId: 83867 }, requestedBy: { username: 'carol' } },
  ];
  const titles = {
    '/api/v1/movie/693134': { mediaType: 'movie', title: 'Dune: Part Two' },
    '/api/v1/tv/95396': { mediaType: 'tv', name: 'Severance' },
    '/api/v1/movie/414906': { mediaType: 'movie', title: 'The Batman' },
    '/api/v1/tv/83867': { mediaType: 'tv', name: 'Foundation' },
  };
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const url = req.url || '';
    // "/empty" prefix simulates a healthy Seerr with nothing needing attention.
    if (url.startsWith('/empty')) {
      if (url === '/empty/api/v1/status') return res.end(JSON.stringify({ version: '1.0.0' }));
      return res.end(JSON.stringify({ pageInfo: {}, results: [] }));
    }
    if (url === '/api/v1/status') return res.end(JSON.stringify({ version: '1.4.2' }));
    if (url.includes('/api/v1/issue')) return res.end(JSON.stringify({ pageInfo: {}, results: issues }));
    if (url.includes('/api/v1/request') && url.includes('filter=pending')) return res.end(JSON.stringify({ pageInfo: {}, results: pending }));
    if (url.includes('/api/v1/request') && url.includes('filter=failed')) return res.end(JSON.stringify({ pageInfo: {}, results: failed }));
    if (titles[url]) return res.end(JSON.stringify(titles[url]));
    res.statusCode = 404;
    res.end('{}');
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

test('fetchSeerr surfaces open issues and unattended requests', async () => {
  const { server, port } = await seerrMockServer();
  try {
    const snap = await fetchSeerr([{ name: 'test', url: `http://127.0.0.1:${port}`, apiKey: 'secret' }]);
    assert.equal(snap.status, 'degraded'); // open issues + failed request need attention
    assert.equal(snap.version, '1.4.2');
    assert.equal(snap.issues.length, 2);
    assert.equal(snap.issues[0].mediaTitle, 'Dune: Part Two');
    assert.equal(snap.issues[0].issueType, 3);
    assert.equal(snap.issues[1].createdBy, 'bob');
    assert.equal(snap.pending.length, 1);
    assert.equal(snap.pending[0].mediaTitle, 'The Batman');
    assert.equal(snap.pending[0].is4k, true);
    assert.equal(snap.pending[0].status, 'pending');
    assert.equal(snap.failed.length, 1);
    assert.equal(snap.failed[0].mediaTitle, 'Foundation');
    assert.equal(snap.failed[0].status, 'failed');
  } finally {
    server.close();
  }
});

test('fetchSeerr is ok when the API reports nothing needing attention', async () => {
  const { server, port } = await seerrMockServer();
  try {
    const snap = await fetchSeerr([{ name: 'empty', url: `http://127.0.0.1:${port}/empty`, apiKey: '' }]);
    assert.equal(snap.status, 'ok');
    assert.equal(snap.issues.length, 0);
    assert.equal(snap.pending.length, 0);
    assert.equal(snap.failed.length, 0);
  } finally {
    server.close();
  }
});

test('fetchSeerr returns null when nothing is configured and marks unreachable as down', async () => {
  assert.equal(await fetchSeerr(undefined), null);
  assert.equal(await fetchSeerr([]), null);
  const down = await fetchSeerr([{ name: 'x', url: 'http://127.0.0.1:1', apiKey: 'k' }]);
  assert.equal(down.status, 'down');
  assert.ok(down.error);
});
