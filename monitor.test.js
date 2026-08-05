import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import {
  parseContainerHealth,
  evaluateAlerts,
  resetAlertStateForTests,
  getAlertInstancesForTests,
  fetchSeerr,
  estimateBatteryRuntime,
  resolveMetric,
  fetchNtopng,
  fetchHomeAssistant,
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

// ---------------------------------------------------------------------------
// Battery runtime estimation tests.
// Batteries report capacity in Ah (e.g. cap:206); energy = Ah × voltage.
// ---------------------------------------------------------------------------

function batteryBank(n = 3, capAh = 206, voltage = 58) {
  return Array.from({ length: n }, () => ({ capacityAh: capAh, voltage }));
}

test('battery runtime to empty uses the 10-minute average house load', () => {
  const key = 'test-runtime-empty';
  const batteries = batteryBank(3); // 3 × 206 Ah × 58 V = 35,844 Wh
  const totalWh = 3 * 206 * 58;

  // Seed three load samples (4 kW, 2 kW, 6 kW) → average = 4 kW.
  estimateBatteryRuntime(key, 100, 0, 4000, batteries);
  estimateBatteryRuntime(key, 100, 0, 2000, batteries);
  const mins = estimateBatteryRuntime(key, 100, 0, 6000, batteries);

  const expectedMins = (totalWh / 4000) * 60; // ~537.7 min at 4 kW average
  assert.ok(Math.abs(mins - expectedMins) < 1, `expected ~${expectedMins}, got ${mins}`);
});

test('battery runtime to full uses the battery charge power', () => {
  const batteries = batteryBank(1); // 1 × 206 Ah × 58 V = 11,948 Wh
  const totalWh = 206 * 58;
  // SOC 50% at 1 kW charging → (50% × 11,948 Wh) / 1000 W = ~5.97 h.
  const mins = estimateBatteryRuntime('test-runtime-full', 50, 1000, 4000, batteries);
  const expectedMins = (totalWh * 0.5) / 1000 * 60;
  assert.ok(Math.abs(mins - expectedMins) < 1, `expected ~${expectedMins}, got ${mins}`);
});

test('battery runtime scales with SOC when discharging against the load', () => {
  const key = 'test-runtime-soc';
  const batteries = batteryBank(3);
  const totalWh = 3 * 206 * 58;
  // Fixed 4 kW load; SOC 50% should last exactly half of SOC 100%.
  estimateBatteryRuntime(key, 100, 0, 4000, batteries);
  const minsFull = estimateBatteryRuntime(key, 100, 0, 4000, batteries);
  const minsHalf = estimateBatteryRuntime(key, 50, 0, 4000, batteries);
  const expectedHalf = (totalWh * 0.5) / 4000 * 60;
  assert.ok(minsFull > minsHalf);
  assert.ok(Math.abs(minsHalf - expectedHalf) < 1, `expected ~${expectedHalf}, got ${minsHalf}`);
});

test('battery runtime returns null without capacity or meaningful load', () => {
  assert.equal(estimateBatteryRuntime('x', 100, 0, 0, []), null);
  assert.equal(estimateBatteryRuntime('y', 100, 0, 0, [{ capacityAh: 206, voltage: 58 }]), null);
  assert.equal(estimateBatteryRuntime('z', null, 0, 4000, [{ capacityAh: 206, voltage: 58 }]), null);
});

test('resolveMetric supports solar battery power and seerr sources', () => {
  const snapshot = {
    solar: { status: 'ok', batteryPowerW: 120, batterySocPercent: 80 },
    seerr: { status: 'degraded', issues: [1, 2], pending: [], failed: [1] },
  };
  assert.equal(resolveMetric({ source: 'solar', metric: 'battery.power' }, snapshot), 120);
  assert.equal(resolveMetric({ source: 'solar', metric: 'battery.soc' }, snapshot), 80);
  assert.equal(resolveMetric({ source: 'seerr', metric: 'seerr.issues' }, snapshot), 2);
  assert.equal(resolveMetric({ source: 'seerr', metric: 'seerr.failed' }, snapshot), 1);
  assert.equal(resolveMetric({ source: 'seerr', metric: 'seerr.pending' }, snapshot), 0);
  // A down Seerr instance should not feed alert rules.
  assert.equal(resolveMetric({ source: 'seerr', metric: 'seerr.issues' }, { seerr: { status: 'down' } }), null);
  // Unknown sources / metrics resolve to null.
  assert.equal(resolveMetric({ source: 'seerr', metric: 'nope' }, snapshot), null);
  assert.equal(resolveMetric({ source: 'usenet', metric: 'nope' }, snapshot), null);
});

test('fetchNtopng normalizes Pro top local talkers', async () => {
  const server = createServer((req, res) => {
    if (req.url.startsWith('/lua/rest/v2/get/ntopng/interfaces.lua')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ rc: 0, rc_str: 'OK', rsp: [{ ifid: 0, ifname: 'eth0', name: 'LAN' }] }));
    } else if (req.url.startsWith('/lua/pro/rest/v2/get/interface/top/local/talkers.lua')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ rc: 0, rc_str: 'OK', rsp: [
        { address: '192.168.1.10', name: 'laptop', value: 5000000 },
        { ip: '192.168.1.20', value: 3000000 },
      ] }));
    } else {
      res.statusCode = 404; res.end();
    }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const { port } = server.address();
    const out = await fetchNtopng([{ id: 'n1', name: 'ntop', url: `http://127.0.0.1:${port}`, username: 'admin', password: 'admin' }]);
    assert.equal(out.status, 'ok');
    assert.equal(out.ifname, 'LAN');
    assert.equal(out.source, 'pro');
    assert.equal(out.topTalkers.length, 2);
    assert.equal(out.topTalkers[0].address, '192.168.1.10');
    assert.equal(out.topTalkers[0].name, 'laptop');
    assert.equal(out.topTalkers[0].bytes, 5000000);
  } finally {
    await new Promise(r => server.close(r));
  }
});

test('fetchNtopng falls back to community active hosts', async () => {
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/lua/rest/v2/get/ntopng/interfaces.lua')) {
      res.end(JSON.stringify({ rc: 0, rc_str: 'OK', rsp: [{ ifid: 1, ifname: 'br0' }] }));
    } else if (req.url.startsWith('/lua/pro/rest/v2/get/interface/top/local/talkers.lua')) {
      res.statusCode = 403; res.end(); // not granted on Community
    } else if (req.url.startsWith('/lua/rest/v2/get/host/active.lua')) {
      res.end(JSON.stringify({ rc: 0, rc_str: 'OK', rsp: { data: [
        { ip: '10.0.0.5', name: 'nas', bytes: { total: 9000000, sent: 3000000, recvd: 6000000 }, thpt: { bps: 1200000 }, first_seen: 1700000000 },
        { ip: '10.0.0.9', name: '0', bytes: { total: 2000000, sent: 500000, recvd: 1500000 }, thpt: { bps: 300000 }, first_seen: 1700000100 },
      ] } }));
    } else { res.statusCode = 404; res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const { port } = server.address();
    const out = await fetchNtopng([{ id: 'n1', name: 'ntop', url: `http://127.0.0.1:${port}` }]);
    assert.equal(out.status, 'ok');
    assert.equal(out.ifid, 1);
    assert.equal(out.source, 'community');
    assert.equal(out.topTalkers.length, 2);
    assert.equal(out.topTalkers[0].bytes, 9000000);
    assert.equal(out.topTalkers[0].throughputBps, 1200000);
    assert.equal(out.topTalkers[0].bytesSent, 3000000);
    assert.equal(out.topTalkers[0].bytesRcvd, 6000000);
    assert.equal(out.topTalkers[0].firstSeen, 1700000000);
    // First poll has no prior sample, so per-direction rates are not yet known.
    assert.equal(out.topTalkers[0].txBps, null);
    assert.equal(out.topTalkers[0].rxBps, null);
    // name "0" (numeric) is treated as unnamed
    assert.equal(out.topTalkers[1].name, null);
  } finally {
    await new Promise(r => server.close(r));
  }
});

test('fetchNtopng authenticates with Token header when Basic is rejected', async () => {
  // Simulates an ntopng instance that only accepts `Authorization: Token`.
  // Basic auth gets a 302 → login.lua redirect, exactly like the live device.
  const server = createServer((req, res) => {
    const isToken = req.headers.authorization === 'Token secret';
    if (req.url.startsWith('/lua/rest/v2/get/ntopng/interfaces.lua')) {
      if (!isToken) { res.statusCode = 302; res.setHeader('Location', '/lua/login.lua'); res.end(); return; }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ rc: 0, rc_str: 'OK', rsp: [{ ifid: 0, ifname: 'eth0', name: 'LAN' }] }));
    } else if (req.url.startsWith('/lua/pro/rest/v2/get/interface/top/local/talkers.lua')) {
      if (!isToken) { res.statusCode = 302; res.setHeader('Location', '/lua/login.lua'); res.end(); return; }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ rc: 0, rc_str: 'OK', rsp: [{ address: '10.0.0.8', value: 1234 }] }));
    } else {
      res.statusCode = 404; res.end();
    }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const { port } = server.address();
    const out = await fetchNtopng([{
      id: 'n1', name: 'ntop', url: `http://127.0.0.1:${port}`,
      username: 'admin', password: 'secret', // password is an API token here
    }]);
    assert.equal(out.status, 'ok');
    assert.equal(out.source, 'pro');
    assert.equal(out.topTalkers[0].address, '10.0.0.8');
  } finally {
    await new Promise(r => server.close(r));
  }
});

test('fetchNtopng reports an auth failure when every scheme is rejected', async () => {
  const server = createServer((req, res) => {
    res.statusCode = 302;
    res.setHeader('Location', '/lua/login.lua');
    res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const { port } = server.address();
    const out = await fetchNtopng([{
      id: 'n1', name: 'ntop', url: `http://127.0.0.1:${port}`,
      username: 'admin', password: 'wrong',
    }]);
    assert.equal(out.status, 'down');
    assert.match(out.error, /authentication failed/i);
  } finally {
    await new Promise(r => server.close(r));
  }
});

test('fetchHomeAssistant surfaces glanceable metrics and unavailable devices', async () => {
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/api/config')) {
      res.end(JSON.stringify({ version: '2024.1.0', location_name: 'Home' }));
    } else if (req.url.startsWith('/api/states')) {
      res.end(JSON.stringify([
        { entity_id: 'sensor.power', state: '123.4', attributes: { friendly_name: 'Power', device_class: 'power', unit_of_measurement: 'W' } },
        { entity_id: 'sensor.temp', state: '21.5', attributes: { friendly_name: 'Temp', device_class: 'temperature', unit_of_measurement: '°C' } },
        { entity_id: 'light.living', state: 'on', attributes: { friendly_name: 'Living Light' } },
        { entity_id: 'sensor.mqtt_bad', state: 'unavailable', attributes: { friendly_name: 'Bad MQTT' } },
        // Open door → surfaces as a doors metric.
        { entity_id: 'binary_sensor.front_door', state: 'on', attributes: { friendly_name: 'Front Door', device_class: 'door' } },
        // Glances entity duplicates the server integration → excluded entirely.
        { entity_id: 'sensor.glances_cpu', state: 'unavailable', attributes: { friendly_name: 'Glances CPU' } },
        // Inverter power duplicates the solar integration → not the power metric.
        { entity_id: 'sensor.inverter_power', state: '500', attributes: { friendly_name: 'Inverter Power', device_class: 'power', unit_of_measurement: 'W' } },
        // Pressure pump → drives the Home Status card hero.
        { entity_id: 'switch.pressure_pump', state: 'on', attributes: { friendly_name: 'Pressure Pump' }, last_changed: '2026-08-05T10:00:00.000Z' },
        // Pump timer is the source of truth for running + remaining time.
        // HA reports duration/remaining as "HH:MM:SS" strings.
        { entity_id: 'timer.pressure_pump_timer', state: 'active', attributes: { friendly_name: 'Pressure Pump Timer', duration: '0:15:00', remaining: '0:09:00' } },
      ]));
    } else { res.statusCode = 404; res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const { port } = server.address();
    const out = await fetchHomeAssistant([{ id: 'ha1', name: 'ha', url: `http://127.0.0.1:${port}`, token: 'tok' }]);
    assert.equal(out.status, 'ok');
    assert.equal(out.version, '2024.1.0');
    assert.equal(out.locationName, 'Home');
    // 9 entities minus the excluded Glances one.
    assert.equal(out.entityCount, 8);
    assert.equal(out.onCount, 3); // light + open door + switch pump
    assert.equal(out.unavailable.count, 1); // Glances exclusion also applies here
    assert.equal(out.unavailable.devices[0].name, 'Bad MQTT');
    // Power picks the non-inverter sensor.
    assert.equal(out.metrics.find(m => m.key === 'power').value, 123.4);
    assert.equal(out.metrics.find(m => m.key === 'power').unit, 'W');
    assert.equal(out.metrics.find(m => m.key === 'lights').value, 1);
    assert.equal(out.metrics.find(m => m.key === 'doors').value, 1);
    assert.equal(out.metrics.find(m => m.key === 'temperature').value, 21.5);
    // Energy and "entities on" metrics are intentionally not reported.
    assert.equal(out.metrics.find(m => m.key === 'energy'), undefined);
    assert.equal(out.metrics.find(m => m.key === 'on'), undefined);
    // Pressure pump hero data driven by the timer.
    assert.equal(out.pump.present, true);
    assert.equal(out.pump.running, true);
    assert.equal(out.pump.label, 'PRESSURE PUMP');
    assert.equal(out.pump.timerRemaining, 540);
    assert.equal(out.pump.timerDuration, 900);
  } finally {
    await new Promise(r => server.close(r));
  }
});

test('fetchHomeAssistant reports auth failure on 401', async () => {
  const server = createServer((req, res) => { res.statusCode = 401; res.end(); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const { port } = server.address();
    const out = await fetchHomeAssistant([{ id: 'ha1', name: 'ha', url: `http://127.0.0.1:${port}`, token: 'bad' }]);
    assert.equal(out.status, 'down');
    assert.match(out.error, /authentication failed/i);
  } finally {
    await new Promise(r => server.close(r));
  }
});

test('fetchNtopng ranks top talkers by live throughput, not bytes', async () => {
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/lua/rest/v2/get/ntopng/interfaces.lua')) {
      res.end(JSON.stringify({ rc: 0, rc_str: 'OK', rsp: [{ ifid: 0, ifname: 'eth0' }] }));
    } else if (req.url.startsWith('/lua/pro/rest/v2/get/interface/top/local/talkers.lua')) {
      res.statusCode = 403; res.end();
    } else if (req.url.startsWith('/lua/rest/v2/get/host/active.lua')) {
      // Two hosts: B has far more cumulative bytes but a lower live rate.
      res.end(JSON.stringify({ rc: 0, rc_str: 'OK', rsp: { data: [
        { ip: '10.0.0.2', name: 'big-downloader', bytes: { total: 8000000 }, thpt: { bps: 200000 } },
        { ip: '10.0.0.1', name: 'hot-now', bytes: { total: 1000000 }, thpt: { bps: 5000000 } },
      ] } }));
    } else { res.statusCode = 404; res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const { port } = server.address();
    const out = await fetchNtopng([{ id: 'n1', name: 'ntop', url: `http://127.0.0.1:${port}` }]);
    assert.equal(out.status, 'ok');
    assert.equal(out.topTalkers[0].address, '10.0.0.1', 'higher live throughput ranks first');
    assert.equal(out.topTalkers[0].throughputBps, 5000000);
    assert.equal(out.topTalkers[1].address, '10.0.0.2');
  } finally {
    await new Promise(r => server.close(r));
  }
});
