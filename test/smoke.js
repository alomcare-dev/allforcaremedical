const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert/strict');

const port = 3117;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'afc-test-'));
const env = {
  ...process.env,
  PORT: String(port),
  DATA_DIR: dataDir,
  ADMIN_TOKEN: 'test-admin-token',
  PAYMENT_BASE_URL: 'https://payments.example.test'
};

const child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), env, stdio: ['ignore', 'pipe', 'pipe'] });
let stderr = '';
child.stderr.on('data', d => { stderr += d; });

async function request(url, options) {
  return fetch(`http://127.0.0.1:${port}${url}`, options);
}

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await request('/api/health');
      if (res.ok) return;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Server did not start');
}

(async () => {
  try {
    await waitForServer();

    const home = await request('/');
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.match(html, /Allfor Care Medical/);
    assert.doesNotMatch(html, /avg\. arrival 12 min|Unit 4 · Devon Reid|pay\.afcmedical\.com/);

    let res = await request('/api/bookings', {
      method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({ service: 'Home doctor visit', service_key: 'doctor', name: 'Test User', phone: '8765550100', date: '2026-09-02', time: '10:00' })
    });
    assert.equal(res.status, 201);

    res = await request('/api/sos', {
      method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({ phone: '8765550101', address: 'Kingston', staff_needed: 'Paramedic', mobility: 'Stretcher' })
    });
    assert.equal(res.status, 201);
    const sos = await res.json();
    assert.equal(sos.status, 'request_received');
    assert.equal('eta_minutes' in sos, false);
    assert.equal('crew' in sos, false);

    res = await request('/api/membership', {
      method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({ plan: 'Gold', price: '$10,000 JMD / month', name: 'Test Member', phone: '8765550102' })
    });
    assert.equal(res.status, 201);
    const membership = await res.json();
    assert.match(membership.pay_url, /^https:\/\/payments\.example\.test\/membership\?/);

    res = await request('/api/bookings');
    assert.equal(res.status, 401);

    res = await request('/api/bookings', { headers: { authorization: 'Bearer test-admin-token' } });
    assert.equal(res.status, 200);
    const bookings = await res.json();
    assert.equal(bookings.length, 1);

    // SOS requests must not default to "dispatched" before a crew is actually sent
    res = await request('/api/sos', { headers: { authorization: 'Bearer test-admin-token' } });
    const sosRows = await res.json();
    assert.equal(sosRows[0].status, 'request_received');

    // admin verify endpoint
    res = await request('/api/admin/verify', { headers: { authorization: 'Bearer wrong-token' } });
    assert.equal(res.status, 401);
    res = await request('/api/admin/verify', { headers: { authorization: 'Bearer test-admin-token' } });
    assert.equal(res.status, 200);

    // dispatcher status updates
    res = await request(`/api/sos/${sosRows[0].id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', authorization: 'Bearer test-admin-token' },
      body: JSON.stringify({ status: 'dispatched' })
    });
    assert.equal(res.status, 200);
    const updatedSos = await res.json();
    assert.equal(updatedSos.status, 'dispatched');

    res = await request(`/api/sos/${sosRows[0].id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', authorization: 'Bearer test-admin-token' },
      body: JSON.stringify({ status: 'not-a-real-status' })
    });
    assert.equal(res.status, 400);

    res = await request(`/api/sos/${sosRows[0].id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'dispatched' })
    });
    assert.equal(res.status, 401);

    res = await request('/api/sos/999999', {
      method: 'PATCH', headers: { 'content-type': 'application/json', authorization: 'Bearer test-admin-token' },
      body: JSON.stringify({ status: 'dispatched' })
    });
    assert.equal(res.status, 404);

    const dashboard = await request('/admin.html');
    assert.equal(dashboard.status, 200);
    assert.match(await dashboard.text(), /Dispatcher Dashboard/);

    assert.ok(fs.existsSync(path.join(dataDir, 'afc.db')));
    console.log('AFC smoke test passed');
  } finally {
    child.kill('SIGTERM');
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(err => {
  console.error(err);
  if (stderr) console.error(stderr);
  process.exitCode = 1;
});
